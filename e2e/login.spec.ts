import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
      }),
    )
    await page.goto('/login')
  })

  test('renders the ChoreQuest branding', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ChoreQuest' })).toBeVisible()
    await expect(page.getByText('The Family Realm', { exact: true })).toBeVisible()
  })

  test('shows login mode by default', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Enter Realm' })).toBeVisible()
    await expect(page.getByPlaceholder('parent@family.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('toggles to sign-up mode', async ({ page }) => {
    await page.getByRole('tab', { name: 'Create Realm' }).click()
    await expect(page.getByRole('button', { name: /Create My Realm/i })).toBeVisible()
  })

  test('toggles back to login mode', async ({ page }) => {
    await page.getByRole('tab', { name: 'Create Realm' }).click()
    await page.getByRole('tab', { name: 'Enter Realm' }).click()
    await expect(page.getByRole('button', { name: /Enter the Realm/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    // Prove React hydration is complete before filling controlled inputs. Under
    // a fully parallel run, typing before hydration can be replaced by the
    // component's initial empty state.
    await page.getByRole('tab', { name: 'Create Realm' }).click()
    await expect(page.getByRole('button', { name: /Create My Realm/i })).toBeVisible()
    await page.getByRole('tab', { name: 'Enter Realm' }).click()
    await expect(page.getByRole('button', { name: /Enter the Realm/i })).toBeVisible()

    const email = page.locator('#login-email')
    const password = page.locator('#login-password')
    await email.fill('bad@example.com')
    await password.fill('wrongpassword')
    await expect(email).toHaveValue('bad@example.com')
    await expect(password).toHaveValue('wrongpassword')
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit())
    await expect(page.getByText(/Wrong credentials/i)).toBeVisible({ timeout: 15000 })
  })

  test('validates password minimum length in signup', async ({ page }) => {
    await page.getByRole('tab', { name: 'Create Realm' }).click()
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', '123')
    // Browser native validation prevents submit for minLength=6
    const submitBtn = page.getByRole('button', { name: /Create My Realm/i })
    await submitBtn.click()
    await expect(page.locator('input[type="password"]')).toHaveJSProperty('validity.tooShort', true)
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

test.describe('Login → routing', () => {
  test('unauthenticated marketing root remains available', async ({ page }) => {
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
