'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GoogleSheetsIntegration() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function pushToSheets() {
    setBusy(true); setMessage(''); setError(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in to the CRM first.')
      const { data: profile } = await supabase.from('profiles').select('role,approved').eq('id', user.id).maybeSingle()
      if (!profile || profile.role !== 'admin' || !profile.approved) throw new Error('Only an approved CRM admin can sync leads.')
      const response = await fetch('/api/integrations/google-sheets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push' }) })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Sync failed.')
      setMessage('Success — sent ' + result.count + ' leads to Google Sheets.')
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : 'Sync failed.') }
    finally { setBusy(false) }
  }
  const card = { border: '1px solid var(--border,#e5e7eb)', borderRadius: 14, padding: 20, background: 'var(--card,#fff)' } as const
  return <main style={{ maxWidth: 940, margin: '0 auto', paddingBottom: 48 }}>
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24 }}>
      <a href="/leads" style={{ color: 'var(--muted,#6b7280)', textDecoration: 'none', fontSize: 13 }}>← Leads</a>
      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', border: '1px solid #dbeafe', background: '#eff6ff', padding: '7px 11px', borderRadius: 99 }}>Google integration</div>
    </div>
    <div style={{ marginBottom: 26 }}>
      <div className="eyebrow">Integrations</div><h1 className="page-title">Google Sheets sync</h1>
      <p className="page-subtitle">Keep your KJS Creative CRM leads and spreadsheet in sync.</p>
    </div>
    {message && <div role="status" style={{ padding: 13, borderRadius: 10, marginBottom: 18, background: error ? '#fff1f0' : '#ecfdf3', color: error ? '#b42318' : '#067647', border: '1px solid ' + (error ? '#fecdca' : '#abefc6') }}>{message}</div>}
    <section style={{ ...card, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 13, background: '#e8f5e9', color: '#188038', fontSize: 25, fontWeight: 800 }}>▦</div>
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ margin: '0 0 7px', fontSize: 18 }}>CRM → Google Sheets</h2>
          <p style={{ margin: 0, color: 'var(--muted,#667085)', fontSize: 13, lineHeight: 1.7 }}>Send the current CRM lead list to your connected spreadsheet. Matching rows use the lead ID so existing rows can be updated rather than duplicated.</p>
        </div>
        <button className="primary-button compact" onClick={pushToSheets} disabled={busy}>{busy ? 'Syncing…' : 'Sync CRM leads →'}</button>
      </div>
    </section>
    <section style={{ ...card, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>Connect your spreadsheet</h2>
      <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9, fontSize: 13, color: 'var(--muted,#667085)' }}>
        <li>Create a Google Sheet and open <b>Extensions → Apps Script</b>.</li>
        <li>Paste the bridge script from <code>crm-next/google-apps-script/kjs-sheets-sync.gs</code> in your GitHub repository.</li>
        <li>In Apps Script Project Settings, add <code>CRM_API_URL</code> = <code>https://crm.kjscreative.in</code> and <code>SYNC_SECRET</code> (same secret you will add to Vercel).</li>
        <li>Run <code>setupSheet</code> once, authorize it, then deploy as a Web app and copy its URL.</li>
        <li>Add the three server-side Vercel environment variables shown below, then redeploy the CRM.</li>
      </ol>
    </section>
    <section style={{ ...card, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Vercel environment variables</h2>
      <p style={{ color: 'var(--muted,#667085)', fontSize: 13, lineHeight: 1.7, marginTop: 0 }}>Add these under the <b>kjs-creative-crm</b> project → Settings → Environment Variables. Keep all values server-side; do not use the <code>NEXT_PUBLIC_</code> prefix for secrets.</p>
      {[['SUPABASE_SERVICE_ROLE_KEY','Supabase project service-role key'],['GOOGLE_SHEETS_SYNC_SECRET','A long, random secret (use the same value in Apps Script)'],['GOOGLE_SHEETS_WEB_APP_URL','The Apps Script Web app deployment URL']].map(([key,desc])=><div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, 1.2fr)', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border,#eee)', fontSize: 12 }}><code style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{key}</code><span style={{ color: 'var(--muted,#667085)', lineHeight: 1.6 }}>{desc}</span></div>)}
    </section>
    <section style={{ ...card }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>Two-way sync behaviour</h2>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 13, color: 'var(--muted,#667085)' }}>
        <li><b>CRM → Sheet:</b> click the sync button above, or set a time-driven Apps Script trigger for <code>syncFromCrm</code>.</li>
        <li><b>Sheet → CRM:</b> run <code>importSheetToCrm</code>, or add an installable on-edit trigger for <code>onEdit</code>.</li>
        <li>Keep the <code>id</code> column intact. Rows without IDs create new leads; matching IDs update existing leads.</li>
        <li>Deleting a spreadsheet row does not delete a CRM lead. Test with a few sample rows before bulk import.</li>
      </ul>
      <p style={{ marginBottom: 0, marginTop: 16, fontSize: 12, color: 'var(--muted,#667085)' }}>Setup instructions are also saved in <code>crm-next/GOOGLE_SHEETS_SYNC.md</code> in your GitHub repository.</p>
    </section>
  </main>
}
