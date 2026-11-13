-- Phase 10 (4/4): ownership-transfer RPC + the trigger that's the real
-- enforcement behind self-action guards (not just a disabled UI button).

create or replace function private.prevent_owner_self_demote_or_remove()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role = 'owner'
     and old.user_id = (select auth.uid())
     and coalesce(current_setting('app.in_ownership_transfer', true), 'false') <> 'true'
  then
    raise exception 'You can''t remove or demote yourself — transfer ownership first.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists on_report_members_prevent_self_demote on public.report_members;
create trigger on_report_members_prevent_self_demote
before update or delete on public.report_members
for each row execute function private.prevent_owner_self_demote_or_remove();

create or replace function public.transfer_report_ownership(
  p_report_id uuid,
  p_new_owner_member_id uuid,
  p_old_owner_new_role text default 'editor'
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_old_owner_new_role not in ('editor', 'viewer') then
    raise exception 'old_owner_new_role must be editor or viewer';
  end if;

  if private.report_role(p_report_id) <> 'owner' then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if not exists (
    select 1 from public.report_members
    where id = p_new_owner_member_id and report_id = p_report_id and role <> 'owner'
  ) then
    raise exception 'Target member not found, or already the owner.';
  end if;

  perform set_config('app.in_ownership_transfer', 'true', true);

  -- Promote the target FIRST — see the plan's ordering note above.
  update public.report_members
  set role = 'owner'
  where id = p_new_owner_member_id and report_id = p_report_id;

  update public.report_members
  set role = p_old_owner_new_role
  where report_id = p_report_id and user_id = (select auth.uid()) and role = 'owner';

  perform set_config('app.in_ownership_transfer', 'false', true);
end;
$$;

grant execute on function public.transfer_report_ownership(uuid, uuid, text) to authenticated;
