const CF_URL = 'https://curvefever.pro/';
const $ = id => document.getElementById(id);

const status = (msg, isErr = false) => {
  $('status').textContent = msg;
  $('status').className = isErr ? 'err' : '';
};

chrome.storage.local.get({ daysBack: 1, limit: '', openDashboard: true, dashboardUrl: '' }, s => {
  $('daysBack').value = s.daysBack;
  $('limit').value = s.limit;
  $('openDashboard').checked = s.openDashboard && !!s.dashboardUrl;
  $('openDashboard').disabled = !s.dashboardUrl;

  const hint = $('dashboardHint');
  const link = document.createElement('a');
  link.textContent = s.dashboardUrl ? 'Change' : 'Set dashboard URL';
  link.onclick = () => chrome.runtime.openOptionsPage();
  if (!s.dashboardUrl) { hint.append(link); return; }
  const host = new URL(s.dashboardUrl).host;
  chrome.permissions.contains({ origins: [new URL(s.dashboardUrl).origin + '/*'] }, ok => {
    if (!ok) link.textContent = 'Save again to allow access';
    hint.append(host + ' · ', link);
  });
});

const waitForTabLoad = tabId => new Promise(resolve => {
  const listener = (id, info) => {
    if (id === tabId && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
});

$('run').addEventListener('click', async () => {
  const opts = {
    daysBack: Math.max(1, Number($('daysBack').value) || 1),
    limit: Number($('limit').value) || null,
    openDashboard: $('openDashboard').checked,
  };
  chrome.storage.local.set({ daysBack: opts.daysBack, limit: opts.limit || '', openDashboard: opts.openDashboard });

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.startsWith(CF_URL)) {
      // Reuse an open Curve Fever tab if there is one, otherwise open a new one.
      const [existing] = await chrome.tabs.query({ url: CF_URL + '*' });
      if (existing) {
        tab = existing;
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        status('Opening Curve Fever…');
        tab = await chrome.tabs.create({ url: CF_URL });
        await waitForTabLoad(tab.id);
      }
    }

    status('Starting…');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['export.js'] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: o => { window.__cfRun(o); },
      args: [opts],
    });
    status('Running – follow progress on the page.');
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    status(String(err.message || err), true);
  }
});
