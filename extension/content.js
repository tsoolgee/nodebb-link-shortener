(function () {
  'use strict';

  // הבקשה נשלחת מה-background, שם מדיניות האבטחה של הפורום לא חלה
  function requestShort(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'shorten', url }, res => {
        if (chrome.runtime.lastError || !res || !res.ok) return reject(new Error('failed'));
        resolve(res.data);
      });
    });
  }

  // הקוד המשותף לתוסף ולסקריפט. הפלטפורמה מספקת requestShort(url) → Promise<תשובת JSON>.

  // אילו קישורים לקצר: רק קישור לקובץ או לתיקייה, לא לדף הבית של האתר.
  // כל כלל: דומיין (כולל תתי-דומיינים) + בדיקה על האובייקט URL.
  const hasToken = u => u.pathname.split('/').some(s => /^(?=.*[\dA-Z])[\w-]{5,}$/.test(s));
  const RULES = [
    [['drive.google.com', 'docs.google.com'], u =>
      /\/(u\/\d+\/)?d\/(e\/)?[\w-]{10,}|\/folders\/[\w-]{10,}/.test(u.pathname) ||
      /^[\w-]{10,}$/.test(u.searchParams.get('id') || '')],
    [['drive.usercontent.google.com'], u => /^[\w-]{10,}$/.test(u.searchParams.get('id') || '')],
    [['magicode.me'], u => /\/send-file\/file\/[^/]+/.test(u.pathname)],
    [['jumbomail.me', 'jmbo.me'], hasToken],
  ];

  const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/gi;
  const cache = new Map(); // קישור מקורי → Promise של קישור מקוצר
  let nodebb = null;

  function isNodeBB() {
    if (nodebb === null) {
      nodebb = !!document.querySelector(
        'script[src*="/assets/nodebb.min.js"], link[href*="/assets/client"][href*=".css"], meta[name="generator"][content*="NodeBB" i]'
      );
    }
    return nodebb;
  }

  function shouldShorten(url) {
    let u;
    try { u = new URL(url); } catch (e) { return false; }
    const host = u.hostname.toLowerCase();
    return RULES.some(([domains, test]) =>
      domains.some(d => host === d || host.endsWith('.' + d)) && test(u));
  }

  function shorten(url) {
    if (cache.has(url)) return cache.get(url);
    const p = requestShort(url).then(r => {
      let s = r && (r.shortUrl || r.short_url || r.shorturl || r.url);
      if (!s && r && r.code) s = 'https://did.li/' + r.code;
      if (!s) throw new Error('no short url');
      return s;
    });
    p.catch(() => cache.delete(url)); // כישלון – לנסות שוב בהדבקה הבאה
    cache.set(url, p);
    return p;
  }

  // מחליף בתיבה את המקור במקוצר, שומר על מיקום הסמן ומעדכן את התצוגה המקדימה
  function replaceInField(el, original, short) {
    const value = el.value;
    if (!value.includes(original)) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret);
    const shiftedCaret = caret + (before.split(original).length - 1) * (short.length - original.length);

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, value.split(original).join(short));
    if (document.activeElement === el) el.setSelectionRange(shiftedCaret, shiftedCaret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onPaste(e) {
    const el = e.target;
    if (!(el instanceof HTMLTextAreaElement) || !isNodeBB()) return;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!text) return;
    const urls = [...new Set((text.match(URL_RE) || []).map(u => u.replace(/[.,;:!?]+$/, '')))]
      .filter(shouldShorten);
    // ההדבקה עצמה עוברת כרגיל; ההחלפה קורית ברקע כשהקיצור חוזר
    urls.forEach(u => shorten(u).then(s => replaceInField(el, u, s)).catch(() => {}));
  }

  document.addEventListener('paste', onPaste, true);
})();
