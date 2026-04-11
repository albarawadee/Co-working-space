import { storage } from './storage';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_PRICING, DEFAULT_STAFF, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from '../constants';

export { storage };

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateStudentId() {
  const students = storage.get(STORAGE_KEYS.STUDENTS) || [];
  const existing = new Set(students.map(s => s.studentId));
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
  const hours = minutes / 60;
  const hourlyTotal   = Math.max(1, Math.ceil(hours)) * pricing.hourly;
  const halfDayTotal  = pricing.halfDay;
  const fullDayTotal  = pricing.fullDay;
  const options = [
    { type: 'hourly',   label: `أجر ساعي (${Math.max(1, Math.ceil(hours))} ساعة)`, amount: hourlyTotal  },
    { type: 'halfDay',  label: `نصف يوم (${pricing.halfDayHours} ساعات)`,           amount: halfDayTotal },
    { type: 'fullDay',  label: 'يوم كامل',                                            amount: fullDayTotal },
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

export function logActivity(action, details, staffId = '') {
  const logs = storage.get(STORAGE_KEYS.DAILY_LOGS) || [];
  const entry = { id: generateId('log'), action, details, staffId, timestamp: new Date().toISOString() };
  storage.set(STORAGE_KEYS.DAILY_LOGS, [entry, ...logs].slice(0, 500));
}

export function initializeDefaultData() {
  if (!storage.get(STORAGE_KEYS.CONFIG))               storage.set(STORAGE_KEYS.CONFIG,               DEFAULT_CONFIG);
  if (!storage.get(STORAGE_KEYS.PRICING))              storage.set(STORAGE_KEYS.PRICING,              DEFAULT_PRICING);
  if (!storage.get(STORAGE_KEYS.STAFF))                storage.set(STORAGE_KEYS.STAFF,                DEFAULT_STAFF);
  if (!storage.get(STORAGE_KEYS.CATEGORIES))           storage.set(STORAGE_KEYS.CATEGORIES,           DEFAULT_CATEGORIES);
  if (!storage.get(STORAGE_KEYS.PRODUCTS))             storage.set(STORAGE_KEYS.PRODUCTS,             DEFAULT_PRODUCTS);
  if (!storage.get(STORAGE_KEYS.STUDENTS))             storage.set(STORAGE_KEYS.STUDENTS,             []);
  if (!storage.get(STORAGE_KEYS.SESSIONS))             storage.set(STORAGE_KEYS.SESSIONS,             []);
  if (!storage.get(STORAGE_KEYS.INVOICES))             storage.set(STORAGE_KEYS.INVOICES,             []);
  if (!storage.get(STORAGE_KEYS.KITCHEN_ORDERS))       storage.set(STORAGE_KEYS.KITCHEN_ORDERS,       []);
  if (!storage.get(STORAGE_KEYS.EXPENSES))             storage.set(STORAGE_KEYS.EXPENSES,             []);
  if (!storage.get(STORAGE_KEYS.DAILY_LOGS))           storage.set(STORAGE_KEYS.DAILY_LOGS,           []);
  if (!storage.get(STORAGE_KEYS.OWNERS))               storage.set(STORAGE_KEYS.OWNERS,               []);
  if (!storage.get(STORAGE_KEYS.DEPOSITS))             storage.set(STORAGE_KEYS.DEPOSITS,             []);
  if (!storage.get(STORAGE_KEYS.WALLET_TRANSACTIONS))  storage.set(STORAGE_KEYS.WALLET_TRANSACTIONS,  []);
  if (!storage.get(STORAGE_KEYS.SUBSCRIPTION_PLANS))   storage.set(STORAGE_KEYS.SUBSCRIPTION_PLANS,   []);
  if (!storage.get(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS))storage.set(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS,[]);
}

export function getActiveSubscription(studentId) {
  const subs = storage.get(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS) || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const active = subs.filter(s =>
    s.studentId === studentId &&
    s.status === 'active' &&
    s.expiryDate >= todayStr
  );
  if (!active.length) return null;
  // Pick earliest expiry
  return active.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
}

export function resolveSubscriptionBilling(sub, minutes, todayStr) {
  const updatedSub = { ...sub, usedDates: [...(sub.usedDates || [])] };
  if (sub.quotaType === 'hours') {
    const hoursUsed = Math.ceil(minutes / 60);
    updatedSub.remainingQuota = Math.max(0, (sub.remainingQuota || 0) - hoursUsed);
  } else {
    // days-type: only deduct once per day
    if (!updatedSub.usedDates.includes(todayStr)) {
      updatedSub.usedDates.push(todayStr);
      updatedSub.remainingQuota = Math.max(0, (sub.remainingQuota || 0) - 1);
    }
  }
  updatedSub.status = updatedSub.remainingQuota <= 0 ? 'exhausted' : 'active';
  return { updatedSub };
}
