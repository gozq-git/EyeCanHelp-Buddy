import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import EyeLogoSVG from './EyeLogoSVG'
import { sendChatMessage, submitAcknowledgement, getEpicRecord, getPatient, createPatient, getLatestAcknowledgement } from '../api/client'

let _msgId = 1
const nextId = () => ++_msgId

const INIT_FORM = { last3mths_admission: false, stroke_heartAtt_last6mths: false, record_eyes: 'OD', payment_mode: 'Medisave' }
const INIT_MESSAGES = [{ id: 1, role: 'bot', type: 'welcome', content: '' }]

// Total cost shown to the patient before payment-mode selection. Mirrors the default
// in FinancialCounsellingDoc and the payment.payment_estCostPerInjection used by buildPayload.
const PROCEDURE_COST = 123

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
      record_number_of_injections: epicRecord?.record_number_of_injections || 1,
      record_validity_of_consent: true,
      record_last3mths_admission: answers.last3mths_admission,
      record_stroke_heartAtt_last6mths: answers.stroke_heartAtt_last6mths,
      record_taking_antibiotics: epicRecord?.record_taking_antibiotics || false,
      record_pregnant: epicRecord?.record_pregnant || false,
    },
    payment: {
      payment_id: `PAY-${patientId}-${Date.now()}`,
      payment_name: patientName,
      payment_diagnosis: diagnosis,
      payment_maxMedisave: 2150,
      payment_estCostPerInjection: 123,
      payment_mode: answers.payment_mode || 'Medisave',
    },
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

