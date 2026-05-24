import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SingpassLoginButton from '../components/SingpassLoginButton'

// The button is disabled while the username input is empty (so accidental empty submissions
// can't fire onLogin). Tests that exercise the click flow must populate the input first.
const typeUsername = (value = 'p001') => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } })
}

describe('SingpassLoginButton', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders "Singpass Login" text initially', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('Singpass Login')
  })

  it('button is enabled once a username is typed', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
    typeUsername()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('shows "Logging in…" and disables button immediately after click', () => {
    // Wrap in act so React flushes the setLoading(true) state update before asserting
    render(<SingpassLoginButton onLogin={() => {}} />)
    typeUsername()
    act(() => { screen.getByRole('button').click() })
    expect(screen.getByRole('button')).toHaveTextContent('Logging in…')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onLogin before 600 ms', () => {
    const onLogin = vi.fn()
    render(<SingpassLoginButton onLogin={onLogin} />)
    typeUsername()
    screen.getByRole('button').click()
    vi.advanceTimersByTime(599)
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('calls onLogin with the uppercased username after 600 ms', () => {
    const onLogin = vi.fn()
    render(<SingpassLoginButton onLogin={onLogin} />)
    typeUsername('p001')
    screen.getByRole('button').click()
    act(() => { vi.advanceTimersByTime(600) })
    expect(onLogin).toHaveBeenCalledOnce()
    expect(onLogin).toHaveBeenCalledWith('P001')
  })

  it('restores button state after onLogin fires', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    typeUsername()
    screen.getByRole('button').click()
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByRole('button')).toHaveTextContent('Singpass Login')
    // Input still holds the typed value, so the button stays enabled
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
