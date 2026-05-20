# WiFi / Network System — Single Source of Truth

> **Read this in full before touching ANY part of the network system.**
> Anything that touches the captive portal, the bridge, MikroTik, or student-to-WiFi mapping should be designed against this document. If a change conflicts with anything here, the document needs to be updated alongside the code — never silently diverge.

Last updated: 2026-05-20.

---

## 1. The one critical rule

**The identifier called `الكود` in the UI is `student.member_number` (DB column `member_number`).** It is the **only** identifier used anywhere in the WiFi flow.

- MikroTik hotspot user `name` = `member_number`
- MikroTik hotspot user `password` = `member_number` (same value)
- Captive portal accepts `member_number` as input
- Captive portal submits `member_number` to MikroTik
- Bridge `mtkEnable` reads `student.memberNumber` only

**Never use `student_id` (LIB-XXXXX) anywhere in the WiFi chain.** It is the internal database key, not user-facing.

If a student has empty `member_number`, they cannot use WiFi. The cashier must set one before checking them in.

---

## 2. Architecture (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  Cashier's browser (admin/cashier UI)                       │
│  • http://10.5.50.240:5173 (local Windows-hosted website)   │
│  • https://smart-vision-system-five.vercel.app (cloud)      │
│        │                                                    │
│        ↓                                                    │
│  Supabase (vokdyuhmrnwyphgdlqri.supabase.co)                │
│  • Source of truth for students, sessions, payments         │
│        │                                                    │
│        ↓                                                    │
│  MikroTik Bridge (Node.js, on Windows PC 10.5.50.240:3456)  │
│  • Receives /api/enable from cashier UI (fast path)         │
│  • student-sync.js polls Supabase every 30s (self-heal)     │
│  • Translates HTTP → RouterOS API                           │
│        │                                                    │
│        ↓                                                    │
│  MikroTik Router (10.5.50.1, RouterOS 6.48.7)               │
│  • Hotspot users (created/managed by the bridge)            │
│  • Captive portal serves flash/hotspot/login.html           │
│  • Authenticates students; routes their traffic             │
└─────────────────────────────────────────────────────────────┘
```

### Pieces

| # | Piece | Where it runs | Source files |
|---|---|---|---|
| 1 | Smart Vision web app | Windows PC + Vercel | `src/` (React/Vite) |
| 2 | MikroTik Bridge | Windows PC, pm2 | `mikrotik-bridge/` (Node.js) |
| 3 | Captive portal HTML | MikroTik flash | `~/Desktop/login.html` → `flash/hotspot/login.html` |
| 4 | MikroTik router | Physical device | `/ip/...` config in RouterOS |
| 5 | Supabase | Cloud | `supabase/migrations/`, `supabase/schema.sql` |

---

## 3. Credentials registry

> Keep this section private. Anyone with these values can fully control the WiFi system.

### Router

| Item | Value |
|---|---|
| Router LAN IP | `10.5.50.1` |
| Hotspot name | `hotspot1` on interface `LAN`, profile `hsprof1` |
| RouterOS version | `6.48.7` |
| Admin user | `admin` / *(your admin password)* |
| API port | `8728` |
| FTP port | `21` (enabled only temporarily during login.html uploads) |
| Bridge API user | `svs-bridge` |
| Bridge API password | `AlbaraWadee2002` |

### Bridge (Windows host)

| Item | Value |
|---|---|
| Windows host IP | `10.5.50.240` |
| Source folder | `C:\mikrotik-bridge\` |
| Listen port | `3456` |
| pm2 process name | `mikrotik-bridge` |
| BRIDGE_SECRET | `k7Xq2mN9pR4vT8yW1eL3hG6jB5cF0dS-SmartVision-2026` |
| Health check URL | `http://10.5.50.240:3456/api/status` |

### Smart Vision app (Windows host)

| Item | Value |
|---|---|
| Source folder | `C:\smartvision-pkg\` |
| Listen port | `5173` |
| pm2 process name | `smartvision-app` |
| In-library URL | `http://10.5.50.240:5173` |
| Cloud URL | `https://smart-vision-system-five.vercel.app` |

### Supabase

| Item | Value |
|---|---|
| Project URL | `https://vokdyuhmrnwyphgdlqri.supabase.co` |
| Anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZva2R5dWhtcm53eXBoZ2RscXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDcwNDksImV4cCI6MjA5MTQ4MzA0OX0.hu1OF4i05nWCsNNi5Lnw5jJbNIfFlcmqELun1WtsGrk` |
| Bridge auth | Same anon key, set as `SUPABASE_URL` + `SUPABASE_KEY` in `mikrotik-bridge/.env` |

### Windows firewall

| Rule | Port | Direction | Protocol |
|---|---|---|---|
| Smart Vision App | 5173 | Inbound | TCP |
| MikroTik Bridge | 3456 | Inbound | TCP |

### Walled garden (pre-auth allow list)

| Host | Why |
|---|---|
| `10.5.50.240` | Smart Vision web app + bridge API |
| `vokdyuhmrnwyphgdlqri.supabase.co` | Captive portal Supabase lookup |
| `fonts.googleapis.com` | Captive portal DM Sans CSS |
| `fonts.gstatic.com` | Captive portal DM Sans font files |

---

## 4. File index (what changes what)

### Frontend (React app — `src/`)

| File | What it does |
|---|---|
| `src/lib/mikrotikApi.js` | All HTTP calls to the bridge: `mtkEnable`, `mtkDisable`, `mtkGetStatus`, etc. `pickHotspotUsername` extracts `memberNumber` only. |
| `src/views/portal/CaptivePortal.jsx` | The `/#wifi` page. Looks up student by `member_number`, checks active session, submits credentials to MikroTik. |
| `src/views/portal/PortalStatus.jsx` | The `/#wifi-status` "you are connected" page. |
| `src/views/cashier/Hub.jsx` | Main cashier check-in UI. Calls `mtkEnable` after creating session. |
| `src/views/cashier/CheckIn.jsx` | Alternative check-in flow. Calls `mtkEnable`. |
| `src/views/cashier/CheckoutModal.jsx` | Calls `mtkDisable` on checkout. |
| `src/views/admin/NetworkDashboard.jsx` | Admin WiFi dashboard. Reads bridge status, blocks, etc. |
| `src/views/admin/Settings.jsx` | Bridge URL + secret saved to `app_config`. |

### Bridge (Node.js — `mikrotik-bridge/`)

| File | What it does |
|---|---|
| `mikrotik-bridge/server.js` | Express server, routes for `/api/enable`, `/api/disable`, `/api/active`, etc. |
| `mikrotik-bridge/mikrotik.js` | RouterOS API wrapper (uses `node-routeros` v1.1.3, `RouterOSAPI` class). Implements `enableUser`, `disableUser`, `withClient`. |
| `mikrotik-bridge/student-sync.js` | **The self-healing piece.** Polls Supabase every 30s; for every active session, ensures a hotspot user named `member_number` exists in MikroTik. |
| `mikrotik-bridge/session-worker.js` | Auto-expires `WIFI-*` voucher users (not library students). |
| `mikrotik-bridge/block-manager.js` | DNS-based website blocking, walled garden. |
| `mikrotik-bridge/.env` | Configuration (see "Bridge env file" section below). |
| `mikrotik-bridge/.env.example` | Template for `.env`. Committed to git. |

### Captive portal HTML

| File | What it does |
|---|---|
| `~/Desktop/login.html` (source on Mac) | The Smart Vision captive portal page. Self-contained — inline CSS, DM Sans from Google Fonts, JS does Supabase lookup + MikroTik form POST. |
| `flash/hotspot/login.html` (on router) | The deployed copy, uploaded via FileZilla (FTP). |

### Database

| File | What it does |
|---|---|
| `supabase/schema.sql` | Canonical table definitions. `students.member_number` is the WiFi identifier. |
| `supabase/migrations/*.sql` | Incremental migrations. Anything that touches the WiFi schema goes here. |

---

## 5. The auth flow end-to-end

### A. Cashier check-in (fast path)

