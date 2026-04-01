import React, { useState } from 'react'
import ChatWindow from './components/ChatWindow'
import SymptomChecker from './components/SymptomChecker'
import EpicLookup from './components/EpicLookup'
import AcknowledgementForm from './components/AcknowledgementForm'

const TABS = [
  { id: 'epic', label: 'Patient Lookup (UC1)' },
  { id: 'acknowledgement', label: 'Acknowledgement (UC2)' },
  { id: 'symptoms', label: 'Symptom Checker (UC3)' },
  { id: 'chat', label: 'Chat Assistant' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('epic')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#f8f9fa' }}>
      <nav style={{ display: 'flex', gap: '4px', padding: '8px 16px', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? '#e8f0fe' : 'transparent',
              color: activeTab === tab.id ? '#0066cc' : '#555',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'epic' && (
          <div style={{ overflowY: 'auto', height: '100%' }}>
            <EpicLookup />
          </div>
        )}
        {activeTab === 'acknowledgement' && (
          <div style={{ overflowY: 'auto', height: '100%' }}>
            <AcknowledgementForm />
          </div>
        )}
        {activeTab === 'symptoms' && (
          <div style={{ overflowY: 'auto', height: '100%' }}>
            <SymptomChecker />
          </div>
        )}
        {activeTab === 'chat' && (
          <div style={{ height: '100%', maxWidth: '800px', margin: '0 auto', background: '#fff', boxShadow: '0 0 20px rgba(0,0,0,0.08)' }}>
            <ChatWindow />
          </div>
        )}
      </div>
    </div>
  )
}
