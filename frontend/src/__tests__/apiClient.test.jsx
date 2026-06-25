import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mocks.mockGet,
      post: mocks.mockPost,
    })),
  },
}))

import {
  assessSymptoms,
  createPatient,
  getEpicPatient,
  getEpicRecord,
  getLatestAcknowledgement,
  getPatient,
  sendChatMessage,
  simulateSingpassLogin,
  submitAcknowledgement,
} from '../api/client'

describe('api client', () => {
  beforeEach(() => {
    mocks.mockGet.mockReset()
    mocks.mockPost.mockReset()
  })

  it('calls expected GET endpoints', () => {
    getEpicPatient('P001')
    getEpicRecord('P001')
    getPatient('P001')
    getLatestAcknowledgement('P001')

    expect(mocks.mockGet).toHaveBeenCalledWith('/epic/patient/P001')
    expect(mocks.mockGet).toHaveBeenCalledWith('/epic/patient/P001/record')
    expect(mocks.mockGet).toHaveBeenCalledWith('/patient/P001')
    expect(mocks.mockGet).toHaveBeenCalledWith('/acknowledgement/latest/P001')
  })

  it('calls expected POST endpoints and payloads', () => {
    submitAcknowledgement({ hello: 'world' })
    assessSymptoms('P001', 'watery eyes')
    sendChatMessage([{ role: 'user', content: 'hi' }])
    createPatient({ patient_id: 'P003' })

    expect(mocks.mockPost).toHaveBeenCalledWith('/acknowledgement', { hello: 'world' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/symptoms', {
      patient_id: 'P001',
      symptom_description: 'watery eyes',
    })
    expect(mocks.mockPost).toHaveBeenCalledWith('/chat', {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(mocks.mockPost).toHaveBeenCalledWith('/patient', { patient_id: 'P003' })
  })

  it('returns a resolved mock singpass login payload', async () => {
    await expect(simulateSingpassLogin()).resolves.toEqual({
      data: { patient_id: 'P001', patient_name: 'Test Patient' },
    })
  })
})
