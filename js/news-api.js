// משיכת נתונים מה-API הציבורי (Supabase). קובץ נפרד כדי לא לגעת ב-api.js הקיים.
const NewsApi = {
  URL: 'https://btuxrleevphepixzfpjq.supabase.co/functions/v1/public-news',
  // מפתח anon ציבורי בלבד - מותר להשאיר בצד לקוח
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dXhybGVldnBoZXBpeHpmcGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTcwOTgsImV4cCI6MjA4MDY5MzA5OH0.du4vvELa2oXzXf6DNpkTPtb4qkMti_0gbl_99Zz4_Vs',
  CACHE_KEY: 'news_cache_v1',
  CACHE_MS: 5 * 60 * 1000, // 5 דקות

  async load(force) {
    if (!force) {
      try {
        const c = JSON.parse(sessionStorage.getItem(this.CACHE_KEY) || 'null');
        if (c && Date.now() - c.t < this.CACHE_MS) return c.data;
      } catch (e) {}
    }
    const res = await fetch(this.URL, { headers: { apikey: this.KEY } });
    if (!res.ok) throw new Error('שגיאת שרת ' + res.status);
    const data = await res.json();
    try { sessionStorage.setItem(this.CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) {}
    return data;
  }
};
