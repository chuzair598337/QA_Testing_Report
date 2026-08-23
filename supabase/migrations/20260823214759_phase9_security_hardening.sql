-- Phase 9: production-readiness security hardening
--
-- 1. rls_auto_enable() is a Supabase-platform event-trigger safety net
--    (auto-enables RLS on new tables). It's SECURITY DEFINER and, per the
--    security advisor, was executable via RPC by anon/authenticated. It's
--    not meant to be called directly by API clients — revoke that.
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- 2. report-uploads bucket had no file_size_limit/allowed_mime_types set.
--    The app only ever uploads the report's source JSON (see
--    DashboardView.vue's accept=".json,application/json" input and
--    useReports.js's supabase.storage.from('report-uploads').upload call)
--    so constrain the bucket to match instead of relying solely on
--    client-side validateImportShape().
update storage.buckets
set file_size_limit = 5242880, -- 5 MiB, generous for JSON test-report exports
    allowed_mime_types = array['application/json']
where id = 'report-uploads';
