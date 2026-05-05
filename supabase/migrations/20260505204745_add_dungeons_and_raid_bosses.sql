-- Weekly Dungeon: family-wide cooperative challenge (parent creates manually per week)
create table dungeon_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null default 'Weekly Dungeon',
  icon text not null default '🏰',
  hp integer not null,
  current_damage integer not null default 0,
  reward_coins integer not null default 50,
  reward_xp integer not null default 100,
  week_start date not null,
  status text not null default 'active',
  cleared_at timestamptz,
  created_at timestamptz default now(),
  constraint dungeon_status_check check (status in ('active', 'cleared')),
  unique(family_id, week_start)
);

-- Raid Boss: persistent family-wide boss (lives until defeated)
create table raid_bosses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  icon text not null default '🐉',
  max_hp integer not null,
  current_hp integer not null,
  bounty_coins integer not null,
  status text not null default 'active',
  defeated_at timestamptz,
  created_at timestamptz default now(),
  constraint raid_boss_status_check check (status in ('active', 'defeated'))
);

-- Each quest approval that hits an active boss records a hit
create table raid_boss_hits (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references raid_bosses(id) on delete cascade,
  completion_id uuid not null references completions(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  damage_dealt integer not null,
  hit_at timestamptz default now()
);

-- RLS
alter table dungeon_runs enable row level security;
alter table raid_bosses enable row level security;
alter table raid_boss_hits enable row level security;

create policy "Family dungeon_runs" on dungeon_runs
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

create policy "Family raid_bosses" on raid_bosses
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

create policy "Family raid_boss_hits" on raid_boss_hits
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

-- Realtime for live HP bars on display wall
alter publication supabase_realtime add table dungeon_runs;
alter publication supabase_realtime add table raid_bosses;

-- Indexes
create index dungeon_runs_family_id_idx on dungeon_runs(family_id);
create index raid_bosses_family_id_idx on raid_bosses(family_id);
create index raid_boss_hits_boss_id_idx on raid_boss_hits(boss_id);
create index raid_boss_hits_kid_id_idx on raid_boss_hits(kid_id);

-- Drop per-kid weekly_goal payout columns (replaced by dungeon system)
alter table kids drop column if exists weekly_goal;
alter table kids drop column if exists weekly_goal_paid_week;
