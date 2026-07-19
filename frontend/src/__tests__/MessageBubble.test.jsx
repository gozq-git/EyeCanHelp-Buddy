import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MessageBubble from '../components/MessageBubble'

describe('MessageBubble — welcome type', () => {
  it('renders the quick-reply option buttons by default, without Return Menu', () => {
    render(<MessageBubble role="bot" type="welcome" content="" onQuickReply={() => {}} />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up IVT Pre-Procedure Acknowledgement Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Post-IVT Advice Form' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book Appointment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Return Menu' })).not.toBeInTheDocument()
  })

  it('renders the Return Menu pill when includeReturnMenu is set', () => {
    render(<MessageBubble role="bot" type="welcome" content="" includeReturnMenu onQuickReply={() => {}} />)
    expect(screen.getByRole('button', { name: 'Return Menu' })).toBeInTheDocument()
  })

  it('calls onQuickReply with the button label on click', async () => {
    const onQuickReply = vi.fn()
    render(<MessageBubble role="bot" type="welcome" content="" onQuickReply={onQuickReply} />)
    await userEvent.click(screen.getByRole('button', { name: 'General Enquiry' }))
    expect(onQuickReply).toHaveBeenCalledWith('General Enquiry')
  })

  it('passes the correct label for each quick-reply option', async () => {
    const onQuickReply = vi.fn()
    render(<MessageBubble role="bot" type="welcome" content="" includeReturnMenu onQuickReply={onQuickReply} />)
    for (const label of ['Fill up IVT Pre-Procedure Acknowledgement Form', 'View Post-IVT Advice Form', 'Return Menu']) {
      await userEvent.click(screen.getByRole('button', { name: label }))
      expect(onQuickReply).toHaveBeenCalledWith(label)
    }
  })
})

describe('MessageBubble — user text', () => {
  it('renders the message content', () => {
    render(<MessageBubble role="user" type="text" content="What is AMD?" />)
    expect(screen.getByText('What is AMD?')).toBeInTheDocument()
  })

  it('does not render a bot avatar SVG', () => {
    const { container } = render(<MessageBubble role="user" type="text" content="Hello" />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})

describe('MessageBubble — bot text', () => {
  it('renders the message content', () => {
    render(<MessageBubble role="bot" type="text" content="I can help with eye queries." />)
    expect(screen.getByText('I can help with eye queries.')).toBeInTheDocument()
  })

  it('renders markdown bold text and tables for bot responses', () => {
    const content = `## Amblyopia\n\n**Important**\n\n| Type | Description |\n|------|-------------|\n| A | B |`
    render(<MessageBubble role="bot" type="text" content={content} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Amblyopia' })).toBeInTheDocument()
    expect(screen.getByText('Important').tagName).toBe('STRONG')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'B' })).toBeInTheDocument()
  })

  it('renders the EyeLogoSVG avatar', () => {
    const { container } = render(<MessageBubble role="bot" type="text" content="Hi" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('MessageBubble — singpass type', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the Singpass login button', () => {
    render(<MessageBubble role="bot" type="singpass" content="" onSingpassLogin={() => {}} />)
    expect(screen.getByRole('button', { name: /singpass login/i })).toBeInTheDocument()
  })

  it('calls onSingpassLogin after the 600 ms simulated delay', () => {
    const onSingpassLogin = vi.fn()
    render(<MessageBubble role="bot" type="singpass" content="" onSingpassLogin={onSingpassLogin} />)
    // The Singpass button is disabled until a username is typed; populate the input first.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'p001' } })
    screen.getByRole('button', { name: /singpass login/i }).click()
    act(() => { vi.advanceTimersByTime(600) })
    expect(onSingpassLogin).toHaveBeenCalledOnce()
    expect(onSingpassLogin).toHaveBeenCalledWith('P001')
  })
})

describe('MessageBubble — appointment_picker type', () => {
  it('renders date/time fields and disabled confirm button initially', () => {
    render(<MessageBubble role="bot" type="appointment_picker" content="" onAppointmentSubmit={() => {}} />)
    expect(screen.getByLabelText('Preferred date')).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm appointment slot' })).toBeDisabled()
  })

  it('shows a time selection box with only 8:00-17:30 in 10-minute slots', () => {
    render(<MessageBubble role="bot" type="appointment_picker" content="" onAppointmentSubmit={() => {}} />)
    const timeSelect = screen.getByLabelText('Preferred time')
    expect(timeSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '08:00' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '17:30' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '07:50' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '09:35' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '17:40' })).not.toBeInTheDocument()
  })

  it('calls onAppointmentSubmit after date and time are selected', async () => {
    const onAppointmentSubmit = vi.fn()
    render(<MessageBubble role="bot" type="appointment_picker" content="" onAppointmentSubmit={onAppointmentSubmit} />)

    fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2026-08-03' } })
    fireEvent.change(screen.getByLabelText('Preferred time'), { target: { value: '09:30' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirm appointment slot' })
    expect(confirmButton).not.toBeDisabled()
    await userEvent.click(confirmButton)

    expect(onAppointmentSubmit).toHaveBeenCalledWith({ date: '2026-08-03', time: '09:30' })
  })

  it('disables weekend dates directly in the calendar', async () => {
    const { container } = render(<MessageBubble role="bot" type="appointment_picker" content="" onAppointmentSubmit={() => {}} />)

    await userEvent.click(screen.getByLabelText('Preferred date'))

    const disabledWeekendDay = container.querySelector('.react-datepicker__day--weekend.react-datepicker__day--disabled')
    expect(disabledWeekendDay).not.toBeNull()
  })

  it('keeps confirm disabled until a valid slot is selected', async () => {
    const onAppointmentSubmit = vi.fn()
    render(<MessageBubble role="bot" type="appointment_picker" content="" onAppointmentSubmit={onAppointmentSubmit} />)

    fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2026-08-03' } })

    const confirmButton = screen.getByRole('button', { name: 'Confirm appointment slot' })
    expect(confirmButton).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Preferred time'), { target: { value: '09:40' } })
    expect(confirmButton).not.toBeDisabled()
    await userEvent.click(confirmButton)

    expect(onAppointmentSubmit).toHaveBeenCalledWith({ date: '2026-08-03', time: '09:40' })
  })
})

describe('MessageBubble — financial_doc type', () => {
  it('renders the financial counselling document', () => {
    render(
      <MessageBubble
        role="bot"
        type="financial_doc"
        content=""
        formData={{ surgeon: 'Dr. Test', estCost: 200, injections: 1, paymentMode: 'Cash' }}
      />
    )
    // The title contains "Financial Counselling & Advice" — use the specific phrase to
    // avoid matching the lowercase disclaimer sentence that also contains the words
    expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
  })
})

describe('MessageBubble — postop_doc type', () => {
  it('renders the post-op checklist document', () => {
    render(<MessageBubble role="bot" type="postop_doc" content="" />)
    expect(screen.getByText(/Post Intravitreal Injection/i)).toBeInTheDocument()
  })
})

