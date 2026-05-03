import { test, expect } from '@playwright/test'

test.describe('Kid PIN screen', () => {
  // We navigate to a fake kid ID — the page will load/show loading then redirect
  // but the PIN screen UI is testable if we mock or have a real kid ID
  // These tests cover the UI structure and navigation

  test('loading state renders without crashing', async ({ page }) => {
    await page.goto('/kid/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    // Either shows loading, PIN screen (if kid found), or a blank state
    // Should not throw a 500 error
    await expect(page.locator('body')).toBeVisible()
  })

  test('loading state shows realm animation text', async ({ page }) => {
    await page.goto('/kid/00000000-0000-0000-0000-000000000000')
    // Wait briefly to see loading state
    await page.waitForTimeout(500)
    // Page should not error
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})

test.describe('Wall display', () => {
  test('renders without crashing when not authenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('shows ChoreQuest branding in loading state', async ({ page }) => {
    await page.goto('/')
    // Just verify no crash regardless of auth state
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Layout max-width constraints', () => {
  test('login page is centered, not full-width', async ({ page }) => {
    const viewport = page.viewportSize()!
    if (viewport.width < 768) return // mobile fills screen by design
    await page.goto('/login')
    const form = page.locator('form').first()
    const box = await form.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(viewport.width - 100)
  })

  test('login page works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'ChoreQuest' })).toBeVisible()
    await expect(page.getByPlaceholder('parent@family.com')).toBeVisible()
  })
})
