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

  it('renders the four drug options that mirror the PostOp checklist', () => {
    render(<FinancialCounsellingDoc />)
    expect(screen.getByText('Lucentis')).toBeInTheDocument()
    expect(screen.getByText('Faricimab')).toBeInTheDocument()
    expect(screen.getByText('Eylea')).toBeInTheDocument()
    expect(screen.getByText('Others')).toBeInTheDocument()
  })

  // CB renders <span><input/><span>LABEL</span></span>; the input is a sibling of the label span.
  const checkboxFor = (labelText) => screen.getByText(labelText).parentElement.querySelector('input[type="checkbox"]')

  it('checks the drug option matching the supplied medication (Lucentis)', () => {
    render(<FinancialCounsellingDoc formData={{ medication: 'Ranibizumab (Lucentis)' }} />)
    expect(checkboxFor('Lucentis')).toBeChecked()
    expect(checkboxFor('Faricimab')).not.toBeChecked()
  })

  it('falls back to Others when medication does not match the four known options', () => {
    render(<FinancialCounsellingDoc formData={{ medication: 'Bevacizumab (Avastin)' }} />)
    expect(checkboxFor('Others')).toBeChecked()
  })

  it('falls back to Faricimab when medication is empty string (must tally with PostOp default)', () => {
    // Empty string from a Mongo doc / missing EPIC record must not silently become "Others".
    // PostOpChecklistDoc defaults to 'Faricimab (Vabysmo)' when record_medication is absent;
    // this form must do the same so they stay in sync.
    render(<FinancialCounsellingDoc formData={{ medication: '' }} />)
    expect(checkboxFor('Faricimab')).toBeChecked()
    expect(checkboxFor('Others')).not.toBeChecked()
  })

  it('Site renders LEFT only for OS (matches PostOp "Left eye")', () => {
    render(<FinancialCounsellingDoc formData={{ site: 'OS' }} />)
    expect(checkboxFor('LEFT')).toBeChecked()
    expect(checkboxFor('RIGHT')).not.toBeChecked()
    expect(checkboxFor('BOTH')).not.toBeChecked()
  })

  it('Site renders RIGHT only for OD (matches PostOp "Right eye")', () => {
    render(<FinancialCounsellingDoc formData={{ site: 'OD' }} />)
    expect(checkboxFor('RIGHT')).toBeChecked()
    expect(checkboxFor('LEFT')).not.toBeChecked()
    expect(checkboxFor('BOTH')).not.toBeChecked()
  })

  it('Site renders BOTH only for OU — single box, not LEFT+RIGHT+BOTH (matches PostOp "Both")', () => {
    // Previously OU checked LEFT, RIGHT, AND BILAT together; that did not tally with PostOp
    // which renders just "Both". Mutually exclusive rendering now.
    render(<FinancialCounsellingDoc formData={{ site: 'OU' }} />)
    expect(checkboxFor('BOTH')).toBeChecked()
    expect(checkboxFor('LEFT')).not.toBeChecked()
    expect(checkboxFor('RIGHT')).not.toBeChecked()
  })

  it('Site falls back to RIGHT (OD default) when site is empty string', () => {
    // Empty string from a missing record must not leave all boxes unchecked.
    render(<FinancialCounsellingDoc formData={{ site: '' }} />)
    expect(checkboxFor('RIGHT')).toBeChecked()
  })

  it('ticks Medisave when paymentMode is "Medisave"', () => {
    render(<FinancialCounsellingDoc formData={{ paymentMode: 'Medisave' }} />)
    expect(checkboxFor('Medisave')).toBeChecked()
    expect(checkboxFor('Cash')).not.toBeChecked()
  })

  it('ticks Medisave when paymentMode is "NOK Medisave" (next-of-kin Medisave variant)', () => {
    // NOK Medisave is operationally still a Medisave payment — the financial form
    // ticks the same checkbox; the NOK detail goes on a separate Medisave form.
    render(<FinancialCounsellingDoc formData={{ paymentMode: 'NOK Medisave' }} />)
    expect(checkboxFor('Medisave')).toBeChecked()
    expect(checkboxFor('Cash')).not.toBeChecked()
  })

  it('does NOT tick Medisave when paymentMode is Cash', () => {
    render(<FinancialCounsellingDoc formData={{ paymentMode: 'Cash' }} />)
    expect(checkboxFor('Medisave')).not.toBeChecked()
    expect(checkboxFor('Cash')).toBeChecked()
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
