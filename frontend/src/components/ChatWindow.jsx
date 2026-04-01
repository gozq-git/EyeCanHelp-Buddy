import React, { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import { sendChatMessage } from '../api/client'

export default function ChatWindow() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am EyeCanHelp Buddy. How can I assist you today?\n\nYou can ask me to:\n• Look up a patient record from EPIC\n• Walk through the patient acknowledgement\n• Help assess post-injection symptoms' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const updatedMessages = [...messages, { role: 'user', content: text }]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await sendChatMessage(
        updatedMessages.map(({ role, content }) => ({ role, content }))
      )
      setMessages([...updatedMessages, { role: 'assistant', content: res.data.reply }])
    } catch {
      setMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', background: '#0066cc', color: '#fff', fontWeight: 600, fontSize: '16px' }}>
        EyeCanHelp Buddy — IVT Clinic Assistant
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && <MessageBubble role="assistant" content="Thinking..." />}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', padding: '12px', borderTop: '1px solid #e0e0e0', gap: '8px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          rows={2}
          style={{
            flex: 1, resize: 'none', padding: '10px', borderRadius: '8px',
            border: '1px solid #ccc', fontSize: '14px', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '0 20px', background: '#0066cc', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 600, opacity: loading ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
