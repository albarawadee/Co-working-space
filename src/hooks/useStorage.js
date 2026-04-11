import { useState, useCallback, useEffect, useRef } from 'react';
import { storage } from '../utils/storage';

export function useStorage(key, defaultValue) {
  const [data, setData] = useState(() => storage.get(key) ?? defaultValue);
  const defaultRef = useRef(defaultValue);

  const save = useCallback((val) => {
    const next = typeof val === 'function' ? val(storage.get(key) ?? defaultRef.current) : val;
    storage.set(key, next);
    setData(next);
  }, [key]);

  const refresh = useCallback(() => {
    setData(storage.get(key) ?? defaultRef.current);
  }, [key]);

  // Re-sync whenever another component writes to the same key
  useEffect(() => {
    const onLibStorage = (e) => {
      if (e.detail?.key === key) {
        setData(storage.get(key) ?? defaultRef.current);
      }
    };
    // Cross-tab sync via native storage event
    const onNativeStorage = (e) => {
      if (e.key === key) {
        setData(storage.get(key) ?? defaultRef.current);
      }
    };
    window.addEventListener('lib-storage', onLibStorage);
    window.addEventListener('storage', onNativeStorage);
    return () => {
      window.removeEventListener('lib-storage', onLibStorage);
      window.removeEventListener('storage', onNativeStorage);
    };
  }, [key]);

  return [data, save, refresh];
}
