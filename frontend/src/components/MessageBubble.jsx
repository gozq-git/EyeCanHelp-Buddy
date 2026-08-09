import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import EyeLogoSVG from './EyeLogoSVG'
import SingpassLoginButton from './SingpassLoginButton'
import FinancialCounsellingDoc from './FinancialCounsellingDoc'
import PostIvtAdviceDoc from './PostIvtAdviceDoc'
import AcknowledgementDoc from './AcknowledgementDoc'

const QUICK_REPLY_OPTIONS = [
  {
    id: 'general_enquiry',
    label: {
      en: 'General Enquiry',
      zh: '一般咨询',
      ms: 'Pertanyaan Umum',
      ta: 'பொது விசாரணை',
    },
  },
  {
    id: 'pre_procedure',
    label: {
      en: 'Fill up IVT Pre-Procedure Acknowledgement Form',
      zh: '填写 IVT 术前确认表',
      ms: 'Isi Borang Pengesahan Pra-Prosedur IVT',
      ta: 'IVT முன் செயல்முறை ஒப்புதல் படிவத்தை நிரப்பவும்',
    },
  },
  {
    id: 'post_operation',
    label: {
      en: 'View Post-IVT Advice Form',
      zh: '查看 IVT 术后建议表',
      ms: 'Lihat Borang Nasihat Pasca-IVT',
      ta: 'IVT பிந்தைய ஆலோசனை படிவத்தைப் பார்க்கவும்',
    },
  },
  {
    id: 'appointment',
    label: {
      en: 'Book Appointment',
      zh: '预约',
      ms: 'Tempah Temu Janji',
      ta: 'நேர்முக சந்திப்பை முன்பதிவு செய்யவும்',
    },
  },
]

const RETURN_MENU_LABEL = {
  en: 'Return Menu',
  zh: '返回菜单',
  ms: 'Kembali ke Menu',
  ta: 'மெனுவிற்கு திரும்பவும்',
}

const WELCOME_TEXT = {
  en: {
    title1: 'Hi, I am EyeCanHelp Buddy,',
    title2: 'how can I assist you today?',
    subtitle: 'I can assist with the following:',
  },
  zh: {
    title1: '您好，我是 EyeCanHelp Buddy，',
    title2: '今天我可以如何协助您？',
    subtitle: '我可以协助以下事项：',
  },
  ms: {
    title1: 'Hai, saya EyeCanHelp Buddy,',
    title2: 'bagaimana saya boleh membantu anda hari ini?',
    subtitle: 'Saya boleh membantu perkara berikut:',
  },
  ta: {
    title1: 'வணக்கம், நான் EyeCanHelp Buddy,',
    title2: 'இன்று நான் உங்களுக்கு எப்படி உதவலாம்?',
    subtitle: 'கீழ்க்கண்டவற்றில் நான் உதவ முடியும்:',
  },
}

const APPOINTMENT_TEXT = {
  en: {
    prompt: 'Please select your preferred day and period.',
    preferredDay: 'Preferred day',
    preferredPeriod: 'Preferred period',
    dayPlaceholder: 'Select a weekday',
    periodPlaceholder: 'Select AM or PM',
    confirm: 'Confirm appointment slot',
    hours: 'TTSH Eye Clinic Operation Hours:',
    weekdayHours: 'Monday to Friday: 8:00 AM - 5:30 PM',
  },
  zh: {
    prompt: '请选择您偏好的日期和时段。',
    preferredDay: '偏好日期',
    preferredPeriod: '偏好时段',
    dayPlaceholder: '选择工作日',
    periodPlaceholder: '选择上午或下午',
    confirm: '确认预约时段',
    hours: 'TTSH 眼科诊所营业时间：',
    weekdayHours: '周一至周五：上午 8:00 - 下午 5:30',
  },
  ms: {
    prompt: 'Sila pilih hari dan tempoh pilihan anda.',
    preferredDay: 'Hari pilihan',
    preferredPeriod: 'Tempoh pilihan',
    dayPlaceholder: 'Pilih hari bekerja',
    periodPlaceholder: 'Pilih AM atau PM',
    confirm: 'Sahkan slot janji temu',
    hours: 'Waktu Operasi Klinik Mata TTSH:',
    weekdayHours: 'Isnin hingga Jumaat: 8:00 AM - 5:30 PM',
  },
  ta: {
    prompt: 'தயவு செய்து உங்களின் விருப்பமான நாளையும் நேரப்பகுதியையும் தேர்ந்தெடுக்கவும்.',
    preferredDay: 'விருப்ப நாள்',
    preferredPeriod: 'விருப்ப நேரப்பகுதி',
    dayPlaceholder: 'வேலைநாளை தேர்ந்தெடுக்கவும்',
    periodPlaceholder: 'AM அல்லது PM தேர்ந்தெடுக்கவும்',
    confirm: 'சந்திப்பு நேரத்தை உறுதிப்படுத்தவும்',
    hours: 'TTSH கண் மருத்துவமனை செயல்பாட்டு நேரம்:',
    weekdayHours: 'திங்கள் முதல் வெள்ளி வரை: காலை 8:00 - மாலை 5:30',
  },
}

