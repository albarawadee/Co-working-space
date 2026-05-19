import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toCamel } from '../../lib/fieldMaps';
import { usePortalChrome, PortalShell } from '../portal/PortalChrome';
import {
  usePortalConfig,
  useDeviceFingerprint,
  WhatsAppFAB,
  wrapT,
  ToastStack,
  useToastStack,
} from '../../portal';
import '../../portal/design.css';

import { LoginScreen }          from './screens/LoginScreen';
import { LoadingScreen }        from './screens/LoadingScreen';
import { SuccessScreen }        from './screens/SuccessScreen';
import { ErrorNotFoundScreen }  from './screens/ErrorNotFoundScreen';
import { NoSessionScreen }      from './screens/NoSessionScreen';
import { DeviceLimitScreen }    from './screens/DeviceLimitScreen';
import { OfflineScreen }        from './screens/OfflineScreen';
import { VoucherScreen }        from './screens/VoucherScreen';

/**
 * Portal-v2 captive-portal route (`/#wifi-v2`).
 *
 * State machine:
 *   idle → submitting → ( not_found | no_session | device_limit | success )
 *                                              ↑
 *                                          reset → idle
 *   any  → offline   (bridge unreachable, transient)
 *
 * IMPORTANT — for Phase 1: we do NOT change the captive-portal protocol.
 * Once we determine the student is allowed, the form-POST to MikroTik's
 * `link-login-only` URL is identical to v1. This keeps router behavior
 * identical until the captive `login.html` is rebuilt in Phase 2.
 */

const STATES = {
  IDLE:         'idle',
  SUBMITTING:   'submitting',
  SUCCESS:      'success',
  NOT_FOUND:    'not_found',
  NO_SESSION:   'no_session',
  DEVICE_LIMIT: 'device_limit',
  OFFLINE:      'offline',
};

