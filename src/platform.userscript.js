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
