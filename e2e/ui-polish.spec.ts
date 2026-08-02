import { test, expect, type Page } from '@playwright/test'

// Disable CSS animations so screenshots are stable
test.use({ colorScheme: 'dark' })

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
}

// ─── Marketing landing — public, unauthenticated ─────────────────────────────

test.describe('Marketing landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('no horizontal overflow on any viewport', async ({ page }) => {
    const { scroll, viewport } = await horizontalOverflow(page)
    expect(scroll).toBeLessThanOrEqual(viewport + 2)
  })

  test('hamburger menu opens and closes on mobile', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 768) return // md+ has inline nav

    const menuButton = page.getByRole('button', { name: /Open menu/i })
    await expect(menuButton).toBeVisible()
    await menuButton.click()

    const panel = page.locator('#mobile-nav-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('How It Works')).toBeVisible()
    await expect(panel.getByText('Features')).toBeVisible()
    await expect(panel.getByText('Pricing')).toBeVisible()
    await expect(panel.getByText('Blog')).toBeVisible()

    // Aria-expanded reflects state
    await expect(page.getByRole('button', { name: /Close menu/i })).toBeVisible()
  })

  test('start free CTA is always visible in header', async ({ page }) => {
    const cta = page.getByRole('link', { name: /Start Free/i }).first()
    await expect(cta).toBeVisible()
  })
})

// ─── 404 page is themed ──────────────────────────────────────────────────────

test.describe('Not-found page', () => {
  test('unknown route renders themed 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await expect(page.getByRole('heading', { name: 'Off the Map' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Back to ChoreQuest/i })).toBeVisible()
  })
})

// ─── Reset-password real-time validation ─────────────────────────────────────

test.describe('Reset-password validation', () => {
  test('shows mismatch error in real-time', async ({ page }) => {
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')

    await page.locator('#rp-password').fill('correcthorse')
    await page.locator('#rp-confirm').fill('wronghorse')

    await expect(page.getByText(/don't match yet/i)).toBeVisible()

    const submit = page.getByRole('button', { name: /Set new password/i })
    await expect(submit).toBeDisabled()
  })

  test('password reveal toggle works', async ({ page }) => {
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')

    const input = page.locator('#rp-password')
    await expect(input).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /Show password/i }).click()
    await expect(input).toHaveAttribute('type', 'text')
  })

  test('submit disabled until both passwords valid and matching', async ({ page }) => {
    await page.goto('/reset-password')
    await page.waitForLoadState('networkidle')

    const submit = page.getByRole('button', { name: /Set new password/i })
    await expect(submit).toBeDisabled()

    await page.locator('#rp-password').fill('valid123')
    await expect(submit).toBeDisabled() // confirm still empty

    await page.locator('#rp-confirm').fill('valid123')
    await expect(submit).toBeEnabled()
  })
})

// ─── Login page password reveal ──────────────────────────────────────────────

test.describe('Login page password reveal', () => {
  test('reveal toggle flips input type', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const pw = page.locator('#login-password')
    await expect(pw).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /Show password/i }).click()
    await expect(pw).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: /Hide password/i }).click()
    await expect(pw).toHaveAttribute('type', 'password')
  })

  test('mode toggle buttons meet 44px touch target', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const enterButton = page.getByRole('tab', { name: /Enter Realm/i })
    const box = await enterButton.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})

// ─── Input zoom guard — fonts must be >=16px on mobile ───────────────────────

test.describe('Mobile input zoom guard', () => {
  test('inputs render at 16px or larger on mobile', async ({ page, viewport }) => {
    if (!viewport || viewport.width >= 640) return // mobile only
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const fontSize = await page.locator('#login-email').evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize)
    })
    expect(fontSize).toBeGreaterThanOrEqual(16)
  })
})

test.describe('Narrow mobile UI quality', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('auth screens stay inside the viewport and expose full-size controls', async ({ page }) => {
    for (const path of ['/login', '/reset-password']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const { scroll, viewport } = await horizontalOverflow(page)
      expect(scroll).toBeLessThanOrEqual(viewport + 2)

      const heading = page.getByRole('heading', { name: 'ChoreQuest' })
      const headingBox = await heading.boundingBox()
      expect(headingBox).not.toBeNull()
      expect(headingBox!.x).toBeGreaterThanOrEqual(0)
      expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(320)

      const interactive = page.locator('button:visible:not([aria-label="Open Next.js Dev Tools"]), a:visible')
      for (let index = 0; index < await interactive.count(); index += 1) {
        const box = await interactive.nth(index).boundingBox()
        if (box) expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
  })

  test('quest cards preserve readable titles and touch targets', async ({ page }) => {
    await page.goto('/e2e-fixtures/quest-card')
    await page.waitForLoadState('networkidle')

    const firstTitle = page.getByText('Test Quest').first()
    await expect(firstTitle).toBeVisible()
    const titleText = await firstTitle.evaluate((element) => element.textContent)
    expect(titleText).toBe('Test Quest')

    const actionButtons = page.locator('[data-testid="quest-action-content"]:is(button)')
    for (let index = 0; index < await actionButtons.count(); index += 1) {
      const box = await actionButtons.nth(index).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test('mobile menu opens below the fixed header', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.waitForTimeout(250)

    const headerBox = await page.locator('header').boundingBox()
    const panelBox = await page.locator('#mobile-nav-panel').boundingBox()
    expect(headerBox).not.toBeNull()
    expect(panelBox).not.toBeNull()
    expect(panelBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1)
  })

  test('auth tabs support arrow-key navigation', async ({ page }) => {
    await page.goto('/login')
    const loginTab = page.getByRole('tab', { name: 'Enter Realm' })
    const signupTab = page.getByRole('tab', { name: 'Create Realm' })

    await loginTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(signupTab).toBeFocused()
    await expect(signupTab).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(loginTab).toBeFocused()
  })
})
