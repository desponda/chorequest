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

  test('screenshot matches baseline', async ({ page, browserName }) => {
    if (browserName !== 'chromium') return
    await expect(page).toHaveScreenshot('quest-card-alignment.png', { fullPage: true })
  })
})
