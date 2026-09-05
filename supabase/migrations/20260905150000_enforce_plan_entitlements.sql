-- Keep subscription entitlements authoritative in Postgres.
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
