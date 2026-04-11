import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_PRICING, DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from '../constants';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const IS_SUPABASE_CONFIGURED = SUPABASE_URL.length > 0 && !SUPABASE_URL.includes('your-project');

function lsGet(key) {
  try { const r = localStorage.getItem(key); return r === null ? null : JSON.parse(r); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const DEFAULT_STAFF = [
  { id: 'stf-albara',  username: 'albara',  password: 'albara123',  role: 'admin',   name: 'البراء',  active: true, createdAt: new Date().toISOString() },
  { id: 'stf-nawaf',   username: 'nawaf',   password: 'nawaf123',   role: 'admin',   name: 'نواف',    active: true, createdAt: new Date().toISOString() },
  { id: 'stf-cashier1',username: 'cashier1',password: 'cash123',    role: 'cashier', name: 'أمين الصندوق', active: true, createdAt: new Date().toISOString() },
  { id: 'stf-kitchen1',username: 'kitchen1',password: 'kit123',     role: 'kitchen', name: 'موظف المطبخ',  active: true, createdAt: new Date().toISOString() },
];

export function initializeDefaultData() {
  if (IS_SUPABASE_CONFIGURED) return; // Supabase handles data — nothing to do

  if (!lsGet(STORAGE_KEYS.CONFIG))               lsSet(STORAGE_KEYS.CONFIG,               DEFAULT_CONFIG);
  if (!lsGet(STORAGE_KEYS.PRICING))              lsSet(STORAGE_KEYS.PRICING,              DEFAULT_PRICING);
  if (!lsGet(STORAGE_KEYS.CATEGORIES))           lsSet(STORAGE_KEYS.CATEGORIES,           DEFAULT_CATEGORIES);
  if (!lsGet(STORAGE_KEYS.PRODUCTS))             lsSet(STORAGE_KEYS.PRODUCTS,             DEFAULT_PRODUCTS);

  // Always sync staff to the authoritative list (so account changes take effect)
  lsSet(STORAGE_KEYS.STAFF, DEFAULT_STAFF);

  if (!lsGet(STORAGE_KEYS.STUDENTS))             lsSet(STORAGE_KEYS.STUDENTS,             []);
  if (!lsGet(STORAGE_KEYS.SESSIONS))             lsSet(STORAGE_KEYS.SESSIONS,             []);
  if (!lsGet(STORAGE_KEYS.INVOICES))             lsSet(STORAGE_KEYS.INVOICES,             []);
  if (!lsGet(STORAGE_KEYS.KITCHEN_ORDERS))       lsSet(STORAGE_KEYS.KITCHEN_ORDERS,       []);
  if (!lsGet(STORAGE_KEYS.EXPENSES))             lsSet(STORAGE_KEYS.EXPENSES,             []);
  if (!lsGet(STORAGE_KEYS.DAILY_LOGS))           lsSet(STORAGE_KEYS.DAILY_LOGS,           []);
  if (!lsGet(STORAGE_KEYS.OWNERS))               lsSet(STORAGE_KEYS.OWNERS,               []);
  if (!lsGet(STORAGE_KEYS.DEPOSITS))             lsSet(STORAGE_KEYS.DEPOSITS,             []);
  if (!lsGet(STORAGE_KEYS.WALLET_TRANSACTIONS))  lsSet(STORAGE_KEYS.WALLET_TRANSACTIONS,  []);
  if (!lsGet(STORAGE_KEYS.SUBSCRIPTION_PLANS))   lsSet(STORAGE_KEYS.SUBSCRIPTION_PLANS,   []);
  if (!lsGet(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS))lsSet(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS,[]);
}
