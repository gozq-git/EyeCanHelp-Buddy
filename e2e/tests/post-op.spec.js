import { test, expect } from '@playwright/test'
import { gotoChat, mockBackend, singpassLogin } from './helpers.js'

test.describe('Post-operation checklist flow', () => {
  test('existing patient logs in and sees the post-op checklist document', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'View Post-IVT Advice Form' }).first().click()
    await expect(page.getByText(/To proceed with the checklist/i)).toBeVisible()

    await singpassLogin(page, 'P001')

    await expect(page.getByText(/Welcome back, Tan Ah Kow/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Post Intravitreal Injection/i)).toBeVisible()
  })

  test('single login is reused for post-op and appointment after returning to menu', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'View Post-IVT Advice Form' }).click()
    await singpassLogin(page, 'P001')
    await expect(page.getByText(/Welcome back, Tan Ah Kow/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Post Intravitreal Injection/i)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Return Menu' }).first().click()

    await page.getByRole('button', { name: 'Book Appointment' }).first().click()
    await expect(page.getByLabel('Preferred day')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Return Menu' }).first().click()

    await page.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' }).first().click()
    await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'No', exact: true })).toBeVisible({ timeout: 10_000 })
  })
})
