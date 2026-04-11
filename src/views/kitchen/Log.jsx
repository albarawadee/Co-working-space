import { useState } from 'react';
import { ClipboardList, TrendingUp } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { formatDateTime } from '../../utils';
import { Badge } from '../../components/ui';

const STATUS_LABELS = {
  new:       { label: 'جديد',        variant: 'navy' },
  preparing: { label: 'قيد التحضير', variant: 'amber' },
  ready:     { label: 'جاهز',        variant: 'teal' },
  delivered: { label: 'تم التسليم',  variant: 'green' },
};

export function KitchenLog({ user }) {
  const [orders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [dateFilter, setDateFilter] = useState('today');

  const now = new Date();
  const todayStr = now.toDateString();

  const filtered = (orders || []).filter(o => {
    const d = new Date(o.createdAt);
    if (dateFilter === 'today') return d.toDateString() === todayStr;
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    return true;
  });

  const todayTotal = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const deliveredCount = filtered.filter(o => o.status === 'delivered').length;
  const avgOrder = filtered.length > 0 ? Math.round(todayTotal / filtered.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">سجل الطلبات</h1>
            <p className="text-sm text-navy-400">استعراض تاريخ الطلبات</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'today', label: 'اليوم' },
            { id: 'week',  label: 'الأسبوع' },
            { id: 'all',   label: 'الكل' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${dateFilter === f.id ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
          <p className="text-2xl font-bold text-navy">{filtered.length}</p>
          <p className="text-xs text-navy-400 mt-1">إجمالي الطلبات</p>
        </div>
        <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
          <p className="text-2xl font-bold text-teal">{todayTotal} <span className="text-sm">ج.م</span></p>
          <p className="text-xs text-navy-400 mt-1">إجمالي المبيعات</p>
        </div>
        <div className="bg-white rounded-2xl border border-cream-200 p-4 text-center">
          <p className="text-2xl font-bold text-gold">{avgOrder} <span className="text-sm">ج.م</span></p>
          <p className="text-xs text-navy-400 mt-1">متوسط الطلب</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-navy-400">
            <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد طلبات في هذه الفترة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-cream-50 border-b border-cream-200">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500">الطالب</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500">الأصناف</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500">الإجمالي</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500">الحالة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-navy-500">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {filtered.map(order => {
                  const st = STATUS_LABELS[order.status] || { label: order.status, variant: 'navy' };
                  return (
                    <tr key={order.id} className="hover:bg-cream-50 transition-colors duration-150">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-navy">{order.studentName}</p>
                        <p className="text-xs text-navy-400">{order.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-navy-600">{order.items?.map(i => `${i.productName}×${i.qty}`).join('، ')}</p>
                        {order.note && <p className="text-xs text-amber-600 mt-0.5">ملاحظة: {order.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-teal text-sm">{order.total} ج.م</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-navy-500">{formatDateTime(order.createdAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
