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

  // מחרוזת תאריך עברי קריאה, לדוגמה "י״ב אלול תשפ״ו"
  formatLong(date) {
    return new Intl.DateTimeFormat('he-u-ca-hebrew-nu-hebr', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  },

  formatShort(date) {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' }).format(date);
  },

  monthName(date) {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(date);
  },

  yearHeb(date) {
    return new Intl.DateTimeFormat('he-u-ca-hebrew-nu-hebr', { year: 'numeric' }).format(date);
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
