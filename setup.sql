-- UNShitty Pinterest / Supabase setup
-- Run this ONCE in Supabase -> SQL Editor.
-- This script does NOT delete existing board data or images.

create table if not exists public.board_items (
  id uuid primary key,
  board text not null,
  type text not null default 'image' check (type in ('image','note','audio','video')),
  src text,
  storage_path text,
  cutout_storage_path text,
  background_removed boolean not null default false,
  mime_type text,
  text text not null default '',
  x double precision not null default 20,
  y double precision not null default 20,
  width double precision not null default 300,
  height double precision not null default 200,
  grayscale integer not null default 0,
  aged boolean not null default false,
  age_seed bigint,
  z integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.board_items add column if not exists type text not null default 'image';
alter table public.board_items add column if not exists src text;
alter table public.board_items add column if not exists storage_path text;
alter table public.board_items add column if not exists cutout_storage_path text;
alter table public.board_items add column if not exists background_removed boolean not null default false;
alter table public.board_items add column if not exists mime_type text;
alter table public.board_items add column if not exists text text not null default '';
alter table public.board_items add column if not exists x double precision not null default 20;
alter table public.board_items add column if not exists y double precision not null default 20;
alter table public.board_items add column if not exists width double precision not null default 300;
alter table public.board_items add column if not exists height double precision not null default 200;
alter table public.board_items add column if not exists grayscale integer not null default 0;
alter table public.board_items add column if not exists aged boolean not null default false;
alter table public.board_items add column if not exists age_seed bigint;
alter table public.board_items add column if not exists z integer not null default 1;
alter table public.board_items add column if not exists created_at timestamptz not null default now();

alter table public.board_items enable row level security;

-- Re-create the policies cleanly so this script can be run again without
-- failing because a policy already exists.
drop policy if exists "authenticated users can read board items" on public.board_items;
drop policy if exists "authenticated users can insert board items" on public.board_items;
drop policy if exists "authenticated users can update board items" on public.board_items;
drop policy if exists "authenticated users can delete board items" on public.board_items;

create policy "authenticated users can read board items"
on public.board_items for select to authenticated using (true);

create policy "authenticated users can insert board items"
on public.board_items for insert to authenticated with check (true);

create policy "authenticated users can update board items"
on public.board_items for update to authenticated using (true) with check (true);

create policy "authenticated users can delete board items"
on public.board_items for delete to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('board-images', 'board-images', false)
on conflict (id) do update set public = false;

drop policy if exists "authenticated users can read board images" on storage.objects;
drop policy if exists "authenticated users can upload board images" on storage.objects;
drop policy if exists "authenticated users can update board images" on storage.objects;
drop policy if exists "authenticated users can delete board images" on storage.objects;

create policy "authenticated users can read board images"
on storage.objects for select to authenticated
using (bucket_id = 'board-images');

create policy "authenticated users can upload board images"
on storage.objects for insert to authenticated
with check (bucket_id = 'board-images');

create policy "authenticated users can update board images"
on storage.objects for update to authenticated
using (bucket_id = 'board-images') with check (bucket_id = 'board-images');

create policy "authenticated users can delete board images"
on storage.objects for delete to authenticated
using (bucket_id = 'board-images');
