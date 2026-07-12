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
  sendChatMessageStream,
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

  it('streams SSE chat chunks and returns the accumulated text', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      'data: hello\n\n',
      'data: world\n\n',
      'event: done\ndata: [DONE]\n\n',
    ]
    const mockRead = vi.fn()
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[0]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[1]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[2]) })
      .mockResolvedValueOnce({ done: true, value: undefined })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => ({ read: mockRead }) },
    })

    const originalFetch = global.fetch
    global.fetch = fetchMock
    const seen = []

    try {
      const result = await sendChatMessageStream([{ role: 'user', content: 'hi' }], {
        onChunk: (chunk) => seen.push(chunk),
      })

      expect(fetchMock).toHaveBeenCalled()
      expect(seen).toEqual(['hello', 'world'])
      expect(result).toBe('helloworld')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('parses CRLF-delimited SSE frames', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      'data: hello\r\n\r\n',
      'data: world\r\n\r\n',
      'event: done\r\ndata: [DONE]\r\n\r\n',
    ]
    const mockRead = vi.fn()
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[0]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[1]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[2]) })
      .mockResolvedValueOnce({ done: true, value: undefined })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => ({ read: mockRead }) },
    })

    const originalFetch = global.fetch
    global.fetch = fetchMock
    const seen = []

    try {
      const result = await sendChatMessageStream([{ role: 'user', content: 'hi' }], {
        onChunk: (chunk) => seen.push(chunk),
      })

      expect(seen).toEqual(['hello', 'world'])
      expect(result).toBe('helloworld')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('surfaces heartbeat events without appending heartbeat payload to chat text', async () => {
    const encoder = new TextEncoder()
    const chunks = [
      'event: heartbeat\ndata: ping\n\n',
      'data: hello\n\n',
      'event: heartbeat\ndata: ping\n\n',
      'data: world\n\n',
      'event: done\ndata: [DONE]\n\n',
    ]
    const mockRead = vi.fn()
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[0]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[1]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[2]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[3]) })
      .mockResolvedValueOnce({ done: false, value: encoder.encode(chunks[4]) })
      .mockResolvedValueOnce({ done: true, value: undefined })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => ({ read: mockRead }) },
    })

    const originalFetch = global.fetch
    global.fetch = fetchMock
    const seenChunks = []
    const seenHeartbeat = []

    try {
      const result = await sendChatMessageStream([{ role: 'user', content: 'hi' }], {
        onChunk: (chunk) => seenChunks.push(chunk),
        onHeartbeat: (heartbeat) => seenHeartbeat.push(heartbeat),
      })

      expect(seenHeartbeat).toEqual(['ping', 'ping'])
      expect(seenChunks).toEqual(['hello', 'world'])
      expect(result).toBe('helloworld')
    } finally {
      global.fetch = originalFetch
    }
  })
})
