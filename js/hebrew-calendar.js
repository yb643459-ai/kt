// ============================================================
// עזרי לוח שנה עברי — מבוססים על יכולת ה-Intl המובנית בדפדפן,
// כך שאין צורך במימוש נוסחאות לוח שנה עברי בעצמנו.
// ============================================================
// פורמטרים משותפים (Intl.DateTimeFormat יקר ליצירה, כך נוצר פעם אחת בלבד)
const _fmtNumeric = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', month: 'short', day: 'numeric' });
const _fmtLong = new Intl.DateTimeFormat('he-u-ca-hebrew-nu-hebr', { day: 'numeric', month: 'long', year: 'numeric' });
const _fmtShort = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' });
const _fmtMonth = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' });
const _fmtYear = new Intl.DateTimeFormat('he-u-ca-hebrew-nu-hebr', { year: 'numeric' });

const HebrewCal = {
  // מחזיר {year, month, day} של התאריך העברי.
  // הערה: ICU אינו תומך בפורמט מספרי לחודש בלוח השנה העברי (הוא תמיד מחזיר את שם החודש
  // גם כשמבקשים month:'numeric') — לכן "month" כאן הוא מזהה מחרוזת (שם החודש), לא מספר.
  // סדר כרונולוגי בין חודשים נגזר בעת הסריקה ב-buildLookup, ולא ממספר חודש.
  parts(date) {
    const p = Object.fromEntries(_fmtNumeric.formatToParts(date).map(x => [x.type, x.value]));
    return { year: parseInt(p.year, 10), month: p.month, day: parseInt(p.day, 10) };
  },

  // מחרוזת תאריך עברי קריאה, לדוגמה "י״ב אלול תשפ״ו"
  formatLong(date) {
    return _fmtLong.format(date);
  },

  formatShort(date) {
    return _fmtShort.format(date);
  },

  monthName(date) {
    return _fmtMonth.format(date);
  },

  yearHeb(date) {
    return _fmtYear.format(date);
  },

  addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  },

  sameMonth(a, b) {
    return a.year === b.year && a.month === b.month;
  },

  // בהינתן תאריך לועזי כלשהו בתוך חודש עברי, מוצא את היום הראשון והאחרון של אותו חודש
  monthRange(anchorDate) {
    const anchorParts = this.parts(anchorDate);
    let start = anchorDate;
    while (this.sameMonth(this.parts(this.addDays(start, -1)), anchorParts)) {
      start = this.addDays(start, -1);
    }
    let end = anchorDate;
    while (this.sameMonth(this.parts(this.addDays(end, 1)), anchorParts)) {
      end = this.addDays(end, 1);
    }
    return { start, end, parts: anchorParts };
  },

  nextMonthAnchor(anchorDate) {
    const { end } = this.monthRange(anchorDate);
    return this.addDays(end, 1);
  },

  prevMonthAnchor(anchorDate) {
    const { start } = this.monthRange(anchorDate);
    return this.addDays(start, -1);
  },

  // בודק אם שני תאריכים לועזיים חלים באותו יום קלנדרי (מתעלם משעה)
  isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  },

  // האם date הוא היום או עתידי (משמש לסינון "עד יום אחרי האירוע")
  isTodayOrFuture(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  },

  // ============================================================
  // בחירת תאריך עברי (יום/חודש/שנה) -> תאריך לועזי
  // בונים טבלת חיפוש (unicode/gregorian) פעם אחת ע"י סריקת טווח ימים,
  // כדי לאפשר המרה הפוכה (עברי -> לועזי) מבלי לממש חישוב לוח שנה עברי בעצמנו.
  // ============================================================
  _lookup: null,

  // סורק טווח ימים ובונה מבנה: { [שנה עברית]: { label, months: { [שם חודש]: { index, days: [Date...] } } } }
  // ה-index נקבע לפי סדר ההופעה בעת הסריקה הכרונולוגית קדימה, ולכן משקף נכון את
  // סדר החודשים גם בשנים מעוברות (עם אדר א'/אדר ב').
  buildLookup(daysBack = 1095, daysForward = 2555) { // כ-3 שנים אחורה, כ-7 שנים קדימה
    if (this._lookup) return this._lookup;
    const data = {};
    let d = this.addDays(new Date(), -daysBack);
    const end = this.addDays(new Date(), daysForward);
    while (d <= end) {
      const p = this.parts(d);
      if (!data[p.year]) data[p.year] = { label: this.yearHeb(d), months: {}, order: [] };
      const yearData = data[p.year];
      if (!yearData.months[p.month]) {
        yearData.order.push(p.month);
        yearData.months[p.month] = { name: this.monthName(d), index: yearData.order.length, days: [] };
      }
      yearData.months[p.month].days[p.day - 1] = new Date(d);
      d = this.addDays(d, 1);
    }
    this._lookup = data;
    return data;
  },

  // רשימת שנים עבריות זמינות (רק שנים עם לפחות חודש אחד מלא קדימה מהיום)
  availableYears() {
    const lookup = this.buildLookup();
    const todayY = this.parts(new Date()).year;
    return Object.keys(lookup)
      .map(y => parseInt(y, 10))
      .filter(y => y >= todayY)
      .sort((a, b) => a - b)
      .map(y => ({ value: y, label: lookup[y].label }));
  },

  // רשימת חודשים עבור שנה עברית נתונה, בסדר כרונולוגי. value = שם החודש (המזהה היחיד שלו)
  monthsForYear(year) {
    const lookup = this.buildLookup();
    const yearData = lookup[year];
    if (!yearData) return [];
    return Object.keys(yearData.months)
      .sort((a, b) => yearData.months[a].index - yearData.months[b].index)
      .map(name => ({ value: name, label: yearData.months[name].name }));
  },

  // מספר הימים בחודש עברי נתון (שנה + שם חודש)
  daysInMonth(year, monthName) {
    const lookup = this.buildLookup();
    const yearData = lookup[year];
    if (!yearData || !yearData.months[monthName]) return 0;
    return yearData.months[monthName].days.length;
  },

  // ממיר {year, monthName, day} עברי לתאריך לועזי (Date), או null אם לא נמצא
  hebrewToGregorian(year, monthName, day) {
    const lookup = this.buildLookup();
    const yearData = lookup[year];
    if (!yearData || !yearData.months[monthName]) return null;
    const date = yearData.months[monthName].days[day - 1];
    return date || null;
  }
};
