-- Templates referenced by financial history must be archived, not deleted.
alter table quests add column if not exists archived boolean not null default false;
alter table rewards add column if not exists archived boolean not null default false;
alter table curses add column if not exists archived boolean not null default false;

-- Snapshot the amount actually charged so later reward edits cannot rewrite the ledger.
alter table redemptions add column if not exists cost_charged integer;
alter table redemptions add constraint redemptions_cost_charged_nonnegative
  check (cost_charged is null or cost_charged >= 0) not valid;

create index if not exists quests_archived_idx on quests(archived);
create index if not exists rewards_archived_idx on rewards(archived);
create index if not exists curses_archived_idx on curses(archived);
