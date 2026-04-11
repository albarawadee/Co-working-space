// === PART 1: Imports, Constants, Defaults, Utilities, Hooks, Primitive UI ===

// Section 1: Imports
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home, Users, UserPlus, Shield, Coffee, Wifi, Settings, LogOut,
  Clock, DollarSign, TrendingUp, TrendingDown, BarChart2, PieChart,
  Activity, Receipt, ShoppingCart, Package, Tag, Calendar,
  Search, Plus, Minus, Edit2, Trash2, X, Check,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle, XCircle, Info, Eye, EyeOff,
  RefreshCw, Filter, Star, Hash, User, Key, Bell,
  FileText, Archive, Layers, CreditCard, MoreVertical,
  Zap, Menu, ArrowRight, BookOpen
} from 'lucide-react';

// Section 2: Storage Keys
const STORAGE_KEYS = {
  STUDENTS: 'lib-students',
  SESSIONS: 'lib-sessions',
  INVOICES: 'lib-invoices',
  KITCHEN_ORDERS: 'lib-kitchen-orders',
  PRODUCTS: 'lib-products',
  CATEGORIES: 'lib-categories',
  EXPENSES: 'lib-expenses',
  STAFF: 'lib-staff',
  CONFIG: 'lib-config',
  PRICING: 'lib-pricing',
  DAILY_LOGS: 'lib-daily-logs',
};

// Section 3: Default Config & Pricing
const DEFAULT_CONFIG = {
  name: 'Smart Vision',
  capacity: 50,
  wifiName: 'Smart-Vision-WiFi',
  currency: 'ج.م',
  openTime: '08:00',
  closeTime: '24:00',
};

const DEFAULT_PRICING = {
  hourly: 15,
  halfDay: 50,
  halfDayHours: 5,
  fullDay: 80,
};

// Section 4: Default Staff
const DEFAULT_STAFF = [
  {
    id: 'staff-1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'المدير',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'staff-2',
    username: 'cashier1',
    password: 'cash123',
    role: 'cashier',
    name: 'أمين الصندوق',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'staff-3',
    username: 'kitchen1',
    password: 'kit123',
    role: 'kitchen',
    name: 'موظف المطبخ',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

// Section 5: Default Categories
const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'مشروبات ساخنة', emoji: '☕', color: 'teal' },
  { id: 'cat-2', name: 'مشروبات باردة', emoji: '🧊', color: 'blue' },
  { id: 'cat-3', name: 'وجبات خفيفة', emoji: '🥪', color: 'amber' },
  { id: 'cat-4', name: 'حلويات', emoji: '🍰', color: 'pink' },
];

// Section 6: Default Products
const DEFAULT_PRODUCTS = [
  { id: 'prod-1',  categoryId: 'cat-1', name: 'قهوة عربية',          price: 25, costPrice: 8,  available: true },
  { id: 'prod-2',  categoryId: 'cat-1', name: 'شاي بالنعناع',        price: 15, costPrice: 4,  available: true },
  { id: 'prod-3',  categoryId: 'cat-1', name: 'كابتشينو',            price: 35, costPrice: 12, available: true },
  { id: 'prod-4',  categoryId: 'cat-1', name: 'لاتيه',               price: 40, costPrice: 14, available: true },
  { id: 'prod-5',  categoryId: 'cat-1', name: 'شاي أخضر',            price: 15, costPrice: 4,  available: true },
  { id: 'prod-6',  categoryId: 'cat-2', name: 'عصير برتقال',         price: 20, costPrice: 7,  available: true },
  { id: 'prod-7',  categoryId: 'cat-2', name: 'عصير مانجو',          price: 25, costPrice: 9,  available: true },
  { id: 'prod-8',  categoryId: 'cat-3', name: 'ساندويتش جبنة',       price: 30, costPrice: 10, available: true },
  { id: 'prod-9',  categoryId: 'cat-4', name: 'كيك الشوكولاتة',      price: 25, costPrice: 8,  available: true },
  { id: 'prod-10', categoryId: 'cat-4', name: 'بسكويت شوكولاتة',     price: 15, costPrice: 5,  available: true },
];

// Section 7: Utility Functions
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateStudentId() {
  const students = window.storage.get(STORAGE_KEYS.STUDENTS) || [];
  const existing = new Set(students.map(s => s.studentId));
  let id;
  do {
    id = 'LIB-' + Math.floor(10000 + Math.random() * 90000);
  } while (existing.has(id));
  return id;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function calcElapsedMinutes(checkInTime) {
  return Math.floor((Date.now() - new Date(checkInTime).getTime()) / 60000);
}

function calcBestPrice(minutes, pricing) {
  const hours = minutes / 60;
  const hourlyTotal = Math.max(1, Math.ceil(hours)) * pricing.hourly;
  const halfDayTotal = pricing.halfDay;
  const fullDayTotal = pricing.fullDay;

  const options = [
    { type: 'hourly',  label: `أجر ساعي (${Math.max(1, Math.ceil(hours))} ساعة)`, amount: hourlyTotal },
    { type: 'halfDay', label: `نصف يوم (${pricing.halfDayHours} ساعات)`,            amount: halfDayTotal },
    { type: 'fullDay', label: 'يوم كامل',                                           amount: fullDayTotal },
  ];

  const best = options.reduce((min, opt) => opt.amount < min.amount ? opt : min, options[0]);
  return { options, best };
}

function logActivity(action, details, staffId = '') {
  const logs = window.storage.get(STORAGE_KEYS.DAILY_LOGS) || [];
  const newLog = {
    id: generateId('log'),
    action,
    details,
    staffId,
    timestamp: new Date().toISOString(),
  };
  const updated = [newLog, ...logs].slice(0, 500);
  window.storage.set(STORAGE_KEYS.DAILY_LOGS, updated);
}

function initializeDefaultData() {
  if (!window.storage.get(STORAGE_KEYS.CONFIG))         window.storage.set(STORAGE_KEYS.CONFIG,         DEFAULT_CONFIG);
  if (!window.storage.get(STORAGE_KEYS.PRICING))        window.storage.set(STORAGE_KEYS.PRICING,        DEFAULT_PRICING);
  if (!window.storage.get(STORAGE_KEYS.STAFF))          window.storage.set(STORAGE_KEYS.STAFF,          DEFAULT_STAFF);
  if (!window.storage.get(STORAGE_KEYS.CATEGORIES))     window.storage.set(STORAGE_KEYS.CATEGORIES,     DEFAULT_CATEGORIES);
  if (!window.storage.get(STORAGE_KEYS.PRODUCTS))       window.storage.set(STORAGE_KEYS.PRODUCTS,       DEFAULT_PRODUCTS);
  if (!window.storage.get(STORAGE_KEYS.STUDENTS))       window.storage.set(STORAGE_KEYS.STUDENTS,       []);
  if (!window.storage.get(STORAGE_KEYS.SESSIONS))       window.storage.set(STORAGE_KEYS.SESSIONS,       []);
  if (!window.storage.get(STORAGE_KEYS.INVOICES))       window.storage.set(STORAGE_KEYS.INVOICES,       []);
  if (!window.storage.get(STORAGE_KEYS.KITCHEN_ORDERS)) window.storage.set(STORAGE_KEYS.KITCHEN_ORDERS, []);
  if (!window.storage.get(STORAGE_KEYS.EXPENSES))       window.storage.set(STORAGE_KEYS.EXPENSES,       []);
  if (!window.storage.get(STORAGE_KEYS.DAILY_LOGS))     window.storage.set(STORAGE_KEYS.DAILY_LOGS,     []);
}

// Section 8: Custom Hooks
function useStorage(key, defaultValue) {
  const [data, setData] = useState(() => window.storage.get(key) ?? defaultValue);

  const save = useCallback((val) => {
    const next = typeof val === 'function' ? val(window.storage.get(key) ?? defaultValue) : val;
    window.storage.set(key, next);
    setData(next);
  }, [key]);

  const refresh = useCallback(() => setData(window.storage.get(key) ?? defaultValue), [key]);

  return [data, save, refresh];
}

function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type = 'info') => {
    const id = generateId('toast');
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return { toasts, toast };
}

function useLiveTimer(ms = 60000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

// Section 9: Primitive UI Components

// --- Modal ---
function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div
        className="modal-backdrop"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} flex flex-col max-h-[90vh]`}
          style={{ animation: 'slideUp 0.2s ease-out' }}
        >
          <div className="flex items-center justify-between p-5 border-b border-cream-200">
            <h2 className="text-lg font-semibold text-navy">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-cream-100 transition-colors duration-200 cursor-pointer text-navy-300 hover:text-navy"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <div className="p-5 border-t border-cream-200">{footer}</div>}
        </div>
      </div>
    </>
  );
}

// --- ToastContainer ---
function ToastContainer({ toasts }) {
  const colors = {
    success: 'bg-teal text-white',
    error:   'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
    info:    'bg-navy text-white',
  };

  return (
    <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2" style={{ direction: 'rtl' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-enter flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${colors[t.type] || colors.info}`}
        >
          {t.type === 'success' && <CheckCircle size={16} />}
          {t.type === 'error'   && <XCircle size={16} />}
          {t.type === 'warning' && <AlertCircle size={16} />}
          {t.type === 'info'    && <Info size={16} />}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// --- Input ---
function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700">{label}</label>}
      <input
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none
          ${error
            ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-200'
            : 'border-cream-300 bg-white focus:border-gold focus:ring-2 focus:ring-gold/20'}
          text-navy placeholder:text-navy-300`}
        {...props}
      />
      {error && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} />{error}
        </span>
      )}
    </div>
  );
}

// --- Select ---
function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700">{label}</label>}
      <select
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none cursor-pointer
          ${error
            ? 'border-red-400 bg-red-50'
            : 'border-cream-300 bg-white focus:border-gold focus:ring-2 focus:ring-gold/20'}
          text-navy`}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} />{error}
        </span>
      )}
    </div>
  );
}

// --- Textarea ---
function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700">{label}</label>}
      <textarea
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none resize-none
          ${error
            ? 'border-red-400 bg-red-50'
            : 'border-cream-300 bg-white focus:border-gold focus:ring-2 focus:ring-gold/20'}
          text-navy placeholder:text-navy-300`}
        rows={3}
        {...props}
      />
      {error && (
        <span className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} />{error}
        </span>
      )}
    </div>
  );
}

// --- StatCard ---
function StatCard({ title, value, subtitle, icon: Icon, color = 'navy', trend }) {
  const colors = {
    navy:  'bg-navy text-white',
    gold:  'bg-gold text-white',
    teal:  'bg-teal text-white',
    cream: 'bg-cream-100 text-navy',
    red:   'bg-red-500 text-white',
    amber: 'bg-amber-500 text-white',
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 card-lift">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-navy-400 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-navy">{value}</p>
          {subtitle && <p className="text-xs text-navy-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-teal' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Badge ---
function Badge({ children, variant = 'navy' }) {
  const variants = {
    green:  'bg-teal-50 text-teal-700 border border-teal-200',
    teal:   'bg-teal-50 text-teal-700 border border-teal-200',
    amber:  'bg-amber-50 text-amber-700 border border-amber-200',
    red:    'bg-red-50 text-red-600 border border-red-200',
    navy:   'bg-navy-50 text-navy border border-navy-100',
    gold:   'bg-amber-50 text-amber-700 border border-amber-200',
    gray:   'bg-gray-100 text-gray-600 border border-gray-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.navy}`}>
      {children}
    </span>
  );
}

