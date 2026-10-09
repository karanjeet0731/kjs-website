/**
 * KJS Creative CRM <-> Google Sheets bridge
 * Install this in Extensions > Apps Script in your connected lead spreadsheet.
 * Configure Script Properties: CRM_API_URL and SYNC_SECRET.
 */
const SHEET_NAME = 'KJS Leads';
const HEADERS = ['id','name','company','email','phone','service','source','status','message','created_at','updated_at'];
function setupSheet() {
  const sheet = getSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);
}
function syncFromCrm() {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('CRM_API_URL');
  const secret = props.getProperty('SYNC_SECRET');
  if (!base || !secret) throw new Error('Set CRM_API_URL and SYNC_SECRET in Apps Script project settings.');
  const response = UrlFetchApp.fetch(base.replace(/\/$/, '') + '/api/integrations/google-sheets', {
    method: 'get', headers: { 'x-sync-secret': secret }, muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300 || !result.ok) throw new Error(result.error || 'CRM export failed.');
  const sheet = getSheet_();
  setupSheet();
  const rows = (result.leads || []).map(lead => HEADERS.map(key => lead[key] == null ? '' : lead[key]));
  const existing = Math.max(0, sheet.getLastRow() - 1);
  if (existing) sheet.getRange(2, 1, existing, HEADERS.length).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  PropertiesService.getScriptProperties().setProperty('LAST_CRM_SYNC', new Date().toISOString());
  return { ok: true, count: rows.length };
}
function onEdit(e) {
  if (!e || !e.range || e.range.getRow() === 1) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  // Send edited sheet rows to CRM. A one-row payload keeps syncs small and avoids full-table overwrites.
  const rowNumber = e.range.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const lead = {};
  HEADERS.forEach((key, i) => { if (row[i] !== '') lead[key] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
  if (!lead.name) return;
  postRows_([lead]);
}
function importSheetToCrm() {
  const sheet = getSheet_();
  setupSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, inserted: 0, updated: 0 };
  const headers = values[0].map(String);
  const leads = values.slice(1).filter(row => row.some(v => v !== '')).map(row => {
    const lead = {};
    headers.forEach((key, i) => { if (HEADERS.indexOf(key) !== -1 && row[i] !== '') lead[key] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return lead;
  });
  return postRows_(leads);
}
function postRows_(leads) {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('CRM_API_URL');
  const secret = props.getProperty('SYNC_SECRET');
  if (!base || !secret) throw new Error('Set CRM_API_URL and SYNC_SECRET in Apps Script project settings.');
  const response = UrlFetchApp.fetch(base.replace(/\/$/, '') + '/api/integrations/google-sheets', {
    method: 'post', contentType: 'application/json', headers: { 'x-sync-secret': secret },
    payload: JSON.stringify({ leads: leads }), muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300 || !result.ok) throw new Error(result.error || 'CRM import failed.');
  PropertiesService.getScriptProperties().setProperty('LAST_SHEET_SYNC', new Date().toISOString());
  return result;
}
function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}
