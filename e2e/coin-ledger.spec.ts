import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/e2e-fixtures/coin-ledger')
})

test('shows pending activity separately from posted transactions', async ({ page }) => {
  await expect(page.getByText('Current balance')).toBeVisible()
  await expect(page.getByText('85 🪙')).toBeVisible()
  await expect(page.getByText('Available to spend')).toBeVisible()
  await expect(page.getByText('55 🪙')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pending activity' })).toBeVisible()
  await expect(page.getByText('Extra game time')).toBeVisible()
  await expect(page.getByText('Fold the laundry')).toBeVisible()
  await expect(page.getByText('30 reserved', { exact: true })).toBeVisible()
})

test('shows the resulting balance after every posted transaction', async ({ page }) => {
  const posted = page.getByRole('region', { name: 'Posted activity' })
  await expect(posted.getByText('Balance after: 85')).toBeVisible()
  await expect(posted.getByText('Balance after: 65')).toBeVisible()
  await expect(posted.getByText('Balance after: 90')).toBeVisible()
  await expect(posted.getByText('Balance after: 75')).toBeVisible()
  await expect(posted.getByText('Imported history · reconstructed balance')).toBeVisible()
})

test('filters earned, spent, and adjusted activity', async ({ page }) => {
  for (const name of ['All', 'Earned', 'Spent', 'Adjustments']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }

  await page.getByRole('button', { name: 'Spent' }).click()
  await expect(page.getByText('Movie night')).toBeVisible()
  await expect(page.getByText('Extra game time')).toBeVisible()
  await expect(page.getByText('Clean the kitchen')).toBeHidden()

  await page.getByRole('button', { name: 'Adjustments' }).click()
  await expect(page.getByText('Birthday bonus')).toBeVisible()
  await expect(page.getByText('Imported opening balance')).toBeVisible()
  await expect(page.getByText('Movie night')).toBeHidden()
})
