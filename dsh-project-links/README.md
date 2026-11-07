# Project Links (`@local/dsh-project-links`)

A local DSH Web plugin that keeps a short list of project links in the left
sidebar and shows whether each one is reachable.

## What it adds

- A **项目 / Projects** row in the left sidebar's panel list (icon rail when the
  sidebar is collapsed). Selecting it opens the projects panel in the main
  column.
- The projects panel lists every link with a live status dot, the HTTP status
  code and latency, an **Open** action, and a **Remove** action. Clicking a row
  opens the link in a new browser tab.
- An inline form adds a link. A bare host such as `example.com` is stored as
  `https://example.com`.
- **Open with**: a selector above the list chooses how links open — a new tab in
  the app (default), any browser the Host detects on this machine (Chrome,
  Edge, Firefox, Brave, Vivaldi, Safari), or a custom executable path. With a
  browser chosen, the Host launches it directly, so the page stays where it is.

Statuses are probed by the Host, not the page, so CORS does not hide them:
`online` means the Host received any HTTP response within 6 s; `offline` means
the connection failed or timed out. Results are cached for 30 s, refreshed when
the panel opens, every 45 s while it stays mounted, and on demand.

## Data

Links live in `$DSH_HOME/project-links/links.json` (default
`~/.dsh/project-links/links.json`), written atomically. They survive browser
restarts and port changes, and every session in this profile sees the same list.

## Removal

Disable or remove the bundle in Settings → Plugins. The JSON file stays on disk;
delete it to clear the list.

## Source layout

| File | Role |
|---|---|
| `index.js` | Host half: exact `GET/POST /project-links` route, atomic JSON store, reachability probes behind Connection's browser trust fence. |
| `client.js` | Browser half: `main` panel and the `sidebar.panellist` row, localized `zh`/`en` dictionaries, scoped styles on theme tokens. |
| `cordis.patch.yml` | Inserts the one Host row. |
| `locale/*.json` | Plugin Manager title and description. |
| `test/*.mjs` | Local smoke tests (not loaded at runtime). |

## Smoke tests

```powershell
cd D:\class-app
node dsh-project-links\test\host-smoke.mjs    # route, store, validation, probes, browser launch
node dsh-project-links\test\client-smoke.mjs  # loader contract, registrations, SSR render
```

The interactive browser-half test needs `react-test-renderer` (not a package
dependency). Point it at any `node_modules` directory that has React 18 and the
renderer installed:

```powershell
$env:DPL_TEST_MODULES = 'C:\path\to\node_modules'
node dsh-project-links\test\client-interactive.mjs
```

It drives the real component: row click, open-with selection, custom path, and
the add form against a mocked Host route.

## Notes

- The browser list is detected when the Host starts, so a browser installed
  later appears after the next DSH restart.
- Changing `index.js` (the Host half) needs a DSH restart, because Host plugin
  modules are imported once per process. Client-half edits are served on the
  next page load.
