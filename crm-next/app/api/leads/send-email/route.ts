import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { requireAdmin } from '@/lib/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const gmailUser = process.env.GMAIL_USER
    const gmailPassword = process.env.GMAIL_APP_PASSWORD
    if (!gmailUser || !gmailPassword) {
      return NextResponse.json({ error: 'Gmail sending is not configured yet. Add GMAIL_USER and GMAIL_APP_PASSWORD to the CRM project’s server environment variables.' }, { status: 503 })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPassword.replace(/\s/g, '') },
    })

    const sentAt = new Date().toISOString()
    const sent = await transporter.sendMail({
      from: { name: 'KJS Creative', address: gmailUser },
      to,
      subject,
      text: body,
      replyTo: gmailUser,
    })

    const priorLog = lead.log && typeof lead.log === 'object' && !Array.isArray(lead.log) ? lead.log : {}
    const priorHistory = Array.isArray(priorLog.email_history) ? priorLog.email_history : []
    const emailRecord = {
      to,
      subject,
      body,
      sent_at: sentAt,
      from: gmailUser,
      message_id: sent.messageId || null,
    }
    const nextLog = {
      ...priorLog,
      mail_status: 'Sent',
      last_email_subject: subject,
      last_email_sent_at: sentAt,
      email_history: [...priorHistory, emailRecord].slice(-30),
    }
    const nextStatus = ['new', 'unassigned'].includes(String(lead.status || '').toLowerCase())
      ? 'Contacted'
      : lead.status

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
      message: 'Email sent with Gmail. Lead status and email history updated.',
      log: nextLog,
      status: nextStatus,
      messageId: sent.messageId || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send email.'
    return NextResponse.json({ error: `Email was not confirmed sent: ${message}` }, { status: 502 })
  }
}
