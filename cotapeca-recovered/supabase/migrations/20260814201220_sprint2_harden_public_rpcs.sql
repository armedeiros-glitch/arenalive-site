-- Sprint 2 security hardening: privileged implementations live in private schema.
-- Public RPCs remain SECURITY INVOKER wrappers and are the only exposed API surface.

alter function public.register_supplier(jsonb) rename to register_supplier_legacy;
alter function public.admin_set_supplier_status(uuid, public.supplier_verification_status) rename to admin_set_supplier_status_legacy;
alter function public.run_quote_matching(uuid) rename to run_quote_matching_legacy;
alter function public.view_opportunity(uuid) rename to view_opportunity_legacy;
alter function public.decline_opportunity(uuid) rename to decline_opportunity_legacy;

alter function public.register_supplier_legacy(jsonb) set schema private;
alter function public.admin_set_supplier_status_legacy(uuid, public.supplier_verification_status) set schema private;
alter function public.run_quote_matching_legacy(uuid) set schema private;
alter function public.view_opportunity_legacy(uuid) set schema private;
alter function public.decline_opportunity_legacy(uuid) set schema private;

alter function private.register_supplier_legacy(jsonb) rename to register_supplier;
alter function private.admin_set_supplier_status_legacy(uuid, public.supplier_verification_status) rename to admin_set_supplier_status;
alter function private.run_quote_matching_legacy(uuid) rename to run_quote_matching;
alter function private.view_opportunity_legacy(uuid) rename to view_opportunity;
alter function private.decline_opportunity_legacy(uuid) rename to decline_opportunity;

revoke all on function private.register_supplier(jsonb) from public, anon;
revoke all on function private.admin_set_supplier_status(uuid, public.supplier_verification_status) from public, anon;
revoke all on function private.run_quote_matching(uuid) from public, anon;
revoke all on function private.view_opportunity(uuid) from public, anon;
revoke all on function private.decline_opportunity(uuid) from public, anon;
grant execute on function private.register_supplier(jsonb) to authenticated;
grant execute on function private.admin_set_supplier_status(uuid, public.supplier_verification_status) to authenticated;
grant execute on function private.run_quote_matching(uuid) to authenticated;
grant execute on function private.view_opportunity(uuid) to authenticated;
grant execute on function private.decline_opportunity(uuid) to authenticated;

create function public.register_supplier(payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.register_supplier(payload); $$;

create function public.admin_set_supplier_status(p_supplier_id uuid, p_status public.supplier_verification_status)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_set_supplier_status(p_supplier_id, p_status); $$;

create function public.run_quote_matching(p_quote_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.run_quote_matching(p_quote_id); $$;

create function public.view_opportunity(p_opportunity_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.view_opportunity(p_opportunity_id); $$;

create function public.decline_opportunity(p_opportunity_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.decline_opportunity(p_opportunity_id); $$;

revoke all on function public.register_supplier(jsonb) from public, anon;
revoke all on function public.admin_set_supplier_status(uuid, public.supplier_verification_status) from public, anon;
revoke all on function public.run_quote_matching(uuid) from public, anon;
revoke all on function public.view_opportunity(uuid) from public, anon;
revoke all on function public.decline_opportunity(uuid) from public, anon;
grant execute on function public.register_supplier(jsonb) to authenticated;
grant execute on function public.admin_set_supplier_status(uuid, public.supplier_verification_status) to authenticated;
grant execute on function public.run_quote_matching(uuid) to authenticated;
grant execute on function public.view_opportunity(uuid) to authenticated;
grant execute on function public.decline_opportunity(uuid) to authenticated;