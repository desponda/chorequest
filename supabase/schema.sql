-- ChoreQuest Database Schema
-- Run this in your Supabase SQL editor

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Family',
  parent_pin text check (parent_pin ~ '^[0-9]{4}$'), -- optional 4-digit lock PIN
  invite_token uuid not null default gen_random_uuid() unique,
  api_key uuid not null default gen_random_uuid() unique,
  daily_reset_hour integer not null default 0 check (daily_reset_hour >= 0 and daily_reset_hour <= 23),
  plan text not null default 'free' check (plan in ('free', 'family', 'legendary')),
  created_at timestamptz default now()
);

-- Extends auth.users (auto-created on signup via trigger)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references families(id) on delete cascade,
  created_at timestamptz default now()
);

create table kids (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  avatar text not null default '🧙',
  color text not null default 'azure', -- 'azure' | 'mystic'
  coins integer not null default 0,
  streak integer not null default 0,
  last_completed_date date,
  xp integer not null default 0,
  level integer not null default 1,
  pin text not null, -- 4-digit PIN (stored plaintext, protected by RLS)
  created_at timestamptz default now()
);

create table quests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  description text,
  icon text not null default '⚔️',
  coins integer not null default 10,
  assigned_to uuid references kids(id) on delete set null,
  kind text not null default 'personal' check (kind in ('personal', 'shared', 'oneoff')),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'once')),
  tier text not null default 'normal' check (tier in ('normal', 'rare', 'epic', 'legendary')),
  slots integer not null default 1 check (slots >= 1),
  active_days integer[],
  active boolean not null default true,
  created_at timestamptz default now()
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  completed_at timestamptz default now(),
  approved_at timestamptz,
  coins_awarded integer,
  date date not null default current_date,
  constraint completions_status_check check (status in ('pending', 'approved', 'rejected')),
  unique(quest_id, kid_id, date)
);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  description text,
  icon text not null default '🎁',
  cost integer not null default 50,
  available boolean not null default true,
  created_at timestamptz default now()
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'pending',
  redeemed_at timestamptz default now(),
  constraint redemptions_status_check check (status in ('pending', 'approved'))
);

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

create table raid_boss_hits (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references raid_bosses(id) on delete cascade,
  completion_id uuid not null references completions(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  damage_dealt integer not null,
  hit_at timestamptz default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table families enable row level security;
alter table profiles enable row level security;
alter table kids enable row level security;
alter table quests enable row level security;
alter table completions enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;
alter table dungeon_runs enable row level security;
alter table raid_bosses enable row level security;
alter table raid_boss_hits enable row level security;

-- Helper: get the family_id for the current authenticated user
create or replace function get_user_family_id()
returns uuid
language sql
security definer
stable
as $$
  select family_id from profiles where id = auth.uid()
$$;

-- Profiles
create policy "Own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Families
create policy "Own family" on families
  for all using (id = get_user_family_id()) with check (id = get_user_family_id());

-- Kids
create policy "Family kids" on kids
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

-- Quests
create policy "Family quests" on quests
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

-- Completions
create policy "Family completions" on completions
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

-- Rewards
create policy "Family rewards" on rewards
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

-- Redemptions
create policy "Family redemptions" on redemptions
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index kids_family_id_idx on kids(family_id);
create index quests_family_id_idx on quests(family_id);
create index quests_active_idx on quests(active);
create index quests_kind_idx on quests(kind);
create index completions_kid_id_idx on completions(kid_id);
create index completions_date_idx on completions(date);
create index completions_status_idx on completions(status);

-- ─── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table kids;

-- ─── Public invite token lookup (no auth required) ───────────────────────────

create or replace function get_family_by_invite_token(token uuid)
returns json
language plpgsql
security definer
stable
as $$
declare
  result json;
begin
  select json_build_object(
    'id', f.id,
    'name', f.name,
    'kids', coalesce((
      select json_agg(json_build_object(
        'id', k.id,
        'name', k.name,
        'avatar', k.avatar,
        'color', k.color
      ) order by k.created_at)
      from kids k where k.family_id = f.id
    ), '[]'::json)
  ) into result
  from families f
  where f.invite_token = token;

  return result;
end;
$$;

grant execute on function get_family_by_invite_token(uuid) to anon;

-- ─── Auto-create profile + family on signup ───────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
begin
  insert into families (name) values ('My Family') returning id into new_family_id;
  insert into profiles (id, family_id) values (new.id, new_family_id);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Blog posts ─────────────────────────────────────────────────────────────
create table posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  body         text not null default '',
  cover_url    text,
  sources      jsonb not null default '[]',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz default now()
);

alter table posts enable row level security;

create policy "published posts are public"
  on posts for select
  using (published = true);
