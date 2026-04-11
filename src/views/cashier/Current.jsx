import { useState } from 'react';
import { LogOut, Users, TrendingUp, Clock } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { formatTime, calcElapsedMinutes, calcBestPrice } from '../../utils';
import CheckoutModal from './CheckoutModal';

function getInitials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function rowColor(m) {
  if (m < 180) return { row: 'hover:bg-teal-50/60', dot: 'bg-teal-400', label: 'عادي', badge: 'bg-teal-100 text-teal-700' };
  if (m < 300) return { row: 'hover:bg-amber-50/60', dot: 'bg-amber-400', label: 'طويل', badge: 'bg-amber-100 text-amber-700' };
  return { row: 'hover:bg-red-50/60', dot: 'bg-red-400', label: 'تجاوز', badge: 'bg-red-100 text-red-700' };
}

export default function CashierCurrent({ user, config, toast }) {
  const [sessions, , refresh] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [allSubs] = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
  const [pricing] = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [checkoutSes, setCheckoutSes] = useState(null);
  useLiveTimer(30000);

  const active = sessions.filter(s => s.status === 'active').sort((a, b) => new Date(a.checkInTime) - new Date(b.checkInTime));
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRevenue = invoices.filter(i => i.createdAt?.startsWith(todayStr)).reduce((s, i) => s + (i.total || 0), 0);
  const capacity = config.capacity || 50;
  const pct = Math.round((active.length / capacity) * 100);

  return (
    <div className="space-y-5 fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">الجلسات النشطة</h1>
          <span className="flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block"/>
            {active.length} نشط
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-navy-500">
            <TrendingUp size={15} className="text-teal-500"/>
            <span className="font-semibold text-navy">{todayRevenue.toLocaleString('en-US')}</span>
            <span className="text-navy-400">{config.currency} اليوم</span>
          </div>
        </div>
      </div>

      {/* Capacity bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-navy-500 shrink-0">
          <Users size={14}/>
          <span>{active.length} / {capacity}</span>
        </div>
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-teal-400'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs text-navy-400 shrink-0">{capacity - active.length} متاح</span>
      </div>

      {/* Table */}
      {active.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center shadow-sm border border-gray-200">
          <Users size={48} className="text-gray-200 mx-auto mb-4"/>
          <p className="text-navy-400 font-medium">لا توجد جلسات نشطة حالياً</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-navy-500 text-xs uppercase">
                <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                <th className="px-4 py-3 text-right font-semibold">وقت الدخول</th>
                <th className="px-4 py-3 text-right font-semibold">المدة</th>
                <th className="px-4 py-3 text-right font-semibold">التكلفة</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {active.map(s => {
                const mins = calcElapsedMinutes(s.checkInTime);
                const { best } = calcBestPrice(mins, pricing);
                const hrs = Math.floor(mins / 60);
                const m = mins % 60;
                const { row, dot, label, badge } = rowColor(mins);
                const hasSub = allSubs.some(sub => sub.studentId === s.studentId && sub.status === 'active');
                return (
                  <tr key={s.id} className={`border-b border-gray-100 transition-colors duration-150 ${row}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(s.studentName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-navy">{s.studentName}</p>
                            {hasSub && <span className="bg-teal-100 text-teal-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">اشتراك</span>}
                          </div>
                          {s.studentPhone && <p className="text-xs text-navy-400">{s.studentPhone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy-500">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-navy-300"/>
                        {formatTime(s.checkInTime)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-navy">
                      {hrs}h {m}m
                    </td>
                    <td className="px-4 py-3 font-semibold text-teal-600">
                      {best.amount.toLocaleString('en-US')} {config.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}/>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setCheckoutSes(s)}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer"
                      >
                        <LogOut size={12}/>
                        <span>خروج</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CheckoutModal
        open={!!checkoutSes}
        onClose={() => setCheckoutSes(null)}
        session={checkoutSes}
        config={config}
        user={user}
        toast={toast}
        onCheckedOut={() => { refresh(); setCheckoutSes(null); }}
      />
    </div>
  );
}
