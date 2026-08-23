-- Auto-attach report_members for users created via admin.inviteUserByEmail().
--
-- SECURITY: gated on auth.users.invited_at IS NOT NULL, which Postgres/GoTrue
-- only sets for accounts created through the admin invite flow — never for
-- regular self-service signUp(). Without this gate, any self-registering
-- user could pass data: { invited_report_id, invited_role: 'owner' } to
-- signUp() themselves and grant themselves membership (or ownership) on an
-- arbitrary report. role is also whitelisted to editor/viewer as a second,
-- independent guard — this path can never grant 'owner'.
create or replace function private.attach_invited_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_role text;
begin
  if new.invited_at is null then
    return new;
  end if;

  v_report_id := nullif(new.raw_user_meta_data ->> 'invited_report_id', '')::uuid;
  v_role := new.raw_user_meta_data ->> 'invited_role';

  if v_report_id is not null and v_role in ('editor', 'viewer') then
    insert into public.report_members (report_id, user_id, role)
    values (v_report_id, new.id, v_role)
    on conflict (report_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_attach_invite on auth.users;

create trigger on_auth_user_created_attach_invite
after insert on auth.users
for each row execute function private.attach_invited_membership();
