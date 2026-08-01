import { test, expect } from '@playwright/test'

/**
 * Structural E2E tests for the quest model that don't require authentication.
 * Authenticated flows (claim race, approval, undo) require a test family seeded
 * in Supabase — these tests verify public/loading-state behavior and auth gates.
 */

test.describe('Quest board — unauthenticated gates', () => {
  test('kid page with unknown UUID loads without crashing', async ({ page }) => {
    await page.route('**/api/kid/*/profile', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Kid not found"}' }),
    )
    await page.goto('/kid/00000000-0000-0000-0000-000000000001')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('parent page requires auth', async ({ page }) => {
    await page.goto('/parent')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })

  test('wall display loads without crashing', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})

test.describe('Complete API — kid-session authorization', () => {
  test('POST /api/kid/:id/complete rejects an unauthenticated bad-body request', async ({ request }) => {
    const res = await request.post('/api/kid/00000000-0000-0000-0000-000000000001/complete', {
      data: {},
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/kid/:id/complete does not disclose whether an unauthenticated kid exists', async ({ request }) => {
    const res = await request.post('/api/kid/00000000-0000-0000-0000-000000000001/complete', {
      data: { quest_id: '00000000-0000-0000-0000-000000000099', date: '2025-01-01' },
    })
    expect(res.status()).toBe(401)
  })

  test('DELETE /api/kid/:id/complete/:completionId rejects an unauthenticated request', async ({ request }) => {
    const res = await request.delete(
      '/api/kid/00000000-0000-0000-0000-000000000001/complete/00000000-0000-0000-0000-000000000099',
    )
    expect(res.status()).toBe(401)
  })
})

test.describe('Join page', () => {
  test('unknown invite token shows not-found state without crashing', async ({ page }) => {
    await page.goto('/join/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
