import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatWindow from '../components/ChatWindow'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock every API client function that ChatWindow imports. Missing mocks would cause
// `await undefined(...)` to throw inside handleSingpassLogin, pushing the UI into the
// new-patient registration branch instead of the existing-patient ask_update branch.
vi.mock('../api/client', () => ({
  sendChatMessage: vi.fn(),
  submitAcknowledgement: vi.fn(),
  getPatient: vi.fn(),
  getEpicRecord: vi.fn(),
  createPatient: vi.fn(),
  getLatestAcknowledgement: vi.fn(),
}))

// Isolate ChatWindow from SingpassLoginButton's internal 600ms timer.
// The real component calls onLogin(uppercased_username); tests use 'P001' here so
// handleSingpassLogin receives a valid id string rather than a React event object.
vi.mock('../components/SingpassLoginButton', () => ({
  default: ({ onLogin }) => (
    <button onClick={() => onLogin('P001')}>Singpass Login</button>
  ),
}))

import {
  sendChatMessage,
  submitAcknowledgement,
  getPatient,
  getEpicRecord,
  createPatient,
  getLatestAcknowledgement,
} from '../api/client'

// Canonical "existing patient" responses used by the pre/post-op flows so that
// handleSingpassLogin lands in the existing-patient branch (ask_update / postop_doc).
const MOCK_PATIENT_RESPONSE = {
  data: { patient_id: 'P001', patient_name: 'Tan Ah Kow', patient_dob: '1952-08-12', phone_number: '+6591234567' },
}
const MOCK_EPIC_RECORD_RESPONSE = {
  data: {
    patient_id: 'P001',
    record_name: 'Tan Ah Kow',
    record_diagnosis: 'H35.31',
    record_eyes: 'OD',
    record_medication: 'Faricimab (Vabysmo)',
    record_number_of_injections: 3,
    record_validity_of_consent: true,
    record_last3mths_admission: false,
    record_stroke_heartAtt_last6mths: false,
    record_taking_antibiotics: false,
    record_pregnant: false,
    record_id: 'REC-P001-001',
    issued: '2020-01-01T00:00:00',
  },
}

const MOCK_ACK_RESPONSE = {
  data: {
    record: {
      record_name: 'Test Patient',
      record_diagnosis: 'H35.31',
      record_eyes: 'OD',
      record_number_of_injections: 1,
      issued: new Date().toISOString(),
    },
    payment: {
      payment_estCostPerInjection: 123,
      payment_mode: 'Medisave',
    },
  },
}

// ─── Welcome state ────────────────────────────────────────────────────────────

describe('ChatWindow — welcome state', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the three quick-reply option pills on load (no Return Menu)', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up pre-procedure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up post-operation checklist' })).toBeInTheDocument()
    // Return Menu is redundant on the first welcome bubble — you're already at the menu.
    expect(screen.queryByRole('button', { name: 'Return Menu' })).not.toBeInTheDocument()
  })

  it('shows "General Enquiry" as the input placeholder in welcome mode', () => {
    render(<ChatWindow />)
    expect(screen.getByPlaceholderText('General Enquiry')).toBeInTheDocument()
  })

  it('input is enabled in welcome mode', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('textbox')).not.toBeDisabled()
  })
})

// ─── General Enquiry ──────────────────────────────────────────────────────────

describe('ChatWindow — General Enquiry flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendChatMessage.mockResolvedValue({ data: { reply: 'A cataract clouds the eye lens.' } })
  })

  it('clicking General Enquiry shows the bot confirmation message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(screen.getByText(/general enquiries about the eye/i)).toBeInTheDocument()
  })

  it('placeholder changes to "Write your message" in general enquiry mode', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(screen.getByPlaceholderText('Write your message')).toBeInTheDocument()
  })

  it('user message appears in the chat after pressing Enter', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is a cataract?')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText('What is a cataract?')).toBeInTheDocument()
  })

  it('bot reply is appended after sendChatMessage resolves', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is AMD?')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText('A cataract clouds the eye lens.')).toBeInTheDocument()
    })
  })

  it('sendChatMessage is called with a messages array containing the user message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'What is AMD?')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    const [messages] = sendChatMessage.mock.calls[0]
    expect(messages.some(m => m.role === 'user' && m.content === 'What is AMD?')).toBe(true)
  })

  it('shows error message in chat when sendChatMessage rejects', async () => {
    sendChatMessage.mockRejectedValueOnce(new Error('Network error'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    await userEvent.type(screen.getByRole('textbox'), 'test question')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.getByText(/encountered an error/i)).toBeInTheDocument()
    })
  })

  it('input is cleared after sending a message', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'Hello')
    await userEvent.keyboard('{Enter}')
    expect(input).toHaveValue('')
  })
})

// ─── Pre-Procedure ────────────────────────────────────────────────────────────

