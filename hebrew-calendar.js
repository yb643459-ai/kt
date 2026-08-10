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
  },

  // ============================================================
  // המרה מתאריך עברי (יום/חודש/שנה) לתאריך לועזי, ובורר תאריך עברי
  // ============================================================

  currentYear() {
    return this.parts(new Date()).year;
  },

  // מוצא את א' תשרי של שנה עברית נתונה (סריקה יומית מנקודת התחלה משוערת)
  findYearStart(hebrewYear) {
    const approxGregYear = hebrewYear - 3761;
    let d = new Date(approxGregYear, 7, 1); // 1 באוגוסט, נקודת התחלה בטוחה
    for (let i = 0; i < 400; i++) {
      const p = this.parts(d);
      if (p.year === hebrewYear && p.month === 1 && p.day === 1) return new Date(d);
      if (p.year > hebrewYear) break;
      d = this.addDays(d, 1);
    }
    return null;
  },

  // מחזיר רשימת החודשים של שנה עברית נתונה, כל אחד עם מספר, שם ומספר הימים בו
  // (מתחשב אוטומטית בשנה מעוברת עם אדר א'/אדר ב')
  getYearMonths(hebrewYear) {
    const start = this.findYearStart(hebrewYear);
    if (!start) return [];
    const months = [];
    let d = new Date(start);
    let current = null;
    for (let i = 0; i < 400; i++) {
      const p = this.parts(d);
      if (p.year !== hebrewYear) break;
      if (!current || current.number !== p.month) {
        current = { number: p.month, name: this.monthName(d), days: 0 };
        months.push(current);
      }
      current.days = p.day;
      d = this.addDays(d, 1);
    }
    return months;
  },

  // ממיר יום/חודש/שנה עברי (מספרים) לאובייקט Date לועזי, או null אם לא נמצא
  toGregorian(hebrewYear, hebrewMonth, hebrewDay) {
    const start = this.findYearStart(hebrewYear);
    if (!start) return null;
    let d = new Date(start);
    for (let i = 0; i < 400; i++) {
      const p = this.parts(d);
      if (p.year !== hebrewYear) break;
      if (p.month === hebrewMonth && p.day === hebrewDay) return new Date(d);
      d = this.addDays(d, 1);
    }
    return null;
  },

  // מחרוזת "YYYY-MM-DD" לפי תאריך מקומי (בלי הזזת אזור זמן)
  toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  },

  // מחבר שלושה אלמנטי <select> (יום/חודש/שנה) לבורר תאריך עברי מלא:
  // ממלא אותם אוטומטית, שומר על עדכון החודשים/הימים בהתאם לשנה שנבחרה,
  // ומחזיר אובייקט עם getDate()/getISO() לשליפת התאריך הלועזי המתאים
  setupDatePicker(dayEl, monthEl, yearEl, initialDate) {
    const initial = this.parts(initialDate || new Date());
    const curYear = this.currentYear();

    yearEl.innerHTML = '';
    for (let y = curYear - 2; y <= curYear + 3; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = this.toGematria(y % 1000);
      yearEl.appendChild(opt);
    }
    yearEl.value = initial.year;

    const populateMonths = () => {
      const year = parseInt(yearEl.value, 10);
      const months = this.getYearMonths(year);
      const prevMonth = monthEl.value;
      monthEl.innerHTML = '';
      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.number;
        opt.textContent = m.name;
        opt.dataset.days = m.days;
        monthEl.appendChild(opt);
      });
      if (prevMonth && [...monthEl.options].some(o => o.value === prevMonth)) {
        monthEl.value = prevMonth;
      }
    };

    const populateDays = () => {
      const selectedOption = monthEl.options[monthEl.selectedIndex];
      const maxDays = selectedOption ? parseInt(selectedOption.dataset.days, 10) : 30;
      const prevDay = dayEl.value;
      dayEl.innerHTML = '';
      for (let d = 1; d <= maxDays; d++) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = this.toGematria(d);
        dayEl.appendChild(opt);
      }
      if (prevDay && parseInt(prevDay, 10) <= maxDays) {
        dayEl.value = prevDay;
      }
    };

    populateMonths();
    monthEl.value = initial.month;
    populateDays();
    dayEl.value = initial.day;

    yearEl.addEventListener('change', () => { populateMonths(); populateDays(); });
    monthEl.addEventListener('change', populateDays);

    return {
      getDate: () => this.toGregorian(parseInt(yearEl.value, 10), parseInt(monthEl.value, 10), parseInt(dayEl.value, 10)),
      getISO: () => {
        const d = this.toGregorian(parseInt(yearEl.value, 10), parseInt(monthEl.value, 10), parseInt(dayEl.value, 10));
        return d ? this.toISODate(d) : '';
      }
    };
  }
};
