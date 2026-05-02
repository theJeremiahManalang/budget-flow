// ─── DEPLOY THIS AS A WEB APP IN GOOGLE APPS SCRIPT ───────
// 1. Go to script.google.com → New project
// 2. Paste this code
// 3. Deploy → New deployment → Web App
//    - Execute as: Me
//    - Who has access: Only myself
// 4. Copy the Web App URL → paste into CONFIG.APPS_SCRIPT_URL in app.js
// ──────────────────────────────────────────────────────────

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // Same as in app.js
const SHEET_NAME = 'Inventory';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (payload.action === 'append') {
      sheet.appendRow(payload.values);
    }

    else if (payload.action === 'updateRow') {
      const range = sheet.getRange(payload.row, 1, 1, payload.values.length);
      range.setValues([payload.values]);
    }

    else if (payload.action === 'update') {
      // single cell update (for quick qty change)
      const colMap = { A:1, B:2, C:3, D:4, E:5, F:6 };
      sheet.getRange(payload.row, colMap[payload.col]).setValue(payload.value);
    }

    else if (payload.action === 'delete') {
      sheet.deleteRow(payload.row);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Health check
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
