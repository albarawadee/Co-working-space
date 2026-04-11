import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { TABLE_MAP } from '../lib/tableMap';
import { toCamel, toSnake } from '../lib/fieldMaps';

// Dev fallback: use localStorage when Supabase isn't configured yet
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const IS_SUPABASE_CONFIGURED = SUPABASE_URL.length > 0 && !SUPABASE_URL.includes('your-project');

function lsGet(key, def) {
  try { const r = localStorage.getItem(key); return r === null ? def : JSON.parse(r); }
  catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function useSupabaseTable(key, defaultValue) {
  const tableInfo = TABLE_MAP[key];
  const [data, setData] = useState(() => IS_SUPABASE_CONFIGURED ? defaultValue : (lsGet(key, defaultValue)));
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED);
  const snapshotRef = useRef(null);
  const defaultRef = useRef(defaultValue);

  // ── localStorage fallback (Supabase not configured) ──────────────────────
  const lsSave = useCallback((val) => {
    const next = typeof val === 'function' ? val(lsGet(key, defaultRef.current)) : val;
    lsSet(key, next);
    setData(next);
  }, [key]);

  const lsRefresh = useCallback(() => {
    setData(lsGet(key, defaultRef.current));
  }, [key]);

  if (!IS_SUPABASE_CONFIGURED) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const onStorage = (e) => { if (e.key === key) lsRefresh(); };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }, [key, lsRefresh]);
    return [data, lsSave, lsRefresh, false];
  }

  // ── Supabase path ─────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const load = useCallback(async () => {
    if (!tableInfo) { setLoading(false); return; }
    setLoading(true);
    try {
      if (tableInfo.singleton) {
        const { data: rows, error } = await supabase
          .from(tableInfo.table)
          .select('*')
          .eq('id', 'singleton')
          .maybeSingle();
        if (error) throw error;
        const result = rows ? toCamel(rows) : defaultRef.current;
        setData(result);
        snapshotRef.current = result;
      } else {
        let query = supabase.from(tableInfo.table).select('*');
        if (tableInfo.order) {
          query = query.order(tableInfo.order.col, { ascending: tableInfo.order.asc });
        }
        const { data: rows, error } = await query;
        if (error) throw error;
        const result = (rows || []).map(toCamel);
        setData(result);
        snapshotRef.current = result;
      }
    } catch (err) {
      console.error(`useSupabaseTable load error [${key}]:`, err);
    } finally {
      setLoading(false);
    }
  }, [key, tableInfo]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { load(); }, [load]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const save = useCallback(async (val) => {
    if (!tableInfo) return;
    const next = typeof val === 'function'
      ? val(snapshotRef.current ?? defaultRef.current)
      : val;

    setData(next);

    try {
      if (tableInfo.singleton) {
        const { error } = await supabase
          .from(tableInfo.table)
          .upsert({ ...toSnake(next), id: 'singleton' });
        if (error) throw error;
        snapshotRef.current = next;
      } else {
        const snapshot = snapshotRef.current || [];
        const snapMap = new Map(snapshot.map(r => [r.id, r]));
        const nextMap = new Map(next.map(r => [r.id, r]));

        const toDelete = snapshot.filter(r => !nextMap.has(r.id));
        const toUpsert = next.filter(r => {
          if (!snapMap.has(r.id)) return true;
          return JSON.stringify(r) !== JSON.stringify(snapMap.get(r.id));
        });

        const ops = [];
        if (toDelete.length > 0) {
          ops.push(supabase.from(tableInfo.table).delete().in('id', toDelete.map(r => r.id)));
        }
        if (toUpsert.length > 0) {
          ops.push(supabase.from(tableInfo.table).upsert(toUpsert.map(toSnake)));
        }

        if (ops.length > 0) {
          const results = await Promise.all(ops);
          const firstErr = results.find(r => r.error);
          if (firstErr?.error) throw firstErr.error;
        }
        snapshotRef.current = next;
      }
    } catch (err) {
      console.error(`useSupabaseTable save error [${key}]:`, err);
      const prev = snapshotRef.current ?? defaultRef.current;
      setData(prev);
      throw err;
    }
  }, [key, tableInfo]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const refresh = useCallback(() => load(), [load]);

  return [data, save, refresh, loading];
}
