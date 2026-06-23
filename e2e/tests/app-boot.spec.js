import { test, expect } from '@playwright/test'
import { gotoChat } from './helpers.js'

test.describe('App boot flow', () => {
  test('splash auto-advances to onboarding, Continue leads to the chat menu', async ({ page }) => {
    await page.goto('/')

    // Onboarding appears after the 2s splash timer.
    await expect(page.getByText(/You AI Assistant/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Continue/ }).click()

    // Chat screen shows the four quick-reply pills.
    await expect(page.getByRole('button', { name: 'General Enquiry' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fill up pre-procedure' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Fill up post-operation checklist' })).toBeVisible()
  })

  test('input shows the General Enquiry placeholder in welcome mode', async ({ page }) => {
    await gotoChat(page)
    await expect(page.getByPlaceholder('General Enquiry')).toBeVisible()
  })
})
