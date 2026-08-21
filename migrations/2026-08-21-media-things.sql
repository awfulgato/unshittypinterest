-- Eskja media things migration
-- Run once in Supabase -> SQL Editor for the existing Eskja project.
-- Safe to run again. Existing things are preserved.

begin;

alter table public.board_items
  add column if not exists cutout_path text;

alter table public.board_items
  add column if not exists cutout_enabled boolean not null default false;

-- v0.1 only admitted images and notes. Media things use the same spatial
-- board_items model and the same Storage bucket; only their renderer differs.
alter table public.board_items
  drop constraint if exists board_items_type_check;

alter table public.board_items
  add constraint board_items_type_check
  check (type in ('image', 'note', 'audio', 'video'));

commit;
