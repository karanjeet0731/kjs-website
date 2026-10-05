'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient(), router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('')
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg(error.message); else { router.push('/dashboard'); router.refresh() }
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback` },
      })
      setMsg(error ? error.message : 'Check your email to confirm. An admin must then approve your account.')
    }
    setBusy(false)
  }

  return (
    <main style={{ maxWidth: 360, margin: '15vh auto', padding: 16 }}>
      <h1>KJS CRM</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        {mode === 'signup' && <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <button disabled={busy}>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
        {msg && <p role="alert">{msg}</p>}
      </form>
      <p><button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg('') }}>{mode === 'login' ? 'Create an account' : 'I already have an account'}</button></p>
    </main>
  )
}
