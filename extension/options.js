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

  // הבקשה נשלחת מה-background, שם מדיניות האבטחה של הפורום לא חלה
  function requestShort(url) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'shorten', url }, res => {
        if (chrome.runtime.lastError || !res || !res.ok) return reject(new Error('failed'));
        resolve(res.data);
      });
    });
  }

  function loadSettings() {
    return new Promise(resolve => chrome.storage.sync.get('settings', r => resolve(r && r.settings)));
  }

  function saveSettings(s) {
    return new Promise(resolve => chrome.storage.sync.set({ settings: s }, resolve));
  }

  function onSettingsChanged(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.settings) cb(changes.settings.newValue);
    });
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

  renderSettings(document.body);
})();
