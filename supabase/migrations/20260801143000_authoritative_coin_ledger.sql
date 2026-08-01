-- Store an append-only, authoritative balance history. Previous ledger views
-- reconstructed balances from mutable source rows, which could not account for
-- manual adjustments and could silently drift from kids.coins.

alter table redemptions add column if not exists processed_at timestamptz;
update redemptions
set processed_at = redeemed_at
where status in ('approved', 'denied') and processed_at is null;

-- Pending quest credits must keep the value that was offered when the child
-- submitted the quest, just as pending reward debits keep cost_charged.
alter table completions add column if not exists coins_requested integer;
update completions c
set coins_requested = coalesce(c.coins_awarded, q.coins, 0)
from quests q
where q.id = c.quest_id and c.coins_requested is null;
alter table completions alter column coins_requested set not null;
alter table completions add constraint completions_coins_requested_nonnegative
  check (coins_requested >= 0) not valid;

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

create table coin_transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  kind text not null check (kind in (
    'quest_reward',
    'quest_reversal',
    'reward_redeemed',
    'curse',
    'curse_refund',
    'curse_reopened',
    'dungeon_reward',
    'raid_bounty',
    'manual_adjustment',
    'migration_opening_balance'
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

alter table coin_transactions enable row level security;

create policy "Family coin_transactions" on coin_transactions
  for select
  using (family_id = get_user_family_id());

create index coin_transactions_kid_time_idx
  on coin_transactions(kid_id, occurred_at desc, id desc);
create index coin_transactions_family_time_idx
  on coin_transactions(family_id, occurred_at desc);
create index coin_transactions_source_idx
  on coin_transactions(kid_id, kind, source_id)
  where source_id is not null;

-- Import all financial events that can be inferred from the pre-ledger schema.
-- These rows are explicitly marked estimated because historical manual balance
-- edits were never recorded. An opening row reconciles each imported history to
-- the child's current balance without pretending the old running balances were
-- observed at transaction time.
with known_events as (
  select
    c.kid_id,
    'quest_reward'::text as kind,
    c.id::text as source_id,
    coalesce(q.title, 'Quest')::text as description,
    coalesce(q.icon, '⚔️')::text as icon,
    coalesce(c.coins_awarded, 0)::integer as amount,
    coalesce(c.approved_at, c.completed_at, now()) as occurred_at,
    20 as sort_order
  from completions c
  left join quests q on q.id = c.quest_id
  where c.status = 'approved'

  union all

  select
    r.kid_id,
    'reward_redeemed',
    r.id::text,
    coalesce(rw.title, 'Reward'),
    coalesce(rw.icon, '🎁'),
    -coalesce(r.cost_charged, rw.cost, 0)::integer,
    coalesce(r.processed_at, r.redeemed_at, now()),
    30
  from redemptions r
  left join rewards rw on rw.id = r.reward_id
  where r.status = 'approved'

  union all

  select
    ci.kid_id,
    'curse',
    ci.id::text,
    coalesce(cu.title, 'Curse'),
    coalesce(cu.icon, '☠️'),
    -coalesce(ci.coins_deducted, 0)::integer,
    coalesce(ci.cast_at, now()),
    40
  from curse_instances ci
  left join curses cu on cu.id = ci.curse_id
  where ci.coins_deducted > 0

  union all

  select
    ci.kid_id,
    'curse_refund',
    ci.id::text,
    coalesce(cu.title, 'Curse') || ' forgiven',
    coalesce(cu.icon, '☠️'),
    coalesce(ci.coins_deducted, 0)::integer,
    ci.resolved_at,
    50
  from curse_instances ci
  left join curses cu on cu.id = ci.curse_id
  where ci.refunded and ci.resolved_at is not null and ci.coins_deducted > 0

  union all

  select
    dc.kid_id,
    'dungeon_reward',
    dc.id::text,
    coalesce(dr.title, 'Dungeon clear'),
    coalesce(dr.icon, '🏰'),
    coalesce(dr.reward_coins, 0)::integer,
    coalesce(dc.cleared_at, now()),
    60
  from dungeon_clears dc
  left join dungeon_runs dr on dr.id = dc.dungeon_run_id

  union all

  select
    rbp.kid_id,
    'raid_bounty',
    rbp.id::text,
    coalesce(rb.title, 'Raid boss bounty'),
    coalesce(rb.icon, '🐉'),
    coalesce(rbp.amount, 0)::integer,
    coalesce(rbp.paid_at, now()),
    70
  from raid_boss_payouts rbp
  left join raid_bosses rb on rb.id = rbp.boss_id
),
event_totals as (
  select kid_id, sum(amount)::integer as known_total, min(occurred_at) as first_event_at
  from known_events
  group by kid_id
),
opening_events as (
  select
    k.id as kid_id,
    'migration_opening_balance'::text as kind,
    ('opening:' || k.id::text) as source_id,
    'Imported opening balance'::text as description,
    '🧾'::text as icon,
    (k.coins - coalesce(et.known_total, 0))::integer as amount,
    least(
      coalesce(et.first_event_at - interval '1 microsecond', k.created_at, now()),
      coalesce(k.created_at, now())
    ) as occurred_at,
    10 as sort_order
  from kids k
  left join event_totals et on et.kid_id = k.id
  where k.coins - coalesce(et.known_total, 0) <> 0
),
all_events as (
  select * from known_events
  union all
  select * from opening_events
),
ordered_events as (
  select
    e.*,
    k.family_id,
    sum(e.amount) over (
      partition by e.kid_id
      order by e.occurred_at, e.sort_order, e.kind, e.source_id
      rows between unbounded preceding and current row
    )::integer as balance_after
  from all_events e
  join kids k on k.id = e.kid_id
)
insert into coin_transactions (
  family_id,
  kid_id,
  kind,
  description,
  icon,
  amount,
  balance_after,
  source_id,
  occurred_at,
  is_estimated,
  metadata
)
select
  family_id,
  kid_id,
  kind,
  description,
  icon,
  amount,
  balance_after,
  source_id,
  occurred_at,
  true,
  '{"backfilled":true}'::jsonb
from ordered_events
on conflict do nothing;

-- Safety net: any code path that directly changes kids.coins is still captured.
-- First-party flows use apply_coin_transaction for richer descriptions.
create or replace function capture_unclassified_coin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.coins is not distinct from new.coins then
    return new;
  end if;

  if current_setting('chorequest.skip_auto_ledger', true) = 'on' then
    return new;
  end if;

  insert into coin_transactions (
    family_id,
    kid_id,
    kind,
    description,
    icon,
    amount,
    balance_after,
    created_by,
    metadata
  ) values (
    new.family_id,
    new.id,
    'manual_adjustment',
    'Balance adjusted',
    '🛠️',
    new.coins - old.coins,
    new.coins,
    auth.uid(),
    '{"captured_automatically":true}'::jsonb
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
  if not found then
    raise exception 'Kid not found';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' and kid.family_id is distinct from get_user_family_id() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if kid.coins <> p_expected_balance then
    return jsonb_build_object(
      'applied', false,
      'reason', 'balance_changed',
      'current_balance', kid.coins
    );
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
    family_id,
    kid_id,
    kind,
    description,
    icon,
    amount,
    balance_after,
    source_id,
    occurred_at,
    created_by,
    metadata
  ) values (
    kid.family_id,
    kid.id,
    p_kind,
    btrim(p_description),
    coalesce(nullif(p_icon, ''), '🪙'),
    amount_delta,
    p_new_balance,
    p_source_id,
    coalesce(p_occurred_at, now()),
    auth.uid(),
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
  if not found then
    raise exception 'Kid not found';
  end if;
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
language plpgsql
stable
set search_path = public
as $$
declare
  cursor_date date;
begin
  select max(c.date) into last_date
  from completions c
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
language plpgsql
security definer
set search_path = public
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
  update completions
  set status = 'approved', approved_at = approved_time, coins_awarded = coins_to_award
  where id = completion_row.id;

  select streak_value, last_date into new_streak, new_last_date
  from cq_kid_streak_state(kid_row.id);
  new_balance := kid_row.coins + coins_to_award;
  new_xp := kid_row.xp + coins_to_award;
  new_level := cq_level_for_xp(new_xp);

  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids
  set coins = new_balance,
      xp = new_xp,
      level = new_level,
      streak = new_streak,
      last_completed_date = new_last_date
  where id = kid_row.id;

  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid_row.family_id, kid_row.id, 'quest_reward', quest_row.title, quest_row.icon,
    coins_to_award, new_balance,
    completion_row.id::text || ':approved:' || approved_time::text,
    approved_time, auth.uid(), jsonb_build_object('quest_id', quest_row.id, 'completion_id', completion_row.id)
  ) returning id into transaction_id;

  if quest_row.kind = 'oneoff' then
    update quests set active = false where id = quest_row.id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'transaction_id', transaction_id,
    'kid_id', kid_row.id,
    'coins_awarded', coins_to_award,
    'balance_after', new_balance,
    'level', new_level
  );
end;
$$;

create or replace function undo_completion_approval_with_ledger(p_completion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  update completions
  set status = 'pending', approved_at = null, coins_awarded = null
  where id = completion_row.id;

  select streak_value, last_date into new_streak, new_last_date
  from cq_kid_streak_state(kid_row.id);
  new_balance := greatest(0, kid_row.coins - coins_to_remove);
  new_xp := greatest(0, kid_row.xp - coins_to_remove);
  new_level := cq_level_for_xp(new_xp);

  perform set_config('chorequest.skip_auto_ledger', 'on', true);
  update kids
  set coins = new_balance,
      xp = new_xp,
      level = new_level,
      streak = new_streak,
      last_completed_date = new_last_date
  where id = kid_row.id;

  insert into coin_transactions (
    family_id, kid_id, kind, description, icon, amount, balance_after,
    source_id, occurred_at, created_by, metadata
  ) values (
    kid_row.family_id, kid_row.id, 'quest_reversal', quest_row.title || ' approval reversed', quest_row.icon,
    new_balance - kid_row.coins, new_balance,
    completion_row.id::text || ':reversed:' || reversed_time::text,
    reversed_time, auth.uid(), jsonb_build_object('quest_id', quest_row.id, 'completion_id', completion_row.id)
  ) returning id into transaction_id;

  if quest_row.kind = 'oneoff' then
    update quests set active = true where id = quest_row.id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'transaction_id', transaction_id,
    'kid_id', kid_row.id,
    'amount', new_balance - kid_row.coins,
    'balance_after', new_balance,
    'level', new_level
  );
end;
$$;

create or replace function approve_redemption_with_ledger(p_redemption_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  update redemptions
  set status = 'approved', cost_charged = charge, processed_at = processed_time
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

  return jsonb_build_object(
    'applied', true,
    'transaction_id', transaction_id,
    'coins_deducted', charge,
    'balance_after', new_balance
  );
end;
$$;

-- Challenge payouts now write their exact resulting balances in the same
-- database transaction as the clear/defeat.
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

  if not found then
    return jsonb_build_object('applied', false);
  end if;

  insert into raid_boss_hits (boss_id, completion_id, kid_id, damage_dealt)
  values (boss.id, p_completion_id, completion_kid_id, damage)
  on conflict (completion_id) do nothing
  returning id into hit_id;

  if hit_id is null then
    return jsonb_build_object('applied', false);
  end if;

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

  return jsonb_build_object(
    'applied', true,
    'new_hp', new_hp,
    'defeated', new_hp = 0,
    'per_kid', per_kid
  );
end;
$$;

revoke all on table coin_transactions from anon;
revoke insert, update, delete on table coin_transactions from authenticated;
revoke all on function apply_coin_transaction(uuid, integer, integer, text, text, text, text, integer, integer, date, boolean, timestamptz, jsonb) from public, anon;
revoke all on function set_kid_coin_balance(uuid, integer, text) from public, anon;
revoke all on function approve_completion_with_ledger(uuid) from public, anon;
revoke all on function undo_completion_approval_with_ledger(uuid) from public, anon;
revoke all on function approve_redemption_with_ledger(uuid) from public, anon;
revoke all on function cq_kid_streak_state(uuid) from public, anon;
grant execute on function apply_coin_transaction(uuid, integer, integer, text, text, text, text, integer, integer, date, boolean, timestamptz, jsonb) to service_role;
grant execute on function set_kid_coin_balance(uuid, integer, text) to authenticated, service_role;
grant execute on function approve_completion_with_ledger(uuid) to authenticated;
grant execute on function undo_completion_approval_with_ledger(uuid) to authenticated;
grant execute on function approve_redemption_with_ledger(uuid) to authenticated;
