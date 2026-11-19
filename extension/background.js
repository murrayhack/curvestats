// When export.js reports a finished export, open the configured dashboard's import page
// and hand it the file, as if it had been dropped on the drop zone.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'cf-export-done' || sender.id !== chrome.runtime.id) return;
  chrome.storage.local.get({ dashboardUrl: '' }, async ({ dashboardUrl }) => {
    if (!dashboardUrl) return;
    const { origin } = new URL(dashboardUrl);
    try {
      const tab = await chrome.tabs.create({ url: origin + '/import' });
      await waitForLoad(tab.id, origin);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',   // run as page code, so the dashboard can read the File we create
        func: dropFile,
        args: [msg.filename, msg.json],
      });
    } catch (err) {
      console.warn('[cf-export] could not import on dashboard:', err);
    }
  });
});

// Resolves once the tab has finished loading a page on `origin`. Firefox first reports a
// finished about:blank in new tabs, so the URL has to be checked too.
const waitForLoad = (tabId, origin) => new Promise(resolve => {
  const loaded = tab => tab.status === 'complete' && tab.url?.startsWith(origin);
  const listener = (id, info, tab) => {
    if (id === tabId && loaded(tab)) {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
  chrome.tabs.get(tabId, tab => loaded(tab) && listener(tabId, {}, tab));
});

// Runs in the dashboard page. Waits for the import drop zone (the user may have to log in
// first, which the dashboard handles without a page reload) and feeds it the file.
function dropFile(filename, json) {
  console.log('[cf-export] waiting for the import drop zone…');
  const t0 = Date.now();
  const timer = setInterval(() => {
    const input = document.querySelector('.drop input[type="file"]');
    if (!input || input.disabled) {
      if (Date.now() - t0 > 5 * 60e3) {
        clearInterval(timer);
        console.warn('[cf-export] gave up: no import drop zone found on this page.');
      }
      return;
    }
    clearInterval(timer);
    const dt = new DataTransfer();
    dt.items.add(new File([json], filename, { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('[cf-export] handed', filename, 'to the import drop zone.');
  }, 300);
}
