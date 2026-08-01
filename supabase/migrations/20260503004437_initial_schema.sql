-- Reconstructed bootstrap schema. The original repository only recorded that
-- these dashboard-created objects existed, which made `supabase db reset` fail
-- as soon as a later migration tried to alter `quests`.

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Family',
  parent_pin text check (parent_pin ~ '^[0-9]{4}$'),
  invite_token uuid not null default gen_random_uuid() unique,
  api_key uuid not null default gen_random_uuid() unique,
  daily_reset_hour integer not null default 0 check (daily_reset_hour between 0 and 23),
  created_at timestamptz default now()
);

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
  color text not null default 'azure',
  coins integer not null default 0,
  streak integer not null default 0,
  last_completed_date date,
  pin text not null,
  created_at timestamptz default now()
);

-- This is the legacy quest shape expected by 20260503221845_quest_kind_unify.
create table quests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  description text,
  icon text not null default '⚔️',
  coins integer not null default 10,
  assigned_to uuid references kids(id) on delete set null,
  frequency text not null default 'daily',
  exclusive boolean not null default false,
  weekly_target integer,
  tier text not null default 'normal',
  active_days integer[],
  active boolean not null default true,
  created_at timestamptz default now(),
  constraint quests_tier_check check (tier in ('normal', 'heroic', 'epic', 'legendary'))
);

create table completions (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references quests(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'pending',
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

create table curses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  icon text not null default '☠️',
  penalty integer not null default 10,
  created_at timestamptz default now()
);

create table curse_instances (
  id uuid primary key default gen_random_uuid(),
  curse_id uuid not null references curses(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  status text not null default 'active',
  cast_at timestamptz default now(),
  resolved_at timestamptz,
  coins_deducted integer not null default 0,
  constraint curse_instances_status_check check (status in ('active', 'resolved'))
);

alter table families enable row level security;
alter table profiles enable row level security;
alter table kids enable row level security;
alter table quests enable row level security;
alter table completions enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;
alter table curses enable row level security;
alter table curse_instances enable row level security;

create or replace function get_user_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select family_id from profiles where id = auth.uid()
$$;

create policy "Own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Own family" on families
  for all using (id = get_user_family_id()) with check (id = get_user_family_id());
create policy "Family kids" on kids
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());
create policy "Family quests" on quests
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());
create policy "Family completions" on completions
  for all
  using (kid_id in (select id from kids where family_id = get_user_family_id()))
  with check (kid_id in (select id from kids where family_id = get_user_family_id()));
create policy "Family rewards" on rewards
  for all using (family_id = get_user_family_id()) with check (family_id = get_user_family_id());
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

create index kids_family_id_idx on kids(family_id);
create index quests_family_id_idx on quests(family_id);
create index quests_active_idx on quests(active);
create index completions_kid_id_idx on completions(kid_id);
create index completions_date_idx on completions(date);
create index completions_status_idx on completions(status);
create index redemptions_kid_id_idx on redemptions(kid_id);
create index curses_family_id_idx on curses(family_id);
create index curse_instances_kid_id_idx on curse_instances(kid_id);
create index curse_instances_status_idx on curse_instances(status);

alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table kids;
alter publication supabase_realtime add table curse_instances;

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
