require('dotenv').config();
const express = require('express');
const cors = require('cors');
const {
  enableUser, disableUser, getActiveSessions, kickSession, kickUser,
  setupSpeedProfiles, healthCheck,
  getUserDetail, setUserBandwidth, setUserProfile,
  getProfiles, createProfile, updateProfile, deleteProfile,
  createSession, getSessionRemaining, extendSession, terminateSession,
  getStats, withClient,
} = require('./mikrotik');
const {
  getBlockedSites, toggleBlockCategory, addCustomBlock, removeCustomBlock,
  getWalledGarden, addWalledGarden, removeWalledGarden, CATEGORIES,
} = require('./block-manager');
const { startSessionWorker } = require('./session-worker');
const { startStudentSync } = require('./student-sync');

const app = express();
const PORT = process.env.BRIDGE_PORT || 3456;
const SECRET = process.env.BRIDGE_SECRET || '';

app.use(cors());
app.use(express.json());

// Auth middleware (skip for /api/status)
function auth(req, res, next) {
  if (!SECRET) return next();
  const header = req.headers['x-bridge-secret'];
  if (header !== SECRET) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

// ─── Health ───────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    const result = await healthCheck();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Existing Routes ──────────────────────────────────────────
app.post('/api/enable', auth, async (req, res) => {
  const { username, speedProfile, maxDevices, dataLimitMb, comment } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'username required' });
  try {
    const result = await enableUser({ username, speedProfile, maxDevices, dataLimitMb, comment });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/disable', auth, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'username required' });
  try {
    const result = await disableUser(username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/active', auth, async (req, res) => {
  try {
    const sessions = await getActiveSessions();
    res.json({ ok: true, sessions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/kick', auth, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });
  try {
    const result = await kickSession(sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/kick-user', auth, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: 'username required' });
  try {
    const result = await kickUser(username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/profiles/setup', auth, async (req, res) => {
  try {
    const result = await setupSpeedProfiles();
    res.json({ ok: true, profiles: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── User Detail ──────────────────────────────────────────────
app.get('/api/user/:username', auth, async (req, res) => {
  try {
    const detail = await getUserDetail(req.params.username);
    if (!detail) return res.status(404).json({ ok: false, error: 'user not found' });
    res.json({ ok: true, user: detail });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/user/:username/bandwidth', auth, async (req, res) => {
  const { download, upload } = req.body;
  if (!download || !upload) return res.status(400).json({ ok: false, error: 'download and upload required' });
  try {
    const result = await setUserBandwidth(req.params.username, download, upload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/user/:username/profile', auth, async (req, res) => {
  const { profile } = req.body;
  if (!profile) return res.status(400).json({ ok: false, error: 'profile required' });
  try {
    const result = await setUserProfile(req.params.username, profile);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Profiles CRUD ────────────────────────────────────────────
app.get('/api/profiles', auth, async (req, res) => {
  try {
    const profiles = await getProfiles();
    res.json({ ok: true, profiles });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/profiles', auth, async (req, res) => {
  const { name, rateLimit, sharedUsers } = req.body;
  if (!name || !rateLimit) return res.status(400).json({ ok: false, error: 'name and rateLimit required' });
  try {
    const result = await createProfile({ name, rateLimit, sharedUsers });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/profiles/:name', auth, async (req, res) => {
  try {
    const result = await updateProfile(req.params.name, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/profiles/:name', auth, async (req, res) => {
  try {
    const result = await deleteProfile(req.params.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Walled Garden ────────────────────────────────────────────
app.get('/api/walled-garden', auth, async (req, res) => {
  try {
    const entries = await getWalledGarden(withClient);
    res.json({ ok: true, entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/walled-garden', auth, async (req, res) => {
  const { dst, action, comment } = req.body;
  if (!dst) return res.status(400).json({ ok: false, error: 'dst required' });
  try {
    const result = await addWalledGarden(withClient, { dst, action, comment });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/walled-garden/:id', auth, async (req, res) => {
  try {
    const result = await removeWalledGarden(withClient, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Website Blocking ─────────────────────────────────────────
app.get('/api/blocked-sites', auth, async (req, res) => {
  try {
    const result = await getBlockedSites(withClient);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/blocked-sites/categories', auth, async (req, res) => {
  res.json({ ok: true, categories: CATEGORIES });
});

app.post('/api/blocked-sites/category', auth, async (req, res) => {
  const { name, enabled } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  try {
    const result = await toggleBlockCategory(withClient, name, enabled !== false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/blocked-sites/custom', auth, async (req, res) => {
  const { domain, comment } = req.body;
  if (!domain) return res.status(400).json({ ok: false, error: 'domain required' });
  try {
    const result = await addCustomBlock(withClient, domain, comment || '');
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/blocked-sites/custom/:id', auth, async (req, res) => {
  try {
    const result = await removeCustomBlock(withClient, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── WiFi Sessions ────────────────────────────────────────────
app.post('/api/session/create', auth, async (req, res) => {
  const { username, password, profile, limitUptime, comment } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });
  try {
    const result = await createSession({ username, password, profile, limitUptime, comment });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/session/:username/remaining', auth, async (req, res) => {
  try {
    const result = await getSessionRemaining(req.params.username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/session/:username/extend', auth, async (req, res) => {
  const { minutes } = req.body;
  if (!minutes) return res.status(400).json({ ok: false, error: 'minutes required' });
  try {
    const totalMinutes = `${minutes}m`;
    const result = await extendSession(req.params.username, totalMinutes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/session/:username', auth, async (req, res) => {
  try {
    const result = await terminateSession(req.params.username);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Stats ────────────────────────────────────────────────────
app.get('/api/stats', auth, async (req, res) => {
  try {
    const result = await getStats();
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Router controls (Phase 5 — Winbox parity) ────────────────
//
// These three endpoints back the admin "Router" section so the team
// never needs Winbox for routine cookie / hotspot lifecycle ops.

/**
 * Clear ALL hotspot remember-me cookies. After this every device must
 * re-authenticate on next visit to /. The bridge intentionally exposes
 * a "clear all" only — per-cookie targeted removal lives in Winbox.
 */
app.post('/api/cookies/clear', auth, async (req, res) => {
  try {
    const result = await withClient(async (client) => {
      const cookies = await client.write('/ip/hotspot/cookie/print');
      const list = cookies || [];
      for (const c of list) {
        try { await client.write('/ip/hotspot/cookie/remove', [`=.id=${c['.id']}`]); } catch (_) {}
      }
      return { ok: true, removed: list.length };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Graceful hotspot restart — disable + re-enable the hotspot service.
 * Kicks every active session; ~2 seconds of unavailability. Used when
 * an admin needs to force-clear all state without rebooting the router.
 */
app.post('/api/hotspot/restart', auth, async (req, res) => {
  try {
    const result = await withClient(async (client) => {
      // Disable then re-enable every hotspot instance (typically there's
      // only one: hsprof1 / hotspot1).
      const spots = await client.write('/ip/hotspot/print');
      const list = spots || [];
      for (const s of list) {
        try { await client.write('/ip/hotspot/disable', [`=.id=${s['.id']}`]); } catch (_) {}
      }
      // brief pause so RouterOS commits the state change
      await new Promise(r => setTimeout(r, 1500));
      for (const s of list) {
        try { await client.write('/ip/hotspot/enable', [`=.id=${s['.id']}`]); } catch (_) {}
      }
      return { ok: true, instances: list.length };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Update the hotspot profile's `http-cookie-lifetime`. Shorter values
 * (e.g. "10m") force quicker re-auth, mitigating the "disconnect then
 * visit /1.1.1.1 lands back on /status" cookie-persistence issue.
 *
 * Body: { profileName: 'hsprof1', value: '10m' | '3d' | '0s' | ... }
 *   - profileName defaults to 'hsprof1' (matches our deployed config).
 *   - value passes through verbatim to RouterOS — accepts any valid
 *     duration string ("0s" disables cookie auth entirely).
 */
app.post('/api/hotspot/profile/cookie-lifetime', auth, async (req, res) => {
  const profileName = req.body?.profileName || 'hsprof1';
  const value = String(req.body?.value || '').trim();
  if (!value) return res.status(400).json({ ok: false, error: 'value required' });
  try {
    const result = await withClient(async (client) => {
      const profiles = await client.write('/ip/hotspot/profile/print', [`?name=${profileName}`]);
      if (!profiles || profiles.length === 0) {
        throw new Error(`hotspot profile not found: ${profileName}`);
      }
      await client.write('/ip/hotspot/profile/set', [
        `=.id=${profiles[0]['.id']}`,
        `=http-cookie-lifetime=${value}`,
      ]);
      return { ok: true, profileName, value };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`MikroTik bridge running on port ${PORT}`);
  console.log(`MikroTik host: ${process.env.MIKROTIK_HOST || '192.168.1.1'}`);
  console.log(`Auth: ${SECRET ? 'enabled' : 'disabled'}`);

  // Start session auto-expiry worker
  startSessionWorker(withClient);

  // Start Supabase student sync worker — keeps MikroTik hotspot users in
  // sync with active library sessions so captive-portal login always works
  // regardless of where the cashier checked the student in from.
  startStudentSync(withClient, enableUser);
});
