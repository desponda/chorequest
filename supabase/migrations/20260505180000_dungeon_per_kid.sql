-- Dungeons are per-kid: each kid clears independently
-- Remove family-aggregate columns from dungeon_runs
alter table dungeon_runs drop column if exists current_damage;
alter table dungeon_runs drop column if exists status;
alter table dungeon_runs drop column if exists cleared_at;

-- Track which kids cleared the dungeon (prevents double-paying)
create table dungeon_clears (
  id uuid primary key default gen_random_uuid(),
  dungeon_run_id uuid not null references dungeon_runs(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  cleared_at timestamptz default now(),
  unique(dungeon_run_id, kid_id)
);

alter table dungeon_clears enable row level security;

create policy "Family dungeon_clears" on dungeon_clears
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

alter publication supabase_realtime add table dungeon_clears;

create index dungeon_clears_run_id_idx on dungeon_clears(dungeon_run_id);
create index dungeon_clears_kid_id_idx on dungeon_clears(kid_id);
