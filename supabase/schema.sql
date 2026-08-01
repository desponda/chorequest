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
  timezone text check (timezone is null or length(trim(timezone)) > 0),
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
  coins integer not null default 0 check (coins >= 0),
  streak integer not null default 0,
  last_completed_date date,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  pin text not null check (pin ~ '^[0-9]{4}$'), -- 4-digit PIN (stored plaintext, protected by RLS)
  created_at timestamptz default now()
);

create table quests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  description text,
  icon text not null default '⚔️',
  coins integer not null default 10 check (coins >= 0),
  assigned_to uuid references kids(id) on delete set null,
  kind text not null default 'personal' check (kind in ('personal', 'shared', 'oneoff')),
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'once')),
  tier text not null default 'normal' check (tier in ('normal', 'rare', 'epic', 'legendary')),
  slots integer not null default 1 check (slots >= 1),
  active_days integer[],
  active boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz default now(),
  constraint quests_kind_frequency_consistent check ((kind = 'oneoff') = (frequency = 'once')),
  constraint quests_slots_context check (kind = 'shared' or slots = 1)
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  completed_at timestamptz default now(),
  approved_at timestamptz,
  coins_awarded integer check (coins_awarded is null or coins_awarded >= 0),
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
  cost integer not null default 50 check (cost > 0),
  available boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz default now()
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references rewards(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'pending',
  cost_charged integer check (cost_charged is null or cost_charged >= 0),
  redeemed_at timestamptz default now(),
  constraint redemptions_status_check check (status in ('pending', 'approved', 'denied'))
);

create table curses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  icon text not null default '☠️',
  penalty integer not null default 10 check (penalty > 0),
  archived boolean not null default false,
  created_at timestamptz default now()
);

