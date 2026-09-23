-- Pruebas de comportamiento: Cuenta y contraseña (specs/002-cuenta-contrasena)
-- Requiere: supabase/tests/stubs.sql + supabase/schema.sql aplicados.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;

create function public.expect_fail(sql text, pattern text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ESPERABA FALLO: %', sql;
exception when others then
  if sqlerrm like 'ESPERABA FALLO%' then raise; end if;
  if sqlerrm !~* pattern then raise exception 'Fallo inesperado (%): %', sql, sqlerrm; end if;
  raise notice 'OK bloqueado: % -> %', left(regexp_replace(sql, '\s+', ' ', 'g'), 70), sqlerrm;
end $$;
create function public.expect_rows(sql text, expected int) returns void language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  if n <> expected then raise exception 'Se esperaban % filas y fueron % en: %', expected, n, sql; end if;
  raise notice 'OK filas=%: %', n, left(regexp_replace(sql, '\s+', ' ', 'g'), 70);
end $$;
create function public.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function public.expect_fail(text, text), public.expect_rows(text, int),
  public.check(boolean, text) to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'dir@x.com', '{"full_name":"Dani Director"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'red@x.com', '{"full_name":"Rita Redactora"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'otro@x.com', '{"full_name":"Otro Redactor"}');
update profiles set role = 'director' where id = '00000000-0000-0000-0000-0000000000d1';

\echo '== anon =='
set role anon;
select public.expect_fail($q$select * from profiles$q$, 'permission denied');
reset role;

\echo '== redactor: su propio nombre =='
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.expect_rows($q$update profiles set full_name = '  Rita Redactora Gómez  '
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 1);
select public.check(full_name = 'Rita Redactora Gómez', 'el nombre se guarda recortado')
  from profiles where id = '00000000-0000-0000-0000-0000000000a1';
select public.expect_fail($q$update profiles set full_name = '   '
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'check');
select public.expect_fail($q$update profiles set full_name = repeat('x', 121)
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'check');
select public.expect_rows($q$update profiles set created_at = '2000-01-01'
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 1);
select public.check(created_at > '2000-01-02', 'created_at es inmutable')
  from profiles where id = '00000000-0000-0000-0000-0000000000a1';

\echo '== redactor: nada ajeno, ni su rol =='
select public.expect_rows($q$update profiles set full_name = 'Hackeado'
  where id = '00000000-0000-0000-0000-0000000000a2'$q$, 0);
select public.expect_fail($q$update profiles set role = 'director'
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'Solo un director');
select public.expect_fail($q$update profiles set role = 'editor', full_name = 'Rita'
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'Solo un director');
select public.expect_fail($q$update profiles set id = '00000000-0000-0000-0000-0000000000a9'
  where id = '00000000-0000-0000-0000-0000000000a1'$q$, 'id del perfil|row-level');

\echo '== director =='
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.expect_rows($q$update profiles set role = 'editor'
  where id = '00000000-0000-0000-0000-0000000000a2'$q$, 1);
select public.expect_fail($q$update profiles set role = 'redactor'
  where id = '00000000-0000-0000-0000-0000000000d1'$q$, 'propio rol');
select public.expect_rows($q$update profiles set full_name = ' Dani Directora '
  where id = '00000000-0000-0000-0000-0000000000d1'$q$, 1);
select public.check(full_name = 'Dani Directora', 'el director cambia su nombre (recortado)')
  from profiles where id = '00000000-0000-0000-0000-0000000000d1';

reset role;
\echo '== TODAS LAS PRUEBAS DE CUENTA PASARON =='
rollback;
