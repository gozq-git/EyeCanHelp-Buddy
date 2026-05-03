import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MessageBubble from '../components/MessageBubble'

describe('MessageBubble — welcome type', () => {
  it('renders all 4 quick-reply option buttons', () => {
    render(<MessageBubble role="bot" type="welcome" content="" onQuickReply={() => {}} />)
    expect(screen.getByRole('button', { name: 'General Enquiry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up pre-procedure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fill up post-operation checklist' })).toBeInTheDocument()
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
    render(<MessageBubble role="bot" type="welcome" content="" onQuickReply={onQuickReply} />)
    for (const label of ['Fill up pre-procedure', 'Fill up post-operation checklist', 'Return Menu']) {
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
    screen.getByRole('button', { name: /singpass login/i }).click()
    vi.advanceTimersByTime(600)
    expect(onSingpassLogin).toHaveBeenCalledOnce()
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
