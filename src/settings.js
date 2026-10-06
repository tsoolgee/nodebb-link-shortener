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
