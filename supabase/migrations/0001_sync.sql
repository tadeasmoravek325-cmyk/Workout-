-- Gym: cloud backup and sync.
--
-- Every piece of user data is one row: a workout, routine, custom exercise or measurement, plus
-- three small documents (settings, schedule, exercise notes). The app is local-first: it keeps all
-- data on the phone and syncs rows that changed. Conflicts are resolved per row by `updated_at`
-- (the time of the edit on the device); a deletion is a row with `deleted_at` set.
--
-- Run this once in the Supabase SQL editor (or with `supabase db push`).

create table if not exists public.records (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  collection text   not null check (collection in ('workouts', 'routines', 'customExercises', 'measurements', 'doc')),
  id         text   not null,
  data       jsonb,
  updated_at bigint not null default 0,
  deleted_at bigint,
  -- Server-side change counter: clients pull everything with a higher seq than they last saw.
  seq        bigint not null,
  primary key (user_id, collection, id)
);

create sequence if not exists public.records_seq;

create index if not exists records_user_seq on public.records (user_id, seq);

-- Every insert or update gets a new seq, so pulls never miss a change.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.seq := nextval('public.records_seq');
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Upload changed rows. A row only replaces the stored one when it is at least as new, so an
-- old phone coming back online can never overwrite newer edits from another device.
create or replace function public.sync_push(items jsonb) returns void
language plpgsql security invoker as $$
declare
  it jsonb;
  ts bigint;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  for it in select * from jsonb_array_elements(items) loop
    ts := greatest(coalesce((it->>'updated_at')::bigint, 0), coalesce((it->>'deleted_at')::bigint, 0));
    insert into public.records as r (user_id, collection, id, data, updated_at, deleted_at, seq)
    values (
      auth.uid(),
      it->>'collection',
      it->>'id',
      case when it ? 'deleted_at' and it->>'deleted_at' is not null then null else it->'data' end,
      coalesce((it->>'updated_at')::bigint, 0),
      (it->>'deleted_at')::bigint,
      0
    )
    on conflict (user_id, collection, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      where greatest(r.updated_at, coalesce(r.deleted_at, 0)) <= ts;
  end loop;
end $$;

grant execute on function public.sync_push(jsonb) to authenticated;

-- GDPR: delete the account and every row that belongs to it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.records where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
