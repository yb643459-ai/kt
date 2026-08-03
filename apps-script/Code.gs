// ============================================================
// קול תורה — לוח שמחות — Backend (Google Apps Script)
// ============================================================
// הוראות התקנה מלאות ב-README.md. בקצרה:
// 1. צרו Google Sheet חדש, העתיקו את ה-ID שלו מתוך הכתובת (בין /d/ ל-/edit)
// 2. פתחו script.google.com -> פרויקט חדש, מחקו את הקוד הקיים, הדביקו את כל הקובץ הזה
// 3. מלאו את ההגדרות למטה (SHEET_ID, ADMIN_PASSWORD, NOTIFY_EMAIL)
// 4. הריצו פעם אחת את הפונקציה setup() (מהתפריט למעלה) ואשרו את ההרשאות
// 5. פרסו כ-Web App: פריסה -> פריסה חדשה -> סוג: אפליקציית אינטרנט
//    "להפעיל בתור": עצמכם | "למי יש גישה": כל אחד
// 6. העתיקו את כתובת ה-URL שמסתיימת ב-/exec לתוך js/config.js באתר

// ===== הגדרות - חובה לערוך =====
const SHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';
const ADMIN_PASSWORD = 'CHANGE_ME';
const NOTIFY_EMAIL = 'your-email@example.com';
const DRIVE_FOLDER_NAME = 'קול תורה - תמונות שמחות';

const SHEETS = {
  engagedApproved: 'מאורסים',
  engagedPending: 'מאורסים_ממתין',
  weddingsApproved: 'חתונות',
  weddingsPending: 'חתונות_ממתין',
  reports: 'דיווחים'
};

const ENGAGED_HEADERS = ['ID', 'שם החתן', 'עיר החתן', 'ישיבת החתן', 'שם הכלה', 'עיר הכלה', 'סמינר הכלה', 'טלפון', 'תמונה', 'תאריך שליחה'];
const WEDDING_HEADERS = ['ID', 'שם החתן', 'מקום לימודים', 'אולם', 'תאריך החתונה', 'טלפון', 'תמונה', 'תאריך שליחה'];
const REPORT_HEADERS = ['ID', 'סוג', 'לגבי', 'תוכן', 'תאריך'];

// ===== התקנה חד-פעמית =====
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ensureSheet(ss, SHEETS.engagedApproved, ENGAGED_HEADERS);
  ensureSheet(ss, SHEETS.engagedPending, ENGAGED_HEADERS);
  ensureSheet(ss, SHEETS.weddingsApproved, WEDDING_HEADERS);
  ensureSheet(ss, SHEETS.weddingsPending, WEDDING_HEADERS);
  ensureSheet(ss, SHEETS.reports, REPORT_HEADERS);
  getOrCreateDriveFolder();
  Logger.log('ההתקנה הושלמה בהצלחה!');
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
}

function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

// ===== נקודות כניסה =====
function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'list') {
      return jsonResponse({ ok: true, data: getApprovedData(e.parameter.type) });
    }
    if (action === 'getPending') {
      if (e.parameter.password !== ADMIN_PASSWORD) return jsonResponse({ ok: false, error: 'סיסמה שגויה' });
      return jsonResponse({
        ok: true,
        engaged: sheetToObjects(SHEETS.engagedPending),
        weddings: sheetToObjects(SHEETS.weddingsPending),
        reports: sheetToObjects(SHEETS.reports)
      });
    }
    return jsonResponse({ ok: false, error: 'פעולה לא ידועה' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'submit') return jsonResponse(handleSubmit(payload));
    if (payload.action === 'approve') return jsonResponse(handleApprove(payload));
    if (payload.action === 'reject') return jsonResponse(handleReject(payload));
    if (payload.action === 'report') return jsonResponse(handleReport(payload));
    if (payload.action === 'resolveReport') return jsonResponse(handleResolveReport(payload));
    return jsonResponse({ ok: false, error: 'פעולה לא ידועה' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== קריאה =====
function getApprovedData(type) {
  const sheetName = type === 'engaged' ? SHEETS.engagedApproved : SHEETS.weddingsApproved;
  return sheetToObjects(sheetName);
}

function sheetToObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
    });
    return obj;
  });
}

