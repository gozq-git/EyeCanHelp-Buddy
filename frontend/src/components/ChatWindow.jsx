import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import EyeLogoSVG from './EyeLogoSVG'
import { sendChatMessage, sendChatMessageStream, submitAcknowledgement, getEpicRecord, getPatient, createPatient, getLatestAcknowledgement, calculateBill } from '../api/client'

let _msgId = 1
const nextId = () => ++_msgId

const INIT_FORM = { last3mths_admission: false, stroke_heartAtt_last6mths: false, taking_antibiotics: false, pregnant: false, record_eyes: 'OD', record_number_of_injections: 1, record_class: '', record_performer: 'Nurse', estimated_cost: 123, estimated_cost_min: 123, estimated_cost_max: 123, estimated_cost_range: '123 - 123', payment_mode: 'Medisave (Self)' }
const INIT_MESSAGES = [{ id: 1, role: 'bot', type: 'welcome', content: '' }]

// Total cost shown to the patient before payment-mode selection. Mirrors the default
// in FinancialCounsellingDoc and the payment.payment_estCostPerInjection used by buildPayload.
const DEFAULT_PROCEDURE_COST = 123
const PREPROC_LABELS = ['Fill up IVT Pre-Procedure Acknowledgement Form', 'Fill up IVT Pre-Procedure Acknowledgement Form', 'Fill up pre-procedure']
const POSTOP_LABELS = ['View Post-IVT Advice Form', 'Fill up post-operation checklist']
const APPOINTMENT_LABELS = ['Book Appointment', 'Appointment']

function getEstimatedCostForClass(classCode) {
  if (classCode === 'PTE') return 300
  if (classCode === 'SUB') return 200
  return DEFAULT_PROCEDURE_COST
}

