-- Eskja / Supabase setup
-- Run this ONCE in Supabase -> SQL Editor for a fresh project.
-- Safe to run again: it does not delete board rows or stored things.

create table if not exists public.board_items (
  id uuid primary key,
  board text not null,
  type text not null default 'image' check (type in ('image','note','audio','video')),
  src text,
  storage_path text,
  text text not null default '',
  x double precision not null default 20,
  y double precision not null default 20,
  width double precision not null default 300,
  height double precision not null default 200,
  grayscale integer not null default 0,
  aged boolean not null default false,
  age_seed bigint,
  cutout_path text,
  cutout_enabled boolean not null default false,
  z integer not null default 1,
  created_at timestamptz not null default now()
);

-- Bring older installations forward without deleting anything.
alter table public.board_items
  add column if not exists cutout_path text;

alter table public.board_items
  add column if not exists cutout_enabled boolean not null default false;

alter table public.board_items
  drop constraint if exists board_items_type_check;

alter table public.board_items
  add constraint board_items_type_check
  check (type in ('image','note','audio','video'));

alter table public.board_items enable row level security;

-- Accounts are not wired in yet, so the current development build uses
-- the publishable key from the browser and the anon role needs table access.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.board_items to anon, authenticated;

drop policy if exists "public read board items" on public.board_items;
drop policy if exists "public insert board items" on public.board_items;
drop policy if exists "public update board items" on public.board_items;
drop policy if exists "public delete board items" on public.board_items;

create policy "public read board items"
on public.board_items for select to anon, authenticated using (true);

create policy "public insert board items"
on public.board_items for insert to anon, authenticated with check (true);

create policy "public update board items"
on public.board_items for update to anon, authenticated using (true) with check (true);

create policy "public delete board items"
on public.board_items for delete to anon, authenticated using (true);

-- The historical bucket name remains board-images so existing stored things
-- keep working. It now carries ordinary Eskja media things as well as images.
insert into storage.buckets (id, name, public)
values ('board-images', 'board-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public read board images" on storage.objects;
drop policy if exists "public upload board images" on storage.objects;
drop policy if exists "public update board images" on storage.objects;
drop policy if exists "public delete board images" on storage.objects;
drop policy if exists "authenticated users can read board images" on storage.objects;
drop policy if exists "authenticated users can upload board images" on storage.objects;
drop policy if exists "authenticated users can update board images" on storage.objects;
drop policy if exists "authenticated users can delete board images" on storage.objects;

create policy "public read board images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'board-images');

create policy "public upload board images"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'board-images');

create policy "public update board images"
on storage.objects for update to anon, authenticated
using (bucket_id = 'board-images') with check (bucket_id = 'board-images');

create policy "public delete board images"
on storage.objects for delete to anon, authenticated
using (bucket_id = 'board-images');
