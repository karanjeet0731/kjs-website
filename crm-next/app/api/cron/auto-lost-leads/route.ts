import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FOLLOW_UP_HOURS = 48

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Supabase server configuration is missing.' }, { status: 503 })
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const now = new Date()
  const cutoff = now.getTime() - FOLLOW_UP_HOURS * 60 * 60 * 1000
  const checkedAt = now.toISOString()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, status, log')
    .eq('status', 'Contacted')
    .limit(1000)

  if (error) {
    return NextResponse.json({ ok: false, error: 'Unable to load Contacted leads for follow-up processing.' }, { status: 500 })
  }

  let markedLost = 0
  let skipped = 0
  for (const lead of leads ?? []) {
    const log = lead.log && typeof lead.log === 'object' && !Array.isArray(lead.log) ? lead.log as Record<string, unknown> : {}
    if (log.auto_follow_up_active !== true || typeof log.last_email_sent_at !== 'string' || log.auto_lost_at) {
      skipped += 1
      continue
    }

    const lastSentAt = Date.parse(log.last_email_sent_at)
    if (!Number.isFinite(lastSentAt) || lastSentAt > cutoff) {
      skipped += 1
      continue
    }

    const updatedLog = {
      ...log,
      auto_follow_up_active: false,
      auto_lost_at: checkedAt,
      follow_up_status: 'Auto-lost',
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: 'Lost', log: updatedLog, updated_at: checkedAt })
      .eq('id', lead.id)
      .eq('status', 'Contacted')

    if (updateError) {
      return NextResponse.json({
        ok: false,
        error: 'A lead could not be updated during the scheduled run.',
        markedLost,
      }, { status: 500 })
    }
    markedLost += 1
  }

  return NextResponse.json({
    ok: true,
    checkedAt,
    candidates: leads?.length ?? 0,
    markedLost,
    skipped,
    rule: 'Only Contacted leads with an active email timer older than 48 hours are automatically marked Lost.',
  })
}
