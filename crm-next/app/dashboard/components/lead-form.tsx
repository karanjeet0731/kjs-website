'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LeadForm() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', email: '', phone: '', service: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage('')
    const { error } = await supabase.from('leads').insert({ ...form, status: 'new' })
    setSaving(false)
    if (error) return setMessage(error.message)
    setForm({ name: '', email: '', phone: '', service: '' }); setMessage('Lead added successfully.'); router.refresh()
  }

  return <form className="lead-form" onSubmit={submit}>
    <div className="form-grid">
      <input required placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
      <input placeholder="Service / requirement" value={form.service} onChange={e => setForm({ ...form, service: e.target.value })} />
    </div>
    <div className="form-actions"><button className="primary-button compact" disabled={saving}>{saving ? 'Adding…' : 'Add lead'}</button>{message && <span className="form-message">{message}</span>}</div>
  </form>
}
