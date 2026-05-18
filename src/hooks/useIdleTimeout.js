import { useState, useEffect, useRef, useCallback } from 'react';
import { hasInFlight } from './useInFlightTracker';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE = 15 * 60 * 1000; // Show warning 15 min before logout
const CHECK_INTERVAL = 10 * 1000;     // Check every 10 seconds

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];

export function useIdleTimeout({ enabled = true, onTimeout }) {
  const [showWarning, setShowWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    // Reset on mount
    lastActivityRef.current = Date.now();

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      // Dismiss warning on any activity
      setShowWarning(false);
    };

    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT) {
        // Defer sign-out while financial writes are pending — tearing down a
        // modal mid-Promise.all leaves drawer state inconsistent. Worst-case
        // delay is one CHECK_INTERVAL (10s) past the writes draining.
        if (hasInFlight()) return;
        onTimeoutRef.current?.();
        setShowWarning(false);
      } else if (elapsed >= IDLE_TIMEOUT - WARNING_BEFORE) {
        setShowWarning(true);
      }
    }, CHECK_INTERVAL);

    return () => {
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, handleActivity)
      );
      clearInterval(intervalId);
    };
  }, [enabled]);

  return { showWarning, dismissWarning: resetActivity };
}
