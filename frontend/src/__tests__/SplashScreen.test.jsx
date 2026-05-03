import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SplashScreen from '../components/SplashScreen'

describe('SplashScreen', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the eye logo SVG', () => {
    const { container } = render(<SplashScreen onDone={() => {}} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('does not call onDone before 2 seconds', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)
    vi.advanceTimersByTime(1999)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('calls onDone after exactly 2 seconds', () => {
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} />)
    vi.advanceTimersByTime(2000)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('does not call onDone after unmount (timer cleaned up)', () => {
    const onDone = vi.fn()
    const { unmount } = render(<SplashScreen onDone={onDone} />)
    unmount()
    vi.advanceTimersByTime(2000)
    expect(onDone).not.toHaveBeenCalled()
  })
})
