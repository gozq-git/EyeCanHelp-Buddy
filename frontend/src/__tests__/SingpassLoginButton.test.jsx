import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SingpassLoginButton from '../components/SingpassLoginButton'

describe('SingpassLoginButton', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders "Singpass Login" text initially', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('Singpass Login')
  })

  it('button is enabled before click', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('shows "Logging in…" and disables button immediately after click', () => {
    // Wrap in act so React flushes the setLoading(true) state update before asserting
    render(<SingpassLoginButton onLogin={() => {}} />)
    act(() => { screen.getByRole('button').click() })
    expect(screen.getByRole('button')).toHaveTextContent('Logging in…')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onLogin before 600 ms', () => {
    const onLogin = vi.fn()
    render(<SingpassLoginButton onLogin={onLogin} />)
    screen.getByRole('button').click()
    vi.advanceTimersByTime(599)
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('calls onLogin after 600 ms', () => {
    const onLogin = vi.fn()
    render(<SingpassLoginButton onLogin={onLogin} />)
    screen.getByRole('button').click()
    vi.advanceTimersByTime(600)
    expect(onLogin).toHaveBeenCalledOnce()
  })

  it('restores button state after onLogin fires', () => {
    render(<SingpassLoginButton onLogin={() => {}} />)
    screen.getByRole('button').click()
    vi.advanceTimersByTime(600)
    expect(screen.getByRole('button')).toHaveTextContent('Singpass Login')
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
