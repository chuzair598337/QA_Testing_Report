-- Follow-up to phase9_security_hardening: the previous revoke targeted
-- anon/authenticated directly, but rls_auto_enable()'s EXECUTE grant was
-- actually on PUBLIC (every role gets it via PUBLIC unless revoked from
-- PUBLIC itself) — confirmed via information_schema.routine_privileges.
-- Revoke from PUBLIC, then grant back only to postgres (the role that
-- needs it to run as the event-trigger owner).
revoke execute on function public.rls_auto_enable() from public;
grant execute on function public.rls_auto_enable() to postgres;
