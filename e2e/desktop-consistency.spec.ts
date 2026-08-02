import { expect, test, type Page } from '@playwright/test'

const KID_ID = '00000000-0000-0000-0000-dddddddddddd'
const PIN_SESSION_KEY = 'cq_kid_pin_'

const kidPayload = {
  kid: {
    id: KID_ID,
    family_id: 'family-desktop',
    name: 'Aria',
    avatar: '🧙',
    color: 'azure',
    coins: 1540,
    streak: 8,
    last_completed_date: null,
    xp: 80,
    level: 1,
    created_at: new Date().toISOString(),
  },
  resetHour: 0,
  timeZone: 'UTC',
  quests: [
    {
      id: '00000000-0000-0000-0000-111111111111',
      family_id: 'family-desktop',
      title: 'Tidy the bedroom before school',
      description: 'Put clothes away and make the bed.',
      icon: '🛏️',
      coins: 20,
      assigned_to: KID_ID,
      kind: 'personal',
      frequency: 'daily',
      tier: 'normal',
      slots: 1,
      active: true,
      archived: false,
      active_days: null,
      created_at: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-222222222222',
      family_id: 'family-desktop',
      title: 'Help unload the dishwasher',
      description: null,
      icon: '🍽️',
      coins: 30,
      assigned_to: null,
      kind: 'shared',
      frequency: 'daily',
      tier: 'epic',
      slots: 3,
      active: true,
      archived: false,
      active_days: null,
      created_at: new Date().toISOString(),
    },
  ],
  completions: [],
  rewards: [
    {
      id: 'reward-desktop',
      family_id: 'family-desktop',
      title: 'Choose family movie night',
      description: 'Pick the movie and snacks.',
      icon: '🎬',
      cost: 150,
      created_at: new Date().toISOString(),
    },
  ],
  activeCurses: [],
  familySharedCompletions: [],
  pendingRedemptions: [],
}

async function openKidWorkspace(page: Page) {
  await page.addInitScript(
    ({ key, kidId }: { key: string; kidId: string }) => sessionStorage.setItem(key + kidId, 'verified'),
    { key: PIN_SESSION_KEY, kidId: KID_ID },
  )
  await page.route(`**/api/kid/${KID_ID}/data`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kidPayload) }),
  )
  await page.route('**/realtime/**', (route) => route.abort())
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.goto(`/kid/${KID_ID}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('heading', { name: 'Aria' })).toBeVisible()
}

test.describe('Desktop workspace consistency', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('kid workspace uses intentional desktop widths and aligned regions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome')
    await openKidWorkspace(page)

    const frame = page.locator('.workspace-frame-kid')
    const tabs = page.getByRole('tablist', { name: 'Adventurer sections' })
    const main = page.getByRole('tabpanel')
    const [frameBox, tabsBox, mainBox] = await Promise.all([
      frame.boundingBox(),
      tabs.boundingBox(),
      main.boundingBox(),
    ])

    expect(frameBox).not.toBeNull()
    expect(tabsBox).not.toBeNull()
    expect(mainBox).not.toBeNull()
    expect(frameBox!.width).toBeGreaterThanOrEqual(850)
    expect(mainBox!.width).toBeGreaterThanOrEqual(740)
    expect(tabsBox!.width).toBeGreaterThan(mainBox!.width)
    expect(Math.abs((tabsBox!.x + tabsBox!.width / 2) - (mainBox!.x + mainBox!.width / 2))).toBeLessThan(2)

    await page.getByRole('tab', { name: 'Bounty' }).click()
    await expect(page.getByRole('heading', { name: 'Bounty board' })).toBeVisible()

    if (process.env.CAPTURE_UI) {
      await page.screenshot({ path: testInfo.outputPath('kid-desktop.png'), fullPage: true })
    }
  })

  test('kid workspace remains fluid in a narrow desktop window', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome')
    await page.setViewportSize({ width: 540, height: 760 })
    await openKidWorkspace(page)

    const frameBox = await page.locator('.workspace-frame-kid').boundingBox()
    expect(frameBox).not.toBeNull()
    expect(frameBox!.width).toBeGreaterThanOrEqual(530)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(542)

    if (process.env.CAPTURE_UI) {
      await page.getByRole('tab', { name: 'Bounty' }).click()
      await expect(page.getByRole('heading', { name: 'Bounty board' })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('kid-narrow-desktop.png'), fullPage: true })
    }
  })

  test('workspace rail remains usable on a 320px phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome')
    await page.setViewportSize({ width: 320, height: 568 })
    await openKidWorkspace(page)

    const tabs = page.getByRole('tablist', { name: 'Adventurer sections' })
    const tabButtons = tabs.getByRole('tab')
    expect(await tabButtons.count()).toBe(4)
    for (const tabButton of await tabButtons.all()) {
      const box = await tabButton.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(322)
  })

  test('parent workspace uses a balanced two-column management layout', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome')
    await page.goto('/e2e-fixtures/parent-workspace')

    const frameBox = await page.locator('.workspace-frame-parent').boundingBox()
    const addQuestBox = await page.getByRole('heading', { name: 'Add New Quest' }).locator('..').boundingBox()
    const activeQuestBox = await page.getByRole('heading', { name: 'Active Quests' }).locator('..').boundingBox()

    expect(frameBox).not.toBeNull()
    expect(addQuestBox).not.toBeNull()
    expect(activeQuestBox).not.toBeNull()
    expect(frameBox!.width).toBeGreaterThanOrEqual(1100)
    expect(Math.abs(addQuestBox!.y - activeQuestBox!.y)).toBeLessThan(2)
    expect(activeQuestBox!.x).toBeGreaterThan(addQuestBox!.x + addQuestBox!.width)

    if (process.env.CAPTURE_UI) {
      await page.screenshot({ path: testInfo.outputPath('parent-desktop.png'), fullPage: true })
    }
  })
})
