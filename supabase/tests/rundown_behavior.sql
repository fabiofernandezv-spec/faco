-- Pruebas de comportamiento: Rundown completo (specs/001-rundown-completo)
-- Requiere: supabase/tests/stubs.sql + supabase/schema.sql aplicados.
-- Todo corre en una transacción que se revierte al final.
\set ON_ERROR_STOP 1
\set QUIET 1
begin;

-- ── Utilidades ──────────────────────────────────────────────
create function public.expect_fail(sql text, pattern text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'ESPERABA FALLO: %', sql;
exception when others then
  if sqlerrm like 'ESPERABA FALLO%' then raise; end if;
  if sqlerrm !~* pattern then
    raise exception 'Fallo inesperado (%): %', sql, sqlerrm;
  end if;
  raise notice 'OK bloqueado: % -> %', left(regexp_replace(sql, '\s+', ' ', 'g'), 70), sqlerrm;
end $$;

-- Ejecuta un DML y exige un número exacto de filas afectadas (RLS filtra en silencio).
create function public.expect_rows(sql text, expected int) returns void
language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'Se esperaban % filas y fueron % en: %', expected, n, sql;
  end if;
  raise notice 'OK filas=%: %', n, left(regexp_replace(sql, '\s+', ' ', 'g'), 70);
end $$;

create function public.check(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

grant execute on function public.expect_fail(text, text), public.expect_rows(text, int),
  public.check(boolean, text) to authenticated, anon;

-- ── Datos base (como administrador, sin JWT) ────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'dir@x.com',  '{"full_name":"Dani Director"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'ed@x.com',   '{"full_name":"Eva Editora"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'red@x.com',  '{"full_name":"Rita Redactora"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'pre@x.com',  '{"full_name":"Pau Presentador"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'pre2@x.com', '{"full_name":"Sol Presentadora"}');
update profiles set role = 'director'    where id = '00000000-0000-0000-0000-0000000000d1';
update profiles set role = 'editor'      where id = '00000000-0000-0000-0000-0000000000e1';
update profiles set role = 'presentador' where id in ('00000000-0000-0000-0000-0000000000b1',
                                                      '00000000-0000-0000-0000-0000000000b2');

\echo '== Preparación (editor) =='
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';

insert into notes (id, title, status, for_tv) values
  ('10000000-0000-0000-0000-000000000001', 'Nota aprobada TV', 'en_revision', true),
  ('10000000-0000-0000-0000-000000000002', 'Nota sin TV',      'en_revision', false),
  ('10000000-0000-0000-0000-000000000003', 'Nota borrador',    'borrador',    true);
update notes set status = 'aprobada' where id in ('10000000-0000-0000-0000-000000000001',
                                                  '10000000-0000-0000-0000-000000000002');

insert into rundowns (id, title, air_time, planned_duration_secs, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Noche', '20:00:00', 600,
   '00000000-0000-0000-0000-0000000000a1');
select public.check(created_by = '00000000-0000-0000-0000-0000000000e1',
                    'created_by lo fija la base, no el cliente')
  from rundowns where id = '20000000-0000-0000-0000-000000000001';
select public.check(planned_duration_secs = 600 and air_time = '20:00:00',
                    'rundown guarda hora de salida y duración planificada')
  from rundowns where id = '20000000-0000-0000-0000-000000000001';
select public.expect_fail($q$insert into rundowns (title, planned_duration_secs) values ('x', 30)$q$, 'check');

-- ═══════════════════════════════════════════════════════════
\echo '== US1: armar la escaleta =='
-- Segmentos de todos los tipos
insert into rundown_items (id, rundown_id, order_num, type, duration_secs, notes, presenter_id, presenter) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'apertura', 30,
   'Cortinilla + saludo', '00000000-0000-0000-0000-0000000000b1', 'Nombre falso');
insert into rundown_items (id, rundown_id, order_num, type, note_id, duration_secs) values
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 2, 'nota',
   '10000000-0000-0000-0000-000000000001', 75);
insert into rundown_items (id, rundown_id, order_num, type, duration_secs, notes) values
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 3, 'pausa_comercial', 120, 'Bloque 1'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 4, 'cierre', 20, null);

select public.check(presenter = 'Pau Presentador', 'nombre del presentador copiado del perfil, se ignora el enviado')
  from rundown_items where id = '30000000-0000-0000-0000-000000000001';
select public.check(note_title = 'Nota aprobada TV', 'título de la nota copiado por la base')
  from rundown_items where id = '30000000-0000-0000-0000-000000000002';

-- Editar duración, presentador y observaciones
update rundown_items set duration_secs = 45, notes = 'Nuevo texto',
       presenter_id = '00000000-0000-0000-0000-0000000000b2'
 where id = '30000000-0000-0000-0000-000000000001';
select public.check(duration_secs = 45 and presenter = 'Sol Presentadora' and notes = 'Nuevo texto',
                    'editor edita duración, presentador y observaciones')
  from rundown_items where id = '30000000-0000-0000-0000-000000000001';
