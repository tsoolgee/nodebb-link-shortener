// הבקשה נשלחת מה-background, שם מדיניות האבטחה של הפורום לא חלה
function requestShort(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'shorten', url }, res => {
      if (chrome.runtime.lastError || !res || !res.ok) return reject(new Error('failed'));
      resolve(res.data);
    });
  });
}
