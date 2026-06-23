import { test, expect } from '@playwright/test'
import { gotoChat, mockBackend, singpassLogin } from './helpers.js'

test.describe('Post-operation checklist flow', () => {
  test('existing patient logs in and sees the post-op checklist document', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'Fill up post-operation checklist' }).click()
    await expect(page.getByText(/To proceed with the checklist/i)).toBeVisible()

    await singpassLogin(page, 'P001')

    await expect(page.getByText(/Welcome back, Tan Ah Kow/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Post Intravitreal Injection/i)).toBeVisible()
  })
})
