-- Elimina el esquema anterior con políticas abiertas ("public read/write").
-- ⚠️ Borra los datos de notas, rundown y medios. Exporta antes si los necesitas.
drop policy if exists "public read notes"    on notes;
drop policy if exists "public write notes"   on notes;
drop policy if exists "public read rundown"  on rundown_items;
drop policy if exists "public write rundown" on rundown_items;
drop policy if exists "public read media"    on media;
drop policy if exists "public write media"   on media;

drop trigger if exists notes_updated_at on notes;
drop function if exists update_updated_at();

drop table if exists rundown_items cascade;
drop table if exists media cascade;
drop table if exists notes cascade;
