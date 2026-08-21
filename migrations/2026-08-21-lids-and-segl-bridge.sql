begin;

alter table public.board_items
  add column if not exists target_board text;

create index if not exists board_items_target_board_idx
  on public.board_items(target_board);

-- Temporary compatibility bridge for the existing Segl v0 extension.
-- The extension still writes board='segl-test'; until Poki has a real
-- destination chooser, those incoming things belong in the user's clothing
-- eskja instead of a disposable test board.
create or replace function public.route_legacy_segl_test()
returns trigger
language plpgsql
as $$
begin
  if new.board = 'segl-test' then
    new.board := 'husbond-clothing';
  end if;
  return new;
end;
$$;

drop trigger if exists route_legacy_segl_test_before_insert on public.board_items;
create trigger route_legacy_segl_test_before_insert
before insert on public.board_items
for each row
execute function public.route_legacy_segl_test();

commit;
