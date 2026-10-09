import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const columns = ['id','name','company','email','phone','service','source','status','message','created_at','updated_at'] as const
type LeadRow = Record<string, unknown>
function cleanLead(input: LeadRow) {
  const out: LeadRow = {}
  for (const key of columns) if (key in input) out[key] = input[key]
  if (typeof out.name !== 'string' || !out.name.trim()) throw new Error('Every lead needs a name.')
  const map: Record<string,string> = { 'Unassigned':'New', 'Qualified':'Proposal', 'Converted':'Won' }
  if (typeof out.status === 'string') out.status = map[out.status] || out.status
  if (typeof out.status === 'string' && !['New','Contacted','Proposal','Won','Lost'].includes(out.status)) out.status = 'New'
  if (typeof out.source === 'string' && !out.source.trim()) out.source = 'Google Sheets'
  return out
}
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing server environment: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
async function authorizedUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role,approved').eq('id', user.id).maybeSingle()
  if (!profile || profile.approved !== true || profile.role !== 'admin') return null
  return supabase
}
export async function GET(request: Request) {
  try {
    const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET
    if (secret && request.headers.get('x-sync-secret') === secret) {
      const admin = serviceClient()
      const { data, error } = await admin.from('leads').select(columns.join(',')).order('created_at', { ascending: true })
      if (error) throw error
      return NextResponse.json({ ok: true, leads: data || [] })
    }
    const supabase = await authorizedUser()
    if (!supabase) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
    const { data, error } = await supabase.from('leads').select(columns.join(',')).order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ ok: true, leads: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not read leads.' }, { status: 500 })
  }
}
export async function POST(request: Request) {
  try {
    const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET
    const isSheet = !!secret && request.headers.get('x-sync-secret') === secret
    if (!isSheet) {
      const supabase = await authorizedUser()
      if (!supabase) return NextResponse.json({ error: 'Admin sign-in required.' }, { status: 401 })
      const body = await request.json()
      if (body.action !== 'push') return NextResponse.json({ error: 'Use action=push to send CRM leads to the connected sheet.' }, { status: 400 })
      const endpoint = process.env.GOOGLE_SHEETS_WEB_APP_URL
      if (!endpoint) return NextResponse.json({ error: 'Add GOOGLE_SHEETS_WEB_APP_URL in Vercel environment variables first.' }, { status: 503 })
      const { data, error } = await supabase.from('leads').select(columns.join(',')).order('created_at', { ascending: true })
      if (error) throw error
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'push', secret: process.env.GOOGLE_SHEETS_SYNC_SECRET, leads: data || [] }), cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok === false) throw new Error(result.error || 'Google Sheets push failed.')
      return NextResponse.json({ ok: true, count: (data || []).length, message: 'CRM leads sent to Google Sheets.' })
    }
    const body = await request.json()
    if (!Array.isArray(body.leads)) return NextResponse.json({ error: 'Expected a leads array.' }, { status: 400 })
    if (body.leads.length > 1000) return NextResponse.json({ error: 'Import is limited to 1,000 rows per request.' }, { status: 413 })
    const admin = serviceClient()
    let inserted = 0, updated = 0
    for (const input of body.leads as LeadRow[]) {
      const lead = cleanLead(input)
      const id = typeof lead.id === 'string' ? lead.id : ''
      if (id) {
        const { data: existing, error: lookupError } = await admin.from('leads').select('id').eq('id', id).maybeSingle()
        if (lookupError) throw lookupError
        if (existing) {
          const { error } = await admin.from('leads').update({ ...lead, updated_at: new Date().toISOString() }).eq('id', id)
          if (error) throw error
          updated++
          continue
        }
      }
      delete lead.id
      if (!lead.source) lead.source = 'Google Sheets'
      const { error } = await admin.from('leads').insert(lead)
      if (error) throw error
      inserted++
    }
    return NextResponse.json({ ok: true, inserted, updated, created, message: 'Google Sheets changes imported into CRM.' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync failed.' }, { status: 500 })
  }
}
