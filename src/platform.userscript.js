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
