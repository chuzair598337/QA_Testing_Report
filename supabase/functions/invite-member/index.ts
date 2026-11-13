// Invite a member to a report by email — and manage the pending-invite
// lifecycle (resend/revoke). Branches on `action` in the request body;
// `action` defaults to 'invite' so existing callers keep working
// unchanged.
//
// This exists as an Edge Function (not client code) because its real
// operations require the service-role key, which must never reach the
// browser: looking up whether an account with an email already exists,
// admin.inviteUserByEmail() for accounts that don't exist yet, and
// resending that invite email.
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

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000

async function checkRateLimit(adminClient: ReturnType<typeof createClient>, userId: string) {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error } = await adminClient
    .from('invite_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)

  if (error) throw new Error(error.message)
  if ((count ?? 0) >= RATE_LIMIT) {
    throw new Error(`Too many invites sent recently. Try again in a bit (limit: ${RATE_LIMIT}/hour).`)
  }
  await adminClient.from('invite_attempts').insert({ user_id: userId })
}

async function handleInvite(
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
  reportId: string,
  email: string,
  role: string,
  req: Request,
) {
  try {
    await checkRateLimit(adminClient, callerId)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 429)
  }

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

  // email is already normalized (lowercased) by the Deno.serve handler
  // before handleInvite is called — every write/lookup below uses it
  // consistently, so private.attach_invited_membership()'s exact-match
  // trigger (and the partial-unique "already invited" constraint) can't
  // be bypassed by varying case.
  const normalizedEmail = email
  const existing = listData.users.find((u) => u.email?.toLowerCase() === normalizedEmail)

  if (existing) {
    const { error: insertError } = await adminClient
      .from('report_members')
      .insert({ report_id: reportId, user_id: existing.id, role })
    if (insertError) {
      return json({ error: insertError.message }, 500)
    }
    return json(
      { status: 'added', message: `${normalizedEmail} already has an account and was added directly.` },
      200,
    )
  }

  // report_invites row first — if this fails (e.g. duplicate pending
  // invite), no email gets sent for a row that doesn't exist.
  const { error: inviteRowError } = await adminClient
    .from('report_invites')
    .insert({ report_id: reportId, email: normalizedEmail, role, invited_by: callerId })
  if (inviteRowError) {
    if (inviteRowError.code === '23505') {
      return json({ error: `${normalizedEmail} already has a pending invite.` }, 409)
    }
    return json({ error: inviteRowError.message }, 500)
  }

  const origin = req.headers.get('origin') || ''
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${origin}/auth/callback`,
    data: { invited_report_id: reportId, invited_role: role },
  })
  if (inviteError) {
    // Roll back the report_invites row so a failed email send doesn't
    // leave a phantom pending invite blocking a retry.
    await adminClient
      .from('report_invites')
      .delete()
      .eq('report_id', reportId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
    return json({ error: inviteError.message }, 500)
  }

  return json({ status: 'invited', message: `Invite email sent to ${normalizedEmail}.` }, 200)
}

async function handleResend(
  adminClient: ReturnType<typeof createClient>,
  callerId: string,
  reportId: string,
  inviteId: string | undefined,
  req: Request,
) {
  if (!inviteId) return json({ error: 'invite_id is required' }, 400)

  const { data: invite, error: fetchError } = await adminClient
    .from('report_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('report_id', reportId)
    .maybeSingle()
  if (fetchError) return json({ error: fetchError.message }, 500)
  if (!invite) return json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') {
    return json({ status: 'noop', message: 'This invite is no longer pending.' }, 200)
  }

  try {
    await checkRateLimit(adminClient, callerId)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 429)
  }

  const origin = req.headers.get('origin') || ''
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo: `${origin}/auth/callback`,
    data: { invited_report_id: reportId, invited_role: invite.role },
  })
  if (inviteError) return json({ error: inviteError.message }, 500)

  await adminClient
    .from('report_invites')
    .update({ resent_at: new Date().toISOString() })
    .eq('id', inviteId)
  return json({ status: 'resent', message: `Invite email re-sent to ${invite.email}.` }, 200)
}

async function handleRevoke(
  adminClient: ReturnType<typeof createClient>,
  reportId: string,
  inviteId: string | undefined,
) {
  if (!inviteId) return json({ error: 'invite_id is required' }, 400)

  const { data: invite, error: fetchError } = await adminClient
    .from('report_invites')
    .select('status')
    .eq('id', inviteId)
    .eq('report_id', reportId)
    .maybeSingle()
  if (fetchError) return json({ error: fetchError.message }, 500)
  if (!invite) return json({ error: 'Invite not found.' }, 404)
  if (invite.status !== 'pending') {
    return json({ status: 'noop', message: 'This invite is already handled.' }, 200)
  }

  const { error: updateError } = await adminClient
    .from('report_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
  if (updateError) return json({ error: updateError.message }, 500)

  return json({ status: 'revoked', message: 'Invite revoked.' }, 200)
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
    const body = await req.json()
    const action = body.action || 'invite'
    const reportId = body.report_id

    if (!reportId) {
      return json({ error: 'report_id is required' }, 400)
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
      .eq('report_id', reportId)
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (memberError) {
      return json({ error: memberError.message }, 500)
    }
    if (memberRow?.role !== 'owner') {
      return json({ error: 'Only the report owner can manage members' }, 403)
    }

    // Service-role client — only reachable past the authorization check
    // above, and never exposed to the browser (this code runs on
    // Supabase's infra, not the client).
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    if (action === 'revoke') {
      return await handleRevoke(adminClient, reportId, body.invite_id)
    }
    if (action === 'resend') {
      return await handleResend(adminClient, userData.user.id, reportId, body.invite_id, req)
    }

    const { email, role } = body
    if (typeof email !== 'string' || !email.trim() || !['editor', 'viewer'].includes(role)) {
      return json({ error: 'email and role (editor|viewer) are required' }, 400)
    }
    // Normalize (trim + lowercase) once, here, so handleInvite never sees
    // non-normalized input — every downstream write/lookup (report_invites
    // insert, inviteUserByEmail, the rollback delete, the listUsers
    // comparison) then uses the exact same value consistently.
    return await handleInvite(adminClient, userData.user.id, reportId, email.trim().toLowerCase(), role, req)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
