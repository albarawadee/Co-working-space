import { useState } from 'react';
import { Clock, CheckCircle, ChefHat, Truck, AlertCircle } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { formatDateTime, logActivity } from '../../utils';

const STATUS_CONFIG = {
  new:       { label: 'جديد',        color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: AlertCircle, next: 'preparing', nextLabel: 'بدء التحضير' },
  preparing: { label: 'قيد التحضير', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ChefHat,     next: 'ready',    nextLabel: 'جاهز للتسليم' },
  ready:     { label: 'جاهز',        color: 'bg-teal-50 text-teal-700 border-teal-200',    icon: CheckCircle, next: 'delivered',nextLabel: 'تم التسليم' },
  delivered: { label: 'تم التسليم',  color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: Truck,       next: null,       nextLabel: null },
};

export function KitchenActiveOrders({ user, toast }) {
  const [orders, saveOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [filter, setFilter] = useState('active');

  const displayed = (orders || []).filter(o =>
    filter === 'active' ? ['new', 'preparing', 'ready'].includes(o.status) : o.status === 'delivered'
  );

  function advanceStatus(orderId) {
    const updated = orders.map(o => {
      if (o.id !== orderId) return o;
      const nextStatus = STATUS_CONFIG[o.status]?.next;
      if (!nextStatus) return o;
      return { ...o, status: nextStatus, updatedAt: new Date().toISOString() };
    });
    saveOrders(updated);
    const order = orders.find(o => o.id === orderId);
    const newStatus = STATUS_CONFIG[order?.status]?.next;
    logActivity('order_status', `طلب ${orderId} → ${STATUS_CONFIG[newStatus]?.label}`, user?.id);
    toast(`تم تحديث حالة الطلب إلى "${STATUS_CONFIG[newStatus]?.label}"`, 'success');
  }

  const counts = {
    new: (orders || []).filter(o => o.status === 'new').length,
    preparing: (orders || []).filter(o => o.status === 'preparing').length,
    ready: (orders || []).filter(o => o.status === 'ready').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
            <ChefHat size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">الطلبات الجارية</h1>
            <p className="text-sm text-navy-400">إدارة حالة طلبات المطبخ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${filter === 'active' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal'}`}
          >
            نشط ({counts.new + counts.preparing + counts.ready})
          </button>
          <button
            onClick={() => setFilter('delivered')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${filter === 'delivered' ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-navy'}`}
          >
            مُسلَّم
          </button>
        </div>
      </div>

      {/* Status Summary */}
      {filter === 'active' && (
        <div className="grid grid-cols-3 gap-4">
          {['new', 'preparing', 'ready'].map(status => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <div key={status} className={`rounded-2xl border p-4 ${cfg.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={16} />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold">{counts[status] ?? 0}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Orders */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center">
          <ChefHat size={40} className="mx-auto text-navy-200 mb-3" />
          <p className="text-navy-400 text-sm">لا توجد طلبات {filter === 'active' ? 'نشطة' : 'مُسلَّمة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map(order => {
            const cfg = STATUS_CONFIG[order.status];
            const Icon = cfg.icon;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-cream-200 p-4 card-lift">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-navy text-sm">{order.studentName}</p>
                    <p className="text-xs text-navy-400 mt-0.5 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3 border-t border-cream-100 pt-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-navy-600">{item.productName} × {item.qty}</span>
                      <span className="font-medium text-navy">{item.total} ج.م</span>
                    </div>
                  ))}
                </div>

                {order.note && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs text-amber-700">ملاحظة: {order.note}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-cream-100">
                  <span className="font-bold text-teal">{order.total} ج.م</span>
                  {cfg.next && (
                    <button
                      onClick={() => advanceStatus(order.id)}
                      className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold hover:bg-teal/90 transition-all duration-200 cursor-pointer"
                    >
                      {cfg.nextLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
