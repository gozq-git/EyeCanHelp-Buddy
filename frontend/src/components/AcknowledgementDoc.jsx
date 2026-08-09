import React from 'react'

// Faithful on-screen rendering of "Pre-Procedure Intravitreal (IVT) Acknowledgement
// Form": TTS letterhead + patient-sticker box, the four Yes/No questions with the
// patient's answer circled ("* Circle as appropriate"), and the signature grid.
const QUESTIONS = {
  en: [
    { key: 'strokeHeartAtt', letter: 'a)', text: 'Have you had a recent stroke or heart attack in the past 6 months?' },
    { key: 'hospitalised', letter: 'b)', text: 'Have you been hospitalised in the past 3 months?' },
    { key: 'antibiotics', letter: 'c)', text: 'Are you on antibiotics?' },
    { key: 'pregnant', letter: 'd)', text: 'Are you pregnant? (if applicable)' },
  ],
  zh: [
    { key: 'strokeHeartAtt', letter: 'a)', text: '过去 6 个月内您是否有中风或心脏病发作？' },
    { key: 'hospitalised', letter: 'b)', text: '过去 3 个月内您是否住院？' },
    { key: 'antibiotics', letter: 'c)', text: '您目前是否在使用抗生素？' },
    { key: 'pregnant', letter: 'd)', text: '您是否怀孕？（如适用）' },
  ],
  ms: [
    { key: 'strokeHeartAtt', letter: 'a)', text: 'Adakah anda mengalami strok atau serangan jantung dalam 6 bulan lalu?' },
    { key: 'hospitalised', letter: 'b)', text: 'Adakah anda dimasukkan ke hospital dalam 3 bulan lalu?' },
    { key: 'antibiotics', letter: 'c)', text: 'Adakah anda sedang mengambil antibiotik?' },
    { key: 'pregnant', letter: 'd)', text: 'Adakah anda hamil? (jika berkenaan)' },
  ],
  ta: [
    { key: 'strokeHeartAtt', letter: 'a)', text: 'கடந்த 6 மாதங்களில் உங்களுக்கு ஸ்ட்ரோக் அல்லது இதயத் தாக்கம் ஏற்பட்டதா?' },
    { key: 'hospitalised', letter: 'b)', text: 'கடந்த 3 மாதங்களில் நீங்கள் மருத்துவமனையில் அனுமதிக்கப்பட்டீர்களா?' },
    { key: 'antibiotics', letter: 'c)', text: 'நீங்கள் தற்போது ஆன்டிபயாட்டிக் மருந்து எடுத்துக்கொள்கிறீர்களா?' },
    { key: 'pregnant', letter: 'd)', text: 'நீங்கள் கர்ப்பமாக உள்ளீர்களா? (தேவையானால்)' },
  ],
}

const FORM_COPY = {
  en: {
    name: 'Name:',
    dob: 'Date of Birth:',
    id: 'ID:',
    address: 'Address:',
    patientSticker: "Patient's sticker",
    title: 'Intravitreal Injection',
    subTitle: 'Pre-Procedure Acknowledgement Form',
    circleHint: '* Circle as appropriate',
    sigThumb: '*Signature/Right Thumb Print',
    sigNurse: 'Signature of Attending Nurse',
    sigPatientName: 'Name *Patient / Legal Guardian',
    sigNurseName: 'Designation / Name of Attending Nurse',
    sigNric: 'NRIC / FIN / Passport number of * Patient / Legal Guardian',
    sigInterpreter: 'Name / Signature of Interpreter',
    sigDate: 'Date',
    sigLanguage: 'Language of interpretation',
    footerNote: 'Note: All parts of the consent form need to be completed. Write "NA" if not relevant.',
  },
  zh: {
    name: '姓名：',
    dob: '出生日期：',
    id: '证件号：',
    address: '地址：',
    patientSticker: '患者贴纸',
    title: '玻璃体内注射',
    subTitle: '术前确认表',
    circleHint: '* 请圈出适用选项',
    sigThumb: '*签名/右手拇指印',
    sigNurse: '值班护士签名',
    sigPatientName: '*患者 / 法定监护人姓名',
    sigNurseName: '值班护士职称 / 姓名',
    sigNric: '*患者 / 法定监护人的身份证 / FIN / 护照号码',
    sigInterpreter: '翻译姓名 / 签名',
    sigDate: '日期',
    sigLanguage: '翻译语言',
    footerNote: '注：同意书所有部分均需填写。如不适用请填写“NA”。',
  },
  ms: {
    name: 'Nama:',
    dob: 'Tarikh Lahir:',
    id: 'ID:',
    address: 'Alamat:',
    patientSticker: 'Pelekat pesakit',
    title: 'Suntikan Intravitreal',
    subTitle: 'Borang Pengesahan Pra-Prosedur',
    circleHint: '* Bulatkan yang berkenaan',
    sigThumb: '*Tandatangan/Cap Ibu Jari Kanan',
    sigNurse: 'Tandatangan Jururawat Bertugas',
    sigPatientName: 'Nama *Pesakit / Penjaga Sah',
    sigNurseName: 'Jawatan / Nama Jururawat Bertugas',
    sigNric: 'NRIC / FIN / Nombor Pasport * Pesakit / Penjaga Sah',
    sigInterpreter: 'Nama / Tandatangan Penterjemah',
    sigDate: 'Tarikh',
    sigLanguage: 'Bahasa terjemahan',
    footerNote: 'Nota: Semua bahagian borang persetujuan mesti dilengkapkan. Tulis "NA" jika tidak berkaitan.',
  },
  ta: {
    name: 'பெயர்:',
    dob: 'பிறந்த தேதி:',
    id: 'அடையாள எண்:',
    address: 'முகவரி:',
    patientSticker: 'நோயாளர் ஸ்டிக்கர்',
    title: 'Intravitreal ஊசி செலுத்தல்',
    subTitle: 'முன் செயல்முறை ஒப்புதல் படிவம்',
    circleHint: '* பொருத்தமானதை வட்டமிடவும்',
    sigThumb: '*கையொப்பம்/வலது கை முதுவிரல் ரேகை',
    sigNurse: 'பணிப்புரியும் செவிலியரின் கையொப்பம்',
    sigPatientName: 'பெயர் *நோயாளர் / சட்டபூர்வ பாதுகாவலர்',
    sigNurseName: 'பதவி / பணிப்புரியும் செவிலியரின் பெயர்',
    sigNric: 'NRIC / FIN / கடவுச்சீட்டு எண் * நோயாளர் / சட்டபூர்வ பாதுகாவலர்',
    sigInterpreter: 'மொழிபெயர்ப்பாளர் பெயர் / கையொப்பம்',
    sigDate: 'தேதி',
    sigLanguage: 'மொழிபெயர்ப்பு மொழி',
    footerNote: 'குறிப்பு: ஒப்புதல் படிவத்தின் அனைத்து பகுதிகளும் நிரப்பப்பட வேண்டும். பொருந்தாத இடங்களில் "NA" என்று எழுதவும்.',
  },
}

