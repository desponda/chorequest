// XP thresholds for levels 1–10 (index = level - 1)
const THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000]

export const LEVEL_TITLES = [
  'Apprentice', 'Squire', 'Scout', 'Warrior', 'Champion',
  'Hero', 'Veteran', 'Guardian', 'Legend', 'Mythic',
]

export function getLevelTitle(level: number): string {
  if (level <= LEVEL_TITLES.length) return LEVEL_TITLES[level - 1]
  return `Mythic ${level - 9}`
}

export function getXPForLevel(level: number): number {
  if (level <= THRESHOLDS.length) return THRESHOLDS[level - 1]
  let xp = THRESHOLDS[THRESHOLDS.length - 1]
  for (let lv = THRESHOLDS.length; lv < level; lv++) {
    xp += (lv + 1) * 800
  }
  return xp
}

export function getLevelFromXP(xp: number): number {
  let level = 1
  // Levels 1-10: check fixed thresholds
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (xp >= THRESHOLDS[i]) level = i + 1
    else break
  }
  if (level < THRESHOLDS.length) return level

  // Levels 11+: formula-based
  let remaining = xp - THRESHOLDS[THRESHOLDS.length - 1]
  let lv = THRESHOLDS.length
  while (true) {
    const needed = (lv + 1) * 800
    if (remaining < needed) break
    remaining -= needed
    lv++
  }
  return lv
}

export function getXPProgress(xp: number): {
  level: number
  currentXP: number
  neededXP: number
  pct: number
} {
  const level = getLevelFromXP(xp)
  const levelStart = getXPForLevel(level)
  const levelEnd = getXPForLevel(level + 1)
  const currentXP = xp - levelStart
  const neededXP = levelEnd - levelStart
  return {
    level,
    currentXP,
    neededXP,
    pct: Math.min(100, Math.round((currentXP / neededXP) * 100)),
  }
}

/** Returns the Monday of the current week as 'YYYY-MM-DD'. */
export function getWeekMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
