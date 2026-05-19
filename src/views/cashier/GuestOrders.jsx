import { useState, useMemo } from 'react';
import { User, Clock, Armchair, Check, Banknote, CreditCard, Smartphone, ChefHat, X, ShoppingCart, Building2, Library, Landmark, BarChart3, ChevronDown, ChevronUp, Trash2, Package, Pencil } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { generateId, formatDateTime, logActivity, computeRecipeStockChanges, isActiveOrder } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';
import { supabase } from '../../lib/supabaseClient';
import { SVGRingChart, HorizontalBarChart } from '../../components/charts';
import { RefreshButton } from '../../components/ui';
import EditOrderModal from '../kitchen/EditOrderModal';

function resolveOrderType(o) {
  if (o.orderType) return o.orderType;
  if (o.hall) return 'hall';
  if (o.sessionId) return 'cowork';
  return 'guest';
}

function isCollectable(order) {
  return !order.sessionId;
}

const TAB_CONFIG = {
  cowork: { label: 'كو-ورك', color: 'indigo', activeBg: 'bg-indigo-50', activeBorder: 'border-indigo-500', activeText: 'text-indigo-700', badgeBg: 'bg-indigo-100 text-indigo-700' },
  hall:   { label: 'قاعات',  color: 'orange', activeBg: 'bg-orange-50', activeBorder: 'border-orange-500', activeText: 'text-orange-700', badgeBg: 'bg-orange-100 text-orange-700' },
  guest:  { label: 'ضيوف',   color: 'gold',   activeBg: 'bg-amber-50',  activeBorder: 'border-amber-500',  activeText: 'text-amber-700',  badgeBg: 'bg-amber-100 text-amber-700' },
};

const TYPE_BADGE = {
  cowork: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  hall:   'bg-orange-100 text-orange-700 border-orange-200',
  guest:  'bg-amber-100 text-amber-700 border-amber-200',
};

const TYPE_LABEL = {
  cowork: 'كو-ورك',
  hall:   'قاعة',
  guest:  'ضيف',
};

