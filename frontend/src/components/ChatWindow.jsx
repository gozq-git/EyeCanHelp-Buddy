import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import EyeLogoSVG from './EyeLogoSVG'
import { sendChatMessage, sendChatMessageStream, submitAcknowledgement, getEpicRecord, getPatient, createPatient, getLatestAcknowledgement, calculateBill, enqueueAppointmentNotification } from '../api/client'
import { formatCopy, getCopy, PAYMENT_OPTIONS } from '../i18n/nonGeneralCopy'
import { maskSensitiveText } from '../utils/sensitiveMasking'

let _msgId = 1
const nextId = () => ++_msgId

const INIT_FORM = { last3mths_admission: false, stroke_heartAtt_last6mths: false, taking_antibiotics: false, pregnant: false, record_eyes: 'OD', record_number_of_injections: 1, record_class: '', record_performer: 'Nurse', estimated_cost: null, estimated_cost_min: null, estimated_cost_max: null, estimated_cost_range: '', max_medisave_claimable: null, payment_mode: 'Medisave (Self)' }
const INIT_MESSAGES = [{ id: 1, role: 'bot', type: 'welcome', content: '' }]

// Three of the pre-procedure history questions are structurally identical: validate a
// yes/no, store it, ask the next one. They share a single handler driven by this table
// instead of three near-copies in one long else-if chain (Sonar javascript:S3776).
// q_pregnant is deliberately absent — it also renders the completed form.
const SIMPLE_YESNO_STEPS = {
  q_stroke: { field: 'stroke_heartAtt_last6mths', question: 'qStroke', nextQuestion: 'qAdmission', nextStep: 'q_admission' },
  q_admission: { field: 'last3mths_admission', question: 'qAdmission', nextQuestion: 'qAntibiotics', nextStep: 'q_antibiotics' },
  q_antibiotics: { field: 'taking_antibiotics', question: 'qAntibiotics', nextQuestion: 'qPregnant', nextStep: 'q_pregnant' },
}

// Pre-procedure steps answered with Yes/No, so the quick-reply chips are shown.
const YESNO_STEPS = new Set([
  'ask_update', 'q_stroke', 'q_admission', 'q_antibiotics', 'q_pregnant',
  'q_financial_counselling', 'cost_confirm',
])

// Pre-procedure offers Return Menu at every step so the user is never stuck mid-form.
// Enumerating steps meant each new one had to remember to opt in, and it silently
// skipped the registration questions (name/DOB/phone), which run while preProcStep
// is still 'login'.
const shouldShowReturnMenu = (mode, postOpStep) =>
  mode === 'general_enquiry'
  || mode === 'appointment'
  || mode === 'pre_procedure'
  || (mode === 'post_operation' && postOpStep === 'complete')

// A pending registration question always keeps the input live; otherwise the mode
// decides. Written as guards rather than one boolean expression so the component body
// stays clear of it (Sonar javascript:S3776) — `mode` can only match one branch, which
// is why the flat `||` chain this replaces was equivalent.
const isInputDisabled = ({ regStep, mode, preProcStep, postOpStep }) => {
  if (regStep) return false
  if (mode === 'pre_procedure') return preProcStep === 'login' || preProcStep === 'complete'
  if (mode === 'post_operation') return postOpStep === 'login' || postOpStep === 'complete'
  return mode === 'appointment'
}

function formatRangeWithCurrency(rangeText) {
  const raw = String(rangeText || '').trim()
  if (!raw.includes('-')) {
    const value = raw.replace(/^\$/, '')
    return `$${value}`
  }
  const [minPart, maxPart] = raw.split('-').map(v => v.trim().replace(/^\$/, ''))
  return `$${minPart} - $${maxPart}`
}

function buildPayload(answers, epicRecord) {
  const patientId = epicRecord?.patient_id || 'UNKNOWN'
  const patientName = epicRecord?.record_name || 'Unknown Patient'
  const diagnosis = epicRecord?.record_diagnosis || 'H35.31'
  return {
    patient_record: {
      patient_id: patientId,
      record_name: patientName,
      record_diagnosis: diagnosis,
      record_eyes: answers.record_eyes,
      record_number_of_injections: answers.record_number_of_injections || epicRecord?.record_number_of_injections || 1,
      record_validity_of_consent: true,
      record_last3mths_admission: answers.last3mths_admission,
      record_stroke_heartAtt_last6mths: answers.stroke_heartAtt_last6mths,
      record_taking_antibiotics: answers.taking_antibiotics,
      record_pregnant: answers.pregnant,
      record_class: answers.record_class || null,
      record_performer: answers.record_performer || null,
    },
    payment: {
      payment_id: `PAY-${patientId}-${Date.now()}`,
      payment_name: patientName,
      payment_diagnosis: diagnosis,
      payment_maxMedisave: Number(answers.max_medisave_claimable ?? 0),
      payment_estCostPerInjection: Number(answers.estimated_cost_max ?? answers.estimated_cost ?? 0),
      payment_mode: answers.payment_mode || 'Medisave (Self)',
    },
  }
}

// Shapes the four acknowledgement-form answers for AcknowledgementDoc. Accepts the raw
// booleans so it works from both live formAnswers and a saved (record_-prefixed) record.
function buildAckFormData({ patientName, nric, dateIso, strokeHeartAtt, hospitalised, antibiotics, pregnant }) {
  return {
    patientName: patientName || '',
    nric: nric || '',
    date: formatDate(dateIso),
    strokeHeartAtt: !!strokeHeartAtt,
    hospitalised: !!hospitalised,
    antibiotics: !!antibiotics,
    pregnant: !!pregnant,
  }
}