update rundown_items set presenter_id = null where id = '30000000-0000-0000-0000-000000000001';
select public.check(presenter is null, 'quitar presentador limpia el nombre')
  from rundown_items where id = '30000000-0000-0000-0000-000000000001';

-- Validaciones
select public.expect_fail($q$insert into rundown_items (rundown_id, type, note_id, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'nota', '10000000-0000-0000-0000-000000000002', 60)$q$,
  'aprobadas y marcadas para TV');
select public.expect_fail($q$insert into rundown_items (rundown_id, type, note_id, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'nota', '10000000-0000-0000-0000-000000000003', 60)$q$,
  'aprobadas y marcadas para TV');
select public.expect_fail($q$insert into rundown_items (rundown_id, type, note_id, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'nota', '10000000-0000-0000-0000-000000000001', 60)$q$,
  'ya está en el rundown');
select public.expect_fail($q$insert into rundown_items (rundown_id, type, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'nota', 60)$q$,
  'requiere una nota');
select public.expect_fail($q$update rundown_items set presenter_id = '00000000-0000-0000-0000-0000000000a1'
  where id = '30000000-0000-0000-0000-000000000001'$q$, 'no tiene rol de presentador');
select public.expect_fail($q$update rundown_items set duration_secs = 0
  where id = '30000000-0000-0000-0000-000000000001'$q$, 'check');
select public.expect_fail($q$update rundown_items set duration_secs = 3601
  where id = '30000000-0000-0000-0000-000000000001'$q$, 'check');
select public.expect_fail($q$update rundown_items set notes = repeat('x', 1001)
  where id = '30000000-0000-0000-0000-000000000001'$q$, 'check');
insert into rundown_items (id, rundown_id, order_num, type, note_id, duration_secs) values
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 9, 'cortina',
   '10000000-0000-0000-0000-000000000001', 10);
select public.check(note_id is null, 'segmentos que no son nota no enlazan notas')
  from rundown_items where id = '30000000-0000-0000-0000-000000000009';
delete from rundown_items where id = '30000000-0000-0000-0000-000000000009';

-- Reordenar (editor)
select reorder_rundown('20000000-0000-0000-0000-000000000001', array[
  '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004']::uuid[]);
select public.check(order_num = 1, 'editor reordena')
  from rundown_items where id = '30000000-0000-0000-0000-000000000002';

\echo '-- redactor'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.check(count(*) = 4, 'redactor puede consultar la escaleta') from rundown_items;
select public.expect_fail($q$insert into rundown_items (rundown_id, type, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'cortina', 10)$q$, 'row-level security');
select public.expect_rows($q$update rundown_items set duration_secs = 5$q$, 0);
select public.expect_rows($q$update rundown_items set status = 'emitido'$q$, 0);
select public.expect_rows($q$delete from rundown_items$q$, 0);
select public.expect_fail($q$select reorder_rundown('20000000-0000-0000-0000-000000000001', array[]::uuid[])$q$,
  'Solo editores');

\echo '-- presentador'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select public.expect_fail($q$update rundown_items set duration_secs = 5
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'solo pueden cambiar el estado');
select public.expect_fail($q$update rundown_items set presenter_id = '00000000-0000-0000-0000-0000000000b1'
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'solo pueden cambiar el estado');
select public.expect_fail($q$update rundown_items set notes = 'x'
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'solo pueden cambiar el estado');
select public.expect_fail($q$update rundown_items set order_num = 9
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'solo pueden cambiar el estado');
select public.expect_fail($q$insert into rundown_items (rundown_id, type, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'cortina', 10)$q$, 'row-level security');
select public.expect_rows($q$delete from rundown_items$q$, 0);

-- ═══════════════════════════════════════════════════════════
\echo '== US3: un solo segmento al aire =='
select public.expect_rows($q$update rundown_items set status = 'al_aire'
  where id = '30000000-0000-0000-0000-000000000002'$q$, 1);
select public.expect_rows($q$update rundown_items set status = 'al_aire'
  where id = '30000000-0000-0000-0000-000000000001'$q$, 1);
select public.check(
  (select status from rundown_items where id = '30000000-0000-0000-0000-000000000002') = 'emitido'
  and (select count(*) from rundown_items where status = 'al_aire') = 1,
  'presentador releva el al aire: el anterior queda emitido y solo hay uno');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.expect_fail($q$delete from rundown_items where id = '30000000-0000-0000-0000-000000000001'$q$,
  'segmento que está al aire');
insert into rundown_items (id, rundown_id, order_num, type, duration_secs, status) values
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 8, 'cortina', 10, 'al_aire');
select public.check(status = 'pendiente', 'un segmento nuevo siempre nace pendiente (no crea un segundo al aire)')
  from rundown_items where id = '30000000-0000-0000-0000-000000000008';
delete from rundown_items where id = '30000000-0000-0000-0000-000000000008';
select public.check(count(*) = 1, 'existe el índice único parcial de un solo al aire')
  from pg_indexes where indexname = 'rundown_items_one_on_air';
update rundown_items set status = 'pendiente' where id = '30000000-0000-0000-0000-000000000001';
select public.check(count(*) = 0, 'poner pendiente el segmento al aire deja ninguno al aire')
  from rundown_items where status = 'al_aire';

