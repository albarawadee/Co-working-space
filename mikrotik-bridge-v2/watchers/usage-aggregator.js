/**
 * Usage aggregator — turns SSE `device.bandwidth.update` events into
 * persistent `wifi_usage_logs` rows.
 *
 * Each event carries a delta since the last 5s active-watcher tick.
 * We accumulate per `(username, today's date)` in memory and flush
 * via Supabase upsert every USAGE_FLUSH_MS (default 5 min).
 *
 * Upsert key: `(username, date)` — one monotonically-increasing row
 * per user per day. Admin UI (Phase 5+) charts these.
 *
 * Best-effort: failures are logged, never thrown.
 */

const bus = require('../event-bus');

const PROCESS_ID = `bridge-v2-${process.pid}`;

// Supabase requires a non-null primary key on wifi_usage_logs (TEXT PK,
// no default in the migration). Generate one locally — matches the
// id-shape used everywhere else in the bridge / app.
function genId() {
  return 'wul_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Per-tick aggregator. Keys: `<username>|<YYYY-MM-DD>`
const acc = new Map();

function today() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function key(username) { return `${username}|${today()}`; }

let unsub = null;
let flushTimer = null;

function onEvent(evt) {
  if (evt.type !== 'device.bandwidth.update') return;
  const { username, deltaIn = 0, deltaOut = 0 } = evt.payload || {};
  if (!username) return;
  const k = key(username);
  const cur = acc.get(k) || { username, date: today(), bytesIn: 0, bytesOut: 0, sessions: 0 };
  cur.bytesIn  += Math.max(0, deltaIn);
  cur.bytesOut += Math.max(0, deltaOut);
  acc.set(k, cur);
}

function supabaseFetch(url, key_, path, opts = {}) {
  if (!url || !key_) return Promise.resolve(null);
  return fetch(`${url}${path}`, {
    ...opts,
    headers: {
      apikey: key_,
      Authorization: `Bearer ${key_}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
      ...(opts.headers || {}),
    },
  })
    .then(r => (r.ok ? r : Promise.reject(new Error(`supabase ${r.status}`))))
    .catch(err => {
      console.warn(`[usage-aggregator] supabase ${opts.method || 'GET'} ${path} failed:`, err.message);
      return null;
    });
}

async function flush({ supabaseUrl, supabaseKey }) {
  if (acc.size === 0) return;
  // Snapshot + reset so new events accumulate into the next bucket.
  const snapshot = [...acc.values()];
  acc.clear();

  // Upsert as a batch. Keying on (username, date) requires a unique
  // index — we don't have one yet, so we instead read the existing
  // row's totals, then update with summed values. This is a known
  // limitation; Phase 5 cleanup PR can add the index + use proper
  // upsert.
  for (const row of snapshot) {
    try {
      const existing = await fetch(
        `${supabaseUrl}/rest/v1/wifi_usage_logs?username=eq.${encodeURIComponent(row.username)}&date=eq.${row.date}&select=id,bytes_in,bytes_out,sessions_count`,
        {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Accept: 'application/json' },
        }
      ).then(r => (r.ok ? r.json() : null)).catch(() => null);

      if (Array.isArray(existing) && existing.length > 0) {
        const cur = existing[0];
        await supabaseFetch(supabaseUrl, supabaseKey, `/rest/v1/wifi_usage_logs?id=eq.${cur.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            bytes_in:  (parseInt(cur.bytes_in  || '0', 10) + row.bytesIn).toString(),
            bytes_out: (parseInt(cur.bytes_out || '0', 10) + row.bytesOut).toString(),
            sessions_count: (cur.sessions_count || 0),
          }),
        });
      } else {
        // wifi_usage_logs has TEXT PK with no default + no `source` column
        // (see migrations/20260518100000_wifi_network_tables.sql). Supply
        // an id locally; PROCESS_ID is logged in pm2 instead of persisted.
        await supabaseFetch(supabaseUrl, supabaseKey, '/rest/v1/wifi_usage_logs', {
          method: 'POST',
          body: JSON.stringify({
            id: genId(),
            username: row.username,
            date: row.date,
            bytes_in:  row.bytesIn.toString(),
            bytes_out: row.bytesOut.toString(),
            sessions_count: 0,
          }),
        });
      }
    } catch (err) {
      console.warn(`[usage-aggregator] flush row failed for ${row.username}:`, err.message);
      // Re-queue the row so we don't lose data.
      const k = key(row.username);
      const back = acc.get(k) || { username: row.username, date: row.date, bytesIn: 0, bytesOut: 0 };
      back.bytesIn  += row.bytesIn;
      back.bytesOut += row.bytesOut;
      acc.set(k, back);
    }
  }
}

function start({ intervalMs }) {
  if (unsub) return;
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_KEY || '';
  if (!supabaseUrl || !supabaseKey) {
    console.log('[usage-aggregator] Supabase not configured — disabled');
    return;
  }
  const ms = Math.max(60_000, intervalMs || 300_000);
  console.log(`[usage-aggregator] starting (flush every ${ms}ms)`);
  unsub = bus.subscribe(onEvent);
  flushTimer = setInterval(() => flush({ supabaseUrl, supabaseKey }), ms);
}

function stop() {
  if (unsub) { try { unsub(); } catch (_) {} unsub = null; }
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  console.log('[usage-aggregator] stopped');
}

module.exports = { start, stop };
