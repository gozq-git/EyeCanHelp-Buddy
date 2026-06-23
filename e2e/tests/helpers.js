import { expect } from '@playwright/test'

// Canonical existing-patient fixtures (mirror the backend seed for P001).
export const PATIENT_P001 = {
  patient_id: 'P001',
  patient_name: 'Tan Ah Kow',
  patient_dob: '1952-08-12',
  phone_number: '+6591234567',
}

export const EPIC_RECORD_P001 = {
  patient_id: 'P001',
  record_name: 'Tan Ah Kow',
  record_diagnosis: 'H35.31',
  record_eyes: 'OD',
  record_medication: 'Faricimab (Vabysmo)',
  record_number_of_injections: 3,
  record_validity_of_consent: true,
  record_last3mths_admission: false,
  record_stroke_heartAtt_last6mths: false,
  record_taking_antibiotics: false,
  record_pregnant: false,
  record_id: 'REC-P001-001',
  issued: '2020-01-01T00:00:00',
}

const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/**
 * Stub every `/api/**` call the frontend can make. Pass overrides to change a
 * specific endpoint's behaviour (e.g. force /api/chat to fail).
 *
 * Each handler receives the Playwright `route` and must call route.fulfill/abort.
 */
export async function mockBackend(page, overrides = {}) {
  const handlers = {
    chat: (route) => route.fulfill(json({ reply: 'A cataract is a clouding of the eye lens.' })),
    patient: (route) => route.fulfill(json(PATIENT_P001)),
    epicRecord: (route) => route.fulfill(json(EPIC_RECORD_P001)),
    // No prior acknowledgement by default → 404 so the post-op merge is skipped.
    latestAck: (route) => route.fulfill(json({ detail: 'not found' }, 404)),
    submitAck: (route) => route.fulfill(json({
      record: { ...EPIC_RECORD_P001, issued: new Date().toISOString() },
      payment: { payment_estCostPerInjection: 123, payment_mode: 'Medisave' },
      message: 'Patient acknowledgement recorded successfully.',
    })),
    ...overrides,
  }

  await page.route('**/api/chat', handlers.chat)
  await page.route('**/api/acknowledgement/latest/**', handlers.latestAck)
  await page.route('**/api/acknowledgement', handlers.submitAck)
  await page.route('**/api/epic/patient/*/record', handlers.epicRecord)
  await page.route('**/api/patient/*', handlers.patient)
}

/** Boot the app: splash auto-advances (2s) → onboarding → chat with the quick-reply pills. */
export async function gotoChat(page) {
  await page.goto('/')
  const continueBtn = page.getByRole('button', { name: /Continue/ })
  await continueBtn.click({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'General Enquiry' })).toBeVisible()
}

/** Drive the real SingpassLoginButton: type the username, submit, wait for the 600ms timer. */
export async function singpassLogin(page, username = 'P001') {
  await page.getByPlaceholder('username').fill(username)
  await page.getByRole('button', { name: /Singpass Login/i }).click()
}
