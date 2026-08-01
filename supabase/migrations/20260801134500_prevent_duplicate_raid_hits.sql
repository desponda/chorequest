-- A completion may damage at most one raid boss once. Repeated approval calls
-- must not be able to apply the same quest damage or bounty more than once.
delete from raid_boss_hits
where id in (
  select id
  from (
    select id, row_number() over (partition by completion_id order by hit_at, id) as occurrence
    from raid_boss_hits
  ) ranked
  where occurrence > 1
);

create unique index if not exists raid_boss_hits_completion_id_key
  on raid_boss_hits(completion_id);
