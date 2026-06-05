-- Mesa Central — Supabase Schema
-- Run this in Supabase → SQL Editor

create extension if not exists "pgcrypto";

-- Notes
create table if not exists notes (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  lead                 text,
  body                 text,
  category             text not null default 'nacional',
  status               text not null default 'borrador',
  author_id            text,
  author_name          text,
  assigned_editor_id   text,
  assigned_editor_name text,
  approved_at          timestamptz,
  approved_by          text,
  rejected_reason      text,
  tags                 text[] default '{}',
  duration_secs        int default 60,
  for_tv               boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Rundown items
create table if not exists rundown_items (
  id           uuid primary key default gen_random_uuid(),
  order_num    int not null default 0,
  type         text not null default 'nota',
  note_id      uuid references notes(id) on delete set null,
  note_title   text,
  presenter    text,
  duration_secs int default 60,
  start_time   text,
  notes        text,
  status       text not null default 'pendiente',
  created_at   timestamptz default now()
);

-- Media
create table if not exists media (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null,
  url          text not null,
  size         bigint default 0,
  uploaded_by  text,
  uploaded_at  timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

-- Row Level Security (RLS) — open by default, tighten per equipo
alter table notes         enable row level security;
alter table rundown_items enable row level security;
alter table media         enable row level security;

create policy "public read notes"         on notes         for select using (true);
create policy "public write notes"        on notes         for all    using (true);
create policy "public read rundown"       on rundown_items for select using (true);
create policy "public write rundown"      on rundown_items for all    using (true);
create policy "public read media"         on media         for select using (true);
create policy "public write media"        on media         for all    using (true);
