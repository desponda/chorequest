import { test, expect } from '@playwright/test'
import type { Quest, Completion, Kid, Reward } from '../src/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDate(offset = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function mondayOfWeek(): string {
  const d = new Date()
  const dow = d.getUTCDay() // 0=Sun
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().slice(0, 10)
}

function lastMonday(): string {
  const d = new Date()
  const dow = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1) - 7)
  return d.toISOString().slice(0, 10)
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KID_ID = '00000000-0000-0000-0000-aaaaaaaaaaaa'
const OTHER_KID_ID = '00000000-0000-0000-0000-bbbbbbbbbbbb'
const QUEST_ID = '00000000-0000-0000-0000-cccccccccccc'
const PIN_SESSION_KEY = 'cq_kid_pin_'

const baseKid: Kid = {
  id: KID_ID,
  family_id: 'fam-1',
  name: 'Aria',
  avatar: '🧙',
  color: 'azure',
  coins: 50,
  streak: 2,
  last_completed_date: null,
  xp: 0,
  level: 1,
  created_at: new Date().toISOString(),
}

const baseQuest: Quest = {
  id: QUEST_ID,
  family_id: 'fam-1',
  title: 'Feed the Dog',
  description: null,
  icon: '🐕',
  coins: 10,
  assigned_to: null,
  kind: 'shared',
  frequency: 'daily',
  tier: 'normal',
  slots: 1,
  active: true,
  archived: false,
  active_days: null,
  created_at: new Date().toISOString(),
}

function makePayload(overrides: {
  familySharedCompletions?: Array<{ quest_id: string; kid_id: string; status: string; date: string }>
  completions?: Completion[]
  quests?: Quest[]
}) {
  return {
    kid: baseKid,
    resetHour: 0,
    timeZone: 'UTC',
    quests: overrides.quests ?? [baseQuest],
    completions: overrides.completions ?? [],
    rewards: [] as Reward[],
    activeCurses: [],
    familySharedCompletions: overrides.familySharedCompletions ?? [],
    pendingRedemptions: [],
  }
}

// ─── Test setup helpers ───────────────────────────────────────────────────────

async function setupPage(
  page: import('@playwright/test').Page,
  payload: ReturnType<typeof makePayload>,
) {
  // Bypass PIN gate by pre-setting sessionStorage
  await page.addInitScript(
    ({ key, kidId }: { key: string; kidId: string }) => {
      sessionStorage.setItem(key + kidId, 'verified')
    },
    { key: PIN_SESSION_KEY, kidId: KID_ID },
  )

  // Intercept the data API — serve controlled payload
  await page.route(`**/api/kid/${KID_ID}/data`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  )

  // Silence any supabase realtime connection attempts
  await page.route('**/realtime/**', (route) => route.abort())
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
}

