import { supabase } from '../lib/supabaseClient';
import { toSnake } from '../lib/fieldMaps';
import { STORAGE_KEYS } from '../constants';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const IS_SUPABASE_CONFIGURED = SUPABASE_URL.length > 0 && !SUPABASE_URL.includes('your-project');

function lsGet(key, def = null) {
  try { const r = localStorage.getItem(key); return r === null ? def : JSON.parse(r); } catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function generateStudentId() {
  if (!IS_SUPABASE_CONFIGURED) {
    const students = lsGet(STORAGE_KEYS.STUDENTS, []);
    const existing = new Set(students.map(s => s.studentId));
    let id;
    do { id = 'LIB-' + Math.floor(10000 + Math.random() * 90000); } while (existing.has(id));
    return id;
  }
  const { data } = await supabase.from('students').select('student_id');
  const existing = new Set((data || []).map(r => r.student_id));
  let id;
  do { id = 'LIB-' + Math.floor(10000 + Math.random() * 90000); } while (existing.has(id));
  return id;
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function calcElapsedMinutes(checkInTime) {
  return Math.floor((Date.now() - new Date(checkInTime).getTime()) / 60000);
}

export function calcBestPrice(minutes, pricing) {
  const fullDays = Math.floor(minutes / 1440);
  const remMinutes = minutes % 1440;
  const billableHours = remMinutes === 0 ? 0 : Math.max(1, Math.floor((remMinutes + 45) / 60));

  if (fullDays > 0 && remMinutes === 0) {
    const amount = fullDays * pricing.fullDay;
    const opt = { type: 'fullDay', label: `${fullDays} يوم كامل`, amount };
    return { options: [opt], best: opt };
  }

  if (fullDays > 0) {
    const amount = fullDays * pricing.fullDay + billableHours * pricing.hourly;
    const opt = { type: 'hourly', label: `${fullDays} يوم + ${billableHours} ساعة`, amount };
    return { options: [opt], best: opt };
  }

  // Standard single-day options
  const effectiveHours = Math.max(1, billableHours);
  const hourlyTotal  = effectiveHours * pricing.hourly;
  const halfDayTotal = pricing.halfDay;
  const fullDayTotal = pricing.fullDay;
  const options = [
    { type: 'hourly',  label: `أجر ساعي (${effectiveHours} ساعة)`,        amount: hourlyTotal  },
    { type: 'halfDay', label: `نصف يوم (${pricing.halfDayHours} ساعات)`,   amount: halfDayTotal },
    { type: 'fullDay', label: 'يوم كامل',                                   amount: fullDayTotal },
  ];
  const best = options.reduce((min, o) => o.amount < min.amount ? o : min, options[0]);
  return { options, best };
}

export function exportCSV(filename, headers, rows) {
  const csv = [headers, ...rows.map(r =>
    r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  )].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// Fire-and-forget — callers need not await
export function logActivity(action, details = '', staffId = '') {
  const entry = {
    id: generateId('log'),
    action,
    details,
    staff_id: staffId,
    timestamp: new Date().toISOString(),
  };
  if (!IS_SUPABASE_CONFIGURED) {
    const logs = lsGet(STORAGE_KEYS.DAILY_LOGS, []);
    lsSet(STORAGE_KEYS.DAILY_LOGS, [{ ...entry, staffId: entry.staff_id }, ...logs].slice(0, 500));
    return;
  }
  supabase.from('daily_logs').insert(entry).then(({ error }) => {
    if (error) console.error('logActivity error:', error);
  });
}

export async function getActiveSubscription(studentId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (!IS_SUPABASE_CONFIGURED) {
    const subs = lsGet(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
    const active = subs.filter(s => s.studentId === studentId && s.status === 'active' && s.expiryDate >= todayStr);
    if (!active.length) return null;
    return active.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  }
  const { data, error } = await supabase
    .from('student_subscriptions')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .gte('expiry_date', todayStr)
    .order('expiry_date', { ascending: true });
  if (error) { console.error('getActiveSubscription error:', error); return null; }
  if (!data || data.length === 0) return null;
  const row = data[0];
  // Convert snake_case → camelCase manually for critical fields
  return {
    id:             row.id,
    studentId:      row.student_id,
    studentName:    row.student_name,
    planId:         row.plan_id,
    planName:       row.plan_name,
    quotaType:      row.quota_type,
    totalQuota:     row.total_quota,
    remainingQuota: row.remaining_quota,
    usedDates:      row.used_dates || [],
    startDate:      row.start_date,
    expiryDate:     row.expiry_date,
    status:         row.status,
    activatedBy:    row.activated_by,
    createdAt:      row.created_at,
  };
}

export function resolveSubscriptionBilling(sub, minutes, todayStr) {
  const updatedSub = { ...sub, usedDates: [...(sub.usedDates || [])] };
  if (sub.quotaType === 'hours') {
    const hoursUsed = Math.max(1, Math.floor((minutes + 45) / 60));
    updatedSub.remainingQuota = Math.max(0, (sub.remainingQuota || 0) - hoursUsed);
  } else {
    if (!updatedSub.usedDates.includes(todayStr)) {
      updatedSub.usedDates.push(todayStr);
      updatedSub.remainingQuota = Math.max(0, (sub.remainingQuota || 0) - 1);
    }
  }
  updatedSub.status = updatedSub.remainingQuota <= 0 ? 'exhausted' : 'active';
  return { updatedSub };
}

// Export supabase for components that need direct access
export { supabase };
