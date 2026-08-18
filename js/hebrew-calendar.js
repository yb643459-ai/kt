// ============================================================
// עזרי לוח שנה עברי — מבוססים על יכולת ה-Intl המובנית בדפדפן,
// כך שאין צורך במימוש נוסחאות לוח שנה עברי בעצמנו.
// ============================================================
const HebrewCal = {
  // בודק אם שנה עברית נתונה מעוברת (13 חודשים, עם אדר א'/אדר ב')
  _isLeapYear(y) {
    return (7 * y + 1) % 19 < 7;
  },

  // סדר שמות החודשים כפי שמחזיר Intl (מתחיל בתשרי), לפי שנה מעוברת/פשוטה
  _monthOrder(isLeap) {
    return isLeap
      ? ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar I', 'Adar II', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul']
      : ['Tishri', 'Heshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Nisan', 'Iyar', 'Sivan', 'Tamuz', 'Av', 'Elul'];
  },

  // מחזיר {year, month, day} של התאריך העברי (המספור של החודש הוא רציף, 1-13)
  // הערה: Intl לא תומך במספור ישיר של חודש עברי (מחזיר שם חודש גם כשמבקשים
  // month:'numeric'), לכן מחשבים את המספר בעצמנו לפי שם החודש וסדר קבוע.
  parts(date) {
    const year = parseInt(
      new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' }).format(date), 10
    );
    const day = parseInt(
      new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(date), 10
    );
    const monthName = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'short' }).format(date);
    const order = this._monthOrder(this._isLeapYear(year));
    const month = order.indexOf(monthName) + 1;
    return { year, month, day };
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
  },

  // ------------------------------------------------------------
  // המרת תאריך עברי -> לועזי, ומילוי בוררי יום/חודש/שנה
  // (Intl תומך רק בכיוון לועזי -> עברי, אז כאן בונים מיפוי הפוך
  // ע"י סריקת כל ימי השנה העברית פעם אחת ושמירה במטמון)
  // ------------------------------------------------------------

  // מוצא את התאריך הלועזי של א' תשרי (ראש השנה) עבור שנה עברית נתונה
  _tishrei1(hebrewYear) {
    const approxGregYear = hebrewYear - 3761;
    const base = new Date(Date.UTC(approxGregYear, 8, 1)); // סביבות 1 בספטמבר
    for (let i = -30; i <= 90; i++) {
      const cand = this.addDays(base, i);
      const p = this.parts(cand);
      if (p.year === hebrewYear && p.month === 1 && p.day === 1) return cand;
    }
    return base; // גיבוי, לא אמור לקרות
  },

  // בונה מיפוי של כל ימי השנה העברית הנתונה -> תאריך לועזי (עם מטמון)
  _yearMap(hebrewYear) {
    if (this._yearMapCache && this._yearMapCache.year === hebrewYear) {
      return this._yearMapCache.map;
    }
    const start = this._tishrei1(hebrewYear);
    const map = [];
    let cur = start;
    while (true) {
      const p = this.parts(cur);
      if (p.year !== hebrewYear) break;
      map.push({ month: p.month, day: p.day, date: new Date(cur) });
      cur = this.addDays(cur, 1);
    }
    this._yearMapCache = { year: hebrewYear, map };
    return map;
  },

  // מחזיר את רשימת החודשים של שנה עברית נתונה (מתחשב אוטומטית בשנה מעוברת)
  // כל איבר: { num, name, days }
  getYearMonths(hebrewYear) {
    const map = this._yearMap(hebrewYear);
    const months = {};
    for (const entry of map) {
      if (!months[entry.month]) {
        months[entry.month] = { num: entry.month, name: this.monthName(entry.date), days: 0 };
      }
      months[entry.month].days++;
    }
    return Object.values(months).sort((a, b) => a.num - b.num);
  },

  // ממיר יום/חודש/שנה עברי -> אובייקט Date לועזי (או null אם לא נמצא)
  toGregorian(hebrewYear, hebrewMonth, hebrewDay) {
    const map = this._yearMap(hebrewYear);
    const found = map.find(e => e.month === hebrewMonth && e.day === hebrewDay);
    return found ? found.date : null;
  },

  // מאתחל שלושה אלמנטי <select> (יום/חודש/שנה) כבורר תאריך עברי מלא בגימטריה,
  // עם ברירת מחדל להיום העברי הנוכחי, כולל טיפול בשנה מעוברת.
  // מחזיר אובייקט עם getISO() שמחזיר את התאריך הלועזי הנבחר כמחרוזת YYYY-MM-DD
  setupDatePicker(dayEl, monthEl, yearEl, yearsAhead = 9) {
    const todayParts = this.parts(new Date());
    const currentYear = todayParts.year;
    const yearsRange = Array.from({ length: yearsAhead + 1 }, (_, i) => currentYear + i);

    yearEl.innerHTML = yearsRange
      .map(y => `<option value="${y}">${this.toGematria(y % 1000)}</option>`)
      .join('');
    yearEl.value = currentYear;

    const populateDays = () => {
      const y = parseInt(yearEl.value, 10);
      const m = parseInt(monthEl.value, 10);
      const months = this.getYearMonths(y);
      const monthInfo = months.find(mm => mm.num === m);
      const numDays = monthInfo ? monthInfo.days : 30;
      dayEl.innerHTML = Array.from({ length: numDays }, (_, i) => i + 1)
        .map(d => `<option value="${d}">${this.toGematria(d)}</option>`)
        .join('');
      if (y === currentYear && m === todayParts.month && todayParts.day <= numDays) {
        dayEl.value = todayParts.day;
      } else {
        dayEl.value = 1;
      }
    };

    const populateMonths = () => {
      const y = parseInt(yearEl.value, 10);
      const months = this.getYearMonths(y);
      monthEl.innerHTML = months
        .map(m => `<option value="${m.num}">${m.name}</option>`)
        .join('');
      if (y === currentYear && months.some(m => m.num === todayParts.month)) {
        monthEl.value = todayParts.month;
      } else {
        monthEl.value = months[0].num;
      }
      populateDays();
    };

    yearEl.addEventListener('change', populateMonths);
    monthEl.addEventListener('change', populateDays);

    populateMonths();

    return {
      getISO() {
        const y = parseInt(yearEl.value, 10);
        const m = parseInt(monthEl.value, 10);
        const d = parseInt(dayEl.value, 10);
        const greg = HebrewCal.toGregorian(y, m, d);
        return greg ? greg.toISOString().slice(0, 10) : '';
      }
    };
  }
};
