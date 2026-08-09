import React from 'react'

const DIAGNOSIS_MAP = {
  'H35.31': 'amd_age_related',
  'H36.0': 'macular_edema',
  'H34.8': 'macular_other_causes',
}

const EYE_MAP = { OD: 'Right', OS: 'Left', OU: 'Both' }

const ALL_CONDITIONS = [
  'amd_age_related',
  'macular_other_causes',
  'macular_edema',
]

const COPY = {
  en: {
    title: 'POST INTRAVITREAL INJECTION INFORMATION SHEET',
    youHave: 'You have:',
    conditions: {
      amd_age_related: 'Age-related macular degeneration',
      macular_other_causes: 'Other causes of macular degeneration',
      macular_edema: 'Macular edema',
    },
    receivedInjection: 'You have received an injection into your eye:',
    intravitreal: 'Intravitreal',
    others: 'Others',
    right: 'Right',
    left: 'Left',
    eyeOn: 'eye on',
    mildEffectsIntro: 'It is normal to experience mild side effects such as:',
    mildEffects: [
      'Eye discomfort',
      'Superficial bleeding (subconjunctival hemorrhage)',
      'Floaters (due to small air bubbles)',
    ],
    warningIntro: 'However, if you have:',
    warnings: [
      'Eye pain',
      'Increased blurring of vision',
      'Increasing eye redness',
      'Light sensitivity',
      'Numbness or weakness of your limbs',
      'Chest pain or chest tightness',
    ],
    contactIntroPrefix: 'You should',
    contactIntroEmphasis: 'immediately',
    contactIntroSuffix: 'contact:',
    officeHours: 'During office hours (8:30am to 5:30pm, weekdays):',
    callNow: 'Please call',
    afterHours: 'After office hours (including weekends and public holidays):',
    afterHoursCall: 'Call eye doctor on call via TTSH operator at',
    afterHoursOr: 'OR',
    walkIn: 'Walk in to TTSH Emergency Department',
    bringSheet: '(together with this information sheet at)',
    footerDate: '03 July 2015',
  },
  zh: {
    title: '玻璃体内注射后信息表',
    youHave: '您的情况：',
    conditions: {
      amd_age_related: '与年龄相关的黄斑变性',
      macular_other_causes: '其他原因导致的黄斑变性',
      macular_edema: '黄斑水肿',
    },
    receivedInjection: '您已在眼内接受以下注射：',
    intravitreal: '玻璃体内注射',
    others: '其他',
    right: '右眼',
    left: '左眼',
    eyeOn: '注射日期',
    mildEffectsIntro: '出现以下轻微副作用属正常情况：',
    mildEffects: [
      '眼部不适',
      '表层出血（结膜下出血）',
      '飞蚊感（由于微小气泡）',
    ],
    warningIntro: '但如果您出现以下症状：',
    warnings: [
      '眼痛',
      '视力进一步模糊',
      '眼红加重',
      '畏光',
      '肢体麻木或无力',
      '胸痛或胸闷',
    ],
    contactIntroPrefix: '请',
    contactIntroEmphasis: '立即',
    contactIntroSuffix: '联系：',
    officeHours: '办公时间（工作日 8:30am 至 5:30pm）：',
    callNow: '请致电',
    afterHours: '非办公时间（包括周末及公共假期）：',
    afterHoursCall: '请通过 TTSH 总机联系值班眼科医生，电话',
    afterHoursOr: '或',
    walkIn: '直接前往 TTSH 急诊部',
    bringSheet: '（并携带本信息表）',
    footerDate: '2015年07月03日',
  },
  ms: {
    title: 'LEMBARAN MAKLUMAT SELEPAS SUNTIKAN INTRAVITREAL',
    youHave: 'Anda mempunyai:',
    conditions: {
      amd_age_related: 'Degenerasi makula berkaitan usia',
      macular_other_causes: 'Punca lain degenerasi makula',
      macular_edema: 'Edema makula',
    },
    receivedInjection: 'Anda telah menerima suntikan ke dalam mata anda:',
    intravitreal: 'Intravitreal',
    others: 'Lain-lain',
    right: 'Kanan',
    left: 'Kiri',
    eyeOn: 'mata pada',
    mildEffectsIntro: 'Adalah normal untuk mengalami kesan sampingan ringan seperti:',
    mildEffects: [
      'Ketidakselesaan mata',
      'Pendarahan permukaan (pendarahan subkonjunktiva)',
      'Floaters (disebabkan gelembung udara kecil)',
    ],
    warningIntro: 'Namun, jika anda mengalami:',
    warnings: [
      'Sakit mata',
      'Penglihatan semakin kabur',
      'Kemerahan mata yang meningkat',
      'Sensitif kepada cahaya',
      'Kebas atau lemah pada anggota badan',
      'Sakit dada atau dada ketat',
    ],
    contactIntroPrefix: 'Anda perlu',
    contactIntroEmphasis: 'segera',
    contactIntroSuffix: 'menghubungi:',
    officeHours: 'Semasa waktu pejabat (8:30am hingga 5:30pm, hari bekerja):',
    callNow: 'Sila hubungi',
    afterHours: 'Selepas waktu pejabat (termasuk hujung minggu dan cuti umum):',
    afterHoursCall: 'Hubungi doktor mata bertugas melalui operator TTSH di',
    afterHoursOr: 'ATAU',
    walkIn: 'Datang terus ke Jabatan Kecemasan TTSH',
    bringSheet: '(bersama helaian maklumat ini di)',
    footerDate: '03 Julai 2015',
  },
  ta: {
    title: 'INTRAVITREAL ஊசி செலுத்தலுக்குப் பிந்தைய தகவல் தாள்',
    youHave: 'உங்களிடம் உள்ளது:',
    conditions: {
      amd_age_related: 'வயதுசார் மகுலா சிதைவு',
      macular_other_causes: 'மகுலா சிதைவிற்கான பிற காரணங்கள்',
      macular_edema: 'மகுலா வீக்கம்',
    },
    receivedInjection: 'உங்கள் கண்ணில் கீழ்க்கண்ட ஊசி செலுத்தப்பட்டுள்ளது:',
    intravitreal: 'Intravitreal',
    others: 'மற்றவை',
    right: 'வலது',
    left: 'இடது',
    eyeOn: 'கண் - தேதி',
    mildEffectsIntro: 'கீழ்க்கண்ட மிதமான பக்கவிளைவுகள் சாதாரணம்:',
    mildEffects: [
      'கண் அசௌகரியம்',
      'மேற்பரப்பு இரத்தக்கசிவு (subconjunctival hemorrhage)',
      'மிதக்கும் புள்ளிகள் (சிறிய காற்றுக் குமிழ்களால்)',
    ],
    warningIntro: 'ஆனால், உங்களுக்கு பின்வரும் அறிகுறிகள் இருந்தால்:',
    warnings: [
      'கண் வலி',
      'பார்வை மேலும் மங்குதல்',
      'கண் சிவப்பு அதிகரித்தல்',
      'ஒளியின்மை சகிப்புத்தன்மை',
      'கைகள்/கால்களில் உணர்வு இழப்பு அல்லது பலவீனம்',
      'மார்பு வலி அல்லது மார்பு இறுக்கம்',
    ],
    contactIntroPrefix: 'நீங்கள்',
    contactIntroEmphasis: 'உடனடியாக',
    contactIntroSuffix: 'தொடர்பு கொள்ள வேண்டும்:',
    officeHours: 'அலுவலக நேரம் (8:30am முதல் 5:30pm வரை, வேலை நாட்கள்):',
    callNow: 'தயவு செய்து அழைக்கவும்',
    afterHours: 'அலுவலக நேரத்திற்குப் பிறகு (வார இறுதி மற்றும் பொது விடுமுறை உட்பட):',
    afterHoursCall: 'TTSH ஒபரேட்டர் மூலம் கண் மருத்துவரை தொடர்பு கொள்ளவும்',
    afterHoursOr: 'அல்லது',
    walkIn: 'TTSH அவசர சிகிச்சைப் பிரிவிற்கு நேரடியாக செல்லவும்',
    bringSheet: '(இந்த தகவல் தாளுடன்)',
    footerDate: '03 ஜூலை 2015',
  },
}

