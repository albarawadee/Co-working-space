import { useMemo } from 'react';
import {
  Users, Coffee, BookOpen, AlertCircle, TrendingUp,
  ArrowRight, Armchair, Receipt, CalendarDays,
} from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { STORAGE_KEYS } from '../../constants';
import { calcElapsedMinutes, formatTime } from '../../utils';
import { WeeklyBarChart } from '../../components/charts';

export default function AdminDashboard({ user, config, setActiveView }) {
  const [students]  = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions]  = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices]  = useStorage(STORAGE_KEYS.INVOICES, []);
  const [logs]      = useStorage(STORAGE_KEYS.DAILY_LOGS, []);
  useLiveTimer(60000);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const activeSessions   = sessions.filter(s => s.status === 'active');
  const todayInvoices    = invoices.filter(i => i.createdAt?.slice(0, 10) === todayStr);
  const todayStudyRev    = todayInvoices.reduce((s, i) => s + (i.amount || 0), 0);
  const todayKitchenRev  = todayInvoices.reduce((s, i) => s + (i.kitchenTotal || 0), 0);
  const todayTotalRev    = todayInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const todayCashRev     = todayInvoices.filter(i => i.paymentMethod === 'cash' || !i.paymentMethod).reduce((s, i) => s + (i.total || 0), 0);
  const todayTransferRev = todayInvoices.filter(i => i.paymentMethod === 'transfer').reduce((s, i) => s + (i.total || 0), 0);
  const longSessions     = activeSessions.filter(s => calcElapsedMinutes(s.checkInTime) > 300);
  const capacityPct      = config.capacity > 0 ? Math.round((activeSessions.length / config.capacity) * 100) : 0;
  const availableSeats   = Math.max(0, (config.capacity || 0) - activeSessions.length);

  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return {
      label: dayNames[d.getDay()].slice(0, 3),
      value: invoices
        .filter(inv => inv.createdAt?.slice(0, 10) === ds)
        .reduce((s, inv) => s + (inv.total || 0), 0),
    };
  });

  const todayLabel = now.toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const cur = config.currency || 'ج.م';
  const studyPct = todayTotalRev > 0 ? Math.round((todayStudyRev / todayTotalRev) * 100) : 0;
  const kitchenPct = todayTotalRev > 0 ? Math.round((todayKitchenRev / todayTotalRev) * 100) : 0;

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Hero Header */}
      <div className="bg-navy rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-indigo-400 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-teal-400 translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-navy-300 text-sm mb-1">{todayLabel}</p>
            <h1 className="text-2xl font-bold">مرحباً، {user.name} 👋</h1>
            <p className="text-navy-300 text-sm mt-1">{config.name || 'Smart Vision'}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 border border-white/20">
            <div className="live-dot" />
            <span className="text-sm font-medium">{activeSessions.length} جلسة نشطة</span>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Sessions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={18} className="text-indigo-600" />
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${capacityPct >= 90 ? 'bg-red-100 text-red-600' : capacityPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-600'}`}>
              {capacityPct}%
            </span>
          </div>
          <p className="text-3xl font-bold text-navy">{activeSessions.length}</p>
          <p className="text-xs text-gray-500 mt-1">جلسة نشطة الآن</p>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-400' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(capacityPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Study Revenue */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <BookOpen size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-navy leading-tight">
            {todayStudyRev.toLocaleString('en-US')}
            <span className="text-sm font-normal text-gray-400 mr-1">{cur}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">إيرادات قاعة الدراسة</p>
        </div>

        {/* Kitchen Revenue */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
            <Coffee size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-navy leading-tight">
            {todayKitchenRev.toLocaleString('en-US')}
            <span className="text-sm font-normal text-gray-400 mr-1">{cur}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">إيرادات المطبخ</p>
        </div>

        {/* Available Seats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center mb-3">
            <Armchair size={18} className="text-teal-600" />
          </div>
          <p className="text-3xl font-bold text-navy">{availableSeats}</p>
          <p className="text-xs text-gray-500 mt-1">مقعد متاح من {config.capacity || 0}</p>
        </div>
      </div>

      {/* Today's Revenue Breakdown + Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy">إيرادات اليوم</h2>
            <button
              onClick={() => setActiveView?.('admin_daily')}
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 cursor-pointer transition-colors"
            >
              عرض التفاصيل <ArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
              <p className="text-xs text-indigo-600 font-medium mb-1">قاعة الدراسة</p>
              <p className="text-xl font-bold text-indigo-700">{todayStudyRev.toLocaleString('en-US')}</p>
              <p className="text-xs text-indigo-400">{cur}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-600 font-medium mb-1">المطبخ</p>
              <p className="text-xl font-bold text-amber-700">{todayKitchenRev.toLocaleString('en-US')}</p>
              <p className="text-xs text-amber-400">{cur}</p>
            </div>
          </div>

          {/* Distribution bar */}
          {todayTotalRev > 0 && (
            <div className="mb-4">
              <div className="flex h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 transition-all duration-500" style={{ width: `${studyPct}%` }} />
                <div className="bg-amber-400 transition-all duration-500" style={{ width: `${kitchenPct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                <span>{studyPct}% قاعة</span>
                <span>مطبخ {kitchenPct}%</span>
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-gray-600 font-medium">الإجمالي اليوم</span>
            <span className="text-lg font-bold text-navy">{todayTotalRev.toLocaleString('en-US')} {cur}</span>
          </div>
          {todayTotalRev > 0 && (
            <div className="flex gap-2 mt-1">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-gray-500">نقدي</span>
                <span className="text-xs font-bold text-gray-700">{todayCashRev.toLocaleString('en-US')} {cur}</span>
              </div>
              <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-blue-500">تحويل</span>
                <span className="text-xs font-bold text-blue-700">{todayTransferRev.toLocaleString('en-US')} {cur}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2 text-center">{todayInvoices.length} فاتورة اليوم</p>
        </div>

        {/* Capacity + Quick Actions */}
        <div className="space-y-4">
          {/* Capacity */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-navy">إشغال المقاعد</h2>
              <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${capacityPct >= 90 ? 'bg-red-100 text-red-600' : capacityPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-600'}`}>
                {capacityPct}%
              </span>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl font-bold text-navy">{activeSessions.length}</span>
              <span className="text-lg text-gray-400 mb-0.5">/ {config.capacity}</span>
              <span className="text-sm text-gray-500 mb-0.5">مقعد مشغول</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-400' : 'bg-teal-500'}`}
                style={{ width: `${Math.min(capacityPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">{availableSeats} مقعد متاح</p>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <h2 className="font-semibold text-navy mb-3 text-sm">وصول سريع</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'الطلاب', view: 'admin_students', icon: Users, color: 'indigo' },
                { label: 'الإيرادات', view: 'admin_daily', icon: CalendarDays, color: 'teal' },
                { label: 'التقارير', view: 'admin_reports', icon: TrendingUp, color: 'blue' },
                { label: 'الحسابات', view: 'admin_owners', icon: Receipt, color: 'amber' },
              ].map(item => (
                <button
                  key={item.view}
                  onClick={() => setActiveView?.(item.view)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer text-right group"
                >
                  <div className={`w-7 h-7 rounded-lg bg-${item.color}-100 flex items-center justify-center flex-shrink-0 group-hover:bg-${item.color}-200 transition-colors`}>
                    <item.icon size={14} className={`text-${item.color}-600`} />
                  </div>
                  <span className="text-xs font-medium text-navy">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-navy">الإيرادات — آخر 7 أيام</h2>
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
              {weekData.reduce((s, d) => s + d.value, 0).toLocaleString('en-US')} {cur}
            </span>
          </div>
          <WeeklyBarChart data={weekData} currency={cur} />
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col">
          <h2 className="font-semibold text-navy mb-3">آخر النشاطات</h2>
          {logs.slice(0, 10).length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              لا توجد نشاطات بعد
            </div>
          ) : (
            <div className="flex flex-col gap-0 overflow-y-auto max-h-60">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="flex items-start gap-2.5 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{log.action}</p>
                    <p className="text-[11px] text-gray-400 truncate">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-gray-300 whitespace-nowrap flex-shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
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
            <AlertCircle size={16} className="text-amber-600" />
            <h3 className="font-semibold text-amber-800 text-sm">جلسات طويلة ({longSessions.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {longSessions.map(s => {
              const m = calcElapsedMinutes(s.checkInTime);
              return (
                <div key={s.id} className="bg-amber-100 border border-amber-300 rounded-xl px-3 py-1.5 text-xs">
                  <span className="font-semibold text-amber-900">{s.studentName}</span>
                  <span className="text-amber-700 mr-1">— {Math.floor(m / 60)}h {m % 60}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSessions.length >= (config.capacity || 0) * 0.9 && config.capacity > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            تحذير: المكتبة تقترب من الطاقة الاستيعابية ({activeSessions.length}/{config.capacity})
          </p>
          <button
            onClick={() => setActiveView?.('admin_settings')}
            className="mr-auto text-xs text-red-600 underline cursor-pointer hover:text-red-800 transition-colors"
          >
            تعديل السعة
          </button>
        </div>
      )}
    </div>
  );
}