async function openBountyBoard(page: import('@playwright/test').Page) {
  await page.goto(`/kid/${KID_ID}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /Bounty/ }).click()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Shared quest — daily reset', () => {
  test('quest is available when the only family completion is from yesterday (regression: daily must not use week-scoped filter)', async ({ page }) => {
    const yesterday = localDate(-1)

    await setupPage(page, makePayload({
      familySharedCompletions: [
        // Another kid completed yesterday — approved today.
        // With the old bug, this was counted as "claimed this week" → slot appeared full.
        { quest_id: QUEST_ID, kid_id: OTHER_KID_ID, status: 'approved', date: yesterday },
      ],
    }))

    await page.goto(`/kid/${KID_ID}`)
    await page.waitForLoadState('networkidle')

    // The default tab must not be blank when only bounties are available.
    await expect(page.getByText('No personal quests right now.')).toBeVisible()
    await page.getByRole('button', { name: 'View Bounty' }).click()

    // Quest should be claimable — not locked
    await expect(page.getByText('⚡ Claim')).toBeVisible()

    // Slot count shows 0/1, not 1/1
    await expect(page.getByText('0/1 claimed')).toBeVisible()
  })

  test('quest is locked when all slots are claimed TODAY', async ({ page }) => {
    const today = localDate(0)

    await setupPage(page, makePayload({
      familySharedCompletions: [
        // Another kid claimed the only slot today
        { quest_id: QUEST_ID, kid_id: OTHER_KID_ID, status: 'approved', date: today },
      ],
    }))

    await openBountyBoard(page)

    // Claim button should NOT be present
    await expect(page.getByText('⚡ Claim')).not.toBeVisible()

    // Slot count shows 1/1 (all taken)
    await expect(page.getByText('1/1 claimed')).toBeVisible()

    // "claimed" badge visible on the locked card (exact: true distinguishes it from "1/1 claimed" slot label)
    await expect(page.getByText('claimed', { exact: true })).toBeVisible()
  })

  test('this kid sees their own completion as submitted (pending), not as locked', async ({ page }) => {
    const today = localDate(0)

    await setupPage(page, makePayload({
      // This kid completed today — shows in both completions and familySharedCompletions
      completions: [
        {
          id: 'comp-1',
          quest_id: QUEST_ID,
          kid_id: KID_ID,
          status: 'pending',
          completed_at: new Date().toISOString(),
          approved_at: null,
          coins_awarded: null,
          date: today,
        },
      ],
      familySharedCompletions: [
        { quest_id: QUEST_ID, kid_id: KID_ID, status: 'pending', date: today },
      ],
    }))

    await openBountyBoard(page)

    // Not locked — pending status is announced accessibly.
    await expect(page.getByRole('status', { name: 'Awaiting approval' })).toBeVisible()

    // Claim button should not be shown (quest already submitted)
    await expect(page.getByText('⚡ Claim')).not.toBeVisible()
  })
})

test.describe('Shared quest — weekly reset', () => {
  test('weekly quest is locked when a slot was claimed earlier this week', async ({ page }) => {
    const weekStart = mondayOfWeek()
    const quest: Quest = { ...baseQuest, frequency: 'weekly', slots: 1 }

    await setupPage(page, makePayload({
      quests: [quest],
      familySharedCompletions: [
        // Claimed at the start of this week
        { quest_id: QUEST_ID, kid_id: OTHER_KID_ID, status: 'approved', date: weekStart },
      ],
    }))

    await openBountyBoard(page)

    await expect(page.getByText('⚡ Claim')).not.toBeVisible()
    await expect(page.getByText('claimed', { exact: true })).toBeVisible()
  })

  test('weekly quest is available when the only completion is from last week', async ({ page }) => {
    const prevMonday = lastMonday()
    const quest: Quest = { ...baseQuest, frequency: 'weekly', slots: 1 }

    await setupPage(page, makePayload({
      quests: [quest],
      familySharedCompletions: [
        // Claimed last week — should not carry over to this week
        { quest_id: QUEST_ID, kid_id: OTHER_KID_ID, status: 'approved', date: prevMonday },
      ],
    }))

    await openBountyBoard(page)

    await expect(page.getByText('⚡ Claim')).toBeVisible()
    await expect(page.getByText('0/1 claimed')).toBeVisible()
  })

  test('weekly quest with multiple slots: partially claimed still shows as available', async ({ page }) => {
    const today = localDate(0)
    const quest: Quest = { ...baseQuest, frequency: 'weekly', slots: 3 }

    await setupPage(page, makePayload({
      quests: [quest],
      familySharedCompletions: [
        { quest_id: QUEST_ID, kid_id: OTHER_KID_ID, status: 'approved', date: today },
        // 1 of 3 slots taken — should still show Claim button
      ],
    }))

    await openBountyBoard(page)

    await expect(page.getByText('⚡ Claim')).toBeVisible()
    await expect(page.getByText('1/3 claimed')).toBeVisible()
  })
})
