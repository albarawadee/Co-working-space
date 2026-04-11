import { useState } from 'react';
import { TrendingUp, Users, Clock } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { formatTime, calcElapsedMinutes } from '../../utils';
import { Badge } from '../../components/ui';

export default function CashierLog({ user, config }) {
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [filter, setFilter] = useState('all');
  const todayStr = new Date().toISOString().slice(0, 10);

  const todaySessions = sessions.filter(s => s.checkInTime?.startsWith(todayStr)).sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));
  const shown = todaySessions.filter(s => filter === 'all' || (filter === 'active' && s.status === 'active') || (filter === 'closed' && s.status === 'closed'));
  const todayRevenue = invoices.filter(i => i.createdAt?.startsWith(todayStr)).reduce((s, i) => s + (i.total || 0), 0);
  const activeCount = todaySessions.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-5 fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">سجل اليوم</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Users size={16} className="text-indigo-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{todaySessions.length}</p>
            <p className="text-xs text-navy-400">جلسة اليوم</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
            <Clock size={16} className="text-teal-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{activeCount}</p>
            <p className="text-xs text-navy-400">نشط الآن</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-amber-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{todayRevenue.toLocaleString('en-US')}</p>
            <p className="text-xs text-navy-400">{config.currency} الإيرادات</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[['all','الكل'], ['active','نشط'], ['closed','مغلق']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer ${
              filter === v
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-navy-600 hover:bg-gray-50'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-navy-500 text-xs uppercase">
              <th className="px-4 py-3 text-right font-semibold">الطالب</th>
              <th className="px-4 py-3 text-right font-semibold">الدخول</th>
              <th className="px-4 py-3 text-right font-semibold">الخروج</th>
              <th className="px-4 py-3 text-right font-semibold">المدة</th>
              <th className="px-4 py-3 text-right font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-navy-400 text-sm">لا توجد بيانات</td></tr>
            ) : (
              shown.map(s => {
                const inv  = invoices.find(i => i.sessionId === s.id);
                const mins = s.status === 'active'
                  ? calcElapsedMinutes(s.checkInTime)
                  : s.checkOutTime
                    ? Math.floor((new Date(s.checkOutTime) - new Date(s.checkInTime)) / 60000)
                    : 0;
                return (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-semibold text-navy">{s.studentName}</td>
                    <td className="px-4 py-3 text-navy-500">{formatTime(s.checkInTime)}</td>
                    <td className="px-4 py-3 text-navy-500">{s.checkOutTime ? formatTime(s.checkOutTime) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-navy-600">{Math.floor(mins/60)}h {mins%60}m</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === 'active' ? 'teal' : 'gray'}>
                        {s.status === 'active' ? 'نشط' : 'مغلق'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-teal-600">
                      {inv ? `${inv.total.toLocaleString('en-US')} ${config.currency}` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
