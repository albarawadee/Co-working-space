/**
 * session-worker.js
 *
 * Background auto-expiry worker for time-limited WiFi hotspot sessions.
 * Handles WIFI-<code> prefixed users only (not library student accounts).
 *
 * Usage:
 *   const { startSessionWorker, stopSessionWorker } = require('./session-worker');
 *   startSessionWorker(withClient);   // after server starts
 *   stopSessionWorker();              // on graceful shutdown
 */

let intervalId = null;

const TICK_INTERVAL = 60_000; // 60 seconds
const WIFI_PREFIX = 'WIFI-';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

/**
 * Mark a voucher row in Supabase as expired. Fire-and-forget — never
 * throws, never blocks the worker loop. RLS is disabled on every table
 * in this project (see CLAUDE.md), so the anon key can PATCH directly.
 *
 * The session-worker keeps the router as the source of truth for
 * "is this voucher kicked"; Supabase mirrors the state so admin views
 * (admin_network_v2 → Vouchers tab) show the right status without
 * waiting for a manual revoke.
 */
async function markVoucherExpiredInSupabase(username) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const url =
      SUPABASE_URL +
      '/rest/v1/wifi_sessions?username=eq.' +
      encodeURIComponent(username) +
      '&is_voucher=eq.true&status=eq.active';
    await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status: 'expired' }),
    });
  } catch (err) {
    // best-effort — log and move on
    console.warn(
      `[session-worker] Supabase expire-mark failed for ${username}:`,
      err.message
    );
  }
}

/**
 * Parse a RouterOS duration string (e.g. "1h30m15s", "5m20s", "45s", "1d2h")
 * into total seconds. Returns 0 for unparseable values.
 */
function parseUptime(str) {
  if (!str || typeof str !== 'string') return 0;

  let total = 0;
  const weeks   = str.match(/(\d+)w/);
  const days    = str.match(/(\d+)d/);
  const hours   = str.match(/(\d+)h/);
  const minutes = str.match(/(\d+)m/);
  const seconds = str.match(/(\d+)s/);

  if (weeks)   total += parseInt(weeks[1], 10) * 7 * 24 * 3600;
  if (days)    total += parseInt(days[1], 10) * 24 * 3600;
  if (hours)   total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);

  return total;
}

/**
 * Start the session expiry worker.
 *
 * @param {Function} withClient - The withClient(fn) function from mikrotik.js
 *   that handles RouterOS connection lifecycle. fn receives (client).
 */
function startSessionWorker(withClient) {
  if (intervalId) {
    console.log('[session-worker] Already running, skipping duplicate start');
    return;
  }

  async function tick() {
    try {
      await withClient(async (client) => {
        const api = client;

        // 1. Fetch all hotspot users
        const allUsers = await api.write('/ip/hotspot/user/print');
        if (!allUsers || !allUsers.length) return;

        // 2. Filter to WIFI- prefixed users with a time limit set
        const wifiUsers = allUsers.filter(
          (u) => u.name && u.name.startsWith(WIFI_PREFIX) && u['limit-uptime']
        );

        if (!wifiUsers.length) return;

        for (const user of wifiUsers) {
          const username = user.name;
          const limitSeconds = parseUptime(user['limit-uptime']);

          if (limitSeconds <= 0) continue;

          // Skip already-disabled users with no active sessions
          if (user.disabled === 'true' || user.disabled === true) continue;

          // 3. Fetch active sessions for this user
          let activeSessions;
          try {
            activeSessions = await api.write('/ip/hotspot/active/print', [
              `?user=${username}`,
            ]);
          } catch (_) {
            activeSessions = [];
          }

          if (!activeSessions || !activeSessions.length) {
            // No active sessions — nothing to expire right now
            continue;
          }

          // 4. Check if any session has exceeded the limit
          const maxUptime = Math.max(
            ...activeSessions.map((s) => parseUptime(s.uptime))
          );

          if (maxUptime < limitSeconds) continue;

          // 5. User has expired — kick all sessions
          for (const session of activeSessions) {
            try {
              await api.write('/ip/hotspot/active/remove', [
                `=.id=${session['.id']}`,
              ]);
            } catch (_) {
              // Best effort — session may have already ended
            }
          }

          // 6. Disable the user so they cannot reconnect
          try {
            await api.write('/ip/hotspot/user/set', [
              `=.id=${user['.id']}`,
              '=disabled=yes',
            ]);
          } catch (err) {
            console.error(
              `[session-worker] Failed to disable ${username}:`,
              err.message
            );
          }

          // 7. Mirror the state to Supabase so admin views update.
          // Fire-and-forget — never blocks the worker.
          markVoucherExpiredInSupabase(username);

          console.log(`[session-worker] Expired: ${username}`);
        }
      });
    } catch (err) {
      console.error('[session-worker] Error:', err.message);
    }
  }

  // Run immediately on start, then every TICK_INTERVAL
  tick();
  intervalId = setInterval(tick, TICK_INTERVAL);
  console.log('[session-worker] Started (60s interval)');
}

/**
 * Stop the session expiry worker.
 */
function stopSessionWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[session-worker] Stopped');
  }
}

module.exports = { startSessionWorker, stopSessionWorker };
