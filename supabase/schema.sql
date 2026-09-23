-- Mesa Central — Supabase Schema (seguro)
-- Ejecutar completo en Supabase → SQL Editor sobre un proyecto nuevo.
-- Si ya ejecutaste la versión anterior (políticas abiertas), ejecuta primero
-- supabase/migrations/000_drop_legacy.sql.
--
-- Modelo de seguridad:
--   * Solo usuarios autenticados (Supabase Auth) acceden a los datos.
--   * El rol vive en `profiles.role` y solo un director puede cambiarlo.
--   * Las transiciones de estado de las notas y los campos de aprobación
--     se validan y calculan en la base (trigger), no en el navegador.
--   * Cada cambio de estado queda registrado en `note_events` (auditoría).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- Perfiles y roles
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 1 and 120),
  role        text not null default 'redactor'
              check (role in ('redactor', 'editor', 'director', 'presentador')),
  created_at  timestamptz not null default now()
);

-- Rol del usuario actual. security definer para poder usarlo dentro de
-- políticas RLS sin recursión.
create or replace function current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_app_name()
returns text language sql stable security definer set search_path = public as $$
  select full_name from profiles where id = auth.uid();
$$;

create or replace function is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_app_role() in ('editor', 'director'), false);
$$;

-- Crear perfil automáticamente al registrarse (siempre como redactor).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), 120),
    'redactor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Nadie puede cambiarse el rol a sí mismo; solo un director cambia roles.
create or replace function guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id then
    raise exception 'No se puede cambiar el id del perfil';
  end if;
  -- Nombre recortado (el CHECK 1-120 rechaza vacíos) y fecha de alta inmutable.
  new.full_name  := trim(new.full_name);
  new.created_at := old.created_at;
  -- Sin JWT (SQL Editor / service role): administración directa permitida.
  if auth.uid() is null then
    return new;
  end if;
  if new.role <> old.role and coalesce(current_app_role(), '') <> 'director' then
    raise exception 'Solo un director puede cambiar roles';
  end if;
  if new.role <> old.role and new.id = auth.uid() then
    raise exception 'Un director no puede cambiar su propio rol';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on profiles;
create trigger profiles_guard
  before update on profiles
  for each row execute function guard_profile_update();

