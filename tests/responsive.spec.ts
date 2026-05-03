import { test, expect, type Page } from '@playwright/test'

// Disable CSS animations so screenshots are stable
test.use({ colorScheme: 'dark' })

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns the page's full scroll width — should never exceed viewport width */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
}

/** Returns bounding box height of first match — for touch-target checks */
async function elementHeight(page: Page, selector: string) {
  const el = page.locator(selector).first()
  const box = await el.boundingBox()
  return box?.height ?? 0
}

// ─── Login page (public — no auth needed) ────────────────────────────────────

test.describe('Login page responsive', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // Wait for fonts/animations to settle
    await page.waitForTimeout(300)
  })

  test('no horizontal overflow', async ({ page }) => {
    const { scroll, viewport } = await horizontalOverflow(page)
    // Allow 2px for webkit sub-pixel rounding
    expect(scroll).toBeLessThanOrEqual(viewport + 2)
  })

  test('branding and form are visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ChoreQuest' })).toBeVisible()
    await expect(page.getByPlaceholder('parent@family.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('submit button meets minimum touch target (44px)', async ({ page }) => {
    const h = await elementHeight(page, 'button[type="submit"]')
    expect(h).toBeGreaterThanOrEqual(44)
  })

  test('screenshot matches baseline', async ({ page, browserName }) => {
    // Baselines only committed for chromium — webkit rendering differs per-machine
    if (browserName !== 'chromium') return
    await expect(page).toHaveScreenshot('login.png', { fullPage: true })
  })
})

// ─── Unauthenticated routing ──────────────────────────────────────────────────

test.describe('Auth redirect', () => {
  test('root redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/login/)
  })

  test('/parent redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/login/)
  })

  test('/kid/[id] is accessible without auth (has own PIN protection)', async ({ page }) => {
    await page.goto('/kid/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    // Should NOT redirect to login — kid view is public with its own PIN lock
    expect(page.url()).not.toMatch(/login/)
  })
})

// ─── Login page layout assertions by viewport ─────────────────────────────────
// These run on each Playwright project (Desktop Chrome, iPhone 14, iPad)
// so no manual viewport loop is needed — the project config drives it.

test.describe('Login — layout by viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)
  })

  test('form card does not stretch full viewport width on desktop', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 900) return // desktop only
    const card = page.locator('.rounded-3xl').first()
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(viewport.width * 0.8)
  })

  test('form card fills most of mobile viewport width', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 640) return // mobile only
    const card = page.locator('.rounded-3xl').first()
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    // On mobile, the card should use most of the width (at least 70%)
    expect(box!.width).toBeGreaterThan(viewport.width * 0.7)
  })

  test('no horizontal scrollbar on any viewport', async ({ page, viewport }) => {
    const { scroll, vp } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      vp: document.documentElement.clientWidth,
    }))
    expect(scroll).toBeLessThanOrEqual(vp + 1)
  })
})
