-- Kid pages are intentionally public before PIN entry, so lockouts must be
-- enforced in the database rather than in browser state that can be cleared.
create table kid_pin_attempts (
  kid_id uuid primary key references kids(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table kid_pin_attempts enable row level security;

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

  insert into kid_pin_attempts (kid_id)
  values (p_kid_id)
  on conflict (kid_id) do nothing;

  select * into attempts
  from kid_pin_attempts
  where kid_id = p_kid_id
  for update;

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
  if next_attempts >= 8 then
    lock_seconds := 300;
  elsif next_attempts >= 5 then
    lock_seconds := 30;
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