// ===== הוספה חדשה =====
function handleSubmit(payload) {
  const type = payload.type; // 'engaged' | 'weddings'
  const fields = payload.fields;
  const pendingSheetName = type === 'engaged' ? SHEETS.engagedPending : SHEETS.weddingsPending;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(pendingSheetName);
  const id = Utilities.getUuid();

  let photoUrl = '';
  if (payload.photoBase64) {
    photoUrl = saveImageToDrive(payload.photoBase64, id);
  }

  const now = new Date();
  let row;
  if (type === 'engaged') {
    row = [id, fields.groomName, fields.groomCity, fields.groomYeshiva, fields.brideName, fields.brideCity, fields.brideSeminar, fields.phone || '', photoUrl, now];
  } else {
    row = [id, fields.groomName, fields.placeOfStudy, fields.hall, fields.weddingDate, fields.phone || '', photoUrl, now];
  }
  sh.appendRow(row);
  notifyAdminNewSubmission(type, fields);
  return { ok: true };
}

function saveImageToDrive(base64Data, id) {
  const matches = base64Data.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!matches) return '';
  const contentType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const blob = Utilities.newBlob(bytes, contentType, id + '.jpg');
  const folder = getOrCreateDriveFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function notifyAdminNewSubmission(type, fields) {
  try {
    const subject = type === 'engaged'
      ? 'שידוך חדש ממתין לאישור - קול תורה'
      : 'חתונה חדשה ממתינה לאישור - קול תורה';
    const body = type === 'engaged'
      ? `שם החתן: ${fields.groomName}\nעיר: ${fields.groomCity}\nישיבה: ${fields.groomYeshiva}\n\nשם הכלה: ${fields.brideName}\nעיר: ${fields.brideCity}\nסמינר: ${fields.brideSeminar}\n\nטלפון: ${fields.phone || '-'}\n\nיש לאשר בפאנל הניהול: (הכתובת שלכם)/admin.html`
      : `שם החתן: ${fields.groomName}\nמקום לימודים: ${fields.placeOfStudy}\nאולם: ${fields.hall}\nתאריך: ${fields.weddingDate}\nטלפון: ${fields.phone || '-'}\n\nיש לאשר בפאנל הניהול: (הכתובת שלכם)/admin.html`;
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
    Logger.log('שגיאה בשליחת מייל: ' + err);
  }
}

// ===== דיווח למנהל =====
function handleReport(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEETS.reports);
  const id = Utilities.getUuid();
  sh.appendRow([id, payload.reportType || '', payload.reference || '', payload.message || '', new Date()]);
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, 'דיווח חדש התקבל - קול תורה',
      `סוג: ${payload.reportType || '-'}\nלגבי: ${payload.reference || '-'}\n\n${payload.message || ''}`);
  } catch (err) {
    Logger.log('שגיאה בשליחת מייל דיווח: ' + err);
  }
  return { ok: true };
}

// ===== טיפול בדיווח (מחיקה לאחר טיפול) =====
function handleResolveReport(payload) {
  if (payload.password !== ADMIN_PASSWORD) return { ok: false, error: 'סיסמה שגויה' };
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEETS.reports);
  const rowIndex = findRowById(sh, payload.id);
  if (rowIndex === -1) return { ok: false, error: 'לא נמצא (ייתכן וכבר טופל)' };
  sh.deleteRow(rowIndex);
  return { ok: true };
}

// ===== אישור / דחייה =====
function handleApprove(payload) {
  if (payload.password !== ADMIN_PASSWORD) return { ok: false, error: 'סיסמה שגויה' };
  return moveOrDelete(payload, true);
}

function handleReject(payload) {
  if (payload.password !== ADMIN_PASSWORD) return { ok: false, error: 'סיסמה שגויה' };
  return moveOrDelete(payload, false);
}

function moveOrDelete(payload, approve) {
  const type = payload.type;
  const id = payload.id;
  const pendingSheetName = type === 'engaged' ? SHEETS.engagedPending : SHEETS.weddingsPending;
  const approvedSheetName = type === 'engaged' ? SHEETS.engagedApproved : SHEETS.weddingsApproved;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const pendingSheet = ss.getSheetByName(pendingSheetName);
  const rowIndex = findRowById(pendingSheet, id);
  if (rowIndex === -1) return { ok: false, error: 'לא נמצא (ייתכן וכבר טופל)' };

  if (approve) {
    const rowData = pendingSheet.getRange(rowIndex, 1, 1, pendingSheet.getLastColumn()).getValues()[0];
    ss.getSheetByName(approvedSheetName).appendRow(rowData);
  }
  pendingSheet.deleteRow(rowIndex);
  return { ok: true };
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1;
  }
  return -1;
}
