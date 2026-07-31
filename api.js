// ============================================================
// שכבת תקשורת עם ה-Backend (Google Apps Script)
// ============================================================
const Api = {
  async list(type) {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=list&type=${encodeURIComponent(type)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'שגיאה בטעינת נתונים');
    return json.data;
  },

  async submit(type, fields, photoBase64) {
    const payload = { action: 'submit', type, fields, photoBase64: photoBase64 || null };
    const res = await this._post(payload);
    if (!res.ok) throw new Error(res.error || 'שגיאה בשליחת הטופס');
    return res;
  },

  async getPending(password) {
    const url = `${CONFIG.APPS_SCRIPT_URL}?action=getPending&password=${encodeURIComponent(password)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'שגיאה');
    return json;
  },

  async approve(type, id, password) {
    const res = await this._post({ action: 'approve', type, id, password });
    if (!res.ok) throw new Error(res.error || 'שגיאה באישור');
    return res;
  },

  async reject(type, id, password) {
    const res = await this._post({ action: 'reject', type, id, password });
    if (!res.ok) throw new Error(res.error || 'שגיאה בדחייה');
    return res;
  },

  async resolveReport(id, password) {
    const res = await this._post({ action: 'resolveReport', id, password });
    if (!res.ok) throw new Error(res.error || 'שגיאה בטיפול בדיווח');
    return res;
  },

  async update(type, id, fields, password, photoBase64) {
    const res = await this._post({ action: 'update', type, id, fields, password, photoBase64: photoBase64 || null });
    if (!res.ok) throw new Error(res.error || 'שגיאה בעדכון הפריט');
    return res;
  },

  async deleteApproved(type, id, password) {
    const res = await this._post({ action: 'deleteApproved', type, id, password });
    if (!res.ok) throw new Error(res.error || 'שגיאה במחיקת הפריט');
    return res;
  },

  async _post(payload) {
    // שולחים כ-text/plain כדי להימנע מ-CORS preflight ש-Apps Script לא תומך בו
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }
};

// דוחס תמונה שנבחרה לקובץ JPEG קטן, ומחזיר Data URL (base64)
function compressImageToBase64(file, maxWidth = 500, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('שגיאה בטעינת התמונה'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
