import { test, expect } from '@playwright/test'
import { gotoChat, singpassLogin, PATIENT_P001 } from './helpers.js'

/**
 * REAL-BACKEND integration tests.
 *
 * Unlike the other specs, these do NOT call mockBackend(). The frontend's
 * `/api/**` calls flow through the Vite proxy to the real backend
 * (VITE_API_PROXY_TARGET, default http://localhost:8000).
 *
 * Requirements before running:
 *   1. Backend running on :8000 with the P001 seed data.
 *   2. Run only this group:  npx playwright test --grep @integration
 *
 * The default `npx playwright test` run skips these via --grep-invert in CI.
 */
test.describe('Real backend integration @integration', () => {
  // Fail fast with a clear message if the backend isn't up, instead of a
  // confusing timeout deep inside a UI assertion.
  test.beforeAll(async ({ request }) => {
    const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000'
    try {
      // Hit the seeded patient endpoint directly to confirm the backend answers.
      const res = await request.get(`${target}/api/patient/${PATIENT_P001.patient_id}`)
      test.skip(!res.ok(), `Backend at ${target} returned ${res.status()} for P001 — is it running and seeded?`)
    } catch (err) {
      test.skip(true, `Backend at ${target} is unreachable — start it before running @integration tests. (${err.message})`)
    }
  })

  test('General Enquiry returns a real bot reply', async ({ page }) => {
    await gotoChat(page)

    await page.getByRole('button', { name: 'General Enquiry' }).click()
    await expect(page.getByText(/general enquiries about the eye/i)).toBeVisible()

    const input = page.getByPlaceholder('Write your message')
    await input.fill('What is a cataract?')
    await input.press('Enter')

    // The user's message echoes immediately...
    await expect(page.getByText('What is a cataract?')).toBeVisible()

    // ...then the real backend answers. We can't assert exact text (the reply is
    // dynamic), so we wait for a new non-empty bot bubble to appear. The first
    // bot bubble is the "general enquiries about the eye" intro, so the real
    // reply is the 2nd (or later) bot-message.
    const replies = page.getByTestId('bot-message')
    await expect.poll(() => replies.count(), { timeout: 30_000 }).toBeGreaterThan(1)
    await expect(replies.last()).not.toHaveText('')
  })

  test('existing patient (P001) logs in via Singpass and is recognised', async ({ page }) => {
    await gotoChat(page)

    await page.getByRole('button', { name: 'View Post-IVT Advice Form' }).click()
    await expect(page.getByText(/To proceed with the checklist/i)).toBeVisible()

    await singpassLogin(page, PATIENT_P001.patient_id)

    // The real backend resolves P001 → "Tan Ah Kow".
    await expect(
      page.getByText(new RegExp(`Welcome back, ${PATIENT_P001.patient_name}`, 'i')),
    ).toBeVisible({ timeout: 30_000 })
  })
})
