import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FOLLOW_UP_HOURS = 48

type LeadCandidate = {
  id: string
  email: string
  log: Record<string, any>
  sentAt: number
}

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
  const checkedAt = new Date()
  const cutoff = checkedAt.getTime() - FOLLOW_UP_HOURS * 60 * 60 * 1000

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, status, email, log')
    .eq('status', 'Contacted')
    .limit(1000)

  if (error) {
    return NextResponse.json({ ok: false, error: 'Unable to load Contacted leads for follow-up processing.' }, { status: 500 })
  }

  const candidates: LeadCandidate[] = []
  for (const lead of leads ?? []) {
    const log = lead.log && typeof lead.log === 'object' && !Array.isArray(lead.log)
      ? lead.log as Record<string, any>
      : {}
    const sentAt = typeof log.last_email_sent_at === 'string' ? Date.parse(log.last_email_sent_at) : NaN

    if (
      log.auto_follow_up_active === true &&
      !log.auto_lost_at &&
      typeof lead.email === 'string' &&
      lead.email.includes('@') &&
      Number.isFinite(sentAt) &&
      sentAt <= cutoff
    ) {
      candidates.push({ id: lead.id, email: lead.email.trim().toLowerCase(), log, sentAt })
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, checkedAt: checkedAt.toISOString(), candidates: 0, markedLost: 0, repliesFound: 0 })
  }

  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD
  if (!smtpUser || !smtpPassword) {
    return NextResponse.json({ ok: false, error: 'Mailbox credentials are missing; no leads were changed.' }, { status: 503 })
  }

  const imap = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE.toLowerCase() === 'true' : true,
    auth: { user: smtpUser, pass: smtpPassword },
    logger: false,
  })

  const replyLeadIds = new Set<string>()
  let connected = false
  try {
    await imap.connect()
    connected = true
    const lock = await imap.getMailboxLock('INBOX')
    try {
      for (const candidate of candidates) {
        const uids = await imap.search({
          from: candidate.email,
          since: new Date(candidate.sentAt),
        })
        if (!uids.length) continue

        for await (const message of imap.fetch(uids, { internalDate: true }, { uid: true })) {
          const receivedAt = message.internalDate instanceof Date ? message.internalDate.getTime() : NaN
          if (Number.isFinite(receivedAt) && receivedAt > candidate.sentAt) {
            replyLeadIds.add(candidate.id)
            break
          }
        }
      }
    } finally {
      lock.release()
    }
  } catch {
    // Never auto-mark leads as lost if the inbox could not be checked for client replies.
    return NextResponse.json({ ok: false, error: 'Could not check the inbox for client replies; no leads were changed. The scheduler will retry on its next run.' }, { status: 503 })
  } finally {
    if (connected) {
      try { await imap.logout() } catch { imap.close() }
    } else {
      imap.close()
    }
  }

  let markedLost = 0
  let repliesFound = 0
  const checkedAtIso = checkedAt.toISOString()

  for (const candidate of candidates) {
    if (replyLeadIds.has(candidate.id)) {
      const { error: replyUpdateError } = await supabase
        .from('leads')
        .update({
          log: {
            ...candidate.log,
            auto_follow_up_active: false,
            follow_up_status: 'Reply received',
            reply_received_at: checkedAtIso,
          },
          updated_at: checkedAtIso,
        })
        .eq('id', candidate.id)
        .eq('status', 'Contacted')

      if (replyUpdateError) {
        return NextResponse.json({ ok: false, error: 'A reply was found but the CRM could not update that lead.', markedLost, repliesFound }, { status: 500 })
      }
      repliesFound += 1
      continue
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'Lost',
        log: {
          ...candidate.log,
          auto_follow_up_active: false,
          auto_lost_at: checkedAtIso,
          follow_up_status: 'Auto-lost',
        },
        updated_at: checkedAtIso,
      })
      .eq('id', candidate.id)
      .eq('status', 'Contacted')

    if (updateError) {
      return NextResponse.json({ ok: false, error: 'A lead could not be updated during the scheduled run.', markedLost, repliesFound }, { status: 500 })
    }
    markedLost += 1
  }

  return NextResponse.json({
    ok: true,
    checkedAt: checkedAtIso,
    candidates: candidates.length,
    markedLost,
    repliesFound,
    rule: 'After 48 hours, only still-Contacted leads without an email reply are automatically marked Lost.',
  })
}
