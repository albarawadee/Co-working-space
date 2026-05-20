-- Phase 5: Network console redesign
--
-- ADDITIVE changes only — no destructive drops, no column rewrites.
--
-- 1. wifi_profiles_v2: surface the rest of the RouterOS hotspot user-profile
--    fields so admins can tune timeouts + transparent-proxy + status
--    autorefresh from the console instead of dropping into Winbox.
-- 2. wifi_walled_garden seeded WhatsApp bundle: REMOVE the broad
--    `*.whatsapp.net` / `*.whatsapp.com` wildcards (which whitelist the media
--    CDN endpoints) and KEEP only the text/signal endpoints. SOFT enforcement
--    per the user's call — authenticated sessions still get full WhatsApp via
--    their regular internet access. Pre-auth users on the free bundle are
--    limited to text/signal only.
-- 3. wifi_blocked_categories seeded `adult` row: populate with ~55 of the
--    most-trafficked adult domains. Curated for production use; admin can
--    extend via custom blocks. Source: public DNS-block community lists.

-- ─── 1. wifi_profiles_v2 — advanced RouterOS options ─────────────
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS mac_cookie_timeout text;
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS idle_timeout       text;
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS keepalive_timeout  text;
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS session_timeout    text;
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS transparent_proxy  boolean DEFAULT false;
ALTER TABLE wifi_profiles_v2 ADD COLUMN IF NOT EXISTS status_autorefresh text;

COMMENT ON COLUMN wifi_profiles_v2.mac_cookie_timeout IS 'RouterOS mac-cookie-timeout (e.g. "3d", "0s" to disable)';
COMMENT ON COLUMN wifi_profiles_v2.idle_timeout       IS 'RouterOS idle-timeout — kick after this much idle (e.g. "15m")';
COMMENT ON COLUMN wifi_profiles_v2.keepalive_timeout  IS 'RouterOS keepalive-timeout (e.g. "2m")';
COMMENT ON COLUMN wifi_profiles_v2.session_timeout    IS 'RouterOS session-timeout — hard cap (e.g. "8h", "0s" unlimited)';
COMMENT ON COLUMN wifi_profiles_v2.transparent_proxy  IS 'Force transparent proxy through MikroTik';
COMMENT ON COLUMN wifi_profiles_v2.status_autorefresh IS 'Auto-refresh interval for the captive status page (e.g. "1m")';

-- ─── 2. WhatsApp soft block: text/signal only ────────────────────
-- Use INSERT … ON CONFLICT DO UPDATE so fresh DBs that never ran the
-- original 20260518100000 migration still get the bundle.
INSERT INTO wifi_walled_garden (id, name, domains, comment)
VALUES (
  'wg-whatsapp',
  'واتساب',
  '[
    "web.whatsapp.com",
    "c.whatsapp.net",
    "d.whatsapp.net",
    "e.whatsapp.net",
    "g.whatsapp.net",
    "s.whatsapp.net",
    "mmx.whatsapp.net"
  ]'::jsonb,
  'WhatsApp text/voice messaging only — media CDN intentionally excluded'
)
ON CONFLICT (id) DO UPDATE
  SET domains = EXCLUDED.domains,
      comment = EXCLUDED.comment;

-- ─── 3. Adult content blocklist seed ─────────────────────────────
-- Top ~55 adult-content domains by public traffic. Admin can extend via
-- the Custom blocks UI; this seed makes "enable adult category" actually
-- block something instead of being a no-op. INSERT…ON CONFLICT so fresh
-- DBs without the original `cat-adult` row still get a populated entry.
INSERT INTO wifi_blocked_categories (id, name, label, domains, enabled)
VALUES (
  'cat-adult',
  'adult',
  'محتوى للبالغين',
  '[
    "pornhub.com","xvideos.com","xnxx.com","xhamster.com","redtube.com",
    "youporn.com","tube8.com","spankbang.com","brazzers.com","bangbros.com",
    "naughtyamerica.com","realitykings.com","mofos.com","digitalplayground.com",
    "kink.com","onlyfans.com","fansly.com","manyvids.com","clips4sale.com",
    "stripchat.com","chaturbate.com","camsoda.com","bongacams.com","livejasmin.com",
    "myfreecams.com","cam4.com","streamate.com","flirt4free.com",
    "porn.com","porntrex.com","porntube.com","pornhd.com","sex.com",
    "eporner.com","beeg.com","tnaflix.com","pornone.com","drtuber.com",
    "txxx.com","hclips.com","sex3.com","empflix.com","keezmovies.com",
    "extremetube.com","slutload.com","perfectgirls.net","tubegalore.com",
    "fapdu.com","javhd.com","javbus.com","jav.guru","missav.com",
    "thumbzilla.com","yourporn.sexy","sextube.com","gotporn.com","18qt.com"
  ]'::jsonb,
  false
)
ON CONFLICT (name) DO UPDATE
  SET domains = EXCLUDED.domains,
      label   = EXCLUDED.label;

-- Realtime is already enabled on these tables from the original migration.