export function CaptivePortalV2() {
  const baseChrome = usePortalChrome();
  const t = wrapT(baseChrome.t, baseChrome.lang);
  const { navigate } = baseChrome;

  const { config } = usePortalConfig();
  const { deviceId } = useDeviceFingerprint();
  const toast = useToastStack();

  const [state, setState]       = useState(STATES.IDLE);
  const [mode, setMode]         = useState('member'); // 'member' | 'voucher'
  const [query, setQuery]       = useState('');
  const [student, setStudent]   = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [deviceList, setDeviceList] = useState([]);  // for DeviceLimitScreen

  const libraryName = config?.name || 'Smart Vision';

  // Captive HTML's "Redeem a voucher" button arrives with ?voucher=1.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('voucher')) setMode('voucher');
  }, []);

  const reset = useCallback(() => {
    navigate(() => {
      setQuery('');
      setStudent(null);
      setErrorMsg('');
      setDeviceList([]);
      setState(STATES.IDLE);
    }, 'back');
  }, [navigate]);

  /** Read-only device check against the v2 bridge.
   *  Failure is non-fatal — we fall back to allowing the login and let
   *  RouterOS enforce shared-users at the router level. The bridge call
   *  exists purely to give the user a friendly DeviceLimitScreen when
   *  the bridge IS reachable (the common case on the library LAN). */
  async function checkDeviceLimit(username) {
    const bridgeUrl = (config?.bridgeUrlV2 || '').replace(/\/$/, '');
    const secret    = config?.bridgeSecretV2 || '';
    if (!bridgeUrl) return { allowed: true, devices: [], skipped: true };

    try {
      const res = await fetch(`${bridgeUrl}/api/v2/device-check`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-bridge-secret': secret } : {}) },
        body:    JSON.stringify({ username, deviceId }),
      });
      if (!res.ok) return { allowed: true, devices: [], skipped: true };
      return await res.json();
    } catch {
      return { allowed: true, devices: [], skipped: true };
    }
  }

  /** Submit the hotspot form to MikroTik exactly as v1 does. We just
   *  wrap it so the SuccessScreen renders for ~800ms first.
   *
   *  Used by BOTH the member path (username = password = member_number,
   *  dst = dashboard) AND the voucher path (username = password =
   *  `WIFI-XXXXXX`, dst = link-orig or captive root — vouchers don't
   *  have a student dashboard yet, MikroTik's own status page handles
   *  the post-login UX). */
  function submitToMikroTik(username, password, dst) {
    if (!username) return;
    const pw = password || username;
    const urlParams = new URLSearchParams(window.location.search);
    const linkLoginOnly = urlParams.get('link-login-only');
    const linkOrig      = urlParams.get('link-orig') || '';
    if (linkLoginOnly) {
      setTimeout(() => {
        const f = document.createElement('form');
        f.method = 'post';
        f.action = linkLoginOnly;
        const add = (n, v) => {
          const i = document.createElement('input');
          i.type = 'hidden';
          i.name = n;
          i.value = v;
          f.appendChild(i);
        };
        add('username', username);
        add('password', pw);
        add('dst', dst || linkOrig || 'http://10.5.50.240:5173/');
        add('popup', 'true');
        document.body.appendChild(f);
        f.submit();
      }, 800);
    } else if (dst) {
      // No captive-portal context — fall back to dashboard page (member path).
      setTimeout(() => { window.location.hash = dst.split('#')[1] || ''; }, 1500);
    }
  }

  async function handleSubmit(value) {
    const q = String(value || '').trim();
    if (!q) return;

    navigate(() => setState(STATES.SUBMITTING));
    setErrorMsg('');

    try {
      // 1. Strict member_number lookup.
      const { data: rows, error: studentErr } = await supabase
        .from('students')
        .select('id, name, phone, member_number, wallet_balance')
        .ilike('member_number', q)
        .limit(1);

      if (studentErr) throw studentErr;

      const found = rows?.[0] ? toCamel(rows[0]) : null;
      if (!found) {
        navigate(() => {
          setState(STATES.NOT_FOUND);
          setErrorMsg(t('login.errorMember'));
          setShakeKey(k => k + 1);
        });
        return;
      }

      // 2. Active session?
      const { data: sessionRows } = await supabase
        .from('sessions')
        .select('id')
        .eq('student_id', found.id)
        .eq('status', 'active')
        .limit(1);

      if (!sessionRows?.length) {
        navigate(() => {
          setStudent(found);
          setState(STATES.NO_SESSION);
        });
        return;
      }

      // 3. Device limit (non-fatal — fall through if bridge unreachable).
      const memberNumber = String(found.memberNumber || '').trim();
      const check = await checkDeviceLimit(memberNumber);
      if (check?.allowed === false) {
        navigate(() => {
          setStudent(found);
          setDeviceList(Array.isArray(check.devices) ? check.devices : []);
          setState(STATES.DEVICE_LIMIT);
        });
        return;
      }

      // 4. Success — render confirmation then submit to MikroTik.
      navigate(() => {
        setStudent(found);
        setState(STATES.SUCCESS);
      });
      submitToMikroTik(
        memberNumber,
        memberNumber,
        `http://10.5.50.240:5173/?id=${found.id}#wifi-status-v2`,
      );
    } catch (err) {
      console.error('[CaptivePortalV2] submit error:', err);
      navigate(() => {
        setState(STATES.NOT_FOUND);
        setErrorMsg(t('login.errorConnection'));
        setShakeKey(k => k + 1);
      });
      toast.push({ tone: 'error', message: t('login.errorConnection') });
    }
  }

  // Render
  let body;
  if (mode === 'voucher') {
    body = (
      <VoucherScreen
        t={t}
        libraryName={libraryName}
        submitToMikroTik={submitToMikroTik}
        onBack={() => navigate(() => setMode('member'), 'back')}
      />
    );
  }
  else if (state === STATES.SUBMITTING)        body = <LoadingScreen t={t} libraryName={libraryName} />;
  else if (state === STATES.SUCCESS)      body = <SuccessScreen t={t} libraryName={libraryName} student={student} />;
  else if (state === STATES.NOT_FOUND)    body = <ErrorNotFoundScreen t={t} libraryName={libraryName} errorMsg={errorMsg} shakeKey={shakeKey} onReset={reset} />;
  else if (state === STATES.NO_SESSION)   body = <NoSessionScreen t={t} libraryName={libraryName} student={student} onReset={reset} />;
  else if (state === STATES.DEVICE_LIMIT) body = <DeviceLimitScreen t={t} libraryName={libraryName} student={student} devices={deviceList} maxDevices={config?.wifiV2Enabled ? 2 : 2} thisDeviceId={deviceId} whatsappNumber={config?.whatsappSupportNumber} onReset={reset} onRetry={() => handleSubmit(query)} />;
  else if (state === STATES.OFFLINE)      body = <OfflineScreen t={t} libraryName={libraryName} onRetry={() => handleSubmit(query)} />;
  else                                    body = <LoginScreen t={t} libraryName={libraryName} query={query} setQuery={setQuery} onSubmit={handleSubmit} onVoucher={() => navigate(() => setMode('voucher'))} />;

  return (
    <PortalShell>
      {body}
      {config?.whatsappSupportNumber && (
        <WhatsAppFAB
          number={config.whatsappSupportNumber}
          message={t('v2.fab.whatsappMessage')}
          label={t('v2.fab.whatsapp')}
          ariaLabel={t('v2.fab.whatsappAria')}
        />
      )}
      <ToastStack {...toast.bind} />
    </PortalShell>
  );
}
