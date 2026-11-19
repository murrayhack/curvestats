# Curve Fever Stats Export

A Firefox extension that exports your match results from [Curve Fever Pro](https://curvefever.pro) to a JSON file, and can import that file into a Curve Fever leaderboard dashboard right away.

Curve Fever has no API for match history, so the extension does what you would do by hand: it opens your profile's **Matches** tab, scrolls back as far as you ask, opens each match and reads the final scores, players and powers.

## Features

- One-click export from the toolbar. Opens curvefever.pro if needed and navigates to your match list.
- Choose how many days back to export, and optionally a maximum number of matches.
- Progress box on the page, with a **Stop & download** button that keeps what has been fetched so far.
- Downloads `curvefever_matcher_YYYY-MM-DD_HHMM.json` (local time, so several sessions a day don't collide).
- **Open dashboard**: after the export, opens your dashboard's import page and imports the file automatically. The dashboard address is a setting, so anyone running the same dashboard can use it.

## Install (Firefox)

**Signed build (recommended):** requires Firefox 140 or later.
1. Download the latest `.xpi` from [Releases](https://github.com/murrayhack/curvestats/releases/latest).
2. In Firefox, open `about:addons` → gear icon → **Install Add-on From File…** and pick the file. (Dragging the file into a Firefox window works too. Clicking the link on GitHub only downloads it.)

The extension doesn't update itself – install a newer release the same way; settings are kept.

**From source (temporary, for development):**
1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Pick `extension/manifest.json`.

Temporary add-ons are removed when Firefox restarts. After changing code, press **Reload** on the extension in `about:debugging` and reload the curvefever.pro tab.

## Usage

1. Log in to [curvefever.pro](https://curvefever.pro).
2. Click the extension icon, set **Days back** (and **Max matches** if you want a cap).
3. Click **Export**. Follow progress in the box at the top right of the page.

Exports are slow by nature: each match is opened one at a time, so a few seconds per match.

### Dashboard import

1. Open the extension's settings (popup → **Set dashboard URL**, or `about:addons` → the extension → **Preferences**).
2. Enter the dashboard's address, e.g. `https://curvefever.example.com`, and click **Save**. Firefox asks for permission to access that site – this is needed to hand the file to the dashboard.
3. Tick **Open dashboard** in the popup. After an export, `<dashboard>/import` opens and the file is dropped onto its import zone. If you are logged out, log in and the import continues.

The JSON file is always downloaded as well, so you keep a copy.

## Output format

```jsonc
{
  "matches": [
    {
      "id": "…",                         // Curve Fever's match id, used to recognise duplicates
      "datetime": "2026-11-19T21:34:00+01:00",
      "duration_seconds": 251,
      "players": [
        { "position": 1, "player": "Name", "score": 42, "powers": ["ZAP", "BURST", "SHOT_SINGLE"] }
      ]
    }
  ]
}
```

## Console script

[`export-script.js`](export-script.js) is the original stand-alone version (comments in Swedish). Open your profile's **Matches** tab, paste it into the DevTools console and press Enter. Settings are at the top of the script; stop early with `window.__cfStop = true`.

## Project layout

```
extension/
  manifest.json    Manifest V3, written to work in both Firefox and Chrome
  popup.*          Toolbar popup: days back, max matches, Open dashboard
  options.*        Settings page: dashboard URL (+ site permission request)
  export.js        Injected into curvefever.pro: navigation, scraping, download
  background.js    Opens the dashboard and hands the file to its import page
  icons/           PNG icons, rendered from icons/icon.html (Twemoji graphics)
export-script.js   Original console script
sign.sh            Signs the Firefox extension via addons.mozilla.org
```

## Signing a release (Firefox)

Firefox only installs signed add-ons permanently. This repo signs them as **unlisted** (self-distributed) on addons.mozilla.org.

1. Create API credentials at <https://addons.mozilla.org/developers/addon/api/key/> and store them in the macOS Keychain:
   ```sh
   security add-generic-password -a "$USER" -s amo-api-key -w      # JWT issuer
   security add-generic-password -a "$USER" -s amo-api-secret -w   # JWT secret
   ```
2. Bump `"version"` in `extension/manifest.json` (AMO rejects a version it has already signed).
3. Run `./sign.sh`. The signed `.xpi` ends up in `extension/web-ext-artifacts/`.
4. Copy the signed file to `curvestats-X.Y.Z.xpi` and publish it: `gh release create vX.Y.Z curvestats-X.Y.Z.xpi --title "X.Y.Z" --notes "…"`.

If you fork this, change `browser_specific_settings.gecko.id` in the manifest to an id of your own – AMO ties the id to the account that first signed it.

## Todo

- [ ] **Chrome support.** The manifest and code are written to work in Chrome as well (Manifest V3, `chrome.*` APIs, a background service worker entry), but it hasn't been tested there yet. Loading it unpacked via `chrome://extensions` → Developer mode → **Load unpacked** should work; distributing it to others needs the Chrome Web Store (unlisted is fine).

## Credits

The icon is made from [Twemoji](https://github.com/jdecked/twemoji) graphics (🥵 🐍 📥), © Twitter, Inc and other contributors, licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Disclaimer

Not affiliated with Curve Fever Pro. The extension reads the game's web page, so it may break when the site changes – the selectors live in `extension/export.js`.