create table curse_instances (
  id uuid primary key default gen_random_uuid(),
  curse_id uuid not null references curses(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'active',
  cast_at timestamptz default now(),
  resolved_at timestamptz,
  coins_deducted integer not null default 0 check (coins_deducted >= 0),
  refunded boolean not null default false,
  constraint curse_instances_status_check check (status in ('active', 'resolved'))
);

create table kid_pin_attempts (
  kid_id uuid primary key references kids(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table dungeon_runs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null default 'Weekly Dungeon',
  icon text not null default '🏰',
  hp integer not null check (hp > 0),
  reward_coins integer not null default 50 check (reward_coins >= 0),
  reward_xp integer not null default 100 check (reward_xp >= 0),
  week_start date not null,
  archived boolean not null default false,
  created_at timestamptz default now(),
  unique(family_id, week_start)
);

create table dungeon_clears (
  id uuid primary key default gen_random_uuid(),
  dungeon_run_id uuid not null references dungeon_runs(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  cleared_at timestamptz default now(),
  unique(dungeon_run_id, kid_id)
);

create table raid_bosses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  icon text not null default '🐉',
  max_hp integer not null check (max_hp > 0),
  current_hp integer not null check (current_hp >= 0 and current_hp <= max_hp),
  bounty_coins integer not null check (bounty_coins >= 0),
  status text not null default 'active',
  archived boolean not null default false,
  defeated_at timestamptz,
  created_at timestamptz default now(),
  constraint raid_boss_status_check check (status in ('active', 'defeated'))
);

create table raid_boss_hits (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references raid_bosses(id) on delete cascade,
  completion_id uuid not null references completions(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  damage_dealt integer not null check (damage_dealt >= 0),
  hit_at timestamptz default now(),
  unique(completion_id)
);

create table raid_boss_payouts (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references raid_bosses(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  amount integer not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  unique(boss_id, kid_id)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table families enable row level security;
alter table profiles enable row level security;
alter table kids enable row level security;
alter table quests enable row level security;
alter table completions enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;
alter table curses enable row level security;
alter table curse_instances enable row level security;
alter table kid_pin_attempts enable row level security;
alter table dungeon_runs enable row level security;
alter table dungeon_clears enable row level security;
alter table raid_bosses enable row level security;
alter table raid_boss_hits enable row level security;
alter table raid_boss_payouts enable row level security;

-- Helper: get the family_id for the current authenticated user
create or replace function get_user_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from profiles where id = auth.uid()
$$;

create or replace function verify_kid_pin(p_kid_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_pin text;
  attempts kid_pin_attempts%rowtype;
  checked_at timestamptz := clock_timestamp();
  next_attempts integer;
  lock_seconds integer := 0;
begin
  select pin into expected_pin from kids where id = p_kid_id;
  if not found then
    return jsonb_build_object('success', false, 'retry_after', 0);
  end if;

  insert into kid_pin_attempts (kid_id) values (p_kid_id)
  on conflict (kid_id) do nothing;

  select * into attempts from kid_pin_attempts where kid_id = p_kid_id for update;

  if attempts.locked_until is not null and attempts.locked_until > checked_at then
    return jsonb_build_object(
      'success', false,
      'retry_after', greatest(1, ceil(extract(epoch from attempts.locked_until - checked_at))::integer)
    );
  end if;

  if expected_pin = p_pin then
    delete from kid_pin_attempts where kid_id = p_kid_id;
    return jsonb_build_object('success', true, 'retry_after', 0);
  end if;

  next_attempts := attempts.failed_attempts + 1;
  if next_attempts >= 8 then lock_seconds := 300;
  elsif next_attempts >= 5 then lock_seconds := 30;
  end if;

  update kid_pin_attempts
  set failed_attempts = next_attempts,
      locked_until = case when lock_seconds > 0 then checked_at + make_interval(secs => lock_seconds) else null end,
      updated_at = checked_at
  where kid_id = p_kid_id;

  return jsonb_build_object('success', false, 'retry_after', lock_seconds);
end;
$$;

revoke all on function verify_kid_pin(uuid, text) from public, anon, authenticated;
grant execute on function verify_kid_pin(uuid, text) to service_role;

create or replace function cq_level_for_xp(total_xp integer)
returns integer
language plpgsql
immutable
strict
as $$
declare
  level_value integer := 10;
  remaining integer;
  needed integer;
begin
  if total_xp < 100 then return 1;
  elsif total_xp < 250 then return 2;
  elsif total_xp < 500 then return 3;
  elsif total_xp < 900 then return 4;
  elsif total_xp < 1400 then return 5;
  elsif total_xp < 2100 then return 6;
  elsif total_xp < 3000 then return 7;
  elsif total_xp < 4200 then return 8;
  elsif total_xp < 6000 then return 9;
  end if;

  remaining := total_xp - 6000;
  loop
    needed := (level_value + 1) * 800;
    exit when remaining < needed;
    remaining := remaining - needed;
    level_value := level_value + 1;
  end loop;
  return level_value;
end;
$$;

create or replace function award_dungeon_clear(p_dungeon_run_id uuid, p_kid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run dungeon_runs%rowtype;
  clear_id uuid;
begin
  select * into run from dungeon_runs where id = p_dungeon_run_id for update;
  if not found or run.archived or run.family_id <> get_user_family_id() then
    return jsonb_build_object('awarded', false);
  end if;

  insert into dungeon_clears (dungeon_run_id, kid_id)
  select run.id, k.id from kids k
  where k.id = p_kid_id and k.family_id = run.family_id
  on conflict (dungeon_run_id, kid_id) do nothing
  returning id into clear_id;

  if clear_id is null then
    return jsonb_build_object('awarded', false);
  end if;

  update kids
  set coins = coins + run.reward_coins,
      xp = xp + run.reward_xp,
      level = cq_level_for_xp(xp + run.reward_xp)
  where id = p_kid_id and family_id = run.family_id;

  return jsonb_build_object('awarded', true, 'coins', run.reward_coins, 'xp', run.reward_xp);
end;
$$;

create or replace function apply_raid_hit(p_boss_id uuid, p_completion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  boss raid_bosses%rowtype;
  completion_kid_id uuid;
  damage integer;
  hit_id uuid;
  new_hp integer;
  family_kids integer;
  per_kid integer := 0;
begin
  select * into boss from raid_bosses where id = p_boss_id for update;
  if not found or boss.archived or boss.status <> 'active' or boss.family_id <> get_user_family_id() then
    return jsonb_build_object('applied', false);
  end if;

  select c.kid_id, coalesce(c.coins_awarded, 0)
  into completion_kid_id, damage
  from completions c
  join kids k on k.id = c.kid_id
  where c.id = p_completion_id and c.status = 'approved' and k.family_id = boss.family_id;
  if not found then return jsonb_build_object('applied', false); end if;

  insert into raid_boss_hits (boss_id, completion_id, kid_id, damage_dealt)
  values (boss.id, p_completion_id, completion_kid_id, damage)
  on conflict (completion_id) do nothing
  returning id into hit_id;
  if hit_id is null then return jsonb_build_object('applied', false); end if;

  new_hp := greatest(0, boss.current_hp - damage);
  update raid_bosses
  set current_hp = new_hp,
      status = case when new_hp = 0 then 'defeated' else status end,
      defeated_at = case when new_hp = 0 then now() else defeated_at end
  where id = boss.id;

  if new_hp = 0 then
    select count(*) into family_kids from kids where family_id = boss.family_id;
    if family_kids > 0 then
      per_kid := floor(boss.bounty_coins::numeric / family_kids)::integer;
      insert into raid_boss_payouts (boss_id, kid_id, amount)
      select boss.id, id, per_kid from kids where family_id = boss.family_id;
      update kids
      set coins = coins + per_kid,
          xp = xp + per_kid,
          level = cq_level_for_xp(xp + per_kid)
      where family_id = boss.family_id;
    end if;
  end if;

  return jsonb_build_object('applied', true, 'new_hp', new_hp, 'defeated', new_hp = 0, 'per_kid', per_kid);
end;
$$;

revoke all on function award_dungeon_clear(uuid, uuid) from public, anon;
revoke all on function apply_raid_hit(uuid, uuid) from public, anon;
grant execute on function award_dungeon_clear(uuid, uuid) to authenticated;
grant execute on function apply_raid_hit(uuid, uuid) to authenticated;

create or replace function submit_quest(p_kid_id uuid, p_quest_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kid_family_id uuid;
  reset_hour integer;
  family_timezone text;
  local_now timestamp;
  expected_date date;
  quest quests%rowtype;
  period_start date;
  period_end date;
  active_count integer;
  retry_id uuid;
begin
  select k.family_id, f.daily_reset_hour, coalesce(f.timezone, 'UTC')
  into kid_family_id, reset_hour, family_timezone
  from kids k join families f on f.id = k.family_id
  where k.id = p_kid_id;
  if not found then return jsonb_build_object('success', false, 'reason', 'not_found'); end if;

  if auth.role() <> 'service_role' and kid_family_id is distinct from get_user_family_id() then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;

  local_now := timezone(family_timezone, clock_timestamp());
  expected_date := local_now::date - case when extract(hour from local_now) < reset_hour then 1 else 0 end;
  if p_date <> expected_date then
    return jsonb_build_object('success', false, 'reason', 'stale_date');
  end if;

  select * into quest from quests where id = p_quest_id for update;
  if not found or quest.archived or not quest.active or quest.family_id <> kid_family_id then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;
  if quest.assigned_to is not null and quest.assigned_to <> p_kid_id then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;
  if (quest.kind = 'oneoff') <> (quest.frequency = 'once') then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;
  if quest.active_days is not null and cardinality(quest.active_days) > 0
     and not (extract(dow from p_date)::integer = any(quest.active_days)) then
    return jsonb_build_object('success', false, 'reason', 'unavailable');
  end if;

  if quest.frequency = 'daily' then
    period_start := p_date;
    period_end := p_date;
  elsif quest.frequency = 'weekly' then
    period_start := p_date - (extract(isodow from p_date)::integer - 1);
    period_end := p_date;
  else
    period_start := null;
    period_end := null;
  end if;

  if exists (
    select 1 from completions c
    where c.quest_id = quest.id and c.kid_id = p_kid_id
      and c.status in ('pending', 'approved')
      and (period_start is null or c.date between period_start and period_end)
  ) then
    return jsonb_build_object('success', false, 'reason', 'already_submitted');
  end if;

  select count(*) into active_count from completions c
  where c.quest_id = quest.id and c.status in ('pending', 'approved')
    and (period_start is null or c.date between period_start and period_end);
  if (quest.kind = 'oneoff' and active_count > 0)
     or (quest.kind = 'shared' and active_count >= quest.slots) then
    return jsonb_build_object('success', false, 'reason', 'slots_full');
  end if;

  select c.id into retry_id from completions c
  where c.quest_id = quest.id and c.kid_id = p_kid_id and c.status = 'rejected'
    and (period_start is null or c.date between period_start and period_end)
  order by c.date desc limit 1;

  if retry_id is not null then
    update completions
    set status = 'pending', date = p_date, completed_at = now(), approved_at = null, coins_awarded = null
    where id = retry_id and status = 'rejected';
    return jsonb_build_object('success', true, 'retried', true);
  end if;

  insert into completions (quest_id, kid_id, status, date)
  values (quest.id, p_kid_id, 'pending', p_date);
  return jsonb_build_object('success', true, 'retried', false);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'reason', 'already_submitted');
  when invalid_parameter_value then
    return jsonb_build_object('success', false, 'reason', 'invalid_timezone');
end;
$$;

revoke all on function submit_quest(uuid, uuid, date) from public, anon;
grant execute on function submit_quest(uuid, uuid, date) to authenticated, service_role;

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

create policy "Family curses" on curses
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

create policy "Family curse_instances" on curse_instances
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

create policy "Family dungeon_runs" on dungeon_runs
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

create policy "Family dungeon_clears" on dungeon_clears
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

create policy "Family raid_bosses" on raid_bosses
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());

create policy "Family raid_boss_hits" on raid_boss_hits
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

create policy "Family raid_boss_payouts" on raid_boss_payouts
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index kids_family_id_idx on kids(family_id);
create index quests_family_id_idx on quests(family_id);
create index quests_active_idx on quests(active);
create index quests_kind_idx on quests(kind);
create index quests_archived_idx on quests(archived);
create index completions_kid_id_idx on completions(kid_id);
create index completions_date_idx on completions(date);
create index completions_status_idx on completions(status);
create index redemptions_kid_id_idx on redemptions(kid_id);
create index curses_family_id_idx on curses(family_id);
create index curses_archived_idx on curses(archived);
create index rewards_archived_idx on rewards(archived);
create index curse_instances_kid_id_idx on curse_instances(kid_id);
create index curse_instances_status_idx on curse_instances(status);
create index dungeon_runs_family_id_idx on dungeon_runs(family_id);
create index dungeon_runs_archived_idx on dungeon_runs(archived);
create index dungeon_clears_run_id_idx on dungeon_clears(dungeon_run_id);
create index dungeon_clears_kid_id_idx on dungeon_clears(kid_id);
create index raid_bosses_family_id_idx on raid_bosses(family_id);
create index raid_bosses_archived_idx on raid_bosses(archived);
create index raid_boss_hits_boss_id_idx on raid_boss_hits(boss_id);
create index raid_boss_hits_kid_id_idx on raid_boss_hits(kid_id);
create index raid_boss_payouts_kid_id_idx on raid_boss_payouts(kid_id);

-- ─── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table kids;
alter publication supabase_realtime add table curse_instances;
alter publication supabase_realtime add table dungeon_runs;
alter publication supabase_realtime add table dungeon_clears;
alter publication supabase_realtime add table raid_bosses;

-- ─── Public invite token lookup (no auth required) ───────────────────────────

create or replace function get_family_by_invite_token(token uuid)
returns json
language plpgsql
security definer
stable
set search_path = public
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
