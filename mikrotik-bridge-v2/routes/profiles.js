const express = require('express');
const { withApi } = require('../mikrotik-pool');

const router = express.Router();

// GET /api/v2/profiles — list RouterOS hotspot user profiles
router.get('/profiles', async (req, res) => {
  try {
    const profiles = await withApi(async (client) => {
      const rows = await client.write('/ip/hotspot/user/profile/print');
      return (rows || []).map(p => ({
        id:          p['.id'],
        name:        p.name,
        rateLimit:   p['rate-limit'] || '',
        sharedUsers: parseInt(p['shared-users'] || '1', 10),
      }));
    });
    res.json({ ok: true, profiles });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/v2/profiles
 * Body: {
 *   name, downloadMbps, uploadMbps, maxDevices,
 *   // Phase 5 — advanced RouterOS hotspot user-profile fields.
 *   // Any field omitted is left untouched on existing profiles.
 *   macCookieTimeout, idleTimeout, keepaliveTimeout, sessionTimeout,
 *   statusAutorefresh, transparentProxy
 * }
 * Adds or updates a profile by name. Translates mbps → RouterOS
 * "rate-limit=10M/2M" syntax. Optional timing fields pass through
 * verbatim — RouterOS accepts "1h30m", "0s" (disable), "none", etc.
 */
router.post('/profiles', express.json(), async (req, res) => {
  const {
    name, downloadMbps, uploadMbps, maxDevices = 2,
    macCookieTimeout, idleTimeout, keepaliveTimeout, sessionTimeout,
    statusAutorefresh, transparentProxy,
  } = req.body || {};
  if (!name || downloadMbps == null || uploadMbps == null) {
    return res.status(400).json({ ok: false, error: 'name, downloadMbps, uploadMbps required' });
  }
  const rateLimit = `${downloadMbps}M/${uploadMbps}M`;

  // Build the optional fields payload. We only include keys the caller
  // explicitly supplied so a partial update doesn't overwrite RouterOS
  // defaults — null/undefined → skip.
  const extras = [];
  if (macCookieTimeout != null && macCookieTimeout !== '') extras.push(`=mac-cookie-timeout=${macCookieTimeout}`);
  if (idleTimeout      != null && idleTimeout      !== '') extras.push(`=idle-timeout=${idleTimeout}`);
  if (keepaliveTimeout != null && keepaliveTimeout !== '') extras.push(`=keepalive-timeout=${keepaliveTimeout}`);
  if (sessionTimeout   != null && sessionTimeout   !== '') extras.push(`=session-timeout=${sessionTimeout}`);
  if (statusAutorefresh!= null && statusAutorefresh!== '') extras.push(`=status-autorefresh=${statusAutorefresh}`);
  if (transparentProxy != null) extras.push(`=transparent-proxy=${transparentProxy ? 'yes' : 'no'}`);

  try {
    await withApi(async (client) => {
      const existing = await client.write('/ip/hotspot/user/profile/print', [`?name=${name}`]);
      const baseParams = [
        `=rate-limit=${rateLimit}`,
        `=shared-users=${maxDevices}`,
        ...extras,
      ];
      if (existing && existing.length > 0) {
        await client.write('/ip/hotspot/user/profile/set', [
          `=.id=${existing[0]['.id']}`,
          ...baseParams,
        ]);
      } else {
        await client.write('/ip/hotspot/user/profile/add', [
          `=name=${name}`,
          ...baseParams,
        ]);
      }
    });
    res.json({ ok: true, name, rateLimit, maxDevices, extras: extras.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/v2/profiles/:name
router.delete('/profiles/:name', async (req, res) => {
  try {
    await withApi(async (client) => {
      const rows = await client.write('/ip/hotspot/user/profile/print', [`?name=${req.params.name}`]);
      for (const r of (rows || [])) {
        try { await client.write('/ip/hotspot/user/profile/remove', [`=.id=${r['.id']}`]); } catch (_) {}
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
