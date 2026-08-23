// Invite a member to a report by email.
//
// This exists as an Edge Function (not client code) because both of its
// real operations require the service-role key, which must never reach
// the browser:
//   - looking up whether an account with this email already exists
//   - admin.inviteUserByEmail() for accounts that don't exist yet
//
// Authorization is done with the CALLER's own JWT (forwarded from the
// browser) against RLS, BEFORE any service-role client is touched — so
// this function can only ever act on behalf of a report's actual owner,
// never anyone else, regardless of what's in the request body.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { report_id, email, role } = await req.json()

    if (!report_id || typeof email !== 'string' || !email.trim() || !['editor', 'viewer'].includes(role)) {
      return json({ error: 'report_id, email, and role (editor|viewer) are required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Caller-scoped client (respects RLS) — used ONLY to establish who is
    // calling and whether they actually own this report. No privileged
    // action happens through this client.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData?.user) {
      return json({ error: 'Not authenticated' }, 401)
    }

    const { data: memberRow, error: memberError } = await callerClient
      .from('report_members')
      .select('role')
      .eq('report_id', report_id)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (memberError) {
      return json({ error: memberError.message }, 500)
    }
    if (memberRow?.role !== 'owner') {
      return json({ error: 'Only the report owner can invite members' }, 403)
    }

    // Service-role client — only reachable past the authorization check
    // above, and never exposed to the browser (this code runs on
    // Supabase's infra, not the client).
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Rate limit: max 20 invite attempts per owner per rolling hour.
    // Edge Function instances are ephemeral/multi-instance, so in-memory
    // counters aren't reliable — backed by the invite_attempts table
    // instead (see phase9_invite_rate_limit migration).
    const RATE_LIMIT = 20
    const RATE_WINDOW_MS = 60 * 60 * 1000
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()

    const { count: recentAttempts, error: rateLimitError } = await adminClient
      .from('invite_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.user.id)
      .gte('created_at', windowStart)

    if (rateLimitError) {
      return json({ error: rateLimitError.message }, 500)
    }
    if ((recentAttempts ?? 0) >= RATE_LIMIT) {
      return json(
        { error: `Too many invites sent recently. Try again in a bit (limit: ${RATE_LIMIT}/hour).` },
        429,
      )
    }
    await adminClient.from('invite_attempts').insert({ user_id: userData.user.id })

    // No guaranteed direct "get user by email" admin call across
    // supabase-js versions — list + filter client-side. Fine for this
    // app's scale; revisit with pagination if the user base grows large.
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) {
      return json({ error: 'Could not look up existing users: ' + listError.message }, 500)
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existing = listData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)

    if (existing) {
      const { error: insertError } = await adminClient
        .from('report_members')
        .insert({ report_id, user_id: existing.id, role })

      if (insertError) {
        return json({ error: insertError.message }, 500)
      }

      return json(
        { status: 'added', message: `${email} already has an account and was added directly.` },
        200,
      )
    }

    const origin = req.headers.get('origin') || ''
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback`,
      data: { invited_report_id: report_id, invited_role: role },
    })

    if (inviteError) {
      return json({ error: inviteError.message }, 500)
    }

    return json({ status: 'invited', message: `Invite email sent to ${email}.` }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