// 'Return Menu' is redundant on the first welcome bubble (you're already at the
// menu), so it's only shown on welcome bubbles re-appended later in a session.
function WelcomeContent({ onQuickReply, includeReturnMenu, language = 'en' }) {
  const options = includeReturnMenu
    ? [...QUICK_REPLY_OPTIONS, { id: 'return_menu', label: RETURN_MENU_LABEL }]
    : QUICK_REPLY_OPTIONS

  const optionLabel = (option) => option.label[language] || option.label.en
  const copy = WELCOME_TEXT[language] || WELCOME_TEXT.en
  return (
    <div style={{ padding: '8px 4px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', fontSize: '22px', marginBottom: '8px' }}>✏️</div>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', margin: '0 0 2px' }}>
        {copy.title1}
      </p>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '15px', margin: '0 0 12px' }}>
        {copy.title2}
      </p>
      <p style={{ textAlign: 'center', fontSize: '14px', color: '#555', margin: '0 0 14px', fontWeight: 600 }}>
        {copy.subtitle}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {options.map(option => (
          <button
            key={option.id}
            onClick={() => onQuickReply(option.id, optionLabel(option))}
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
            {optionLabel(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

function AppointmentPickerContent({ onAppointmentSubmit, language = 'en' }) {
  const controlStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #D8D8D8',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '14px',
    background: '#fff',
  }

  const copy = APPOINTMENT_TEXT[language] || APPOINTMENT_TEXT.en
  const weekdayOptions = [
    { value: 'Monday', label: { en: 'Monday', zh: '星期一', ms: 'Isnin', ta: 'திங்கள்' } },
    { value: 'Tuesday', label: { en: 'Tuesday', zh: '星期二', ms: 'Selasa', ta: 'செவ்வாய்' } },
    { value: 'Wednesday', label: { en: 'Wednesday', zh: '星期三', ms: 'Rabu', ta: 'புதன்' } },
    { value: 'Thursday', label: { en: 'Thursday', zh: '星期四', ms: 'Khamis', ta: 'வியாழன்' } },
    { value: 'Friday', label: { en: 'Friday', zh: '星期五', ms: 'Jumaat', ta: 'வெள்ளி' } },
  ]
  const [day, setDay] = React.useState('')
  const [period, setPeriod] = React.useState('')

  const canSubmit = day && period

  return (
    <div style={{ background: '#F0F0F0', borderRadius: '4px 20px 20px 20px', padding: '12px 14px', maxWidth: '420px' }}>
      <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#222' }}>
        {copy.prompt}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#444' }}>
          {copy.preferredDay}
          <select
            aria-label="Preferred day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={controlStyle}
          >
            <option value="">{copy.dayPlaceholder}</option>
            {weekdayOptions.map((weekday) => (
              <option key={weekday.value} value={weekday.value}>{weekday.label[language] || weekday.label.en}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#444' }}>
          {copy.preferredPeriod}
          <select
            aria-label="Preferred period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={controlStyle}
          >
            <option value="">{copy.periodPlaceholder}</option>
            <option value="AM">{language === 'en' ? 'AM' : `AM (${language === 'zh' ? '上午' : language === 'ms' ? 'Pagi' : 'காலை'})`}</option>
            <option value="PM">{language === 'en' ? 'PM' : `PM (${language === 'zh' ? '下午' : language === 'ms' ? 'Petang' : 'மாலை'})`}</option>
          </select>
        </label>
        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
          {copy.hours}
          <br />
          {copy.weekdayHours}
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
          {copy.confirm}
        </button>
      </div>
    </div>
  )
}

export default function MessageBubble({ role, type, content, formData, onQuickReply, onSingpassLogin, includeReturnMenu, onAppointmentSubmit, language = 'en' }) {
  const isUser = role === 'user'

  if (type === 'welcome') {
    return (
      <div style={{ marginBottom: '16px' }}>
        <WelcomeContent onQuickReply={onQuickReply} includeReturnMenu={includeReturnMenu} language={language} />
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
        <AcknowledgementDoc formData={formData} language={language} />
      </div>
    )
  }

  if (type === 'financial_doc') {
    return (
      <div style={{ marginBottom: '12px', maxWidth: '620px' }}>
        <FinancialCounsellingDoc formData={formData} language={language} />
      </div>
    )
  }

  if (type === 'postop_doc') {
    return (
      <div style={{ marginBottom: '12px', maxWidth: '620px' }}>
        <PostIvtAdviceDoc formData={formData} language={language} />
      </div>
    )
  }

  if (type === 'singpass') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px' }}>
        <EyeLogoSVG size={24} />
        <div style={{ flex: 1, maxWidth: '80%' }}>
          <SingpassLoginButton onLogin={onSingpassLogin} language={language} />
        </div>
      </div>
    )
  }

  if (type === 'appointment_picker') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px' }}>
        <EyeLogoSVG size={24} />
        <AppointmentPickerContent onAppointmentSubmit={onAppointmentSubmit} language={language} />
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
