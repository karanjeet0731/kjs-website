import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WAIT_MS = 48 * 60 * 60 * 1000

type Candidate = {
  id: string
  email: string
  status: string
  log: Record<string, any>
  stage: 'initial_sent' | 'followup_sent'
  dueAt: number
  initialSentAt: number
}

function asLog(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Supabase server configuration is missing.' }, { status: 503 })
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD
  const smtpPort = Number(process.env.SMTP_PORT || 465)
  const smtpSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : smtpPort === 465
  if (!smtpHost || !smtpUser || !smtpPassword) {
    return NextResponse.json({ ok: false, error: 'SMTP configuration is missing; no leads were changed.' }, { status: 503 })
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const now = new Date()
  const nowIso = now.toISOString()
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, status, email, log')
    .eq('status', 'Contacted')
    .limit(1000)

  if (error) {
    return NextResponse.json({ ok: false, error: 'Unable to load Contacted leads.' }, { status: 500 })
  }

  const candidates: Candidate[] = []
  for (const lead of leads ?? []) {
    const log = asLog(lead.log)
    const stage = log.auto_follow_up_stage === 'followup_sent' ? 'followup_sent' : 'initial_sent'
    const initialSentAt = Date.parse(String(log.initial_email_sent_at || log.last_email_sent_at || ''))
    const dueValue = stage === 'followup_sent'
      ? log.last_follow_up_sent_at
      : log.initial_email_sent_at || log.last_email_sent_at
    const dueAt = Date.parse(String(dueValue || ''))
    if (
      log.auto_follow_up_active === true &&
      !log.auto_lost_at &&
      typeof lead.email === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim()) &&
      Number.isFinite(initialSentAt) &&
      Number.isFinite(dueAt) &&
      now.getTime() - dueAt >= WAIT_MS
    ) {
      candidates.push({
        id: lead.id,
        email: lead.email.trim(),
        status: lead.status,
        log,
        stage,
        dueAt,
        initialSentAt,
      })
    }
  }

  if (!candidates.length) {
    return NextResponse.json({ ok: true, checkedAt: nowIso, candidates: 0, followUpsSent: 0, markedLost: 0, repliesFound: 0 })
  }

  const imap = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE ? process.env.IMAP_SECURE.toLowerCase() === 'true' : true,
    auth: { user: smtpUser, pass: smtpPassword },
    logger: false,
  })
  const replied = new Set<string>()
  let connected = false
  try {
    await imap.connect()
    connected = true
    const lock = await imap.getMailboxLock('INBOX')
    try {
      for (const c of candidates) {
        const uids = await imap.search({ from: c.email, since: new Date(c.initialSentAt) })
        if (!uids?.length) continue
        for await (const message of imap.fetch(uids, { internalDate: true }, { uid: true })) {
          const received = message.internalDate instanceof Date ? message.internalDate.getTime() : NaN
          if (Number.isFinite(received) && received > c.initialSentAt) {
            replied.add(c.id)
            break
          }
        }
      }
    } finally {
      lock.release()
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not check inbox; no leads were changed. Scheduler will retry.' }, { status: 503 })
  } finally {
    if (connected) {
      try { await imap.logout() } catch { imap.close() }
    } else {
      imap.close()
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPassword },
  })
  let followUpsSent = 0
  let markedLost = 0
  let repliesFound = 0

  for (const c of candidates) {
    if (replied.has(c.id)) {
      const { error: updateError } = await supabase.from('leads').update({
        log: { ...c.log, auto_follow_up_active: false, follow_up_status: 'Reply received', reply_received_at: nowIso },
        updated_at: nowIso,
      }).eq('id', c.id).eq('status', 'Contacted')
      if (updateError) return NextResponse.json({ ok: false, error: 'Could not save a detected reply.', followUpsSent, markedLost, repliesFound }, { status: 500 })
      repliesFound++
      continue
    }

    if (c.stage === 'initial_sent') {
      const originalSubject = String(c.log.last_email_subject || 'Your enquiry')
      const subject = /^re:/i.test(originalSubject) ? `Following up: ${originalSubject}` : `Following up: ${originalSubject}`
      const body = `Hi,\n\nI wanted to follow up on my previous email and check whether you had a chance to review it. Please let me know if you have any questions or would like to discuss next steps.\n\nLooking forward to hearing from you.\n\nBest regards,\nKJS Creative`
      const followUpAt = new Date()
      const followUpIso = followUpAt.toISOString()
      try {
        await transporter.sendMail({
          from: { name: 'KJS Creative', address: smtpUser },
          to: c.email,
          subject,
          text: body,
          replyTo: smtpUser,
          date: followUpAt,
          messageId: `followup-${c.id}-${c.initialSentAt}@${smtpUser.split('@')[1] || 'localhost'}`,
        })
      } catch {
        // Keep the lead eligible so the next scheduled run can retry.
        continue
      }
      const history = Array.isArray(c.log.email_history) ? c.log.email_history : []
      const nextLog = {
        ...c.log,
        auto_follow_up_active: true,
        auto_follow_up_stage: 'followup_sent',
        last_follow_up_sent_at: followUpIso,
        last_email_sent_at: followUpIso,
        last_email_subject: subject,
        follow_up_status: 'Follow-up sent; waiting 48h',
        email_history: [...history, {
          to: c.email, subject, body, sent_at: followUpIso, from: smtpUser,
          message_id: `followup-${c.id}-${c.initialSentAt}@${smtpUser.split('@')[1] || 'localhost'}`,
          type: 'automatic_follow_up',
        }].slice(-30),
      }
      const { error: updateError } = await supabase.from('leads').update({
        log: nextLog, updated_at: followUpIso,
      }).eq('id', c.id).eq('status', 'Contacted')
      if (updateError) return NextResponse.json({ ok: false, error: 'Follow-up email sent but CRM could not save its state; check email history before retrying.', followUpsSent, markedLost, repliesFound }, { status: 500 })
      followUpsSent++
      continue
    }

    const { error: updateError } = await supabase.from('leads').update({
      status: 'Lost',
      log: { ...c.log, auto_follow_up_active: false, auto_lost_at: nowIso, follow_up_status: 'Auto-lost after follow-up' },
      updated_at: nowIso,
    }).eq('id', c.id).eq('status', 'Contacted')
    if (updateError) return NextResponse.json({ ok: false, error: 'Could not mark a lead Lost.', followUpsSent, markedLost, repliesFound }, { status: 500 })
    markedLost++
  }

  return NextResponse.json({
    ok: true, checkedAt: nowIso, candidates: candidates.length, followUpsSent, markedLost, repliesFound,
    rule: 'After 48h from initial email send one follow-up; after another 48h mark Lost only if no reply was detected.',
  })
}
