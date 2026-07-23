import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import EyeLogoSVG from './EyeLogoSVG'
import SingpassLoginButton from './SingpassLoginButton'
import FinancialCounsellingDoc from './FinancialCounsellingDoc'
import PostIvtAdviceDoc from './PostIvtAdviceDoc'
import AcknowledgementDoc from './AcknowledgementDoc'

const QUICK_REPLY_OPTIONS = [
  'General Enquiry',
  'Fill up IVT Pre-Procedure Acknowledgement Form',
  'View Post-IVT Advice Form',
  'Book Appointment',
]

// 'Return Menu' is redundant on the first welcome bubble (you're already at the
// menu), so it's only shown on welcome bubbles re-appended later in a session.
function WelcomeContent({ onQuickReply, includeReturnMenu }) {
  const options = includeReturnMenu
    ? [...QUICK_REPLY_OPTIONS, 'Return Menu']
    : QUICK_REPLY_OPTIONS
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
        {options.map(option => (
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

function AppointmentPickerContent({ onAppointmentSubmit }) {
  const controlStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #D8D8D8',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    background: '#fff',
  }

  const weekdayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const [day, setDay] = React.useState('')
  const [period, setPeriod] = React.useState('')

  const canSubmit = day && period

  return (
    <div style={{ background: '#F0F0F0', borderRadius: '4px 20px 20px 20px', padding: '12px 14px', maxWidth: '420px' }}>
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#222' }}>
        Please select your preferred day and period.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#444' }}>
          Preferred day
          <select
            aria-label="Preferred day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={controlStyle}
          >
            <option value="">Select a weekday</option>
            {weekdayOptions.map((weekday) => (
              <option key={weekday} value={weekday}>{weekday}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#444' }}>
          Preferred period
          <select
            aria-label="Preferred period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={controlStyle}
          >
            <option value="">Select AM or PM</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
          Appointment bookings are available from Monday to Friday.
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => onAppointmentSubmit?.({ day, period })}
          style={{
            marginTop: '2px',
            border: 'none',
            borderRadius: '16px',
            padding: '10px 12px',
            fontSize: '14px',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            background: canSubmit ? '#3B6EF8' : '#BFC8E8',
            color: '#fff',
          }}
        >
          Confirm appointment slot
        </button>
      </div>
    </div>
  )
}

export default function MessageBubble({ role, type, content, formData, onQuickReply, onSingpassLogin, includeReturnMenu, onAppointmentSubmit }) {
  const isUser = role === 'user'

  if (type === 'welcome') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <WelcomeContent onQuickReply={onQuickReply} includeReturnMenu={includeReturnMenu} />
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

  if (type === 'acknowledgement_doc') {
    return (
      <div style={{ marginBottom: '12px', maxWidth: '620px' }}>
        <AcknowledgementDoc formData={formData} />
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
        <PostIvtAdviceDoc formData={formData} />
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

  if (type === 'appointment_picker') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px' }}>
        <EyeLogoSVG size={24} />
        <AppointmentPickerContent onAppointmentSubmit={onAppointmentSubmit} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '8px' }}>
      <EyeLogoSVG size={24} />
      <div data-testid="bot-message" style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: '4px 20px 20px 20px',
        background: '#F0F0F0',
        color: '#222',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
      }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
            h2: ({ children }) => <h2 style={{ margin: '0 0 8px', fontSize: '18px' }}>{children}</h2>,
            h3: ({ children }) => <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>{children}</h3>,
            ul: ({ children }) => <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>{children}</ul>,
            li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
            blockquote: ({ children }) => (
              <blockquote style={{ margin: '0', paddingLeft: '10px', borderLeft: '3px solid #D0D0D0' }}>
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>
                {children}
              </table>
            ),
            th: ({ children }) => (
              <th style={{ border: '1px solid #D8D8D8', padding: '6px', textAlign: 'left', background: '#F8F8F8' }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{ border: '1px solid #D8D8D8', padding: '6px', verticalAlign: 'top' }}>
                {children}
              </td>
            ),
            hr: () => <hr style={{ border: 0, borderTop: '1px solid #D8D8D8', margin: '10px 0' }} />,
          }}
        >
          {content || ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}
