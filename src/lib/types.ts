export type KidColor = 'azure' | 'mystic'
export type Plan = 'free' | 'family' | 'legendary'
export type QuestFrequency = 'daily' | 'weekly' | 'once'
export type QuestKind = 'personal' | 'shared' | 'oneoff'
export type QuestTier = 'normal' | 'rare' | 'epic' | 'legendary'
export type CompletionStatus = 'pending' | 'approved' | 'rejected'

export interface Family {
  id: string
  name: string
  has_parent_pin: boolean
  invite_token: string
  api_key?: string
  daily_reset_hour: number
  plan: Plan
  created_at: string
}

export interface Profile {
  id: string
  family_id: string
  created_at: string
}

export interface Kid {
  id: string
  family_id: string
  name: string
  avatar: string
  color: KidColor
  coins: number
  streak: number
  last_completed_date: string | null
  xp: number
  level: number
  pin?: string
  created_at: string
}

export interface Quest {
  id: string
  family_id: string
  title: string
  description: string | null
  icon: string
  coins: number
  assigned_to: string | null
  kind: QuestKind
  frequency: QuestFrequency
  tier: QuestTier
  slots: number
  active: boolean
  active_days: number[] | null
  created_at: string
}

export interface Curse {
  id: string
  family_id: string
  title: string
  icon: string
  penalty: number
  created_at: string
}

export interface CurseInstance {
  id: string
  curse_id: string
  kid_id: string
  status: 'active' | 'resolved'
  cast_at: string
  resolved_at: string | null
  coins_deducted: number
  curse?: Curse
  kid?: Kid
}

export interface Completion {
  id: string
  quest_id: string
  kid_id: string
  status: CompletionStatus
  completed_at: string
  approved_at: string | null
  coins_awarded: number | null
  date: string
  quest?: Quest
  kid?: Kid
}

export interface Reward {
  id: string
  family_id: string
  title: string
  description: string | null
  icon: string
  cost: number
  available: boolean
  created_at: string
}

export interface DungeonRun {
  id: string
  family_id: string
  title: string
  icon: string
  hp: number
  current_damage: number
  reward_coins: number
  reward_xp: number
  week_start: string
  status: 'active' | 'cleared'
  cleared_at: string | null
  created_at: string
}

export interface RaidBoss {
  id: string
  family_id: string
  title: string
  icon: string
  max_hp: number
  current_hp: number
  bounty_coins: number
  status: 'active' | 'defeated'
  defeated_at: string | null
  created_at: string
}

export interface RaidBossHit {
  id: string
  boss_id: string
  completion_id: string
  kid_id: string
  damage_dealt: number
  hit_at: string
}

export interface Redemption {
  id: string
  reward_id: string
  kid_id: string
  status: 'pending' | 'approved'
  redeemed_at: string
  reward?: Reward
  kid?: Kid
}
