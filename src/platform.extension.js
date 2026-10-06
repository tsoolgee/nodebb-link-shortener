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
