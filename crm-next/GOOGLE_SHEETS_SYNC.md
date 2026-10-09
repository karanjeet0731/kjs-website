# Google Sheets two-way sync — KJS Creative CRM

## What it does
- CRM → Sheets: the Leads page can send the current lead list to your Google Sheet.
- Sheets → CRM: run `importSheetToCrm` to import all edited rows, or install an edit trigger for row-by-row updates.
- Existing rows match by the CRM `id`. Keep that column unchanged to update a lead instead of creating duplicates.
- New sheet rows without an `id` create new leads. Deleting a row in Sheets does not delete a CRM lead.
- Allowed CRM status values are normalized from the CRM labels: Qualified → Proposal, Converted → Won, Unassigned → New.

## 1. Vercel environment variables
Add these to the **kjs-creative-crm** project for Production (and Preview if needed), then redeploy:
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key for project `psxyqzgezjfzuawdyzmp`. Server-side only; never use a `NEXT_PUBLIC_` prefix.
- `GOOGLE_SHEETS_SYNC_SECRET`: long random secret, e.g. generate a unique 32+ character secret.
- `GOOGLE_SHEETS_WEB_APP_URL`: URL of the Apps Script web app deployment created below.

## 2. Create the Google Sheet bridge
1. Create/open a Google Sheet for KJS leads.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with `crm-next/google-apps-script/kjs-sheets-sync.gs`, then Save.
4. In Apps Script **Project Settings → Script properties**, add:
   - `CRM_API_URL` = `https://crm.kjscreative.in`
   - `SYNC_SECRET` = exactly the same value as Vercel `GOOGLE_SHEETS_SYNC_SECRET`
5. In Apps Script, run `setupSheet` once and approve Google Sheets permissions.
6. **Deploy → New deployment → Web app**. Execute as **Me**. Access should be restricted to your account / your organization where possible; if you select public access, the endpoint is protected by the shared secret, but keep the URL and secret private. Copy the web app URL to `GOOGLE_SHEETS_WEB_APP_URL` in Vercel and redeploy.

## 3. Two-way sync
- Use the Leads page **Google Sheets** button to send CRM leads into the sheet.
- In Apps Script, select and run `importSheetToCrm` to apply spreadsheet edits back to CRM.
- For automatic CRM → Sheets refresh, add a time-driven trigger for `syncFromCrm` (for example every 15 minutes).
- For automatic Sheets → CRM, add an installable **On edit** trigger for `onEdit` from Apps Script Triggers. Test with one row first.

## Important
- Do not share the service-role key or sync secret in the spreadsheet.
- Test with a few sample leads before bulk importing. Sheet status edits can affect the CRM pipeline.
- This is row-based sync, not deletion sync; rows removed from Sheets remain in CRM.
