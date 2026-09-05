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
  coins_requested integer not null check (coins_requested >= 0),
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
  processed_at timestamptz,
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

create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  kind text not null check (kind in (
    'quest_reward', 'quest_reversal', 'reward_redeemed', 'curse',
    'curse_refund', 'curse_reopened', 'dungeon_reward', 'raid_bounty',
    'manual_adjustment', 'migration_opening_balance'
  )),
  description text not null,
  icon text not null default '🪙',
  amount integer not null,
  balance_after integer not null,
  source_id text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  is_estimated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
alter table coin_transactions enable row level security;

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

create or replace function snapshot_completion_coin_value()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.coins_requested is null
     or (old.status = 'rejected' and new.status = 'pending')
     or new.quest_id is distinct from old.quest_id then
    select coins into new.coins_requested from quests where id = new.quest_id;
  end if;
  return new;
end;
$$;

create trigger completions_snapshot_coin_value
before insert or update of status, quest_id on completions
for each row execute function snapshot_completion_coin_value();

create or replace function capture_unclassified_coin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.coins is not distinct from new.coins then return new; end if;
  if current_setting('chorequest.skip_auto_ledger', true) = 'on' then return new; end if;

  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after, created_by, metadata
  ) values (
    new.family_id, new.id, 'manual_adjustment', 'Balance adjusted', '🛠️',
    new.coins - old.coins, new.coins, auth.uid(), '{"captured_automatically":true}'::jsonb
  );
  return new;
end;
$$;

create trigger kids_coin_ledger
after update of coins on kids
for each row
when (old.coins is distinct from new.coins)
execute function capture_unclassified_coin_change();

