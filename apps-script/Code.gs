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
//
// ===== מבנה הנתונים =====
// כל סוג (מאורסים / חתונות) יושב כעת בגיליון אחד בלבד, לא בשני גיליונות
// נפרדים כמו קודם. פריט חדש שנשלח דרך הטופס נוסף כשורה חדשה בתחתית אותו
// גיליון, עם עמודת "סטטוס" ראשונה שמתחילה כ-"ממתין". עמודת הסטטוס היא
// רשימה נפתחת (Data Validation) בגיליון עצמו, כך שאפשר גם לאשר/לדחות פריט
// ישירות מתוך Google Sheets, בלי לעבור דרך admin.html: פשוט משנים את הערך
// בעמודה A מ"ממתין" ל"מאושר" - והפריט יופיע מייד באתר. מחיקת השורה = דחייה.

// ===== הגדרות - חובה לערוך =====
const SHEET_ID = 'PUT_YOUR_SPREADSHEET_ID_HERE';
const ADMIN_PASSWORD = 'CHANGE_ME';
const NOTIFY_EMAIL = 'your-email@example.com';
const DRIVE_FOLDER_NAME = 'קול תורה - תמונות שמחות';

const SHEETS = {
  engaged: 'מאורסים',
  weddings: 'חתונות',
  reports: 'דיווחים'
};

const STATUS = {
  pending: 'ממתין',
  approved: 'מאושר'
};

// עמודת "סטטוס" תמיד ראשונה, ואחריה "ID" - שתיהן פנימיות ולא נערכות ידנית
// (חוץ מהחלפת הסטטוס עצמו דרך הרשימה הנפתחת)
const ENGAGED_HEADERS = ['סטטוס', 'ID', 'שם החתן', 'עיר החתן', 'ישיבת החתן', 'שם הכלה', 'עיר הכלה', 'סמינר הכלה', 'טלפון', 'תמונה', 'תאריך שליחה'];
const WEDDING_HEADERS = ['סטטוס', 'ID', 'שם החתן', 'מקום לימודים', 'אולם', 'עיר האולם', 'תאריך החתונה', 'טלפון', 'תמונה', 'תאריך שליחה'];
const REPORT_HEADERS = ['ID', 'סוג', 'לגבי', 'תוכן', 'תאריך'];

const STATUS_DROPDOWN_ROWS = 500; // כמות השורות שמקבלות מראש רשימה נפתחת לסטטוס

// ===== התקנה חד-פעמית =====
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const engagedSheet = ensureSheet(ss, SHEETS.engaged, ENGAGED_HEADERS);
  const weddingsSheet = ensureSheet(ss, SHEETS.weddings, WEDDING_HEADERS);
  ensureSheet(ss, SHEETS.reports, REPORT_HEADERS);
  applyStatusDropdown(engagedSheet);
  applyStatusDropdown(weddingsSheet);
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
  return sh;
}

// מוסיף רשימה נפתחת (ממתין / מאושר) לעמודת הסטטוס, כדי שאפשר יהיה
// לאשר/לדחות ישירות מתוך הגיליון
function applyStatusDropdown(sh) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS.pending, STATUS.approved], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, 1, STATUS_DROPDOWN_ROWS, 1).setDataValidation(rule);
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
        engaged: sheetToObjects(SHEETS.engaged).filter(r => r['סטטוס'] === STATUS.pending),
        weddings: sheetToObjects(SHEETS.weddings).filter(r => r['סטטוס'] === STATUS.pending),
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
// האתר הציבורי מציג רק שורות שהסטטוס שלהן "מאושר"
function getApprovedData(type) {
  const sheetName = type === 'engaged' ? SHEETS.engaged : SHEETS.weddings;
  return sheetToObjects(sheetName).filter(r => r['סטטוס'] === STATUS.approved);
}

function sheetToObjects(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return values
    .filter(row => row.some(cell => cell !== '' && cell !== null)) // מתעלם משורות ריקות
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] instanceof Date ? row[i].toISOString() : row[i];
      });
      return obj;
    });
}

