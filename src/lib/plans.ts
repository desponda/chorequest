import type { Plan } from './types'

export interface PlanLimits {
  maxKids: number
  maxQuests: number
  maxRewards: number
  curses: boolean
  questTiers: boolean
  activeDays: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxKids: 2,
    maxQuests: 5,
    maxRewards: 3,
    curses: false,
    questTiers: false,
    activeDays: false,
  },
  family: {
    maxKids: Infinity,
    maxQuests: Infinity,
    maxRewards: Infinity,
    curses: true,
    questTiers: false,
    activeDays: false,
  },
  legendary: {
    maxKids: Infinity,
    maxQuests: Infinity,
    maxRewards: Infinity,
    curses: true,
    questTiers: true,
    activeDays: true,
  },
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  family: 'Family',
  legendary: 'Legendary',
}

export const PLAN_UPGRADE_HINT: Record<Plan, string> = {
  free: 'Upgrade to Family to unlock',
  family: 'Upgrade to Legendary to unlock',
  legendary: '',
}
