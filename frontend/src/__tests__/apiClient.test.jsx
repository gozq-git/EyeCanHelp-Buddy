import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
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
    mockGet.mockReset()
    mockPost.mockReset()
  })

  it('calls expected GET endpoints', () => {
    getEpicPatient('P001')
    getEpicRecord('P001')
    getPatient('P001')
    getLatestAcknowledgement('P001')

    expect(mockGet).toHaveBeenCalledWith('/epic/patient/P001')
    expect(mockGet).toHaveBeenCalledWith('/epic/patient/P001/record')
    expect(mockGet).toHaveBeenCalledWith('/patient/P001')
    expect(mockGet).toHaveBeenCalledWith('/acknowledgement/latest/P001')
  })

  it('calls expected POST endpoints and payloads', () => {
    submitAcknowledgement({ hello: 'world' })
    assessSymptoms('P001', 'watery eyes')
    sendChatMessage([{ role: 'user', content: 'hi' }])
    createPatient({ patient_id: 'P003' })

    expect(mockPost).toHaveBeenCalledWith('/acknowledgement', { hello: 'world' })
    expect(mockPost).toHaveBeenCalledWith('/symptoms', {
      patient_id: 'P001',
      symptom_description: 'watery eyes',
    })
    expect(mockPost).toHaveBeenCalledWith('/chat', {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(mockPost).toHaveBeenCalledWith('/patient', { patient_id: 'P003' })
  })

  it('returns a resolved mock singpass login payload', async () => {
    await expect(simulateSingpassLogin()).resolves.toEqual({
      data: { patient_id: 'P001', patient_name: 'Test Patient' },
    })
  })
})
