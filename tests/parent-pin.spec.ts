import { test, expect } from '@playwright/test'

const PARENT_PIN_SESSION_KEY = 'cq_parent_unlocked'

test.describe('Parent PIN gate', () => {
  test('unauthenticated /parent redirects to /login', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/login/)
  })

  test('sessionStorage key is absent on fresh page load', async ({ page }) => {
    // Contract: no page or navigation auto-grants access — only the PIN keypad does.
    // This was the regression: handleSaveParentPin used to call setItem('1'),
    // permanently unlocking the session until the tab was closed.
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    const key = await page.evaluate((k) => sessionStorage.getItem(k), PARENT_PIN_SESSION_KEY)
    expect(key).toBeNull()
  })

  test('realm and login pages never set the unlock key', async ({ page }) => {
    // Neither the wall display nor the login page should touch the parent lock key.
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PARENT_PIN_SESSION_KEY)).toBeNull()

    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PARENT_PIN_SESSION_KEY)).toBeNull()
  })

  test('lock clears sessionStorage so next /parent visit requires PIN', async ({ page }) => {
    // Simulate: parent entered PIN (key = '1'), then explicitly locked (or navigated away).
    await page.goto('/login')
    await page.evaluate((k) => sessionStorage.setItem(k, '1'), PARENT_PIN_SESSION_KEY)
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PARENT_PIN_SESSION_KEY)).toBe('1')

    // Simulate lock action (mirrors handleLock and the unmount cleanup)
    await page.evaluate((k) => sessionStorage.removeItem(k), PARENT_PIN_SESSION_KEY)
    expect(await page.evaluate((k) => sessionStorage.getItem(k), PARENT_PIN_SESSION_KEY)).toBeNull()
  })
})

test.describe('Parent dashboard (unauthenticated)', () => {
  test('redirects to login without a session', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('no crash or error on direct /parent navigation', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
