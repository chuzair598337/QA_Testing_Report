-- Grant schema-level USAGE on private to authenticated and anon roles.
-- This is required for security-invoker functions like transfer_report_ownership
-- that call private.* functions internally. A security-invoker PL/pgSQL function
-- body is JIT-compiled per session using the actual calling role's privileges,
-- so it needs schema USAGE to resolve private.* by name at runtime.
--
-- RLS policies embedding the same private function calls don't need this grant
-- because their expressions are bound to function OIDs at CREATE POLICY time
-- by a privileged role, not re-resolved per query — that's why this gap existed
-- for two migrations without breaking anything until now.

grant usage on schema private to authenticated, anon;