function formatDate(iso) {
  try {
    const parsed = new Date(iso)
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
}

const DEFAULT_CHAT_ERROR_MESSAGE = 'Sorry, I encountered an error. Please try again.'

const extractApiErrorMessage = (error, fallback = DEFAULT_CHAT_ERROR_MESSAGE) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim()
  }

  const message = error?.message
  if (typeof message === 'string' && message.trim()) {
    const trimmed = message.trim()
    // Keep status-only transport messages out of chat bubbles.
    if (!/^Streaming request failed:\s*\d+$/.test(trimmed)) {
      return trimmed
    }
  }

  return fallback
}

const chipBtn = {
  padding: '8px 20px',
  borderRadius: '20px',
  background: '#F0F0F0',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#333',
  fontFamily: 'inherit',
}

export default function ChatWindow({ onBack, language = 'en' }) {
  const [mode, setMode] = useState('welcome')
  const [preProcStep, setPreProcStep] = useState('login')
  const [postOpStep, setPostOpStep] = useState('login')
  const [formAnswers, setFormAnswers] = useState(INIT_FORM)
  const [epicRecord, setEpicRecord] = useState(null)
  const [currentPatientId, setCurrentPatientId] = useState(null)
  const [regStep, setRegStep] = useState(null)   // 'name' | 'dob' | 'phone'
  const [regData, setRegData] = useState({ patient_id: '', patient_name: '', patient_dob: '', phone_number: '' })
  const [messages, setMessages] = useState(INIT_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamHeartbeatCount, setStreamHeartbeatCount] = useState(0)
  const [showThinkingBubble, setShowThinkingBubble] = useState(false)
  const bottomRef = useRef(null)
  const topRef = useRef(null)
  const streamAbortRef = useRef(null)
  // crypto.randomUUID() rather than Math.random(): this id is sent to the backend as
  // sessionId, so it identifies a conversation and must not be guessable (Sonar
  // javascript:S2245). Available in any secure context — CloudFront serves the app over
  // HTTPS and dev runs on localhost. The timestamp stays for readability in logs.
  const generalEnquirySessionIdRef = useRef(`ge-${Date.now()}-${crypto.randomUUID()}`)
  const tr = getCopy(language)
  const paymentOptionsLocalized = PAYMENT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label[language] || option.label.en,
  }))

  const normalizeInput = (value) => {
    const text = String(value || '').trim()
    if (!text) return text
    const lower = text.toLowerCase()
    const localizedPairs = [
      [tr('yes').toLowerCase(), 'Yes'],
      [tr('no').toLowerCase(), 'No'],
      [tr('private').toLowerCase(), 'Private'],
      [tr('subsidised').toLowerCase(), 'Subsidised'],
      [tr('doctor').toLowerCase(), 'Doctor'],
      [tr('nurse').toLowerCase(), 'Nurse'],
      [tr('right').toLowerCase(), 'Right'],
      [tr('left').toLowerCase(), 'Left'],
    ]

    for (const option of paymentOptionsLocalized) {
      localizedPairs.push([option.label.toLowerCase(), option.value])
    }

    for (const [label, canonical] of localizedPairs) {
      if (lower === label) return canonical
    }
    return text
  }

  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [messages])

  useEffect(() => () => {
    streamAbortRef.current?.abort()
  }, [])

  const addMsg = (msg) => {
    const id = nextId()
    setMessages(prev => [...prev, { id, ...msg }])
    return id
  }
  const updateMsg = (id, patch) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== id) return msg
      const nextPatch = typeof patch === 'function' ? patch(msg) : patch
      return { ...msg, ...nextPatch }
    }))
  }
  const removeMsg = (id) => setMessages(prev => prev.filter(msg => msg.id !== id))

  const handleQuickReply = async (actionId, displayLabel) => {
    const quickReplyText = {
      general_enquiry: tr('generalEnquiry') || 'General Enquiry',
      pre_procedure: tr('preProcedurePrompt') || 'Fill up IVT Pre-Procedure Acknowledgement Form',
      post_operation: tr('postOperationPrompt') || 'View Post-IVT Advice Form',
      appointment: tr('bookAppointment') || 'Book Appointment',
      return_menu: tr('returnMenu') || 'Return Menu',
    }
    addMsg({ role: 'user', type: 'text', content: displayLabel || quickReplyText[actionId] || String(actionId || '') })

    const resetTransientFlowState = () => {
      setRegStep(null)
      setRegData({ patient_id: '', patient_name: '', patient_dob: '', phone_number: '' })
      setFormAnswers(INIT_FORM)
    }

    const resolvePatientContext = async () => {
      let patientName = epicRecord?.record_name || null
      let resolvedEpicRecord = epicRecord

      if (currentPatientId && !patientName) {
        try {
          const { data: patient } = await getPatient(currentPatientId)
          patientName = patient?.patient_name || patientName
        } catch {
          /* keep fallback below */
        }
      }

      if (currentPatientId && !resolvedEpicRecord) {
        try {
          const { data: rec } = await getEpicRecord(currentPatientId)
          resolvedEpicRecord = rec
          setEpicRecord(rec)
          patientName = patientName || rec?.record_name || null
        } catch {
          /* EPIC record may not exist for all patients */
        }
      }

      return {
        patientName: patientName || currentPatientId || 'Patient',
        resolvedEpicRecord,
      }
    }

    const continueWithExistingLogin = async (clinicalActionId) => {
      if (!currentPatientId) return false

      resetTransientFlowState()
      setLoading(true)
      try {
        const { patientName, resolvedEpicRecord } = await resolvePatientContext()

        if (clinicalActionId === 'pre_procedure') {
          setMode('pre_procedure')
          setPreProcStep('ask_update')
          addMsg({ role: 'bot', type: 'text', content: tr('proceedForm') })
          addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackPreProc'), { patientName }) })
          addMsg({ role: 'bot', type: 'text', content: tr('updateInfo') })
          return true
        }

        if (clinicalActionId === 'post_operation') {
          setMode('post_operation')
          let postOpRecord = resolvedEpicRecord
          try {
            const { data: latest } = await getLatestAcknowledgement(currentPatientId)
            postOpRecord = { ...postOpRecord, ...latest }
          } catch {
            /* no prior acknowledgement */
          }
          if (postOpRecord) {
            setEpicRecord(postOpRecord)
          }
          addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackPostOp'), { patientName }) })
          addMsg({ role: 'bot', type: 'postop_doc', content: '', formData: postOpRecord || null })
          setPostOpStep('complete')
          return true
        }

        if (clinicalActionId === 'appointment') {
          setMode('appointment')
          addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackAppointment'), { patientName }) })
          addMsg({ role: 'bot', type: 'appointment_picker', content: '' })
          return true
        }
      } finally {
        setLoading(false)
      }

      return false
    }

    if (actionId === 'general_enquiry') {
      setMode('general_enquiry')
      addMsg({
        role: 'bot',
        type: 'text',
        content: tr('generalEnquiryIntro'),
      })
    } else if (actionId === 'pre_procedure') {
      if (await continueWithExistingLogin('pre_procedure')) return
      setMode('pre_procedure')
      setPreProcStep('login')
      setFormAnswers(INIT_FORM)
      addMsg({ role: 'bot', type: 'text', content: tr('proceedForm') })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (actionId === 'post_operation') {
      if (await continueWithExistingLogin('post_operation')) return
      setMode('post_operation')
      setPostOpStep('login')
      addMsg({ role: 'bot', type: 'text', content: tr('proceedChecklist') })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (actionId === 'appointment') {
      if (await continueWithExistingLogin('appointment')) return
      setMode('appointment')
      addMsg({ role: 'bot', type: 'text', content: tr('proceedAppointment') })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (actionId === 'return_menu') {
      setMode('welcome')
      setPreProcStep('login')
      setPostOpStep('login')
      setFormAnswers(INIT_FORM)
      setRegStep(null)
      setRegData({ patient_id: '', patient_name: '', patient_dob: '', phone_number: '' })
      // Keep login in memory until refresh; add a dedicated logout control later.
      // Re-shown welcome bubbles keep the Return Menu pill; the very first one
      // (INIT_MESSAGES) omits it since you're already at the menu.
      addMsg({ role: 'bot', type: 'welcome', content: '', includeReturnMenu: true })
    }
  }

  const handleAppointmentSubmit = async ({ day, period }) => {
    if (!day || !period) return

    const formatted = `${day} ${period}`
    const patientName = epicRecord?.record_name || regData.patient_name || 'Patient'

    addMsg({ role: 'user', type: 'text', content: formatCopy(tr('appointmentUserSlot'), { formatted }) })
    setLoading(true)
    try {
      await enqueueAppointmentNotification({
        patient_id: currentPatientId || regData.patient_id || 'UNKNOWN',
        patient_name: patientName,
        preferred_day: day,
        preferred_period: period,
        appointment_timezone: 'Asia/Singapore',
        clinic_name: 'TTSH Eye Clinic',
        requested_by: 'chatbot',
      })
      addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('appointmentConfirmed'), { formatted }) })
    } catch {
      addMsg({ role: 'bot', type: 'text', content: tr('appointmentSubmitError') })
    } finally {
      setLoading(false)
    }
  }

  // Our DB first, EPIC mock as the fallback. A null patientName means the patient is in
  // neither, which is the signal to start registration.
  const resolvePatientIdentity = async (patientId) => {
    try {
      const { data: patient } = await getPatient(patientId)
      return { patientName: patient.patient_name, epicRec: null }
    } catch {
      try {
        const { data: rec } = await getEpicRecord(patientId)
        setEpicRecord(rec)
        return { patientName: rec.record_name, epicRec: rec }
      } catch {
        return { patientName: null, epicRec: null }
      }
    }
  }

  // Builds the record the flow will work from, given whatever the identity lookup
  // already found. Extracted so handleSingpassLogin is not three nested layers of
  // try/catch deep (Sonar javascript:S3776).
  const hydrateEpicRecord = async (patientId, patientName, initialRec) => {
    let epicRec = initialRec
    if (!epicRec) {
      try {
        ({ data: epicRec } = await getEpicRecord(patientId))
        setEpicRecord(epicRec)
      } catch { /* no EPIC record */ }
    }
    // For post-op: always merge the latest Mongo acknowledgement on top of EPIC.
    // EPIC is the seed; the latest pre-proc submission is the most recent decision and
    // must drive Post-Op's Eye/Diagnosis so Site (Financial) tallies with Eye (Post-Op).
    // EPIC fields not stored in Mongo (e.g. record_medication) are preserved by the merge.
    if (mode === 'post_operation') {
      try {
        const { data: latest } = await getLatestAcknowledgement(patientId)
        epicRec = { ...epicRec, ...latest }
        setEpicRecord(epicRec)
      } catch { /* no prior acknowledgement */ }
    }
    // Patient is in our DB but not in EPIC (and no prior Mongo record). Seed epicRec with
    // the known identity so buildPayload writes the acknowledgement under the real
    // patient_id — otherwise it falls back to 'UNKNOWN' and the post-op flow can't
    // retrieve the just-saved record_eyes.
    if (!epicRec) {
      epicRec = { patient_id: patientId, record_name: patientName }
      setEpicRecord(epicRec)
    }
    return epicRec
  }

  const welcomeExistingPatient = (patientName, epicRec) => {
    if (mode === 'post_operation') {
      addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackPostOp'), { patientName }) })
      addMsg({ role: 'bot', type: 'postop_doc', content: '', formData: epicRec })
      setPostOpStep('complete')
      return
    }
    if (mode === 'appointment') {
      addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackAppointment'), { patientName }) })
      addMsg({ role: 'bot', type: 'appointment_picker', content: '' })
      return
    }
    addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('welcomeBackPreProc'), { patientName }) })
    addMsg({ role: 'bot', type: 'text', content: tr('updateInfo') })
    setPreProcStep('ask_update')
  }

  const handleSingpassLogin = async (patientId) => {
    addMsg({ role: 'user', type: 'text', content: formatCopy(tr('loggedInAs'), { patientId }) })
    setCurrentPatientId(patientId)
    setLoading(true)
    try {
      const { patientName, epicRec } = await resolvePatientIdentity(patientId)
      if (!patientName) {
        // New patient — start registration
        setRegData({ patient_id: patientId, patient_name: '', patient_dob: '', phone_number: '' })
        setRegStep('name')
        addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('profileNotFound'), { patientId }) })
        return
      }
      const record = await hydrateEpicRecord(patientId, patientName, epicRec)
      welcomeExistingPatient(patientName, record)
    } finally {
      setLoading(false)
    }
  }

  // Registration is three validate-then-advance steps. Each is its own function so no
  // single one carries all three plus the save (Sonar javascript:S3776); an invalid
  // answer re-prompts and leaves regStep untouched, so the user simply retries.
  const handleRegNameStep = (name) => {
    // TBL_PATIENT.patient_name is varchar(255)
    const validNamePattern = /^[A-Za-z .'-]{1,255}$/
    if (!validNamePattern.test(name) || !/[A-Za-z]/.test(name)) {
      addMsg({ role: 'bot', type: 'text', content: tr('invalidName') })
      return
    }
    setRegData(prev => ({ ...prev, patient_name: name }))
    setRegStep('dob')
    addMsg({ role: 'bot', type: 'text', content: tr('askDob') })
  }

  const handleRegDobStep = (dob) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dob)
    if (!m) {
      addMsg({ role: 'bot', type: 'text', content: tr('invalidDobFormat') })
      return
    }
    const dd = Number.parseInt(m[1], 10)
    const mm = Number.parseInt(m[2], 10)
    const yyyy = Number.parseInt(m[3], 10)
    const currentYear = new Date().getFullYear()
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > currentYear) {
      addMsg({ role: 'bot', type: 'text', content: tr('invalidDobValue') })
      return
    }
    // Backend expects ISO date (YYYY-MM-DD); user enters DD-MM-YYYY
    setRegData(prev => ({ ...prev, patient_dob: `${m[3]}-${m[2]}-${m[1]}` }))
    setRegStep('phone')
    addMsg({ role: 'bot', type: 'text', content: tr('askPhone') })
  }

  // Where the user lands after the profile saves depends on the flow that sent them
  // into registration in the first place.
  const announceProfileCreated = (patientName) => {
    addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('profileCreated'), { patientName }) })
    if (mode === 'post_operation') {
      addMsg({ role: 'bot', type: 'text', content: tr('postOpChecklist') })
      addMsg({ role: 'bot', type: 'postop_doc', content: '', formData: null })
      setPostOpStep('complete')
      return
    }
    if (mode === 'appointment') {
      addMsg({ role: 'bot', type: 'text', content: tr('appointmentPrompt') })
      addMsg({ role: 'bot', type: 'appointment_picker', content: '' })
      return
    }
    addMsg({ role: 'bot', type: 'text', content: `We will now proceed with the form.\n\n${tr('qStroke')}` })
    setPreProcStep('q_stroke')
  }

  const handleRegPhoneStep = async (phone) => {
    // TBL_PATIENT.phone_number is varchar(20); allow optional leading '+'
    if (!/^\+?\d+$/.test(phone) || phone.length > 20) {
      addMsg({ role: 'bot', type: 'text', content: tr('invalidPhone') })
      return
    }
    const finalData = {
      ...regData,
      patient_dob: regData.patient_dob,
      phone_number: phone,
    }
    setLoading(true)
    try {
      await createPatient(finalData)
      setRegStep(null)
      // Set epicRecord so subsequent buildPayload and post-op use the correct patient_id
      setEpicRecord({ patient_id: finalData.patient_id, record_name: finalData.patient_name })
      announceProfileCreated(finalData.patient_name)
    } catch {
      addMsg({ role: 'bot', type: 'text', content: tr('profileSaveError') })
    } finally {
      setLoading(false)
    }
  }

  const handleRegistration = async (text) => {
    const rawText = String(text || '').trim()
    setInput('')
    addMsg({ role: 'user', type: 'text', content: rawText })

    if (regStep === 'name') return handleRegNameStep(rawText)
    if (regStep === 'dob') return handleRegDobStep(rawText)
    if (regStep === 'phone') return handleRegPhoneStep(rawText)
  }

  const isYesOrNo = (lower) => lower.startsWith('y') || lower.startsWith('n')

  // Re-asks the current question when the answer could not be read.
  const rejectAnswer = (answerKey, questionKey) => {
    addMsg({ role: 'bot', type: 'text', content: `${tr(answerKey)}\n\n${tr(questionKey)}` })
  }

  // The saved-record path and the EPIC-fallback path render the same two documents with
  // the same field precedence; only the preferred source differs. Passing `latest` as
  // null collapses every lookup to EPIC, which is exactly what the duplicated catch
  // block this replaces did by hand.
  const showExistingForm = (latest) => {
    const primary = latest ?? epicRecord
    const patientName = primary?.record_name || epicRecord?.record_name || ''
    setPreProcStep('complete')
    addMsg({ role: 'bot', type: 'text', content: tr('existingFormIntro') })
    addMsg({
      role: 'bot',
      type: 'acknowledgement_doc',
      content: '',
      formData: buildAckFormData({
        patientName,
        nric: currentPatientId || primary?.patient_id || '',
        dateIso: primary?.issued,
        strokeHeartAtt: primary?.record_stroke_heartAtt_last6mths,
        hospitalised: primary?.record_last3mths_admission,
        antibiotics: primary?.record_taking_antibiotics,
        pregnant: primary?.record_pregnant,
      }),
    })
    addMsg({
      role: 'bot',
      type: 'financial_doc',
      content: '',
      formData: {
        patientName,
        date: formatDate(primary?.issued),
        surgeon: 'Dr. Koh CS',
        mcr: '0001231241',
        site: primary?.record_eyes || epicRecord?.record_eyes || '',
        diagnosis: primary?.record_diagnosis || epicRecord?.record_diagnosis || 'H35.31',
        medication: primary?.record_medication || epicRecord?.record_medication || '',
        estCost: primary?.estimated_cost_range || primary?.payment_estCostPerInjection || '',
        injections: primary?.record_number_of_injections || 1,
        classCode: primary?.record_class || '',
        performer: primary?.record_performer || '',
        maxMedisaveClaimable: primary?.payment_maxMedisave,
        paymentMode: primary?.payment_mode || 'Medisave (Self)',
      },
    })
  }

  const handleAskUpdateStep = async (lower) => {
    if (!isYesOrNo(lower)) {
      rejectAnswer('answerYesNo', 'updateInfo')
      return
    }
    if (lower.startsWith('y')) {
      // Update — proceed to the acknowledgement-form questions
      addMsg({ role: 'bot', type: 'text', content: tr('qStroke') })
      setPreProcStep('q_stroke')
      return
    }
    // Fetch latest saved acknowledgement from MongoDB to display correct data
    setLoading(true)
    try {
      const { data: latest } = await getLatestAcknowledgement(currentPatientId)
      showExistingForm(latest)
    } catch {
      // No prior record saved — fall back to EPIC data
      showExistingForm(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSimpleYesNoStep = (lower, step) => {
    const { field, question, nextQuestion, nextStep } = SIMPLE_YESNO_STEPS[step]
    if (!isYesOrNo(lower)) {
      rejectAnswer('answerYesNo', question)
      return
    }
    setFormAnswers(prev => ({ ...prev, [field]: lower.startsWith('y') }))
    addMsg({ role: 'bot', type: 'text', content: tr(nextQuestion) })
    setPreProcStep(nextStep)
  }

  const handlePregnantStep = (lower) => {
    if (!isYesOrNo(lower)) {
      rejectAnswer('answerYesNo', 'qPregnant')
      return
    }
    // All four acknowledgement questions are now answered — show the completed form
    // before confirming the treatment eye.
    const answered = { ...formAnswers, pregnant: lower.startsWith('y') }
    setFormAnswers(answered)
    addMsg({ role: 'bot', type: 'text', content: tr('preProcFormIntro') })
    addMsg({
      role: 'bot',
      type: 'acknowledgement_doc',
      content: '',
      formData: buildAckFormData({
        patientName: epicRecord?.record_name || '',
        nric: currentPatientId || epicRecord?.patient_id || '',
        strokeHeartAtt: answered.stroke_heartAtt_last6mths,
        hospitalised: answered.last3mths_admission,
        antibiotics: answered.taking_antibiotics,
        pregnant: answered.pregnant,
      }),
    })
    addMsg({ role: 'bot', type: 'text', content: tr('qCounselling') })
    setPreProcStep('q_financial_counselling')
  }

  // Ends the flow early but still persists the four answers so they are not lost. The
  // acknowledgement form was already displayed from local state, so a failed save stays
  // deliberately silent.
  const completeAndSaveAnswers = async (messageKey) => {
    setPreProcStep('complete')
    setLoading(true)
    addMsg({ role: 'bot', type: 'text', content: tr(messageKey) })
    try {
      await submitAcknowledgement(buildPayload(formAnswers, epicRecord))
    } catch {
      /* Save failed — acknowledgement was already displayed from local answers. */
    } finally {
      setLoading(false)
    }
  }

  const handleCounsellingStep = async (lower) => {
    if (!isYesOrNo(lower)) {
      rejectAnswer('answerYesNo', 'qCounselling')
      return
    }
    if (lower.startsWith('n')) {
      await completeAndSaveAnswers('noProblemSaved')
      return
    }
    addMsg({ role: 'bot', type: 'text', content: tr('qScheme') })
    setPreProcStep('q_scheme')
  }

  const handleSchemeStep = (lower) => {
    const isPrivate = lower.includes('private')
    const isSubsidised = lower.includes('subsidised') || lower.includes('subsidized') || lower.includes('subsid')
    if (!isPrivate && !isSubsidised) {
      rejectAnswer('answerScheme', 'qScheme')
      return
    }
    setFormAnswers(prev => ({ ...prev, record_class: isPrivate ? 'PTE' : 'SUB' }))
    addMsg({ role: 'bot', type: 'text', content: tr('qPerformer') })
    setPreProcStep('q_performer')
  }

  const handlePerformerStep = (lower) => {
    const isDoctor = lower.includes('doctor')
    const isNurse = lower.includes('nurse')
    if (!isDoctor && !isNurse) {
      rejectAnswer('answerPerformer', 'qPerformer')
      return
    }
    setFormAnswers(prev => ({ ...prev, record_performer: isDoctor ? 'Doctor' : 'Nurse' }))
    addMsg({ role: 'bot', type: 'text', content: tr('qEye') })
    setPreProcStep('q_eye')
  }

  const handleEyeStep = async (lower) => {
    const isRight = lower.includes('right') || lower.includes('od')
    const isLeft = lower.includes('left') || lower.includes('os')
    if (!isRight && !isLeft) {
      rejectAnswer('answerEye', 'qEye')
      return
    }
    const injections = 1

    let updated = null
    try {
      const { data } = await calculateBill({
        recordClass: formAnswers.record_class,
        performer: formAnswers.record_performer,
        injections,
      })
      if (typeof data?.estimated_cost_min !== 'number' || typeof data?.estimated_cost_max !== 'number') {
        throw new TypeError('Invalid billing response')
      }
      updated = {
        ...formAnswers,
        record_eyes: isLeft ? 'OS' : 'OD',
        record_number_of_injections: injections,
        estimated_cost_min: data.estimated_cost_min,
        estimated_cost_max: data.estimated_cost_max,
        estimated_cost: data.estimated_cost_max,
        estimated_cost_range: `${data.estimated_cost_min} - ${data.estimated_cost_max}`,
        max_medisave_claimable: data.max_medisave_claimable,
      }
    } catch {
      addMsg({
        role: 'bot',
        type: 'text',
        content: tr('billingUnavailable'),
      })
      return
    }
    setFormAnswers(updated)
    setPreProcStep('cost_confirm')
    addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('costConfirm'), { cost: formatRangeWithCurrency(updated.estimated_cost_range) }) })
  }

  const handleCostConfirmStep = async (lower) => {
    if (!isYesOrNo(lower)) {
      addMsg({ role: 'bot', type: 'text', content: formatCopy(tr('costConfirmInvalid'), { cost: formatRangeWithCurrency(formAnswers.estimated_cost_range) }) })
      return
    }
    if (lower.startsWith('n')) {
      // Declining the cost ends the flow, but the acknowledgement answers are still
      // saved so the four pre-procedure questions aren't lost.
      await completeAndSaveAnswers('understoodSaved')
      return
    }
    setPreProcStep('payment_mode')
    const paymentList = paymentOptionsLocalized.map((option) => `• ${option.label}`).join('\n')
    addMsg({ role: 'bot', type: 'text', content: `${tr('qPayment')}\n${paymentList}` })
  }

  // Returns null when the answer matches no scheme, which is the signal to re-prompt.
  // First match wins, so order matters: isNok outranks the Medisave check because
  // "NOK Medisave" contains "medisave". Medisave (Self) is the tail rather than an entry
  // here, exactly as the original ternary chain had it — reached when only
  // isMedisaveSelf is true.
  const resolvePaymentMode = (lower) => {
    const isNok = lower.includes('nok') || lower.includes('next-of-kin') || lower.includes('next of kin')
    const isMedisaveSelf = (lower.includes('medisave') && !isNok) || lower.includes('self')
    const isMediShield = lower.includes('medishield') || lower.includes('integrated plan') || lower.includes('integrated') || lower === 'life' || lower === 'ip'
    const isCsc = lower === 'csc' || lower.includes('csc')
    const isMaf = lower === 'maf' || lower.includes('maf')
    const isCash = lower === 'cash' || lower.includes('cash')
    if (!isNok && !isMedisaveSelf && !isMediShield && !isCsc && !isMaf && !isCash) {
      return null
    }
    return [
      [isNok, 'NOK Medisave'],
      [isMediShield, 'Medishield Life / Integrated Plan'],
      [isCsc, 'CSC'],
      [isMaf, 'MAF'],
      [isCash, 'Cash'],
    ].find(([matched]) => matched)?.[1] ?? 'Medisave (Self)'
  }

  const financialDocFromResponse = ({ record, payment }, updated, paymentMode, confirmedEyes) => ({
    patientName: record?.record_name || 'Test Patient',
    date: formatDate(record?.issued),
    surgeon: 'Dr. Koh CS',
    mcr: '0001231241',
    site: confirmedEyes,
    diagnosis: record?.record_diagnosis || 'H35.31',
    medication: record?.record_medication || epicRecord?.record_medication || '',
    estCost: updated.estimated_cost_range || payment?.payment_estCostPerInjection || '',
    injections: record?.record_number_of_injections || updated.record_number_of_injections || 1,
    classCode: record?.record_class || updated.record_class || '',
    performer: record?.record_performer || updated.record_performer || '',
    maxMedisaveClaimable: payment?.payment_maxMedisave || updated.max_medisave_claimable,
    paymentMode: payment?.payment_mode || paymentMode,
  })

  // Shown when the save fails: everything the form needs is already in local state.
  const financialDocFromLocalAnswers = (updated, paymentMode) => ({
    site: updated.record_eyes,
    estCost: updated.estimated_cost_range || '',
    injections: updated.record_number_of_injections || 1,
    classCode: updated.record_class || '',
    performer: updated.record_performer || '',
    maxMedisaveClaimable: updated.max_medisave_claimable,
    paymentMode,
  })

  const handlePaymentModeStep = async (lower) => {
    const paymentMode = resolvePaymentMode(lower)
    if (!paymentMode) {
      addMsg({ role: 'bot', type: 'text', content: tr('answerPayment') })
      return
    }
    const updated = { ...formAnswers, payment_mode: paymentMode }
    setFormAnswers(updated)
    setPreProcStep('complete')
    setLoading(true)
    addMsg({ role: 'bot', type: 'text', content: tr('financialDocIntro') })
    try {
      const res = await submitAcknowledgement(buildPayload(updated, epicRecord))
      const confirmedEyes = res.data.record?.record_eyes || updated.record_eyes
      // Keep epicRecord in sync so post-op checklist uses the same eye value
      setEpicRecord(prev => ({ ...prev, record_eyes: confirmedEyes }))
      addMsg({
        role: 'bot',
        type: 'financial_doc',
        content: '',
        formData: financialDocFromResponse(res.data, updated, paymentMode, confirmedEyes),
      })
    } catch {
      addMsg({ role: 'bot', type: 'financial_doc', content: '', formData: financialDocFromLocalAnswers(updated, paymentMode) })
    } finally {
      setLoading(false)
    }
  }

  // Pure dispatch: every branch of the old else-if chain is now its own handler, so this
  // stays flat no matter how many steps the flow grows (Sonar javascript:S3776).
  const handlePreProcAnswer = async (text) => {
    setInput('')
    addMsg({ role: 'user', type: 'text', content: text })
    const lower = normalizeInput(text).toLowerCase().trim()

    if (SIMPLE_YESNO_STEPS[preProcStep]) {
      handleSimpleYesNoStep(lower, preProcStep)
      return
    }

    const handler = {
      ask_update: handleAskUpdateStep,
      q_pregnant: handlePregnantStep,
      q_financial_counselling: handleCounsellingStep,
      q_scheme: handleSchemeStep,
      q_performer: handlePerformerStep,
      q_eye: handleEyeStep,
      cost_confirm: handleCostConfirmStep,
      payment_mode: handlePaymentModeStep,
    }[preProcStep]

    if (handler) await handler(lower)
  }

  // `tracker` is shared mutable state: onChunk creates the bot bubble on the first chunk
  // and the error paths below need that same id to update or remove it. It is an object
  // rather than two closure variables so it can cross the function boundary.
  const streamReply = async (history, controller, tracker) => {
    const streamedText = await sendChatMessageStream(history, {
      sessionId: generalEnquirySessionIdRef.current,
      mode: 'general_enquiry',
      language,
      patientId: currentPatientId,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (!tracker.receivedChunk) {
          tracker.receivedChunk = true
          setShowThinkingBubble(false)
          tracker.placeholderId = addMsg({ role: 'bot', type: 'text', content: chunk })
          return
        }

        updateMsg(tracker.placeholderId, prev => ({ content: `${prev.content}${chunk}` }))
      },
      onHeartbeat: () => {
        setStreamHeartbeatCount(prev => prev + 1)
      },
    })

    if (!tracker.receivedChunk) {
      setShowThinkingBubble(false)
      addMsg({ role: 'bot', type: 'text', content: streamedText || 'No response returned from coordinator runtime.' })
    }
  }

  // An aborted stream leaves nothing to say; 400/503 is the coordinator reporting a real
  // problem, so it surfaces as-is. Anything else is treated as a transport failure and
  // retried once without streaming. Split out of handleSend so the retry's own
  // try/catch is not a third level of nesting (Sonar javascript:S3776).
  const recoverFromStreamError = async (streamError, history, tracker) => {
    if (streamError?.name === 'AbortError') {
      if (tracker.placeholderId !== null) {
        removeMsg(tracker.placeholderId)
      }
      return
    }

    setShowThinkingBubble(false)

    const streamStatus = Number(streamError?.status || streamError?.response?.status || 0)
    if (streamStatus === 400 || streamStatus === 503) {
      if (tracker.placeholderId !== null) {
        removeMsg(tracker.placeholderId)
      }
      addMsg({ role: 'bot', type: 'text', content: extractApiErrorMessage(streamError) })
      return
    }

    try {
      const res = await sendChatMessage(history, {
        sessionId: generalEnquirySessionIdRef.current,
        mode: 'general_enquiry',
        language,
        patientId: currentPatientId,
      })
      if (tracker.placeholderId !== null) {
        updateMsg(tracker.placeholderId, { content: res.data.reply })
      } else {
        addMsg({ role: 'bot', type: 'text', content: res.data.reply })
      }
    } catch (fallbackError) {
      if (tracker.placeholderId !== null) {
        removeMsg(tracker.placeholderId)
      }
      addMsg({ role: 'bot', type: 'text', content: extractApiErrorMessage(fallbackError) })
    }
  }

  const sendGeneralEnquiry = async (rawText) => {
    const shouldMask = mode === 'general_enquiry' || mode === 'welcome'
    const outboundText = shouldMask ? maskSensitiveText(rawText) : rawText

    if (mode === 'welcome') setMode('general_enquiry')

    addMsg({ role: 'user', type: 'text', content: outboundText })
    setLoading(true)
    setStreamHeartbeatCount(0)
    setShowThinkingBubble(true)

    const history = [...messages, { role: 'user', type: 'text', content: outboundText }]
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))

    const tracker = { receivedChunk: false, placeholderId: null }
    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      await streamReply(history, controller, tracker)
    } catch (streamError) {
      await recoverFromStreamError(streamError, history, tracker)
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
      setLoading(false)
      setStreamHeartbeatCount(0)
      setShowThinkingBubble(false)
    }
  }

  const handleSend = async () => {
    const rawText = input.trim()
    if (!rawText || loading) return
    setInput('')

    if (regStep) {
      handleRegistration(rawText)
      return
    }

    if (mode === 'pre_procedure') {
      if (preProcStep !== 'login' && preProcStep !== 'complete') {
        handlePreProcAnswer(rawText)
      }
      return
    }

    await sendGeneralEnquiry(rawText)
  }

  const isPreProc = mode === 'pre_procedure'
  const showYesNo = isPreProc && YESNO_STEPS.has(preProcStep)
  const showScheme = isPreProc && preProcStep === 'q_scheme'
  const showPerformer = isPreProc && preProcStep === 'q_performer'
  const showEye = isPreProc && preProcStep === 'q_eye'
  const showPaymentMode = isPreProc && preProcStep === 'payment_mode'
  const showReturnMenu = shouldShowReturnMenu(mode, postOpStep)
  const inputDisabled = isInputDisabled({ regStep, mode, preProcStep, postOpStep })

  // Guard order is the old ternary chain's order (Sonar javascript:S3358): a pending
  // registration step overrides the mode, and anything unmatched falls back to the
  // same generic prompt general_enquiry uses.
  const resolvePlaceholder = () => {
    if (regStep) return tr('inputTypeYourAnswer') || 'Type your answer…'
    if (mode === 'general_enquiry') return tr('inputWriteYourMessage') || 'Write your message…'
    if (mode === 'appointment') return tr('inputUseCalendarToChooseDateTime') || 'Use the calendar to choose date and time'
    if (mode === 'pre_procedure' && !inputDisabled) return tr('inputWriteYourAnswer') || 'Write your answer…'
    return tr('inputWriteYourMessage') || 'Write your message…'
  }
  const placeholder = resolvePlaceholder()

  const centered = { maxWidth: '900px', margin: '0 auto', width: '100%' }
  const thinkingDots = '.'.repeat(streamHeartbeatCount)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f7f8fc' }}>
      {/* Header — full-width bg, centred content */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E8E8', flexShrink: 0 }}>
        <div style={{ ...centered, display: 'flex', alignItems: 'center', padding: '0 20px', height: '64px', gap: '12px' }}>
          <button onClick={onBack} title="Back" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#555', padding: '4px 8px' }}>
            ←
          </button>
          <EyeLogoSVG size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#3B6EF8', fontSize: '16px', lineHeight: '1.2' }}>EyeCanHelp</div>
            <div style={{ fontSize: '12px', color: '#4CAF50', lineHeight: '1.2' }}>● Online</div>
          </div>
          <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>♪</button>
          <button onClick={scrollToTop} title="Scroll to top" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>↑</button>
        </div>
      </div>

      {/* Messages — scrollable, centred content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...centered, padding: '16px 20px' }}>
          <div ref={topRef} />
          {messages.map(m => (
            <MessageBubble
              key={m.id}
              role={m.role}
              type={m.type}
              content={m.content}
              formData={m.formData}
              includeReturnMenu={m.includeReturnMenu}
              onQuickReply={handleQuickReply}
              onSingpassLogin={handleSingpassLogin}
              onAppointmentSubmit={handleAppointmentSubmit}
              language={language}
            />
          ))}
          {loading && showThinkingBubble && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
              <EyeLogoSVG size={26} />
              <div style={{ background: '#fff', borderRadius: '4px 20px 20px 20px', padding: '10px 16px', fontSize: '14px', color: '#777', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {`${tr('thinking') || 'Thinking'}${thinkingDots}`}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips — full-width bg, centred content */}
      {(showYesNo || showScheme || showPerformer || showEye || showPaymentMode || showReturnMenu) && (
        <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          {/* One left-aligned row: answer chips first, Return Menu trailing them. */}
          <div style={{ ...centered, display: 'flex', gap: '8px', padding: '10px 20px', flexWrap: 'wrap' }}>
            {showYesNo && (
              <>
                <button onClick={() => handlePreProcAnswer(tr('yes'))} style={chipBtn}>{tr('yes')}</button>
                <button onClick={() => handlePreProcAnswer(tr('no'))} style={chipBtn}>{tr('no')}</button>
              </>
            )}
            {showScheme && (
              <>
                <button onClick={() => handlePreProcAnswer(tr('private'))} style={chipBtn}>{tr('private')}</button>
                <button onClick={() => handlePreProcAnswer(tr('subsidised'))} style={chipBtn}>{tr('subsidised')}</button>
              </>
            )}
            {showPerformer && (
              <>
                <button onClick={() => handlePreProcAnswer(tr('doctor'))} style={chipBtn}>{tr('doctor')}</button>
                <button onClick={() => handlePreProcAnswer(tr('nurse'))} style={chipBtn}>{tr('nurse')}</button>
              </>
            )}
            {showEye && (
              <>
                <button onClick={() => handlePreProcAnswer(tr('right'))} style={chipBtn}>{tr('right')}</button>
                <button onClick={() => handlePreProcAnswer(tr('left'))} style={chipBtn}>{tr('left')}</button>
              </>
            )}
            {showPaymentMode && (
              <>
                {paymentOptionsLocalized.map((payment) => (
                  <button key={payment.value} onClick={() => handlePreProcAnswer(payment.label)} style={chipBtn}>{payment.label}</button>
                ))}
              </>
            )}
            {showReturnMenu && (
              <button onClick={() => handleQuickReply('return_menu')} style={{ ...chipBtn, background: '#3B6EF8', color: '#fff' }}>
                {tr('returnMenu')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input bar — full-width bg, centred content */}
      <div style={{ background: '#fff', borderTop: '1px solid #E8E8E8', flexShrink: 0 }}>
        <div style={{ ...centered, display: 'flex', alignItems: 'center', padding: '12px 20px', gap: '10px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSend() } }}
            placeholder={placeholder}
            disabled={inputDisabled}
            style={{
              flex: 1, padding: '12px 20px',
              borderRadius: '28px', border: '1px solid #E8E8E8',
              fontSize: '14px', fontFamily: 'inherit',
              outline: 'none', background: inputDisabled ? '#f5f5f5' : '#FAFAFA',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
            }}
          />
          <button
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: '#F0F0F0', border: 'none', cursor: 'pointer',
              fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            🎤
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || inputDisabled}
            style={{
              width: '44px', height: '44px', borderRadius: '50%',
              background: loading || !input.trim() || inputDisabled ? '#ccc' : '#3B6EF8',
              border: 'none',
              cursor: loading || !input.trim() || inputDisabled ? 'not-allowed' : 'pointer',
              color: '#fff', fontSize: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: !inputDisabled && input.trim() ? '0 2px 8px rgba(59,110,248,0.4)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
