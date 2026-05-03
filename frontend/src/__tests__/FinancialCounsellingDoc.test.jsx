import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FinancialCounsellingDoc from '../components/FinancialCounsellingDoc'

describe('FinancialCounsellingDoc', () => {
  it('renders the document title', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText(/Outpatient Procedures \(Intravitreal\)/i)).toBeInTheDocument()
    // Title text is specific enough to avoid matching the lowercase disclaimer
    expect(screen.getByText(/Financial Counselling & Advice/)).toBeInTheDocument()
  })

  it('renders default surgeon and MCR number', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText(/Dr\. Koh CS/)).toBeInTheDocument()
    expect(screen.getByText(/0001231241/)).toBeInTheDocument()
  })

  it('overrides surgeon from formData', () => {
    render(<FinancialCounsellingDoc formData={{ surgeon: 'Dr. Tan AB' }} />)
    expect(screen.getByText(/Dr\. Tan AB/)).toBeInTheDocument()
  })

  it('displays the estimated cost and injection count from formData', () => {
    render(<FinancialCounsellingDoc formData={{ estCost: 456, injections: 2 }} />)
    expect(screen.getByText('$456')).toBeInTheDocument()
    // "for 2 injection(s)" appears in the bill panel and the disclaimer — both are correct
    expect(screen.getAllByText(/for 2 injection\(s\)/).length).toBeGreaterThanOrEqual(1)
  })

  it('defaults to $123 for 1 injection', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText('$123')).toBeInTheDocument()
    expect(screen.getAllByText(/for 1 injection\(s\)/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders AMD (Exudative) diagnosis label', () => {
    render(<FinancialCounsellingDoc formData={{ diagnosis: 'H35.31' }} />)
    expect(screen.getByText(/AMD \(Exudative\)/i)).toBeInTheDocument()
  })

  it('renders Faricimab drug as an option', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText(/Faricimab \(Vabysmo\)/i)).toBeInTheDocument()
  })

  it('renders the Medisave payment mode option', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText('Medisave')).toBeInTheDocument()
  })

  it('renders the counselling-staff and patient signature lines', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText(/Counselling Staff:/i)).toBeInTheDocument()
    expect(screen.getByText(/Patient\/Relative:/i)).toBeInTheDocument()
    expect(screen.getByText(/Relationship:/i)).toBeInTheDocument()
  })
})
