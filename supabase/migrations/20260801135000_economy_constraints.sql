-- Prevent malformed or negative economy values even when writes bypass the UI.
-- NOT VALID avoids blocking deployment on legacy rows while still enforcing all
-- new inserts and updates; legacy data can be cleaned and validated separately.
alter table kids add constraint kids_coins_nonnegative check (coins >= 0) not valid;
alter table kids add constraint kids_xp_nonnegative check (xp >= 0) not valid;
alter table kids add constraint kids_level_positive check (level >= 1) not valid;
alter table kids add constraint kids_pin_four_digits check (pin ~ '^[0-9]{4}$') not valid;
alter table quests add constraint quests_coins_nonnegative check (coins >= 0) not valid;
alter table quests add constraint quests_kind_frequency_consistent check ((kind = 'oneoff') = (frequency = 'once')) not valid;
alter table quests add constraint quests_slots_context check (kind = 'shared' or slots = 1) not valid;
alter table completions add constraint completions_coins_awarded_nonnegative check (coins_awarded is null or coins_awarded >= 0) not valid;
alter table rewards add constraint rewards_cost_positive check (cost > 0) not valid;
alter table curses add constraint curses_penalty_positive check (penalty > 0) not valid;
alter table curse_instances add constraint curse_instances_coins_deducted_nonnegative check (coins_deducted >= 0) not valid;
alter table dungeon_runs add constraint dungeon_runs_hp_positive check (hp > 0) not valid;
alter table dungeon_runs add constraint dungeon_runs_rewards_nonnegative check (reward_coins >= 0 and reward_xp >= 0) not valid;
alter table raid_bosses add constraint raid_bosses_hp_valid check (max_hp > 0 and current_hp >= 0 and current_hp <= max_hp) not valid;
alter table raid_bosses add constraint raid_bosses_bounty_nonnegative check (bounty_coins >= 0) not valid;
alter table raid_boss_hits add constraint raid_boss_hits_damage_nonnegative check (damage_dealt >= 0) not valid;
