import { useState } from 'react';
import { Check, Wallet, CreditCard } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { storage, generateId, formatTime, calcElapsedMinutes, calcBestPrice, logActivity, getActiveSubscription, resolveSubscriptionBilling } from '../../utils';
import { Modal, Badge } from '../../components/ui';

export default function CheckoutModal({ open, onClose, session, config, user, toast, onCheckedOut }) {
  const [pricing]  = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [orders]   = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [invoices, saveInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [selectedType, setSelectedType] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  useLiveTimer(30000);

  if (!open || !session) return null;

  const minutes = calcElapsedMinutes(session.checkInTime);
  const { options, best } = calcBestPrice(minutes, pricing);
  const sessionOrders = orders.filter(o => o.sessionId === session.id && o.status !== 'cancelled');
  const kitchenTotal  = sessionOrders.reduce((s, o) => s + (o.total || 0), 0);
  const chosen        = selectedType || best.type;
  const chosenOption  = options.find(o => o.type === chosen) || best;
  const hrs = Math.floor(minutes / 60), mins = minutes % 60;

  // Active subscription check
  const activeSub = getActiveSubscription(session.studentId);
  const hasActiveSub = !!activeSub;

  // If subscription, session cost = 0
  const sessionCost = hasActiveSub ? 0 : chosenOption.amount;
  const grandTotal  = sessionCost + kitchenTotal;

  // Wallet balance
  const allStudents = storage.get(STORAGE_KEYS.STUDENTS) || [];
  const sessionStudent = allStudents.find(s => s.id === session.studentId);
  const walletBalance = sessionStudent ? (sessionStudent.walletBalance || 0) : 0;

  // Owners
  const allOwners = storage.get(STORAGE_KEYS.OWNERS) || [];
  const linkedOwners = allOwners.filter(o => (o.studentIds || []).includes(session.studentId));
  const selectedOwner = linkedOwners.find(o => o.id === selectedOwnerId) || null;

  // If sub active and no kitchen cost, payment method is irrelevant
  const needsPayment = grandTotal > 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleCheckout = () => {
    // Validate payment
    if (needsPayment) {
      if (paymentMethod === 'owner') {
        if (!selectedOwner) { toast('اختر صاحب الحساب', 'error'); return; }
        if ((selectedOwner.balance || 0) < grandTotal) { toast('رصيد الحساب غير كافٍ', 'error'); return; }
      }
      if (paymentMethod === 'wallet') {
        if (walletBalance < grandTotal) { toast('رصيد المحفظة غير كافٍ', 'error'); return; }
      }
    }

    const now = new Date().toISOString();

    // Handle subscription billing
    if (hasActiveSub) {
      const { updatedSub } = resolveSubscriptionBilling(activeSub, minutes, todayStr);
      const allSubs = storage.get(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS) || [];
      storage.set(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, allSubs.map(s => s.id === activeSub.id ? updatedSub : s));
    }

    // Handle owner deduction
    if (needsPayment && paymentMethod === 'owner') {
      const updatedOwners = allOwners.map(o =>
        o.id === selectedOwner.id ? { ...o, balance: (o.balance || 0) - grandTotal } : o
      );
      storage.set(STORAGE_KEYS.OWNERS, updatedOwners);
    }

    // Handle wallet deduction
    if (needsPayment && paymentMethod === 'wallet') {
      const invoiceId = generateId('inv');
      const updatedStudents = allStudents.map(s =>
        s.id === session.studentId ? { ...s, walletBalance: (s.walletBalance || 0) - grandTotal } : s
      );
      storage.set(STORAGE_KEYS.STUDENTS, updatedStudents);
      // Create wallet transaction
      const walletTx = {
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
      };
      const existingTxs = storage.get(STORAGE_KEYS.WALLET_TRANSACTIONS) || [];
      storage.set(STORAGE_KEYS.WALLET_TRANSACTIONS, [walletTx, ...existingTxs]);
    }

    const effectivePaymentMethod = !needsPayment ? null : paymentMethod;

    const invoice = {
      id: generateId('inv'),
      sessionId: session.id,
      studentId: session.studentId,
      studentName: session.studentName,
      minutes,
      priceType: hasActiveSub ? 'subscription' : chosen,
      pricingLabel: hasActiveSub ? `اشتراك: ${activeSub.planName}` : chosenOption.label,
      amount: sessionCost,
      kitchenTotal,
      total: grandTotal,
      billingType: hasActiveSub ? 'subscription' : 'normal',
      subscriptionId: hasActiveSub ? activeSub.id : undefined,
      paymentMethod: effectivePaymentMethod,
      ownerId: effectivePaymentMethod === 'owner' ? selectedOwnerId : undefined,
      createdAt: now,
      cashierId: user.id,
    };

    saveInvoices([invoice, ...invoices]);
    saveSessions(sessions.map(s => s.id === session.id ? { ...s, status: 'closed', checkOutTime: now, invoiceId: invoice.id } : s));
    logActivity('تسجيل خروج', `${session.studentName} — ${grandTotal} ${config.currency}`, user.id);
    toast(`تم تسجيل الخروج • ${grandTotal} ${config.currency}`, 'success');
    onCheckedOut(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="تسجيل الخروج والدفع"
      footer={<div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button>
        <button onClick={handleCheckout} className="bg-teal hover:bg-teal-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Check size={15}/><span>تأكيد الخروج</span></button>
      </div>}>
      <div className="space-y-4">
        {/* Session header */}
        <div className="bg-navy rounded-xl p-4 text-white">
          <div className="flex justify-between items-start">
            <div><p className="font-bold text-lg">{session.studentName}</p><p className="text-white/70 text-sm">دخل: {formatTime(session.checkInTime)}</p></div>
            <div className="text-left"><p className="text-2xl font-bold">{hrs}h {mins}m</p><p className="text-white/60 text-xs">مدة الجلسة</p></div>
          </div>
        </div>

        {/* Active subscription info card */}
        {hasActiveSub && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-800">اشتراك نشط — {activeSub.planName}</p>
                <p className="text-xs text-teal-600 mt-0.5">
                  متبقٍ: {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} · ينتهي: {activeSub.expiryDate}
                </p>
              </div>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium">مجاني</span>
            </div>
          </div>
        )}

        {/* Pricing options — only show when no active subscription */}
        {!hasActiveSub && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">اختر نوع التسعيرة:</p>
            {options.map(opt => (
              <button key={opt.type} onClick={() => setSelectedType(opt.type)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200 cursor-pointer text-right ${chosen === opt.type ? 'border-teal bg-teal-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${chosen === opt.type ? 'border-teal bg-teal' : 'border-gray-400'}`}>
                    {chosen === opt.type && <div className="w-1.5 h-1.5 rounded-full bg-white"/>}
                  </div>
                  <span className="text-sm font-medium text-navy">{opt.label}</span>
                  {opt.type === best.type && <Badge variant="green">الأوفر</Badge>}
                </div>
                <span className="font-bold text-navy">{opt.amount.toLocaleString('en-US')} {config.currency}</span>
              </button>
            ))}
          </div>
        )}

        {/* Kitchen orders */}
        {kitchenTotal > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
            <div><p className="text-sm font-semibold text-amber-900">طلبات المطبخ</p><p className="text-xs text-amber-700">{sessionOrders.length} طلب</p></div>
            <span className="font-bold text-amber-900">{kitchenTotal.toLocaleString('en-US')} {config.currency}</span>
          </div>
        )}

        {/* Grand total */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center">
          <span className="font-semibold text-navy">الإجمالي</span>
          <span className="text-2xl font-bold text-teal">{grandTotal.toLocaleString('en-US')} {config.currency}</span>
        </div>

        {/* Payment method — show if total > 0, or always for non-subscription sessions */}
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
      </div>
    </Modal>
  );
}
