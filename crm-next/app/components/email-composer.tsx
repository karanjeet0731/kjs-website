'use client'

import { useEffect, useState } from 'react'

type EmailResult = {
  log: Record<string, any>
  status: string | null
}

export default function EmailComposer({
  leadId,
  leadName,
  email,
  onClose,
  onSent,
}: {
  leadId: string
  leadName: string
  email: string | null
  onClose: () => void
  onSent: (result: EmailResult) => void
}) {
  const [to, setTo] = useState(email || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [readyToSend, setReadyToSend] = useState(false)

  async function generateDraft() {
    setDrafting(true)
    setError(false)
    setMessage('')
    setReadyToSend(false)
    try {
      const response = await fetch('/api/leads/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not create an email draft.')
      setTo(data.to || email || '')
      setSubject(data.subject || '')
      setBody(data.body || '')
      setReadyToSend(true)
      setMessage('AI draft ready. Review it before sending.')
    } catch (e) {
      setError(true)
      setMessage(e instanceof Error ? e.message : 'Could not create an email draft.')
    } finally {
      setDrafting(false)
    }
  }

  useEffect(() => { void generateDraft() }, [leadId])

  async function sendEmail() {
    if (!subject.trim() || !body.trim()) {
      setError(true)
      setMessage('Please add both a subject and an email message.')
      return
    }
    if (!window.confirm(`Send this email to ${to}?\n\nSubject: ${subject}`)) return
    setSending(true)
    setError(false)
    setMessage('')
    try {
      const response = await fetch('/api/leads/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, subject, body }),
      })
      const data = await response.json()
      if (!response.ok || !data.sent) throw new Error(data.error || 'Email was not confirmed sent.')
      if (data.crmUpdated && data.log) {
        onSent({ log: data.log, status: data.status ?? null })
        setMessage('Email sent successfully. CRM has been updated.')
        window.setTimeout(onClose, 1200)
      } else {
        setError(true)
        setMessage(data.warning || 'Email was sent, but the CRM update needs attention. Do not send it again.')
      }
    } catch (e) {
      setError(true)
      setMessage(e instanceof Error ? e.message : 'Could not send the email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="email-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !sending) onClose() }}>
      <section className="email-modal" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
        <div className="email-modal-head">
          <div>
            <div className="eyebrow" style={{ display: 'block' }}>AI-assisted outreach</div>
            <h2 id="email-modal-title" className="email-modal-title">Email {leadName}</h2>
            <p className="email-modal-sub">Draft tailored to this lead’s service requirement.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={sending}>Close</button>
        </div>
        <div className="email-modal-body">
          <label className="email-field">
            <span>To</span>
            <input type="email" value={to} readOnly aria-readonly="true" />
          </label>
          <label className="email-field">
            <span>Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={250} placeholder="Email subject" />
          </label>
          <label className="email-field">
            <span>Email body</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={11} maxLength={20000} placeholder="Your email message…" />
          </label>
          {message && <p role="status" className={`email-feedback ${error ? 'is-error' : ''}`}>{message}</p>}
        </div>
        <div className="email-modal-actions">
          <button type="button" className="icon-button" onClick={generateDraft} disabled={drafting || sending}>{drafting ? 'Generating…' : '↻ Regenerate draft'}</button>
          <button type="button" className="primary-button compact" onClick={sendEmail} disabled={!readyToSend || !to || !subject.trim() || !body.trim() || drafting || sending}>{sending ? 'Sending…' : 'Send with Gmail ↗'}</button>
        </div>
      </section>
    </div>
  )
}
