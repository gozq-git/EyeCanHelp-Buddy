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
  calculateBill,
  enqueueAppointmentNotification,
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
    sendChatMessage([{ role: 'user', content: 'hi' }])
    createPatient({ patient_id: 'P003' })
    enqueueAppointmentNotification({ patient_id: 'P001' })

    expect(mocks.mockPost).toHaveBeenCalledWith('/acknowledgement', { hello: 'world' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/chat', {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(mocks.mockPost).toHaveBeenCalledWith('/patient', { patient_id: 'P003' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/notifications/appointments', { patient_id: 'P001' })
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

  it('surfaces backend detail message for non-OK stream responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Please remove sensitive medical details.' }),
    })

    const originalFetch = global.fetch
    global.fetch = fetchMock

    try {
      await expect(sendChatMessageStream([{ role: 'user', content: 'hi' }]))
        .rejects.toMatchObject({ message: 'Please remove sensitive medical details.', status: 400 })
    } finally {
      global.fetch = originalFetch
    }
  })

  it('maps calculateBill arguments onto the snake_case billing payload', () => {
    calculateBill({ recordClass: 'PTE', performer: 'Doctor', injections: 2 })

    expect(mocks.mockPost).toHaveBeenCalledWith('/billing/calculate', {
      record_class: 'PTE',
      performer: 'Doctor',
      injections: 2,
    })
  })
})

// ─── Streaming edge cases ─────────────────────────────────────────────────────

// sendChatMessageStream hand-rolls SSE framing and error extraction, so each
// branch is driven directly here rather than through the chat UI.

describe('sendChatMessageStream — framing and error handling', () => {
  const send = () => sendChatMessageStream([{ role: 'user', content: 'hi' }])

  // Feeds the given raw SSE strings as successive reader chunks, then ends.
  const readerFrom = (frames) => {
    const encoder = new TextEncoder()
    const read = vi.fn()
    frames.forEach((f) => read.mockResolvedValueOnce({ done: false, value: encoder.encode(f) }))
    read.mockResolvedValue({ done: true, value: undefined })
    return { read }
  }

  const okStream = (frames) => vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'text/event-stream' },
    body: { getReader: () => readerFrom(frames) },
  })

  const withFetch = async (impl, fn) => {
    const originalFetch = global.fetch
    global.fetch = impl
    try {
      return await fn()
    } finally {
      global.fetch = originalFetch
    }
  }

  it('picks the earliest boundary when a chunk mixes LF and CRLF frames', async () => {
    // One chunk holding an LF-terminated frame followed by a CRLF-terminated one.
    const fetchMock = okStream(['data: a\n\ndata: b\r\n\r\nevent: done\ndata: [DONE]\n\n'])

    await withFetch(fetchMock, async () => {
      await expect(send()).resolves.toBe('ab')
    })
  })

  it('returns the accumulated text when the stream ends without a done event', async () => {
    const fetchMock = okStream(['data: partial\n\n'])

    await withFetch(fetchMock, async () => {
      await expect(send()).resolves.toBe('partial')
    })
  })

  it('throws the payload of an error event', async () => {
    const fetchMock = okStream(['event: error\ndata: coordinator unavailable\n\n'])

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow('coordinator unavailable')
    })
  })

  it('throws a default message for an error event with no payload', async () => {
    const fetchMock = okStream(['event: error\ndata: \n\n'])

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow('Streaming request failed')
    })
  })

  it('rejects an unexpected content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      body: { getReader: () => readerFrom([]) },
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow(/Unexpected streaming content-type: application\/json/)
    })
  })

  it('rejects a missing content-type as unknown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: { getReader: () => readerFrom([]) },
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow(/Unexpected streaming content-type: unknown/)
    })
  })

  it('rejects when the response has no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: null,
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow('Streaming response body is unavailable')
    })
  })

  // ── error-payload extraction, in the priority order buildErrorMessageFromPayload uses
  const jsonError = (payload) => vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  })

  it('uses a JSON "message" field when detail is absent', async () => {
    await withFetch(jsonError({ message: 'guardrail offline' }), async () => {
      await expect(send()).rejects.toMatchObject({ message: 'guardrail offline', status: 503 })
    })
  })

  it('uses a JSON "error" field when detail and message are absent', async () => {
    await withFetch(jsonError({ error: 'upstream refused' }), async () => {
      await expect(send()).rejects.toThrow('upstream refused')
    })
  })

  it('uses a bare JSON string payload', async () => {
    await withFetch(jsonError('  plain string failure  '), async () => {
      await expect(send()).rejects.toThrow('plain string failure')
    })
  })

  it('falls back to the status line when the JSON payload is unusable', async () => {
    // Empty object and null both yield no message, so the status line is used.
    await withFetch(jsonError({}), async () => {
      await expect(send()).rejects.toThrow('Streaming request failed: 503')
    })
    await withFetch(jsonError(null), async () => {
      await expect(send()).rejects.toThrow('Streaming request failed: 503')
    })
  })

  it('parses a JSON error body served with a non-JSON content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => '{"detail":"masked upstream error"}',
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow('masked upstream error')
    })
  })

  it('uses raw text when a non-JSON error body will not parse', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => 'text/plain' },
      text: async () => '  Bad Gateway  ',
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toMatchObject({ message: 'Bad Gateway', status: 502 })
    })
  })

  it('falls back to the status line when the error body cannot be read', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => { throw new Error('socket closed') },
    })

    await withFetch(fetchMock, async () => {
      await expect(send()).rejects.toThrow('Streaming request failed: 500')
    })
  })
})