create or replace function apply_coin_transaction(
  p_kid_id uuid,
  p_expected_balance integer,
  p_new_balance integer,
  p_kind text,
  p_description text,
  p_icon text,
  p_source_id text,
  p_new_xp integer,
  p_new_streak integer,
  p_last_completed_date date,
  p_update_progress boolean,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kid kids%rowtype;
  transaction_id uuid;
  amount_delta integer;
begin
  if p_new_balance < 0 or p_new_balance > 1000000000 then
    raise exception 'Invalid resulting coin balance';
  end if;
  if p_kind not in (
    'quest_reward', 'quest_reversal', 'reward_redeemed', 'curse',
    'curse_refund', 'curse_reopened', 'dungeon_reward', 'raid_bounty',
    'manual_adjustment', 'migration_opening_balance'
  ) then
    raise exception 'Invalid coin transaction kind';
  end if;
  if nullif(btrim(p_description), '') is null then
    raise exception 'Transaction description is required';
  end if;

  select * into kid from kids where id = p_kid_id for update;
  if not found then raise exception 'Kid not found'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and kid.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if kid.coins <> p_expected_balance then
    return jsonb_build_object('applied', false, 'reason', 'balance_changed', 'current_balance', kid.coins);
  end if;

  amount_delta := p_new_balance - kid.coins;
  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids
  set coins = p_new_balance,
      xp = case when p_update_progress then greatest(0, coalesce(p_new_xp, 0)) else xp end,
      level = case when p_update_progress then cq_level_for_xp(greatest(0, coalesce(p_new_xp, 0))) else level end,
      streak = case when p_update_progress then greatest(0, coalesce(p_new_streak, 0)) else streak end,
      last_completed_date = case when p_update_progress then p_last_completed_date else last_completed_date end
  where id = p_kid_id;

  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid.family_id, kid.id, p_kind, btrim(p_description), coalesce(nullif(p_icon, ''), '🪙'),
    amount_delta, p_new_balance, p_source_id, coalesce(p_occurred_at, now()), auth.uid(),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into transaction_id;

  return jsonb_build_object(
    'applied', true,
    'transaction_id', transaction_id,
    'amount', amount_delta,
    'balance_after', p_new_balance
  );
end;
$$;

create or replace function set_kid_coin_balance(
  p_kid_id uuid,
  p_new_balance integer,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kid kids%rowtype;
begin
  select * into kid from kids where id = p_kid_id for update;
  if not found then raise exception 'Kid not found'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and kid.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_new_balance < 0 or p_new_balance > 1000000000 then
    raise exception 'Invalid resulting coin balance';
  end if;
  if p_new_balance = kid.coins then
    return jsonb_build_object('applied', false, 'reason', 'unchanged', 'current_balance', kid.coins);
  end if;

  return apply_coin_transaction(
    p_kid_id => kid.id,
    p_expected_balance => kid.coins,
    p_new_balance => p_new_balance,
    p_kind => 'manual_adjustment',
    p_description => coalesce(nullif(btrim(p_reason), ''), 'Balance adjusted by parent'),
    p_icon => '🛠️',
    p_source_id => null,
    p_new_xp => null,
    p_new_streak => null,
    p_last_completed_date => null,
    p_update_progress => false,
    p_occurred_at => now(),
    p_metadata => jsonb_build_object('reason_provided', nullif(btrim(p_reason), '') is not null)
  );
end;
$$;

create or replace function cq_kid_streak_state(p_kid_id uuid)
returns table(streak_value integer, last_date date)
language plpgsql stable set search_path = public
as $$
declare cursor_date date;
begin
  select max(c.date) into last_date from completions c
  where c.kid_id = p_kid_id and c.status = 'approved';
  streak_value := 0;
  cursor_date := last_date;
  while cursor_date is not null and exists (
    select 1 from completions c
    where c.kid_id = p_kid_id and c.status = 'approved' and c.date = cursor_date
  ) loop
    streak_value := streak_value + 1;
    cursor_date := cursor_date - 1;
  end loop;
  return next;
end;
$$;

create or replace function approve_completion_with_ledger(p_completion_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  completion_row completions%rowtype;
  quest_row quests%rowtype;
  kid_row kids%rowtype;
  approved_time timestamptz := clock_timestamp();
  coins_to_award integer;
  new_balance integer;
  new_xp integer;
  new_level integer;
  new_streak integer;
  new_last_date date;
  transaction_id uuid;
begin
  select * into completion_row from completions where id = p_completion_id for update;
  if not found then return jsonb_build_object('applied', false, 'reason', 'not_found'); end if;
  if completion_row.status <> 'pending' then
    return jsonb_build_object('applied', false, 'reason', 'already_processed');
  end if;
  select * into quest_row from quests where id = completion_row.quest_id;
  select * into kid_row from kids where id = completion_row.kid_id for update;
  if not found or quest_row.family_id is distinct from kid_row.family_id then
    return jsonb_build_object('applied', false, 'reason', 'invalid_source');
  end if;
  if kid_row.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  coins_to_award := completion_row.coins_requested;
  update completions set status = 'approved', approved_at = approved_time, coins_awarded = coins_to_award
  where id = completion_row.id;
  select streak_value, last_date into new_streak, new_last_date from cq_kid_streak_state(kid_row.id);
  new_balance := kid_row.coins + coins_to_award;
  new_xp := kid_row.xp + coins_to_award;
  new_level := cq_level_for_xp(new_xp);
  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids set coins = new_balance, xp = new_xp, level = new_level,
    streak = new_streak, last_completed_date = new_last_date where id = kid_row.id;
  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid_row.family_id, kid_row.id, 'quest_reward', quest_row.title, quest_row.icon,
    coins_to_award, new_balance, completion_row.id::text || ':approved:' || approved_time::text,
    approved_time, auth.uid(), jsonb_build_object('quest_id', quest_row.id, 'completion_id', completion_row.id)
  ) returning id into transaction_id;
  if quest_row.kind = 'oneoff' then update quests set active = false where id = quest_row.id; end if;
  return jsonb_build_object('applied', true, 'transaction_id', transaction_id, 'kid_id', kid_row.id,
    'coins_awarded', coins_to_award, 'balance_after', new_balance, 'level', new_level);
end;
$$;

create or replace function undo_completion_approval_with_ledger(p_completion_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  completion_row completions%rowtype;
  quest_row quests%rowtype;
  kid_row kids%rowtype;
  reversed_time timestamptz := clock_timestamp();
  coins_to_remove integer;
  new_balance integer;
  new_xp integer;
  new_level integer;
  new_streak integer;
  new_last_date date;
  transaction_id uuid;
begin
  select * into completion_row from completions where id = p_completion_id for update;
  if not found then return jsonb_build_object('applied', false, 'reason', 'not_found'); end if;
  if completion_row.status <> 'approved' then
    return jsonb_build_object('applied', false, 'reason', 'not_approved');
  end if;
  select * into quest_row from quests where id = completion_row.quest_id;
  select * into kid_row from kids where id = completion_row.kid_id for update;
  if not found or quest_row.family_id is distinct from kid_row.family_id then
    return jsonb_build_object('applied', false, 'reason', 'invalid_source');
  end if;
  if kid_row.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  coins_to_remove := coalesce(completion_row.coins_awarded, 0);
  update completions set status = 'pending', approved_at = null, coins_awarded = null
  where id = completion_row.id;
  select streak_value, last_date into new_streak, new_last_date from cq_kid_streak_state(kid_row.id);
  new_balance := greatest(0, kid_row.coins - coins_to_remove);
  new_xp := greatest(0, kid_row.xp - coins_to_remove);
  new_level := cq_level_for_xp(new_xp);
  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids set coins = new_balance, xp = new_xp, level = new_level,
    streak = new_streak, last_completed_date = new_last_date where id = kid_row.id;
  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid_row.family_id, kid_row.id, 'quest_reversal', quest_row.title || ' approval reversed', quest_row.icon,
    new_balance - kid_row.coins, new_balance, completion_row.id::text || ':reversed:' || reversed_time::text,
    reversed_time, auth.uid(), jsonb_build_object('quest_id', quest_row.id, 'completion_id', completion_row.id)
  ) returning id into transaction_id;
  if quest_row.kind = 'oneoff' then update quests set active = true where id = quest_row.id; end if;
  return jsonb_build_object('applied', true, 'transaction_id', transaction_id, 'kid_id', kid_row.id,
    'amount', new_balance - kid_row.coins, 'balance_after', new_balance, 'level', new_level);
end;
$$;

create or replace function approve_redemption_with_ledger(p_redemption_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  redemption_row redemptions%rowtype;
  reward_row rewards%rowtype;
  kid_row kids%rowtype;
  processed_time timestamptz := clock_timestamp();
  charge integer;
  new_balance integer;
  transaction_id uuid;
begin
  select * into redemption_row from redemptions where id = p_redemption_id for update;
  if not found then return jsonb_build_object('applied', false, 'reason', 'not_found'); end if;
  if redemption_row.status <> 'pending' then
    return jsonb_build_object('applied', false, 'reason', 'already_processed');
  end if;
  select * into reward_row from rewards where id = redemption_row.reward_id;
  select * into kid_row from kids where id = redemption_row.kid_id for update;
  if not found or reward_row.family_id is distinct from kid_row.family_id then
    return jsonb_build_object('applied', false, 'reason', 'invalid_source');
  end if;
  if kid_row.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  charge := coalesce(redemption_row.cost_charged, reward_row.cost);
  if charge <= 0 then return jsonb_build_object('applied', false, 'reason', 'invalid_cost'); end if;
  if kid_row.coins < charge then
    return jsonb_build_object('applied', false, 'reason', 'insufficient_coins', 'current_balance', kid_row.coins);
  end if;
  new_balance := kid_row.coins - charge;
  update redemptions set status = 'approved', cost_charged = charge, processed_at = processed_time
  where id = redemption_row.id;
  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids set coins = new_balance where id = kid_row.id;
  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid_row.family_id, kid_row.id, 'reward_redeemed', reward_row.title, reward_row.icon,
    -charge, new_balance, redemption_row.id::text, processed_time, auth.uid(),
    jsonb_build_object('reward_id', reward_row.id, 'redemption_id', redemption_row.id)
  ) returning id into transaction_id;
  return jsonb_build_object('applied', true, 'transaction_id', transaction_id,
    'coins_deducted', charge, 'balance_after', new_balance);
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
  balance_after integer;
begin
  select * into run from dungeon_runs where id = p_dungeon_run_id for update;
  if not found or run.archived or run.family_id is distinct from get_user_family_id() then
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

  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids
  set coins = coins + run.reward_coins,
      xp = xp + run.reward_xp,
      level = cq_level_for_xp(xp + run.reward_xp)
  where id = p_kid_id and family_id = run.family_id
  returning coins into balance_after;

  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by
  ) values (
    run.family_id, p_kid_id, 'dungeon_reward', run.title, run.icon,
    run.reward_coins, balance_after, clear_id::text, now(), auth.uid()
  );

  return jsonb_build_object(
    'awarded', true,
    'coins', run.reward_coins,
    'xp', run.reward_xp,
    'balance_after', balance_after
  );
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
  if not found or boss.archived or boss.status <> 'active' or boss.family_id is distinct from get_user_family_id() then
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

      perform set_config('chorequest.skip_auto_ledger', 'on', true);
      with updated_kids as (
        update kids
        set coins = coins + per_kid,
            xp = xp + per_kid,
            level = cq_level_for_xp(xp + per_kid)
        where family_id = boss.family_id
        returning id, family_id, coins
      )
      insert into coin_transactions (
        family_id, kid_id, kind, description, icon, amount, balance_after,
        source_id, occurred_at, created_by
      )
      select
        family_id, id, 'raid_bounty', boss.title, boss.icon, per_kid, coins,
        boss.id::text, now(), auth.uid()
      from updated_kids;
    end if;
  end if;

  return jsonb_build_object('applied', true, 'new_hp', new_hp, 'defeated', new_hp = 0, 'per_kid', per_kid);
end;
$$;

revoke all on function award_dungeon_clear(uuid, uuid) from public, anon;
revoke all on function apply_raid_hit(uuid, uuid) from public, anon;
revoke all on function apply_coin_transaction(uuid, integer, integer, text, text, text, text, integer, integer, date, boolean, timestamptz, jsonb) from public, anon;
revoke all on function set_kid_coin_balance(uuid, integer, text) from public, anon;
revoke all on function approve_completion_with_ledger(uuid) from public, anon;
revoke all on function undo_completion_approval_with_ledger(uuid) from public, anon;
revoke all on function approve_redemption_with_ledger(uuid) from public, anon;
revoke all on function cq_kid_streak_state(uuid) from public, anon;
revoke all on table coin_transactions from anon;
revoke insert, update, delete on table coin_transactions from authenticated;
grant execute on function award_dungeon_clear(uuid, uuid) to authenticated;
grant execute on function apply_raid_hit(uuid, uuid) to authenticated;
grant execute on function apply_coin_transaction(uuid, integer, integer, text, text, text, text, integer, integer, date, boolean, timestamptz, jsonb) to service_role;
grant execute on function set_kid_coin_balance(uuid, integer, text) to authenticated, service_role;
grant execute on function approve_completion_with_ledger(uuid) to authenticated;
grant execute on function undo_completion_approval_with_ledger(uuid) to authenticated;
grant execute on function approve_redemption_with_ledger(uuid) to authenticated;

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

create policy "Family coin_transactions" on coin_transactions
  for select
  using (family_id = get_user_family_id());

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
create index coin_transactions_kid_time_idx on coin_transactions(kid_id, occurred_at desc, id desc);
create index coin_transactions_family_time_idx on coin_transactions(family_id, occurred_at desc);
create index coin_transactions_source_idx on coin_transactions(kid_id, kind, source_id) where source_id is not null;

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

-- ─── Subscription entitlement enforcement ───────────────────────────────────
+-- Keep subscription entitlements authoritative in Postgres.
-- The parent UI still performs optimistic client-side checks for good UX, but
-- these triggers make the same rules hold for direct Supabase writes, API
-- clients, and concurrent requests.

create or replace function public.cq_enforce_plan_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  family_plan text;
  family_id uuid;
  existing_count integer;
  curse_family_id uuid;
  curse_archived boolean;
begin
  if tg_table_name = 'curse_instances' then
    select c.family_id
      into family_id
      from public.curses c
     where c.id = new.curse_id;
  elsif tg_op = 'INSERT' then
    family_id := new.family_id;
  else
    family_id := coalesce(new.family_id, old.family_id);
  end if;

  if tg_table_name <> 'curse_instances'
     and tg_op = 'UPDATE'
     and new.family_id is distinct from old.family_id then
    raise exception using
      errcode = 'P0001',
      message = 'Family ownership cannot be changed';
  end if;

  select coalesce(plan, 'free')
    into family_plan
    from public.families
   where id = family_id;

  family_plan := case when family_plan in ('free', 'family', 'legendary') then family_plan else 'free' end;

  if family_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Family ownership could not be resolved';
  end if;

  -- Serialize quota checks per family so two concurrent requests cannot both
  -- observe the same remaining slot and exceed the free-plan limit.
  perform pg_advisory_xact_lock(hashtext(family_id::text));

  if tg_table_name = 'kids' then
    if tg_op = 'INSERT' and family_plan = 'free' then
      select count(*) into existing_count from public.kids where family_id = new.family_id;
      if existing_count >= 2 then
        raise exception using
          errcode = 'P0001',
          message = 'Kid limit reached for Free plan (maximum 2)';
      end if;
    end if;

  elsif tg_table_name = 'quests' then
    if family_plan <> 'legendary' then
      if coalesce(new.active, false)
         and not coalesce(new.archived, false)
         and (coalesce(new.tier, 'normal') <> 'normal' or coalesce(cardinality(new.active_days), 0) > 0) then
        raise exception using
          errcode = 'P0001',
          message = 'Premium quest features require Legendary plan';
      end if;

      if tg_op = 'INSERT' and coalesce(new.tier, 'normal') <> 'normal' then
        raise exception using
          errcode = 'P0001',
          message = 'Quest tiers require Legendary plan';
      elsif tg_op = 'UPDATE' and new.tier is distinct from old.tier and coalesce(new.tier, 'normal') <> 'normal' then
        raise exception using
          errcode = 'P0001',
          message = 'Quest tiers require Legendary plan';
      end if;

      if tg_op = 'INSERT' and coalesce(cardinality(new.active_days), 0) > 0 then
        raise exception using
          errcode = 'P0001',
          message = 'Active day scheduling requires Legendary plan';
      elsif tg_op = 'UPDATE' and new.active_days is distinct from old.active_days and coalesce(cardinality(new.active_days), 0) > 0 then
        raise exception using
          errcode = 'P0001',
          message = 'Active day scheduling requires Legendary plan';
      end if;
    end if;

    if coalesce(new.active, false) and not coalesce(new.archived, false)
       and family_plan = 'free' then
      select count(*) into existing_count
        from public.quests
       where family_id = new.family_id
         and active
         and not archived
         and id is distinct from new.id;
      if existing_count >= 5 then
        raise exception using
          errcode = 'P0001',
          message = 'Quest limit reached for Free plan (maximum 5 active quests)';
      end if;
    end if;

  elsif tg_table_name = 'rewards' then
    if not coalesce(new.archived, false) and family_plan = 'free' then
      select count(*) into existing_count
        from public.rewards
       where family_id = new.family_id
         and not archived
         and id is distinct from new.id;
      if existing_count >= 3 then
        raise exception using
          errcode = 'P0001',
          message = 'Reward limit reached for Free plan (maximum 3 rewards)';
      end if;
    end if;

  elsif tg_table_name = 'curses' then
    if family_plan = 'free' then
      if tg_op = 'INSERT' then
        raise exception using
          errcode = 'P0001',
          message = 'Coin adjustments require Family plan or higher';
      elsif not coalesce(new.archived, false) and new.archived is distinct from old.archived then
        raise exception using
          errcode = 'P0001',
          message = 'Coin adjustments require Family plan or higher';
      end if;
    end if;

  elsif tg_table_name = 'dungeon_runs' or tg_table_name = 'raid_bosses' then
    if family_plan <> 'legendary' then
      if tg_op = 'INSERT' then
        raise exception using
          errcode = 'P0001',
          message = 'Challenges require Legendary plan';
      elsif not coalesce(new.archived, false) and new.archived is distinct from old.archived then
        raise exception using
          errcode = 'P0001',
          message = 'Challenges require Legendary plan';
      end if;
    end if;

  elsif tg_table_name = 'curse_instances' and tg_op = 'INSERT' then
    select c.family_id, c.archived
      into curse_family_id, curse_archived
      from public.curses c
     where c.id = new.curse_id;

    if curse_family_id is null or curse_family_id is distinct from family_id then
      raise exception using
        errcode = 'P0001',
        message = 'Curse does not belong to this family';
    end if;
    if curse_archived then
      raise exception using
        errcode = 'P0001',
        message = 'This coin adjustment is no longer active';
    end if;
    if family_plan = 'free' then
      raise exception using
        errcode = 'P0001',
        message = 'Coin adjustments require Family plan or higher';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists cq_plan_entitlements_kids on public.kids;
create trigger cq_plan_entitlements_kids
before insert or update on public.kids
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_quests on public.quests;
create trigger cq_plan_entitlements_quests
before insert or update on public.quests
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_rewards on public.rewards;
create trigger cq_plan_entitlements_rewards
before insert or update on public.rewards
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_curses on public.curses;
create trigger cq_plan_entitlements_curses
before insert or update on public.curses
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_dungeon_runs on public.dungeon_runs;
create trigger cq_plan_entitlements_dungeon_runs
before insert or update on public.dungeon_runs
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_raid_bosses on public.raid_bosses;
create trigger cq_plan_entitlements_raid_bosses
before insert or update on public.raid_bosses
for each row execute function public.cq_enforce_plan_entitlements();

drop trigger if exists cq_plan_entitlements_curse_instances on public.curse_instances;
create trigger cq_plan_entitlements_curse_instances
before insert on public.curse_instances
for each row execute function public.cq_enforce_plan_entitlements();

-- A plan is a billing entitlement, so authenticated clients must not be able
-- to change it through the broad family policy. Existing parent settings keep
-- working through an explicit allow-list of mutable family columns.
revoke update on table public.families from authenticated;
grant update (name, invite_token, api_key, parent_pin, daily_reset_hour, timezone)
  on table public.families to authenticated;
grant update (plan) on table public.families to service_role;

create or replace function public.cq_reconcile_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.plan is distinct from old.plan then
    -- Preserve historical rows, but deactivate premium content when a family
    -- moves to a plan that no longer includes it.
    if new.plan <> 'legendary' then
      update public.quests
         set active = false
       where family_id = new.id
         and archived = false
         and (coalesce(tier, 'normal') <> 'normal' or coalesce(cardinality(active_days), 0) > 0);

      update public.dungeon_runs
         set archived = true
       where family_id = new.id and not archived;

      update public.raid_bosses
         set archived = true
       where family_id = new.id and not archived;
    end if;

    if new.plan = 'free' then
      update public.curses
         set archived = true
       where family_id = new.id and not archived;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cq_reconcile_plan_change on public.families;
create trigger cq_reconcile_plan_change
after update of plan on public.families
for each row execute function public.cq_reconcile_plan_change();

-- Challenge payout functions must not continue granting paid benefits after a
-- downgrade. The functions already reject archived challenge rows; plan
-- changes above archive them atomically.
