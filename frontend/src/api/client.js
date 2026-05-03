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

export const simulateSingpassLogin = () =>
  Promise.resolve({ data: { patient_id: 'P001', patient_name: 'Test Patient' } })
