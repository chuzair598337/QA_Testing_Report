// Manage Access data layer — split out of useReports.js (which stays
// focused on report-level CRUD; this owns everything the Manage Access
// module needs). Merges report_members + pending report_invites +
// profiles into one unified list, and wraps the invite-member Edge
// Function's resend/revoke actions and the transfer_report_ownership RPC.
import { supabase } from '../lib/supabaseClient'

// One row per member/invite — see this file's header for the full shape.
async function fetchMembers(reportId) {
  const [membersRes, invitesRes] = await Promise.all([
    supabase.from('report_members').select('*').eq('report_id', reportId),
    supabase.from('report_invites').select('*').eq('report_id', reportId).eq('status', 'pending'),
  ])

  if (membersRes.error) return { data: null, error: membersRes.error.message }
  if (invitesRes.error) return { data: null, error: invitesRes.error.message }

  const userIds = membersRes.data.map((m) => m.user_id)
  let profilesById = {}
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)
    if (profilesError) return { data: null, error: profilesError.message }
    profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  }

  const memberRows = membersRes.data.map((m) => {
    const profile = profilesById[m.user_id]
    return {
      kind: 'member',
      id: m.id,
      user_id: m.user_id,
      email: profile?.email || null,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      role: m.role,
      status: 'active',
      created_at: m.created_at,
    }
  })

  const inviteRows = invitesRes.data.map((inv) => ({
    kind: 'invite',
    id: inv.id,
    user_id: null,
    email: inv.email,
    full_name: null,
    avatar_url: null,
    role: inv.role,
    status: 'pending',
    created_at: inv.created_at,
    resent_at: inv.resent_at,
  }))

  return { data: [...memberRows, ...inviteRows], error: null }
}

async function invokeMemberAction(body) {
  const { data, error } = await supabase.functions.invoke('invite-member', { body })
  if (error) {
    // supabase-js surfaces non-2xx Edge Function responses as a generic
    // FunctionsHttpError — the function's own { error } body carries the
    // real message, so pull it out for a useful inline message.
    const detail = await error.context?.json?.().catch(() => null)
    return { data: null, error: detail?.error || error.message }
  }
  if (data?.error) return { data: null, error: data.error }
  return { data, error: null }
}

async function inviteMember(reportId, email, role) {
  const value = (email || '').trim()
  if (!value) return { data: null, error: 'Enter an email address.' }
  if (!['editor', 'viewer'].includes(role)) return { data: null, error: 'Role must be editor or viewer.' }
  return invokeMemberAction({ action: 'invite', report_id: reportId, email: value, role })
}

async function resendInvite(reportId, inviteId) {
  return invokeMemberAction({ action: 'resend', report_id: reportId, invite_id: inviteId })
}

async function revokeInvite(reportId, inviteId) {
  return invokeMemberAction({ action: 'revoke', report_id: reportId, invite_id: inviteId })
}

async function updateMemberRole(memberId, role) {
  const { error } = await supabase.from('report_members').update({ role }).eq('id', memberId)
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

async function removeMember(memberId) {
  const { error } = await supabase.from('report_members').delete().eq('id', memberId)
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

async function transferOwnership(reportId, newOwnerMemberId, oldOwnerNewRole = 'editor') {
  const { error } = await supabase.rpc('transfer_report_ownership', {
    p_report_id: reportId,
    p_new_owner_member_id: newOwnerMemberId,
    p_old_owner_new_role: oldOwnerNewRole,
  })
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export function useReportMembers() {
  return {
    fetchMembers,
    inviteMember,
    resendInvite,
    revokeInvite,
    updateMemberRole,
    removeMember,
    transferOwnership,
  }
}
