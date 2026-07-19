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

export const assessSymptoms = (patientId, symptomDescription) =>
  api.post('/symptoms', { patient_id: patientId, symptom_description: symptomDescription })

export const sendChatMessage = (messages) =>
  api.post('/chat', { messages })

const parseSseFrame = (frame) => {
  const normalized = frame.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
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

export const sendChatMessageStream = async (messages, options = {}) => {
  const { onChunk, onHeartbeat, signal } = options
  const response = await fetch('/api/chat?stream=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ messages }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`Streaming request failed: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Unexpected streaming content-type: ${contentType || 'unknown'}`)
  }

  if (!response.body) {
    throw new Error('Streaming response body is unavailable')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    let boundary = findFrameBoundary(buffer)
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + frameSeparatorLength(buffer, boundary))
      const { event, data } = parseSseFrame(frame)

      if (event === 'done' || data === '[DONE]') {
        return fullText
      }

      if (event === 'error') {
        throw new Error(data || 'Streaming request failed')
      }

      if (event === 'heartbeat') {
        if (onHeartbeat) {
          onHeartbeat(data || 'ping')
        }
        boundary = findFrameBoundary(buffer)
        continue
      }

      if (data) {
        fullText += data
        if (onChunk) {
          onChunk(data)
        }
      }

      boundary = findFrameBoundary(buffer)
    }
  }

  return fullText
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
