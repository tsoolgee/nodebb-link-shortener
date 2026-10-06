// ==UserScript==
// @name         קיצור קישורים אוטומטי בפורומי NodeBB
// @namespace    https://github.com/tsoolgee/nodebb-link-shortener
// @version      0.0.3
// @description  מדביקים קישור של גוגל דרייב / ג'מבו מייל / מג'יקוד בעורך של פורום NodeBB – והוא מוחלף בשקט בקישור did.li מקוצר
// @author       tsoolgee
// @homepageURL  https://github.com/tsoolgee/nodebb-link-shortener
// @supportURL   https://github.com/tsoolgee/nodebb-link-shortener/issues
// @updateURL    https://raw.githubusercontent.com/tsoolgee/nodebb-link-shortener/main/userscript/nodebb-link-shortener.user.js
// @downloadURL  https://raw.githubusercontent.com/tsoolgee/nodebb-link-shortener/main/userscript/nodebb-link-shortener.user.js
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @connect      6ejpppqpkh.execute-api.eu-west-1.amazonaws.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // הגדרות משותפות: ברירות מחדל ועזרים לרשימות אתרים.
  // הפלטפורמה מספקת loadSettings() → Promise, saveSettings(s) → Promise, onSettingsChanged(cb).

  const DEFAULT_SETTINGS = {
    autoDetect: true, // זיהוי אוטומטי של פורומי NodeBB
    sites: [],        // אתרים שבהם לפעול תמיד, גם בלי זיהוי
    excluded: [],     // אתרים שבהם לא לפעול אף פעם
    domains: [],      // דומיינים נוספים שקישורים אליהם יקוצרו
  };

  function withDefaults(s) {
    return Object.assign({}, DEFAULT_SETTINGS, s || {});
  }

  // "https://www.Example.com/path" → "example.com"
  function normalizeHost(s) {
    s = String(s || '').trim().toLowerCase();
    if (!s) return '';
    try { s = new URL(/^[a-z]+:\/\//.test(s) ? s : 'http://' + s).hostname; } catch (e) { return ''; }
    return s.replace(/^www\./, '');
  }

  function parseHostList(text) {
    return [...new Set(String(text).split(/[\s,]+/).map(normalizeHost).filter(Boolean))];
  }

  // דומיין ברשימה תופס גם את תתי-הדומיינים שלו
  function hostInList(host, list) {
    host = host.toLowerCase().replace(/^www\./, '');
    return list.some(d => host === d || host.endsWith('.' + d));
  }

  // מסך ההגדרות – אותו מסך בדף האפשרויות של התוסף ובחלון של הסקריפט.

  const SETTINGS_CSS = `
  .nls { direction: rtl; font: 14px/1.5 system-ui, Arial, sans-serif; color: #222; background: #fff;
    padding: 18px 20px; max-width: 460px; box-sizing: border-box; }
  .nls * { box-sizing: border-box; }
  .nls h2 { margin: 0 0 12px; font-size: 18px; color: #407be3; }
  .nls .row { margin: 0 0 14px; }
  .nls label.chk { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; font-weight: 600; }
  .nls label.chk input { margin-top: 4px; }
  .nls .title { font-weight: 600; display: block; margin-bottom: 2px; }
  .nls .hint { color: #666; font-size: 12px; margin: 0 0 4px; }
  .nls textarea { width: 100%; min-height: 64px; direction: ltr; text-align: left; font: 13px/1.4 Consolas, monospace;
    padding: 6px 8px; border: 1px solid #bbb; border-radius: 6px; resize: vertical; }
  .nls textarea:focus { outline: 2px solid #407be3; border-color: transparent; }
  .nls .builtin { direction: ltr; text-align: left; font: 12px Consolas, monospace; color: #555; }
  .nls .actions { display: flex; gap: 8px; align-items: center; }
  .nls button { background: #407be3; color: #fff; border: 0; padding: 7px 18px; border-radius: 6px; cursor: pointer; font: inherit; }
  .nls button.secondary { background: #888; }
  .nls .status { color: #2a8a3a; font-size: 13px; }
  @media (prefers-color-scheme: dark) {
    .nls { background: #1f2329; color: #e6e6e6; }
    .nls .hint, .nls .builtin { color: #a0a6ad; }
    .nls textarea { background: #15181c; color: #e6e6e6; border-color: #444; }
  }
  `;

  const BUILTIN_DOMAINS = 'drive.google.com, docs.google.com, jumbomail.me, send.magicode.me';

  // root: אלמנט או shadowRoot. onClose: אם קיים – מוצג כפתור "סגור".
  function renderSettings(root, onClose) {
    const style = document.createElement('style');
    style.textContent = SETTINGS_CSS;
    const box = document.createElement('div');
    box.className = 'nls';
    box.innerHTML = `
      <h2>הגדרות קיצור קישורים</h2>
      <div class="row">
        <label class="chk"><input type="checkbox" id="autoDetect">
          <span>זיהוי אוטומטי של פורומי NodeBB</span></label>
        <p class="hint">כשכבוי, הקיצור פועל רק באתרים שברשימה הבאה.</p>
      </div>
      <div class="row">
        <span class="title">אתרים שבהם לפעול תמיד</span>
        <p class="hint">גם אם הם לא זוהו כפורום NodeBB. אתר אחד בכל שורה, למשל mitmachim.top</p>
        <textarea id="sites"></textarea>
      </div>
      <div class="row">
        <span class="title">אתרים חריגים – לא להחליף בהם</span>
        <p class="hint">גם אם הם פורום NodeBB.</p>
        <textarea id="excluded"></textarea>
      </div>
      <div class="row">
        <span class="title">דומיינים נוספים לקיצור</span>
        <p class="hint">קישור לאתרים האלה יקוצר, חוץ מקישור לדף הבית שלהם. מובנים כבר:</p>
        <p class="hint builtin">${BUILTIN_DOMAINS}</p>
        <textarea id="domains"></textarea>
      </div>
      <div class="actions">
        <button id="save">שמירה</button>
        ${onClose ? '<button id="close" class="secondary">סגירה</button>' : ''}
        <span class="status" id="status"></span>
      </div>`;
    root.appendChild(style);
    root.appendChild(box);

    const $ = id => box.querySelector('#' + id);
    loadSettings().then(raw => {
      const s = withDefaults(raw);
      $('autoDetect').checked = s.autoDetect;
      ['sites', 'excluded', 'domains'].forEach(k => { $(k).value = s[k].join('\n'); });
    });

    $('save').addEventListener('click', () => {
      const s = {
        autoDetect: $('autoDetect').checked,
        sites: parseHostList($('sites').value),
        excluded: parseHostList($('excluded').value),
        domains: parseHostList($('domains').value),
      };
      saveSettings(s).then(() => {
        ['sites', 'excluded', 'domains'].forEach(k => { $(k).value = s[k].join('\n'); });
        $('status').textContent = 'נשמר ✓';
        setTimeout(() => { $('status').textContent = ''; }, 2000);
      });
    });
    if (onClose) $('close').addEventListener('click', onClose);
  }

  const API = 'https://6ejpppqpkh.execute-api.eu-west-1.amazonaws.com/Prod/create';

  // GM_xmlhttpRequest עוקף את מדיניות האבטחה (CSP) של הפורום
  function requestShort(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: API,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        data: JSON.stringify({ url }),
        timeout: 15000,
        onload(res) {
          if (res.status < 200 || res.status >= 300) return reject(new Error('status ' + res.status));
          try { resolve(JSON.parse(res.responseText)); } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('network')),
        ontimeout: () => reject(new Error('timeout')),
      });
    });
  }

  function loadSettings() {
    return Promise.resolve(GM_getValue('settings'));
  }

  function saveSettings(s) {
    GM_setValue('settings', s);
    return Promise.resolve();
  }

  // מתעדכן גם כששומרים הגדרות בלשונית אחרת
  function onSettingsChanged(cb) {
    GM_addValueChangeListener('settings', (name, oldValue, newValue) => cb(newValue));
  }

  // חלון ההגדרות נפתח מתפריט טמפרמונקי, בתוך shadow DOM כדי שעיצוב הפורום לא ישפיע עליו
  function openSettings() {
    if (document.getElementById('nls-settings-host')) return;
    const host = document.createElement('div');
    host.id = 'nls-settings-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
    const shadow = host.attachShadow({ mode: 'open' });
    const panel = document.createElement('div');
    panel.style.cssText = 'border-radius:10px;overflow:auto;max-height:100%;box-shadow:0 8px 30px rgba(0,0,0,.35)';
    shadow.appendChild(panel);
    const close = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    host.addEventListener('click', e => { if (e.composedPath()[0] === host) close(); });
    document.addEventListener('keydown', onKey, true);
    renderSettings(panel, close);
    document.body.appendChild(host);
  }

  GM_registerMenuCommand('⚙️ הגדרות', openSettings);

  // הקוד המשותף לתוסף ולסקריפט. הפלטפורמה מספקת requestShort(url) → Promise<תשובת JSON>.

  // אילו קישורים לקצר: רק קישור לקובץ או לתיקייה, לא לדף הבית של האתר.
  // כל כלל: דומיין (כולל תתי-דומיינים) + בדיקה על האובייקט URL.
  const hasToken = u => u.pathname.split('/').some(s => /^(?=.*[\dA-Z])[\w-]{5,}$/.test(s));
  const RULES = [
    [['drive.google.com', 'docs.google.com'], u =>
      /\/(u\/\d+\/)?d\/(e\/)?[\w-]{10,}|\/folders\/[\w-]{10,}/.test(u.pathname) ||
      /^[\w-]{10,}$/.test(u.searchParams.get('id') || '')],
    [['drive.usercontent.google.com'], u => /^[\w-]{10,}$/.test(u.searchParams.get('id') || '')],
    // מג'יקוד: קישור צפייה (/send-file/file/<id>/view) וגם קישור הורדה (כל קישור עם download)
    [['magicode.me'], u => /\/send-file\/file\/[^/]+/.test(u.pathname) ||
      (/download/i.test(u.pathname + u.search) && !/^\/send-file\/(prep-)?upload\/?$/.test(u.pathname))],
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

  let settings = withDefaults();
  loadSettings().then(s => { settings = withDefaults(s); });
  onSettingsChanged(s => { settings = withDefaults(s); });

  // האם לפעול בדף הזה: חריגים קודמים לכול, אחריהם רשימת האתרים, ואז הזיהוי האוטומטי
  function isActiveHere() {
    const host = location.hostname;
    if (hostInList(host, settings.excluded)) return false;
    if (hostInList(host, settings.sites)) return true;
    return settings.autoDetect && isNodeBB();
  }

  function shouldShorten(url) {
    let u;
    try { u = new URL(url); } catch (e) { return false; }
    const host = u.hostname.toLowerCase();
    if (RULES.some(([domains, test]) => hostInList(host, domains) && test(u))) return true;
    // דומיין שהמשתמש הוסיף: כל קישור חוץ מדף הבית
    return hostInList(host, settings.domains) && (u.pathname.replace(/\/+$/, '') !== '' || u.search !== '');
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
    if (!(el instanceof HTMLTextAreaElement) || !isActiveHere()) return;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!text) return;
    const urls = [...new Set((text.match(URL_RE) || []).map(u => u.replace(/[.,;:!?]+$/, '')))]
      .filter(shouldShorten);
    // ההדבקה עצמה עוברת כרגיל; ההחלפה קורית ברקע כשהקיצור חוזר
    urls.forEach(u => shorten(u).then(s => replaceInField(el, u, s)).catch(() => {}));
  }

  document.addEventListener('paste', onPaste, true);
})();
