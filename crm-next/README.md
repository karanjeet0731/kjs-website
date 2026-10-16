# KJS Creative CRM

Next.js + Supabase CRM for KJS Creative.

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Set `OPENAI_API_KEY` to an OpenAI API key to enable requirement-based AI email drafts.
4. Set `GMAIL_USER` to the Gmail / Google Workspace mailbox to send from, and `GMAIL_APP_PASSWORD` to an App Password created for that mailbox. A normal Gmail password will not work. The Google account must allow App Passwords, typically with 2-Step Verification enabled.
5. Keep every secret server-side. Do not name AI/Gmail credentials with the `NEXT_PUBLIC_` prefix or commit real credentials.
6. Run `npm install` and `npm run dev`.

## AI email outreach
- Open Leads and click Email for a lead with an email address.
- The CRM requests a tailored draft from OpenAI using that lead's service and enquiry notes.
- Review and edit the recipient (shown from the lead record), subject, and body before confirming Send.
- On successful Gmail SMTP send, the lead's `log.mail_status`, `log.last_email_subject`, `log.last_email_sent_at`, and `log.email_history` are updated. A New or Unassigned lead is moved to Contacted.
- If Gmail succeeds but the CRM database update fails, the UI warns not to resend to avoid a duplicate message.

## Vercel environment setup
Add `OPENAI_API_KEY`, `OPENAI_MODEL`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` to the CRM project's server-side Environment Variables, then redeploy. No secret values belong in GitHub.
