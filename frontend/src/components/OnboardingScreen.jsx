import React from 'react'

function RobotIllustration() {
  return (
    <svg width="260" height="260" viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Phone frame */}
      <rect x="70" y="20" width="120" height="200" rx="18" stroke="#3B6EF8" strokeWidth="3" fill="none" />
      <rect x="110" y="10" width="40" height="12" rx="6" fill="#3B6EF8" opacity="0.3" />
      {/* Robot head */}
      <rect x="90" y="50" width="80" height="65" rx="12" stroke="#3B6EF8" strokeWidth="2.5" fill="none" />
      {/* Robot eyes */}
      <circle cx="112" cy="75" r="9" stroke="#3B6EF8" strokeWidth="2.5" fill="none" />
      <circle cx="148" cy="75" r="9" stroke="#3B6EF8" strokeWidth="2.5" fill="none" />
      <circle cx="112" cy="75" r="4" fill="#3B6EF8" />
      <circle cx="148" cy="75" r="4" fill="#3B6EF8" />
      {/* Robot mouth */}
      <rect x="108" y="96" width="44" height="9" rx="4" stroke="#3B6EF8" strokeWidth="2" fill="none" />
      {/* Robot body */}
      <rect x="84" y="125" width="92" height="68" rx="10" stroke="#3B6EF8" strokeWidth="2.5" fill="none" />
      {/* Chat icon on body */}
      <rect x="100" y="140" width="60" height="36" rx="10" stroke="#3B6EF8" strokeWidth="2" fill="none" />
      <circle cx="114" cy="158" r="4.5" fill="#3B6EF8" />
      <circle cx="130" cy="158" r="4.5" fill="#3B6EF8" />
      <circle cx="146" cy="158" r="4.5" fill="#3B6EF8" />
      {/* Arms */}
      <path d="M84 145 Q58 158 52 180" stroke="#3B6EF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M176 145 Q202 158 208 180" stroke="#3B6EF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Person on right */}
      <circle cx="218" cy="110" r="16" stroke="#3B6EF8" strokeWidth="2" fill="none" />
      <path d="M205 132 Q218 155 231 132" stroke="#3B6EF8" strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="210" y="178" width="16" height="30" rx="3" stroke="#3B6EF8" strokeWidth="1.5" fill="none" />
      {/* Floating icon 1 (code) */}
      <circle cx="28" cy="60" r="18" stroke="#3B6EF8" strokeWidth="1.5" fill="none" opacity="0.7" />
      <text x="28" y="66" textAnchor="middle" fontSize="15" fill="#3B6EF8" opacity="0.7">{'{}'}</text>
      {/* Floating icon 2 (gear) */}
      <circle cx="228" cy="48" r="18" stroke="#3B6EF8" strokeWidth="1.5" fill="none" opacity="0.7" />
      <text x="228" y="54" textAnchor="middle" fontSize="16" fill="#3B6EF8" opacity="0.7">⚙</text>
      {/* Floating icon 3 (pill) */}
      <circle cx="228" cy="90" r="16" stroke="#3B6EF8" strokeWidth="1.5" fill="none" opacity="0.7" />
      <ellipse cx="228" cy="90" rx="6" ry="10" stroke="#3B6EF8" strokeWidth="1.5" fill="none" opacity="0.7" />
      <line x1="222" y1="90" x2="234" y2="90" stroke="#3B6EF8" strokeWidth="1.5" opacity="0.7" />
    </svg>
  )
}

export default function OnboardingScreen({ onContinue }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '560px', padding: '52px 32px 0', textAlign: 'center' }}>
        <h1 style={{ color: '#3B6EF8', fontSize: '26px', fontWeight: 700, margin: '0 0 14px' }}>
          You AI Assistant
        </h1>
        <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.7', margin: 0, maxWidth: '260px', marginLeft: 'auto', marginRight: 'auto' }}>
          Using this software, you can ask questions and receive answers using artificial intelligence assistant
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RobotIllustration />
      </div>

      <div style={{ width: '100%', maxWidth: '560px', padding: '24px' }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '16px',
            background: '#3B6EF8',
            color: '#fff',
            border: 'none',
            borderRadius: '28px',
            fontSize: '17px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          Continue <span>→</span>
        </button>
      </div>
    </div>
  )
}