1. Cashier opens **the local URL** `http://10.5.50.240:5173` (NOT Vercel — Vercel can't reach the bridge on a private IP).
2. Cashier searches for a student → presses check-in.
3. `Hub.jsx` (or `CheckIn.jsx`) calls `mtkEnable(config, student)`.
4. `mtkEnable` POSTs to `http://10.5.50.240:3456/api/enable` with body `{username: student.memberNumber, speedProfile: "svs-normal", maxDevices: 2, dataLimitMb: 0, comment: student.name}`.
5. Bridge creates hotspot user `member_number` with password `member_number` in MikroTik.
6. Console shows `[mtkEnable] failed: ...` if anything went wrong (no more silent swallowing).

### B. Bridge sync (self-healing path)

Runs in the background regardless of cashier behaviour. **This guarantees correctness even when the cashier path fails.**

1. Every 30s, `student-sync.js` queries Supabase:
   - `GET /rest/v1/sessions?status=eq.active&select=student_id`
   - Then `GET /rest/v1/students?id=in.(...)&select=id,member_number,name`
2. For each returned student with non-empty `member_number`:
   - Check if hotspot user with that name already exists.
   - If not, call the same `enableUser(...)` that the HTTP endpoint uses.
3. Logs `[student-sync] Created hotspot user: <member_number> (<name>)` for each new one.

### C. Phone joins WiFi

1. Phone connects to the SSID → MikroTik captive portal triggers.
2. Phone's captive portal browser loads `http://10.5.50.1/login` → MikroTik serves `flash/hotspot/login.html`.
3. The page is Smart Vision-branded (DM Sans, EN/AR + dark/light toggle).
4. If MikroTik determined the device is **already authenticated** (cookie/IP-MAC binding), `$(if logged-in)` injects JS that closes the window immediately.

### D. Student logs in

1. Student types their `الكود` (e.g. `92`) → taps **Get online**.
2. JS in `login.html`:
   - `GET https://vokdyuhmrnwyphgdlqri.supabase.co/rest/v1/students?member_number=ilike.92` → finds the student.
   - `GET .../rest/v1/sessions?student_id=eq.<id>&status=eq.active` → confirms active session.
   - If no student → "We couldn't find you" + visit cashier hint.
   - If student but no session → "Check in first" yellow card.
3. If session active, JS submits a POST form to `$(link-login-only)` (resolved by MikroTik to `http://10.5.50.1/login`) with `username=92&password=92&dst=<captive.apple.com or original URL>&popup=true`.
4. MikroTik looks up hotspot user `92`, validates password `92`, authenticates the device (IP+MAC), responds 302 to `dst`.
5. The browser follows the redirect to `captive.apple.com/hotspot-detect.html`. The new authenticated route makes that URL reach Apple's server, which returns `Success`. iOS recognises the captive portal as completed and closes the browser.
6. Phone is online ✅.

### E. Hotspot profile (router-side prerequisite)

The hotspot profile `hsprof1` must allow plain-text PAP login (our form is not a JS challenge-response):

```
/ip hotspot profile set [find name=hsprof1] login-by=http-pap,http-chap,cookie,trial
```

This is the **only** router-side config that the deployed `login.html` depends on.

---

## 6. Bridge env file (`mikrotik-bridge/.env`)

The bridge needs **seven** values. All of them must be set:

```
MIKROTIK_HOST=10.5.50.1
MIKROTIK_USER=svs-bridge
MIKROTIK_PASS=AlbaraWadee2002
BRIDGE_PORT=3456
BRIDGE_SECRET=k7Xq2mN9pR4vT8yW1eL3hG6jB5cF0dS-SmartVision-2026

SUPABASE_URL=https://vokdyuhmrnwyphgdlqri.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZva2R5dWhtcm53eXBoZ2RscXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDcwNDksImV4cCI6MjA5MTQ4MzA0OX0.hu1OF4i05nWCsNNi5Lnw5jJbNIfFlcmqELun1WtsGrk
```

If `SUPABASE_URL` or `SUPABASE_KEY` is blank, `student-sync.js` logs `Supabase not configured — sync disabled` and silently no-ops. Always set both.

---

## 7. Deploy procedures

### Smart Vision web app changes (anything in `src/`)

1. Edit code on Mac.
2. `cd "/Users/applecare/programming/web/smart-vision system" && npm run build`.
3. Copy `dist/` into `/tmp/smartvision-pkg/dist/` (the deploy skeleton).
4. `cd /tmp && zip -r ~/Desktop/smartvision-app.zip smartvision-pkg`.
5. On Windows:
   - `pm2 stop smartvision-app`
   - Delete `C:\smartvision-pkg\` entirely (don't merge — stale assets cause confusion).
   - Extract new zip to `C:\`.
   - `cd C:\smartvision-pkg && npm install && pm2 restart smartvision-app && pm2 save`.
6. Vercel: `git push` to the deployment branch — Vercel auto-deploys.

### Bridge changes (anything in `mikrotik-bridge/`)

1. Edit code on Mac.
2. `cd "/Users/applecare/programming/web/smart-vision system" && zip -r ~/Desktop/mikrotik-bridge.zip mikrotik-bridge -x "mikrotik-bridge/node_modules/*" "mikrotik-bridge/.env"`.
3. On Windows:
   - `pm2 stop mikrotik-bridge`
   - Extract zip to `C:\` → **Replace** when prompted (keeps `.env` and `node_modules`).
   - `pm2 restart mikrotik-bridge && pm2 save`.
4. Confirm with `pm2 logs mikrotik-bridge --lines 30` that both workers started:
   ```
   [session-worker] Started (60s interval)
   [student-sync] Started (30s interval)
   ```

### Captive portal changes (`~/Desktop/login.html`)

1. Edit `~/Desktop/login.html` on Mac.
2. Transfer file to Windows.
3. In Winbox terminal: `/ip service enable ftp`
4. In FileZilla: connect to `10.5.50.1` (admin / admin password / port 21) → drag `login.html` into `flash/hotspot/` → Overwrite.
5. In Winbox terminal: `/ip service disable ftp`
6. Verify: `/file print where name="flash/hotspot/login.html"` should show the current minute as creation time.

### Database changes (Supabase)

1. Write a new file at `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
2. Update `supabase/schema.sql` to match (so a fresh provision matches the live schema).
3. Run the SQL in the Supabase dashboard SQL Editor.

### MikroTik router config changes

Use Winbox terminal. Document every change to the router state here, so the system can be rebuilt from scratch if the router is reset.

**Current required router state:**

```
/ip service enable api
/ip service set api port=8728
/user group add name=svs-bridge policy=api,read,write,test,policy,sensitive
/user add name=svs-bridge password=AlbaraWadee2002 group=svs-bridge
/ip dns set allow-remote-requests=yes servers=1.1.1.1,8.8.8.8
/ip hotspot walled-garden ip add dst-host=10.5.50.240 action=accept comment="Smart Vision app"
/ip hotspot walled-garden ip add dst-host=vokdyuhmrnwyphgdlqri.supabase.co action=accept comment="Supabase DB"
/ip hotspot walled-garden ip add dst-host=fonts.googleapis.com action=accept comment="Google Fonts CSS"
/ip hotspot walled-garden ip add dst-host=fonts.gstatic.com action=accept comment="Google Fonts files"
/ip hotspot profile set [find name=hsprof1] login-by=http-pap,http-chap,cookie,trial
```

The hotspot (`hotspot1` on interface `LAN`, profile `hsprof1`) is assumed to already exist — it was set up before Smart Vision integration.

---

## 8. Verification checklists

### After any deploy (smoke test, ~2 minutes)

1. **Bridge alive**: `pm2 status` shows `mikrotik-bridge` online. `curl http://10.5.50.240:3456/api/status` returns `{"ok":true,"host":"10.5.50.1"}`.
2. **App alive**: open `http://10.5.50.240:5173` in browser — login screen renders.
3. **Sync running**: `pm2 logs mikrotik-bridge --lines 5` shows `[student-sync] Started (30s interval)`.
4. **Hotspot users populated**: in Winbox, `/ip hotspot user print` shows users matching the `الكود` of all active sessions.

### After Windows PC reboot

The `autostart.bat` shortcut in the Startup folder runs `pm2 resurrect`, which brings both `mikrotik-bridge` and `smartvision-app` back online. Verify via `pm2 status`.

### After router reboot

The captive portal config persists in the MikroTik flash. The bridge auto-reconnects on first request (`withClient` has a retry).

### End-to-end student-to-WiFi flow

1. Add a test student with `الكود` = `99999` in admin.
2. Check them in via local URL `http://10.5.50.240:5173`.
3. Watch `pm2 logs mikrotik-bridge` — within 30s see `[student-sync] Created hotspot user: 99999 (...)` (or sooner if the cashier path fired first).
4. In Winbox: `/ip hotspot user print where name=99999` → 1 row.
5. On phone: forget WiFi → reconnect → captive portal opens → type `99999` → Get online.
6. Internet works.
7. After test: check the student out, then run `/ip hotspot user remove [find name=99999]` if you want to remove the test user.

---

## 9. Common pitfalls (lessons learned, do not repeat)

| Mistake | What breaks | The rule |
|---|---|---|
| Using `student.studentId` (LIB-XXXXX) for WiFi auth | MikroTik can't find a matching hotspot user | Always use `student.memberNumber`. The bridge stores under `member_number`. |
| Cashier checks in via Vercel cloud URL | Vercel can't reach `10.5.50.240:3456` (private IP), bridge never called. Without `student-sync`, no hotspot user exists. | The Vercel site is fine for view-only / reports but cashier check-in must happen at `http://10.5.50.240:5173`. The 30-second `student-sync` provides eventual consistency. |
| `mtkEnable(...).catch(() => {})` | Bridge call failures invisible | All call sites use `.then(r => { if (!r?.ok) console.warn(...) }).catch(e => console.warn(...))`. Never silently swallow. |
| Forgetting `pm2 save` after `pm2 start` | Process not restored after Windows reboot | Always `pm2 save` after `pm2 start/restart/delete`. |
| Reusing `RouterOSClient` (old API name) | Bridge crashes with `not a constructor` | The package is `node-routeros@^1.1.3`, the export is `RouterOSAPI`. `client.api().write(...)` from v0.x is gone; use `client.write(...)` directly. |
| Setting only `dst_host` in walled garden without including `10.5.50.240` | Captive portal page loads but Supabase JS fails | Walled-garden must include the Smart Vision app IP, Supabase domain, and Google Fonts domains. |
| Hotspot profile `login-by` lacks `http-pap` | `web browser did not send challenge response` even after typing the right code | `login.html` does plain-text PAP submission. Profile must accept it: `/ip hotspot profile set [find name=hsprof1] login-by=http-pap,http-chap,cookie,trial`. |
| Embedded PostgREST query `select=...,students(...)` | `Could not find a relationship between 'sessions' and 'students' in the schema cache` | The schema has no formal foreign key, so PostgREST won't embed. Use two queries: `?student_id=in.(...)` against the students table instead. |
| Updating only `~/Desktop/smartvision-app.zip` but not extracting cleanly on Windows | Old build assets (`index-QWc-*.js`) remain in `dist/assets/` alongside the new ones, sometimes referenced from the new index.html | Delete `C:\smartvision-pkg\` entirely before extracting the fresh zip. |
| Manually editing `flash/hotspot/login.html` via Winbox Files panel | Hard to edit a 35KB inline-styled HTML in the tiny editor | Always upload via FileZilla (briefly enable FTP). Never edit on-router. |
| Adding a Supabase migration but forgetting `schema.sql` | New installs miss the column | Apply every migration to `schema.sql` too. |
| Using `mtkEnable` from the captive portal page via JS fetch from the captive portal browser | iOS Captive Network Assistant blocks fetches to internal IPs | The self-healing path is `student-sync.js` on the bridge — it polls Supabase from the **server** side. The captive portal does NOT call the bridge directly. |

---

## 10. Troubleshooting tree

**Symptom: "We couldn't find you / invalid username or password" on the phone.**

1. **Is the student's `member_number` set?** Check the admin Students view. If blank, set it, then re-check-in.
2. **Does the hotspot user exist in MikroTik?** Winbox: `/ip hotspot user print where name=<member_number>`. If empty, continue.
3. **Is `student-sync` running?** `pm2 logs mikrotik-bridge --lines 50` — look for `[student-sync] Started (30s interval)`.
   - If not running → bridge not on latest code or `.env` missing Supabase. Re-deploy bridge.
4. **Is the sync hitting Supabase?** Logs should show `[student-sync] Created hotspot user: ...` after a check-in. If not, look for `[student-sync] supabase fetch failed: ...` errors — usually `.env` credentials wrong.
5. **Is the hotspot profile PAP-enabled?** `/ip hotspot profile print` — `login-by` must include `http-pap`.
6. **Was the student actually checked in via the LOCAL website?** If checked in via Vercel and `student-sync` is disabled, no hotspot user gets created.

**Symptom: captive portal page is blank or doesn't load.**

1. Phone is connected to library WiFi? (not cellular)
2. Walled garden allows the Smart Vision IP? `/ip hotspot walled-garden ip print` — should include `10.5.50.240`.
3. Is `login.html` actually deployed? `/file print where name="flash/hotspot/login.html"` — date should be recent.

**Symptom: bridge can't reach the router.**

1. `pm2 logs mikrotik-bridge` — look for `Timed out` or `cannot login`.
2. Verify router IP `10.5.50.1` is reachable from Windows: `ping 10.5.50.1`.
3. Verify API service running: in Winbox, `/ip service print where name=api` should not show `X`.
4. Verify `svs-bridge` user exists: `/user print where name=svs-bridge`.

---

## 11. Useful commands cheat sheet

### Bridge (on Windows)

```cmd
pm2 status                          REM all processes
pm2 logs mikrotik-bridge --lines 50 REM live logs
pm2 restart mikrotik-bridge         REM after code or .env change
pm2 delete mikrotik-bridge          REM full reset (use sparingly)
```

### Smart Vision app (on Windows)

```cmd
pm2 restart smartvision-app
```

### MikroTik router (Winbox terminal)

```
/ip hotspot user print                       :: all hotspot users
/ip hotspot active print                     :: currently connected
/ip hotspot active remove [find]             :: kick everyone
/ip hotspot cookie remove [find]             :: clear remember-me cookies
/ip hotspot walled-garden ip print           :: walled-garden rules
/ip hotspot profile print                    :: hotspot profile settings
/file print where name~"login.html"          :: confirm portal HTML
/ip service print                            :: API/FTP service state
```

### Manual bridge API test (Windows command line)

```cmd
curl http://10.5.50.240:3456/api/status

curl -X POST http://10.5.50.240:3456/api/enable ^
  -H "Content-Type: application/json" ^
  -H "x-bridge-secret: k7Xq2mN9pR4vT8yW1eL3hG6jB5cF0dS-SmartVision-2026" ^
  -d "{\"username\":\"99999\",\"speedProfile\":\"svs-normal\",\"maxDevices\":2,\"dataLimitMb\":0,\"comment\":\"test\"}"
```

### Bridge API test (browser console at `http://10.5.50.240:5173`)

```js
fetch('http://10.5.50.240:3456/api/enable', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-bridge-secret': 'k7Xq2mN9pR4vT8yW1eL3hG6jB5cF0dS-SmartVision-2026'
  },
  body: JSON.stringify({ username: '99999', speedProfile: 'svs-normal', maxDevices: 2, dataLimitMb: 0, comment: 'test' })
}).then(r => r.json()).then(console.log)
```

---

## 12. When to update this document

Update **this file in the same commit** as any change that touches:

- Anything in `mikrotik-bridge/` (server.js, mikrotik.js, student-sync.js, session-worker.js, block-manager.js)
- `src/lib/mikrotikApi.js`
- `src/views/portal/CaptivePortal.jsx`, `PortalStatus.jsx`
- `src/views/cashier/Hub.jsx`, `CheckIn.jsx`, `CheckoutModal.jsx` (the parts that call `mtkEnable`/`mtkDisable`)
- `~/Desktop/login.html`
- The Supabase `students.member_number` column
- Any walled-garden, hotspot profile, or hotspot user policy on the router
- The Windows firewall rules for ports 3456 / 5173
- The `BRIDGE_SECRET` value (must be in sync between `.env`, the React app's Settings, and any direct API tests)

If a change is made without updating this file, the next debugging session will lose hours rediscovering what already exists. Don't let that happen.

---

## 13. Cross-references

- **`CLAUDE.md`** — global project rules. WiFi-specific rules live HERE, not there. CLAUDE.md just points at this file.
- **`MIKROTIK_SETUP.md`** — the original "how to set up the router from scratch" guide (non-technical voice). Useful for fresh router provisioning. This document supersedes the technical operational details.
- **`DEPLOYMENT.md`** — a previous lighter deploy notes file. This document supersedes it for the WiFi system. Other deployment notes (Supabase migrations, etc.) remain there.
- **`supabase/schema.sql`** — canonical database structure.
- **`supabase/migrations/*.sql`** — incremental DB changes.

---

## 14. v2 system (Phase 1 — parallel build, NOT yet live)

> A second bridge + new portal are being built alongside the live system. **v1 is still authoritative** for all real WiFi traffic. Read this section before touching anything in `mikrotik-bridge-v2/`, `src/views/portal-v2/`, or `src/portal/`.

### Why parallel, not in-place

The library is open daily — there is no maintenance window for a big-bang rewrite. v2 lives in fresh paths next to v1, behind an `app_config.wifi_v2_enabled` feature flag (default `false`). v1 keeps running every day; v2 ships incrementally.

The Phase 4 cutover (later milestone) will flip the flag, migrate any remaining data, and retire v1.

### File index (v2 additions)

| File | Purpose |
|---|---|
| `mikrotik-bridge-v2/` | Sibling bridge service. Port `3457`. Read-mostly until Phase 4 — adds device tracking + SSE realtime, does NOT create hotspot users (still delegated to v1). |
| `mikrotik-bridge-v2/server.js` | Express entry — auth, routes, watcher boot, graceful shutdown |
| `mikrotik-bridge-v2/mikrotik-pool.js` | Pooled RouterOS connection (1 live socket, reconnect-on-error) |
| `mikrotik-bridge-v2/event-bus.js` | In-memory pub/sub + 100-event ring buffer for SSE replay |
| `mikrotik-bridge-v2/routes/health.js` | `GET /api/v2/status` (public) |
| `mikrotik-bridge-v2/routes/devices.js` | `/api/v2/devices`, `/devices/by-user/:u`, `/device-check`, `/devices/:mac/ban` (501 in Phase 1) |
| `mikrotik-bridge-v2/routes/sessions.js` | `/api/v2/sessions`, `/sessions/:u/kick`, `/sessions/:u/usage` |
| `mikrotik-bridge-v2/routes/profiles.js` | `/api/v2/profiles` CRUD (Mbps/maxDevices model) |
| `mikrotik-bridge-v2/routes/events.js` | `/api/v2/events` — SSE stream, 15s keepalive |
| `mikrotik-bridge-v2/watchers/active-watcher.js` | 5s `/ip/hotspot/active/print` diff loop → bus events |
| `mikrotik-bridge-v2/.env.example` | All required keys (MIKROTIK_*, BRIDGE_PORT_V2, BRIDGE_SECRET_V2, etc.) |
| `mikrotik-bridge-v2/README.md` | Per-bridge ops + route catalog |
| `src/views/portal-v2/CaptivePortal.jsx` | New `/#wifi-v2` route — state machine across the 7 screens |
| `src/views/portal-v2/screens/*.jsx` | Login, Loading, Success, ErrorNotFound, NoSession, DeviceLimit, Offline |
| `src/views/portal-v2/Demo.jsx` | `/#portal-v2-kit` — every design system component, light+dark, EN+AR |
| `src/portal/design/tokens.css` | CSS variables — colors, spacing, shadows, motion easing, glass |
| `src/portal/design/motion.css` | Keyframes + utility classes (`p-enter`, `p-shake`, `p-bridge-pulse`, etc.) |
| `src/portal/design.css` | Bundle entry that imports the two above |
| `src/portal/components/*.jsx` | 17 components: Button, Input, Card, StatTile, DeviceTile, Modal, Toast, Spinner, Skeleton, EmptyState, ErrorState, Badge, ConnectionPulse, ProgressRing, SpeedometerCard, WhatsAppFAB, LanguageToggle, ThemeToggle, BrandHeader |
| `src/portal/hooks/usePortalConfig.js` | Loads + subscribes to `app_config` for v2 fields |
| `src/portal/hooks/useBridgeEvents.js` | SSE subscriber with exponential-backoff reconnect |
| `src/portal/hooks/useDeviceFingerprint.js` | Stable browser fingerprint persisted in `localStorage` |
| `src/portal/i18n.js` | v2-only key dictionary, `wrapT(baseT, lang)` falls through to v1's `t()` |
| `src/portal/index.js` | Barrel export — `import { Button, Card, … } from '@/portal'` (relative paths in practice) |
| `src/lib/mikrotikApi.js` | (Modified) — appended `mtkV2*` client helpers consuming `config.bridgeUrlV2/V2` |
| `src/main.jsx` | (Modified) — adds `#wifi-v2`, `#portal-v2-kit` hash routes |
| `src/constants/index.js` | (Modified) — `STORAGE_KEYS.WIFI_DEVICES / WIFI_PROFILES_V2 / WIFI_REALTIME_EVENTS` |
| `src/lib/tableMap.js` | (Modified) — maps the 3 new storage keys |
| `src/views/admin/Settings.jsx` | (Modified) — "شبكة الإنترنت v2 (تجريبي)" admin panel with flag, bridge v2 URL/secret, WhatsApp number |
| `supabase/migrations/20260520000000_wifi_v2_foundations.sql` | Additive migration: `app_config` columns, `wifi_devices`, `wifi_profiles_v2` (seeded), `wifi_realtime_events`, `students.wifi_profile_id`, `staff.wifi_profile_id` |
| `supabase/schema.sql` | (Modified) — mirrors the migration so fresh installs match |

### Routes (v2)

All under `/api/v2`. Every route except `/status` requires `x-bridge-secret: $BRIDGE_SECRET_V2` (or `?token=…` for SSE).

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/v2/status` | Health (public) |
| GET    | `/api/v2/devices` | All active devices |
| GET    | `/api/v2/devices/by-user/:username` | Per-user devices |
| POST   | `/api/v2/device-check` | Read-mostly limit check (used by `/#wifi-v2`) |
| POST   | `/api/v2/devices/:mac/ban` | *501 in Phase 1, wired in Phase 3* |
| DELETE | `/api/v2/devices/:mac/ban` | *501 in Phase 1* |
| GET    | `/api/v2/sessions` | Mirrors `/devices` for naming clarity |
| POST   | `/api/v2/sessions/:username/kick` | Instant kick (all sessions) |
| GET    | `/api/v2/sessions/:username/usage` | Bytes summary |
| GET    | `/api/v2/profiles` | List RouterOS profiles |
| POST   | `/api/v2/profiles` | Upsert profile by name with `{downloadMbps, uploadMbps, maxDevices}` |
| DELETE | `/api/v2/profiles/:name` | Remove profile |
| GET    | `/api/v2/events` | SSE stream |

### SSE events

The active-watcher polls every 5 s and emits:

- `hello` `{ts}`
- `device.connected` `{mac, username, ip, sessionId}`
- `device.disconnected` `{mac, username, sessionId}`
- `device.bandwidth.update` `{mac, username, bytesIn, bytesOut, deltaIn, deltaOut}`
- `session.kicked` `{username, sessions}`

### Schema additions (additive — does NOT touch v1 tables)

```sql
-- app_config:
wifi_v2_enabled         boolean
whatsapp_support_number text
bridge_url_v2           text
bridge_secret_v2        text

-- new tables:
wifi_devices(id, mac, username, ip, device_id, user_agent, hostname,
             first_seen, last_seen, banned, banned_by, banned_reason)
wifi_profiles_v2(id, name UNIQUE, label_ar, label_en, download_mbps,
                 upload_mbps, max_devices, applies_to, locked, description)
   seeded: svs-v2-normal (10/2/2), svs-v2-staff (25/10/4), svs-v2-voucher (5/1/1)
wifi_realtime_events(id, event_type, target, payload, source, created_at)

-- per-user pin:
students.wifi_profile_id  uuid REFERENCES wifi_profiles_v2(id)
staff.wifi_profile_id     uuid REFERENCES wifi_profiles_v2(id)
```

### Deploy procedure (v2 bridge)

```cmd
cd C:\
:: unzip mikrotik-bridge-v2.zip → C:\mikrotik-bridge-v2\
cd C:\mikrotik-bridge-v2
copy .env.example .env
:: fill MIKROTIK_PASS, BRIDGE_SECRET_V2
npm install
pm2 start server.js --name mikrotik-bridge-v2
pm2 save
```

Windows firewall: open inbound TCP `3457`. Use the same `svs-bridge` RouterOS user as v1 — both bridges can connect concurrently (RouterOS API supports multiple sessions per user).

### Verification checklist (Phase 1)

After deploy:

1. `pm2 status` shows BOTH `mikrotik-bridge` (3456) and `mikrotik-bridge-v2` (3457) online.
2. `curl http://10.5.50.240:3456/api/status` → v1 healthy (unchanged).
3. `curl http://10.5.50.240:3457/api/v2/status` → `{ok: true, version: "2.0.0"}`.
4. `pm2 logs mikrotik-bridge --lines 20` still shows `[student-sync] Started (30s interval)`.
5. `http://10.5.50.240:5173/#wifi` renders the LIVE v1 captive portal (unchanged).
6. `http://10.5.50.240:5173/#wifi-v2` renders the new v2 login screen.
7. `http://10.5.50.240:5173/#portal-v2-kit` renders every design-system component.
8. End-to-end: check a test student in, watch `pm2 logs mikrotik-bridge` for `[student-sync] Created hotspot user`. Phone still connects via v1 captive portal. No regression.

### What NOT to do in Phase 1

- ❌ Do not call `mtkV2*` from `Hub.jsx` / `CheckIn.jsx` / `CheckoutModal.jsx` — those still use v1 `mtkEnable/Disable`.
- ❌ Do not flip `app_config.wifi_v2_enabled = true` in production yet — nothing user-facing reads it. The hash routes are explicit.
- ❌ Do not replace `~/Desktop/login.html` — that's Phase 2.
- ❌ Do not migrate `wifi_sessions` / `wifi_full_access` data — that's Phase 4 cutover.
- ❌ Do not delete `mikrotik-bridge/` (v1) — Phase 4 retires it after a 1-2 week observation window.

### Phase 2 additions (customer-facing flow rebuild)

Phase 2 builds the **post-login customer journey** on top of the Phase 1 design system and bridge. v1 captive flow stays live on the router; v2 is reachable via explicit hash routes for review.

**New files:**

| File | Purpose |
|---|---|
| `src/views/portal-v2/Dashboard.jsx` | The live post-login dashboard at `#wifi-status-v2?id=…`. Live SSE-driven speedometer, per-MAC device list, elapsed timer, disconnect-with-confirm flow. Replaces `PortalStatus.jsx` for v2 traffic. |
| `src/views/portal-v2/GuestPortal.jsx` | New `#guest` landing page for non-members. WhatsApp-first messaging + cashier hint. |
| `src/views/portal-v2/screens/DisconnectScreen.jsx` | Two-phase (`working` / `done`) farewell screen invoked from the dashboard's disconnect flow. No hard reload. |
| `src/portal/hooks/useUserBandwidth.js` | EMA smoother that turns `device.bandwidth.update` SSE events into `{downloadMbps, uploadMbps}`. Decays toward 0 if no event in 12s. |
| `src/portal/hooks/useElapsedTimer.js` | 1s tick from a fixed start time → `HH:MM:SS` / `MM:SS` strings. |
| `~/Desktop/login-v2.html` | New self-contained captive portal HTML with v2 design tokens inlined. **NOT yet deployed to the router**; deploy in Phase 4 cutover after observation. |

**Modified files:**

- `src/main.jsx` — new hash routes `#wifi-status-v2` (Dashboard), `#guest` (GuestPortal). Both wrapped in `PortalChromeProvider`.
- `src/views/portal-v2/CaptivePortal.jsx` — `submitToMikroTik` now sets the hidden `dst` field to `/?id=…#wifi-status-v2`. v1 `CaptivePortal.jsx` still uses `#wifi-status` (untouched).
- `src/portal/index.js` — re-exports `useUserBandwidth` and `useElapsedTimer`.
- `src/portal/i18n.js` — appends `v2.status.*`, `v2.disconnect.*`, `v2.guest.*` keys (EN + AR).

**New routes:**

- `http://10.5.50.240:5173/#wifi-status-v2?id=<student-uuid>` — live dashboard (post-login)
- `http://10.5.50.240:5173/#guest` — guest landing page

**Phase 2 verification:**

1. `npm run build` clean (no new errors).
2. `/#wifi-status-v2?id=<real-student>` renders dashboard. EN/AR + light/dark + elapsed timer + member number visible without the bridge.
3. With `pm2 start mikrotik-bridge-v2`: SSE drives `ConnectionPulse` to `live`, `SpeedometerCard` updates, device list reflects connected MACs.
4. Disconnect → modal → DisconnectScreen `working` → after kick, DisconnectScreen `done` → "Sign in again" returns to `#wifi-v2`.
5. `/#guest` renders without any bridge or Supabase calls; WhatsApp CTA opens `wa.me/<number>` if set.
6. `/#wifi-v2` after submit: hidden `dst` field points to `/?id=…#wifi-status-v2` (DevTools network panel).
7. v1 `/#wifi` and `/#wifi-status` **unchanged**.
8. `~/Desktop/login-v2.html` opens in a plain browser; theme/lang toggles work; **router's `flash/hotspot/login.html` is unchanged**.

### What NOT to do in Phase 2

- ❌ Do not deploy `~/Desktop/login-v2.html` to the router. Phase 4 cutover does that.
- ❌ Do not change the v1 `CaptivePortal.jsx` redirect — keep it at `#wifi-status`.
- ❌ Do not delete `src/views/portal/PortalStatus.jsx` — Phase 4 retires it.
- ❌ Do not enable `app_config.wifi_v2_enabled` for production users — the v2 routes are still reached by explicit hash.

### Phase 3 additions (admin & cashier rebuild)

Phase 3 ships the **staff-facing** surface of v2 — a single consolidated admin network console, a device-management tab, employee-codes admin, an audit timeline, and a modernized cashier ops page. All three legacy screens (`NetworkDashboard.jsx`, admin `InternetGate.jsx`, cashier `InternetGate.jsx`) stay live throughout — staff keep using them until Phase 4 retirement.

**New files:**

| File | Purpose |
|---|---|
| `src/views/admin/network-v2/Console.jsx` | Tabbed shell mounted at view key `admin_network_v2`. Provides per-tab routing + shared SSE subscription. |
| `src/views/admin/network-v2/components/TabBar.jsx` | Horizontal scrollable tab bar with active-state underline + optional badges. |
| `src/views/admin/network-v2/tabs/OverviewTab.jsx` | Live status of v1 + v2 bridges, KPI tiles, top users + top devices, router resource snapshot. |
| `src/views/admin/network-v2/tabs/DevicesTab.jsx` | **Marquee NEW capability.** Live per-MAC list with kick + ban actions; cross-references `wifi_devices.banned` for visibility. |
| `src/views/admin/network-v2/tabs/UsersTab.jsx` | Per-user expand-to-devices, kick-all, profile assignment via v1 `mtkSetProfile`. |
| `src/views/admin/network-v2/tabs/ProfilesTab.jsx` | CRUD over `wifi_profiles_v2` + v2 bridge `/api/v2/profiles` sync; locked system profiles cannot be deleted. |
| `src/views/admin/network-v2/tabs/BlockingTab.jsx` | DNS sinkhole categories + custom domains. Re-skin of v1 logic; calls v1 bridge. |
| `src/views/admin/network-v2/tabs/WalledGardenTab.jsx` | Pre-login allow list. Re-skin of v1 logic; calls v1 bridge. |
| `src/views/admin/network-v2/tabs/VouchersTab.jsx` | Single + bulk voucher generation with `window.print()` batch sheet. **First real consumer of `wifi_voucher_batches`.** |
| `src/views/admin/network-v2/tabs/EmployeeCodesTab.jsx` | **NEW capability.** Admin creates fixed-speed WiFi-only credentials for staff via `wifi_full_access` (`personType='staff'`). |
| `src/views/admin/network-v2/tabs/AuditTab.jsx` | Reverse-chronological event timeline. Reads `wifi_events` (Phase 4 will merge `wifi_realtime_events`). |
| `src/views/cashier/network-v2/Ops.jsx` | Mounted at view key `cashier_network_v2`. Search → student card → per-MAC kick + refresh/disconnect. **Calls v2 bridge directly — no `gateway_config` indirection.** |

**Modified files:**

- `mikrotik-bridge-v2/routes/devices.js` — `POST /api/v2/devices/:mac/ban` (kick session matching MAC + emit `device.banned` SSE) and `DELETE /api/v2/devices/:mac/ban` (emit `device.unbanned`).
- `mikrotik-bridge-v2/routes/sessions.js` — `POST /api/v2/sessions/by-id/:sessionId/kick` for per-RouterOS-id kick (distinct from per-username kick).
- `src/lib/mikrotikApi.js` — `mtkV2BanMac`, `mtkV2UnbanMac`, `mtkV2KickByIdV2`, `mtkV2UpsertProfile`, `mtkV2DeleteProfile`.
- `src/App.jsx` — `VIEW_MAP` += `admin_network_v2` + `cashier_network_v2`; imports.
- `src/constants/index.js` — `MENU.admin` (+`admin_network_v2`), `MENU.cashier` + `MENU.employee` (+`cashier_network_v2`); `ROLE_VIEWS` for admin/cashier/employee.
- `src/portal/i18n.js` — ~140 new keys (EN + AR) for `admin.netv2.*` + `cashier.netv2.*`.

**New routes / menu entries:**

- Admin menu → "إدارة الشبكة v2" → `admin_network_v2` view
- Cashier + Employee menu → "بوابة الإنترنت v2" → `cashier_network_v2` view

**New bridge endpoints (`/api/v2`):**

| Method | Path | Purpose |
|---|---|---|
| POST   | `/api/v2/devices/:mac/ban` | Kick any active session matching MAC + emit `device.banned` |
| DELETE | `/api/v2/devices/:mac/ban` | Emit `device.unbanned` (Supabase flag cleared by admin UI) |
| POST   | `/api/v2/sessions/by-id/:sessionId/kick` | Kick exactly one RouterOS session by `.id` |

**SSE events added:**

- `device.banned` `{mac, kicked}`
- `device.unbanned` `{mac}`

**Phase 3 verification:**

1. `npm run build` clean (no new errors).
2. Sidebar (admin login) shows "إدارة الشبكة v2" under "الإعداد". Click → `admin_network_v2` renders with the 9-tab bar.
3. With v2 bridge running, Devices tab populates and updates live; ban a MAC → row disappears + `wifi_devices.banned=true` in Supabase.
4. Profiles tab — edit `svs-v2-normal` Mbps, save → both `wifi_profiles_v2` and RouterOS profile update.
5. Employee Codes tab — create code for "Mahmoud" with `svs-v2-staff` → `wifi_full_access` row inserted, hotspot user appears on the router.
6. Audit tab — events from the last few admin actions appear in reverse-chronological order.
7. Sidebar (cashier login) shows "بوابة الإنترنت v2". Click → `cashier_network_v2`. Search → kick devices → toast confirms.
8. v1 `admin_network` (NetworkDashboard) and `cashier_internet_gate` (cashier InternetGate) still render — no regression.
9. v1 captive flow on the router still works (live cashier check-in path is untouched).

### What NOT to do in Phase 3

- ❌ Do not delete v1 admin `NetworkDashboard.jsx`, admin `InternetGate.jsx`, or cashier `InternetGate.jsx`. Phase 4 retires them.
- ❌ Do not remove `cashier_internet_gate` from `ROLE_VIEWS` / `MENU` — it stays alongside `cashier_network_v2`.
- ❌ Do not start writing to `wifi_realtime_events` from the bridge yet — Phase 4 backend hardening adds the persistence layer.
- ❌ Do not change `Hub.jsx` / `CheckIn.jsx` / `CheckoutModal.jsx` to use `mtkV2*` — they still use v1.
- ❌ Do not deploy `login-v2.html` to the router — still a Phase 4 task.

### Phase 4 additions (captive HTML set + backend hardening + cutover)

Phase 4 ships the **full MikroTik captive HTML set** matching the `/#wifi` design, three backend hardening pieces (hard MAC ban, bandwidth analytics, SSE event persistence), and the **feature-flag cutover plumbing**. The captive HTML files are checked into `~/Desktop/` but **not yet uploaded to the router** — the FTP upload is an admin-driven step documented below.

**New captive HTML files (NOT yet on the router):**

| File | Served by MikroTik at | Notes |
|---|---|---|
| `~/Desktop/login-v2.html`   | First page when device joins WiFi | **REVISED** in Phase 4 — default theme now respects system preference instead of hardcoded `'light'`. Matches PortalChrome behaviour. |
| `~/Desktop/logout-v2.html`  | After POST to `$(link-logout)` | "Disconnected" page with session-time summary + sign-in-again button |
| `~/Desktop/status-v2.html`  | `http://10.5.50.1/status` while authenticated | Non-JS mini dashboard — uses `$(username)`, `$(uptime)`, `$(ip)`, `$(mac-address)`, `$(bytes-in-nice)`, `$(bytes-out-nice)`, `$(session-time-left)`. Disconnect button POSTs to `$(link-logout)` |
| `~/Desktop/alogin-v2.html`  | Briefly after `/login` POST before redirect | Spinner + auto-redirect via meta-refresh + JS. Honors `$(if popup == 'true')` |
| `~/Desktop/error-v2.html`   | When MikroTik can't render `login.html` | Danger card displaying `$(error-orig)` + cashier hint + try-again link |
| `~/Desktop/errors-v2.txt`   | MikroTik internal error string translations | Friendly EN strings for the common error names (invalid-username, no-more-sessions, etc.) |

All six files share the same design tokens (mirrored from `src/portal/design/tokens.css`), the same toolbar pill (EN/AR + theme toggle), the same `localStorage.portal-lang` + `localStorage.portal-theme` keys (so a user who toggled to dark on `/#wifi` sees dark on every captive page), and the same Google Fonts (DM Sans + IBM Plex Sans Arabic — already in the router walled-garden per §3).

**New backend pieces (mikrotik-bridge-v2):**

- `watchers/ban-sync.js` — every 30s, reads `wifi_devices WHERE banned=true` from Supabase and reconciles to `/ip/hotspot/ip-binding type=blocked` with `comment=svs-ban`. **Turns Phase 3's "Ban" button into a hard ban-on-reconnect.** Idempotent.
- `watchers/usage-aggregator.js` — subscribes to the in-memory event bus, accumulates per-(username,date) bandwidth deltas, flushes to `wifi_usage_logs` every 5 min. First production write path for that table.
- `event-bus.js` — `publish()` now also fire-and-forgets an insert to `wifi_realtime_events`. Best-effort, never blocks. The admin Audit tab can union this with `wifi_events` for a complete timeline.
- `server.js` — boots both watchers on startup, stops them on SIGINT/SIGTERM.
- `.env.example` — `BAN_SYNC_MS=30000`, `USAGE_FLUSH_MS=300000`.

**Feature-flag cutover wiring:**

- `src/main.jsx` — `#wifi` and `#wifi-status` are now **ambiguous**: they render v2 when `app_config.wifi_v2_enabled` is true, v1 when false. Reads the flag once on mount and subscribes to Realtime so flips propagate without reload.
- New explicit rollback hashes:
  - `#wifi-legacy`        → always v1 `CaptivePortal`
  - `#wifi-status-legacy` → always v1 `PortalStatus`
- Explicit v2 hashes `#wifi-v2`, `#wifi-status-v2`, `#guest`, `#portal-v2-kit` keep working regardless of the flag.

**v1 legacy badge:** When `wifi_v2_enabled === true`, the Sidebar appends `(قديم)` to the v1 admin/cashier menu labels (`admin_network`, `cashier_internet_gate`). v1 entries stay clickable — useful during the observation period. True removal of v1 admin/cashier WiFi files, the v1 captive `login.html`, and the v1 `mikrotik-bridge/` service is a follow-up cleanup PR.

#### Phase 4 deploy procedure (captive HTML upload)

Admin runs this once the React app has been deployed and tested. Do NOT execute before:

1. Phase 4 React build is live (Vercel + Windows `C:\smartvision-pkg\`).
2. v2 bridge `mikrotik-bridge-v2` is running on the Windows host with the new `BAN_SYNC_MS` + `USAGE_FLUSH_MS` env values.
3. Admin has tested `/#wifi-v2`, `/#wifi-status-v2`, `/#guest` and is happy with the design.

Then on Windows:

```cmd
:: 1. Backup the current login.html (for emergency rollback)
:: Winbox terminal:
/file print where name~"flash/hotspot/login.html"
:: → note the date; this is your rollback point

:: 2. Enable FTP temporarily on the router
/ip service enable ftp

:: 3. FileZilla:
::    Host:     10.5.50.1
::    Username: admin   Password: <admin pw>   Port: 21
::    Connect → flash/hotspot/
::
::    Upload + rename:
::      ~/Desktop/login-v2.html  → flash/hotspot/login.html   (overwrite)
::      ~/Desktop/logout-v2.html → flash/hotspot/logout.html
::      ~/Desktop/status-v2.html → flash/hotspot/status.html
::      ~/Desktop/alogin-v2.html → flash/hotspot/alogin.html
::      ~/Desktop/error-v2.html  → flash/hotspot/error.html
::      ~/Desktop/errors-v2.txt  → flash/hotspot/errors.txt   (overwrite if present)

:: 4. Disable FTP
/ip service disable ftp

:: 5. Verify
/file print where name~"flash/hotspot/"

:: 6. Test from a phone:
::    a. Forget the WiFi → reconnect → captive portal opens → login-v2 design
::    b. After login, visit http://10.5.50.1/status → status-v2 design
::    c. Tap "Disconnect WiFi" on status → logout-v2 design
::    d. Tap "Sign in again" on logout → back to login-v2
```

#### Phase 4 cutover steps (React-side flag flip)

After the captive HTML is deployed and one cashier check-in flow has been smoke-tested:

1. Admin opens Settings → "Network v2" section → toggle "تفعيل النظام v2" on. Save.
2. Within ~2 seconds (Supabase Realtime), every connected React client (the cashier's browser, the admin's browser, etc.) sees:
   - `#wifi` route now renders `CaptivePortalV2`
   - `#wifi-status` now renders `DashboardV2`
   - Sidebar v1 entries show `(قديم)` suffix
3. **Rollback path:** turn the toggle off. v1 returns instantly. No reload needed.
4. **Emergency rollback (flag-independent):**
   - Set router back to v1 captive HTML — FileZilla → restore the backed-up `login.html` (the others can stay; MikroTik defaults handle them).
   - Or hand cashiers the rollback URL: `http://10.5.50.240:5173/#wifi-status-legacy`.

#### Phase 4 verification

1. `pm2 status` shows both bridges online; `pm2 logs mikrotik-bridge-v2 --lines 30` shows:
   - `[bridge-v2] listening on :3457`
   - `[active-watcher] starting (5000ms interval)`
   - `[ban-sync] starting (30000ms interval)`
   - `[usage-aggregator] starting (flush every 300000ms)`
2. With flag OFF: `/#wifi` and `/#wifi-status` render v1 components (no regression).
3. With flag ON: same hashes now render v2 components. Within 2s of the toggle.
4. `/#wifi-legacy` always renders v1 regardless of flag.
5. Ban a MAC via the admin Devices tab → within 30s `pm2 logs mikrotik-bridge-v2` shows `[ban-sync] blocked <MAC>`. Verify in Winbox: `/ip hotspot ip-binding print where comment="svs-ban"` shows the row.
6. Within 5 minutes of any active session: `wifi_usage_logs` has rows with non-zero bytes for that username + today.
7. `wifi_realtime_events` table starts collecting rows for every SSE event the bridge publishes.

### What NOT to do in Phase 4

- ❌ Do not delete `~/Desktop/login.html` — it's the rollback artifact for the router.
- ❌ Do not flip `wifi_v2_enabled` to `true` in production until you have FTP-uploaded all six captive files. Without them, MikroTik still serves the v1 captive page — fine, but visually inconsistent with the React `#wifi-status` route.
- ❌ Do not remove v1 menu entries (`admin_network`, `cashier_internet_gate`) from MENU. The legacy badge marks them; removal is a follow-up PR.
- ❌ Do not stop the v1 `mikrotik-bridge` service. Cashier check-in still calls v1 `mtkEnable`/`mtkDisable` until the cleanup PR rewires Hub/CheckIn/CheckoutModal to v2.
- ❌ Do not change the captive HTML deploy procedure (FTP path, file names) without updating this section.

---

## 15. Phase 4.5 — Console ops polish (bulk actions, kill switch, refresh sessions, device-count editor)

Phase 4.5 takes the admin Network Console from a viewer to a **control room**. Everything additive — no schema or bridge route changes — so it can ship without coordination.

**New capabilities, end-to-end:**

| Capability | Where | What it does |
|---|---|---|
| **Global Kill Switch** | Console header (`Console.jsx`) and Devices + Users tabs | Two-step confirmation, then enumerates `/api/v2/devices` and fans out `mtkV2KickByIdV2` for every row. Logs `kill_switch` to `wifi_events` with `{total, kicked}`. |
| **Refresh session per user** | Users tab, expanded row | One-click `mtkV2KickSession(username)`. Aliased as `mtkV2RefreshUser` for semantic clarity at the call site. Forces re-auth so profile + max-devices changes take effect immediately. |
| **Edit max devices per user** | Users tab → "تعديل عدد الأجهزة" | Modal: optional speed-profile picker + 1–10 device buttons. On save: `mtkSetMaxDevices` (re-fires `/api/enable` so RouterOS `shared-users` updates) AND, if the username matches `students.member_number`, writes `students.wifi_max_devices` + `wifi_speed_profile`. Logs `user_max_devices_changed`. |
| **Bulk actions** | Every tab with a list | Toggle "تحديد متعدد" → checkboxes appear → `<BulkActionBar>` floats above the list. See per-tab table below. |
| **Kill WiFi on student checkout** | `CheckoutModal.jsx` | After the existing `mtkDisable` fire-and-forget, we also fire `mtkV2KickSession(memberNumber)` so any active WiFi sessions drop within seconds instead of waiting for the next student-sync tick. Safe no-op if v2 bridge is offline. |
| **Per-tab error boundary** | `TabErrorBoundary.jsx` | A crash inside one tab no longer blanks the entire console. Shows a recoverable error card with `try again`. |

**Per-tab bulk actions:**

| Tab | Selection scope | Bulk actions |
|---|---|---|
| Devices  | Active sessions  | Kick selected, Ban selected |
| Users    | Hotspot usernames | Kick selected, Refresh selected, Apply profile to selected, Set max-devices on selected |
| Profiles | Unlocked profiles | Delete selected (locked system profiles are not selectable) |
| Blocking | Block categories AND custom domains (separate lists) | Enable/Disable selected categories; Delete selected custom domains |
| Walled garden | Allow-list entries | Delete selected |
| Vouchers | Active voucher rows | Revoke selected |
| Employee codes | All staff rows | Enable / Disable / Delete selected |
| Audit | Filtered event rows | Delete selected, plus a "Export CSV" of the filtered view |

**New helpers in `src/lib/mikrotikApi.js`:**

| Helper | Strategy | Notes |
|---|---|---|
| `mtkV2KickAll(config)` | Enumerate `/api/v2/devices` then `Promise.all` of `mtkV2KickByIdV2` | Returns `{ok, total, kicked}`. Bridge replies to a kick of an already-ended session with `alreadyGone:true` — still counted as ok. |
| `mtkV2RefreshUser(config, username)` | Alias of `mtkV2KickSession` | Semantic: "make the device re-auth so new settings apply." |
| `mtkV2KickUsers(config, usernames[])` | `Promise.all` of `mtkV2KickSession` | Aggregated `{ok, total, ok_users, kicked}` for bulk-action toasts. |
| `mtkV2BanMacs(config, macs[])` | `Promise.all` of `mtkV2BanMac` | Aggregated `{ok, total, banned}`. The Supabase ban rows are upserted by the caller (DevicesTab) in one batch — keep router + DB writes in lockstep. |
| `mtkSetMaxDevices(config, username, max, extra?)` | Re-fires `/api/enable` with new `maxDevices` | Idempotent. `extra` is the rest of the student-shaped fields (`speedProfile`, `dataLimitMb`, `name`) so existing settings are preserved. **Caller is responsible for the `students.wifi_max_devices` update.** |

**New components under `src/views/admin/network-v2/components/`:**

- `TabErrorBoundary.jsx` — class-based error boundary, wraps the active tab body in `Console.jsx`.
- `BulkActionBar.jsx` — floating action toolbar shown above any list when `count > 0`. Tones map to portal `Button` variants. `confirm: true` (or a string) wraps the click in `window.confirm`.
- `useBulkSelection(items, getId)` — headless multi-select state. Auto-prunes ids that vanish from the source list on refresh. Exposes `selectedIds / selectedItems / set / toggle / selectAll / clear / isSelected / count / allSelected`.

**Defensive rendering in `BlockingTab` + `WalledGardenTab`:**

Both tabs now:
- Short-circuit to an `EmptyState` if `config.mikrotikBridgeUrl` is missing (v1 bridge is still required for DNS-sinkhole + walled garden).
- Show an `ErrorState` (with retry CTA) if the bridge URL is set but the fetch fails — previously, the BlockingTab could blank the page when the bridge response shape diverged from expectation.
- Normalize every list with `Array.isArray(...)` before rendering. Per-row keys are now resilient to missing `id`.

**New `wifi_events.eventType` values logged by 4.5:**

`user_refreshed`, `user_max_devices_changed`, `users_bulk_kicked`, `users_bulk_refreshed`, `kill_switch`. The audit tab's TONE map already handles them; older events keep working unchanged.

**Phase 4.5 verification:**

1. `npm run build` clean.
2. Console header pulses live; counter on the "Kill Switch" button matches active devices count.
3. Devices tab: enable "تحديد متعدد" → check 2 rows → "فصل" → both rows vanish, audit logs two `device_kicked {bulk:true}` rows.
4. Users tab: expand a row → "تعديل عدد الأجهزة" → pick `5` → save. RouterOS `/ip hotspot user/profile/print where name=u-<USERNAME>` shows `shared-users=5`. `students.wifi_max_devices` for the matching member_number = 5.
5. Users tab: "تحديث الجلسة" on an active row → device drops within seconds → reconnect succeeds with the new profile.
6. Console "Kill Switch" with 3 active devices → confirm both prompts → all three drop → `wifi_events` shows one `kill_switch` row with `{total:3,kicked:3}`.
7. Blocking tab: kill the v1 bridge process → tab shows the `ErrorState` card with the bridge error and a retry button instead of a white screen.
8. Cashier checkout for an active student with a WiFi session → within ~2s the device drops (no need to wait 30s for student-sync).

### What NOT to do in Phase 4.5

- ❌ Do not collapse `mtkV2RefreshUser` + `mtkV2KickSession` into a single name. The alias documents intent; future "refresh that does NOT kick the current session" semantics may diverge.
- ❌ Do not move `mtkSetMaxDevices` to the v2 bridge. v1 is still authoritative for per-user mutations. Re-fire `/api/enable` — it's idempotent.
- ❌ Do not delete the `useBulkSelection` pruning step. Without it, a stale id stays selected after Realtime refreshes — bulk actions will operate on rows the user no longer sees.

---

## 16. Voucher redemption + Free Sites page (2026-05-20)

This section documents the voucher path end-to-end and the new admin **Free Sites** page. Both live alongside the existing v2 work; nothing in §§14–15 changes.

### 16.1 Voucher redemption — the full chain

```
Admin VouchersTab          Cashier Ops (sell)             Captive portal (redeem)
─────────────────          ──────────────────             ──────────────────────
generates WIFI-XXXXXX  →   sells fresh WIFI-XXXXXX   →    student types XXXXXX
batch (printable)          to a member or walk-in,        on /#wifi-v2 or /#wifi
                           creates an invoice, takes      → form POST to MikroTik
                           cash/transfer/instapay          link-login-only with
                                                          username = password = WIFI-XXXXXX
                                                          → online for <duration> minutes
                                                          → session-worker on bridge
                                                            auto-disables the user when
                                                            limit-uptime is reached AND
                                                            sets wifi_sessions.status='expired'
```

### 16.2 Three creation paths — same shape

Every voucher creation path inserts a `wifi_sessions` row with `is_voucher=true` and calls `mtkCreateSession` on the v1 bridge with `limit-uptime=<duration>m`. The differences are:

| Path | UI | Tied to student | Invoice created |
|---|---|---|---|
| Admin VouchersTab     | `src/views/admin/network-v2/tabs/VouchersTab.jsx` (admin_network_v2) | No | No — it's stock generation |
| Cashier sale          | `SellVoucherCard` in `src/views/cashier/network-v2/Ops.jsx` (cashier_network_v2) | Optional (auto-links when a student is selected in search) | YES — `billingType: 'wifi_voucher'`, with `cashierId`, `shiftId` |
| Captive portal       | (not a creation path — voucher must already exist)                  | n/a | n/a |

`expires_at` is **left NULL at creation**. It's populated on the captive portal at the moment of first redemption (`PortalVoucher.jsx` for v1 and `VoucherScreen.jsx` for v2) as `now() + duration_minutes`. This matches when MikroTik actually starts counting `limit-uptime`. Admin views see a true countdown only after the voucher has been used at least once — before that, the row says "active, not yet redeemed."

### 16.3 Captive portal redemption (v1 + v2 in lockstep)

**Both** the v1 `PortalVoucher.jsx` and the new v2 `VoucherScreen.jsx`:

1. Read the entered 6-char code, build `username = 'WIFI-' + code.toUpperCase()`.
2. Query `wifi_sessions` for `username` + `is_voucher = true`, taking the latest row.
3. If found AND `status === 'active'`:
   - If `expires_at` is NULL → patch the row with `expires_at = now() + duration_minutes * 60_000` and `started_at = now()`. Fire-and-forget — no await.
   - Build a hidden HTML form with `action = link-login-only` (from `window.location.search`), fields:
     - `username = found.username`
     - `password = found.password || found.username`
     - `dst = link-orig || 'http://10.5.50.240:5173/'`
     - `popup = 'true'`
   - `f.submit()` — MikroTik authenticates the device and the captive flow completes.
4. If not found, or `status` is `'expired' | 'terminated'`, or query failed → shake + error screen.

**v2 routing into the voucher screen:**

- `LoginScreen.jsx` has a secondary "Redeem a voucher" CTA below the member input that calls `onVoucher()` → switches the parent's `mode` to `'voucher'`.
- `CaptivePortalV2` reads `?voucher=1` on mount and sets `mode='voucher'` if present. This is what `login.html` / `login-v2.html` link to via `goToVoucher()` (`window.location.href = PORTAL_BASE + "/#wifi-v2?voucher=1"`).

`submitToMikroTik(username, password, dst)` was refactored from the previous member-only `(memberNumber, studentId)` signature so both paths share the same hidden-form POST.

### 16.4 Auto-expiry — two-sided

| Side | What does it | When |
|---|---|---|
| Router | `session-worker.js` kicks all active sessions for any `WIFI-*` hotspot user whose `uptime` ≥ `limit-uptime`, then `disabled=yes` | Every 60s |
| Supabase | `session-worker.js` PATCHes `wifi_sessions?username=eq.<u>&is_voucher=eq.true&status=eq.active` with `{status: 'expired'}` immediately after the disable | Same 60s tick, fire-and-forget |

The bridge talks to Supabase via the same anon key it already uses for `student-sync.js`. RLS is disabled, so the PATCH always works when the bridge is running.

**Failure modes:**
- Bridge is offline → vouchers keep working on MikroTik (they were already created with `limit-uptime`), but Supabase rows stay `'active'` forever. Run `pm2 restart mikrotik-bridge` to resume.
- Supabase is unreachable → router still kicks correctly; admin Vouchers tab will show stale "active" badges. The next successful tick reconciles.

### 16.5 Cashier sale — invoice + drawer accounting

The `SellVoucherCard` inserts an `invoices` row with `billingType: 'wifi_voucher'`. This is intentionally **separate** from `'normal'` (session checkout) and `'subscription'` (plan purchase) so reports can split WiFi voucher revenue if needed. **All current revenue aggregators (Dashboard, DailyRevenue, Reports, FinancialLedger) treat any `paymentMethod !== 'admin'` invoice as revenue**, so vouchers automatically count toward cash/transfer/instapay totals via the standard `i.total` sum.

If a future report needs to break out voucher revenue specifically, filter `i.billingType === 'wifi_voucher'`.

`shiftId` is set from the active shift for the selling cashier (single SELECT against `shifts` at the moment of sale). If the cashier has no active shift, `shiftId = null` and the invoice doesn't roll up into any shift — same behavior as other off-shift cashier writes.

### 16.6 Free Sites page (`admin_free_sites`)

New admin view at `src/views/admin/FreeSites.jsx`, accessible via sidebar entry **"المواقع المجانية"** under "الإعداد".

**What it is:** the customer-facing-ish "what's accessible without WiFi auth" view. Bundles of domains live in Supabase `wifi_walled_garden` (pre-seeded with WhatsApp, Telegram, DNS). Each bundle has a one-tap toggle that pushes every domain in the bundle to RouterOS via `mtkAddWalledGarden` (with `comment = "svs-bundle:<id> <name>"`) and removes them via `mtkRemoveWalledGarden` on disable. The enabled/disabled state is computed by intersecting `bundle.domains` with the live `/api/walled-garden` response.

**Why it's separate from the v2 network console's WalledGardenTab:**
- WalledGardenTab is a **raw flat list** of RouterOS rows — for advanced single-domain CRUD.
- Free Sites is a **named bundle** view — for the "give WhatsApp users free access" type of question. Both can coexist; they read the same RouterOS state.

**Infrastructure hosts** (the 4 mandatory pre-auth hosts in §3) are surfaced read-only at the bottom of the page with a `موجود / مفقود` badge so admins can see at a glance whether the router has them.

**Bundle delete safety:** deleting a bundle from the Free Sites page first removes its router rows (matched by `comment` prefix `svs-bundle:<id>`), then deletes the Supabase row. If the router-remove fails, the Supabase delete still proceeds — the next visit re-fetches router state and surfaces any orphaned rows in the "Add a single site" section.

### 16.7 File index additions

| File | Purpose |
|---|---|
| `src/views/portal-v2/screens/VoucherScreen.jsx` | New — v2 voucher input + auto-submit |
| `src/views/portal-v2/screens/LoginScreen.jsx` (modified) | New secondary "Redeem a voucher" CTA |
| `src/views/portal-v2/CaptivePortal.jsx` (modified) | New `mode` state, `?voucher=1` detection, refactored `submitToMikroTik(username, password, dst)` |
| `src/views/portal/PortalVoucher.jsx` (modified) | Auto-submits to MikroTik (was: copy-paste only). Populates `expires_at` |
| `src/views/cashier/network-v2/Ops.jsx` (modified) | New `SellVoucherCard` — full sale flow with bridge + Supabase + invoice |
| `src/views/admin/FreeSites.jsx` | New — `admin_free_sites` view |
| `src/App.jsx` (modified) | Imports + `VIEW_MAP` += `admin_free_sites` |
| `src/constants/index.js` (modified) | Admin sidebar entry "المواقع المجانية"; `ROLE_VIEWS.admin` += `admin_free_sites` |
| `src/portal/i18n.js` (modified) | `v2.voucher.*` + `cashier.netv2.sell.*` keys (EN + AR) |
| `mikrotik-bridge/session-worker.js` (modified) | Now also patches Supabase `wifi_sessions.status='expired'` on kick. Reads `SUPABASE_URL` + `SUPABASE_KEY` from the same `.env` `student-sync.js` uses. |

### 16.8 Verification checklist (16.x — voucher flow)

1. `npm run build` clean.
2. Admin Settings: `wifi_session_tiers` has ≥1 active row. (Create one via Settings if missing.)
3. **Admin generation:** `admin_network_v2` → Vouchers tab → pick tier, qty=1, Generate. Confirm:
   - A new `wifi_sessions` row with `is_voucher=true`, `status='active'`.
   - In Winbox: `/ip hotspot user print where name~"WIFI-"` shows the user with `limit-uptime=<duration>m`.
4. **Cashier sale:** `cashier_network_v2` → search a member → "Sell WiFi voucher" → pick tier + cash → Sell. Confirm:
   - Same Supabase row pattern, but `studentId / studentName / soldBy / soldByName / shiftId / paymentMethod = 'cash' / invoiceId` populated.
   - A new `invoices` row exists with `billingType='wifi_voucher'`, `total = tier.price`, `paymentMethod='cash'`.
   - Today's `admin_daily` (Daily Revenue) reflects the new revenue.
5. **Captive portal:** open `http://10.5.50.240:5173/#wifi-v2` → tap "Redeem a voucher" → enter the 6 chars from the code → success screen, then the hidden form auto-POSTs to MikroTik. On a phone connected to the SSID, the captive portal closes and the internet is online.
6. **First-use timestamp:** check `wifi_sessions` for the redeemed row — `expires_at` is now non-null and ≈ `now() + duration_minutes`.
7. **Auto-kill:** wait for the voucher's duration to elapse (or set duration=1 minute for testing). Within ~60s of expiry: phone loses internet, Winbox `/ip hotspot active print` shows no row for `WIFI-XXXXXX`, hotspot user has `disabled=yes`, AND the Supabase row's `status='expired'`.
8. **Free Sites:** `admin_free_sites` → toggle "واتساب" → bridge logs an add for every WhatsApp domain. Winbox `/ip hotspot walled-garden print where comment~"svs-bundle:wg-whatsapp"` shows 3 rows. Toggle off → all 3 rows removed.

### What NOT to do in §16

- ❌ Do not pre-populate `expires_at` at voucher creation time. It must be NULL until first redemption — otherwise the admin Vouchers tab can't distinguish "sold but unused" from "actively in use".
- ❌ Do not insert the cashier sale `invoices` row with `billingType: 'normal'`. The `'wifi_voucher'` value is what isolates the row from session-checkout reports.
- ❌ Do not invoke the v2 bridge to create vouchers — `mtkCreateSession` is v1-only. The v2 bridge intentionally doesn't expose session creation; v1's bridge is still the authority for per-user mutations.
- ❌ Do not deploy the Free Sites page changes to the router walled-garden manually via Winbox while the page is open. The 30s page-reload reconciliation will catch the drift, but a concurrent admin edit + Winbox edit can race. Use one or the other.
- ❌ Do not skip the `session-worker.js` Supabase patch. Without it, expired vouchers stay `'active'` in Supabase and the admin Vouchers tab shows zombie rows. The PATCH is fire-and-forget — if Supabase is unreachable, it logs and moves on; the router-side kick is the source of truth.
- ❌ Do not write `students.wifi_max_devices` inside `mtkSetMaxDevices`. Keep the router write and the Supabase write in the caller so a Supabase failure can't roll back a successful router write or vice-versa (see also the wallet/debt invariant — same pattern).

---

## 17. Phase 5 — Network console redesign + tier/profile/usage UX (2026-05-20)

Phase 5 replaces the 9-tab `admin_network_v2` console with a sectioned dashboard, adds inline tier CRUD + advanced profile fields, introduces the first reader of `wifi_usage_logs`, populates the adult blocklist, soft-blocks WhatsApp media in the free bundle, and exposes Winbox-equivalent router controls in-app.

### 17.1 New section layout

`src/views/admin/network-v2/Console.jsx` rewritten as a section host:

```
Hero (sticky) — pulse + Kill Switch
├─ 1. نشاط مباشر         (LiveOpsSection)   — KPIs + devices/users with NAMES
├─ 2. استهلاك الإنترنت    (UsageSection)     — per-user bandwidth + date filter + CSV
├─ 3. الكتالوج            (CatalogSection)   — Packages CRUD + Profiles CRUD
├─ 4. صلاحيات الوصول      (AccessSection)    — Walled garden + Blocking categories
├─ 5. إدارة الراوتر        (RouterSection)    — Cookies, restart, lifetime, raw views
├─ 6. سجل النشاط          (AuditSection)
└─ 7. أكواد الموظفين       (EmployeesSection)
```

Each section wraps in `<SectionCard>` — `localStorage`-persisted collapse state per section. Heaviest sections (Live Ops, Usage) default open; rest default closed.

**Shared data plumbing**: Console loads students ONCE (focused `id,name,phone,member_number` SELECT, capped 20k, Realtime-subscribed) and builds a `Map<member_number, student>` (`studentByCode`). Every section that displays a username joins through this map to show the student's name. Single source of truth for the human-readable identity.

### 17.2 File index — Phase 5 additions

| File | Purpose |
|---|---|
| `src/views/admin/network-v2/Console.jsx` (rewritten) | Section host + shared data |
| `src/views/admin/network-v2/sections/SectionCard.jsx` | Collapsible wrapper |
| `src/views/admin/network-v2/sections/LiveOpsSection.jsx` | KPIs + Devices/Users with names |
| `src/views/admin/network-v2/sections/UsageSection.jsx` | First reader of `wifi_usage_logs` |
| `src/views/admin/network-v2/sections/CatalogSection.jsx` | Packages CRUD + Profiles CRUD with advanced opts |
| `src/views/admin/network-v2/sections/AccessSection.jsx` | Folds WalledGardenTab + BlockingTab |
| `src/views/admin/network-v2/sections/RouterSection.jsx` | Winbox-parity (cookies, restart, lifetime) |
| `src/views/admin/network-v2/sections/AuditSection.jsx` | Wraps existing AuditTab |
| `src/views/admin/network-v2/sections/EmployeesSection.jsx` | Wraps existing EmployeeCodesTab |
| `src/views/admin/network-v2/components/DateRangeFilter.jsx` | Shared period radio + custom range |
| `supabase/migrations/20260521000000_phase5_network_console.sql` | Migration (see §17.3) |
| `mikrotik-bridge/server.js` (modified) | 3 new endpoints (see §17.4) |
| `mikrotik-bridge-v2/routes/profiles.js` (modified) | Accepts advanced RouterOS fields |
| `src/lib/mikrotikApi.js` (modified) | New: `mtkClearAllCookies`, `mtkRestartHotspot`, `mtkSetCookieLifetime` |

### 17.3 Schema changes (migration `20260521000000`)

Additive only — no destructive drops.

**`wifi_profiles_v2` new columns** (all nullable):
- `mac_cookie_timeout text` — RouterOS duration (`3d`, `0s`, ...)
- `idle_timeout text` — kick after this much idle
- `keepalive_timeout text`
- `session_timeout text` — hard session cap
- `transparent_proxy boolean DEFAULT false`
- `status_autorefresh text`

`schema.sql` mirrors the new columns inline.

**WhatsApp soft block** — UPDATE on seeded `wg-whatsapp` row. Domains narrowed from `["web.whatsapp.com","*.whatsapp.net","*.whatsapp.com"]` to text/signal endpoints only: `web.whatsapp.com, c./d./e./g./s./mmx.whatsapp.net`. Active sessions still get full WhatsApp via their internet — only pre-auth users on the free bundle are restricted to text/voice.

**Adult blocklist seed** — UPDATE on seeded `cat-adult` row. Populated with ~55 most-trafficked adult domains. Admin enables the category from the Access section to push every domain into `/ip/dns/static` with `address=0.0.0.0` (DNS sinkhole). Admin can extend via custom blocks.

### 17.4 New bridge endpoints

All on **v1 bridge** (`mikrotik-bridge/server.js` port 3456 — single authority for per-user mutations and router lifecycle):

| Path | Method | RouterOS commands |
|---|---|---|
| `/api/cookies/clear` | POST | `/ip/hotspot/cookie/print` → loop `remove` each. Returns `{removed}`. |
| `/api/hotspot/restart` | POST | `/ip/hotspot/disable [find]` → 1.5s wait → `/ip/hotspot/enable [find]`. Returns `{instances}`. |
| `/api/hotspot/profile/cookie-lifetime` | POST | `{profileName, value}` → `/ip/hotspot/profile/set [find name=<x>] http-cookie-lifetime=<value>`. |

**v2 bridge** `POST /api/v2/profiles` extended to accept (all optional): `macCookieTimeout`, `idleTimeout`, `keepaliveTimeout`, `sessionTimeout`, `statusAutorefresh`, `transparentProxy`. Each maps to RouterOS `/ip/hotspot/user/profile/set` flags. Omitted fields don't overwrite existing values.

### 17.5 Per-user bandwidth UX

`UsageSection` is the first reader of `wifi_usage_logs`. Data is written by `mikrotik-bridge-v2/watchers/usage-aggregator.js` every 5 min (one row per `(username, date)`).

- Date filter: all / today / this week / this month / custom (range)
- Per-username aggregation across the filtered rows: `bytes_in`, `bytes_out`, total, days
- Sort by total / down / up / days
- Student name resolved via `studentByCode` — usernames starting with `WIFI-` show as "قسيمة"
- CSV export reflects the filtered + sorted view

### 17.6 Console UX rules

- Each `SectionCard` persists open/closed in `localStorage` under `netv2-section-<id>`. Default-open: `live` + `usage`. Rest closed.
- The hero is sticky — Kill Switch always visible regardless of scroll position.
- Sections must be wrapped in `<TabErrorBoundary>` (the file is still named that — we deferred the rename to a follow-up PR). A crash in one section doesn't blank the whole console.
- Profile save is **two-stage**: bridge first (pushes to RouterOS), then Supabase (persistent record). If the bridge call fails, the Supabase write still proceeds so the admin can retry the bridge later — better to have a Supabase row out-of-sync with RouterOS for a few minutes than to lose the admin's input.

### 17.7 Verification

1. `npm run build` clean (no new warnings beyond pre-existing Payroll title + chunk size).
2. Console renders 7 sections; Live Ops + Usage expanded by default.
3. Active users/devices show student names from `studentByCode`.
4. Date filter switches in Usage section re-aggregate the table.
5. Tier add/edit/delete works from Catalog → Packages.
6. Profile advanced options modal — set `idle-timeout=15m` on `svs-v2-normal`, save → Winbox confirms via `/ip/hotspot/user/profile/print where name=svs-v2-normal`.
7. Router section → "Clear all cookies" → confirms two prompts → returns `{removed: N}`. Reconnecting test phone forces re-auth.
8. Router section → "Cookie lifetime" → set `10m` → Winbox `/ip/hotspot/profile/print where name=hsprof1` shows `http-cookie-lifetime=10m`.
9. Apply migration, then enable Access section → Adult category → `/ip/dns/static print where comment~"svs-block-adult"` shows ~55 rows.
10. Apply migration → Free Sites page reflects narrower WhatsApp bundle (no media wildcards).
11. v1 cashier check-in (`Hub.jsx`) unchanged — still calls `mtkEnable`.
12. v2 bridge profile upsert continues to accept the basic 4-field body unchanged (backwards-compat).

### What NOT to do in §17

- ❌ Do not enable `transparent-proxy` on RouterOS without first deploying an actual proxy server — the field exists for completeness but flipping it to `yes` without a proxy breaks all client traffic.
- ❌ Do not set `http-cookie-lifetime=0s` if you want any "remember me" behavior — `0s` disables cookie auth entirely; every reconnect requires the code. Use `10m`–`1h` for normal ops.
- ❌ Do not delete the old `tabs/*.jsx` files yet. `AccessSection`, `AuditSection`, `EmployeesSection` all still import them. A follow-up cleanup PR will inline or retire.
- ❌ Do not skip the bridge-first-then-Supabase order in Profile save. If you reverse it and the bridge then fails, you have a Supabase row that doesn't match RouterOS — admin can't tell which is authoritative.
- ❌ Do not display `wifi_profiles_v2.locked` rows as deletable. The 3 seeded profiles (`svs-v2-normal/staff/voucher`) are referenced by `students.wifi_profile_id` + `staff.wifi_profile_id` foreign keys; deleting them breaks live student records.
