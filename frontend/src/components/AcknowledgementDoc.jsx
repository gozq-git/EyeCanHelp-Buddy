import React from 'react'

// Faithful on-screen rendering of "Pre-Procedure Intravitreal (IVT) Acknowledgement
// Form": TTS letterhead + patient-sticker box, the four Yes/No questions with the
// patient's answer circled ("* Circle as appropriate"), and the signature grid.
const QUESTIONS = [
  { key: 'strokeHeartAtt', letter: 'a)', text: 'Have you had a recent stroke or heart attack in the past 6 months?' },
  { key: 'hospitalised', letter: 'b)', text: 'Have you been hospitalised in the past 3 months?' },
  { key: 'antibiotics', letter: 'c)', text: 'Are you on antibiotics?' },
  { key: 'pregnant', letter: 'd)', text: 'Are you pregnant? (if applicable)' },
]

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

function YesNo({ answer }) {
  return (
    <span style={{ display: 'inline-flex', gap: '10px', whiteSpace: 'nowrap' }}>
      <Option label="Yes" active={answer === true} />
      <Option label="No" active={answer === false} />
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

export default function AcknowledgementDoc({ formData = {} }) {
  const {
    patientName = '',
    nric = '',
    date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  } = formData

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
        <div style={{ width: '260px', aspectRatio: '360 / 82', overflow: 'hidden' }}>
          <img
            src={TTSH_LOGO_SRC}
            alt="ttsh_logo"
            style={{ width: '190%', display: 'block', marginLeft: '-1.2%', marginTop: '-5.2%' }}
          />
        </div>

        <div style={{ position: 'relative', width: '190px', minHeight: '86px', border: BORDER, padding: '5px 8px', fontSize: '10px' }}>
          <div>Name: {patientName}</div>
          <div>Date of Birth:</div>
          <div>ID: {nric}</div>
          <div>Address:</div>
          <div style={{ position: 'absolute', bottom: '8px', right: '10px', color: '#c9c9c9', fontSize: '13px' }}>
            Patient&rsquo;s sticker
          </div>
        </div>
      </div>

      {/* ── Title ────────────────────────────────────────────────── */}
      <div style={{ fontWeight: 700, fontSize: '16px', textDecoration: 'underline', margin: '16px 0 14px' }}>
        Intravitreal Injection
      </div>

      <div style={{ fontWeight: 700, fontSize: '12px' }}>Pre-Procedure Acknowledgement Form</div>
      <div style={{ fontSize: '9px', marginBottom: '6px' }}>* Circle as appropriate</div>

      {/* ── Bordered block: questions + signature grid ───────────── */}
      <div style={{ border: BORDER }}>
        <div style={{ padding: '14px 12px' }}>
          {QUESTIONS.map(q => (
            <div key={q.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontWeight: 700, minWidth: '18px' }}>{q.letter}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{q.text}</span>
              <YesNo answer={formData[q.key]} />
            </div>
          ))}
        </div>

        {/* Signature grid: 2 columns × 4 rows, matching the paper form. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: BORDER }}>
          <SigCell label="*Signature/Right Thumb Print" style={{ borderRight: BORDER }} />
          <SigCell label="Signature of Attending Nurse" />
          <SigCell label="Name *Patient / Legal Guardian" value={patientName} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label="Designation / Name of Attending Nurse" style={{ borderTop: BORDER }} />
          <SigCell label="NRIC / FIN / Passport number of * Patient / Legal Guardian" value={nric} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label="Name / Signature of Interpreter" style={{ borderTop: BORDER }} />
          <SigCell label="Date" value={date} style={{ borderTop: BORDER, borderRight: BORDER }} />
          <SigCell label="Language of interpretation" style={{ borderTop: BORDER }} />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={{ textAlign: 'right', fontSize: '10px', marginTop: '10px' }}>MEC-MEY-388-01</div>
      <div style={{ fontSize: '9px', color: '#333', marginTop: '10px' }}>
        Note: All parts of the consent form need to be completed. Write &ldquo;NA&rdquo; if not relevant.
      </div>
    </div>
  )
}
