-- Dungeon clears and raid hits are financial history. Hard-deleting their
-- parent challenge erased that audit trail and let a weekly dungeon be recreated
-- so its reward could be earned again.
alter table dungeon_runs add column if not exists archived boolean not null default false;
alter table raid_bosses add column if not exists archived boolean not null default false;

create index if not exists dungeon_runs_archived_idx on dungeon_runs(archived);
create index if not exists raid_bosses_archived_idx on raid_bosses(archived);
