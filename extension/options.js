const input = document.getElementById('dashboardUrl');
const status = document.getElementById('status');

const show = (text, isErr = false) => {
  status.textContent = text;
  status.className = isErr ? 'err' : '';
};

chrome.storage.local.get({ dashboardUrl: '' }, s => { input.value = s.dashboardUrl; });

document.getElementById('save').addEventListener('click', async () => {
  const value = input.value.trim();
  if (!value) {
    chrome.storage.local.set({ dashboardUrl: '' }, () => show('Saved.'));
    return;
  }
  let url;
  try { url = new URL(value); } catch { url = null; }
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    show('Enter a full http(s):// URL.', true);
    return;
  }
  // Access to the dashboard's site is needed to import the file there. Must be requested
  // directly in the click handler, before any other await.
  const granted = await chrome.permissions.request({ origins: [url.origin + '/*'] });
  if (!granted) {
    show('Access to the dashboard site is needed to import the file.', true);
    return;
  }
  chrome.storage.local.set({ dashboardUrl: url.origin }, () => {
    input.value = url.origin;
    show('Saved.');
  });
});
