-- Challenge rewards update several rows and must commit as one transaction.
-- Client-side read/modify/write sequences could lose concurrent balance changes
-- or mark a clear/defeat paid without actually crediting the kid.

create table raid_boss_payouts (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references raid_bosses(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  amount integer not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  unique (boss_id, kid_id)
);

alter table raid_boss_payouts enable row level security;
create policy "Family raid_boss_payouts" on raid_boss_payouts
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));
create index raid_boss_payouts_kid_id_idx on raid_boss_payouts(kid_id);

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

  return jsonb_build_object(
    'awarded', true,
    'coins', run.reward_coins,
    'xp', run.reward_xp
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
  if not found or boss.archived or boss.status <> 'active' or boss.family_id <> get_user_family_id() then
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
      update kids
      set coins = coins + per_kid,
          xp = xp + per_kid,
          level = cq_level_for_xp(xp + per_kid)
      where family_id = boss.family_id;
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

revoke all on function award_dungeon_clear(uuid, uuid) from public, anon;
revoke all on function apply_raid_hit(uuid, uuid) from public, anon;
grant execute on function award_dungeon_clear(uuid, uuid) to authenticated;
grant execute on function apply_raid_hit(uuid, uuid) to authenticated;
