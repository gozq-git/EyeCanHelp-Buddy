import { test, expect } from '@playwright/test'
import { gotoChat, mockBackend, singpassLogin } from './helpers.js'

test.describe('Pre-procedure acknowledgement flow', () => {
  test('existing patient completes the form and sees the financial counselling doc', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'Fill up pre-procedure' }).click()
    await expect(page.getByText(/would you please sign in/i)).toBeVisible()

    await singpassLogin(page, 'P001')
    await expect(page.getByText(/Welcome back, Tan Ah Kow/i)).toBeVisible({ timeout: 10_000 })

    // ask_update → 3 questions → cost confirm → payment mode → submit
    await page.getByRole('button', { name: 'Yes' }).click()      // ask_update
    await page.getByRole('button', { name: 'No' }).click()       // q_admission
    await page.getByRole('button', { name: 'No' }).click()       // q_stroke
    await page.getByRole('button', { name: 'Right' }).click()    // q_eye → OD
    await page.getByRole('button', { name: 'Yes' }).click()                  // cost_confirm
    await page.getByRole('button', { name: 'Medisave', exact: true }).click() // payment_mode → submit

    await expect(page.getByText(/Financial Counselling & Advice/i)).toBeVisible({ timeout: 10_000 })
  })

  test('shows the Singpass login prompt with a username field before login', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'Fill up pre-procedure' }).click()
    await expect(page.getByRole('button', { name: /Singpass Login/i })).toBeVisible()
    await expect(page.getByPlaceholder('username')).toBeVisible()
  })
})
