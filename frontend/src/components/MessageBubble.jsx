import React from 'react'
import EyeLogoSVG from './EyeLogoSVG'
import SingpassLoginButton from './SingpassLoginButton'
import FinancialCounsellingDoc from './FinancialCounsellingDoc'
import PostOpChecklistDoc from './PostOpChecklistDoc'

const QUICK_REPLY_OPTIONS = [
  'General Enquiry',
  'Fill up pre-procedure',
  'Fill up post-operation checklist',
  'Return Menu',
]

function WelcomeContent({ onQuickReply }) {
  return (
    <div style={{ padding: '8px 4px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', fontSize: '22px', marginBottom: '8px' }}>✏️</div>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', margin: '0 0 2px' }}>
        Hi, I am EyeCanHelp Buddy,
      </p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', margin: '0 0 12px' }}>
        how can I assist you today?
      </p>
      <p style={{ textAlign: 'center', fontSize: '14px', color: '#555', margin: '0 0 14px', fontWeight: 600 }}>
        I can assist with the following:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {QUICK_REPLY_OPTIONS.map(option => (
          <button
            key={option}
            onClick={() => onQuickReply(option)}
            style={{
              padding: '14px',
              borderRadius: '24px',
              background: '#F0F0F0',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#333',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MessageBubble({ role, type, content, formData, onQuickReply, onSingpassLogin }) {
  const isUser = role === 'user'

  if (type === 'welcome') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <WelcomeContent onQuickReply={onQuickReply} />
      </div>
    )
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <div style={{
          maxWidth: '72%',
          padding: '10px 16px',
          borderRadius: '20px 4px 20px 20px',
          background: '#3B6EF8',
          color: '#fff',
          fontSize: '14px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
        }}>
          {content}
        </div>
      </div>
    )
  }

  if (type === 'financial_doc') {
    return (
      <div style={{ marginBottom: '12px', maxWidth: '620px' }}>
        <FinancialCounsellingDoc formData={formData} />
      </div>
    )
  }

  if (type === 'postop_doc') {
    return (
      <div style={{ marginBottom: '12px', maxWidth: '620px' }}>
        <PostOpChecklistDoc />
      </div>
    )
  }

  if (type === 'singpass') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px' }}>
        <EyeLogoSVG size={24} />
        <div style={{ flex: 1, maxWidth: '80%' }}>
          <SingpassLoginButton onLogin={onSingpassLogin} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '8px' }}>
      <EyeLogoSVG size={24} />
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: '4px 20px 20px 20px',
        background: '#F0F0F0',
        color: '#222',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  )
}
