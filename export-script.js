// Curve Fever Pro – exportera matchresultat till JSON
// Användning:
//   1. Öppna https://curvefever.pro, klicka på ditt namn och välj fliken "Matches".
//   2. Öppna DevTools (F12 / Cmd+Opt+J) → fliken Console.
//   3. Klistra in hela skriptet och tryck Enter.
//   4. Följ förloppet i konsolen. När det är klart laddas en JSON-fil ner.
//   Avbryt när som helst med:  window.__cfStop = true   (det som hunnit samlas laddas ner)

(async () => {
  // ---- Inställningar ----
  const DAYS_BACK = 1;        // hur långt bakåt (dagar)
  const LIMIT = null;         // max antal matcher (null = alla inom perioden)
  const DOWNLOAD = true;      // ladda ner JSON-fil när det är klart
  const TIMEOUT_MS = 10000;   // max väntetid per steg

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

  const download = data => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `curvefever_matcher_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const closePopup = async () => {
    const p = document.querySelector('.popup--match');
    if (!p) return;
    p.querySelector('.close-button')?.click();
    await waitFor(() => !document.querySelector('.popup--match'));
  };

  // ---- 1. Ladda in matchlistan ----
  if (!document.querySelector('.match')) {
    console.error('Hittar inga matcher. Öppna din profil och fliken "Matches" först.');
    return;
  }
  await closePopup();
  window.__cfStop = false;
  const cutoff = new Date(Date.now() - DAYS_BACK * 864e5);

  let scroller = document.querySelector('.match');
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 5 &&
         getComputedStyle(scroller).overflowY !== 'visible')) scroller = scroller.parentElement;

  console.log(`Laddar matchlistan tillbaka till ${cutoff.toLocaleDateString()}…`);
  let lastCount = 0, stale = 0;
  while (scroller && !window.__cfStop) {
    const ms = document.querySelectorAll('.match');
    const oldest = parseListDate(ms[ms.length - 1].querySelector('.match-date').textContent);
    if (oldest < cutoff || (LIMIT && ms.length >= LIMIT)) break;
    if (ms.length === lastCount) { if (++stale >= 5) break; } else { stale = 0; lastCount = ms.length; }
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll'));
    await sleep(1200);
    console.log(`  ${ms.length} matcher inlästa (äldsta ${oldest.toLocaleDateString()})`);
  }

  const rows = [...document.querySelectorAll('.match')]
    .filter(m => parseListDate(m.querySelector('.match-date').textContent) >= cutoff);
  const total = LIMIT ? Math.min(LIMIT, rows.length) : rows.length;
  console.log(`${total} matcher att hämta.`);

  // ---- 2. Öppna varje match och läs slutresultatet ----
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
      console.warn(`  Match ${i + 1} (${isoLocal(listDate)}) misslyckades: ${err}`);
      await closePopup().catch(() => {});
    }
    if ((i + 1) % 10 === 0 || i + 1 === total) console.log(`  ${i + 1}/${total} klara`);
  }

  // ---- 3. Spara ----
  const result = { matches };
  window.__cfResult = result;
  console.log(`Klart: ${matches.length} matcher hämtade, ${errors.length} fel.`, errors.length ? errors : '');
  if (DOWNLOAD) download(result);
  return result;
})();
