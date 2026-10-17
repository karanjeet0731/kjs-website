import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { randomUUID } from 'node:crypto'
import { requireAdmin } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function encodeBase64Lines(value: string): string {
  const encoded = Buffer.from(value, 'utf8').toString('base64')
  return encoded.match(/.{1,76}/g)?.join('\r\n') || ''
}

async function saveCopyToSentFolder(options: {
  smtpUser: string
  smtpPassword: string
  to: string
  subject: string
  body: string
  date: Date
  messageId: string
}): Promise<boolean> {
  const imap = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE
      ? process.env.IMAP_SECURE.toLowerCase() === 'true'
      : true,
    auth: { user: options.smtpUser, pass: options.smtpPassword },
    logger: false,
  })

  let connected = false
  try {
    await imap.connect()
    connected = true
    const mailboxes = await imap.list()
    const sentMailbox =
      mailboxes.find((mailbox) => String(mailbox.specialUse || '').toLowerCase() === '\\sent') ||
      mailboxes.find((mailbox) => /(^|[./])sent(?: items)?$/i.test(mailbox.path)) ||
      mailboxes.find((mailbox) => /^sent(?: items)?$/i.test(mailbox.name))

    if (!sentMailbox) return false

    const encodedSubject = '=?UTF-8?B?' + Buffer.from(options.subject, 'utf8').toString('base64') + '?='
    const rawMessage = [
      'From: "KJS Creative" <' + options.smtpUser + '>',
      'To: <' + options.to + '>',
      'Subject: ' + encodedSubject,
      'Date: ' + options.date.toUTCString(),
      'Message-ID: <' + options.messageId + '>',
      'Reply-To: <' + options.smtpUser + '>',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64Lines(options.body),
      '',
    ].join('\r\n')

    const appended = await imap.append(sentMailbox.path, rawMessage, ['\\Seen'], options.date)
    return Boolean(appended)
  } catch {
    // SMTP may already have delivered the message; do not turn a Sent-folder copy failure into a resend prompt.
    return false
  } finally {
    if (connected) {
      try {
        await imap.logout()
      } catch {
        imap.close()
      }
    } else {
      imap.close()
    }
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAdmin()
    if (!access) return NextResponse.json({ error: 'Approved admin sign-in required.' }, { status: 401 })

    const input = await request.json().catch(() => ({}))
    const leadId = typeof input.leadId === 'string' ? input.leadId.trim() : ''
    const subject = typeof input.subject === 'string' ? input.subject.trim() : ''
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    if (!leadId || !subject || !body) {
      return NextResponse.json({ error: 'Lead ID, subject, and email body are required.' }, { status: 400 })
    }
    if (subject.length > 250 || body.length > 20000) {
      return NextResponse.json({ error: 'Subject or message is too long.' }, { status: 400 })
    }

    const { data: lead, error: leadError } = await access.supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError) throw leadError
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
    const to = typeof lead.email === 'string' ? lead.email.trim() : ''
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'This lead does not have a valid client email address.' }, { status: 400 })
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD
    const smtpPort = Number(process.env.SMTP_PORT || 465)
    const smtpSecure = process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE.toLowerCase() === 'true'
      : smtpPort === 465

    if (!smtpHost || !smtpUser || !smtpPassword || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      return NextResponse.json({
        error: 'Email sending is not configured yet. Add SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, and SMTP_PASSWORD to the CRM project’s server environment variables.',
      }, { status: 503 })
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
    })

    const sentAtDate = new Date()
    const sentAt = sentAtDate.toISOString()
    const messageId = 'crm-' + randomUUID() + '@' + (smtpUser.split('@')[1] || 'localhost')
    const sent = await transporter.sendMail({
      from: { name: 'KJS Creative', address: smtpUser },
      to,
      subject,
      text: body,
      replyTo: smtpUser,
      date: sentAtDate,
      messageId,
    })

    // SMTP sends the message, but doesn't automatically save it to the mailbox's Sent folder.
    const sentFolderSaved = await saveCopyToSentFolder({
      smtpUser,
      smtpPassword,
      to,
      subject,
      body,
      date: sentAtDate,
      messageId,
    })

    const priorLog = lead.log && typeof lead.log === 'object' && !Array.isArray(lead.log) ? lead.log : {}
    const priorHistory = Array.isArray(priorLog.email_history) ? priorLog.email_history : []
    const emailRecord = {
      to,
      subject,
      body,
      sent_at: sentAt,
      from: smtpUser,
      message_id: sent.messageId || null,
    }
    const nextStatus = ['new', 'unassigned'].includes(String(lead.status || '').toLowerCase())
      ? 'Contacted'
      : lead.status
    const startsAutoFollowUp = String(nextStatus || '').toLowerCase() === 'contacted'
    const nextLog = {
      ...priorLog,
      mail_status: 'Sent',
      last_email_subject: subject,
      last_email_sent_at: sentAt,
      auto_follow_up_active: startsAutoFollowUp,
      auto_lost_at: null,
      follow_up_status: startsAutoFollowUp ? 'Waiting 48h' : 'Paused',
      email_history: [...priorHistory, emailRecord].slice(-30),
    }

    const { error: updateError } = await access.supabase
      .from('leads')
      .update({ log: nextLog, status: nextStatus || null, updated_at: sentAt })
      .eq('id', leadId)

    // Sending already succeeded. Never report "email failed" when only the CRM write failed,
    // because a retry could send the client a duplicate.
    if (updateError) {
      return NextResponse.json({
        ok: true,
        sent: true,
        crmUpdated: false,
        warning: 'Email was sent, but CRM status could not be updated. Do not resend; refresh and update the lead manually.',
        messageId: sent.messageId || null,
        sentFolderSaved,
      })
    }

    const { error: activityError } = await access.supabase
      .from('activities')
      .insert({
        type: 'email_sent',
        summary: `Email sent to ${to}: ${subject}`,
        lead_id: leadId,
        actor_id: access.user.id,
      })

    return NextResponse.json({
      ok: true,
      sent: true,
      crmUpdated: true,
      activityLogged: !activityError,
      message: 'Email sent successfully. Lead status and email history updated.',
      sentFolderSaved,
      log: nextLog,
      status: nextStatus,
      messageId: sent.messageId || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send email.'
    return NextResponse.json({ error: `Email was not confirmed sent: ${message}` }, { status: 502 })
  }
}
