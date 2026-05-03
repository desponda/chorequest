-- Unify quest model: replace overloaded (frequency, exclusive, weekly_target) with explicit (kind, frequency, slots).
--
-- Mapping:
--   frequency='once'                                  → kind='oneoff', frequency='once', slots=1
--   exclusive=true  AND weekly_target IS NOT NULL    → kind='shared', frequency='weekly', slots=weekly_target
--   exclusive=true  AND weekly_target IS NULL        → kind='shared', frequency='daily',  slots=1   (e.g. "Feed the dog")
--   exclusive=false AND weekly_target IS NOT NULL   → kind='personal', frequency='weekly', slots=1   (e.g. "Fold laundry")
--   exclusive=false AND weekly_target IS NULL       → kind='personal', frequency='daily',  slots=1

begin;

alter table quests
  add column kind text not null default 'personal';

update quests set
  kind = case
    when frequency = 'once'           then 'oneoff'
    when exclusive = true             then 'shared'
    else                                   'personal'
  end,
  frequency = case
    when frequency = 'once'                                            then 'once'
    when exclusive = true and weekly_target is not null                then 'weekly'
    when exclusive = true                                              then 'daily'
    when weekly_target is not null                                     then 'weekly'
    else                                                                    frequency
  end;

alter table quests
  add constraint quests_kind_check
  check (kind in ('personal', 'shared', 'oneoff'));

alter table quests rename column weekly_target to slots;
update quests set slots = coalesce(slots, 1);
alter table quests alter column slots set default 1;
alter table quests alter column slots set not null;
alter table quests add constraint quests_slots_check check (slots >= 1);

alter table quests drop column exclusive;

alter table quests
  add constraint quests_frequency_check
  check (frequency in ('daily', 'weekly', 'once'));

create index if not exists quests_kind_idx on quests(kind);

commit;
