import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const getEpicPatient = (patientId) =>
  api.get(`/epic/patient/${patientId}`)

export const getEpicRecord = (patientId) =>
  api.get(`/epic/patient/${patientId}/record`)

export const submitAcknowledgement = (data) =>
  api.post('/acknowledgement', data)

export const sendChatMessage = (messages, options = {}) => {
  const payload = {
    messages,
    ...(options.sessionId ? { session_id: options.sessionId } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.language ? { language: options.language } : {}),
    ...(options.patientId ? { patient_id: options.patientId } : {}),
  }
  return api.post('/chat', payload)
}

const parseSseFrame = (frame) => {
  const normalized = frame.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalized.split('\n')
  let event = 'message'
  const data = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message'
    } else if (line.startsWith('data:')) {
      const value = line[5] === ' ' ? line.slice(6) : line.slice(5)
      data.push(value)
    }
  }

  return { event, data: data.join('\n') }
}

const findFrameBoundary = (buffer) => {
  const lfBoundary = buffer.indexOf('\n\n')
  const crlfBoundary = buffer.indexOf('\r\n\r\n')

  if (lfBoundary === -1) return crlfBoundary
  if (crlfBoundary === -1) return lfBoundary
  return Math.min(lfBoundary, crlfBoundary)
}

const frameSeparatorLength = (buffer, boundary) =>
  buffer.startsWith('\r\n\r\n', boundary) ? 4 : 2

const buildErrorMessageFromPayload = (payload) => {
  if (!payload) return ''
  if (typeof payload === 'string') {
    return payload.trim()
  }
  if (typeof payload === 'object') {
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim()
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
  }
  return ''
}

const buildStreamPayload = (messages, { sessionId, mode, language, patientId }) => ({
  messages,
  ...(sessionId ? { session_id: sessionId } : {}),
  ...(mode ? { mode } : {}),
  ...(language ? { language } : {}),
  ...(patientId ? { patient_id: patientId } : {}),
})

// Best effort: a failed stream may answer with JSON, with JSON mislabelled as text, or
// with nothing usable at all. Every parse failure degrades to '' so the caller can fall
// back to the status code rather than surfacing a parser error.
const readErrorMessage = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      return buildErrorMessageFromPayload(await response.json())
    }
    const text = await response.text()
    try {
      return buildErrorMessageFromPayload(JSON.parse(text)) || text.trim()
    } catch {
      return text.trim()
    }
  } catch {
    return ''
  }
}

// Throws unless the response is a readable event stream. Splitting the three guards out
// of the transport keeps sendChatMessageStream flat (Sonar javascript:S3776).
const assertStreamable = async (response) => {
  if (!response.ok) {
    const message = await readErrorMessage(response)
    const error = new Error(message || `Streaming request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Unexpected streaming content-type: ${contentType || 'unknown'}`)
  }
  if (!response.body) {
    throw new Error('Streaming response body is unavailable')
  }
}

// One frame in, one decision out: `done` ends the stream, `text` is appended to the
// running transcript. Heartbeats and empty data frames contribute no text.
const handleStreamFrame = ({ event, data }, { onChunk, onHeartbeat }) => {
  if (event === 'done' || data === '[DONE]') {
    return { done: true, text: '' }
  }
  if (event === 'error') {
    throw new Error(data || 'Streaming request failed')
  }
  if (event === 'heartbeat') {
    onHeartbeat?.(data || 'ping')
    return { done: false, text: '' }
  }
  if (data) {
    onChunk?.(data)
    return { done: false, text: data }
  }
  return { done: false, text: '' }
}

const consumeSseStream = async (response, { onChunk, onHeartbeat }) => {
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) {
      return fullText
    }

    buffer += decoder.decode(value, { stream: true })
    let boundary = findFrameBoundary(buffer)
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + frameSeparatorLength(buffer, boundary))
      const { done: finished, text } = handleStreamFrame(parseSseFrame(frame), { onChunk, onHeartbeat })
      fullText += text
      if (finished) {
        return fullText
      }
      boundary = findFrameBoundary(buffer)
    }
  }
}

export const sendChatMessageStream = async (messages, options = {}) => {
  const response = await fetch('/api/chat?stream=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(buildStreamPayload(messages, options)),
    signal: options.signal,
  })

  await assertStreamable(response)
  return consumeSseStream(response, options)
}

export const simulateSingpassLogin = () =>
  Promise.resolve({ data: { patient_id: 'P001', patient_name: 'Test Patient' } })

export const getPatient = (patientId) =>
  api.get(`/patient/${patientId}`)

export const createPatient = (data) =>
  api.post('/patient', data)

export const getLatestAcknowledgement = (patientId) =>
  api.get(`/acknowledgement/latest/${patientId}`)

export const calculateBill = ({ recordClass, performer, injections }) =>
  api.post('/billing/calculate', {
    record_class: recordClass,
    performer,
    injections,
  })

export const enqueueAppointmentNotification = (data) =>
  api.post('/notifications/appointments', data)