// --- Skeleton ---
function Skeleton({ className = '', lines = 1 }) {
  if (lines > 1) return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 rounded-lg"
          style={{ width: `${60 + Math.random() * 40}%` }}
        />
      ))}
    </div>
  );
  return <div className={`skeleton ${className}`} />;
}

// --- SearchInput ---
function SearchInput({ value, onChange, placeholder = 'بحث…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-9 pl-3.5 py-2.5 rounded-xl border border-cream-300 bg-white text-sm text-navy placeholder:text-navy-300 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition-all duration-200"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy cursor-pointer transition-colors duration-200"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// --- ConfirmDialog ---
function ConfirmDialog({ open, onClose, onConfirm, title, message, variant = 'danger' }) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer"
          >
            إلغاء
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors duration-200 cursor-pointer
              ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal hover:bg-teal-600'}`}
          >
            تأكيد
          </button>
        </div>
      }
    >
      <p className="text-navy-600 text-sm">{message}</p>
    </Modal>
  );
}

// === END PART 1 ===

// ============================================================
// CHART COMPONENTS
// ============================================================

function WeeklyBarChart({ data, currency = 'ج.م' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-36 w-full pt-4">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <span className="text-[10px] text-navy-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {d.value > 0 ? `${d.value.toLocaleString('en-US')}` : ''}
          </span>
          <div
            className="bar-chart-bar w-full bg-navy-200 group-hover:bg-gold cursor-default rounded-t"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value.toLocaleString('en-US')} ${currency}`}
          />
          <span className="text-[10px] text-navy-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function SVGRingChart({ segments, size = 130, centerLabel = '' }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 44;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let accumulated = 0;
  const arcs = segments.map(seg => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const arc = { ...seg, dash, gap: circumference - dash, offset: -accumulated, pct };
    accumulated += dash;
    return arc;
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eeece6" strokeWidth="16" />
          {arcs.map((arc, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth="16"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="round" />
          ))}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'none' }}>
            <span className="text-xs font-bold text-navy">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-navy-600">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="font-semibold text-navy">({Math.round(seg.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBarChart({ items, currency = 'ج.م' }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-navy-600 font-medium truncate max-w-[60%]">{item.label}</span>
            <span className="text-navy font-semibold">{Number(item.value).toLocaleString('en-US')} {currency}</span>
          </div>
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color || '#1a1f3d' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleLineChart({ points, color = '#2d9f93', height = 72 }) {
  if (!points || points.length < 2) {
    return <div className="flex items-center justify-center text-xs text-navy-400" style={{ height }}>لا توجد بيانات كافية</div>;
  }
  const W = 300; const H = height;
  const pad = 6;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (p - min) / range) * (H - pad * 2);
    return [x, y];
  });
  const polyline = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${pad},${H - pad} ${polyline} ${W - pad},${H - pad}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`lg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#lg${color.replace('#','')})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


// ============================================================
// ADMIN VIEWS
// ============================================================

function AdminDashboard({ user, config, toast }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [orders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [logs] = useStorage(STORAGE_KEYS.DAILY_LOGS, []);
  const tick = useLiveTimer(60000);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const todayInvoices = invoices.filter(inv => inv.createdAt && inv.createdAt.slice(0, 10) === todayStr);
  const todayRevenue = todayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.slice(0, 10) === todayStr);

  // Weekly revenue (last 7 days)
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    const val = invoices.filter(inv => inv.createdAt && inv.createdAt.slice(0, 10) === ds)
      .reduce((s, inv) => s + (inv.total || 0), 0);
    return { label: dayNames[d.getDay()].slice(0, 3), value: val };
  });

  // Long sessions (> 5 hours)
  const longSessions = activeSessions.filter(s => calcElapsedMinutes(s.checkInTime) > 300);

  const recentLogs = logs.slice(0, 12);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">لوحة التحكم</h1>
          <p className="text-sm text-navy-400 mt-0.5">مرحباً، {user.name} · {new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-xl px-3 py-2">
          <div className="live-dot" />
          <span className="text-xs text-navy-500 font-medium">{activeSessions.length} جلسة نشطة</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="الطلاب الحاليون" value={activeSessions.length} subtitle={`من أصل ${config.capacity} مقعد`} icon={Users} color="navy" />
        <StatCard title="إيرادات اليوم" value={`${todayRevenue.toLocaleString('en-US')} ${config.currency}`} subtitle={`${todayInvoices.length} فاتورة`} icon={DollarSign} color="gold" />
        <StatCard title="طلبات المطبخ" value={todayOrders.length} subtitle="اليوم" icon={Coffee} color="teal" />
        <StatCard title="إجمالي الطلاب" value={students.length} subtitle="مسجل" icon={BookOpen} color="cream" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy">الإيرادات الأسبوعية</h2>
            <span className="text-xs text-navy-400">آخر 7 أيام</span>
          </div>
          <WeeklyBarChart data={weekData} currency={config.currency} />
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 flex flex-col">
          <h2 className="font-semibold text-navy mb-3">آخر النشاطات</h2>
          {recentLogs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-navy-400">لا توجد نشاطات بعد</div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2.5 py-1.5 border-b border-cream-100 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{log.action}</p>
                    <p className="text-[11px] text-navy-400 truncate">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-navy-300 whitespace-nowrap flex-shrink-0">{formatTime(log.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {longSessions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-600" />
            <h3 className="font-semibold text-amber-800">جلسات طويلة ({longSessions.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {longSessions.map(s => {
              const mins = calcElapsedMinutes(s.checkInTime);
              const hrs = Math.floor(mins / 60);
              const m = mins % 60;
              return (
                <div key={s.id} className="bg-amber-100 border border-amber-300 rounded-xl px-3 py-1.5 text-xs">
                  <span className="font-semibold text-amber-900">{s.studentName}</span>
                  <span className="text-amber-700 mr-1">— {hrs}h {m}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Capacity alert */}
      {activeSessions.length >= config.capacity * 0.9 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            تحذير: المكتبة تقترب من الطاقة الاستيعابية القصوى ({activeSessions.length}/{config.capacity} مقعد)
          </p>
        </div>
      )}
    </div>
  );
}


function AdminStudents({ user, config, toast }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', tags: '', notes: '' });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
  }, [students, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', tags: '', notes: '' });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', tags: (s.tags || []).join(', '), notes: s.notes || '' });
    setErrors({});
    setShowForm(true);
  };

  const openProfile = (s) => {
    setSelected(s);
    setShowProfile(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editing) {
      const updated = students.map(s => s.id === editing.id ? { ...s, ...form, tags } : s);
      saveStudents(updated);
      logActivity('تعديل طالب', `${form.name}`, user.id);
      toast('تم تعديل بيانات الطالب', 'success');
    } else {
      const newStudent = {
        id: generateId('stu'),
        studentId: generateStudentId(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        tags,
        notes: form.notes.trim(),
        createdAt: new Date().toISOString(),
      };
      saveStudents([...students, newStudent]);
      logActivity('إضافة طالب', `${newStudent.name} — ${newStudent.studentId}`, user.id);
      toast('تمت إضافة الطالب بنجاح', 'success');
    }
    setShowForm(false);
  };

  const handleDelete = (s) => {
    saveStudents(students.filter(st => st.id !== s.id));
    logActivity('حذف طالب', s.name, user.id);
    toast('تم حذف الطالب', 'info');
  };

  const getStudentStats = (s) => {
    const stuSessions = sessions.filter(ses => ses.studentId === s.id);
    const stuInvoices = invoices.filter(inv => inv.studentId === s.id);
    const totalSpend = stuInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    return { sessionsCount: stuSessions.length, totalSpend, lastVisit: stuSessions[stuSessions.length - 1]?.checkInTime };
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">إدارة الطلاب</h1>
        <button onClick={openAdd} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
          <Plus size={16} /><span>إضافة طالب</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cream-200">
        <div className="p-4 border-b border-cream-100">
          <div className="flex items-center gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود أو الهاتف…" className="flex-1" />
            <span className="text-sm text-navy-400">{filtered.length} طالب</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-cream-50 text-navy-500 text-xs uppercase">
                <th className="px-4 py-3 text-right font-semibold">الكود</th>
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
                <th className="px-4 py-3 text-right font-semibold">تاريخ التسجيل</th>
                <th className="px-4 py-3 text-right font-semibold">الوسوم</th>
                <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-navy-400">لا توجد نتائج</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                  <td className="px-4 py-3"><code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded font-mono">{s.studentId}</code></td>
                  <td className="px-4 py-3">
                    <button onClick={() => openProfile(s)} className="font-medium text-navy hover:text-gold transition-colors duration-200 cursor-pointer">{s.name}</button>
                  </td>
                  <td className="px-4 py-3 text-navy-600">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-navy-400">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(s.tags || []).slice(0, 3).map((t, i) => <Badge key={i} variant="navy">{t}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold transition-colors duration-200 cursor-pointer"><Edit2 size={14} /></button>
                      <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 transition-colors duration-200 cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer">إلغاء</button>
            <button onClick={handleSave} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ</button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="الاسم الكامل *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} error={errors.name} placeholder="أدخل اسم الطالب" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="رقم الهاتف" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="01xxxxxxxxx" />
            <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="example@email.com" type="email" />
          </div>
          <Input label="الوسوم (مفصولة بفاصلة)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="طالب جامعي, صباحي" />
          <Textarea label="ملاحظات" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="أي ملاحظات إضافية…" />
        </div>
      </Modal>

      {/* Profile Modal */}
      {selected && (() => {
        const stats = getStudentStats(selected);
        const stuInvoices = invoices.filter(inv => inv.studentId === selected.id).slice(0, 10);
        return (
          <Modal open={showProfile} onClose={() => setShowProfile(false)} title="ملف الطالب" size="lg">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-navy flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {selected.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-navy">{selected.name}</h3>
                  <code className="text-xs text-navy-400">{selected.studentId}</code>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(selected.tags || []).map((t, i) => <Badge key={i} variant="gold">{t}</Badge>)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cream-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-navy">{stats.sessionsCount}</p>
                  <p className="text-xs text-navy-400 mt-1">جلسة</p>
                </div>
                <div className="bg-cream-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gold">{stats.totalSpend.toLocaleString('en-US')}</p>
                  <p className="text-xs text-navy-400 mt-1">{config.currency} إجمالي</p>
                </div>
                <div className="bg-cream-50 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-navy">{stats.lastVisit ? formatDate(stats.lastVisit) : '—'}</p>
                  <p className="text-xs text-navy-400 mt-1">آخر زيارة</p>
                </div>
              </div>
              {stuInvoices.length > 0 && (
                <div>
                  <h4 className="font-semibold text-navy mb-2 text-sm">آخر الفواتير</h4>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {stuInvoices.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center bg-cream-50 rounded-xl px-3 py-2 text-xs">
                        <span className="text-navy-500">{formatDate(inv.createdAt)}</span>
                        <Badge variant={inv.priceType === 'fullDay' ? 'navy' : inv.priceType === 'halfDay' ? 'teal' : 'gold'}>
                          {inv.priceType === 'fullDay' ? 'يوم كامل' : inv.priceType === 'halfDay' ? 'نصف يوم' : 'ساعي'}
                        </Badge>
                        <span className="font-semibold text-navy">{(inv.total || 0).toLocaleString('en-US')} {config.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-800"><span className="font-semibold">ملاحظات: </span>{selected.notes}</p>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="حذف الطالب" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟ لا يمكن التراجع.`} />
    </div>
  );
}


function AdminStaff({ user, config, toast }) {
  const [staff, saveStaff] = useStorage(STORAGE_KEYS.STAFF, []);
  const [logs] = useStorage(STORAGE_KEYS.DAILY_LOGS, []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'cashier', active: true });
  const [errors, setErrors] = useState({});

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', username: '', password: '', role: 'cashier', active: true });
    setErrors({});
    setShowPwd(false);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, username: s.username, password: s.password, role: s.role, active: s.active });
    setErrors({});
    setShowPwd(false);
    setShowForm(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    if (!form.username.trim()) e.username = 'اسم المستخدم مطلوب';
    if (!editing && !form.password.trim()) e.password = 'كلمة المرور مطلوبة';
    if (!editing && staff.some(s => s.username === form.username.trim())) e.username = 'اسم المستخدم مستخدم بالفعل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      const updated = staff.map(s => s.id === editing.id ? {
        ...s, name: form.name.trim(), username: form.username.trim(),
        password: form.password || s.password, role: form.role, active: form.active
      } : s);
      saveStaff(updated);
      logActivity('تعديل موظف', form.name, user.id);
      toast('تم تعديل بيانات الموظف', 'success');
    } else {
      const newStaff = {
        id: generateId('stf'), name: form.name.trim(), username: form.username.trim(),
        password: form.password, role: form.role, active: true, createdAt: new Date().toISOString()
      };
      saveStaff([...staff, newStaff]);
      logActivity('إضافة موظف', `${form.name} (${form.role})`, user.id);
      toast('تمت إضافة الموظف', 'success');
    }
    setShowForm(false);
  };

  const handleDelete = (s) => {
    saveStaff(staff.filter(st => st.id !== s.id));
    logActivity('حذف موظف', s.name, user.id);
    toast('تم حذف الموظف', 'info');
  };

  const toggleActive = (s) => {
    const updated = staff.map(st => st.id === s.id ? { ...st, active: !st.active } : st);
    saveStaff(updated);
    toast(s.active ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب', 'info');
  };

  const roleLabel = { admin: 'مدير', cashier: 'كاشير', kitchen: 'مطبخ' };
  const roleBadge = { admin: 'navy', cashier: 'teal', kitchen: 'amber' };

  const getLastActivity = (staffId) => {
    const log = logs.find(l => l.staffId === staffId);
    return log ? formatDateTime(log.timestamp) : '—';
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">إدارة الموظفين</h1>
        <button onClick={openAdd} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
          <Plus size={16} /><span>إضافة موظف</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 text-navy-500 text-xs uppercase">
              <th className="px-4 py-3 text-right font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right font-semibold">اسم المستخدم</th>
              <th className="px-4 py-3 text-right font-semibold">الدور</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">آخر نشاط</th>
              <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                <td className="px-4 py-3 font-medium text-navy">{s.name}</td>
                <td className="px-4 py-3"><code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">{s.username}</code></td>
                <td className="px-4 py-3"><Badge variant={roleBadge[s.role] || 'navy'}>{roleLabel[s.role] || s.role}</Badge></td>
                <td className="px-4 py-3">
                  <button onClick={() => s.id !== user.id && toggleActive(s)}
                    className={`cursor-pointer ${s.id === user.id ? 'cursor-default opacity-60' : ''}`}>
                    <Badge variant={s.active ? 'green' : 'gray'}>{s.active ? 'نشط' : 'معطل'}</Badge>
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-navy-400">{getLastActivity(s.id)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold transition-colors duration-200 cursor-pointer"><Edit2 size={14} /></button>
                    {s.id !== user.id && s.role !== 'admin' && (
                      <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 transition-colors duration-200 cursor-pointer"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer">إلغاء</button>
            <button onClick={handleSave} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ</button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الاسم الكامل *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} error={errors.name} placeholder="اسم الموظف" />
            <Input label="اسم المستخدم *" value={form.username} onChange={e => setForm({...form, username: e.target.value})} error={errors.username} placeholder="username" />
          </div>
          <div className="relative">
            <Input label={editing ? 'كلمة المرور (اتركها فارغة للإبقاء)' : 'كلمة المرور *'}
              type={showPwd ? 'text' : 'password'}
              value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              error={errors.password} placeholder="••••••••" />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute left-3 top-8 text-navy-400 hover:text-navy transition-colors cursor-pointer">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Select label="الدور" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            {editing?.role === 'admin' && <option value="admin">مدير</option>}
            <option value="cashier">كاشير</option>
            <option value="kitchen">مطبخ</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="حذف الموظف" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟`} />
    </div>
  );
}


function AdminPricing({ user, config, toast }) {
  const [pricing, savePricing] = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [form, setForm] = useState({ hourly: pricing.hourly, halfDay: pricing.halfDay, halfDayHours: pricing.halfDayHours, fullDay: pricing.fullDay });
  const [offers, setOffers] = useState(() => pricing.specialOffers || []);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({ label: '', price: '', durationMinutes: '', active: true });

  const handleSavePricing = () => {
    const updated = { hourly: Number(form.hourly), halfDay: Number(form.halfDay), halfDayHours: Number(form.halfDayHours), fullDay: Number(form.fullDay), specialOffers: offers };
    savePricing(updated);
    logActivity('تعديل الأسعار', `ساعي: ${form.hourly} | نصف يوم: ${form.halfDay} | يوم: ${form.fullDay}`, user.id);
    toast('تم حفظ الأسعار', 'success');
  };

  const openAddOffer = () => {
    setEditingOffer(null);
    setOfferForm({ label: '', price: '', durationMinutes: '', active: true });
    setShowOfferForm(true);
  };

  const openEditOffer = (o) => {
    setEditingOffer(o);
    setOfferForm({ label: o.label, price: o.price, durationMinutes: o.durationMinutes, active: o.active });
    setShowOfferForm(true);
  };

  const handleSaveOffer = () => {
    if (!offerForm.label.trim() || !offerForm.price) return;
    if (editingOffer) {
      setOffers(offers.map(o => o.id === editingOffer.id ? { ...o, ...offerForm, price: Number(offerForm.price), durationMinutes: Number(offerForm.durationMinutes) } : o));
    } else {
      setOffers([...offers, { id: generateId('offer'), ...offerForm, price: Number(offerForm.price), durationMinutes: Number(offerForm.durationMinutes) }]);
    }
    setShowOfferForm(false);
  };

  const deleteOffer = (id) => setOffers(offers.filter(o => o.id !== id));
  const toggleOffer = (id) => setOffers(offers.map(o => o.id === id ? { ...o, active: !o.active } : o));

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">إدارة الأسعار</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pricing Form */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 space-y-4">
          <h2 className="font-semibold text-navy">تسعيرة الجلسات</h2>
          <Input label={`السعر بالساعة (${config.currency})`} type="number" min="0" value={form.hourly} onChange={e => setForm({...form, hourly: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={`نصف يوم — السعر (${config.currency})`} type="number" min="0" value={form.halfDay} onChange={e => setForm({...form, halfDay: e.target.value})} />
            <Input label="نصف يوم — عدد الساعات" type="number" min="1" value={form.halfDayHours} onChange={e => setForm({...form, halfDayHours: e.target.value})} />
          </div>
          <Input label={`يوم كامل — السعر (${config.currency})`} type="number" min="0" value={form.fullDay} onChange={e => setForm({...form, fullDay: e.target.value})} />
          <button onClick={handleSavePricing} className="w-full bg-navy hover:bg-navy-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ الأسعار</button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">معاينة التسعيرة</h2>
            <div className="space-y-3">
              {[
                { label: 'بالساعة', sublabel: `كل ساعة أو جزء منها`, price: form.hourly, unit: `${config.currency}/ساعة`, badge: 'gold' },
                { label: 'نصف يوم', sublabel: `حتى ${form.halfDayHours} ساعات`, price: form.halfDay, unit: config.currency, badge: 'teal' },
                { label: 'يوم كامل', sublabel: 'طوال اليوم', price: form.fullDay, unit: config.currency, badge: 'navy' },
              ].map((tier, i) => (
                <div key={i} className="flex items-center justify-between bg-cream-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold text-navy text-sm">{tier.label}</p>
                    <p className="text-xs text-navy-400">{tier.sublabel}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-xl font-bold text-navy">{Number(tier.price).toLocaleString('en-US')}</span>
                    <span className="text-xs text-navy-400 mr-1">{tier.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Special Offers */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy">العروض الخاصة</h2>
          <button onClick={openAddOffer} className="bg-gold hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5">
            <Plus size={13} /><span>إضافة عرض</span>
          </button>
        </div>
        {offers.length === 0 ? (
          <div className="text-center py-8 text-navy-400 text-sm">لا توجد عروض خاصة</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offers.map(o => (
              <div key={o.id} className={`rounded-xl border p-3 transition-all duration-200 ${o.active ? 'border-gold-200 bg-amber-50' : 'border-cream-200 bg-cream-50 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-navy text-sm">{o.label}</p>
                    <p className="text-lg font-bold text-gold mt-1">{o.price} {config.currency}</p>
                    {o.durationMinutes > 0 && <p className="text-xs text-navy-400">{Math.round(o.durationMinutes / 60)} ساعة</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleOffer(o.id)} className="p-1 rounded text-navy-400 hover:text-teal transition-colors cursor-pointer">
                      {o.active ? <CheckCircle size={14} className="text-teal" /> : <XCircle size={14} />}
                    </button>
                    <button onClick={() => openEditOffer(o)} className="p-1 rounded text-navy-400 hover:text-gold transition-colors cursor-pointer"><Edit2 size={14} /></button>
                    <button onClick={() => deleteOffer(o.id)} className="p-1 rounded text-navy-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showOfferForm} onClose={() => setShowOfferForm(false)} title={editingOffer ? 'تعديل العرض' : 'إضافة عرض خاص'} size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowOfferForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer">إلغاء</button>
            <button onClick={handleSaveOffer} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ</button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="اسم العرض" value={offerForm.label} onChange={e => setOfferForm({...offerForm, label: e.target.value})} placeholder="مثال: عرض الطالب" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`السعر (${config.currency})`} type="number" min="0" value={offerForm.price} onChange={e => setOfferForm({...offerForm, price: e.target.value})} />
            <Input label="المدة (بالدقائق)" type="number" min="0" value={offerForm.durationMinutes} onChange={e => setOfferForm({...offerForm, durationMinutes: e.target.value})} placeholder="0 = غير محدد" />
          </div>
        </div>
      </Modal>
    </div>
  );
}


function AdminProducts({ user, config, toast }) {
  const [categories, saveCategories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [products, saveProducts] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [selectedCat, setSelectedCat] = useState(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editingProd, setEditingProd] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', emoji: '📦', color: 'teal' });
  const [prodForm, setProdForm] = useState({ name: '', categoryId: '', price: '', costPrice: '' });
  const [errors, setErrors] = useState({});

  const filteredProducts = useMemo(() =>
    selectedCat ? products.filter(p => p.categoryId === selectedCat) : products,
    [products, selectedCat]
  );

  const openAddCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', emoji: '📦', color: 'teal' });
    setShowCatForm(true);
  };

  const openEditCat = (c) => {
    setEditingCat(c);
    setCatForm({ name: c.name, emoji: c.emoji, color: c.color });
    setShowCatForm(true);
  };

  const saveCat = () => {
    if (!catForm.name.trim()) return;
    if (editingCat) {
      saveCategories(categories.map(c => c.id === editingCat.id ? { ...c, ...catForm } : c));
      toast('تم تعديل الفئة', 'success');
    } else {
      saveCategories([...categories, { id: generateId('cat'), ...catForm }]);
      toast('تمت إضافة الفئة', 'success');
    }
    setShowCatForm(false);
  };

  const deleteCat = (c) => {
    saveCategories(categories.filter(cat => cat.id !== c.id));
    saveProducts(products.filter(p => p.categoryId !== c.id));
    if (selectedCat === c.id) setSelectedCat(null);
    toast('تم حذف الفئة ومنتجاتها', 'info');
  };

  const openAddProd = () => {
    setEditingProd(null);
    setProdForm({ name: '', categoryId: selectedCat || (categories[0]?.id || ''), price: '', costPrice: '' });
    setErrors({});
    setShowProdForm(true);
  };

  const openEditProd = (p) => {
    setEditingProd(p);
    setProdForm({ name: p.name, categoryId: p.categoryId, price: p.price, costPrice: p.costPrice || '' });
    setErrors({});
    setShowProdForm(true);
  };

  const saveProd = () => {
    const e = {};
    if (!prodForm.name.trim()) e.name = 'الاسم مطلوب';
    if (!prodForm.price) e.price = 'السعر مطلوب';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    if (editingProd) {
      saveProducts(products.map(p => p.id === editingProd.id ? { ...p, ...prodForm, price: Number(prodForm.price), costPrice: Number(prodForm.costPrice) || 0 } : p));
      toast('تم تعديل المنتج', 'success');
    } else {
      saveProducts([...products, { id: generateId('prod'), ...prodForm, price: Number(prodForm.price), costPrice: Number(prodForm.costPrice) || 0, available: true }]);
      toast('تمت إضافة المنتج', 'success');
    }
    setShowProdForm(false);
  };

  const deleteProd = (p) => {
    saveProducts(products.filter(pr => pr.id !== p.id));
    toast('تم حذف المنتج', 'info');
  };

  const toggleAvailable = (p) => {
    saveProducts(products.map(pr => pr.id === p.id ? { ...pr, available: !pr.available } : pr));
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">إدارة المنتجات</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Categories Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-cream-100">
            <h2 className="font-semibold text-navy text-sm">الفئات</h2>
            <button onClick={openAddCat} className="p-1.5 rounded-lg bg-navy hover:bg-navy-600 text-white transition-colors duration-200 cursor-pointer"><Plus size={14} /></button>
          </div>
          <div className="flex flex-col p-2 gap-1">
            <button onClick={() => setSelectedCat(null)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer text-right
                ${!selectedCat ? 'bg-navy text-white' : 'hover:bg-cream-100 text-navy-600'}`}>
              <Package size={15} />
              <span>الكل ({products.length})</span>
            </button>
            {categories.map(c => (
              <div key={c.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-200 cursor-pointer
                ${selectedCat === c.id ? 'bg-navy text-white' : 'hover:bg-cream-100 text-navy-600'}`}
                onClick={() => setSelectedCat(c.id)}>
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{c.emoji}</span>
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs opacity-60">({products.filter(p => p.categoryId === c.id).length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); openEditCat(c); }} className="p-1 rounded hover:bg-white/20 cursor-pointer"><Edit2 size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'cat', item: c }); }} className="p-1 rounded hover:bg-white/20 cursor-pointer"><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Products Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-cream-200">
          <div className="flex items-center justify-between p-4 border-b border-cream-100">
            <h2 className="font-semibold text-navy text-sm">
              {selectedCat ? categories.find(c => c.id === selectedCat)?.name : 'جميع المنتجات'}
              <span className="text-navy-400 font-normal mr-2">({filteredProducts.length})</span>
            </h2>
            <button onClick={openAddProd} disabled={categories.length === 0}
              className="bg-navy hover:bg-navy-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={13} /><span>إضافة</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 text-navy-500 text-xs">
                  <th className="px-4 py-2.5 text-right font-semibold">المنتج</th>
                  <th className="px-4 py-2.5 text-right font-semibold">السعر</th>
                  <th className="px-4 py-2.5 text-right font-semibold">التكلفة</th>
                  <th className="px-4 py-2.5 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-2.5 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-navy-400 text-sm">لا توجد منتجات</td></tr>
                ) : filteredProducts.map(p => {
                  const cat = categories.find(c => c.id === p.categoryId);
                  return (
                    <tr key={p.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-navy">{p.name}</p>
                          {cat && <p className="text-xs text-navy-400">{cat.emoji} {cat.name}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-navy">{p.price} {config.currency}</td>
                      <td className="px-4 py-3 text-navy-400">{p.costPrice ? `${p.costPrice} ${config.currency}` : '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleAvailable(p)} className="cursor-pointer">
                          <Badge variant={p.available ? 'green' : 'red'}>{p.available ? 'متاح' : 'غير متاح'}</Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditProd(p)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold transition-colors duration-200 cursor-pointer"><Edit2 size={13} /></button>
                          <button onClick={() => setConfirmDelete({ type: 'prod', item: p })} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 transition-colors duration-200 cursor-pointer"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      <Modal open={showCatForm} onClose={() => setShowCatForm(false)} title={editingCat ? 'تعديل الفئة' : 'إضافة فئة'} size="sm"
        footer={<div className="flex gap-3 justify-end"><button onClick={() => setShowCatForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={saveCat} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-3">
          <Input label="اسم الفئة" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} placeholder="اسم الفئة" />
          <Input label="الإيموجي" value={catForm.emoji} onChange={e => setCatForm({...catForm, emoji: e.target.value})} placeholder="☕" />
        </div>
      </Modal>

      {/* Product Modal */}
      <Modal open={showProdForm} onClose={() => setShowProdForm(false)} title={editingProd ? 'تعديل المنتج' : 'إضافة منتج'}
        footer={<div className="flex gap-3 justify-end"><button onClick={() => setShowProdForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={saveProd} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-4">
          <Input label="اسم المنتج *" value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} error={errors.name} placeholder="اسم المنتج" />
          <Select label="الفئة" value={prodForm.categoryId} onChange={e => setProdForm({...prodForm, categoryId: e.target.value})}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={`سعر البيع (${config.currency}) *`} type="number" min="0" value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})} error={errors.price} />
            <Input label={`سعر التكلفة (${config.currency})`} type="number" min="0" value={prodForm.costPrice} onChange={e => setProdForm({...prodForm, costPrice: e.target.value})} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete?.type === 'cat') deleteCat(confirmDelete.item); else deleteProd(confirmDelete.item); }}
        title="تأكيد الحذف" message={`هل أنت متأكد من حذف "${confirmDelete?.item?.name}"؟`} />
    </div>
  );
}


function AdminExpenses({ user, config, toast }) {
  const [expenses, saveExpenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ category: 'أخرى', description: '', amount: '', date: now.toISOString().slice(0,10) });
  const [errors, setErrors] = useState({});

  const EXP_CATS = ['إيجار','مستلزمات','رواتب','صيانة','كهرباء','إنترنت','أخرى'];

  const monthExpenses = useMemo(() =>
    expenses.filter(e => e.date && e.date.startsWith(monthKey))
      .sort((a,b) => b.date.localeCompare(a.date)),
    [expenses, monthKey]
  );

  const totalExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const maxExpense = monthExpenses.reduce((max, e) => e.amount > max.amount ? e : max, { amount: 0, category: '—' });

  const catTotals = EXP_CATS.map(cat => ({
    label: cat,
    value: monthExpenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
    color: '#1a1f3d'
  })).filter(c => c.value > 0);

  const openAdd = () => {
    setEditing(null);
    setForm({ category: 'أخرى', description: '', amount: '', date: now.toISOString().slice(0,10) });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({ category: e.category, description: e.description, amount: e.amount, date: e.date });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = 'الوصف مطلوب';
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'المبلغ مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      saveExpenses(expenses.map(e => e.id === editing.id ? { ...e, ...form, amount: Number(form.amount) } : e));
      toast('تم تعديل المصروف', 'success');
    } else {
      const newExp = { id: generateId('exp'), ...form, amount: Number(form.amount), createdAt: new Date().toISOString() };
      saveExpenses([...expenses, newExp]);
      logActivity('إضافة مصروف', `${form.category}: ${form.amount} ${config.currency}`, user.id);
      toast('تمت إضافة المصروف', 'success');
    }
    setShowForm(false);
  };

  // Month navigation
  const changeMonth = (dir) => {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('ar-EG', { year:'numeric', month:'long' });

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">المصروفات</h1>
        <button onClick={openAdd} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
          <Plus size={16} /><span>إضافة مصروف</span>
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-cream-200 w-fit">
        <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronRight size={16} /></button>
        <span className="font-semibold text-navy px-2 min-w-[140px] text-center">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronLeft size={16} /></button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="إجمالي المصروفات" value={`${totalExpenses.toLocaleString('en-US')} ${config.currency}`} subtitle={`${monthExpenses.length} معاملة`} icon={Receipt} color="red" />
        <StatCard title="أكبر بند" value={`${maxExpense.amount.toLocaleString('en-US')} ${config.currency}`} subtitle={maxExpense.category} icon={TrendingUp} color="amber" />
        <StatCard title="عدد المعاملات" value={monthExpenses.length} subtitle="هذا الشهر" icon={FileText} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* By Category Chart */}
        {catTotals.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">المصروفات حسب الفئة</h2>
            <HorizontalBarChart items={catTotals} currency={config.currency} />
          </div>
        )}

        {/* Expenses Table */}
        <div className={`bg-white rounded-2xl shadow-sm border border-cream-200 ${catTotals.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 text-navy-500 text-xs uppercase">
                  <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                  <th className="px-4 py-3 text-right font-semibold">الفئة</th>
                  <th className="px-4 py-3 text-right font-semibold">الوصف</th>
                  <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {monthExpenses.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-navy-400">لا توجد مصروفات لهذا الشهر</td></tr>
                ) : monthExpenses.map(e => (
                  <tr key={e.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                    <td className="px-4 py-3 text-navy-500">{e.date}</td>
                    <td className="px-4 py-3"><Badge variant="navy">{e.category}</Badge></td>
                    <td className="px-4 py-3 text-navy">{e.description}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{e.amount.toLocaleString('en-US')} {config.currency}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold cursor-pointer transition-colors duration-200"><Edit2 size={13} /></button>
                        <button onClick={() => setConfirmDelete(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors duration-200"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'تعديل المصروف' : 'إضافة مصروف'}
        footer={<div className="flex gap-3 justify-end"><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={handleSave} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="الفئة" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <Input label="الوصف *" value={form.description} onChange={e => setForm({...form, description: e.target.value})} error={errors.description} placeholder="وصف المصروف" />
          <Input label={`المبلغ (${config.currency}) *`} type="number" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} error={errors.amount} />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={() => { saveExpenses(expenses.filter(e => e.id !== confirmDelete.id)); toast('تم الحذف', 'info'); }}
        title="حذف المصروف" message={`هل تريد حذف "${confirmDelete?.description}"؟`} />
    </div>
  );
}


function AdminReports({ user, config, toast }) {
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [orders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [expenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [products] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);

  const changeMonth = (dir) => {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  };

  const monthInvoices = invoices.filter(inv => inv.createdAt && inv.createdAt.startsWith(monthKey));
  const monthOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(monthKey));
  const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(monthKey));

  const sessionRevenue = monthInvoices.reduce((s, inv) => s + (inv.amount || 0), 0);
  const kitchenRevenue = monthInvoices.reduce((s, inv) => s + (inv.kitchenTotal || 0), 0);
  const totalRevenue = monthInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const totalExpenses = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;

  // Top 5 students by spending
  const studentSpend = {};
  monthInvoices.forEach(inv => {
    studentSpend[inv.studentId] = (studentSpend[inv.studentId] || 0) + (inv.total || 0);
  });
  const topStudents = Object.entries(studentSpend)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, val]) => {
      const s = students.find(st => st.id === id);
      return { label: s ? s.name : 'غير معروف', value: val, color: '#c9a84c' };
    });

  // Top products by qty
  const productQty = {};
  monthOrders.forEach(o => {
    (o.items || []).forEach(item => {
      productQty[item.productId] = (productQty[item.productId] || 0) + (item.qty || 1);
    });
  });
  const topProducts = Object.entries(productQty)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => {
      const p = products.find(pr => pr.id === id);
      return { label: p ? p.name : 'غير معروف', value: qty * (p?.price || 0), color: '#2d9f93' };
    });

  // Daily revenue line chart (this month)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyRevenue = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const dateStr = `${monthKey}-${day}`;
    return monthInvoices.filter(inv => inv.createdAt && inv.createdAt.startsWith(dateStr))
      .reduce((s, inv) => s + (inv.total || 0), 0);
  });

  const ringSegments = [
    { label: 'جلسات', value: sessionRevenue, color: '#1a1f3d' },
    { label: 'مطبخ', value: kitchenRevenue, color: '#c9a84c' },
  ].filter(s => s.value > 0);

  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">التقارير</h1>
        <div className="flex items-center gap-3 bg-white rounded-2xl p-2 shadow-sm border border-cream-200">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronRight size={16} /></button>
          <span className="font-semibold text-navy px-2 min-w-[140px] text-center text-sm">{monthLabel}</span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronLeft size={16} /></button>
        </div>
      </div>

      {/* Revenue / Expenses / Profit */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard title="إجمالي الإيرادات" value={`${totalRevenue.toLocaleString('en-US')} ${config.currency}`} subtitle={`${monthInvoices.length} فاتورة`} icon={TrendingUp} color="teal" />
        <StatCard title="إجمالي المصروفات" value={`${totalExpenses.toLocaleString('en-US')} ${config.currency}`} subtitle={`${monthExpenses.length} معاملة`} icon={Receipt} color="red" />
        <div className={`rounded-2xl p-5 shadow-sm border card-lift ${profit >= 0 ? 'bg-teal text-white border-teal-600' : 'bg-red-500 text-white border-red-600'}`}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80 mb-1">صافي الربح</p>
          <p className="text-2xl font-bold">{profit.toLocaleString('en-US')} {config.currency}</p>
          <p className="text-xs opacity-70 mt-1">{profit >= 0 ? 'ربح' : 'خسارة'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Ring Chart */}
        {ringSegments.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 flex flex-col items-center">
            <h2 className="font-semibold text-navy mb-4 w-full">توزيع الإيرادات</h2>
            <SVGRingChart segments={ringSegments} centerLabel={`${totalRevenue.toLocaleString('en-US')}`} />
          </div>
        )}

        {/* Daily Line Chart */}
        <div className={`bg-white rounded-2xl p-5 shadow-sm border border-cream-200 ${ringSegments.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <h2 className="font-semibold text-navy mb-2">الإيرادات اليومية</h2>
          <SimpleLineChart points={dailyRevenue} color="#1a1f3d" height={100} />
          <div className="flex justify-between text-xs text-navy-400 mt-1">
            <span>1</span><span>{Math.ceil(daysInMonth/2)}</span><span>{daysInMonth}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {topStudents.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">أعلى 5 طلاب إنفاقاً</h2>
            <HorizontalBarChart items={topStudents} currency={config.currency} />
          </div>
        )}
        {topProducts.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">أكثر المنتجات مبيعاً</h2>
            <HorizontalBarChart items={topProducts} currency={config.currency} />
          </div>
        )}
      </div>

      {totalRevenue === 0 && totalExpenses === 0 && (
        <div className="bg-cream-50 border border-cream-200 rounded-2xl p-10 text-center">
          <BarChart2 size={40} className="text-navy-300 mx-auto mb-3" />
          <p className="text-navy-400">لا توجد بيانات لهذا الشهر</p>
        </div>
      )}
    </div>
  );
}

function AdminSettings({ user, config, setConfig, toast }) {
  const [, saveConfig] = useStorage(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const [form, setForm] = useState({ ...config });
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSave = () => {
    saveConfig(form);
    setConfig(form);
    logActivity('تعديل الإعدادات', 'تم تحديث إعدادات المكتبة', user.id);
    toast('تم حفظ الإعدادات', 'success');
  };

  const storageInfo = () => {
    const keys = window.storage.keys();
    let size = 0;
    keys.forEach(k => { try { size += (localStorage.getItem(k) || '').length; } catch(e) {} });
    return { count: keys.length, sizeKB: Math.round(size / 1024 * 10) / 10 };
  };

  const info = storageInfo();

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">الإعدادات</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 space-y-4">
          <h2 className="font-semibold text-navy">إعدادات المكتبة</h2>
          <Input label="اسم المكتبة" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="السعة القصوى (مقعد)" type="number" min="1" value={form.capacity} onChange={e => setForm({...form, capacity: Number(e.target.value)})} />
            <Input label="العملة" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} placeholder="ج.م" />
          </div>
          <Input label="اسم شبكة WiFi" value={form.wifiName} onChange={e => setForm({...form, wifiName: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="وقت الفتح" type="time" value={form.openTime} onChange={e => setForm({...form, openTime: e.target.value})} />
            <Input label="وقت الإغلاق" type="time" value={form.closeTime} onChange={e => setForm({...form, closeTime: e.target.value})} />
          </div>
          <button onClick={handleSave} className="w-full bg-navy hover:bg-navy-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ الإعدادات</button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">معلومات النظام</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">مفاتيح التخزين</span>
                <span className="font-semibold text-navy">{info.count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">حجم البيانات</span>
                <span className="font-semibold text-navy">{info.sizeKB} KB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">الإصدار</span>
                <span className="font-semibold text-navy">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">اسم شبكة WiFi</span>
                <code className="text-xs bg-cream-100 px-2 py-0.5 rounded font-mono">{config.wifiName}</code>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h2 className="font-semibold text-red-700 mb-2">منطقة الخطر</h2>
            <p className="text-sm text-red-600 mb-4">سيؤدي مسح البيانات إلى حذف جميع الطلاب والجلسات والفواتير نهائياً.</p>
            <button onClick={() => setConfirmClear(true)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
              <Trash2 size={15} /><span>مسح جميع البيانات</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)}
        onConfirm={() => { window.storage.clear(); window.location.reload(); }}
        title="مسح جميع البيانات" message="سيتم حذف جميع البيانات نهائياً ولا يمكن الاسترجاع. هل أنت متأكد تماماً؟"
        variant="danger" />
    </div>
  );
}

// === END PART 2 ===

// ============================================================
// CASHIER VIEWS
// ============================================================

function CheckoutModal({ open, onClose, session, config, user, toast, onCheckedOut }) {
  const [pricing] = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [orders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [invoices, saveInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const tick = useLiveTimer(30000);

  if (!open || !session) return null;

  const minutes = calcElapsedMinutes(session.checkInTime);
  const { options, best } = calcBestPrice(minutes, pricing);
  const sessionOrders = orders.filter(o => o.sessionId === session.id && o.status !== 'cancelled');
  const kitchenTotal = sessionOrders.reduce((s, o) => s + (o.total || 0), 0);
  const chosen = selectedPrice || best.type;
  const chosenOption = options.find(o => o.type === chosen) || best;
  const grandTotal = chosenOption.amount + kitchenTotal;

  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const handleCheckout = () => {
    const now = new Date().toISOString();
    const invoice = {
      id: generateId('inv'),
      sessionId: session.id,
      studentId: session.studentId,
      studentName: session.studentName,
      minutes,
      priceType: chosen,
      pricingLabel: chosenOption.label,
      amount: chosenOption.amount,
      kitchenTotal,
      total: grandTotal,
      createdAt: now,
      cashierId: user.id,
    };
    saveInvoices([invoice, ...invoices]);
    const updatedSessions = sessions.map(s => s.id === session.id
      ? { ...s, status: 'closed', checkOutTime: now, invoiceId: invoice.id }
      : s);
    saveSessions(updatedSessions);
    logActivity('تسجيل خروج', `${session.studentName} — ${grandTotal} ${config.currency}`, user.id);
    toast(`تم تسجيل الخروج • إجمالي: ${grandTotal} ${config.currency}`, 'success');
    onCheckedOut();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل الخروج والدفع" size="md"
      footer={
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer">إلغاء</button>
          <button onClick={handleCheckout} className="bg-teal hover:bg-teal-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
            <Check size={16} /><span>تأكيد الخروج</span>
          </button>
        </div>
      }>
      <div className="space-y-4">
        {/* Student Info */}
        <div className="bg-navy rounded-xl p-4 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-lg">{session.studentName}</p>
              <p className="text-white/70 text-sm">دخل: {formatTime(session.checkInTime)}</p>
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold">{hrs}h {mins}m</p>
              <p className="text-white/70 text-xs">مدة الجلسة</p>
            </div>
          </div>
        </div>

        {/* Price Options */}
        <div>
          <p className="text-sm font-semibold text-navy mb-2">اختر نوع التسعيرة:</p>
          <div className="space-y-2">
            {options.map(opt => (
              <button key={opt.type} onClick={() => setSelectedPrice(opt.type)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-right
                  ${chosen === opt.type ? 'border-teal bg-teal-50' : 'border-cream-200 hover:border-cream-400 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${chosen === opt.type ? 'border-teal bg-teal' : 'border-cream-400'}`}>
                    {chosen === opt.type && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-medium text-navy">{opt.label}</span>
                  {opt.type === best.type && <Badge variant="green">الأوفر</Badge>}
                </div>
                <span className="font-bold text-navy">{opt.amount.toLocaleString('en-US')} {config.currency}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Kitchen Orders Summary */}
        {kitchenTotal > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-amber-900">طلبات المطبخ</p>
                <p className="text-xs text-amber-700">{sessionOrders.length} طلب</p>
              </div>
              <span className="font-bold text-amber-900">{kitchenTotal.toLocaleString('en-US')} {config.currency}</span>
            </div>
          </div>
        )}

        {/* Grand Total */}
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-4 flex justify-between items-center">
          <span className="font-semibold text-navy">الإجمالي</span>
          <span className="text-2xl font-bold text-teal">{grandTotal.toLocaleString('en-US')} {config.currency}</span>
        </div>
      </div>
    </Modal>
  );
}

function CashierCurrent({ user, config, toast }) {
  const [sessions, , refreshSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [checkoutSession, setCheckoutSession] = useState(null);
  const tick = useLiveTimer(60000);

  const activeSessions = sessions.filter(s => s.status === 'active')
    .sort((a, b) => new Date(a.checkInTime) - new Date(b.checkInTime));

  const getStatusColor = (minutes) => {
    if (minutes < 180) return 'border-teal-300 bg-teal-50';
    if (minutes < 300) return 'border-amber-300 bg-amber-50';
    return 'border-red-300 bg-red-50';
  };

  const getStatusBadge = (minutes) => {
    if (minutes < 180) return <Badge variant="green">عادي</Badge>;
    if (minutes < 300) return <Badge variant="amber">طويل</Badge>;
    return <Badge variant="red">تجاوز</Badge>;
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">الجلسات النشطة</h1>
          <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-xl px-3 py-1.5">
            <div className="live-dot" />
            <span className="text-xs text-navy-500 font-medium">{activeSessions.length}</span>
          </div>
        </div>
        <p className="text-sm text-navy-400">{config.capacity - activeSessions.length} مقعد متاح</p>
      </div>

      {activeSessions.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-cream-200">
          <Users size={48} className="text-navy-200 mx-auto mb-4" />
          <p className="text-navy-400 font-medium">لا توجد جلسات نشطة حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeSessions.map(s => {
            const [pricing] = [window.storage.get(STORAGE_KEYS.PRICING) || DEFAULT_PRICING];
            const minutes = calcElapsedMinutes(s.checkInTime);
            const { best } = calcBestPrice(minutes, pricing);
            const hrs = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return (
              <div key={s.id} className={`rounded-2xl border-2 p-4 card-lift cursor-default ${getStatusColor(minutes)}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-navy">{s.studentName}</p>
                    <p className="text-xs text-navy-400 mt-0.5">دخل: {formatTime(s.checkInTime)}</p>
                  </div>
                  {getStatusBadge(minutes)}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-navy">{hrs}h {mins}m</p>
                    <p className="text-xs text-teal font-semibold mt-0.5">{best.amount.toLocaleString('en-US')} {config.currency}</p>
                  </div>
                  <button onClick={() => setCheckoutSession(s)}
                    className="bg-navy hover:bg-navy-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1">
                    <LogOut size={13} /><span>خروج</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CheckoutModal
        open={!!checkoutSession}
        onClose={() => setCheckoutSession(null)}
        session={checkoutSession}
        config={config}
        user={user}
        toast={toast}
        onCheckedOut={() => { refreshSessions(); setCheckoutSession(null); }}
      />
    </div>
  );
}

function CashierCheckin({ user, config, toast }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sessionType, setSessionType] = useState('regular');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeIds = new Set(activeSessions.map(s => s.studentId));

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [students, search]);

  const handleCheckin = () => {
    if (!selectedStudent) return;
    const session = {
      id: generateId('ses'),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      checkInTime: new Date().toISOString(),
      type: sessionType,
      status: 'active',
    };
    saveSessions([...sessions, session]);
    logActivity('تسجيل دخول', `${selectedStudent.name}`, user.id);
    toast(`تم تسجيل دخول ${selectedStudent.name}`, 'success');
    setSelectedStudent(null);
    setSearch('');
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">تسجيل الدخول</h1>

      <div className="max-w-xl">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 space-y-4">
          <SearchInput value={search} onChange={v => { setSearch(v); setSelectedStudent(null); }} placeholder="بحث بالاسم أو كود الطالب أو الهاتف…" />

          {/* Results */}
          {filtered.length > 0 && !selectedStudent && (
            <div className="border border-cream-200 rounded-xl overflow-hidden">
              {filtered.map(s => {
                const isActive = activeIds.has(s.id);
                return (
                  <button key={s.id} onClick={() => !isActive && setSelectedStudent(s)}
                    disabled={isActive}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-cream-100 last:border-0 text-right transition-colors duration-150
                      ${isActive ? 'opacity-50 cursor-not-allowed bg-cream-50' : 'hover:bg-cream-50 cursor-pointer'}`}>
                    <div>
                      <p className="font-medium text-navy text-sm">{s.name}</p>
                      <p className="text-xs text-navy-400">{s.studentId} {s.phone && `· ${s.phone}`}</p>
                    </div>
                    {isActive ? <Badge variant="teal">داخل حالياً</Badge> : <ChevronLeft size={16} className="text-navy-300" />}
                  </button>
                );
              })}
            </div>
          )}

          {search && filtered.length === 0 && !selectedStudent && (
            <div className="text-center py-4 text-navy-400 text-sm">لا توجد نتائج</div>
          )}

          {/* Selected Student */}
          {selectedStudent && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">{selectedStudent.name}</p>
                  <p className="text-xs text-navy-400">{selectedStudent.studentId}</p>
                </div>
                <button onClick={() => { setSelectedStudent(null); setSearch(''); }} className="p-1 rounded text-navy-400 hover:text-navy cursor-pointer"><X size={16} /></button>
              </div>
              <Select label="نوع الجلسة" value={sessionType} onChange={e => setSessionType(e.target.value)}>
                <option value="regular">عادية</option>
                <option value="exam">امتحان</option>
                <option value="group">مجموعة</option>
              </Select>
              <button onClick={handleCheckin}
                className="w-full bg-teal hover:bg-teal-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2">
                <Check size={16} /><span>تسجيل الدخول</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CashierNewStudent({ user, config, toast, setActiveView }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [form, setForm] = useState({ name: '', phone: '', email: '', tags: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [checkinNow, setCheckinNow] = useState(true);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const newStudent = {
      id: generateId('stu'),
      studentId: generateStudentId(),
      name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(),
      tags, notes: form.notes.trim(), createdAt: new Date().toISOString(),
    };
    saveStudents([...students, newStudent]);
    logActivity('تسجيل طالب جديد', `${newStudent.name} — ${newStudent.studentId}`, user.id);

    if (checkinNow) {
      const session = {
        id: generateId('ses'), studentId: newStudent.id, studentName: newStudent.name,
        checkInTime: new Date().toISOString(), type: 'regular', status: 'active',
      };
      saveSessions([...sessions, session]);
      logActivity('تسجيل دخول', newStudent.name, user.id);
      toast(`تم تسجيل ${newStudent.name} ودخوله للمكتبة`, 'success');
      setActiveView('cashier-current');
    } else {
      toast(`تم تسجيل ${newStudent.name} بنجاح`, 'success');
      setForm({ name: '', phone: '', email: '', tags: '', notes: '' });
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">تسجيل طالب جديد</h1>

      <div className="max-w-xl">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 space-y-4">
          <Input label="الاسم الكامل *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} error={errors.name} placeholder="اسم الطالب" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="رقم الهاتف" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="01xxxxxxxxx" />
            <Input label="البريد الإلكتروني" value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" placeholder="example@email.com" />
          </div>
          <Input label="الوسوم (مفصولة بفاصلة)" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="طالب جامعي, صباحي" />
          <Textarea label="ملاحظات" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="أي ملاحظات…" />

          {/* Checkin Now Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setCheckinNow(!checkinNow)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer
                ${checkinNow ? 'bg-teal' : 'bg-cream-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checkinNow ? 'translate-x-1' : 'right-1'}`} />
            </div>
            <span className="text-sm font-medium text-navy">تسجيل الدخول الآن</span>
          </label>

          <button onClick={handleSubmit}
            className="w-full bg-navy hover:bg-navy-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2">
            <UserPlus size={16} /><span>تسجيل الطالب</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CashierLog({ user, config }) {
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [filter, setFilter] = useState('all');
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySessions = sessions.filter(s => s.checkInTime && s.checkInTime.startsWith(todayStr))
    .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));

  const filtered = todaySessions.filter(s => {
    if (filter === 'active') return s.status === 'active';
    if (filter === 'closed') return s.status === 'closed';
    return true;
  });

  const todayRevenue = invoices.filter(inv => inv.createdAt && inv.createdAt.startsWith(todayStr))
    .reduce((s, inv) => s + (inv.total || 0), 0);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">سجل اليوم</h1>
        <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-xl px-3 py-2">
          <span className="text-xs text-navy-400">إيرادات اليوم:</span>
          <span className="text-sm font-bold text-teal">{todayRevenue.toLocaleString('en-US')} {config.currency}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[['all', 'الكل'], ['active', 'نشط'], ['closed', 'مغلق']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer
              ${filter === v ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:bg-cream-50'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 text-navy-500 text-xs uppercase">
              <th className="px-4 py-3 text-right font-semibold">الطالب</th>
              <th className="px-4 py-3 text-right font-semibold">وقت الدخول</th>
              <th className="px-4 py-3 text-right font-semibold">وقت الخروج</th>
              <th className="px-4 py-3 text-right font-semibold">المدة</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-navy-400">لا توجد بيانات</td></tr>
            ) : filtered.map(s => {
              const inv = invoices.find(i => i.sessionId === s.id);
              const minutes = s.status === 'active'
                ? calcElapsedMinutes(s.checkInTime)
                : s.checkOutTime ? Math.floor((new Date(s.checkOutTime) - new Date(s.checkInTime)) / 60000) : 0;
              const hrs = Math.floor(minutes / 60); const mins = minutes % 60;
              return (
                <tr key={s.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-navy">{s.studentName}</td>
                  <td className="px-4 py-3 text-navy-500">{formatTime(s.checkInTime)}</td>
                  <td className="px-4 py-3 text-navy-500">{s.checkOutTime ? formatTime(s.checkOutTime) : '—'}</td>
                  <td className="px-4 py-3 text-navy-500">{hrs}h {mins}m</td>
                  <td className="px-4 py-3"><Badge variant={s.status === 'active' ? 'teal' : 'gray'}>{s.status === 'active' ? 'نشط' : 'مغلق'}</Badge></td>
                  <td className="px-4 py-3 font-semibold text-teal">{inv ? `${inv.total.toLocaleString('en-US')} ${config.currency}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ============================================================
// KITCHEN VIEWS
// ============================================================

function KitchenNewOrder({ user, config, toast }) {
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [products] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [orders, saveOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [cart, setCart] = useState({});

  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeCats = categories.filter(c => products.some(p => p.categoryId === c.id && p.available));

  useEffect(() => {
    if (activeCats.length > 0 && !selectedCat) setSelectedCat(activeCats[0].id);
  }, [activeCats.length]);

  const catProducts = products.filter(p => p.categoryId === selectedCat && p.available);
  const cartItems = Object.entries(cart).filter(([_, qty]) => qty > 0).map(([id, qty]) => {
    const p = products.find(pr => pr.id === id);
    return p ? { productId: id, name: p.name, qty, price: p.price } : null;
  }).filter(Boolean);
  const cartTotal = cartItems.reduce((s, item) => s + item.qty * item.price, 0);

  const setQty = (productId, delta) => {
    setCart(prev => {
      const cur = prev[productId] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handlePlaceOrder = () => {
    if (!selectedSession || cartItems.length === 0) return;
    const order = {
      id: generateId('ord'),
      sessionId: selectedSession.id,
      studentId: selectedSession.studentId,
      studentName: selectedSession.studentName,
      items: cartItems,
      status: 'new',
      total: cartTotal,
      createdAt: new Date().toISOString(),
      staffId: user.id,
    };
    saveOrders([order, ...orders]);
    logActivity('طلب مطبخ جديد', `${selectedSession.studentName} — ${cartTotal} ${config.currency}`, user.id);
    toast('تم إرسال الطلب للمطبخ', 'success');
    setCart({});
    setSelectedSession(null);
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">طلب جديد</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Menu */}
        <div className="lg:col-span-2 space-y-4">
          {/* Student Select */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200">
            <Select label="الطالب (الجلسات النشطة)" value={selectedSession?.id || ''} onChange={e => {
              const s = activeSessions.find(s => s.id === e.target.value);
              setSelectedSession(s || null);
            }}>
              <option value="">اختر طالباً…</option>
              {activeSessions.map(s => <option key={s.id} value={s.id}>{s.studentName}</option>)}
            </Select>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {activeCats.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2
                  ${selectedCat === c.id ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:bg-cream-50'}`}>
                <span>{c.emoji}</span><span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {catProducts.map(p => {
              const qty = cart[p.id] || 0;
              return (
                <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all duration-200 ${qty > 0 ? 'border-gold bg-amber-50' : 'border-cream-200'}`}>
                  <p className="font-semibold text-navy text-sm mb-1">{p.name}</p>
                  <p className="text-teal font-bold text-sm mb-3">{p.price} {config.currency}</p>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setQty(p.id, -1)} disabled={qty === 0}
                      className="w-8 h-8 rounded-lg bg-cream-100 hover:bg-cream-200 flex items-center justify-center transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-navy w-6 text-center">{qty}</span>
                    <button onClick={() => setQty(p.id, 1)}
                      className="w-8 h-8 rounded-lg bg-navy hover:bg-navy-600 text-white flex items-center justify-center transition-colors duration-200 cursor-pointer">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 flex flex-col">
          <h2 className="font-semibold text-navy mb-4">ملخص الطلب</h2>
          {cartItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-navy-400 text-sm">لم يتم إضافة منتجات بعد</div>
          ) : (
            <div className="flex-1 space-y-2">
              {cartItems.map(item => (
                <div key={item.productId} className="flex justify-between items-center py-2 border-b border-cream-100">
                  <div>
                    <p className="text-sm font-medium text-navy">{item.name}</p>
                    <p className="text-xs text-navy-400">× {item.qty} × {item.price} {config.currency}</p>
                  </div>
                  <span className="font-semibold text-navy">{(item.qty * item.price).toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-cream-200">
            <div className="flex justify-between mb-4">
              <span className="font-semibold text-navy">الإجمالي</span>
              <span className="text-xl font-bold text-teal">{cartTotal.toLocaleString('en-US')} {config.currency}</span>
            </div>
            <button onClick={handlePlaceOrder} disabled={!selectedSession || cartItems.length === 0}
              className="w-full bg-navy hover:bg-navy-600 text-white py-2.5 rounded-xl font-medium text-sm transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <ShoppingCart size={16} /><span>إرسال الطلب</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KitchenActiveOrders({ user, config, toast }) {
  const [orders, saveOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const tick = useLiveTimer(30000);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr) && o.status !== 'delivered' && o.status !== 'cancelled')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const updateStatus = (id, status) => {
    saveOrders(orders.map(o => o.id === id ? { ...o, status } : o));
    const labels = { preparing: 'قيد التحضير', ready: 'جاهز', delivered: 'تم التسليم' };
    toast(`الطلب: ${labels[status] || status}`, 'success');
  };

  const STATUS_CONFIG = {
    new:      { label: 'جديد',         badge: 'amber',  next: 'preparing', nextLabel: 'بدء التحضير' },
    preparing:{ label: 'قيد التحضير', badge: 'navy',   next: 'ready',     nextLabel: 'جاهز' },
    ready:    { label: 'جاهز',         badge: 'green',  next: 'delivered', nextLabel: 'تم التسليم' },
  };

  const grouped = { new: [], preparing: [], ready: [] };
  todayOrders.forEach(o => { if (grouped[o.status]) grouped[o.status].push(o); });

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">الطلبات النشطة</h1>
        <div className="flex items-center gap-2 bg-white border border-cream-200 rounded-xl px-3 py-1.5">
          <div className="live-dot" />
          <span className="text-xs text-navy-500 font-medium">{todayOrders.length} طلب</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="bg-white rounded-2xl shadow-sm border border-cream-200">
            <div className="p-4 border-b border-cream-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={cfg.badge}>{cfg.label}</Badge>
                <span className="text-xs text-navy-400">({grouped[status].length})</span>
              </div>
            </div>
            <div className="p-3 space-y-3 min-h-[200px]">
              {grouped[status].length === 0 ? (
                <div className="flex items-center justify-center h-24 text-navy-300 text-sm">لا توجد طلبات</div>
              ) : grouped[status].map(o => (
                <div key={o.id} className="bg-cream-50 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-navy text-sm">{o.studentName}</p>
                    <span className="text-xs text-navy-400">{formatTime(o.createdAt)}</span>
                  </div>
                  <div className="space-y-0.5">
                    {(o.items || []).map((item, i) => (
                      <p key={i} className="text-xs text-navy-600">× {item.qty} {item.name}</p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-teal">{o.total} {config.currency}</span>
                    {cfg.next && (
                      <button onClick={() => updateStatus(o.id, cfg.next)}
                        className="bg-navy hover:bg-navy-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer">
                        {cfg.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KitchenLog({ user, config }) {
  const [orders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalRevenue = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = todayOrders.length > 0 ? Math.round(totalRevenue / todayOrders.filter(o=>o.status!=='cancelled').length) : 0;

  const STATUS_BADGE = { new: 'amber', preparing: 'navy', ready: 'green', delivered: 'teal', cancelled: 'red' };
  const STATUS_LABEL = { new: 'جديد', preparing: 'قيد التحضير', ready: 'جاهز', delivered: 'تم التسليم', cancelled: 'ملغي' };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">سجل المطبخ</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="إجمالي اليوم" value={`${totalRevenue.toLocaleString('en-US')} ${config.currency}`} subtitle={`${todayOrders.length} طلب`} icon={Coffee} color="teal" />
        <StatCard title="متوسط الطلب" value={`${avgOrder.toLocaleString('en-US')} ${config.currency}`} icon={Activity} color="gold" />
        <StatCard title="الطلبات المسلمة" value={todayOrders.filter(o=>o.status==='delivered').length} icon={CheckCircle} color="navy" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream-50 text-navy-500 text-xs uppercase">
              <th className="px-4 py-3 text-right font-semibold">الطالب</th>
              <th className="px-4 py-3 text-right font-semibold">المنتجات</th>
              <th className="px-4 py-3 text-right font-semibold">الوقت</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {todayOrders.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-navy-400">لا توجد طلبات اليوم</td></tr>
            ) : todayOrders.map(o => (
              <tr key={o.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                <td className="px-4 py-3 font-medium text-navy">{o.studentName}</td>
                <td className="px-4 py-3 text-navy-500 text-xs">{(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(', ')}</td>
                <td className="px-4 py-3 text-navy-400">{formatTime(o.createdAt)}</td>
                <td className="px-4 py-3"><Badge variant={STATUS_BADGE[o.status] || 'gray'}>{STATUS_LABEL[o.status] || o.status}</Badge></td>
                <td className="px-4 py-3 font-semibold text-teal">{(o.total||0).toLocaleString('en-US')} {config.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KitchenProducts({ user, config, toast }) {
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [products, saveProducts] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [selectedCat, setSelectedCat] = useState(null);

  const filtered = selectedCat ? products.filter(p => p.categoryId === selectedCat) : products;

  const toggleAvailable = (p) => {
    saveProducts(products.map(pr => pr.id === p.id ? { ...pr, available: !pr.available } : pr));
    toast(p.available ? 'تم تعطيل المنتج' : 'تم تفعيل المنتج', 'info');
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">قائمة المنتجات</h1>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedCat(null)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer ${!selectedCat ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:bg-cream-50'}`}>
          الكل ({products.length})
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setSelectedCat(c.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2 ${selectedCat === c.id ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:bg-cream-50'}`}>
            <span>{c.emoji}</span><span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(p => {
          const cat = categories.find(c => c.id === p.categoryId);
          return (
            <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all duration-200 card-lift ${p.available ? 'border-cream-200' : 'border-red-200 opacity-60'}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-navy text-sm leading-tight">{p.name}</p>
                <button onClick={() => toggleAvailable(p)} className="cursor-pointer flex-shrink-0">
                  <Badge variant={p.available ? 'green' : 'red'}>{p.available ? '✓' : '✗'}</Badge>
                </button>
              </div>
              {cat && <p className="text-xs text-navy-400 mb-2">{cat.emoji} {cat.name}</p>}
              <p className="text-lg font-bold text-teal">{p.price} {config.currency}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================
// WIFI PORTAL
// ============================================================

function WiFiPortal({ onBack }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null); // null | 'checkedIn' | 'notCheckedIn' | 'notFound'
  const [studentInfo, setStudentInfo] = useState(null);

  const handleCheck = () => {
    if (!query.trim()) return;
    const students = window.storage.get(STORAGE_KEYS.STUDENTS) || [];
    const sessions = window.storage.get(STORAGE_KEYS.SESSIONS) || [];
    const q = query.trim().toLowerCase();

    const student = students.find(s =>
      s.name.toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase() === q ||
      (s.phone || '') === q
    );

    if (!student) {
      setResult('notFound');
      setStudentInfo(null);
      return;
    }

    const activeSession = sessions.find(s => s.studentId === student.id && s.status === 'active');
    setStudentInfo(student);
    setResult(activeSession ? 'checkedIn' : 'notCheckedIn');
  };

  const reset = () => { setQuery(''); setResult(null); setStudentInfo(null); };

  const STATES = {
    checkedIn: {
      bg: 'from-teal to-teal-600',
      icon: <CheckCircle size={64} className="text-white" />,
      title: 'مرحباً بك!',
      subtitle: 'لديك جلسة نشطة — يمكنك الاتصال بالإنترنت',
      badge: 'bg-white/20 text-white',
      badgeText: 'متصل',
    },
    notCheckedIn: {
      bg: 'from-amber-500 to-amber-600',
      icon: <AlertCircle size={64} className="text-white" />,
      title: 'غير مسجل الدخول',
      subtitle: 'يرجى تسجيل الدخول في المكتبة أولاً للحصول على الإنترنت',
      badge: 'bg-white/20 text-white',
      badgeText: 'غير نشط',
    },
    notFound: {
      bg: 'from-red-500 to-red-600',
      icon: <XCircle size={64} className="text-white" />,
      title: 'غير مسجل',
      subtitle: 'لم يتم العثور على هذا الاسم أو الرقم في قاعدة البيانات',
      badge: 'bg-white/20 text-white',
      badgeText: 'غير موجود',
    },
  };

  const config = window.storage.get(STORAGE_KEYS.CONFIG) || DEFAULT_CONFIG;

  return (
    <div className="min-h-screen gradient-mesh flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Logo / Name */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
          <Wifi size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">{config.name}</h1>
        <p className="text-white/70 text-sm mt-1">بوابة الإنترنت · {config.wifiName}</p>
      </div>

      {result === null ? (
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 w-full max-w-sm border border-white/20 shadow-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-1">تحقق من حالتك</h2>
            <p className="text-white/70 text-sm">أدخل اسمك أو رقم عضويتك أو هاتفك</p>
          </div>
          <div className="space-y-4">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              placeholder="الاسم / الكود / الهاتف"
              className="w-full px-4 py-3 rounded-2xl bg-white/20 border border-white/30 text-white placeholder-white/50 outline-none focus:bg-white/30 transition-colors duration-200 text-center text-lg font-medium"
            />
            <button onClick={handleCheck}
              className="w-full bg-white text-navy font-bold py-3 rounded-2xl hover:bg-white/90 transition-colors duration-200 cursor-pointer text-lg">
              تحقق الآن
            </button>
          </div>
          {onBack && (
            <button onClick={onBack} className="w-full text-white/60 hover:text-white text-sm transition-colors duration-200 cursor-pointer text-center">
              العودة لتسجيل الدخول
            </button>
          )}
        </div>
      ) : (
        <div className={`bg-gradient-to-br ${STATES[result].bg} rounded-3xl p-8 w-full max-w-sm shadow-2xl text-center space-y-4`}
          style={{ animation: 'slideUp 0.3s ease-out' }}>
          <div className="flex justify-center">{STATES[result].icon}</div>
          {studentInfo && <p className="text-white/80 text-lg font-semibold">{studentInfo.name}</p>}
          <h2 className="text-2xl font-bold text-white">{STATES[result].title}</h2>
          <p className="text-white/80 text-sm leading-relaxed">{STATES[result].subtitle}</p>
          <div className="flex justify-center">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${STATES[result].badge}`}>{STATES[result].badgeText}</span>
          </div>
          <button onClick={reset}
            className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 rounded-xl transition-colors duration-200 cursor-pointer mt-2">
            بحث آخر
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SIDEBAR & NAVIGATION
// ============================================================

const MENU = {
  admin: [
    { id: 'admin-dashboard', label: 'لوحة التحكم', icon: Home },
    { id: 'admin-students',  label: 'الطلاب',       icon: Users },
    { id: 'admin-staff',     label: 'الموظفون',     icon: Shield },
    { id: 'admin-pricing',   label: 'الأسعار',       icon: Tag },
    { id: 'admin-products',  label: 'المنتجات',      icon: Package },
    { id: 'admin-expenses',  label: 'المصروفات',     icon: Receipt },
    { id: 'admin-reports',   label: 'التقارير',      icon: BarChart2 },
    { id: 'admin-settings',  label: 'الإعدادات',     icon: Settings },
  ],
  cashier: [
    { id: 'cashier-current',    label: 'الجلسات النشطة', icon: Users },
    { id: 'cashier-checkin',    label: 'تسجيل الدخول',  icon: Check },
    { id: 'cashier-newstudent', label: 'طالب جديد',      icon: UserPlus },
    { id: 'cashier-log',        label: 'سجل اليوم',      icon: FileText },
  ],
  kitchen: [
    { id: 'kitchen-neworder',     label: 'طلب جديد',    icon: ShoppingCart },
    { id: 'kitchen-activeorders', label: 'الطلبات النشطة', icon: Activity },
    { id: 'kitchen-log',          label: 'سجل المطبخ',   icon: Clock },
    { id: 'kitchen-products',     label: 'القائمة',       icon: Coffee },
  ],
};

function Sidebar({ user, config, activeView, setActiveView, onLogout, onWifi }) {
  const [collapsed, setCollapsed] = useState(false);
  const menuItems = MENU[user.role] || [];

  return (
    <aside className={`bg-navy flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} min-h-screen flex-shrink-0`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{config.name}</p>
            <p className="text-white/50 text-xs truncate">{user.name}</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors duration-200 cursor-pointer flex-shrink-0">
          <Menu size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button key={item.id} onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-right
                ${active ? 'bg-gold text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-white/10 space-y-0.5">
        <button onClick={onWifi}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer">
          <Wifi size={18} className="flex-shrink-0" />
          {!collapsed && <span>بوابة الإنترنت</span>}
        </button>
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 cursor-pointer">
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================

function LoginScreen({ onLogin, onWifi }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  const config = window.storage.get(STORAGE_KEYS.CONFIG) || DEFAULT_CONFIG;

  const handleLogin = () => {
    const staff = window.storage.get(STORAGE_KEYS.STAFF) || [];
    const found = staff.find(s => s.username === username.trim() && s.password === password && s.active);
    if (found) {
      logActivity('تسجيل دخول', `${found.name} (${found.role})`, found.id);
      onLogin(found);
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-6" dir="rtl">
      <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 ${shaking ? 'shake' : ''}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-navy rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <BookOpen size={30} className="text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-navy">{config.name}</h1>
          <p className="text-navy-400 text-sm mt-1">نظام إدارة المكتبة</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Input
            label="اسم المستخدم"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            placeholder="admin"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <div className="relative">
            <Input
              label="كلمة المرور"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute left-3 top-8 text-navy-400 hover:text-navy transition-colors cursor-pointer">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-600">{error}</span>
            </div>
          )}

          <button onClick={handleLogin}
            className="w-full bg-navy hover:bg-navy-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer">
            دخول
          </button>

          <button onClick={onWifi}
            className="w-full border border-cream-300 text-navy-500 hover:bg-cream-50 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2">
            <Wifi size={16} /><span>بوابة الإنترنت</span>
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// ROOT APP COMPONENT
// ============================================================

const VIEW_COMPONENTS = {
  'admin-dashboard': AdminDashboard,
  'admin-students':  AdminStudents,
  'admin-staff':     AdminStaff,
  'admin-pricing':   AdminPricing,
  'admin-products':  AdminProducts,
  'admin-expenses':  AdminExpenses,
  'admin-reports':   AdminReports,
  'admin-settings':  AdminSettings,
  'cashier-current':    CashierCurrent,
  'cashier-checkin':    CashierCheckin,
  'cashier-newstudent': CashierNewStudent,
  'cashier-log':        CashierLog,
  'kitchen-neworder':     KitchenNewOrder,
  'kitchen-activeorders': KitchenActiveOrders,
  'kitchen-log':          KitchenLog,
  'kitchen-products':     KitchenProducts,
};

const DEFAULT_VIEWS = {
  admin: 'admin-dashboard',
  cashier: 'cashier-current',
  kitchen: 'kitchen-activeorders',
};

const App = () => {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('');
  const [wifiMode, setWifiMode] = useState(false);
  const [config, setConfig] = useState(() => window.storage.get(STORAGE_KEYS.CONFIG) || DEFAULT_CONFIG);
  const { toasts, toast } = useToast();

  useEffect(() => {
    initializeDefaultData();
    // Hide loading indicator
    const loading = document.getElementById('root-loading');
    if (loading) loading.style.display = 'none';
  }, []);

  // Refresh config when it changes in storage
  useEffect(() => {
    const stored = window.storage.get(STORAGE_KEYS.CONFIG);
    if (stored) setConfig(stored);
  }, [user]);

  const handleLogin = (staffMember) => {
    setUser(staffMember);
    setActiveView(DEFAULT_VIEWS[staffMember.role] || 'admin-dashboard');
  };

  const handleLogout = () => {
    logActivity('تسجيل خروج', user?.name || '', user?.id || '');
    setUser(null);
    setActiveView('');
  };

  // WiFi Portal — no login required
  if (wifiMode) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <WiFiPortal onBack={() => setWifiMode(false)} />
      </>
    );
  }

  // Login screen
  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <LoginScreen onLogin={handleLogin} onWifi={() => setWifiMode(true)} />
      </>
    );
  }

  // Main layout
  const ViewComponent = VIEW_COMPONENTS[activeView];
  const viewProps = {
    user,
    config,
    setConfig,
    toast,
    setActiveView,
  };

  return (
    <>
      <ToastContainer toasts={toasts} />
      <div className="flex min-h-screen bg-cream" dir="rtl">
        <Sidebar
          user={user}
          config={config}
          activeView={activeView}
          setActiveView={setActiveView}
          onLogout={handleLogout}
          onWifi={() => setWifiMode(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl">
            {ViewComponent ? (
              <ViewComponent {...viewProps} />
            ) : (
              <div className="flex items-center justify-center h-64 text-navy-400">
                <p>اختر قسماً من القائمة</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

// Mount
createRoot(document.getElementById('root')).render(<App />);

export default App;

// === END PART 3 ===
