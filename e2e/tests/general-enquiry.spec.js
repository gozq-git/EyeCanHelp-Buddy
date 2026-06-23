import { test, expect } from '@playwright/test'
import { gotoChat, mockBackend } from './helpers.js'

test.describe('General Enquiry flow', () => {
  test('asks a question and shows the mocked bot reply', async ({ page }) => {
    await mockBackend(page)
    await gotoChat(page)

    await page.getByRole('button', { name: 'General Enquiry' }).click()
    await expect(page.getByText(/general enquiries about the eye/i)).toBeVisible()

    const input = page.getByPlaceholder('Write your message')
    await input.fill('What is a cataract?')
    await input.press('Enter')

    await expect(page.getByText('What is a cataract?')).toBeVisible()
    await expect(page.getByText('A cataract is a clouding of the eye lens.')).toBeVisible()
  })

  test('shows an error bubble when the chat API fails', async ({ page }) => {
    await mockBackend(page, {
      chat: (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"boom"}' }),
    })
    await gotoChat(page)

    await page.getByRole('button', { name: 'General Enquiry' }).click()
    const input = page.getByPlaceholder('Write your message')
    await input.fill('Trigger an error')
    await input.press('Enter')

    await expect(page.getByText(/encountered an error/i)).toBeVisible()
  })
})
