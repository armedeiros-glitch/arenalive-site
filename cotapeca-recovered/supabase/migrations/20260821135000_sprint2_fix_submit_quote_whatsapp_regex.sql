do $do$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_quote'
    and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  if v_def is null then
    raise exception 'submit_quote function not found';
  end if;

  v_def := regexp_replace(
    v_def,
    'if v_whatsapp !~ .* then raise exception ''invalid whatsapp'' using errcode = ''22023''; end if;',
    'if v_whatsapp !~ ''^[+][1-9][0-9]{7,14}$'' then raise exception ''invalid whatsapp'' using errcode = ''22023''; end if;'
  );

  execute v_def;
end
$do$;
