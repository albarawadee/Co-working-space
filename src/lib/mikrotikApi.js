/**
 * MikroTik bridge API wrapper.
 * All functions are fire-and-forget safe — they never throw.
 * Username scheme: student.memberNumber (user-facing number), password = same.
 */

import { supabase } from './supabaseClient';
import { toSnake } from './fieldMaps';
import { generateId } from '../utils';

function bridgeUrl(config) {
  return (config?.mikrotikBridgeUrl || '').replace(/\/$/, '');
}

function headers(config) {
  const h = { 'Content-Type': 'application/json' };
  if (config?.mikrotikBridgeSecret) h['x-bridge-secret'] = config.mikrotikBridgeSecret;
  return h;
}

async function post(config, path, body) {
  const base = bridgeUrl(config);
  if (!base) return { ok: false, error: 'bridge not configured' };
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(config, path) {
  const base = bridgeUrl(config);
  if (!base) return { ok: false, error: 'bridge not configured' };
  const res = await fetch(`${base}${path}`, { headers: headers(config) });
  return res.json();
}

async function del(config, path) {
  const base = bridgeUrl(config);
  if (!base) return { ok: false, error: 'bridge not configured' };
  const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: headers(config) });
  return res.json();
}

async function put(config, path, body) {
  const base = bridgeUrl(config);
  if (!base) return { ok: false, error: 'bridge not configured' };
  const res = await fetch(`${base}${path}`, {
    method: 'PUT',
    headers: headers(config),
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Existing ────────────────────────────────────────────────

function pickHotspotUsername(student) {
  // Strict mode: only member_number. If it's empty, the cashier must set
  // it before check-in — we will not fall back to LIB-XXXXX.
  return String(student?.memberNumber || '').trim();
}

export async function mtkEnable(config, student) {
  try {
    const username = pickHotspotUsername(student);
    if (!username) return { ok: false, error: 'no_member_number' };
    return await post(config, '/api/enable', {
      username,
      speedProfile: student.wifiSpeedProfile || 'svs-normal',
      maxDevices:   student.wifiMaxDevices ?? 2,
      dataLimitMb:  student.wifiDataLimitMb ?? 0,
      comment:      student.name || '',
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkDisable(config, student) {
  try {
    const username = pickHotspotUsername(student);
    if (!username) return { ok: false, error: 'no_member_number' };
    return await post(config, '/api/disable', { username });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkGetActive(config) {
  try {
    return await get(config, '/api/active');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkKickSession(config, sessionId) {
  try {
    return await post(config, '/api/kick', { sessionId });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkKickUser(config, username) {
  try {
    return await post(config, '/api/kick-user', { username });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkGetStatus(config) {
  try {
    const base = bridgeUrl(config);
    if (!base) return { ok: false, error: 'bridge not configured' };
    const res = await fetch(`${base}/api/status`);
    return res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkSetupProfiles(config) {
  try {
    return await post(config, '/api/profiles/setup', {});
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── User Detail & Control ───────────────────────────────────

export async function mtkGetUser(config, username) {
  try {
    return await get(config, `/api/user/${encodeURIComponent(username)}`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkSetBandwidth(config, username, download, upload) {
  try {
    return await post(config, `/api/user/${encodeURIComponent(username)}/bandwidth`, { download, upload });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkSetProfile(config, username, profile) {
  try {
    return await post(config, `/api/user/${encodeURIComponent(username)}/profile`, { profile });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Profiles CRUD ───────────────────────────────────────────

export async function mtkGetProfiles(config) {
  try {
    return await get(config, '/api/profiles');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkCreateProfile(config, data) {
  try {
    return await post(config, '/api/profiles', data);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkUpdateProfile(config, name, data) {
  try {
    return await put(config, `/api/profiles/${encodeURIComponent(name)}`, data);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkDeleteProfile(config, name) {
  try {
    return await del(config, `/api/profiles/${encodeURIComponent(name)}`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Walled Garden ───────────────────────────────────────────

export async function mtkGetWalledGarden(config) {
  try {
    return await get(config, '/api/walled-garden');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkAddWalledGarden(config, data) {
  try {
    return await post(config, '/api/walled-garden', data);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkRemoveWalledGarden(config, id) {
  try {
    return await del(config, `/api/walled-garden/${encodeURIComponent(id)}`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Website Blocking ────────────────────────────────────────

export async function mtkGetBlockedSites(config) {
  try {
    return await get(config, '/api/blocked-sites');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkGetBlockCategories(config) {
  try {
    return await get(config, '/api/blocked-sites/categories');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkToggleBlockCategory(config, name, enabled) {
  try {
    return await post(config, '/api/blocked-sites/category', { name, enabled });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkAddCustomBlock(config, domain, comment) {
  try {
    return await post(config, '/api/blocked-sites/custom', { domain, comment });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkRemoveCustomBlock(config, id) {
  try {
    return await del(config, `/api/blocked-sites/custom/${encodeURIComponent(id)}`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── WiFi Sessions ───────────────────────────────────────────

export async function mtkCreateSession(config, data) {
  try {
    return await post(config, '/api/session/create', data);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkGetSessionRemaining(config, username) {
  try {
    return await get(config, `/api/session/${encodeURIComponent(username)}/remaining`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkExtendSession(config, username, minutes) {
  try {
    return await post(config, `/api/session/${encodeURIComponent(username)}/extend`, { minutes });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkTerminateSession(config, username) {
  try {
    return await del(config, `/api/session/${encodeURIComponent(username)}`);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Router controls (Phase 5 — Winbox parity) ───────────────

/**
 * Wipe every hotspot remember-me cookie. After this, devices that
 * previously auto-reauth via cookie must type their member code again.
 * Returns `{ ok, removed }`.
 */
export async function mtkClearAllCookies(config) {
  try { return await post(config, '/api/cookies/clear', {}); }
  catch (err) { return { ok: false, error: err.message }; }
}

/**
 * Graceful hotspot restart — disable + re-enable. Kicks all active
 * sessions; ~2s of unavailability. Useful when state gets weird.
 */
export async function mtkRestartHotspot(config) {
  try { return await post(config, '/api/hotspot/restart', {}); }
  catch (err) { return { ok: false, error: err.message }; }
}

/**
 * Set the hotspot profile's HTTP cookie lifetime. RouterOS duration
 * syntax: "10m", "3d", "0s" (= disable cookie auth), "none".
 * profileName defaults to the only profile we deploy: `hsprof1`.
 */
export async function mtkSetCookieLifetime(config, value, profileName) {
  try {
    return await post(config, '/api/hotspot/profile/cookie-lifetime', {
      value,
      profileName: profileName || 'hsprof1',
    });
  } catch (err) { return { ok: false, error: err.message }; }
}

// ─── Stats ───────────────────────────────────────────────────

export async function mtkGetStats(config) {
  try {
    return await get(config, '/api/stats');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Event Logging (fire-and-forget) ─────────────────────────

export function logWifiEvent(eventType, target, details, staffId, staffName) {
  const row = toSnake({
    id: generateId(),
    eventType,
    target,
    details,
    staffId,
    staffName,
    createdAt: new Date().toISOString(),
  });
  supabase.from('wifi_events').upsert(row).then(() => {});
}

// ─── v2 bridge client (Phase 1 parallel system) ───────────────
// Reads `config.bridgeUrlV2` + `config.bridgeSecretV2` from
// `app_config`. See WIFI-SYSTEM.md §14.

function bridgeUrlV2(config) {
  return (config?.bridgeUrlV2 || '').replace(/\/$/, '');
}

function headersV2(config) {
  const h = { 'Content-Type': 'application/json' };
  if (config?.bridgeSecretV2) h['x-bridge-secret'] = config.bridgeSecretV2;
  return h;
}

async function getV2(config, path) {
  const base = bridgeUrlV2(config);
  if (!base) return { ok: false, error: 'bridge_v2_not_configured' };
  try {
    const res = await fetch(`${base}${path}`, { headers: headersV2(config) });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function postV2(config, path, body) {
  const base = bridgeUrlV2(config);
  if (!base) return { ok: false, error: 'bridge_v2_not_configured' };
  try {
    const res = await fetch(`${base}${path}`, {
      method:  'POST',
      headers: headersV2(config),
      body:    JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkV2GetStatus(config) {
  // /status is public — skip the secret to keep failures simple
  const base = bridgeUrlV2(config);
  if (!base) return { ok: false, error: 'bridge_v2_not_configured' };
  try {
    const res = await fetch(`${base}/api/v2/status`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function mtkV2GetDevices(config) {
  return getV2(config, '/api/v2/devices');
}

export async function mtkV2GetDevicesByUser(config, username) {
  return getV2(config, `/api/v2/devices/by-user/${encodeURIComponent(username)}`);
}

export async function mtkV2DeviceCheck(config, username, deviceId) {
  return postV2(config, '/api/v2/device-check', { username, deviceId });
}

export async function mtkV2KickSession(config, username) {
  return postV2(config, `/api/v2/sessions/${encodeURIComponent(username)}/kick`, {});
}

export async function mtkV2GetUsage(config, username) {
  return getV2(config, `/api/v2/sessions/${encodeURIComponent(username)}/usage`);
}

export async function mtkV2GetProfiles(config) {
  return getV2(config, '/api/v2/profiles');
}

// Upsert a v2 profile by name.
// Required: { name, downloadMbps, uploadMbps, maxDevices }
// Optional (Phase 5 — advanced RouterOS fields, omit to leave unchanged):
//   macCookieTimeout, idleTimeout, keepaliveTimeout, sessionTimeout,
//   statusAutorefresh, transparentProxy
export async function mtkV2UpsertProfile(config, body) {
  return postV2(config, '/api/v2/profiles', body);
}

// Delete a v2 RouterOS profile by name.
export async function mtkV2DeleteProfile(config, name) {
  const base = bridgeUrlV2(config);
  if (!base) return { ok: false, error: 'bridge_v2_not_configured' };
  try {
    const res = await fetch(`${base}/api/v2/profiles/${encodeURIComponent(name)}`, {
      method:  'DELETE',
      headers: headersV2(config),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Ban a MAC: bridge kicks the active session, admin UI persists the
// flag in `wifi_devices.banned`. Phase 4 adds firewall-level
// enforcement so the device can't reconnect.
export async function mtkV2BanMac(config, mac) {
  return postV2(config, `/api/v2/devices/${encodeURIComponent(mac)}/ban`, {});
}

// Clear the bridge-side "I just kicked you" SSE event. Admin UI clears
// the Supabase flag separately.
export async function mtkV2UnbanMac(config, mac) {
  const base = bridgeUrlV2(config);
  if (!base) return { ok: false, error: 'bridge_v2_not_configured' };
  try {
    const res = await fetch(`${base}/api/v2/devices/${encodeURIComponent(mac)}/ban`, {
      method:  'DELETE',
      headers: headersV2(config),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Kick exactly one RouterOS session by `.id` (e.g. "*7B"). Distinct
// from `mtkV2KickSession(config, username)` which kicks ALL of a
// user's sessions.
export async function mtkV2KickByIdV2(config, sessionId) {
  return postV2(config, `/api/v2/sessions/by-id/${encodeURIComponent(sessionId)}/kick`, {});
}

// ─── Bulk + utility helpers ───────────────────────────────────
//
// The v2 bridge intentionally exposes only granular endpoints (kick by
// session-id, kick by username). Multi-target operations are composed
// client-side so the bridge stays simple and stateless.

/**
 * Kick every active session on the router. Returns `{ ok, total, kicked }`.
 *
 * Strategy: enumerate `/api/v2/devices`, fire `mtkV2KickByIdV2` for every
 * row in parallel. Rows that already vanished by the time the kick lands
 * are reported by the bridge as `alreadyGone: true` and still count as
 * "ok" (the desired end-state matches).
 */
export async function mtkV2KickAll(config) {
  const list = await mtkV2GetDevices(config);
  if (!list?.ok) return { ok: false, error: list?.error || 'devices_unreachable' };
  const devices = Array.isArray(list.devices) ? list.devices : [];
  if (devices.length === 0) return { ok: true, total: 0, kicked: 0 };
  const results = await Promise.all(
    devices.map(d => mtkV2KickByIdV2(config, d.id).catch(err => ({ ok: false, error: err?.message })))
  );
  const kicked = results.filter(r => r?.ok).length;
  return { ok: true, total: devices.length, kicked };
}

/**
 * "Refresh" a user — kick every session for that username so the next
 * connection re-authenticates through the captive portal. Any RouterOS
 * profile / max-devices change made beforehand will then take effect.
 *
 * Alias for `mtkV2KickSession` with semantic intent at the call site.
 */
export async function mtkV2RefreshUser(config, username) {
  return mtkV2KickSession(config, username);
}

/**
 * Bulk kick a list of users in parallel. Returns aggregate counts.
 */
export async function mtkV2KickUsers(config, usernames = []) {
  const list = (usernames || []).filter(Boolean);
  if (list.length === 0) return { ok: true, total: 0, kicked: 0 };
  const results = await Promise.all(
    list.map(u => mtkV2KickSession(config, u).catch(err => ({ ok: false, error: err?.message })))
  );
  const kicked = results.reduce((sum, r) => sum + (r?.kicked || 0), 0);
  const okCount = results.filter(r => r?.ok).length;
  return { ok: true, total: list.length, ok_users: okCount, kicked };
}

/**
 * Bulk ban MACs.
 */
export async function mtkV2BanMacs(config, macs = []) {
  const list = (macs || []).filter(Boolean);
  if (list.length === 0) return { ok: true, total: 0, banned: 0 };
  const results = await Promise.all(
    list.map(m => mtkV2BanMac(config, m).catch(err => ({ ok: false, error: err?.message })))
  );
  const banned = results.filter(r => r?.ok).length;
  return { ok: true, total: list.length, banned };
}

/**
 * Push max-devices to RouterOS for a hotspot user via the v1 bridge
 * (which is still authoritative for per-user mutations). We re-fire
 * `/api/enable` which is idempotent and updates `shared-users` on the
 * per-user profile in addition to the user row.
 *
 * Persistence to `students.wifi_max_devices` is the caller's
 * responsibility — keep the bridge call separate so a Supabase failure
 * doesn't roll back a successful router write or vice-versa.
 *
 * `extra` is the rest of the student-shaped fields the bridge expects
 * (speedProfile, name, dataLimitMb). Pass them to preserve existing
 * settings; missing fields fall back to bridge defaults.
 */
export async function mtkSetMaxDevices(config, username, maxDevices, extra = {}) {
  try {
    const u = String(username || '').trim();
    if (!u) return { ok: false, error: 'no_username' };
    return await post(config, '/api/enable', {
      username:     u,
      speedProfile: extra.speedProfile || extra.wifiSpeedProfile || 'svs-normal',
      maxDevices:   Math.max(1, parseInt(maxDevices, 10) || 2),
      dataLimitMb:  extra.dataLimitMb ?? extra.wifiDataLimitMb ?? 0,
      comment:      extra.name || extra.comment || '',
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
