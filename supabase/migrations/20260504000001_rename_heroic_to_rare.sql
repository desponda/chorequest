-- Rename quest tier 'heroic' -> 'rare' to match WoW quality progression:
-- Common (normal) -> Rare -> Epic -> Legendary
ALTER TABLE quests DROP CONSTRAINT IF EXISTS quests_tier_check;
UPDATE quests SET tier = 'rare' WHERE tier = 'heroic';
ALTER TABLE quests ADD CONSTRAINT quests_tier_check
  CHECK (tier IN ('normal', 'rare', 'epic', 'legendary'));
