import { useRef, useState, useCallback } from 'react';

/**
 * Synchronous double-submit guard.
 *
 * useState is async — setIsProcessing(true) doesn't take effect until the next
 * render, so a second click within ~16ms passes any `if (isProcessing) return`
 * check. useRef mutates synchronously and prevents the race.
 *
 * Usage:
 *   const { run, isLocked } = useSubmitLock();
 *   const handleSubmit = () => run(async () => { ...writes... });
 *   <button onClick={handleSubmit} disabled={isLocked}>...</button>
 *
 * Returns:
 *   - run(fn): runs fn under lock. Second call while running returns
 *     { skipped: true } immediately without invoking fn.
 *   - isLocked: boolean mirror of the lock for disabling UI / spinners.
 */
export function useSubmitLock() {
  const lockRef = useRef(false);
  const [isLocked, setIsLocked] = useState(false);

  const run = useCallback(async (fn) => {
    if (lockRef.current) return { skipped: true };
    lockRef.current = true;
    setIsLocked(true);
    try {
      const result = await fn();
      return { skipped: false, result };
    } finally {
      lockRef.current = false;
      setIsLocked(false);
    }
  }, []);

  return { run, isLocked };
}
