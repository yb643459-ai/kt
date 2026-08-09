// ============================================================
// עזרי לוח שנה עברי — מבוססים על יכולת ה-Intl המובנית בדפדפן,
// כך שאין צורך במימוש נוסחאות לוח שנה עברי בעצמנו.
// ============================================================
const HebrewCal = {
  // מחזיר {year, month, day} של התאריך העברי (המספור של החודש הוא רציף, 1-13)
  parts(date) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', month: 'numeric', day: 'numeric' })
        .formatToParts(date)
        .map(x => [x.type, x.value])
    );
    return { year: parseInt(p.year, 10), month: parseInt(p.month, 10), day: parseInt(p.day, 10) };
  },

  // ממיר מספר (1–999) לגימטריה עברית תקנית, עם טיפול במקרי הקצה ט״ו / ט״ז
  // ומוסיף גרש/גרשיים במקום הנכון. לדוגמה: 12 -> י״ב, 15 -> ט״ו, 786 -> תשפ״ו
  toGematria(num) {
    let n = Math.round(num);
    if (n <= 0) return '';
    let str = '';
    while (n >= 400) { str += 'ת'; n -= 400; }
    const hundreds = { 300: 'ש', 200: 'ר', 100: 'ק' };
    for (const v of [300, 200, 100]) {
      if (n >= v) { str += hundreds[v]; n -= v; break; }
    }
    if (n === 15) {
      str += 'טו'; n = 0;
    } else if (n === 16) {
      str += 'טז'; n = 0;
    } else {
      const tensMap = { 10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ' };
      const onesMap = { 1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט' };
      const tens = Math.floor(n / 10) * 10;
      const ones = n % 10;
      if (tens) str += tensMap[tens];
      if (ones) str += onesMap[ones];
    }
    if (str.length === 1) return str + '׳';
    return str.slice(0, -1) + '״' + str.slice(-1);
  },

  // מחרוזת תאריך עברי קריאה, לדוגמה "י״ב אלול תשפ״ו"
  formatLong(date) {
    const p = this.parts(date);
    const monthName = this.monthName(date);
    return `${this.toGematria(p.day)} ${monthName} ${this.toGematria(p.year % 1000)}`;
  },

  formatShort(date) {
    const p = this.parts(date);
    return `${this.toGematria(p.day)} ${this.monthName(date)}`;
  },

  monthName(date) {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(date);
  },

  yearHeb(date) {
    return this.toGematria(this.parts(date).year % 1000);
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
  }
};
