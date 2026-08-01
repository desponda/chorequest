-- Serialize claims per quest so concurrent kids cannot overfill shared slots or
-- claim the same one-off. The function also makes the database authoritative
-- for cadence, assignment, active-day, and family-timezone rules.
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
  if quest.active_days is not null
     and cardinality(quest.active_days) > 0
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

  select count(*) into active_count
  from completions c
  where c.quest_id = quest.id
    and c.status in ('pending', 'approved')
    and (period_start is null or c.date between period_start and period_end);

  if (quest.kind = 'oneoff' and active_count > 0)
     or (quest.kind = 'shared' and active_count >= quest.slots) then
    return jsonb_build_object('success', false, 'reason', 'slots_full');
  end if;

  select c.id into retry_id
  from completions c
  where c.quest_id = quest.id and c.kid_id = p_kid_id and c.status = 'rejected'
    and (period_start is null or c.date between period_start and period_end)
  order by c.date desc
  limit 1;

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
