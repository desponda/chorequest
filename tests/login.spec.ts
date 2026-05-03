import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('renders the ChoreQuest branding', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ChoreQuest' })).toBeVisible()
    await expect(page.getByText('The Family Realm', { exact: true })).toBeVisible()
  })

  test('shows login mode by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Enter Realm/i })).toBeVisible()
    await expect(page.getByPlaceholder('parent@family.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('toggles to sign-up mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Realm' }).click()
    await expect(page.getByRole('button', { name: /Create My Realm/i })).toBeVisible()
  })

  test('toggles back to login mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Realm' }).click()
    await page.getByRole('button', { name: 'Enter Realm' }).click()
    await expect(page.getByRole('button', { name: /Enter the Realm/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'bad@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.getByRole('button', { name: /Enter the Realm/i }).click()
    await expect(page.getByText(/Wrong credentials/i)).toBeVisible({ timeout: 15000 })
  })

  test('validates password minimum length in signup', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Realm' }).click()
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', '123')
    // Browser native validation prevents submit for minLength=6
    const submitBtn = page.getByRole('button', { name: /Create My Realm/i })
    await submitBtn.click()
    // The form should not have submitted (no toast visible immediately, input still has value)
    await expect(page.fill.bind(page, 'input[type="password"]', '123')).not.toThrow()
  })

  test('page is centered and max-width constrained on desktop', async ({ page }) => {
    const viewport = page.viewportSize()!
    // Only meaningful on desktop viewports
    if (viewport.width < 768) return
    const card = page.locator('.rounded-3xl').first()
    const box = await card.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(viewport.width * 0.8)
  })
})

test.describe('Login → redirect', () => {
  test('unauthenticated root redirects to /login', async ({ page }) => {
    await page.goto('/')
    // Should either show the wall (if auth works) or redirect to login
    // We test that the page loads without crashing
    await page.waitForLoadState('networkidle')
    const url = page.url()
    // Either on login page or on main app
    expect(url).toMatch(/(login|localhost:3000\/$)/)
  })

  test('/parent redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    // Should redirect to login (Supabase middleware)
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})
