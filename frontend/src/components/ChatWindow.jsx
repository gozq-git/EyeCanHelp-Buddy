import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import EyeLogoSVG from './EyeLogoSVG'
import { sendChatMessage, submitAcknowledgement } from '../api/client'

let _msgId = 1
const nextId = () => ++_msgId

const INIT_FORM = { last3mths_admission: false, stroke_heartAtt_last6mths: false, record_eyes: 'OD' }
const INIT_MESSAGES = [{ id: 1, role: 'bot', type: 'welcome', content: '' }]

function buildPayload(answers) {
  return {
    patient_record: {
      patient_id: 'P001',
      record_name: 'Test Patient',
      record_diagnosis: 'H35.31',
      record_eyes: answers.record_eyes,
      record_number_of_injections: 1,
      record_validity_of_consent: true,
      record_last3mths_admission: answers.last3mths_admission,
      record_stroke_heartAtt_last6mths: answers.stroke_heartAtt_last6mths,
      record_taking_antibiotics: false,
      record_pregnant: false,
    },
    payment: {
      payment_id: 'PAY001',
      payment_name: 'Test Patient',
      payment_diagnosis: 'H35.31',
      payment_maxMedisave: 1200,
      payment_estCostPerInjection: 123,
      payment_mode: 'Medisave',
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
      addMsg({ role: 'bot', type: 'welcome', content: '' })
    }
  }

  const handleSingpassLogin = () => {
    addMsg({ role: 'user', type: 'text', content: 'Completes Login' })
    if (mode === 'post_operation') {
      addMsg({ role: 'bot', type: 'text', content: 'Thanks for signing in. Here is your post-operation checklist.' })
      addMsg({ role: 'bot', type: 'postop_doc', content: '' })
      setPostOpStep('complete')
    } else {
      addMsg({ role: 'bot', type: 'text', content: 'Thanks for signing in. We will now proceed with the form.' })
      addMsg({ role: 'bot', type: 'text', content: 'Do you have any hospital admission in the last 3 months?\n• Yes / No' })
      setPreProcStep('q_admission')
    }
  }

  const handlePreProcAnswer = async (text) => {
    setInput('')
    addMsg({ role: 'user', type: 'text', content: text })
    const lower = text.toLowerCase().trim()

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
      const updated = { ...formAnswers, record_eyes: eyes }
      setFormAnswers(updated)
      setPreProcStep('complete')
      setLoading(true)
      try {
        const res = await submitAcknowledgement(buildPayload(updated))
        const record = res.data.record
        const payment = res.data.payment
        addMsg({
          role: 'bot',
          type: 'financial_doc',
          content: '',
          formData: {
            patientName: record?.record_name || 'Test Patient',
            date: formatDate(record?.issued),
            surgeon: 'Dr. Koh CS',
            mcr: '0001231241',
            site: record?.record_eyes || eyes,
            diagnosis: record?.record_diagnosis || 'H35.31',
            estCost: payment?.payment_estCostPerInjection || 123,
            injections: record?.record_number_of_injections || 1,
            paymentMode: payment?.payment_mode || 'Medisave',
          },
        })
      } catch {
        addMsg({ role: 'bot', type: 'financial_doc', content: '', formData: { site: eyes } })
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

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

  const showYesNo = mode === 'pre_procedure' && (preProcStep === 'q_admission' || preProcStep === 'q_stroke')
  const showEye = mode === 'pre_procedure' && preProcStep === 'q_eye'
  const inputDisabled = (mode === 'pre_procedure' && (preProcStep === 'login' || preProcStep === 'complete'))
    || (mode === 'post_operation' && (postOpStep === 'login' || postOpStep === 'complete'))

  const placeholder =
    mode === 'general_enquiry' ? 'Write your message'
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
      {(showYesNo || showEye) && (
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
