import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement scrollIntoView — stub it so ChatWindow's useEffect doesn't throw
window.HTMLElement.prototype.scrollIntoView = vi.fn()
