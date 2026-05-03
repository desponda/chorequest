export type KidColor = 'azure' | 'mystic'
export type QuestFrequency = 'daily' | 'weekly' | 'once'
export type QuestTier = 'normal' | 'heroic' | 'legendary' | 'epic'
export type CompletionStatus = 'pending' | 'approved' | 'rejected'

export interface Family {
  id: string
  name: string
  parent_pin: string | null
  invite_token: string
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
  pin: string
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
  frequency: QuestFrequency
  tier: QuestTier
  active: boolean
  created_at: string
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

export interface Redemption {
  id: string
  reward_id: string
  kid_id: string
  status: 'pending' | 'approved'
  redeemed_at: string
  reward?: Reward
  kid?: Kid
}
