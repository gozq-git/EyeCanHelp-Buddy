import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PostIvtAdviceDoc from '../components/PostIvtAdviceDoc'

describe('PostIvtAdviceDoc', () => {
  it('renders the document title', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByText('POST INTRAVITREAL INJECTION INFORMATION SHEET')).toBeInTheDocument()
  })

  it('shows AMD checkbox as checked', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByLabelText(/Age-related macular degeneration/i)).toBeChecked()
  })

  it('shows other diagnosis checkboxes as unchecked', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByLabelText(/Macular edema/i)).not.toBeChecked()
  })

  it('lists normal mild side effects', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByText(/Eye discomfort/i)).toBeInTheDocument()
    expect(screen.getByText(/Superficial bleeding/i)).toBeInTheDocument()
    expect(screen.getByText(/Floaters/i)).toBeInTheDocument()
  })

  it('lists severe symptoms that require immediate attention', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByText('Eye pain')).toBeInTheDocument()
    expect(screen.getByText(/Chest pain or chest tightness/i)).toBeInTheDocument()
    expect(screen.getByText(/Light sensitivity/i)).toBeInTheDocument()
  })

  it('shows the office-hours and after-hours contact numbers', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByText('81263632')).toBeInTheDocument()
    expect(screen.getByText('6256 6011')).toBeInTheDocument()
  })

  it('shows the after-hours TTSH Emergency Department instruction', () => {
    render(<PostIvtAdviceDoc />)
    expect(screen.getByText(/TTSH Emergency Department/i)).toBeInTheDocument()
    expect(screen.getByText(/Tan Tock Seng Hospital/i)).toBeInTheDocument()
  })
})