// Labels match the source form verbatim (note "Eyelea"); aliases cover the
// clinical spellings we may receive in record_medication.
const MED_OPTIONS = [
  { value: 'lucentis', label: 'Lucentis', aliases: ['lucentis', 'ranibizumab'] },
  { value: 'avastin', label: 'Avastin', aliases: ['avastin', 'bevacizumab'] },
  { value: 'eyelea', label: 'Eyelea', aliases: ['eyelea', 'eylea', 'aflibercept'] },
  { value: 'others', label: 'Others', aliases: [] },
]

const black = '#1a1a1a'

function CB({ checked, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: black, pointerEvents: 'none', userSelect: 'none', marginBottom: '6px' }}>
      <input
        type="checkbox"
        checked={!!checked}
        readOnly
        style={{ width: '15px', height: '15px', margin: 0, flexShrink: 0, pointerEvents: 'none', accentColor: black }}
      />
      {label}
    </label>
  )
}

export default function PostIvtAdviceDoc({ formData, language = 'en' }) {
  const copy = COPY[language] || COPY.en
  const diagnosis = formData?.record_diagnosis || 'H35.31'
  const condition = DIAGNOSIS_MAP[diagnosis] || 'amd_age_related'
  const eye = EYE_MAP[formData?.record_eyes] || null
  const medication = formData?.record_medication || 'Eylea (Aflibercept)'
  const locale = language === 'zh' ? 'zh-SG' : language === 'ms' ? 'ms-MY' : language === 'ta' ? 'ta-SG' : 'en-GB'
  const date = formData?.issued
    ? new Date(formData.issued).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })

  const medLower = medication.toLowerCase()
  const activeMed = (MED_OPTIONS.find(o => o.aliases.some(a => medLower.includes(a))) || MED_OPTIONS.at(-1)).value

  const underlineFill = { textDecoration: 'underline', fontWeight: 700 }

  return (
    <div style={{
      border: '1px solid #bbb',
      borderRadius: '8px',
      padding: '18px 20px',
      background: '#fff',
      color: black,
      fontFamily: '"Times New Roman", Georgia, serif',
      fontSize: '12px',
      lineHeight: '1.5',
    }}>
      {/* Letterhead — NHG Eye Institute + Tan Tock Seng Hospital logos, cropped
          from the source form image (700x904) which has a thin black page frame
          on every edge. We show only source rect x:[8,692], y:[34,94] so the
          top and left/right frame lines are cropped out.
          Knobs (source px): L/R = 8/692 (→ Wv 684), T = 34, band height 60.
          Percentages are width-relative (margin %s resolve against width), so
          the crop scales with the card. */}
      <div style={{ width: '100%', aspectRatio: '684 / 60', overflow: 'hidden', marginBottom: '12px' }}>
        <img
          src="/postivt-letterhead.png"
          alt="National Healthcare Group Eye Institute and Tan Tock Seng Hospital"
          style={{ width: '102.34%', display: 'block', marginLeft: '-1.17%', marginTop: '-4.97%' }}
        />
      </div>

      <h2 style={{ fontSize: '14px', fontWeight: 700, textDecoration: 'underline', margin: '0 0 14px' }}>
        {copy.title}
      </h2>

      {/* You have: */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ marginBottom: '8px' }}>{copy.youHave}</div>
        <div style={{ paddingLeft: '40px' }}>
          {ALL_CONDITIONS.map(c => (
            <CB key={c} checked={c === condition} label={copy.conditions[c] || c} />
          ))}
        </div>
      </div>

      {/* Injection details */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ marginBottom: '6px' }}>{copy.receivedInjection}</div>
        <div style={{ display: 'flex', gap: '20px', paddingLeft: '0' }}>
          <span>{copy.intravitreal}</span>
          <span>
            {MED_OPTIONS.map((med, i) => (
              <span key={med.value}>
                {i > 0 && ' / '}
                <span style={med.value === activeMed ? underlineFill : {}}>{med.value === 'others' ? copy.others : med.label}</span>
              </span>
            ))}
            {'  '}<span style={{ borderBottom: `1px solid ${black}`, display: 'inline-block', minWidth: '120px' }}>&nbsp;</span>
          </span>
        </div>
        <div style={{ paddingLeft: '92px', marginTop: '6px' }}>
          <span style={(eye === 'Right' || eye === 'Both') ? underlineFill : {}}>{copy.right}</span>
          {' / '}
          <span style={(eye === 'Left' || eye === 'Both') ? underlineFill : {}}>{copy.left}</span>
          {' '}{copy.eyeOn}{' '}
          <span style={{ borderBottom: `1px solid ${black}`, display: 'inline-block', minWidth: '220px', fontWeight: 700, textAlign: 'center' }}>
            {date}
          </span>
        </div>
      </div>

      {/* Normal side effects */}
      <div style={{ marginBottom: '14px' }}>
        <div>{copy.mildEffectsIntro}</div>
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          {copy.mildEffects.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Warning symptoms — black, matching the form (not red) */}
      <div style={{ marginBottom: '14px' }}>
        <div>{copy.warningIntro}</div>
        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
          {copy.warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Contact — single bordered box, office- then after-hours stacked */}
      <div style={{ marginBottom: '4px' }}>
        {copy.contactIntroPrefix} <span style={{ textDecoration: 'underline' }}>{copy.contactIntroEmphasis}</span> {copy.contactIntroSuffix}
      </div>
      <div style={{ border: `1px solid ${black}`, padding: '12px 16px' }}>
        <div>{copy.officeHours}</div>
        <ul style={{ margin: '4px 0 12px 18px', padding: 0 }}>
          <li>{copy.callNow} <strong>81263632</strong></li>
        </ul>
        <div>{copy.afterHours}</div>
        <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
          <li>{copy.afterHoursCall} <strong>6256 6011</strong> {copy.afterHoursOr}</li>
          <li>{copy.walkIn}<br />{copy.bringSheet}</li>
        </ul>
        <div style={{ paddingLeft: '40px', lineHeight: '1.5' }}>
          Tan Tock Seng Hospital<br />
          Basement 1<br />
          11 Jalan Tan Tock Seng<br />
          Singapore 308433
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '10px', color: '#555' }}>
        <span>{copy.footerDate}</span>
        <span>MEC-MEY-155-03</span>
      </div>
    </div>
  )
}