const STATUS_LABELS = {
  new:       { label: 'جديد',         color: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparing: { label: 'قيد التحضير', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ready:     { label: 'جاهز',         color: 'bg-teal-50 text-teal-700 border-teal-200' },
  delivered: { label: 'تم التسليم',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function CashierGuestOrders({ user, toast, config }) {
  const [orders, saveOrders, refreshOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [invoices, saveInvoices, refreshInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [shifts, , refreshShifts] = useStorage(STORAGE_KEYS.SHIFTS, []);

  const [products, , refreshProducts] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [recipes, , refreshRecipes] = useStorage(STORAGE_KEYS.PRODUCT_RECIPES, []);
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);

  const handleRefresh = () => Promise.all([refreshOrders(), refreshInvoices(), refreshShifts(), refreshProducts(), refreshRecipes()]);

  const [activeTab, setActiveTab] = useState('cowork');
  const [filter, setFilter] = useState('unpaid');
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const { run: runCollect } = useSubmitLock();

  const cur = config?.currency || 'ج.م';
  const isAdmin = user?.role === 'admin';

  // All guest/portal orders: selfService (portal) OR non-session orders needing separate payment
  const portalOrders = useMemo(() =>
    (orders || [])
      .filter(o => isActiveOrder(o) && (o.selfService || !o.sessionId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders]
  );

  // Group by resolved type
  const ordersByType = useMemo(() => {
    const grouped = { cowork: [], hall: [], guest: [] };
    portalOrders.forEach(o => {
      const type = resolveOrderType(o);
      if (grouped[type]) grouped[type].push(o);
    });
    return grouped;
  }, [portalOrders]);

  // Current tab orders
  const tabOrders = ordersByType[activeTab] || [];

  // Sub-filter logic
  const filteredOrders = useMemo(() => {
    if (filter === 'unpaid') return tabOrders.filter(o => isCollectable(o) && !o.staffId);
    if (filter === 'linked') return tabOrders.filter(o => !!o.sessionId);
    if (filter === 'paid')   return tabOrders.filter(o => !!o.staffId);
    return tabOrders;
  }, [tabOrders, filter]);

  // Summary counts for current tab
  const unpaidCollectable = tabOrders.filter(o => isCollectable(o) && !o.staffId);
  const linkedOrders = tabOrders.filter(o => !!o.sessionId);
  const paidOrders = tabOrders.filter(o => !!o.staffId);
  const paidToday = paidOrders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());

  const unpaidTotal = unpaidCollectable.reduce((s, o) => s + (o.total || 0), 0);
  const paidTodayTotal = paidToday.reduce((s, o) => s + (o.total || 0), 0);

  // Reset filter to 'unpaid' if switching to guest tab while 'linked' is selected
  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'guest' && filter === 'linked') setFilter('unpaid');
    setPayingOrderId(null);
  }

  const handleCollect = (orderId, method) => runCollect(async () => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();
    const activeShift = (shifts || []).find(s => s.cashierId === user?.id && s.status === 'active');

    const inv = {
      id: generateId('inv'),
      sessionId: null,
      studentId: null,
      studentName: order.studentName || 'ضيف',
      amount: 0,
      kitchenTotal: order.total,
      total: order.total,
      paymentMethod: method,
      billingType: 'guest',
      createdAt: now,
      cashierId: user?.id,
      shiftId: activeShift?.id || null,
      inCustody: false,
    };
    // Both writes go in Promise.all so a partial failure surfaces before
    // logActivity. Invoice and order-update use upsert with client-generated
    // IDs so retries are idempotent.
    await Promise.all([
      saveInvoices([...invoices, inv]),
      saveOrders(orders.map(o =>
        o.id === orderId ? { ...o, staffId: user?.id, invoiceId: inv.id } : o
      )),
    ]);

    logActivity('guest_payment', `تحصيل طلب بوابة: ${order.studentName} - ${order.total} ${cur} (${method === 'cash' ? 'نقدي' : method})`, user?.id);
    toast(`تم تحصيل ${order.total} ${cur} من ${order.studentName}`, 'success');
    setPayingOrderId(null);
  });

  async function handleCancelOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Restore stock via computeRecipeStockChanges
    const cartItems = (order.items || []).map(item => ({
      product: products.find(p => p.id === item.productId) || { id: item.productId, trackStock: false },
      qty: item.qty,
    })).filter(i => i.product);

    const { stockUpdates } = computeRecipeStockChanges(cartItems, recipes, products, +1);

    if (stockUpdates.length > 0) {
      const stockMovements = [];
      for (const upd of stockUpdates) {
        supabase.from('products').update({ stock_qty: upd.newStockQty }).eq('id', upd.productId);
        stockMovements.push(toSnake({
          id: generateId('stk'),
          productId: upd.productId,
          productName: upd.productName,
          type: 'cancel',
          delta: upd.delta,
          stockAfter: upd.newStockQty,
          note: `إلغاء طلب بوابة ${orderId}`,
          staffId: user?.id,
          createdAt: new Date().toISOString(),
        }));
      }
      if (stockMovements.length > 0) {
        supabase.from('stock_movements').upsert(stockMovements);
      }
    }

    // Delete associated invoice if order was paid
    const isPaid = !!order.staffId;
    if (isPaid && order.invoiceId) {
      saveInvoices(prev => prev.filter(inv => inv.id !== order.invoiceId));
    }

    // Soft-delete order
    saveOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'deleted', deletedBy: user?.id, deletedByName: user?.name, deletedAt: new Date().toISOString() }
        : o
    ));

    const stockNote = stockUpdates.length > 0 ? ' | مخزون مسترجع' : '';
    const refundNote = isPaid && order.invoiceId ? ' | تم استرداد المبلغ' : !isPaid ? ' | لم يتم الدفع' : '';
    logActivity('order_cancel', `إلغاء طلب بوابة ${orderId} | ${order.studentName} | ${order.total} ${cur} | بواسطة: ${user?.name}${refundNote}${stockNote}`, user?.id);
    toast('تم إلغاء الطلب' + (stockUpdates.length > 0 ? ' واسترجاع المخزون' : ''), 'success');
    setDeleteId(null);
  }

  function handleEditSave(updatedOrder) {
    saveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setEditingOrderId(null);
    if (updatedOrder.invoiceId) refreshInvoices();
  }

  // ── Admin analytics data ──
  const analyticsData = useMemo(() => {
    if (!isAdmin) return null;

    const allTotal = portalOrders.reduce((s, o) => s + (o.total || 0), 0);
    const allPaid = portalOrders.filter(o => !!o.staffId);
    const paidTotal = allPaid.reduce((s, o) => s + (o.total || 0), 0);
    const pendingTotal = portalOrders.filter(o => isCollectable(o) && !o.staffId).reduce((s, o) => s + (o.total || 0), 0);

    // Ring chart — order counts by type
    const typeSegments = [
      { label: 'كو-ورك', value: ordersByType.cowork.length, color: '#4f46e5' },
      { label: 'قاعات',  value: ordersByType.hall.length,   color: '#ea580c' },
      { label: 'ضيوف',   value: ordersByType.guest.length,  color: '#d4a017' },
    ];

    // Top 5 products by quantity
    const productMap = {};
    portalOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const name = item.productName || item.name || 'غير معروف';
        productMap[name] = (productMap[name] || 0) + (item.qty || 0);
      });
    });
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value, color: '#2d9f93' }));

    // Revenue by source (collected only)
    const coworkCollected = ordersByType.cowork.filter(o => o.staffId).reduce((s, o) => s + (o.total || 0), 0);
    const hallCollected   = ordersByType.hall.filter(o => o.staffId).reduce((s, o) => s + (o.total || 0), 0);
    const guestCollected  = ordersByType.guest.filter(o => o.staffId).reduce((s, o) => s + (o.total || 0), 0);

    // Payment method ring chart from guest invoices
    const guestInvoices = (invoices || []).filter(inv => inv.billingType === 'guest');
    const methodMap = {};
    guestInvoices.forEach(inv => {
      const m = inv.paymentMethod || 'cash';
      methodMap[m] = (methodMap[m] || 0) + 1;
    });
    const METHOD_LABELS = { cash: 'نقدي', transfer: 'تحويل', instapay: 'إنستاباي' };
    const METHOD_COLORS = { cash: '#2d9f93', transfer: '#4f46e5', instapay: '#7c3aed' };
    const paymentSegments = Object.entries(methodMap).map(([method, count]) => ({
      label: METHOD_LABELS[method] || method,
      value: count,
      color: METHOD_COLORS[method] || '#94a3b8',
    }));

    return {
      allTotal, paidTotal, pendingTotal,
      typeSegments,
      topProducts,
      coworkCollected, hallCollected, guestCollected,
      paymentSegments,
      totalPaidCount: guestInvoices.length,
    };
  }, [isAdmin, portalOrders, ordersByType, invoices]);

  // ── Render helpers ──

  const showLinkedChip = activeTab === 'cowork' || activeTab === 'hall';

  const emptyMessages = {
    unpaid: 'لا توجد طلبات غير مدفوعة',
    linked: 'لا توجد طلبات مرتبطة بجلسات',
    paid:   'لا توجد طلبات مدفوعة',
    all:    'لا توجد طلبات',
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-navy">طلبات البوابة</h1>
            <p className="text-xs sm:text-sm text-navy-400">إدارة وتحصيل طلبات البوابة الذاتية</p>
          </div>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* ── Admin Analytics Panel ── */}
      {isAdmin && analyticsData && (
        <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
          <button
            onClick={() => setAnalyticsOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" />
              <span className="font-bold text-navy text-sm">الإحصائيات</span>
            </div>
            {analyticsOpen ? <ChevronUp size={18} className="text-navy-400" /> : <ChevronDown size={18} className="text-navy-400" />}
          </button>

          {analyticsOpen && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-6 border-t border-cream-100 pt-4">
              {/* Stat cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                  <p className="text-xs text-navy-400 mb-1">إجمالي البوابة</p>
                  <p className="text-xl font-bold text-navy">{analyticsData.allTotal.toLocaleString('en-US')} {cur}</p>
                </div>
                <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                  <p className="text-xs text-navy-400 mb-1">محصّل</p>
                  <p className="text-xl font-bold text-teal">{analyticsData.paidTotal.toLocaleString('en-US')} {cur}</p>
                </div>
                <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                  <p className="text-xs text-navy-400 mb-1">معلّق</p>
                  <p className="text-xl font-bold text-amber-600">{analyticsData.pendingTotal.toLocaleString('en-US')} {cur}</p>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source distribution ring chart */}
                <div className="bg-gray-50 rounded-xl border border-cream-200 p-5">
                  <p className="text-sm font-bold text-navy mb-4">توزيع حسب المصدر</p>
                  <SVGRingChart
                    segments={analyticsData.typeSegments}
                    centerLabel={`${portalOrders.length}`}
                  />
                </div>

                {/* Top products bar chart */}
                <div className="bg-gray-50 rounded-xl border border-cream-200 p-5">
                  <p className="text-sm font-bold text-navy mb-4">أكثر المنتجات طلبا (top 5)</p>
                  {analyticsData.topProducts.length > 0 ? (
                    <HorizontalBarChart items={analyticsData.topProducts} currency={cur} />
                  ) : (
                    <div className="flex items-center justify-center h-32 text-xs text-navy-400">لا توجد بيانات</div>
                  )}
                </div>
              </div>

              {/* Revenue by source mini cards */}
              <div>
                <p className="text-sm font-bold text-navy mb-3">إيرادات حسب المصدر</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                    <p className="text-xs text-navy-400 mb-1">كو-ورك</p>
                    <p className="text-lg font-bold text-indigo-600">{analyticsData.coworkCollected.toLocaleString('en-US')} {cur}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                    <p className="text-xs text-navy-400 mb-1">قاعات</p>
                    <p className="text-lg font-bold text-orange-600">{analyticsData.hallCollected.toLocaleString('en-US')} {cur}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl border border-cream-200 p-4">
                    <p className="text-xs text-navy-400 mb-1">ضيوف</p>
                    <p className="text-lg font-bold text-amber-600">{analyticsData.guestCollected.toLocaleString('en-US')} {cur}</p>
                  </div>
                </div>
              </div>

              {/* Payment methods ring chart */}
              <div className="bg-gray-50 rounded-xl border border-cream-200 p-5">
                <p className="text-sm font-bold text-navy mb-4">طرق الدفع</p>
                {analyticsData.paymentSegments.length > 0 ? (
                  <SVGRingChart
                    segments={analyticsData.paymentSegments}
                    centerLabel={`${analyticsData.totalPaidCount}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 text-xs text-navy-400">لا توجد بيانات</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white rounded-2xl border border-cream-200 p-1.5 overflow-x-auto scrollbar-hide">
        {Object.entries(TAB_CONFIG).map(([key, cfg]) => {
          const count = ordersByType[key]?.length || 0;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-b-2 min-h-[44px] whitespace-nowrap ${
                isActive
                  ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}`
                  : 'bg-transparent text-navy-400 border-transparent hover:bg-gray-50'
              }`}
            >
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Sub-filter chips ── */}
      <div className="flex gap-2 flex-wrap overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter('unpaid')}
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[44px] whitespace-nowrap ${
            filter === 'unpaid' ? 'bg-amber-500 text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-amber-400'
          }`}
        >
          غير مدفوع ({unpaidCollectable.length})
        </button>
        {showLinkedChip && (
          <button
            onClick={() => setFilter('linked')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[44px] whitespace-nowrap ${
              filter === 'linked' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal'
            }`}
          >
            مرتبط بجلسة ({linkedOrders.length})
          </button>
        )}
        <button
          onClick={() => setFilter('paid')}
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[44px] whitespace-nowrap ${
            filter === 'paid' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal'
          }`}
        >
          مدفوع ({paidOrders.length})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[44px] whitespace-nowrap ${
            filter === 'all' ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-navy-300'
          }`}
        >
          الكل ({tabOrders.length})
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className={`grid grid-cols-1 xs:grid-cols-2 ${showLinkedChip ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 sm:gap-4`}>
        <div className="bg-white rounded-2xl border border-cream-200 p-4">
          <p className="text-xs text-navy-400 mb-1">غير محصّل</p>
          <p className="text-xl font-bold text-amber-600">{unpaidTotal.toLocaleString('en-US')} {cur}</p>
        </div>
        {showLinkedChip && (
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <p className="text-xs text-navy-400 mb-1">مرتبط بجلسة</p>
            <p className="text-xl font-bold text-teal">{linkedOrders.length}</p>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-cream-200 p-4">
          <p className="text-xs text-navy-400 mb-1">محصّل اليوم</p>
          <p className="text-xl font-bold text-teal">{paidTodayTotal.toLocaleString('en-US')} {cur}</p>
        </div>
        <div className="bg-white rounded-2xl border border-cream-200 p-4">
          <p className="text-xs text-navy-400 mb-1">إجمالي الطلبات</p>
          <p className="text-xl font-bold text-navy">{tabOrders.length}</p>
        </div>
      </div>

      {/* ── Orders grid ── */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center">
          <ShoppingCart size={40} className="mx-auto text-navy-200 mb-3" />
          <p className="text-navy-400 text-sm">{emptyMessages[filter] || 'لا توجد طلبات'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredOrders.map(order => {
            const isPaid = !!order.staffId;
            const isMember = !!order.sessionId;
            const collectable = isCollectable(order);
            const statusCfg = STATUS_LABELS[order.status] || STATUS_LABELS.new;
            const isPayModalOpen = payingOrderId === order.id;
            const orderType = resolveOrderType(order);

            return (
              <div key={order.id} className={`bg-white rounded-2xl border p-4 card-lift ${!isPaid && collectable ? 'border-amber-200 ring-1 ring-amber-100' : 'border-cream-200'}`}>
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-navy text-sm">{order.studentName || 'ضيف'}</p>
                      {/* Type badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${TYPE_BADGE[orderType]}`}>
                        {TYPE_LABEL[orderType]}
                      </span>
                      {/* Identity badge */}
                      {isMember ? (
                        <span className="px-1.5 py-0.5 rounded bg-teal/10 text-teal text-[10px] font-bold border border-teal/20">
                          عضو
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                          غير عضو
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-navy-400 mt-1 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {/* Location badges */}
                {order.hall && (
                  <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
                    <Building2 size={14} className="text-orange-600" />
                    <p className="text-xs font-bold text-orange-700">
                      قاعة: {order.hall}{order.seatNumber ? ` — مقعد ${order.seatNumber}` : ''}
                    </p>
                  </div>
                )}

                {!order.hall && order.seatNumber && (
                  <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-3">
                    <Armchair size={14} className="text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-700">مقعد: {order.seatNumber}</p>
                  </div>
                )}

                {/* Items list */}
                <div className="space-y-1.5 mb-3 border-t border-cream-100 pt-3">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-navy-600">{item.productName || item.name} x {item.qty}</span>
                      <span className="font-medium text-navy">{item.total} {cur}</span>
                    </div>
                  ))}
                </div>

                {/* Note */}
                {order.note && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-sm text-amber-700"><span className="font-semibold">ملاحظة:</span> {order.note}</p>
                  </div>
                )}

                {/* Total + Action row */}
                <div className="flex items-center justify-between pt-2 border-t border-cream-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal text-base">{order.total} {cur}</span>
                    {/* Edit button: only on undelivered orders */}
                    {order.status !== 'delivered' && (
                      <button
                        onClick={() => setEditingOrderId(order.id)}
                        className="px-2 py-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all duration-200 cursor-pointer border border-indigo-200"
                        title="تعديل الطلب"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {/* Cancel button: all roles for unpaid, admin/cashier only for paid (kitchen can't reverse drawer) */}
                    {(!isPaid || user?.role === 'admin' || user?.role === 'cashier') && (
                      <button
                        onClick={() => setDeleteId(order.id)}
                        className="px-2 py-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all duration-200 cursor-pointer border border-red-200"
                        title="إلغاء الطلب"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {isPaid ? (
                    <span className="flex items-center gap-1 text-xs text-teal font-medium">
                      <Check size={13} />
                      تم التحصيل
                    </span>
                  ) : !collectable ? (
                    <span className="flex items-center gap-1 text-xs text-teal font-medium bg-teal/10 px-2.5 py-1.5 rounded-lg">
                      <Clock size={12} />
                      يُحصّل عند الخروج
                    </span>
                  ) : isPayModalOpen ? (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <button
                        onClick={() => handleCollect(order.id, 'cash')}
                        className="px-3 py-1.5 min-h-[44px] bg-teal text-white rounded-lg text-xs font-semibold hover:bg-teal/90 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Banknote size={12} />
                        نقدي
                      </button>
                      <button
                        onClick={() => handleCollect(order.id, 'transfer')}
                        className="px-3 py-1.5 min-h-[44px] bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <CreditCard size={12} />
                        تحويل
                      </button>
                      <button
                        onClick={() => handleCollect(order.id, 'instapay')}
                        className="px-3 py-1.5 min-h-[44px] bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Smartphone size={12} />
                        إنستاباي
                      </button>
                      <button
                        onClick={() => setPayingOrderId(null)}
                        className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-cream-100 text-navy-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPayingOrderId(order.id)}
                      className="px-3 py-1.5 min-h-[44px] bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Banknote size={12} />
                      تحصيل
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel confirmation modal */}
      {deleteId && (() => {
        const delOrder = orders.find(o => o.id === deleteId);
        if (!delOrder) return null;
        const delCartItems = (delOrder.items || []).map(item => ({
          product: products.find(p => p.id === item.productId) || { id: item.productId, trackStock: false },
          qty: item.qty,
        })).filter(i => i.product);
        const { stockUpdates: delStockUpdates } = computeRecipeStockChanges(delCartItems, recipes, products, +1);
        const hasStock = delStockUpdates.length > 0;
        const hasPaidInvoice = !!delOrder.staffId && !!delOrder.invoiceId;

        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <h3 className="font-bold text-navy text-lg">إلغاء الطلب؟</h3>
                <p className="text-navy-400 text-sm">
                  سيتم إلغاء طلب <span className="font-semibold text-navy">{delOrder.studentName || 'ضيف'}</span> نهائياً
                </p>
              </div>
              {(hasStock || hasPaidInvoice) && (
                <div className="space-y-2">
                  {hasPaidInvoice && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <Banknote size={14} className="text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-amber-700">سيتم حذف الفاتورة واسترداد المبلغ ({delOrder.total} {cur})</p>
                    </div>
                  )}
                  {hasStock && (
                    <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                      <Package size={14} className="text-purple-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-purple-700">سيتم استرجاع المخزون تلقائياً</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-cream-200 text-navy-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  onClick={() => handleCancelOrder(deleteId)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer"
                >
                  إلغاء الطلب
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Edit order modal */}
      {editingOrderId && (() => {
        const editOrder = orders.find(o => o.id === editingOrderId);
        if (!editOrder) return null;
        return (
          <EditOrderModal
            order={editOrder}
            products={products}
            categories={categories}
            recipes={recipes}
            user={user}
            toast={toast}
            onSave={handleEditSave}
            onClose={() => setEditingOrderId(null)}
          />
        );
      })()}
    </div>
  );
}