-- ─────────────────────────────────────────────────────────────
-- Notas
-- ─────────────────────────────────────────────────────────────
create table if not exists notes (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null check (char_length(title) between 1 and 300),
  lead                 text not null default '' check (char_length(lead) <= 2000),
  body                 text not null default '' check (char_length(body) <= 200000),
  category             text not null default 'nacional'
                       check (category in ('nacional','internacional','economia','deportes',
                                           'cultura','tecnologia','salud','entretenimiento')),
  status               text not null default 'borrador'
                       check (status in ('borrador','en_revision','aprobada','rechazada','publicada')),
  author_id            uuid not null default auth.uid() references profiles(id),
  author_name          text not null default '',
  assigned_editor_id   uuid references profiles(id) on delete set null,
  assigned_editor_name text,
  approved_at          timestamptz,
  approved_by          text,
  rejected_at          timestamptz,
  rejected_by          text,
  rejected_reason      text check (char_length(rejected_reason) <= 2000),
  tags                 text[] not null default '{}' check (cardinality(tags) <= 20),
  duration_secs        int not null default 60 check (duration_secs between 10 and 600),
  for_tv               boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists notes_status_idx     on notes (status);
create index if not exists notes_updated_at_idx on notes (updated_at desc);
create index if not exists notes_author_idx     on notes (author_id);

-- Auditoría de cambios de estado (solo la escribe el trigger).
create table if not exists note_events (
  id          bigint generated always as identity primary key,
  note_id     uuid not null references notes(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid,
  actor_name  text,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists note_events_note_idx on note_events (note_id, created_at desc);

-- Máquina de estados de las notas. Los campos de autoría y aprobación los
-- fija la base; lo que envíe el cliente para esos campos se ignora.
create or replace function guard_note_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := current_app_role();
  v_name text := current_app_name();
  v_editor boolean := coalesce(v_role in ('editor', 'director'), false);
begin
  if v_role is null then
    raise exception 'Usuario sin perfil';
  end if;

  if tg_op = 'INSERT' then
    if v_role = 'presentador' then
      raise exception 'Los presentadores no crean notas';
    end if;
    if new.status not in ('borrador', 'en_revision') then
      raise exception 'Una nota nueva solo puede ser borrador o en revisión';
    end if;
    new.author_id       := auth.uid();
    new.author_name     := v_name;
    new.approved_at     := null;
    new.approved_by     := null;
    new.rejected_at     := null;
    new.rejected_by     := null;
    new.rejected_reason := null;
    new.created_at      := now();
    new.updated_at      := now();
    return new;
  end if;

  -- UPDATE
  new.id          := old.id;
  new.author_id   := old.author_id;
  new.author_name := old.author_name;
  new.created_at  := old.created_at;
  new.updated_at  := now();

  if new.status is distinct from old.status then
    if old.status in ('borrador', 'rechazada') and new.status = 'en_revision' then
      if not (old.author_id = auth.uid() or v_editor) then
        raise exception 'Solo el autor o un editor puede enviar a revisión';
      end if;
    elsif old.status = 'en_revision' and new.status = 'aprobada' and v_editor then
      null;
    elsif old.status = 'en_revision' and new.status = 'rechazada' and v_editor then
      if coalesce(trim(new.rejected_reason), '') = '' then
        raise exception 'El rechazo requiere un motivo';
      end if;
    elsif old.status = 'aprobada' and new.status = 'publicada' and v_editor then
      null;
    elsif old.status in ('en_revision', 'aprobada') and new.status = 'borrador' and v_editor then
      null; -- devolver a borrador
    else
      raise exception 'Transición de estado no permitida: % → % (rol %)', old.status, new.status, v_role;
    end if;
  elsif not v_editor and old.status not in ('borrador', 'rechazada') then
    raise exception 'La nota no se puede editar en estado %', old.status;
  end if;

  -- Campos de aprobación: siempre calculados aquí.
  if new.status = 'aprobada' and old.status <> 'aprobada' then
    new.approved_at := now();
    new.approved_by := v_name;
    new.rejected_at := null; new.rejected_by := null; new.rejected_reason := null;
  elsif new.status = 'rechazada' and old.status <> 'rechazada' then
    new.rejected_at := now();
    new.rejected_by := v_name;
    new.rejected_reason := trim(new.rejected_reason);
    new.approved_at := null; new.approved_by := null;
  elsif new.status = 'borrador' and old.status <> 'borrador' then
    new.approved_at := null; new.approved_by := null;
  else
    new.approved_at     := old.approved_at;
    new.approved_by     := old.approved_by;
    new.rejected_at     := old.rejected_at;
    new.rejected_by     := old.rejected_by;
    new.rejected_reason := old.rejected_reason;
  end if;

  -- Solo editores asignan editor.
  if not v_editor then
    new.assigned_editor_id   := old.assigned_editor_id;
    new.assigned_editor_name := old.assigned_editor_name;
  end if;

  return new;
end;
$$;

drop trigger if exists notes_guard on notes;
create trigger notes_guard
  before insert or update on notes
  for each row execute function guard_note_write();

create or replace function log_note_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into note_events (note_id, from_status, to_status, actor_id, actor_name, reason)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      auth.uid(),
      current_app_name(),
      case when new.status = 'rechazada' then new.rejected_reason end
    );
  end if;
  return null;
end;
$$;

drop trigger if exists notes_log on notes;
create trigger notes_log
  after insert or update on notes
  for each row execute function log_note_event();

-- ─────────────────────────────────────────────────────────────
-- Rundown / escaleta
-- ─────────────────────────────────────────────────────────────
create table if not exists rundowns (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  air_date    date not null default current_date,
  channel     text not null default '' check (char_length(channel) <= 100),
  status      text not null default 'activo' check (status in ('borrador','activo','archivado')),
  created_by  uuid default auth.uid() references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists rundowns_status_date_idx on rundowns (status, air_date desc);

create table if not exists rundown_items (
  id            uuid primary key default gen_random_uuid(),
  rundown_id    uuid not null references rundowns(id) on delete cascade,
  order_num     int not null default 0,
  type          text not null default 'nota'
                check (type in ('nota','pausa_comercial','cortina','apertura','cierre')),
  note_id       uuid references notes(id) on delete set null,
  note_title    text check (char_length(note_title) <= 300),
  presenter     text check (char_length(presenter) <= 120),
  duration_secs int not null default 60 check (duration_secs between 1 and 3600),
  start_time    text check (start_time ~ '^\d{2}:\d{2}(:\d{2})?$'),
  notes         text check (char_length(notes) <= 1000),
  status        text not null default 'pendiente' check (status in ('pendiente','al_aire','emitido')),
  created_at    timestamptz not null default now()
);
create index if not exists rundown_items_rundown_idx on rundown_items (rundown_id, order_num);

-- Columnas añadidas por 001-rundown-completo (idempotente).
alter table rundowns add column if not exists air_time time;
alter table rundowns add column if not exists planned_duration_secs int not null default 1800;
alter table rundowns add column if not exists archived_at timestamptz;
alter table rundowns add column if not exists archived_by text;
do $$ begin
  alter table rundowns add constraint rundowns_planned_duration_check
    check (planned_duration_secs between 60 and 21600);
exception when duplicate_object then null; end $$;

alter table rundown_items add column if not exists presenter_id uuid references profiles(id) on delete set null;
comment on column rundown_items.start_time is 'Obsoleto: la hora de inicio se calcula en el cliente';

-- Como máximo un segmento al aire por rundown, y cada nota una sola vez.
create unique index if not exists rundown_items_one_on_air
  on rundown_items (rundown_id) where status = 'al_aire';
create unique index if not exists rundown_items_note_unique
  on rundown_items (rundown_id, note_id) where note_id is not null;

-- Rundowns: autoría y archivado los fija la base; un rundown archivado solo
-- admite volver a activo.
create or replace function guard_rundown()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by  := auth.uid();
    new.created_at  := now();
    new.archived_at := null;
    new.archived_by := null;
    if new.status = 'archivado' then
      new.status := 'activo';
    end if;
    return new;
  end if;

  new.id         := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if old.status = 'archivado' then
    if new.status = 'archivado'
       or (new.title, new.air_date, new.channel, new.air_time, new.planned_duration_secs)
          is distinct from
          (old.title, old.air_date, old.channel, old.air_time, old.planned_duration_secs) then
      raise exception 'El rundown está archivado: es de solo lectura (reactívalo para editarlo)';
    end if;
    new.archived_at := null;
    new.archived_by := null;
  elsif new.status = 'archivado' then
    new.archived_at := now();
    new.archived_by := current_app_name();
  else
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;

drop trigger if exists rundowns_guard on rundowns;
create trigger rundowns_guard
  before insert or update on rundowns
  for each row execute function guard_rundown();

-- Segmentos:
--   * rundown archivado → solo lectura;
--   * presentadores solo cambian el estado;
--   * notas: aprobadas/publicadas para TV, sin repetir; título copiado;
--   * presentador: debe tener rol presentador; nombre copiado;
--   * un solo segmento al aire: el anterior pasa a emitido (atómico);
--   * no se quita el segmento al aire.
create or replace function guard_rundown_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text := current_app_role();
  v_status text;
begin
  -- Acciones referenciales (nota o perfil eliminados): solo ponen a null la
  -- referencia y conservan el nombre/título mostrado. Se permiten siempre.
  if tg_op = 'UPDATE'
     and (new.note_id is null or new.presenter_id is null)
     and (new.id, new.rundown_id, new.order_num, new.type, new.note_title, new.presenter,
          new.duration_secs, new.start_time, new.notes, new.status)
         is not distinct from
         (old.id, old.rundown_id, old.order_num, old.type, old.note_title, old.presenter,
          old.duration_secs, old.start_time, old.notes, old.status)
     and (new.note_id is not distinct from old.note_id or new.note_id is null)
     and (new.presenter_id is not distinct from old.presenter_id or new.presenter_id is null)
     and pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Borrado en cascada del rundown completo (lo hace un director).
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  select status into v_status from rundowns
   where id = case when tg_op = 'DELETE' then old.rundown_id else new.rundown_id end;
  if v_status = 'archivado' then
    raise exception 'El rundown está archivado: es de solo lectura (reactívalo para editarlo)';
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'al_aire' then
      raise exception 'No se puede quitar el segmento que está al aire';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.rundown_id <> old.rundown_id then
      raise exception 'No se puede mover un segmento a otro rundown';
    end if;
    if v_role = 'presentador'
       and (new.order_num, new.type, new.note_id, new.presenter_id, new.duration_secs,
            new.start_time, new.notes)
           is distinct from
           (old.order_num, old.type, old.note_id, old.presenter_id, old.duration_secs,
            old.start_time, old.notes) then
      raise exception 'Los presentadores solo pueden cambiar el estado del segmento';
    end if;
  else
    new.status := 'pendiente';   -- un segmento nuevo nunca entra al aire
  end if;

  -- Notas
  if new.type <> 'nota' then
    new.note_id := null;
    new.note_title := null;
  elsif tg_op = 'INSERT' and new.note_id is null then
    raise exception 'Un segmento de tipo nota requiere una nota';
  end if;
  if new.note_id is not null and (tg_op = 'INSERT' or new.note_id is distinct from old.note_id) then
    if not exists (
      select 1 from notes
       where id = new.note_id and for_tv and status in ('aprobada', 'publicada')
    ) then
      raise exception 'Solo se pueden agregar notas aprobadas y marcadas para TV';
    end if;
    if exists (
      select 1 from rundown_items
       where rundown_id = new.rundown_id and note_id = new.note_id and id <> new.id
    ) then
      raise exception 'La nota ya está en el rundown';
    end if;
    select title into new.note_title from notes where id = new.note_id;
  elsif tg_op = 'UPDATE' and new.note_id is not null then
    new.note_title := old.note_title;
  end if;

  -- Presentador (el nombre lo fija la base)
  if tg_op = 'INSERT' or new.presenter_id is distinct from old.presenter_id then
    if new.presenter_id is null then
      new.presenter := null;
    else
      select full_name into new.presenter from profiles
       where id = new.presenter_id and role = 'presentador';
      if not found then
        raise exception 'El presentador asignado no tiene rol de presentador';
      end if;
    end if;
  else
    new.presenter := old.presenter;
  end if;

  -- Un solo segmento al aire: bloquear el rundown para serializar relevos.
  if tg_op = 'UPDATE' and new.status = 'al_aire' and old.status <> 'al_aire' then
    perform 1 from rundowns where id = new.rundown_id for update;
    update rundown_items set status = 'emitido'
     where rundown_id = new.rundown_id and status = 'al_aire' and id <> new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists rundown_items_guard on rundown_items;
create trigger rundown_items_guard
  before insert or update on rundown_items
  for each row execute function guard_rundown_item();

drop trigger if exists rundown_items_guard_delete on rundown_items;
create trigger rundown_items_guard_delete
  before delete on rundown_items
  for each row execute function guard_rundown_item();

-- Reordenar en una sola llamada (security invoker: aplica RLS).
create or replace function reorder_rundown(p_rundown_id uuid, p_item_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not is_editor() then
    raise exception 'Solo editores o directores pueden reordenar';
  end if;
  update rundown_items ri
     set order_num = x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord)
   where ri.id = x.id and ri.rundown_id = p_rundown_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Medios (metadatos; los archivos van al bucket privado `media`)
-- ─────────────────────────────────────────────────────────────
create table if not exists media (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 255),
  type              text not null check (type in ('image','video','audio')),
  storage_path      text not null unique,
  mime_type         text not null,
  size              bigint not null default 0 check (size between 0 and 104857600),
  uploaded_by       uuid not null default auth.uid() references profiles(id),
  uploaded_by_name  text not null default '',
  uploaded_at       timestamptz not null default now()
);
create index if not exists media_uploaded_at_idx on media (uploaded_at desc);

create or replace function guard_media_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by      := auth.uid();
  new.uploaded_by_name := current_app_name();
  new.uploaded_at      := now();
  if split_part(new.storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'Ruta de almacenamiento inválida';
  end if;
  return new;
end;
$$;

drop trigger if exists media_guard on media;
create trigger media_guard
  before insert on media
  for each row execute function guard_media_insert();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table profiles      enable row level security;
alter table notes         enable row level security;
alter table note_events   enable row level security;
alter table rundowns      enable row level security;
alter table rundown_items enable row level security;
alter table media         enable row level security;

-- profiles
drop policy if exists "profiles read"          on profiles;
drop policy if exists "profiles update self"   on profiles;
drop policy if exists "profiles update director" on profiles;
create policy "profiles read"            on profiles for select to authenticated using (true);
create policy "profiles update self"     on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles update director" on profiles for update to authenticated
  using (current_app_role() = 'director') with check (true);

-- notes
drop policy if exists "notes read"   on notes;
drop policy if exists "notes insert" on notes;
drop policy if exists "notes update" on notes;
drop policy if exists "notes delete" on notes;
create policy "notes read"   on notes for select to authenticated using (true);
create policy "notes insert" on notes for insert to authenticated
  with check (author_id = auth.uid() and current_app_role() in ('redactor','editor','director'));
create policy "notes update" on notes for update to authenticated
  using ((author_id = auth.uid() and status in ('borrador','rechazada')) or is_editor())
  with check ((author_id = auth.uid()) or is_editor());
create policy "notes delete" on notes for delete to authenticated
  using ((author_id = auth.uid() and status = 'borrador') or current_app_role() = 'director');

-- note_events: solo lectura (lo escribe el trigger security definer)
drop policy if exists "note events read" on note_events;
create policy "note events read" on note_events for select to authenticated using (true);

-- rundowns
drop policy if exists "rundowns read"   on rundowns;
drop policy if exists "rundowns write"  on rundowns;
drop policy if exists "rundowns insert" on rundowns;
drop policy if exists "rundowns update" on rundowns;
drop policy if exists "rundowns delete" on rundowns;
create policy "rundowns read"   on rundowns for select to authenticated using (true);
create policy "rundowns insert" on rundowns for insert to authenticated with check (is_editor());
create policy "rundowns update" on rundowns for update to authenticated
  using (is_editor()) with check (is_editor());
create policy "rundowns delete" on rundowns for delete to authenticated
  using (current_app_role() = 'director');

-- rundown_items
drop policy if exists "rundown items read"   on rundown_items;
drop policy if exists "rundown items insert" on rundown_items;
drop policy if exists "rundown items update" on rundown_items;
drop policy if exists "rundown items delete" on rundown_items;
create policy "rundown items read"   on rundown_items for select to authenticated using (true);
create policy "rundown items insert" on rundown_items for insert to authenticated with check (is_editor());
create policy "rundown items update" on rundown_items for update to authenticated
  using (is_editor() or current_app_role() = 'presentador')
  with check (is_editor() or current_app_role() = 'presentador');
create policy "rundown items delete" on rundown_items for delete to authenticated using (is_editor());

-- media
drop policy if exists "media read"   on media;
drop policy if exists "media insert" on media;
drop policy if exists "media delete" on media;
create policy "media read"   on media for select to authenticated using (true);
create policy "media insert" on media for insert to authenticated
  with check (current_app_role() in ('redactor','editor','director'));
create policy "media delete" on media for delete to authenticated
  using (uploaded_by = auth.uid() or current_app_role() = 'director');

-- Revocar acceso anónimo explícitamente.
revoke all on profiles, notes, note_events, rundowns, rundown_items, media from anon;
revoke execute on function reorder_rundown(uuid, uuid[]) from anon, public;
grant  execute on function reorder_rundown(uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket privado con límites de tamaño y tipo
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 104857600,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime',
        'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media objects read"   on storage.objects;
drop policy if exists "media objects insert" on storage.objects;
drop policy if exists "media objects delete" on storage.objects;
create policy "media objects read" on storage.objects for select to authenticated
  using (bucket_id = 'media');
create policy "media objects insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and current_app_role() in ('redactor','editor','director')
  );
create policy "media objects delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and ((storage.foldername(name))[1] = auth.uid()::text or current_app_role() = 'director')
  );

-- ─────────────────────────────────────────────────────────────
-- Realtime (rundown y notas se actualizan en vivo entre usuarios)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table notes;         exception when others then null; end;
  begin alter publication supabase_realtime add table rundowns;      exception when others then null; end;
  begin alter publication supabase_realtime add table rundown_items; exception when others then null; end;
  begin alter publication supabase_realtime add table media;         exception when others then null; end;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Primer director: registra tu usuario desde la app y luego ejecuta aquí
--   update profiles set role = 'director'
--    where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
-- ─────────────────────────────────────────────────────────────