// ===== הוספה חדשה =====
// כל שליחה חדשה נוספת כשורה בתחתית אותו גיליון (לא לגיליון נפרד), עם
// סטטוס "ממתין" - היא תקפוץ לאתר אוטומטית ברגע שהסטטוס יוחלף ל"מאושר"
function handleSubmit(payload) {
  const type = payload.type; // 'engaged' | 'weddings'
  const fields = payload.fields;
  const sheetName = type === 'engaged' ? SHEETS.engaged : SHEETS.weddings;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  const id = Utilities.getUuid();

  let photoUrl = '';
  if (payload.photoBase64) {
    photoUrl = saveImageToDrive(payload.photoBase64, id);
  }

  const now = new Date();
  let row;
  if (type === 'engaged') {
    row = [STATUS.pending, id, fields.groomName, fields.groomCity, fields.groomYeshiva, fields.brideName, fields.brideCity, fields.brideSeminar, fields.phone || '', photoUrl, now];
  } else {
    row = [STATUS.pending, id, fields.groomName, fields.placeOfStudy || '', fields.hall, fields.hallCity || '', fields.weddingDate, fields.phone || '', photoUrl, now];
  }
  sh.appendRow(row);
  // מוודא שגם לשורה החדשה יש רשימה נפתחת בעמודת הסטטוס
  sh.getRange(sh.getLastRow(), 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList([STATUS.pending, STATUS.approved], true).setAllowInvalid(false).build()
  );
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
      ? `שם החתן: ${fields.groomName}\nעיר: ${fields.groomCity}\nישיבה: ${fields.groomYeshiva}\n\nשם הכלה: ${fields.brideName}\nעיר: ${fields.brideCity}\nסמינר: ${fields.brideSeminar}\n\nטלפון: ${fields.phone || '-'}\n\nניתן לאשר בפאנל הניהול (admin.html), או ישירות בגיליון ע"י שינוי הסטטוס ל"מאושר".`
      : `שם החתן: ${fields.groomName}\nמקום לימודים: ${fields.placeOfStudy || '-'}\nאולם: ${fields.hall}\nעיר האולם: ${fields.hallCity || '-'}\nתאריך: ${fields.weddingDate}\nטלפון: ${fields.phone || '-'}\n\nניתן לאשר בפאנל הניהול (admin.html), או ישירות בגיליון ע"י שינוי הסטטוס ל"מאושר".`;
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
    Logger.log('שגיאה בשליחת מייל: ' + err);
  }
}

// ===== דיווח למנהל (משוב חופשי, לא קשור לאישור פריטים) =====
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
  const rowIndex = findRowByValue(sh, payload.id, 0); // ID בעמודה A
  if (rowIndex === -1) return { ok: false, error: 'לא נמצא (ייתכן וכבר טופל)' };
  sh.deleteRow(rowIndex);
  return { ok: true };
}

// ===== אישור / דחייה =====
// אישור = מחליף את עמודת הסטטוס ל"מאושר" באותה שורה (בלי להעביר בין גיליונות)
// דחייה = פשוט מוחק את השורה
function handleApprove(payload) {
  if (payload.password !== ADMIN_PASSWORD) return { ok: false, error: 'סיסמה שגויה' };
  return setStatusOrDelete(payload, true);
}

function handleReject(payload) {
  if (payload.password !== ADMIN_PASSWORD) return { ok: false, error: 'סיסמה שגויה' };
  return setStatusOrDelete(payload, false);
}

function setStatusOrDelete(payload, approve) {
  const type = payload.type;
  const id = payload.id;
  const sheetName = type === 'engaged' ? SHEETS.engaged : SHEETS.weddings;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  const rowIndex = findRowByValue(sh, id, 1); // ID בעמודה B (אחרי עמודת הסטטוס)
  if (rowIndex === -1) return { ok: false, error: 'לא נמצא (ייתכן וכבר טופל)' };

  if (approve) {
    sh.getRange(rowIndex, 1).setValue(STATUS.approved);
  } else {
    sh.deleteRow(rowIndex);
  }
  return { ok: true };
}

// מחפש שורה לפי ערך בעמודה נתונה (colIndex מבוסס-0). מחזיר מספר שורה בגיליון (1-based) או -1
function findRowByValue(sheet, value, colIndex) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === value) return i + 1;
  }
  return -1;
}
