import { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, CheckCircle, ChefHat, Truck, AlertCircle, Armchair, Smartphone, Building2, Trash2, Banknote, Package, Wallet, Pencil, CreditCard, ArrowLeftRight, X } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { formatDateTime, logActivity, generateId, computeRecipeStockChanges } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';
import { supabase } from '../../lib/supabaseClient';
import { RefreshButton } from '../../components/ui';
import EditOrderModal from './EditOrderModal';

const STATUS_CONFIG = {
  new:       { label: 'جديد',        color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: AlertCircle, next: 'preparing', nextLabel: 'بدء التحضير' },
  preparing: { label: 'قيد التحضير', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: ChefHat,     next: 'ready',    nextLabel: 'جاهز للتسليم' },
  ready:     { label: 'جاهز',        color: 'bg-teal-50 text-teal-700 border-teal-200',    icon: CheckCircle, next: 'delivered',nextLabel: 'تم التسليم' },
  delivered: { label: 'تم التسليم',  color: 'bg-gray-100 text-gray-600 border-gray-200',   icon: Truck,       next: null,       nextLabel: null },
};

export function KitchenActiveOrders({ user, toast }) {
  const [orders, saveOrders, refreshOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [students, , refreshStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [shifts, , refreshShifts] = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [products, , refreshProducts] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [recipes, , refreshRecipes] = useStorage(STORAGE_KEYS.PRODUCT_RECIPES, []);
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  // Shared lock — delete and mark-paid are both money-touching actions on
  // a single order row. One lock per modal prevents concurrent submissions.
  const { run: runOrderAction } = useSubmitLock();

  const handleRefresh = () => Promise.all([refreshOrders(), refreshStudents(), refreshShifts(), refreshProducts(), refreshRecipes()]);
  const [filter, setFilter] = useState('active');
  const [deleteId, setDeleteId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [portalAlert, setPortalAlert] = useState(null);
  const prevPortalIdsRef = useRef(new Set());

  // Portal order alert: detect new selfService orders
  useEffect(() => {
    const currentPortalOrders = (orders || []).filter(o => o.selfService && o.status === 'new');
    const currentIds = new Set(currentPortalOrders.map(o => o.id));
    const prevIds = prevPortalIdsRef.current;

    // Find newly added portal orders
    const newOrders = currentPortalOrders.filter(o => !prevIds.has(o.id));

    if (newOrders.length > 0 && prevIds.size > 0) {
      // Play double-beep using Web Audio API
      try {
        const ctx = new AudioContext();
        [0, 0.15].forEach(offset => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.value = 0.3;
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.1);
        });
      } catch (e) { /* audio not available */ }

      // Show visual alert
      setPortalAlert(newOrders[0].studentName || 'طلب جديد');
      setTimeout(() => setPortalAlert(null), 5000);
    }

    prevPortalIdsRef.current = currentIds;
  }, [orders]);

  const displayed = (orders || []).filter(o =>
    filter === 'active' ? ['new', 'preparing', 'ready'].includes(o.status) : o.status === 'delivered'
  );

  // Group orders by studentId (null studentId = standalone card)
  const grouped = useMemo(() => {
    const groups = [];
    const studentMap = new Map();

    for (const order of displayed) {
      if (!order.studentId) {
        groups.push({ key: order.id, orders: [order], isGroup: false });
        continue;
      }
      if (!studentMap.has(order.studentId)) {
        const group = { key: order.studentId, orders: [], isGroup: true };
        studentMap.set(order.studentId, group);
        groups.push(group);
      }
      studentMap.get(order.studentId).orders.push(order);
    }

    // Sort orders within each group by createdAt (oldest first)
    groups.forEach(g => {
      if (g.isGroup) g.orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    return groups;
  }, [displayed]);

  // Create invoice + return payment fields (no saveOrders — caller merges into a single save)
  async function createPaymentInvoice(order, paymentMethod = 'cash') {
    const now = new Date().toISOString();
    const isKitchenUser = user?.role === 'kitchen';
    const invoiceId = generateId('inv');
    const activeShift = shifts?.find(sh => sh.cashierId === user?.id && sh.status === 'active')
      || shifts?.find(sh => sh.status === 'active');

    const needsCustody = isKitchenUser && paymentMethod === 'cash';

    const { error: invError } = await supabase.from('invoices').upsert(toSnake({
      id: invoiceId,
      sessionId: null,
      studentId: null,
      studentName: order.studentName || 'تيك أواي / Walk-in',
      amount: 0,
      kitchenTotal: order.total,
      total: order.total,
      paymentMethod,
      createdAt: now,
      cashierId: user?.id,
      shiftId: isKitchenUser ? null : (activeShift?.id || null),
      inCustody: needsCustody,
    }), { onConflict: 'id' });

    if (invError) return { error: invError };
    return {
      paid: true,
      invoiceId,
      paymentMethod,
      paidBy: user?.id,
      custodyHolderId: needsCustody ? user?.id : null,
    };
  }

  function isWalkinCashOrder(order) {
    return !order.sessionId && !order.paid && order.paymentMethod !== 'debt' && !order.studentId;
  }

  async function advanceStatus(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const newStatus = STATUS_CONFIG[order.status]?.next;
    if (!newStatus) return;

    let paymentFields = {};
    if (newStatus === 'delivered' && isWalkinCashOrder(order)) {
      const result = await createPaymentInvoice(order, 'cash');
      if (result.error) { toast('خطأ في إنشاء الفاتورة: ' + result.error.message, 'error'); return; }
      paymentFields = result;
    }

    saveOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, ...paymentFields, status: newStatus, updatedAt: new Date().toISOString() } : o
    ));
    logActivity('order_status', `طلب ${orderId} → ${STATUS_CONFIG[newStatus]?.label}`, user?.id);
    toast(`تم تحديث حالة الطلب إلى "${STATUS_CONFIG[newStatus]?.label}"`, 'success');
  }

  async function directDeliver(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let paymentFields = {};
    if (isWalkinCashOrder(order)) {
      const result = await createPaymentInvoice(order, 'cash');
      if (result.error) { toast('خطأ في إنشاء الفاتورة: ' + result.error.message, 'error'); return; }
      paymentFields = result;
    }

    saveOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, ...paymentFields, status: 'delivered', updatedAt: new Date().toISOString() } : o
    ));

    if (paymentFields.paid) {
      logActivity('order_status', `طلب ${orderId} → تسليم مباشر + دفع نقدي`, user?.id);
      toast('تم تسليم الطلب وتسجيل الدفع نقداً', 'success');
    } else {
      logActivity('order_status', `طلب ${orderId} → تسليم مباشر`, user?.id);
      toast('تم تسليم الطلب مباشرة', 'success');
    }
  }

  async function directDeliverGroup(orderIds) {
    // Create invoices for walk-in cash orders first, collect payment fields per order
    const paymentMap = {};
    for (const oid of orderIds) {
      const order = orders.find(o => o.id === oid);
      if (order && isWalkinCashOrder(order)) {
        const result = await createPaymentInvoice(order, 'cash');
        if (!result.error) paymentMap[oid] = result;
      }
    }
    // Single saveOrders call with all updates merged
    saveOrders(prev => prev.map(o =>
      orderIds.includes(o.id)
        ? { ...o, ...(paymentMap[o.id] || {}), status: 'delivered', updatedAt: new Date().toISOString() }
        : o
    ));
    logActivity('order_status', `تسليم مجموعة (${orderIds.length} طلبات)`, user?.id);
    toast('تم تسليم جميع الطلبات', 'success');
  }

  const handleDelete = (orderId) => runOrderAction(async () => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Restore stock for ingredients/products
    const cartItems = (order.items || []).map(item => ({
      product: products.find(p => p.id === item.productId) || { id: item.productId, trackStock: false },
      qty: item.qty,
    })).filter(i => i.product);

    const { stockUpdates } = computeRecipeStockChanges(cartItems, recipes, products, +1);

    if (stockUpdates.length > 0) {
      const stockPromises = [];
      const stockMovements = [];
      for (const upd of stockUpdates) {
        stockPromises.push(
          supabase.from('products').update({ stock_qty: upd.newStockQty }).eq('id', upd.productId)
        );
        stockMovements.push(toSnake({
          id: generateId('stk'),
          productId: upd.productId,
          productName: upd.productName,
          type: 'cancel',
          delta: upd.delta,
          stockAfter: upd.newStockQty,
          note: `إلغاء طلب ${orderId}`,
          staffId: user?.id,
          createdAt: new Date().toISOString(),
        }));
      }
      if (stockMovements.length > 0) {
        stockPromises.push(supabase.from('stock_movements').upsert(stockMovements));
      }
      await Promise.all(stockPromises);
    }

    // Delete associated invoice if order was paid
    if (order.paid && order.invoiceId) {
      await supabase.from('invoices').delete().eq('id', order.invoiceId);
    }

    // Delete associated debt record if order was on credit
    if (order.debtId) {
      await supabase.from('debts').delete().eq('id', order.debtId);
    }

    saveOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'deleted', deletedBy: user?.id, deletedByName: user?.name, deletedAt: new Date().toISOString() }
        : o
    ));
    const stockNote = stockUpdates.length > 0 ? ' | مخزون مسترجع' : '';
    const refundNote = order.paid && order.invoiceId ? ' | تم استرداد المبلغ' : !order.paid ? ' | لم يتم الدفع' : '';
    logActivity('order_cancel', `إلغاء طلب ${orderId} | ${order.studentName} | ${order.total} ج.م | بواسطة: ${user?.name}${refundNote}${stockNote}`, user?.id);
    toast('تم حذف الطلب' + (stockUpdates.length > 0 ? ' واسترجاع المخزون' : ''), 'success');
    setDeleteId(null);
  });

  const markAsPaid = (orderId, paymentMethod = 'cash') => runOrderAction(async () => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const result = await createPaymentInvoice(order, paymentMethod);
    if (result.error) { toast('خطأ في إنشاء الفاتورة: ' + result.error.message, 'error'); return; }

    saveOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, ...result } : o
    ));

    const methodLabel = paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'transfer' ? 'تحويل' : 'انستاباي';
    logActivity('kitchen_payment', `تحصيل طلب تيك أواي (${methodLabel}) — ${order.total} ج.م`, user?.id);

    const needsCustody = user?.role === 'kitchen' && paymentMethod === 'cash';
    if (needsCustody) {
      toast('تم تسجيل الدفع — المبلغ في عهدتك حتى التسليم', 'success');
    } else {
      toast('تم تسجيل الدفع وإنشاء الفاتورة', 'success');
    }
    setPayingOrderId(null);
  });

  function handleEditSave(updatedOrder) {
    saveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setEditingOrderId(null);
  }

  const counts = {
    new: (orders || []).filter(o => o.status === 'new').length,
    preparing: (orders || []).filter(o => o.status === 'preparing').length,
    ready: (orders || []).filter(o => o.status === 'ready').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
            <ChefHat size={20} className="text-teal" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">الطلبات الجارية</h1>
            <p className="text-sm text-navy-400">إدارة حالة طلبات المطبخ</p>
          </div>
          <RefreshButton onRefresh={handleRefresh} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${filter === 'active' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal'}`}
          >
            نشط ({counts.new + counts.preparing + counts.ready})
          </button>
          <button
            onClick={() => setFilter('delivered')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${filter === 'delivered' ? 'bg-navy text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-navy'}`}
          >
            مُسلَّم
          </button>
        </div>
      </div>

      {/* Portal order alert banner */}
      {portalAlert && (
        <div className="bg-gradient-to-l from-gold/20 to-teal/20 border border-gold/40 rounded-2xl px-5 py-4 flex items-center gap-3 animate-pulse">
          <Smartphone size={20} className="text-gold" />
          <p className="text-sm font-bold text-navy">
            طلب جديد من البوابة! — {portalAlert}
          </p>
        </div>
      )}

      {/* Status Summary */}
      {filter === 'active' && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center">
          <ChefHat size={40} className="mx-auto text-navy-200 mb-3" />
          <p className="text-navy-400 text-sm">لا توجد طلبات {filter === 'active' ? 'نشطة' : 'مُسلَّمة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map(group => {
            const firstOrder = group.orders[0];
            const hasSelfService = group.orders.some(o => o.selfService);
            const orderTypes = [...new Set(group.orders.map(o => o.orderType).filter(Boolean))];
            const groupTotal = group.orders.reduce((sum, o) => sum + (o.total || 0), 0);
            const stu = group.isGroup ? students.find(s => s.id === firstOrder.studentId) : null;
            const memberNumber = stu?.memberNumber;
            const isMultiOrder = group.orders.length > 1;
            // For group-level deliver all: only undelivered orders
            const undeliveredIds = group.orders.filter(o => o.status !== 'delivered').map(o => o.id);

            return (
              <div key={group.key} className={`bg-white rounded-2xl border p-4 card-lift ${hasSelfService ? 'border-gold/40 ring-1 ring-gold/20' : 'border-cream-200'}`}>
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-navy text-sm">{firstOrder.studentName}</p>
                      {isMultiOrder && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                          {group.orders.length} طلبات
                        </span>
                      )}
                      {hasSelfService && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gold/10 text-gold text-[10px] font-bold border border-gold/20">
                          <Smartphone size={9} />
                          طلب ذاتي
                        </span>
                      )}
                      {orderTypes.includes('cowork') && (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">كو-ورك</span>
                      )}
                      {orderTypes.includes('hall') && (
                        <span className="px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-200">قاعة</span>
                      )}
                      {orderTypes.includes('guest') && (
                        <span className="px-1.5 py-0.5 rounded-md bg-gold/10 text-gold text-[10px] font-bold border border-gold/20">ضيف</span>
                      )}
                    </div>
                    {memberNumber && <p className="text-xs text-indigo-500 font-mono font-semibold mt-0.5">#{memberNumber}</p>}
                    {!isMultiOrder && (
                      <p className="text-xs text-navy-400 mt-0.5 flex items-center gap-1">
                        <Clock size={11} />
                        {formatDateTime(firstOrder.createdAt)}
                      </p>
                    )}
                  </div>
                  {/* Status badges — for single order show the status; for multi show summary */}
                  {!isMultiOrder && (() => {
                    const cfg = STATUS_CONFIG[firstOrder.status];
                    const Icon = cfg.icon;
                    return (
                      <div className="flex items-center gap-1.5">
                        {firstOrder.paymentMethod === 'debt' && !firstOrder.paid && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Wallet size={10} />
                            مديونية
                          </span>
                        )}
                        {firstOrder.paid && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            <Banknote size={10} />
                            مدفوع
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <Icon size={11} />
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Per-order sections */}
                {group.orders.map((order, orderIdx) => {
                  const cfg = STATUS_CONFIG[order.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={order.id}>
                      {/* Separator between orders in a group */}
                      {isMultiOrder && (
                        <div className={`flex items-center gap-2 ${orderIdx > 0 ? 'mt-3 pt-3 border-t border-dashed border-cream-200' : ''}`}>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
                              <Icon size={9} />
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-navy-400 flex items-center gap-1">
                              <Clock size={9} />
                              {formatDateTime(order.createdAt)}
                            </span>
                            {order.paid && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                <Banknote size={8} />
                                مدفوع
                              </span>
                            )}
                            {order.paymentMethod === 'debt' && !order.paid && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Wallet size={8} />
                                مديونية
                              </span>
                            )}
                          </div>
                          {/* Per-order actions in group */}
                          <div className="flex items-center gap-1">
                            {order.status !== 'delivered' && (
                              <button
                                onClick={() => setEditingOrderId(order.id)}
                                className="p-1 bg-indigo-50 text-indigo-500 rounded-md hover:bg-indigo-100 transition-all duration-200 cursor-pointer border border-indigo-200"
                                title="تعديل الطلب"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteId(order.id)}
                              className="p-1 bg-red-50 text-red-500 rounded-md hover:bg-red-100 transition-all duration-200 cursor-pointer border border-red-200"
                              title="إلغاء الطلب"
                            >
                              <Trash2 size={11} />
                            </button>
                            {order.status === 'delivered' && !order.paid && !order.sessionId && order.paymentMethod !== 'debt' && (user?.role === 'cashier' || user?.role === 'admin' || user?.role === 'employee' || user?.role === 'kitchen') && (
                              payingOrderId === order.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => markAsPaid(order.id, 'cash')} className="px-1.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-[10px] font-semibold hover:bg-green-100 transition-all duration-200 cursor-pointer flex items-center gap-0.5">
                                    <Banknote size={9} /> نقدي
                                  </button>
                                  <button onClick={() => markAsPaid(order.id, 'transfer')} className="px-1.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-semibold hover:bg-blue-100 transition-all duration-200 cursor-pointer flex items-center gap-0.5">
                                    <ArrowLeftRight size={9} /> تحويل
                                  </button>
                                  <button onClick={() => markAsPaid(order.id, 'instapay')} className="px-1.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-semibold hover:bg-purple-100 transition-all duration-200 cursor-pointer flex items-center gap-0.5">
                                    <CreditCard size={9} /> انستاباي
                                  </button>
                                  <button onClick={() => setPayingOrderId(null)} className="p-1 text-navy-300 hover:text-red-500 transition-colors cursor-pointer">
                                    <X size={10} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPayingOrderId(order.id)}
                                  className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md text-[10px] font-semibold hover:bg-green-100 transition-all duration-200 cursor-pointer flex items-center gap-0.5"
                                >
                                  <Banknote size={10} />
                                  دفع
                                </button>
                              )
                            )}
                            {cfg.next && order.status !== 'delivered' && (
                              <button
                                onClick={() => directDeliver(order.id)}
                                className="px-2 py-1 bg-navy text-white rounded-md text-[10px] font-semibold hover:bg-navy/90 transition-all duration-200 cursor-pointer flex items-center gap-0.5"
                              >
                                <Truck size={10} />
                                تسليم
                              </button>
                            )}
                            {cfg.next && (
                              <button
                                onClick={() => advanceStatus(order.id)}
                                className="px-2 py-1 bg-teal text-white rounded-md text-[10px] font-semibold hover:bg-teal/90 transition-all duration-200 cursor-pointer"
                              >
                                {cfg.nextLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hall delivery badge */}
                      {order.hall && (
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mt-2">
                          <Building2 size={14} className="text-orange-600" />
                          <p className="text-xs font-bold text-orange-700">
                            توصيل لقاعة: {order.hall}{order.seatNumber ? ` — مقعد ${order.seatNumber}` : ''}
                          </p>
                        </div>
                      )}

                      {/* Seat number badge (library orders) */}
                      {!order.hall && order.seatNumber && (
                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mt-2">
                          <Armchair size={14} className="text-indigo-600" />
                          <p className="text-xs font-bold text-indigo-700">مقعد رقم: {order.seatNumber}</p>
                        </div>
                      )}

                      {/* Items */}
                      <div className={`space-y-1.5 ${isMultiOrder ? 'mt-2' : 'border-t border-cream-100 pt-3'} mb-2`}>
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-navy-600">{item.productName} × {item.qty}</span>
                            <span className="font-medium text-navy">{item.total} ج.م</span>
                          </div>
                        ))}
                      </div>

                      {/* Note */}
                      {order.note && (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2">
                          <p className="text-sm text-amber-700"><span className="font-semibold">ملاحظة:</span> {order.note}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-cream-100 flex-wrap gap-2">
                  <span className="font-bold text-teal">{groupTotal} ج.م</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Single-order card: full action buttons */}
                    {!isMultiOrder && (() => {
                      const order = firstOrder;
                      const cfg = STATUS_CONFIG[order.status];
                      return (
                        <>
                          {order.status !== 'delivered' && (
                            <button
                              onClick={() => setEditingOrderId(order.id)}
                              className="px-2 py-1.5 min-h-[44px] bg-indigo-50 text-indigo-500 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all duration-200 cursor-pointer border border-indigo-200"
                              title="تعديل الطلب"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteId(order.id)}
                            className="px-2 py-1.5 min-h-[44px] bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition-all duration-200 cursor-pointer border border-red-200"
                            title="إلغاء الطلب"
                          >
                            <Trash2 size={13} />
                          </button>
                          {order.status === 'delivered' && !order.paid && !order.sessionId && order.paymentMethod !== 'debt' && (user?.role === 'cashier' || user?.role === 'admin' || user?.role === 'employee' || user?.role === 'kitchen') && (
                            payingOrderId === order.id ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button onClick={() => markAsPaid(order.id, 'cash')} className="px-2.5 py-1.5 min-h-[44px] bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all duration-200 cursor-pointer flex items-center gap-1">
                                  <Banknote size={12} /> نقدي
                                </button>
                                <button onClick={() => markAsPaid(order.id, 'transfer')} className="px-2.5 py-1.5 min-h-[44px] bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-all duration-200 cursor-pointer flex items-center gap-1">
                                  <ArrowLeftRight size={12} /> تحويل
                                </button>
                                <button onClick={() => markAsPaid(order.id, 'instapay')} className="px-2.5 py-1.5 min-h-[44px] bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-all duration-200 cursor-pointer flex items-center gap-1">
                                  <CreditCard size={12} /> انستاباي
                                </button>
                                <button onClick={() => setPayingOrderId(null)} className="p-1 min-h-[44px] text-navy-300 hover:text-red-500 transition-colors cursor-pointer">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPayingOrderId(order.id)}
                                className="px-3 py-1.5 min-h-[44px] bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all duration-200 cursor-pointer flex items-center gap-1"
                              >
                                <Banknote size={13} />
                                تم الدفع
                              </button>
                            )
                          )}
                          {cfg.next && order.status !== 'delivered' && (
                            <button
                              onClick={() => directDeliver(order.id)}
                              className="px-3 py-1.5 min-h-[44px] bg-navy text-white rounded-lg text-xs font-semibold hover:bg-navy/90 transition-all duration-200 cursor-pointer flex items-center gap-1"
                            >
                              <Truck size={13} />
                              تسليم مباشر
                            </button>
                          )}
                          {cfg.next && (
                            <button
                              onClick={() => advanceStatus(order.id)}
                              className="px-3 py-1.5 min-h-[44px] bg-teal text-white rounded-lg text-xs font-semibold hover:bg-teal/90 transition-all duration-200 cursor-pointer"
                            >
                              {cfg.nextLabel}
                            </button>
                          )}
                        </>
                      );
                    })()}
                    {/* Multi-order group: "Deliver All" button */}
                    {isMultiOrder && undeliveredIds.length > 0 && (
                      <button
                        onClick={() => directDeliverGroup(undeliveredIds)}
                        className="px-3 py-1.5 min-h-[44px] bg-navy text-white rounded-lg text-xs font-semibold hover:bg-navy/90 transition-all duration-200 cursor-pointer flex items-center gap-1"
                      >
                        <Truck size={13} />
                        تسليم الكل ({undeliveredIds.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Delete confirmation */}
      {deleteId && (() => {
        const delOrder = orders.find(o => o.id === deleteId);
        const delCartItems = (delOrder?.items || []).map(item => ({
          product: products.find(p => p.id === item.productId) || { id: item.productId, trackStock: false },
          qty: item.qty,
        })).filter(i => i.product);
        const { stockUpdates: delStockUpdates } = computeRecipeStockChanges(delCartItems, recipes, products, +1);
        const hasStock = delStockUpdates.length > 0;
        const hasPaidInvoice = delOrder?.paid && delOrder?.invoiceId;

        return (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <h3 className="font-bold text-navy text-lg">حذف الطلب؟</h3>
                <p className="text-navy-400 text-sm">
                  سيتم حذف طلب <span className="font-semibold text-navy">{delOrder?.studentName}</span> نهائياً
                </p>
              </div>
              {(hasStock || hasPaidInvoice) && (
                <div className="space-y-2">
                  {hasStock && (
                    <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2">
                      <Package size={14} className="text-purple-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-purple-700">سيتم استرجاع المخزون تلقائياً</p>
                    </div>
                  )}
                  {hasPaidInvoice && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <Banknote size={14} className="text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-medium text-amber-700">سيتم حذف الفاتورة المرتبطة ({delOrder.total} ج.م)</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl border border-cream-200 text-navy-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer"
                >
                  حذف
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
