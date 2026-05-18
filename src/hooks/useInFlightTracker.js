/**
 * Global in-flight write counter.
 *
 * Tracks how many financial write batches are currently pending so that
 * useIdleTimeout can DEFER its onTimeout (sign-out) callback while writes
 * are still landing. Tearing down a modal mid-Promise.all leaves drawer
 * state inconsistent.
 *
 * Module-level state on purpose — no React context, no provider, no re-render
 * on change. The idle interval polls hasInFlight() once every 10s.
 */

let inFlight = 0;

export function beginWrite() {
  inFlight += 1;
}

export function endWrite() {
  inFlight = Math.max(0, inFlight - 1);
}

export function hasInFlight() {
  return inFlight > 0;
}

/**
 * Wrap a batch of write promises so the in-flight counter increments before
 * Promise.all and decrements after (success or failure).
 *
 *   const results = await trackedWrites(writes);
 *
 * Behaves exactly like Promise.all otherwise — same return shape, same throw
 * semantics. Safe to use anywhere Promise.all was used.
 */
export async function trackedWrites(promises) {
  beginWrite();
  try {
    return await Promise.all(promises);
  } finally {
    endWrite();
  }
}
