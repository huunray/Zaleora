/**
 * Zaleora waitlist → Google Sheet
 *
 * Setup (once):
 *   1. Create a Google Sheet (e.g. "Zaleora Waitlist").
 *   2. In the sheet: Extensions → Apps Script. Replace the editor contents with this file. Save.
 *   3. Deploy → New deployment → type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *      Authorise when asked, then copy the Web app URL (ends in /exec).
 *   4. Paste that URL into WAITLIST_ENDPOINT at the top of script.js.
 *
 * After editing this script later: Deploy → Manage deployments → ✏️ → Version: "New version" → Deploy.
 * That keeps the same /exec URL; "New deployment" would create a different one.
 *
 * Signups land in a tab called "Waitlist" (created automatically) with columns:
 *   Joined at · Name · Email · Source
 */

var SHEET_NAME = "Waitlist";
var HEADERS = ["Joined at", "Name", "Email", "Source"];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Honeypot: real visitors never see or fill the "company" field.
    if (data.company) return json({ ok: true });

    var name = String(data.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
    var email = String(data.email || "").trim().toLowerCase().slice(0, 254);
    var source = String(data.source || "").trim().slice(0, 60);
    if (!name || !EMAIL_RE.test(email)) return json({ ok: false, error: "invalid" });

    var sheet = getSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var existing = sheet.getRange(2, 3, lastRow - 1, 1)
        .createTextFinder(email).matchEntireCell(true).findNext();
      if (existing) return json({ ok: true, duplicate: true });
    }

    sheet.appendRow([new Date(), asText(name), asText(email), asText(source)]);
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "server" });
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

// Stop values like "=HYPERLINK(...)" from being run as spreadsheet formulas.
function asText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function json(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
