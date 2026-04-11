import { useState, useEffect } from 'react';
import { Check, Wallet, CreditCard, Loader, ChevronDown, ChevronUp, Plus, Minus, X, UserCheck, Zap } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { supabase, generateId, formatTime, calcElapsedMinutes, calcBestPrice, logActivity, getActiveSubscription, resolveSubscriptionBilling } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';
import { Modal } from '../../components/ui';

export default function CheckoutModal({ open, onClose, session, config, user, toast, onCheckedOut }) {
  const [pricing]  = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [orders]   = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [owners]   = useStorage(STORAGE_KEYS.OWNERS, []);
  const [products] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [staff]    = useStorage(STORAGE_KEYS.STAFF, []);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [activeSub, setActiveSub] = useState(null);
  const [useSubscription, setUseSubscription] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [amountReceived, setAmountReceived] = useState('');
  const [addChangeToWallet, setAddChangeToWallet] = useState(false);
  useLiveTimer(30000);

  // Fetch active subscription when modal opens
  useEffect(() => {
    if (!open || !session) return;
    setActiveSub(null);
    setUseSubscription(true);
    setAddedItems([]);
    setAddProductId('');
    setAddQty(1);
    setSelectedAdminId('');
    setAmountReceived('');
    setAddChangeToWallet(false);
    getActiveSubscription(session.studentId).then(sub => setActiveSub(sub));
  }, [open, session?.studentId]);

  if (!open || !session) return null;

  const minutes = calcElapsedMinutes(session.checkInTime);
  const { best } = calcBestPrice(minutes, pricing);
  const sessionOrders = orders.filter(o => o.sessionId === session.id && o.status !== 'cancelled');
  const kitchenTotal  = sessionOrders.reduce((s, o) => s + (o.total || 0), 0);
  const hrs = Math.floor(minutes / 60), mins = minutes % 60;

  const hasActiveSub  = !!activeSub;
  const useSubBilling = hasActiveSub && useSubscription;
  const sessionCost   = useSubBilling ? 0 : best.amount;

  const addedTotal      = addedItems.reduce((s, i) => s + i.subtotal, 0);
  const grandTotal      = sessionCost + kitchenTotal + addedTotal;

  const sessionStudent  = students.find(s => s.id === session.studentId);
  const walletBalance   = sessionStudent ? (sessionStudent.walletBalance || 0) : 0;
  const linkedOwners    = owners.filter(o => (o.studentIds || []).includes(session.studentId));
  const selectedOwner   = linkedOwners.find(o => o.id === selectedOwnerId) || null;
  const adminStaff      = staff.filter(s => s.role === 'admin' && s.active !== false);
  const selectedAdmin   = adminStaff.find(s => s.id === selectedAdminId) || null;
  const availableProducts = products.filter(p => p.available !== false);
  const needsPayment    = grandTotal > 0;
  const todayStr        = new Date().toISOString().slice(0, 10);

  const showAmountReceived = needsPayment && ['cash', 'transfer', 'instapay'].includes(paymentMethod);
  const receivedNum = parseFloat(amountReceived) || 0;
  const change = showAmountReceived ? Math.max(0, receivedNum - grandTotal) : 0;

  const handleAddItem = () => {
    if (!addProductId) return;
    const prod = availableProducts.find(p => p.id === addProductId);
    if (!prod) return;
    const qty = Math.max(1, addQty);
    setAddedItems(prev => {
      const existing = prev.find(i => i.productId === addProductId);
      if (existing) {
        return prev.map(i => i.productId === addProductId
          ? { ...i, qty: i.qty + qty, subtotal: (i.qty + qty) * i.unitPrice }
          : i);
      }
      return [...prev, { productId: prod.id, name: prod.name, qty, unitPrice: prod.price, subtotal: prod.price * qty }];
    });
    setAddProductId('');
    setAddQty(1);
  };

  const handleRemoveAdded = (productId) => {
    setAddedItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCheckout = async () => {
    if (isProcessing) return;

    // Validate payment
    if (needsPayment) {
      if (paymentMethod === 'owner') {
        if (!selectedOwner) { toast('اختر صاحب الحساب', 'error'); return; }
        if ((selectedOwner.balance || 0) < grandTotal) { toast('رصيد الحساب غير كافٍ', 'error'); return; }
      }
      if (paymentMethod === 'wallet') {
        if (walletBalance < grandTotal) { toast('رصيد المحفظة غير كافٍ', 'error'); return; }
      }
      if (paymentMethod === 'admin') {
        if (!selectedAdmin) { toast('اختر الموظف المسؤول', 'error'); return; }
      }
      if (showAmountReceived && receivedNum > 0 && receivedNum < grandTotal) {
        toast('المبلغ المدفوع أقل من الإجمالي', 'error'); return;
      }
    }

    setIsProcessing(true);
    const now = new Date().toISOString();
    const invoiceId = generateId('inv');

    try {
      const writes = [];

      // 1. Subscription billing (only when cashier chose to use it)
      if (useSubBilling) {
        const { updatedSub } = resolveSubscriptionBilling(activeSub, minutes, todayStr);
        writes.push(
          supabase.from('student_subscriptions').upsert(toSnake({
            ...updatedSub,
            id: activeSub.id,
          }))
        );
      }

      // 2. Owner balance deduction
      if (needsPayment && paymentMethod === 'owner' && selectedOwner) {
        writes.push(
          supabase.from('owners').update({
            balance: (selectedOwner.balance || 0) - grandTotal,
          }).eq('id', selectedOwner.id)
        );
      }

      // 3. Wallet deduction + wallet transaction
      if (needsPayment && paymentMethod === 'wallet') {
        writes.push(
          supabase.from('students').update({
            wallet_balance: (walletBalance) - grandTotal,
          }).eq('id', session.studentId)
        );
        writes.push(
          supabase.from('wallet_transactions').insert(toSnake({
            id: generateId('wtx'),
            studentId: session.studentId,
            studentName: session.studentName,
            type: 'deduct',
            amount: grandTotal,
            balanceBefore: walletBalance,
            balanceAfter: walletBalance - grandTotal,
            note: 'خصم جلسة',
            invoiceId,
            staffId: user.id,
            createdAt: now,
          }))
        );
      }

      // 3b. Change → wallet topup
      if (addChangeToWallet && change > 0) {
        const newBalance = walletBalance + change;
        writes.push(
          supabase.from('students').update({
            wallet_balance: newBalance,
          }).eq('id', session.studentId)
        );
        writes.push(
          supabase.from('wallet_transactions').insert(toSnake({
            id: generateId('wtx'),
            studentId: session.studentId,
            studentName: session.studentName,
            type: 'topup',
            amount: change,
            balanceBefore: walletBalance,
            balanceAfter: newBalance,
            note: 'باقي جلسة',
            invoiceId,
            staffId: user.id,
            createdAt: now,
          }))
        );
      }

      // 4a. Admin charge record
      if (needsPayment && paymentMethod === 'admin' && selectedAdmin) {
        writes.push(
          supabase.from('admin_charges').insert({
            id: generateId('chg'),
            admin_id: selectedAdmin.id,
            admin_name: selectedAdmin.name,
            invoice_id: invoiceId,
            session_id: session.id,
            student_name: session.studentName,
            amount: grandTotal,
            note: '',
            settled: false,
            created_at: now,
          })
        );
      }

      // 4b. Added items kitchen order
      if (addedItems.length > 0) {
        writes.push(
          supabase.from('kitchen_orders').insert(toSnake({
            id: generateId('ORD'),
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
            items: addedItems.map(i => ({
              productId: i.productId,
              productName: i.name,
              qty: i.qty,
              unitPrice: i.unitPrice,
              total: i.subtotal,
            })),
            total: addedTotal,
            note: 'أضيف عند الخروج',
            status: 'completed',
            createdAt: now,
            staffId: user.id,
          }))
        );
      }

      const effectivePaymentMethod = !needsPayment ? null : paymentMethod;

      // 4. Invoice insert
      writes.push(
        supabase.from('invoices').insert(toSnake({
          id: invoiceId,
          sessionId: session.id,
          studentId: session.studentId,
          studentName: session.studentName,
          minutes,
          priceType: useSubBilling ? 'subscription' : best.type,
          pricingLabel: useSubBilling ? `اشتراك: ${activeSub.planName}` : best.label,
          amount: sessionCost,
          kitchenTotal,
          total: grandTotal,
          billingType: useSubBilling ? 'subscription' : 'normal',
          subscriptionId: useSubBilling ? activeSub.id : null,
          paymentMethod: effectivePaymentMethod,
          ownerId: effectivePaymentMethod === 'owner' ? selectedOwnerId : null,
          ...(effectivePaymentMethod === 'admin' ? { adminId: selectedAdminId } : {}),
          cashierId: user.id,
          createdAt: now,
        }))
      );

      // 5. Close session
      writes.push(
        supabase.from('sessions').update({
          status: 'closed',
          check_out_time: now,
          checked_out_by: user.id,
        }).eq('id', session.id)
      );

      const results = await Promise.all(writes);
      const firstErr = results.find(r => r.error);
      if (firstErr?.error) throw firstErr.error;

      // Fire-and-forget log
      logActivity('تسجيل خروج', `${session.studentName} — ${grandTotal} ${config.currency}`, user.id);

      toast(`تم تسجيل الخروج • ${grandTotal} ${config.currency}`, 'success');
      onCheckedOut();
      onClose();
    } catch (err) {
      console.error('Checkout error:', err);
      toast(err?.message || 'حدث خطأ أثناء تسجيل الخروج', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل الخروج والدفع"
      footer={<div className="flex gap-3 justify-end">
        <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">إلغاء</button>
        <button onClick={handleCheckout} disabled={isProcessing} className="bg-teal hover:bg-teal-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-70">
          {isProcessing ? <Loader size={15} className="animate-spin"/> : <Check size={15}/>}
          <span>{isProcessing ? 'جاري المعالجة…' : 'تأكيد الخروج'}</span>
        </button>
      </div>}>
      <div className="space-y-4">
        {/* Session header */}
        <div className="bg-navy rounded-xl p-4 text-white">
          <div className="flex justify-between items-start">
            <div><p className="font-bold text-lg">{session.studentName}</p><p className="text-white/70 text-sm">دخل: {formatTime(session.checkInTime)}</p></div>
            <div className="text-left"><p className="text-2xl font-bold">{hrs}h {mins}m</p><p className="text-white/60 text-xs">مدة الجلسة</p></div>
          </div>
        </div>

        {/* Subscription toggle */}
        {hasActiveSub && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">اشتراك نشط — {activeSub.planName}</p>
            <p className="text-xs text-gray-500">
              متبقٍ: {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} · ينتهي: {activeSub.expiryDate}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setUseSubscription(true)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${useSubscription ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Zap size={14}/>استخدام الاشتراك
              </button>
              <button
                onClick={() => setUseSubscription(false)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${!useSubscription ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>محاسبة عادية
              </button>
            </div>
          </div>
        )}

        {/* Auto-calculated pricing — show when not using subscription */}
        {!useSubBilling && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">{best.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{best.billableHours || Math.ceil(minutes / 60)} ساعة محسوبة</p>
            </div>
            <span className="text-lg font-bold text-indigo-700">{best.amount.toLocaleString('en-US')} {config.currency}</span>
          </div>
        )}

        {/* Kitchen orders — expandable detail */}
        {kitchenTotal > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowOrderDetail(v => !v)}
              className="w-full flex justify-between items-center p-3 cursor-pointer text-right"
            >
              <div><p className="text-sm font-semibold text-amber-900">طلبات المطبخ</p><p className="text-xs text-amber-700">{sessionOrders.length} طلب</p></div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900">{kitchenTotal.toLocaleString('en-US')} {config.currency}</span>
                {showOrderDetail ? <ChevronUp size={14} className="text-amber-700"/> : <ChevronDown size={14} className="text-amber-700"/>}
              </div>
            </button>
            {showOrderDetail && (
              <div className="border-t border-amber-200 px-3 pb-3 space-y-2 pt-2">
                {sessionOrders.map(order => (
                  <div key={order.id}>
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-amber-800 py-0.5">
                        <span>{item.productName} × {item.qty}</span>
                        <span className="font-medium">{item.total.toLocaleString('en-US')} {config.currency}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add items at checkout */}
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-navy">إضافة منتجات عند الخروج</p>
          <div className="flex gap-2">
            <select
              value={addProductId}
              onChange={e => setAddProductId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
              dir="rtl"
            >
              <option value="">اختر منتجاً…</option>
              {availableProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.price} {config.currency}</option>
              ))}
            </select>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setAddQty(q => Math.max(1, q - 1))} className="px-2 py-2 hover:bg-gray-100 cursor-pointer transition-colors"><Minus size={12}/></button>
              <span className="px-2 text-sm font-medium min-w-[2rem] text-center">{addQty}</span>
              <button onClick={() => setAddQty(q => q + 1)} className="px-2 py-2 hover:bg-gray-100 cursor-pointer transition-colors"><Plus size={12}/></button>
            </div>
            <button onClick={handleAddItem} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors"><Plus size={14}/></button>
          </div>
          {addedItems.length > 0 && (
            <div className="space-y-1">
              {addedItems.map(item => (
                <div key={item.productId} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-gray-700">{item.name} × {item.qty}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy">{item.subtotal.toLocaleString('en-US')} {config.currency}</span>
                    <button onClick={() => handleRemoveAdded(item.productId)} className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors"><X size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grand total */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center">
          <span className="font-semibold text-navy">الإجمالي</span>
          <span className="text-2xl font-bold text-teal">{grandTotal.toLocaleString('en-US')} {config.currency}</span>
        </div>

        {/* Payment method */}
        {needsPayment && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">طريقة الدفع:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${paymentMethod === 'cash' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                نقدي
              </button>
              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paymentMethod === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>تحويل
              </button>
              <button
                onClick={() => setPaymentMethod('instapay')}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paymentMethod === 'instapay' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>InstaPay
              </button>
              {walletBalance > 0 && (
                <button
                  onClick={() => setPaymentMethod('wallet')}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paymentMethod === 'wallet' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <Wallet size={14}/>محفظة ({walletBalance.toLocaleString('en-US')} {config.currency})
                </button>
              )}
              {linkedOwners.length > 0 && (
                <button
                  onClick={() => { setPaymentMethod('owner'); if (!selectedOwnerId && linkedOwners.length === 1) setSelectedOwnerId(linkedOwners[0].id); }}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${paymentMethod === 'owner' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <Wallet size={14}/>حساب
                </button>
              )}
              {adminStaff.length > 0 && (
                <button
                  onClick={() => { setPaymentMethod('admin'); if (!selectedAdminId && adminStaff.length === 1) setSelectedAdminId(adminStaff[0].id); }}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${paymentMethod === 'admin' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <UserCheck size={14}/>على ادمن
                </button>
              )}
            </div>

            {/* Wallet info */}
            {paymentMethod === 'wallet' && (
              <div className={`rounded-xl p-3 border text-sm flex justify-between items-center ${walletBalance >= grandTotal ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <p className="font-semibold text-navy">محفظة الطالب</p>
                  <p className={`text-xs mt-0.5 ${walletBalance >= grandTotal ? 'text-teal-600' : 'text-red-600'}`}>
                    الرصيد: {walletBalance.toLocaleString('en-US')} {config.currency}
                  </p>
                </div>
                {walletBalance >= grandTotal ? (
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium">رصيد كافٍ</span>
                ) : (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">رصيد غير كافٍ</span>
                )}
              </div>
            )}

            {/* Admin selection */}
            {paymentMethod === 'admin' && adminStaff.length > 0 && (
              <div className="space-y-2">
                {adminStaff.length > 1 && (
                  <select
                    value={selectedAdminId}
                    onChange={e => setSelectedAdminId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-300"
                    dir="rtl"
                  >
                    <option value="">اختر الموظف…</option>
                    {adminStaff.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
                {selectedAdmin && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-navy">{selectedAdmin.name}</p>
                      <p className="text-xs text-orange-600 mt-0.5">سيُسجَّل المبلغ دَيناً على الموظف</p>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">على ادمن</span>
                  </div>
                )}
              </div>
            )}

            {/* Owner account selection */}
            {paymentMethod === 'owner' && linkedOwners.length > 0 && (
              <div className="space-y-2">
                {linkedOwners.length > 1 && (
                  <select
                    value={selectedOwnerId}
                    onChange={e => setSelectedOwnerId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                    dir="rtl"
                  >
                    <option value="">اختر الحساب…</option>
                    {linkedOwners.map(o => (
                      <option key={o.id} value={o.id}>{o.name} — {(o.balance || 0).toLocaleString('en-US')} {config.currency}</option>
                    ))}
                  </select>
                )}
                {selectedOwner && (
                  <div className={`rounded-xl p-3 border text-sm flex justify-between items-center ${(selectedOwner.balance || 0) >= grandTotal ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                    <div>
                      <p className="font-semibold text-navy">{selectedOwner.name}</p>
                      <p className={`text-xs mt-0.5 ${(selectedOwner.balance || 0) >= grandTotal ? 'text-teal-600' : 'text-red-600'}`}>
                        رصيد الحساب: {(selectedOwner.balance || 0).toLocaleString('en-US')} {config.currency}
                      </p>
                    </div>
                    {(selectedOwner.balance || 0) >= grandTotal ? (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium">رصيد كافٍ</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">رصيد غير كافٍ</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Amount received + change to wallet */}
        {showAmountReceived && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">المبلغ المدفوع:</p>
            <input
              type="number"
              inputMode="decimal"
              value={amountReceived}
              onChange={e => { setAmountReceived(e.target.value); setAddChangeToWallet(false); }}
              placeholder={`${grandTotal.toLocaleString('en-US')} ${config.currency} (المطلوب)`}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
              dir="ltr"
            />
            {change > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-800 font-medium">الباقي</span>
                  <span className="font-bold text-emerald-700">{change.toLocaleString('en-US')} {config.currency}</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addChangeToWallet}
                    onChange={e => setAddChangeToWallet(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-emerald-700">
                    إضافة الباقي للمحفظة (الرصيد الحالي: {walletBalance.toLocaleString('en-US')} → {(walletBalance + change).toLocaleString('en-US')} {config.currency})
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