describe('ChatWindow — Pre-Procedure flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    // Existing patient: getPatient + getEpicRecord both resolve → flow enters ask_update
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    // No prior submission — getLatestAcknowledgement rejects so the post-op merge skips it
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  it('clicking Fill up pre-procedure shows the Singpass login button', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
  })

  it('input is disabled while waiting for Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('Yes/No chips appear after Singpass login completes', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('Yes/No chips also appear for the stroke question after q_admission is answered', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    // Existing patient → ask_update; click Yes to advance into the 3-question flow.
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // q_admission
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('Right/Left/Both eye chips appear after both Yes/No questions are answered', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' })) // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_stroke
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('record_last3mths_admission is true when user answers Yes to Q1', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // q_admission = true
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke = false
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_last3mths_admission).toBe(true)
    expect(payload.patient_record.record_stroke_heartAtt_last6mths).toBe(false)
  })

  it('record_eyes is OD when user selects Right', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
  })

  it('record_eyes is OS when user selects Left', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Left' }))  // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OS')
  })

  it('record_eyes is OU when user selects Both', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Both' }))  // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OU')
  })

  it('renders FinancialCounsellingDoc after submitAcknowledgement resolves', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => {
      expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
    })
  })

  it('renders FinancialCounsellingDoc even when submitAcknowledgement rejects (fallback)', async () => {
    submitAcknowledgement.mockRejectedValueOnce(new Error('Backend down'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit (rejects)
    await waitFor(() => {
      expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
    })
  })

  it('input is disabled after the pre-procedure flow is complete', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // ask_update
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' }))    // q_stroke
    await userEvent.click(screen.getByRole('button', { name: 'Right' })) // q_eye
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalled())
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

// ─── Pre-Procedure input validation ──────────────────────────────────────────

describe('ChatWindow — Pre-Procedure input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  async function reachStep(step) {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    // Existing patient → ask_update; click Yes to enter the 3-question flow.
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    if (step === 'q_stroke' || step === 'q_eye') {
      await userEvent.click(screen.getByRole('button', { name: 'No' })) // answer q_admission
    }
    if (step === 'q_eye') {
      await userEvent.click(screen.getByRole('button', { name: 'No' })) // answer q_stroke
    }
  }

  it('re-asks Q1 when free-text answer is unrecognised', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Yes or No/i)).toBeInTheDocument()
  })

  it('stays on q_admission step after invalid answer (Yes/No chips still shown)', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('proceeds after a valid typed answer following an invalid one (q_admission)', async () => {
    await reachStep('q_admission')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), 'no')
    await userEvent.keyboard('{Enter}')
    // Now at q_stroke — Yes/No chips still present for the next question
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('re-asks Q2 when free-text answer is unrecognised', async () => {
    await reachStep('q_stroke')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Yes or No/i)).toBeInTheDocument()
  })

  it('stays on q_stroke step after invalid answer (Yes/No chips still shown)', async () => {
    await reachStep('q_stroke')
    await userEvent.type(screen.getByRole('textbox'), 'maybe')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('re-asks Q3 when free-text answer is unrecognised', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByText(/Sorry, I didn't understand that/i)).toBeInTheDocument()
    expect(screen.getByText(/Please answer Right, Left, or Both/i)).toBeInTheDocument()
  })

  it('stays on q_eye step after invalid answer (Right/Left/Both chips still shown)', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('proceeds after a valid typed answer following an invalid one (q_eye)', async () => {
    await reachStep('q_eye')
    await userEvent.type(screen.getByRole('textbox'), 'dunno')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(screen.getByRole('textbox'), 'right eye')
    await userEvent.keyboard('{Enter}')
    // q_eye → cost_confirm → payment_mode → submit (added in the cost+payment-mode flow)
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))   // cost_confirm
    await userEvent.click(screen.getByRole('button', { name: 'Medisave' })) // payment_mode → submit
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
  })
})

// ─── Post-Operation Checklist ─────────────────────────────────────────────────

describe('ChatWindow — Post-Operation Checklist flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPatient.mockResolvedValue(MOCK_PATIENT_RESPONSE)
    getEpicRecord.mockResolvedValue(MOCK_EPIC_RECORD_RESPONSE)
    getLatestAcknowledgement.mockRejectedValue(new Error('no record'))
  })

  it('shows the Singpass login button when Fill up post-operation checklist is clicked', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
  })

  it('shows the login prompt message before Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    expect(screen.getByText(/To proceed with the checklist/i)).toBeInTheDocument()
  })

  it('input is disabled while waiting for Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('does not show the checklist before login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    expect(screen.queryByText(/Post Intravitreal Injection/i)).not.toBeInTheDocument()
  })

  it('renders PostOpChecklistDoc after Singpass login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/Post Intravitreal Injection/i)).toBeInTheDocument()
  })

  it('shows a welcome-back message after login', async () => {
    // For an existing patient the post-op flow greets "Welcome back, {name}. Here is your post-operation checklist."
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/Welcome back, Tan Ah Kow/i)).toBeInTheDocument()
  })

  it('input is disabled after the checklist is shown', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('does not call any backend API for the post-op checklist', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(submitAcknowledgement).not.toHaveBeenCalled()
    expect(sendChatMessage).not.toHaveBeenCalled()
  })
})

// ─── Return Menu ──────────────────────────────────────────────────────────────

describe('ChatWindow — Return Menu', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('clicking Return Menu appends a new welcome bubble with quick-reply pills', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    // In general_enquiry mode the welcome pill (in the thread) and the suggestion-bar
    // chip both read "Return Menu"; click the active chip (the last one).
    const returnMenuButtons = screen.getAllByRole('button', { name: 'Return Menu' })
    await userEvent.click(returnMenuButtons.at(-1))
    // Two welcome bubbles are now in the thread → at least 2 "General Enquiry" buttons
    expect(screen.getAllByRole('button', { name: 'General Enquiry' }).length).toBeGreaterThanOrEqual(2)
  })
})
