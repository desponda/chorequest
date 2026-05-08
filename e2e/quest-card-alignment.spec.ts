import { test, expect } from '@playwright/test'

/**
 * Verifies pixel-level alignment of the two critical columns in QuestCard:
 *   1. The 🪙 coin emoji — must be at the same x-position across all coin amounts and states
 *   2. The action slot right edge — must be at the same x-position across all states
 *      (Done button, ✓ done chip, ⏳ awaiting chip, claimed chip)
 *
 * Test page: /e2e-fixtures/quest-card (no auth required)
 */

test.describe('QuestCard column alignment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e-fixtures/quest-card')
    await page.waitForLoadState('networkidle')
    // Kill animations so bounding boxes are stable
    await page.addStyleTag({
      content: '*, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; }',
    })
    await page.waitForTimeout(100)
  })

  test('coin icon (🪙) x-position is identical across all coin amounts and states', async ({ page }) => {
    const icons = page.locator('[data-testid="quest-coin-icon"]')
    const count = await icons.count()
    expect(count).toBeGreaterThan(5)

    const xs: number[] = []
    for (let i = 0; i < count; i++) {
      const box = await icons.nth(i).boundingBox()
      expect(box, `card ${i} coin icon has no bounding box`).not.toBeNull()
      xs.push(box!.x)
    }

    const first = xs[0]
    for (let i = 1; i < xs.length; i++) {
      expect(
        Math.abs(xs[i] - first),
        `coin icon x mismatch on card ${i}: got ${xs[i]}, expected ${first}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('action slot right edge is identical across todo, approved, pending, rejected, locked states', async ({ page }) => {
    const slots = page.locator('[data-testid="quest-action-slot"]')
    const count = await slots.count()
    expect(count).toBeGreaterThan(5)

    const rightEdges: number[] = []
    for (let i = 0; i < count; i++) {
      const box = await slots.nth(i).boundingBox()
      expect(box, `card ${i} action slot has no bounding box`).not.toBeNull()
      rightEdges.push(box!.x + box!.width)
    }

    const first = rightEdges[0]
    for (let i = 1; i < rightEdges.length; i++) {
      expect(
        Math.abs(rightEdges[i] - first),
        `action slot right edge mismatch on card ${i}: got ${rightEdges[i]}, expected ${first}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  test('all card heights are identical (no height jump between button and pill states)', async ({ page }) => {
    const cards = page.locator('[data-card]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(5)

    const heights: number[] = []
    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox()
      expect(box, `card ${i} has no bounding box`).not.toBeNull()
      heights.push(box!.height)
    }

    const first = heights[0]
    for (let i = 1; i < heights.length; i++) {
      expect(
        Math.abs(heights[i] - first),
        `card height mismatch on card ${i}: got ${heights[i]}px, expected ${first}px`,
      ).toBeLessThanOrEqual(2)
    }
  })

  test('action slot contents (button and pills) have identical height', async ({ page }) => {
    const actionContents = page.locator('[data-testid="quest-action-content"]')
    const count = await actionContents.count()
    expect(count).toBeGreaterThan(5)

    const heights: number[] = []
    for (let i = 0; i < count; i++) {
      const box = await actionContents.nth(i).boundingBox()
      if (box) heights.push(box.height)
    }

    const first = heights[0]
    for (let i = 1; i < heights.length; i++) {
      expect(
        Math.abs(heights[i] - first),
        `action content height mismatch on item ${i}: got ${heights[i]}px, expected ${first}px`,
      ).toBeLessThanOrEqual(2)
    }
  })

  test('screenshot matches baseline', async ({ page, browserName }) => {
    if (browserName !== 'chromium') return
    await expect(page).toHaveScreenshot('quest-card-alignment.png', { fullPage: true })
  })
})