-- ═══════════════════════════════════════════════════════════
\echo '== US4: crear, archivar y consultar =='
\echo '-- redactor y presentador no gestionan rundowns'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.expect_fail($q$insert into rundowns (title) values ('x')$q$, 'row-level security');
select public.expect_rows($q$update rundowns set status = 'archivado'$q$, 0);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select public.expect_fail($q$insert into rundowns (title) values ('x')$q$, 'row-level security');
select public.expect_rows($q$update rundowns set status = 'archivado'$q$, 0);

\echo '-- editor archiva'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
update rundown_items set status = 'al_aire' where id = '30000000-0000-0000-0000-000000000003';
update rundowns set status = 'archivado', archived_by = 'Falso'
 where id = '20000000-0000-0000-0000-000000000001';
select public.check(archived_at is not null and archived_by = 'Eva Editora',
                    'archived_at/archived_by fijados por la base')
  from rundowns where id = '20000000-0000-0000-0000-000000000001';

select public.expect_fail($q$insert into rundown_items (rundown_id, type, duration_secs)
  values ('20000000-0000-0000-0000-000000000001', 'cortina', 10)$q$, 'archivado');
select public.expect_fail($q$update rundown_items set duration_secs = 50
  where id = '30000000-0000-0000-0000-000000000004'$q$, 'archivado');
select public.expect_fail($q$update rundown_items set status = 'emitido'
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'archivado');
select public.expect_fail($q$select reorder_rundown('20000000-0000-0000-0000-000000000001', array[
  '30000000-0000-0000-0000-000000000004']::uuid[])$q$, 'archivado');
select public.expect_fail($q$delete from rundown_items where id = '30000000-0000-0000-0000-000000000004'$q$,
  'archivado');
select public.expect_fail($q$update rundowns set title = 'Otro'
  where id = '20000000-0000-0000-0000-000000000001'$q$, 'archivado');
select public.expect_fail($q$update rundowns set planned_duration_secs = 900
  where id = '20000000-0000-0000-0000-000000000001'$q$, 'archivado');

\echo '-- presentador tampoco cambia estados en archivado'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select public.expect_fail($q$update rundown_items set status = 'emitido'
  where id = '30000000-0000-0000-0000-000000000003'$q$, 'archivado');
select public.expect_rows($q$update rundowns set status = 'activo'$q$, 0);

\echo '-- editor reactiva'
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
update rundowns set status = 'activo' where id = '20000000-0000-0000-0000-000000000001';
select public.check(archived_at is null and archived_by is null, 'reactivar limpia archived_*')
  from rundowns where id = '20000000-0000-0000-0000-000000000001';
update rundown_items set duration_secs = 50 where id = '30000000-0000-0000-0000-000000000004';
select public.check(duration_secs = 50, 'tras reactivar se puede editar')
  from rundown_items where id = '30000000-0000-0000-0000-000000000004';

\echo '-- borrar rundowns: solo director'
select public.expect_rows($q$delete from rundowns where id = '20000000-0000-0000-0000-000000000001'$q$, 0);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
insert into rundowns (id, title) values ('20000000-0000-0000-0000-000000000002', 'Borrable');
select public.expect_rows($q$delete from rundowns where id = '20000000-0000-0000-0000-000000000002'$q$, 1);

\echo '-- varios rundowns activos permitidos'
insert into rundowns (title, channel) values ('Mañana', 'Canal 5'), ('Noche', 'Canal 9');
select public.check(count(*) >= 3, 'coexisten varios rundowns activos')
  from rundowns where status = 'activo';

\echo '-- casos límite: referencias eliminadas'
-- (sigue como director)
insert into rundowns (id, title) values ('20000000-0000-0000-0000-000000000003', 'Límite');
insert into rundown_items (id, rundown_id, order_num, type, note_id, duration_secs, presenter_id) values
  ('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000003', 1, 'nota',
   '10000000-0000-0000-0000-000000000001', 60, '00000000-0000-0000-0000-0000000000b1');
update rundown_items set status = 'al_aire' where id = '30000000-0000-0000-0000-000000000031';
update rundowns set status = 'archivado' where id = '20000000-0000-0000-0000-000000000003';
-- Borrar la nota (director) aunque esté en un rundown archivado
delete from notes where id = '10000000-0000-0000-0000-000000000001';
select public.check(note_id is null and note_title = 'Nota aprobada TV',
                    'nota eliminada: el segmento conserva el título ("nota no disponible")')
  from rundown_items where id = '30000000-0000-0000-0000-000000000031';
-- Borrar el rundown archivado con un segmento al aire (cascada)
select public.expect_rows($q$delete from rundowns where id = '20000000-0000-0000-0000-000000000003'$q$, 1);
select public.check(count(*) = 0, 'cascada borra sus segmentos')
  from rundown_items where rundown_id = '20000000-0000-0000-0000-000000000003';

reset role;
\echo '== TODAS LAS PRUEBAS DE RUNDOWN PASARON =='
rollback;
