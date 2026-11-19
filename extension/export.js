// Curve Fever Pro – export match results to JSON.
// Injected by the extension popup. Based on ../export-script.js, with automatic
// navigation to the "Matches" tab and an on-page progress box.

window.__cfRun = window.__cfRun || (async ({ daysBack = 1, limit = null, openDashboard = false } = {}) => {
  if (window.__cfRunning) { alert('Curve Fever export is already running.'); return; }
  window.__cfRunning = true;
  window.__cfStop = false;

  const TIMEOUT_MS = 10000;   // max wait per step

  // ---- Progress box ----
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#112d45;color:#fff;' +
    'font:13px system-ui,sans-serif;padding:10px 12px;border-radius:8px;box-shadow:0 4px 16px #0008;max-width:320px';
  const msg = document.createElement('div');
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop & download';
  stopBtn.style.cssText = 'margin-top:8px;cursor:pointer';
  stopBtn.onclick = () => { window.__cfStop = true; stopBtn.disabled = true; };
  box.append(msg, stopBtn);
  document.body.appendChild(box);
  const log = (text, level = 'log') => { msg.textContent = text; console[level]('[cf-export]', text); };
  const finish = (text, level) => {
    log(text, level);
    stopBtn.textContent = 'Close';
    stopBtn.disabled = false;
    stopBtn.onclick = () => box.remove();
    setTimeout(() => box.remove(), 15000);
    window.__cfRunning = false;
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, timeout = TIMEOUT_MS, step = 100) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    throw new Error('Timeout');
  };

  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
      `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  };
  // "30/10/26 09:47" -> Date
  const parseListDate = s => {
    const [dd, mo, yy, hh, mi] = s.match(/\d+/g).map(Number);
    return new Date(2000 + yy, mo - 1, dd, hh, mi);
  };
  // "4m 11s" -> 251
  const toSeconds = s => {
    const m = s.match(/(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/);
    return (+(m[1] || 0)) * 60 + (+(m[2] || 0));
  };
  // "/imgs/PWR_ZAP-DrthTXnC.svg" -> "ZAP", "/imgs/SHOT_SINGLE-xxx.svg" -> "SHOT_SINGLE"
  const powerName = src => (src || '').split('/').pop().split('?')[0]
    .replace(/-[A-Za-z0-9_]{6,10}\.(svg|png)$/, '').replace(/\.(svg|png)$/, '').replace(/^PWR_/, '');

  const download = (filename, json) => {
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const closePopup = async () => {
    const p = document.querySelector('.popup--match');
    if (!p) return;
    p.querySelector('.close-button')?.click();
    await waitFor(() => !document.querySelector('.popup--match'));
  };

  const hasMatchList = () => document.querySelector('.match .match-date');
  const visible = el => el.getClientRects().length > 0;
  // The profile "Matches" tab: by its guide id, else a tab button labelled "Matches".
  const MATCHES_TAB = ['matches', 'wedstrijden', 'spiele', 'kampe', 'mecze'];
  const findMatchesTab = () => {
    const tab = document.querySelector('#guide-profile-matches')?.closest('.tab-button, [role="tab"]') ||
      [...document.querySelectorAll('.tab-button, [role="tab"]')]
        .find(el => MATCHES_TAB.includes(el.textContent.trim().toLowerCase()));
    return tab && visible(tab) ? tab : null;
  };

  // ---- 0. Navigate to profile → Matches ----
  const openMatchList = async () => {
    if (hasMatchList()) return;
    log('Opening your profile…');
    let tab = findMatchesTab();
    if (!tab) {
      const profile = await waitFor(() => document.querySelector('#guide-topbar-profile'), 20000).catch(() => null);
      if (!profile) throw new Error('Could not find your profile button in the top bar. Open your profile manually and run again.');
      console.log('[cf-export] clicking profile:', profile);
      profile.click();
      tab = await waitFor(findMatchesTab).catch(() => null);
      if (!tab) throw new Error('Could not find the "Matches" tab. Open it manually and run again.');
    }
    console.log('[cf-export] clicking matches tab:', tab);
    tab.click();
    log('Waiting for match list…');
    await waitFor(hasMatchList, 15000).catch(() => {
      throw new Error('The match list did not load. Open your profile → "Matches" manually and run again.');
    });
  };

  try {
    await openMatchList();
  } catch (err) {
    finish(String(err.message || err), 'error');
    return;
  }

  // ---- 1. Load the match list ----
  await closePopup();
  const cutoff = new Date(Date.now() - daysBack * 864e5);

  let scroller = document.querySelector('.match');
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 5 &&
         getComputedStyle(scroller).overflowY !== 'visible')) scroller = scroller.parentElement;

  log(`Loading match list back to ${cutoff.toLocaleDateString()}…`);
  let lastCount = 0, stale = 0;
  while (scroller && !window.__cfStop) {
    const ms = document.querySelectorAll('.match');
    const oldest = parseListDate(ms[ms.length - 1].querySelector('.match-date').textContent);
    if (oldest < cutoff || (limit && ms.length >= limit)) break;
    if (ms.length === lastCount) { if (++stale >= 5) break; } else { stale = 0; lastCount = ms.length; }
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll'));
    await sleep(1200);
    log(`${ms.length} matches loaded (oldest ${oldest.toLocaleDateString()})`);
  }

  const rows = [...document.querySelectorAll('.match')]
    .filter(m => parseListDate(m.querySelector('.match-date').textContent) >= cutoff);
  const total = limit ? Math.min(limit, rows.length) : rows.length;
  log(`${total} matches to fetch.`);

  // ---- 2. Open each match and read the final result ----
  const matches = [], errors = [];
  let prevId = null;
  for (let i = 0; i < total && !window.__cfStop; i++) {
    const row = rows[i];
    const listDate = parseListDate(row.querySelector('.match-date').textContent);
    try {
      row.scrollIntoView({ block: 'center' });
      row.querySelector('.match-top').click();
      const pop = await waitFor(() => {
        const p = document.querySelector('.popup--match');
        if (!p || !p.querySelector('.player-entry .player-score')) return null;
        const id = p.querySelectorAll('.details-group-detail')[1]?.textContent.trim();
        return id && id !== prevId ? p : null;
      });
      prevId = pop.querySelectorAll('.details-group-detail')[1].textContent.trim();
      const durText = pop.querySelectorAll('.details-group')[1].querySelector('.details-group-value').textContent.trim();

      matches.push({
        id: prevId,                      // Curve Fever's match id, used to recognise duplicates
        datetime: isoLocal(listDate),
        duration_seconds: toSeconds(durText),
        players: [...pop.querySelectorAll('.player-entry')].map((e, j) => ({
          position: j + 1,
          player: e.querySelector('.name').textContent.trim(),
          score: Number(e.querySelector('.player-score').textContent.trim()),
          powers: [...e.querySelectorAll('.player-modules img')].map(img => powerName(img.getAttribute('src'))),
        })),
      });
      await closePopup();
    } catch (err) {
      errors.push({ index: i, datetime: isoLocal(listDate), error: String(err) });
      console.warn(`[cf-export] Match ${i + 1} (${isoLocal(listDate)}) failed: ${err}`);
      await closePopup().catch(() => {});
    }
    log(`${i + 1}/${total} matches fetched${errors.length ? `, ${errors.length} errors` : ''}`);
  }

  // ---- 3. Save ----
  const result = { matches };
  window.__cfResult = result;
  if (errors.length) console.warn('[cf-export] errors:', errors);
  if (matches.length) {
    const now = new Date();   // local time, e.g. curvefever_matcher_2026-11-19_2134.json
    const filename = `curvefever_matcher_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}.json`;
    const json = JSON.stringify(result, null, 2);
    download(filename, json);
    // The background script opens the dashboard and imports the file there.
    // Give the download a moment to start before the dashboard tab takes focus.
    if (openDashboard) setTimeout(() => chrome.runtime.sendMessage({ type: 'cf-export-done', filename, json }), 1000);
  }
  finish(`Done: ${matches.length} matches exported, ${errors.length} errors.`);
});

// Firefox returns the last expression to the popup; a function cannot be cloned.
undefined;
