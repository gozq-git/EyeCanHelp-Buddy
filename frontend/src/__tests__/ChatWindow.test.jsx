import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatWindow from '../components/ChatWindow'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../api/client', () => ({
  sendChatMessage: vi.fn(),
  submitAcknowledgement: vi.fn(),
}))

// Isolate ChatWindow from SingpassLoginButton's internal 600ms timer.
// SingpassLoginButton's own timing is tested in SingpassLoginButton.test.jsx.
vi.mock('../components/SingpassLoginButton', () => ({
  default: ({ onLogin }) => (
    <button onClick={onLogin}>Singpass Login</button>
  ),
}))

import { sendChatMessage, submitAcknowledgement } from '../api/client'

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

  it('renders the four quick-reply option pills on load', () => {
    render(<ChatWindow />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up pre-procedure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up post-operation checklist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // answer q_admission
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('Right/Left/Both eye chips appear after both Yes/No questions are answered', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // q_admission
    await userEvent.click(screen.getByRole('button', { name: 'No' })) // q_stroke
    expect(screen.getByRole('button', { name: 'Right' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Left' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Both' })).toBeInTheDocument()
  })

  it('record_last3mths_admission is true when user answers Yes to Q1', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes' })) // q_admission = true
    await userEvent.click(screen.getByRole('button', { name: 'No' }))  // q_stroke = false
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_last3mths_admission).toBe(true)
    expect(payload.patient_record.record_stroke_heartAtt_last6mths).toBe(false)
  })

  it('record_eyes is OD when user selects Right', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
  })

  it('record_eyes is OS when user selects Left', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Left' }))
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OS')
  })

  it('record_eyes is OU when user selects Both', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Both' }))
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OU')
  })

  it('renders FinancialCounsellingDoc after submitAcknowledgement resolves', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    await waitFor(() => {
      expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
    })
  })

  it('renders FinancialCounsellingDoc even when submitAcknowledgement rejects (fallback)', async () => {
    submitAcknowledgement.mockRejectedValueOnce(new Error('Backend down'))
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    await waitFor(() => {
      expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
    })
  })

  it('input is disabled after the pre-procedure flow is complete', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'No' }))
    await userEvent.click(screen.getByRole('button', { name: 'Right' }))
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalled())
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})

// ─── Pre-Procedure input validation ──────────────────────────────────────────

describe('ChatWindow — Pre-Procedure input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submitAcknowledgement.mockResolvedValue(MOCK_ACK_RESPONSE)
  })

  async function reachStep(step) {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up pre-procedure' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
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
    await waitFor(() => expect(submitAcknowledgement).toHaveBeenCalledOnce())
    const [payload] = submitAcknowledgement.mock.calls[0]
    expect(payload.patient_record.record_eyes).toBe('OD')
  })
})

// ─── Post-Operation Checklist ─────────────────────────────────────────────────

describe('ChatWindow — Post-Operation Checklist flow', () => {
  beforeEach(() => { vi.clearAllMocks() })

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

  it('shows a thanks message after login', async () => {
    render(<ChatWindow />)
    await userEvent.click(screen.getByRole('button', { name: 'Fill up post-operation checklist' }))
    await userEvent.click(screen.getByRole('button', { name: /singpass login/i }))
    expect(screen.getByText(/Thanks for signing in/i)).toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: 'Return Menu' }))
    // Two welcome bubbles are now in the thread → at least 2 "General Enquiry" buttons
    expect(screen.getAllByRole('button', { name: 'General Enquiry' }).length).toBeGreaterThanOrEqual(2)
  })
})
