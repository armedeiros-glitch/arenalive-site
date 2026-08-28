-- Match only after the quote transaction has all conditions/items persisted.
drop trigger if exists quotes_match_after_insert on public.quotes;
create constraint trigger quotes_match_after_insert
after insert on public.quotes
deferrable initially deferred
for each row execute function private.match_new_quote();