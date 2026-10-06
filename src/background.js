const API = 'https://6ejpppqpkh.execute-api.eu-west-1.amazonaws.com/Prod/create';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'shorten') return;
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({ url: msg.url }),
  })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('status ' + r.status))))
    .then(data => sendResponse({ ok: true, data }))
    .catch(() => sendResponse({ ok: false }));
  return true; // תשובה אסינכרונית
});
