export const storage = {
  get(key) {
    try { const r = localStorage.getItem(key); return r === null ? null : JSON.parse(r); }
    catch { return null; }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      window.dispatchEvent(new CustomEvent('lib-storage', { detail: { key } }));
    } catch {}
  },
  remove(key) { try { localStorage.removeItem(key); } catch {} },
  clear()     { try { localStorage.clear(); } catch {} },
  keys()      { try { return Object.keys(localStorage); } catch { return []; } },
};