function getFallbackRange(classCode, performer, injections) {
  const inj = Math.max(1, Number(injections) || 1)
  const cls = (classCode || '').toUpperCase()
  const perf = (performer || '').toUpperCase()
  if (cls === 'SUB' && perf === 'DOCTOR') return { min: 86 * inj, max: 310 * inj }
  if (cls === 'SUB' && perf === 'NURSE') return { min: 62 * inj, max: 220 * inj }
  if (cls === 'PTE' && perf === 'DOCTOR') return { min: 430 * inj, max: 480 * inj }
  if (cls === 'PTE' && perf === 'NURSE') return { min: 300 * inj, max: 350 * inj }
  const fallback = getEstimatedCostForClass(cls)
  return { min: fallback, max: fallback }
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
      payment_maxMedisave: 250,
      payment_estCostPerInjection: answers.estimated_cost_max || answers.estimated_cost || getEstimatedCostForClass(answers.record_class),
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
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
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

export default function ChatWindow({ onBack }) {
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

  const handleQuickReply = (label) => {
    addMsg({ role: 'user', type: 'text', content: label })

    if (label === 'General Enquiry') {
      setMode('general_enquiry')
      addMsg({
        role: 'bot',
        type: 'text',
        content: "Sure, I can help answer general enquiries about eye procedures or surgery.\n\n**Disclaimer:**\nThis chatbot provides general information only and cannot replace your doctor's clinical advice, diagnosis, or treatment plan.\nIt is not intended to replace standard medical care.\nIf you have urgent or worsening symptoms, please seek immediate medical attention.",
      })
    } else if (PREPROC_LABELS.includes(label)) {
      setMode('pre_procedure')
      setPreProcStep('login')
      setFormAnswers(INIT_FORM)
      addMsg({ role: 'bot', type: 'text', content: 'To proceed with the form, would you please sign in below?' })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (POSTOP_LABELS.includes(label)) {
      setMode('post_operation')
      setPostOpStep('login')
      addMsg({ role: 'bot', type: 'text', content: 'To proceed with the checklist, would you please sign in below?' })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (APPOINTMENT_LABELS.includes(label)) {
      setMode('appointment')
      addMsg({ role: 'bot', type: 'text', content: 'Please share your preferred appointment day (Monday to Friday) and period (AM or PM).' })
      addMsg({ role: 'bot', type: 'appointment_picker', content: '' })
    } else if (label === 'Return Menu') {
      setMode('welcome')
      setPreProcStep('login')
      setPostOpStep('login')
      setFormAnswers(INIT_FORM)
      setEpicRecord(null)
      setCurrentPatientId(null)
      setRegStep(null)
      setRegData({ patient_id: '', patient_name: '', patient_dob: '', phone_number: '' })
      // Re-shown welcome bubbles keep the Return Menu pill; the very first one
      // (INIT_MESSAGES) omits it since you're already at the menu.
      addMsg({ role: 'bot', type: 'welcome', content: '', includeReturnMenu: true })
    }
  }

  const handleAppointmentSubmit = ({ day, period }) => {
    if (!day || !period) return

    const formatted = `${day} ${period}`

    addMsg({ role: 'user', type: 'text', content: `Preferred appointment slot: ${formatted}` })
    addMsg({ role: 'bot', type: 'text', content: `Thanks. Your preferred slot (${formatted}) has been received. Our clinic staff will contact you to confirm availability.` })
  }

  const handleSingpassLogin = async (patientId) => {
    addMsg({ role: 'user', type: 'text', content: `Logged in as ${patientId}` })
    setCurrentPatientId(patientId)
    setLoading(true)
    try {
      // Try existing patient in DB first, fall back to EPIC mock
      let patientName = null
      let epicRec = null
      try {
        const { data: patient } = await getPatient(patientId)
        patientName = patient.patient_name
      } catch {
        // Not in DB — check EPIC mock
        try {
          const { data: rec } = await getEpicRecord(patientId)
          epicRec = rec
          patientName = rec.record_name
          setEpicRecord(rec)
        } catch {
          patientName = null
        }
      }

      if (patientName) {
        // Existing patient
        if (!epicRec) {
          try { ({ data: epicRec } = await getEpicRecord(patientId)); setEpicRecord(epicRec) } catch { /* no EPIC record */ }
        }
        // For post-op: always merge the latest Mongo acknowledgement on top of EPIC.
        // EPIC is the seed; the latest pre-proc submission is the most recent decision and
        // must drive Post-Op's Eye/Diagnosis so Site (Financial) tallies with Eye (Post-Op).
        // EPIC fields not stored in Mongo (e.g. record_medication) are preserved by the merge.
        if (mode === 'post_operation') {
          try {
            const { data: latest } = await getLatestAcknowledgement(patientId)
            epicRec = { ...(epicRec || {}), ...latest }
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
        if (mode === 'post_operation') {
          addMsg({ role: 'bot', type: 'text', content: `Welcome back, ${patientName}. Here is your post-operation checklist.` })
          addMsg({ role: 'bot', type: 'postop_doc', content: '', formData: epicRec })
          setPostOpStep('complete')
        } else {
          addMsg({ role: 'bot', type: 'text', content: `Welcome back, ${patientName}. We will now proceed with the form.` })
          addMsg({ role: 'bot', type: 'text', content: 'Would you like to update your information?\n• Yes / No' })
          setPreProcStep('ask_update')
        }
      } else {
        // New patient — start registration
        setRegData({ patient_id: patientId, patient_name: '', patient_dob: '', phone_number: '' })
        setRegStep('name')
        addMsg({ role: 'bot', type: 'text', content: `We couldn't find an existing record for ${patientId}. Let's set up your profile.\n\nWhat is your full name?` })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegistration = async (text) => {
    setInput('')
    addMsg({ role: 'user', type: 'text', content: text })

    if (regStep === 'name') {
      const name = text.trim()
      // TBL_PATIENT.patient_name is varchar(255)
      if (!name || name.length > 255) {
        addMsg({ role: 'bot', type: 'text', content: 'Please enter a valid name (1–255 characters).\n\nWhat is your full name?' })
        return
      }
      setRegData(prev => ({ ...prev, patient_name: name }))
      setRegStep('dob')
      addMsg({ role: 'bot', type: 'text', content: 'What is your date of birth? (DD-MM-YYYY, e.g. 01-01-1990)' })
    } else if (regStep === 'dob') {
      const dob = text.trim()
      const m = dob.match(/^(\d{2})-(\d{2})-(\d{4})$/)
      if (!m) {
        addMsg({ role: 'bot', type: 'text', content: 'Please enter your date of birth in DD-MM-YYYY format (e.g. 01-01-1990).' })
        return
      }
      const dd = parseInt(m[1], 10)
      const mm = parseInt(m[2], 10)
      const yyyy = parseInt(m[3], 10)
      const currentYear = new Date().getFullYear()
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > currentYear) {
        addMsg({ role: 'bot', type: 'text', content: "That date doesn't look right. Please enter a valid date in DD-MM-YYYY format (e.g. 01-01-1990)." })
        return
      }
      setRegData(prev => ({ ...prev, patient_dob: dob }))
      setRegStep('phone')
      addMsg({ role: 'bot', type: 'text', content: 'What is your phone number? (digits only, may start with +, up to 20 characters)' })
    } else if (regStep === 'phone') {
      const phone = text.trim()
      // TBL_PATIENT.phone_number is varchar(20); allow optional leading '+'
      if (!/^\+?\d+$/.test(phone) || phone.length > 20) {
        addMsg({ role: 'bot', type: 'text', content: 'Please enter a valid phone number (digits only, may start with +, up to 20 characters).' })
        return
      }
      const finalData = { ...regData, phone_number: phone }
      setLoading(true)
      try {
        await createPatient(finalData)
        setRegStep(null)
        // Set epicRecord so subsequent buildPayload and post-op use the correct patient_id
        setEpicRecord({ patient_id: finalData.patient_id, record_name: finalData.patient_name })
        addMsg({ role: 'bot', type: 'text', content: `Thank you, ${finalData.patient_name}! Your profile has been created.` })
        if (mode === 'post_operation') {
          addMsg({ role: 'bot', type: 'text', content: 'Here is your post-operation checklist.' })
          addMsg({ role: 'bot', type: 'postop_doc', content: '', formData: null })
          setPostOpStep('complete')
        } else {
          addMsg({ role: 'bot', type: 'text', content: 'We will now proceed with the form.\n\nHave you had a recent stroke or heart attack in the past 6 months?\n• Yes / No' })
          setPreProcStep('q_stroke')
        }
      } catch {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, there was an error saving your profile. Please try again.' })
      } finally {
        setLoading(false)
      }
    }
  }

  const handlePreProcAnswer = async (text) => {
    setInput('')
    addMsg({ role: 'user', type: 'text', content: text })
    const lower = text.toLowerCase().trim()

    if (preProcStep === 'ask_update') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nWould you like to update your information?\n• Yes / No' })
        return
      }
      if (lower.startsWith('n')) {
        // Fetch latest saved acknowledgement from MongoDB to display correct data
        setLoading(true)
        try {
          const { data: latest } = await getLatestAcknowledgement(currentPatientId)
          setPreProcStep('complete')
          addMsg({ role: 'bot', type: 'text', content: 'Here is your existing form.' })
          addMsg({
            role: 'bot',
            type: 'acknowledgement_doc',
            content: '',
            formData: buildAckFormData({
              patientName: latest.record_name || epicRecord?.record_name || '',
              nric: currentPatientId || latest.patient_id || '',
              dateIso: latest.issued,
              strokeHeartAtt: latest.record_stroke_heartAtt_last6mths,
              hospitalised: latest.record_last3mths_admission,
              antibiotics: latest.record_taking_antibiotics,
              pregnant: latest.record_pregnant,
            }),
          })
          addMsg({
            role: 'bot',
            type: 'financial_doc',
            content: '',
            formData: {
              patientName: latest.record_name || epicRecord?.record_name || '',
              date: formatDate(latest.issued),
              surgeon: 'Dr. Koh CS',
              mcr: '0001231241',
              site: latest.record_eyes || epicRecord?.record_eyes || '',
              diagnosis: latest.record_diagnosis || epicRecord?.record_diagnosis || 'H35.31',
              medication: latest.record_medication || epicRecord?.record_medication || '',
              estCost: getEstimatedCostForClass(latest.record_class),
              injections: latest.record_number_of_injections || 1,
              classCode: latest.record_class || '',
              performer: latest.record_performer || '',
              maxMedisaveClaimable: 250,
              paymentMode: latest.payment_mode || 'Medisave (Self)',
            },
          })
        } catch {
          // No prior record saved — fall back to EPIC data
          setPreProcStep('complete')
          addMsg({ role: 'bot', type: 'text', content: 'Here is your existing form.' })
          addMsg({
            role: 'bot',
            type: 'acknowledgement_doc',
            content: '',
            formData: buildAckFormData({
              patientName: epicRecord?.record_name || '',
              nric: currentPatientId || epicRecord?.patient_id || '',
              dateIso: epicRecord?.issued,
              strokeHeartAtt: epicRecord?.record_stroke_heartAtt_last6mths,
              hospitalised: epicRecord?.record_last3mths_admission,
              antibiotics: epicRecord?.record_taking_antibiotics,
              pregnant: epicRecord?.record_pregnant,
            }),
          })
          addMsg({
            role: 'bot',
            type: 'financial_doc',
            content: '',
            formData: {
              patientName: epicRecord?.record_name || '',
              date: formatDate(epicRecord?.issued),
              surgeon: 'Dr. Koh CS',
              mcr: '0001231241',
              site: epicRecord?.record_eyes || '',
              diagnosis: epicRecord?.record_diagnosis || 'H35.31',
              medication: epicRecord?.record_medication || '',
              estCost: getEstimatedCostForClass(epicRecord?.record_class),
              injections: epicRecord?.record_number_of_injections || 1,
              classCode: epicRecord?.record_class || '',
              performer: epicRecord?.record_performer || '',
              maxMedisaveClaimable: 250,
              paymentMode: epicRecord?.payment_mode || 'Medisave (Self)',
            },
          })
        } finally {
          setLoading(false)
        }
      } else {
        // Update — proceed to the acknowledgement-form questions
        addMsg({ role: 'bot', type: 'text', content: 'Have you had a recent stroke or heart attack in the past 6 months?\n• Yes / No' })
        setPreProcStep('q_stroke')
      }
      return
    }

    if (preProcStep === 'q_stroke') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nHave you had a recent stroke or heart attack in the past 6 months?\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      setFormAnswers(prev => ({ ...prev, stroke_heartAtt_last6mths: val }))
      addMsg({ role: 'bot', type: 'text', content: 'Have you been hospitalised in the past 3 months?\n• Yes / No' })
      setPreProcStep('q_admission')
    } else if (preProcStep === 'q_admission') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nHave you been hospitalised in the past 3 months?\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      setFormAnswers(prev => ({ ...prev, last3mths_admission: val }))
      addMsg({ role: 'bot', type: 'text', content: 'Are you on antibiotics?\n• Yes / No' })
      setPreProcStep('q_antibiotics')
    } else if (preProcStep === 'q_antibiotics') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nAre you on antibiotics?\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      setFormAnswers(prev => ({ ...prev, taking_antibiotics: val }))
      addMsg({ role: 'bot', type: 'text', content: 'Are you pregnant? (if applicable)\n• Yes / No' })
      setPreProcStep('q_pregnant')
    } else if (preProcStep === 'q_pregnant') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nAre you pregnant? (if applicable)\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      // All four acknowledgement questions are now answered — show the completed form
      // before confirming the treatment eye.
      const answered = { ...formAnswers, pregnant: val }
      setFormAnswers(answered)
      addMsg({ role: 'bot', type: 'text', content: 'Thank you. Here is your Pre-Procedure Acknowledgement Form.' })
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
      addMsg({ role: 'bot', type: 'text', content: 'Would you like to proceed with financial counselling now?\n• Yes / No' })
      setPreProcStep('q_financial_counselling')
    } else if (preProcStep === 'q_financial_counselling') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nWould you like to proceed with financial counselling now?\n• Yes / No' })
        return
      }
      if (lower.startsWith('n')) {
        setPreProcStep('complete')
        setLoading(true)
        addMsg({ role: 'bot', type: 'text', content: "No problem. I've saved your acknowledgement — you may return to the menu when you're ready." })
        try {
          await submitAcknowledgement(buildPayload(formAnswers, epicRecord))
        } catch {
          /* Save failed — acknowledgement was already displayed from local answers. */
        } finally {
          setLoading(false)
        }
        return
      }
      addMsg({ role: 'bot', type: 'text', content: 'Are you under Private or Subsidised scheme?\n• Private / Subsidised' })
      setPreProcStep('q_scheme')
    } else if (preProcStep === 'q_scheme') {
      const isPrivate = lower.includes('private')
      const isSubsidised = lower.includes('subsidised') || lower.includes('subsidized') || lower.includes('subsid')
      if (!isPrivate && !isSubsidised) {
        addMsg({ role: 'bot', type: 'text', content: "Sorry, I didn't understand that. Please answer Private or Subsidised.\n\nAre you seeking treatment under Private or Subsidised scheme?" })
        return
      }
      const recordClass = isPrivate ? 'PTE' : 'SUB'
      setFormAnswers(prev => ({ ...prev, record_class: recordClass }))
      addMsg({ role: 'bot', type: 'text', content: 'Is your procedure to be performed by Doctor or Nurse?\n• Doctor / Nurse' })
      setPreProcStep('q_performer')
    } else if (preProcStep === 'q_performer') {
      const isDoctor = lower.includes('doctor')
      const isNurse = lower.includes('nurse')
      if (!isDoctor && !isNurse) {
        addMsg({ role: 'bot', type: 'text', content: "Sorry, I didn't understand that. Please answer Doctor or Nurse.\n\nWould you like your procedure to be performed by Doctor or Nurse?" })
        return
      }
      setFormAnswers(prev => ({ ...prev, record_performer: isDoctor ? 'Doctor' : 'Nurse' }))
      addMsg({ role: 'bot', type: 'text', content: 'May I confirm your IVT treatment is for right eye or left eye?' })
      setPreProcStep('q_eye')
    } else if (preProcStep === 'q_eye') {
      const isRight = lower.includes('right') || lower.includes('od')
      const isLeft = lower.includes('left') || lower.includes('os')
      if (!isRight && !isLeft) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Right or Left.\n\nMay I confirm your IVT treatment is for right eye or left eye?' })
        return
      }
      const eyes = isLeft ? 'OS' : 'OD'
      const injections = 1
      const fallbackRange = getFallbackRange(formAnswers.record_class, formAnswers.record_performer, injections)
      let updated = {
        ...formAnswers,
        record_eyes: eyes,
        record_number_of_injections: injections,
        estimated_cost_min: fallbackRange.min,
        estimated_cost_max: fallbackRange.max,
        estimated_cost: fallbackRange.max,
        estimated_cost_range: `${fallbackRange.min} - ${fallbackRange.max}`,
      }
      try {
        const { data } = await calculateBill({
          recordClass: formAnswers.record_class,
          performer: formAnswers.record_performer,
          injections,
        })
        if (typeof data?.estimated_cost_min === 'number' && typeof data?.estimated_cost_max === 'number') {
          const rangeText = `${data.estimated_cost_min} - ${data.estimated_cost_max}`
          updated = {
            ...updated,
            estimated_cost_min: data.estimated_cost_min,
            estimated_cost_max: data.estimated_cost_max,
            estimated_cost: data.estimated_cost_max,
            estimated_cost_range: rangeText,
          }
        }
      } catch {
        // Fall back to client-side defaults when billing service is unavailable.
      }
      setFormAnswers(updated)
      setPreProcStep('cost_confirm')
      addMsg({ role: 'bot', type: 'text', content: `The total cost of the procedure will be ${formatRangeWithCurrency(updated.estimated_cost_range || `${updated.estimated_cost || DEFAULT_PROCEDURE_COST} - ${updated.estimated_cost || DEFAULT_PROCEDURE_COST}`)}, do you want to proceed?\n• Yes / No` })
    } else if (preProcStep === 'cost_confirm') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: `Sorry, I didn't understand that. Please answer Yes or No.\n\nThe total cost of the procedure will be ${formatRangeWithCurrency(formAnswers.estimated_cost_range || `${formAnswers.estimated_cost || DEFAULT_PROCEDURE_COST} - ${formAnswers.estimated_cost || DEFAULT_PROCEDURE_COST}`)}, do you want to proceed?` })
        return
      }
      if (lower.startsWith('n')) {
        // Declining the cost ends the flow, but the acknowledgement answers are still saved
        // so the four pre-procedure questions aren't lost.
        // The acknowledgement form was already shown after the four questions; declining
        // the cost just ends the flow. The answers are still persisted so they aren't lost.
        setPreProcStep('complete')
        setLoading(true)
        addMsg({ role: 'bot', type: 'text', content: "Understood. I've saved your acknowledgement — you may return to the menu when you're ready." })
        try {
          await submitAcknowledgement(buildPayload(formAnswers, epicRecord))
        } catch {
          /* Save failed — the acknowledgement was already displayed from the local answers. */
        } finally {
          setLoading(false)
        }
        return
      }
      setPreProcStep('payment_mode')
      addMsg({ role: 'bot', type: 'text', content: 'Please choose your payment mode:\n• Medishield Life / Integrated Plan\n• CSC\n• Medisave (Self)\n• MAF\n• Cash\n• NOK Medisave' })
    } else if (preProcStep === 'payment_mode') {
      const isNok = lower.includes('nok') || lower.includes('next-of-kin') || lower.includes('next of kin')
      const isMedisaveSelf = (lower.includes('medisave') && !isNok) || lower.includes('self')
      const isMediShield = lower.includes('medishield') || lower.includes('integrated plan') || lower.includes('integrated') || lower === 'life' || lower === 'ip'
      const isCsc = lower === 'csc' || lower.includes('csc')
      const isMaf = lower === 'maf' || lower.includes('maf')
      const isCash = lower === 'cash' || lower.includes('cash')
      if (!isNok && !isMedisaveSelf && !isMediShield && !isCsc && !isMaf && !isCash) {
        addMsg({ role: 'bot', type: 'text', content: "Sorry, I didn't understand that. Please choose one: Medishield Life / Integrated Plan, CSC, Medisave (Self), MAF, Cash, or NOK Medisave." })
        return
      }
      const paymentMode = isNok
        ? 'NOK Medisave'
        : isMediShield
          ? 'Medishield Life / Integrated Plan'
          : isCsc
            ? 'CSC'
            : isMaf
              ? 'MAF'
              : isCash
                ? 'Cash'
                : 'Medisave (Self)'
      const updated = { ...formAnswers, payment_mode: paymentMode }
      setFormAnswers(updated)
      setPreProcStep('complete')
      setLoading(true)
      addMsg({ role: 'bot', type: 'text', content: 'Thank you. Here is your Financial Counselling & Advice Form.' })
      try {
        const res = await submitAcknowledgement(buildPayload(updated, epicRecord))
        const record = res.data.record
        const payment = res.data.payment
        const confirmedEyes = record?.record_eyes || updated.record_eyes
        // Keep epicRecord in sync so post-op checklist uses the same eye value
        setEpicRecord(prev => ({ ...(prev || {}), record_eyes: confirmedEyes }))
        addMsg({
          role: 'bot',
          type: 'financial_doc',
          content: '',
          formData: {
            patientName: record?.record_name || 'Test Patient',
            date: formatDate(record?.issued),
            surgeon: 'Dr. Koh CS',
            mcr: '0001231241',
            site: confirmedEyes,
            diagnosis: record?.record_diagnosis || 'H35.31',
            medication: record?.record_medication || epicRecord?.record_medication || '',
            estCost: updated.estimated_cost_range || `${payment?.payment_estCostPerInjection || updated.estimated_cost || DEFAULT_PROCEDURE_COST}`,
            injections: record?.record_number_of_injections || updated.record_number_of_injections || 1,
            classCode: record?.record_class || updated.record_class || '',
            performer: record?.record_performer || updated.record_performer || '',
            maxMedisaveClaimable: payment?.payment_maxMedisave || 250,
            paymentMode: payment?.payment_mode || paymentMode,
          },
        })
      } catch {
        addMsg({ role: 'bot', type: 'financial_doc', content: '', formData: { site: updated.record_eyes, estCost: updated.estimated_cost_range || `${updated.estimated_cost || DEFAULT_PROCEDURE_COST}`, injections: updated.record_number_of_injections || 1, classCode: updated.record_class || '', performer: updated.record_performer || '', maxMedisaveClaimable: 250, paymentMode } })
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    if (regStep) {
      handleRegistration(text)
      return
    }

    if (mode === 'pre_procedure') {
      if (preProcStep !== 'login' && preProcStep !== 'complete') {
        handlePreProcAnswer(text)
      }
      return
    }

    if (mode === 'welcome') setMode('general_enquiry')

    addMsg({ role: 'user', type: 'text', content: text })
    setLoading(true)
    setStreamHeartbeatCount(0)
    setShowThinkingBubble(true)

    const history = [...messages, { role: 'user', type: 'text', content: text }]
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))

    let placeholderId = null
    const controller = new AbortController()
    streamAbortRef.current = controller

    try {
      let receivedStreamChunk = false
      const streamedText = await sendChatMessageStream(history, {
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!receivedStreamChunk) {
            receivedStreamChunk = true
            setShowThinkingBubble(false)
            placeholderId = addMsg({ role: 'bot', type: 'text', content: chunk })
            return
          }

          updateMsg(placeholderId, prev => ({ content: `${prev.content}${chunk}` }))
        },
        onHeartbeat: () => {
          setStreamHeartbeatCount(prev => prev + 1)
        },
      })

      if (!receivedStreamChunk) {
        setShowThinkingBubble(false)
        addMsg({ role: 'bot', type: 'text', content: streamedText || 'No response returned from coordinator runtime.' })
      }
    } catch (streamError) {
      if (streamError?.name === 'AbortError') {
        if (placeholderId !== null) {
          removeMsg(placeholderId)
        }
        return
      }

      setShowThinkingBubble(false)

      try {
        const res = await sendChatMessage(history)
        if (placeholderId !== null) {
          updateMsg(placeholderId, { content: res.data.reply })
        } else {
          addMsg({ role: 'bot', type: 'text', content: res.data.reply })
        }
      } catch {
        if (placeholderId !== null) {
          removeMsg(placeholderId)
        }
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I encountered an error. Please try again.' })
      }
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
      setLoading(false)
      setStreamHeartbeatCount(0)
      setShowThinkingBubble(false)
    }
  }

  const showYesNo = mode === 'pre_procedure' && (preProcStep === 'ask_update' || preProcStep === 'q_stroke' || preProcStep === 'q_admission' || preProcStep === 'q_antibiotics' || preProcStep === 'q_pregnant' || preProcStep === 'q_financial_counselling' || preProcStep === 'cost_confirm')
  const showScheme = mode === 'pre_procedure' && preProcStep === 'q_scheme'
  const showPerformer = mode === 'pre_procedure' && preProcStep === 'q_performer'
  const showEye = mode === 'pre_procedure' && preProcStep === 'q_eye'
  const showPaymentMode = mode === 'pre_procedure' && preProcStep === 'payment_mode'
  const showReturnMenu = mode === 'general_enquiry' || mode === 'appointment' || (mode === 'pre_procedure' && preProcStep === 'complete') || (mode === 'post_operation' && postOpStep === 'complete')
  const inputDisabled = !regStep && (
    (mode === 'pre_procedure' && (preProcStep === 'login' || preProcStep === 'complete'))
    || (mode === 'post_operation' && (postOpStep === 'login' || postOpStep === 'complete'))
    || mode === 'appointment'
  )

  const placeholder = regStep ? 'Type your answer…'
    : mode === 'general_enquiry' ? 'Write your message'
    : mode === 'appointment' ? 'Use the calendar to choose date and time'
    : mode === 'pre_procedure' && !inputDisabled ? 'Write your answer…'
    : 'General Enquiry'

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
            />
          ))}
          {loading && showThinkingBubble && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
              <EyeLogoSVG size={26} />
              <div style={{ background: '#fff', borderRadius: '4px 20px 20px 20px', padding: '10px 16px', fontSize: '14px', color: '#777', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {`Thinking${thinkingDots}`}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips — full-width bg, centred content */}
      {(showYesNo || showScheme || showPerformer || showEye || showPaymentMode || showReturnMenu) && (
        <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ ...centered, display: 'flex', gap: '8px', padding: '10px 20px', flexWrap: 'wrap' }}>
            {showYesNo && (
              <>
                <button onClick={() => handlePreProcAnswer('Yes')} style={chipBtn}>Yes</button>
                <button onClick={() => handlePreProcAnswer('No')} style={chipBtn}>No</button>
              </>
            )}
            {showScheme && (
              <>
                <button onClick={() => handlePreProcAnswer('Private')} style={chipBtn}>Private</button>
                <button onClick={() => handlePreProcAnswer('Subsidised')} style={chipBtn}>Subsidised</button>
              </>
            )}
            {showPerformer && (
              <>
                <button onClick={() => handlePreProcAnswer('Doctor')} style={chipBtn}>Doctor</button>
                <button onClick={() => handlePreProcAnswer('Nurse')} style={chipBtn}>Nurse</button>
              </>
            )}
            {showEye && (
              <>
                <button onClick={() => handlePreProcAnswer('Right')} style={chipBtn}>Right</button>
                <button onClick={() => handlePreProcAnswer('Left')} style={chipBtn}>Left</button>
              </>
            )}
            {showPaymentMode && (
              <>
                <button onClick={() => handlePreProcAnswer('Medishield Life / Integrated Plan')} style={chipBtn}>Medishield Life / Integrated Plan</button>
                <button onClick={() => handlePreProcAnswer('CSC')} style={chipBtn}>CSC</button>
                <button onClick={() => handlePreProcAnswer('Medisave (Self)')} style={chipBtn}>Medisave (Self)</button>
                <button onClick={() => handlePreProcAnswer('MAF')} style={chipBtn}>MAF</button>
                <button onClick={() => handlePreProcAnswer('Cash')} style={chipBtn}>Cash</button>
                <button onClick={() => handlePreProcAnswer('NOK Medisave')} style={chipBtn}>NOK Medisave</button>
              </>
            )}
            {showReturnMenu && (
              <button onClick={() => handleQuickReply('Return Menu')} style={{ ...chipBtn, background: '#3B6EF8', color: '#fff' }}>
                Return Menu
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
