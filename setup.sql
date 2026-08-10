-- UNShitty Pinterest / Supabase setup
-- Run this once in Supabase -> SQL Editor.

create table if not exists public.board_items (
  id uuid primary key,
  board text not null,
  type text not null default 'image' check (type in ('image','note')),
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
  z integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.board_items enable row level security;

-- This site uses Supabase Auth. Create/login with an account before using boards.
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
on conflict (id) do nothing;

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