export default function ChatWindow() {
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
  const bottomRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return () => clearTimeout(t)
  }, [messages])

  const addMsg = (msg) => setMessages(prev => [...prev, { id: nextId(), ...msg }])

  const handleQuickReply = (label) => {
    addMsg({ role: 'user', type: 'text', content: label })

    if (label === 'General Enquiry') {
      setMode('general_enquiry')
      addMsg({ role: 'bot', type: 'text', content: 'Sure, I can assist to answer general enquiries about the eye procedures or surgery.' })
    } else if (label === 'Fill up pre-procedure') {
      setMode('pre_procedure')
      setPreProcStep('login')
      setFormAnswers(INIT_FORM)
      addMsg({ role: 'bot', type: 'text', content: 'To proceed with the form, would you please sign in below?' })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (label === 'Fill up post-operation checklist') {
      setMode('post_operation')
      setPostOpStep('login')
      addMsg({ role: 'bot', type: 'text', content: 'To proceed with the checklist, would you please sign in below?' })
      addMsg({ role: 'bot', type: 'singpass', content: '' })
    } else if (label === 'Return Menu') {
      setMode('welcome')
      setPreProcStep('login')
      setPostOpStep('login')
      setFormAnswers(INIT_FORM)
      setEpicRecord(null)
      setCurrentPatientId(null)
      setRegStep(null)
      setRegData({ patient_id: '', patient_name: '', patient_dob: '', phone_number: '' })
      addMsg({ role: 'bot', type: 'welcome', content: '' })
    }
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
          addMsg({ role: 'bot', type: 'text', content: 'We will now proceed with the form.\n\nDo you have any hospital admission in the last 3 months?\n• Yes / No' })
          setPreProcStep('q_admission')
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
              estCost: 123,
              injections: latest.record_number_of_injections || 1,
              paymentMode: 'Medisave',
            },
          })
        } catch {
          // No prior record saved — fall back to EPIC data
          setPreProcStep('complete')
          addMsg({ role: 'bot', type: 'text', content: 'Here is your existing form.' })
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
              estCost: 123,
              injections: epicRecord?.record_number_of_injections || 1,
              paymentMode: 'Medisave',
            },
          })
        } finally {
          setLoading(false)
        }
      } else {
        // Update — proceed to the 3 questions
        addMsg({ role: 'bot', type: 'text', content: 'Do you have any hospital admission in the last 3 months?\n• Yes / No' })
        setPreProcStep('q_admission')
      }
      return
    }

    if (preProcStep === 'q_admission') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nDo you have any hospital admission in the last 3 months?\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      setFormAnswers(prev => ({ ...prev, last3mths_admission: val }))
      addMsg({ role: 'bot', type: 'text', content: 'Any recent heart attack / stroke in last 6 months?\n• Yes / No' })
      setPreProcStep('q_stroke')
    } else if (preProcStep === 'q_stroke') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Yes or No.\n\nAny recent heart attack / stroke in last 6 months?\n• Yes / No' })
        return
      }
      const val = lower.startsWith('y')
      setFormAnswers(prev => ({ ...prev, stroke_heartAtt_last6mths: val }))
      addMsg({ role: 'bot', type: 'text', content: 'May I confirm your IVT treatment is for right eye, left eye or both?' })
      setPreProcStep('q_eye')
    } else if (preProcStep === 'q_eye') {
      const isRight = lower.includes('right') || lower.includes('od')
      const isLeft = lower.includes('left') || lower.includes('os')
      const isBoth = lower.includes('both') || lower.includes('bilat') || lower.includes('ou')
      if (!isRight && !isLeft && !isBoth) {
        addMsg({ role: 'bot', type: 'text', content: 'Sorry, I didn\'t understand that. Please answer Right, Left, or Both.\n\nMay I confirm your IVT treatment is for right eye, left eye or both?' })
        return
      }
      const eyes = isBoth ? 'OU' : isLeft ? 'OS' : 'OD'
      setFormAnswers(prev => ({ ...prev, record_eyes: eyes }))
      setPreProcStep('cost_confirm')
      addMsg({ role: 'bot', type: 'text', content: `The total cost of the procedure will be $${PROCEDURE_COST}, do you want to proceed?\n• Yes / No` })
    } else if (preProcStep === 'cost_confirm') {
      if (!lower.startsWith('y') && !lower.startsWith('n')) {
        addMsg({ role: 'bot', type: 'text', content: `Sorry, I didn't understand that. Please answer Yes or No.\n\nThe total cost of the procedure will be $${PROCEDURE_COST}, do you want to proceed?` })
        return
      }
      if (lower.startsWith('n')) {
        setPreProcStep('complete')
        addMsg({ role: 'bot', type: 'text', content: "Understood. You may return to the menu when you're ready." })
        return
      }
      setPreProcStep('payment_mode')
      addMsg({ role: 'bot', type: 'text', content: 'Would you like to use your Medisave or Next-of-Kin (NOK) Medisave?' })
    } else if (preProcStep === 'payment_mode') {
      const isNok = lower.includes('nok') || lower.includes('next-of-kin') || lower.includes('next of kin')
      const isMedisave = lower.includes('medisave')
      if (!isNok && !isMedisave) {
        addMsg({ role: 'bot', type: 'text', content: "Sorry, I didn't understand that. Please answer Medisave or NOK Medisave." })
        return
      }
      const paymentMode = isNok ? 'NOK Medisave' : 'Medisave'
      const updated = { ...formAnswers, payment_mode: paymentMode }
      setFormAnswers(updated)
      setPreProcStep('complete')
      setLoading(true)
      addMsg({ role: 'bot', type: 'text', content: 'I will now redirect you to fill up the Medisave form.' })
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
            estCost: payment?.payment_estCostPerInjection || PROCEDURE_COST,
            injections: record?.record_number_of_injections || 1,
            paymentMode: payment?.payment_mode || paymentMode,
          },
        })
      } catch {
        addMsg({ role: 'bot', type: 'financial_doc', content: '', formData: { site: updated.record_eyes, paymentMode } })
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

    const history = [...messages, { role: 'user', type: 'text', content: text }]
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))

    try {
      const res = await sendChatMessage(history)
      addMsg({ role: 'bot', type: 'text', content: res.data.reply })
    } catch {
      addMsg({ role: 'bot', type: 'text', content: 'Sorry, I encountered an error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const showYesNo = mode === 'pre_procedure' && (preProcStep === 'ask_update' || preProcStep === 'q_admission' || preProcStep === 'q_stroke' || preProcStep === 'cost_confirm')
  const showEye = mode === 'pre_procedure' && preProcStep === 'q_eye'
  const showPaymentMode = mode === 'pre_procedure' && preProcStep === 'payment_mode'
  const showReturnMenu = (mode === 'pre_procedure' && preProcStep === 'complete') || (mode === 'post_operation' && postOpStep === 'complete')
  const inputDisabled = !regStep && (
    (mode === 'pre_procedure' && (preProcStep === 'login' || preProcStep === 'complete'))
    || (mode === 'post_operation' && (postOpStep === 'login' || postOpStep === 'complete'))
  )

  const placeholder = regStep ? 'Type your answer…'
    : mode === 'general_enquiry' ? 'Write your message'
    : mode === 'pre_procedure' && !inputDisabled ? 'Write your answer…'
    : 'General Enquiry'

  const centered = { maxWidth: '900px', margin: '0 auto', width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f7f8fc' }}>
      {/* Header — full-width bg, centred content */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E8E8', flexShrink: 0 }}>
        <div style={{ ...centered, display: 'flex', alignItems: 'center', padding: '0 20px', height: '64px', gap: '12px' }}>
          <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#555', padding: '4px 8px' }}>
            ←
          </button>
          <EyeLogoSVG size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#3B6EF8', fontSize: '16px', lineHeight: '1.2' }}>EyeCanHelp</div>
            <div style={{ fontSize: '12px', color: '#4CAF50', lineHeight: '1.2' }}>● Online</div>
          </div>
          <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>♪</button>
          <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>↑</button>
        </div>
      </div>

      {/* Messages — scrollable, centred content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...centered, padding: '16px 20px' }}>
          {messages.map(m => (
            <MessageBubble
              key={m.id}
              role={m.role}
              type={m.type}
              content={m.content}
              formData={m.formData}
              onQuickReply={handleQuickReply}
              onSingpassLogin={handleSingpassLogin}
            />
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
              <EyeLogoSVG size={26} />
              <div style={{ background: '#fff', borderRadius: '4px 20px 20px 20px', padding: '10px 16px', fontSize: '14px', color: '#777', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips — full-width bg, centred content */}
      {(showYesNo || showEye || showPaymentMode || showReturnMenu) && (
        <div style={{ background: '#fff', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ ...centered, display: 'flex', gap: '8px', padding: '10px 20px', flexWrap: 'wrap' }}>
            {showYesNo && (
              <>
                <button onClick={() => handlePreProcAnswer('Yes')} style={chipBtn}>Yes</button>
                <button onClick={() => handlePreProcAnswer('No')} style={chipBtn}>No</button>
              </>
            )}
            {showEye && (
              <>
                <button onClick={() => handlePreProcAnswer('Right')} style={chipBtn}>Right</button>
                <button onClick={() => handlePreProcAnswer('Left')} style={chipBtn}>Left</button>
                <button onClick={() => handlePreProcAnswer('Both')} style={chipBtn}>Both</button>
              </>
            )}
            {showPaymentMode && (
              <>
                <button onClick={() => handlePreProcAnswer('Medisave')} style={chipBtn}>Medisave</button>
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
