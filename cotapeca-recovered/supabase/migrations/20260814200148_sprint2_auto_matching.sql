-- New quotes are distributed automatically once Sprint 2 is active.
create or replace function private.match_new_quote()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.run_quote_matching_internal(new.id);
  return new;
end; $$;
revoke all on function private.match_new_quote() from public,anon,authenticated,service_role;
drop trigger if exists quotes_match_after_insert on public.quotes;
create trigger quotes_match_after_insert after insert on public.quotes for each row execute function private.match_new_quote();