const INK = '#1a1a1a'
const BORDER = '1px solid #222'
const TTSH_LOGO_SRC = '/ttsh_logo.png'

// One option, underlined when it is the patient's answer.
function Option({ label, active }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '30px',
        textAlign: 'center',
        fontWeight: 700,
        color: INK,
        padding: '1px 0',
        textDecoration: active ? 'underline' : 'none',
        textUnderlineOffset: '3px',
      }}
    >
      {label}
    </span>
  )
}

function YesNo({ answer, labels }) {
  return (
    <span style={{ display: 'inline-flex', gap: '10px', whiteSpace: 'nowrap' }}>
      <Option label={labels.yes} active={answer === true} />
      <Option label={labels.no} active={answer === false} />
    </span>
  )
}

// A signature-grid cell: small label pinned to the top-left, with an optional filled
// value beneath (blank space for handwriting when no value is given).
function SigCell({ label, value, style }) {
  return (
    <div style={{ padding: '4px 6px 18px', fontSize: '9px', color: '#333', ...style }}>
      {label}
      {value ? <div style={{ marginTop: '3px', color: '#1565C0', fontWeight: 600 }}>{value}</div> : null}
    </div>
  )
}

export default function AcknowledgementDoc({ formData = {}, language = 'en' }) {
  const {
    patientName = '',
    nric = '',
    date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  } = formData

  const questionSet = QUESTIONS[language] || QUESTIONS.en
  const copy = FORM_COPY[language] || FORM_COPY.en
  const labels = {
    yes: language === 'zh' ? '是' : language === 'ms' ? 'Ya' : language === 'ta' ? 'ஆம்' : 'Yes',
    no: language === 'zh' ? '否' : language === 'ms' ? 'Tidak' : language === 'ta' ? 'இல்லை' : 'No',
  }

  return (
    <div style={{
      border: '1px solid #bbb',
      borderRadius: '8px',
      padding: '18px 20px',
      background: '#fff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '11px',
      color: INK,
      lineHeight: '1.4',
    }}>
      {/* ── Letterhead + patient sticker ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: '190px' }}>
          <img
            src={TTSH_LOGO_SRC}
            alt="ttsh_logo"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        <div style={{ position: 'relative', width: '190px', minHeight: '86px', border: BORDER, padding: '5px 8px', fontSize: '10px' }}>
          <div>{copy.name} {patientName}</div>
          <div>{copy.dob}</div>
          <div>{copy.id} {nric}</div>
          <div>{copy.address}</div>
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', color: '#c9c9c9', fontSize: '13px' }}>
            {copy.patientSticker}
          </div>
        </div>
      </div>

      {/* ── Title ────────────────────────────────────────────────── */}
      <div style={{ fontWeight: 700, fontSize: '16px', textDecoration: 'underline', margin: '16px 0 14px' }}>
        {copy.title}
      </div>

      <div style={{ fontWeight: 700, fontSize: '12px' }}>{copy.subTitle}</div>
      <div style={{ fontSize: '9px', marginBottom: '6px' }}>{copy.circleHint}</div>

      {/* ── Bordered block: questions + signature grid ───────────── */}
      <div style={{ border: BORDER }}>
        <div style={{ padding: '14px 12px' }}>
          {questionSet.map(q => (
            <div key={q.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, minWidth: '18px' }}>{q.letter}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{q.text}</span>
              <YesNo answer={formData[q.key]} labels={labels} />
            </div>
          ))}
        </div>

        {/* Signature grid: 2 columns × 4 rows, matching the paper form. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: BORDER }}>
          <SigCell label={copy.sigThumb} style={{ borderRight: BORDER }} />
          <SigCell label={copy.sigNurse} />
          <SigCell label={copy.sigPatientName} value={patientName} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label={copy.sigNurseName} style={{ borderTop: BORDER }} />
          <SigCell label={copy.sigNric} value={nric} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label={copy.sigInterpreter} style={{ borderTop: BORDER }} />
          <SigCell label={copy.sigDate} value={date} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label={copy.sigLanguage} style={{ borderTop: BORDER }} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={{ textAlign: 'right', fontSize: '10px', marginTop: '10px' }}>MEC-MEY-388-01</div>
      <div style={{ fontSize: '9px', color: '#333', marginTop: '10px' }}>
        {copy.footerNote}
      </div>
    </div>
  )
}
