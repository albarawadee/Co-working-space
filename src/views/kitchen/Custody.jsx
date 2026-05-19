import { useState, useMemo } from 'react';
import { Wallet, HandCoins, CheckCircle, Clock, Send } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, formatDateTime, formatTime, isActiveOrder } from '../../utils';
import { Modal, RefreshButton } from '../../components/ui';
import PendingDebtsModal from './PendingDebtsModal';

export function KitchenCustody({ user, toast, config }) {
  const [orders, saveOrders, refreshOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [handovers, saveHandovers, refreshHandovers] = useStorage(STORAGE_KEYS.CUSTODY_HANDOVERS, []);
  const [debts, , refreshDebts] = useStorage(STORAGE_KEYS.DEBTS, []);

  const handleRefresh = () => Promise.all([refreshOrders(), refreshHandovers(), refreshDebts()]);

  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [handoverNote, setHandoverNote] = useState('');
  const { run: runSubmit, isLocked: submitting } = useSubmitLock();

  const cur = config?.currency || 'ج.م';
  const todayStr = new Date().toISOString().slice(0, 10);

  // Orders where this kitchen user holds cash (paid, cash payment, not yet handed over)
  const myCustodyOrders = useMemo(() => {
    if (!user) return [];
    // Find order IDs already included in pending/confirmed handovers
    const handedOverIds = new Set();
    (handovers || []).forEach(h => {
      if (h.staffId === user.id && (h.status === 'pending' || h.status === 'confirmed')) {
        (h.orderIds || []).forEach(id => handedOverIds.add(id));
      }
    });

    return (orders || []).filter(o =>
      o.custodyHolderId === user.id &&
      o.paid === true &&
      o.paymentMethod === 'cash' &&
      !o.sessionId &&
      !handedOverIds.has(o.id) &&
      isActiveOrder(o)
    );
  }, [orders, handovers, user]);

  // Debt repays this kitchen user collected (held in custody until handover)
  const myCustodyRepays = useMemo(() => {
    if (!user) return [];
    const handedOverDebtIds = new Set();
    (handovers || []).forEach(h => {
      if (h.staffId === user.id && (h.status === 'pending' || h.status === 'confirmed')) {
        (h.debtRepayIds || []).forEach(id => handedOverDebtIds.add(id));
      }
    });
    return (debts || []).filter(d =>
      d.type === 'repay' && d.inCustody && d.cashierId === user.id && !handedOverDebtIds.has(d.id)
    );
  }, [debts, handovers, user]);

  const custodyOrdersTotal = myCustodyOrders.reduce((s, o) => s + (o.total || 0), 0);
  const custodyRepaysTotal = myCustodyRepays.reduce((s, d) => s + (d.amount || 0), 0);
  const custodyTotal = custodyOrdersTotal + custodyRepaysTotal;

  // Pending debts: every open kitchen debt visible to the kitchen (any staff, any debtor)
  // — unpaid kitchen orders without a debt row, plus open kitchen debt rows (FIFO).
  const { pendingDebtsTotal, pendingDebtsCount } = useMemo(() => {
    let total = 0;
    const debtors = new Set();

    (orders || []).forEach(o => {
      if (!isActiveOrder(o)) return;
      if (o.paid) return;
      if (o.sessionId) return;
      if (o.orderType === 'staff' && o.debtId) return; // counted via debt row below
      const amt = o.total || 0;
      if (amt <= 0) return;
      total += amt;
      debtors.add(o.studentId || `walkin:${o.id}`);
    });

    const byPerson = new Map();
    (debts || []).filter(d => d.source === 'kitchen').forEach(d => {
      if (!d.personId) return;
      if (!byPerson.has(d.personId)) byPerson.set(d.personId, { borrows: [], repays: 0 });
      const bucket = byPerson.get(d.personId);
      if (d.type === 'borrow') bucket.borrows.push(d.amount || 0);
      else if (d.type === 'repay') bucket.repays += d.amount || 0;
    });
    byPerson.forEach(({ borrows, repays }, pid) => {
      const borrowTotal = borrows.reduce((s, b) => s + b, 0);
      const open = borrowTotal - repays;
      if (open > 0) {
        total += open;
        debtors.add(pid);
      }
    });

    return { pendingDebtsTotal: total, pendingDebtsCount: debtors.size };
  }, [orders, debts, user]);

  // Today's confirmed handovers
  const todayConfirmed = useMemo(() => {
    return (handovers || []).filter(h =>
      h.staffId === user?.id &&
      h.status === 'confirmed' &&
      h.confirmedAt?.startsWith(todayStr)
    );
  }, [handovers, user, todayStr]);

  const todayConfirmedTotal = todayConfirmed.reduce((s, h) => s + (h.amount || 0), 0);

  // All handover history for this staff
  const myHandovers = useMemo(() => {
    return (handovers || []).filter(h => h.staffId === user?.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [handovers, user]);

  const handleSubmitHandover = () => runSubmit(async () => {
    if (myCustodyOrders.length === 0 && myCustodyRepays.length === 0) return;
    try {
      const newHandover = {
        id: generateId('hnd'),
        staffId: user.id,
        staffName: user.name,
        amount: custodyTotal,
        orderIds: myCustodyOrders.map(o => o.id),
        debtRepayIds: myCustodyRepays.map(d => d.id),
        status: 'pending',
        cashierId: null,
        cashierName: null,
        shiftId: null,
        note: handoverNote.trim(),
        createdAt: new Date().toISOString(),
        confirmedAt: null,
      };

      saveHandovers(prev => [newHandover, ...(prev || [])]);
      const piecesLabel = [
        myCustodyOrders.length > 0 ? `${myCustodyOrders.length} طلب` : '',
        myCustodyRepays.length > 0 ? `${myCustodyRepays.length} سداد دين` : '',
      ].filter(Boolean).join(' + ');
      logActivity('custody_handover', `تسليم عهدة — ${custodyTotal} ${cur} (${piecesLabel})`, user.id);
      toast(`تم إرسال طلب تسليم ${custodyTotal} ${cur} للكاشير`, 'success');
      setShowHandoverModal(false);
      setHandoverNote('');
    } catch (err) {
      toast(err?.message || 'حدث خطأ', 'error');
    }
  });

  const statusBadge = (status) => {
    if (status === 'pending') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">في الانتظار</span>;
    if (status === 'confirmed') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200">تم التأكيد</span>;
    if (status === 'rejected') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">مرفوض</span>;
    return null;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <HandCoins size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">العهدة النقدية</h1>
            <p className="text-sm text-navy-400">إدارة النقدي المُحصّل وتسليمه للكاشير</p>
          </div>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-amber-600" />
            <p className="text-xs text-amber-600 font-semibold">نقدي في اليد</p>
          </div>
          <p className="text-2xl font-bold text-amber-800">{custodyTotal.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-amber-500 mt-0.5">
            {myCustodyOrders.length} طلب
            {myCustodyRepays.length > 0 ? ` + ${myCustodyRepays.length} سداد` : ''} — {cur}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowDebtsModal(true)}
          className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5 text-right hover:border-red-400 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-red-500" />
              <p className="text-xs text-red-500 font-semibold">ديون معلقة</p>
            </div>
            <span className="text-[10px] text-red-400 font-semibold">اضغط للتسوية ←</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{pendingDebtsTotal.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-red-400 mt-0.5">{pendingDebtsCount} مديون — {cur}</p>
        </button>

        <div className="bg-white rounded-2xl border border-teal-200 p-4 sm:p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-teal-600" />
            <p className="text-xs text-teal-600 font-semibold">تم التسليم اليوم</p>
          </div>
          <p className="text-2xl font-bold text-teal-800">{todayConfirmedTotal.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-teal-500 mt-0.5">{todayConfirmed.length} تسليم — {cur}</p>
        </div>
      </div>

      {/* Custody Orders */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-base font-bold text-navy">عهدة المطبخ (طلبات وسدادات)</h2>
          {(myCustodyOrders.length > 0 || myCustodyRepays.length > 0) && (
            <button
              onClick={() => setShowHandoverModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Send size={14} />
              تسليم عهدة ({custodyTotal} {cur})
            </button>
          )}
        </div>

        {myCustodyOrders.length === 0 && myCustodyRepays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Wallet size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">لا يوجد نقدي في عهدتك حالياً</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 text-right font-semibold">النوع</th>
                    <th className="px-4 py-3 text-right font-semibold">العميل</th>
                    <th className="px-4 py-3 text-right font-semibold">التفاصيل</th>
                    <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                    <th className="px-4 py-3 text-right font-semibold">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {myCustodyOrders.map(o => (
                    <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200">طلب</span></td>
                      <td className="px-4 py-3 font-medium text-navy">{o.studentName || 'تيك أواي'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {(o.items || []).map(i => `${i.productName}×${i.qty}`).join('، ')}
                      </td>
                      <td className="px-4 py-3 font-bold text-teal-700">{(o.total || 0)} {cur}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatTime(o.createdAt)}</td>
                    </tr>
                  ))}
                  {myCustodyRepays.map(d => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">سداد دين</span></td>
                      <td className="px-4 py-3 font-medium text-navy">{d.personName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{d.note || '—'}</td>
                      <td className="px-4 py-3 font-bold text-amber-700">{(d.amount || 0)} {cur}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="lg:hidden space-y-3">
              {myCustodyOrders.map(o => (
                <div key={o.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200">طلب</span>
                      <span className="font-medium text-navy text-sm">{o.studentName || 'تيك أواي'}</span>
                    </div>
                    <span className="font-bold text-teal-700 text-sm">{(o.total || 0)} {cur}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {(o.items || []).map(i => `${i.productName}×${i.qty}`).join('، ')}
                  </p>
                  <p className="text-[10px] text-gray-400">{formatTime(o.createdAt)}</p>
                </div>
              ))}
              {myCustodyRepays.map(d => (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">سداد دين</span>
                      <span className="font-medium text-navy text-sm">{d.personName || '—'}</span>
                    </div>
                    <span className="font-bold text-amber-700 text-sm">{(d.amount || 0)} {cur}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{d.note || '—'}</p>
                  <p className="text-[10px] text-gray-400">{formatTime(d.createdAt)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Handover History */}
      <section>
        <h2 className="text-base font-bold text-navy mb-3">سجل التسليمات</h2>
        {myHandovers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Send size={36} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">لا توجد تسليمات سابقة</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                    <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                    <th className="px-4 py-3 text-right font-semibold">عدد الطلبات</th>
                    <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                    <th className="px-4 py-3 text-right font-semibold">الكاشير</th>
                  </tr>
                </thead>
                <tbody>
                  {myHandovers.slice(0, 30).map(h => (
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 text-xs">{formatDateTime(h.createdAt)}</td>
                      <td className="px-4 py-3 font-bold text-navy">{(h.amount || 0).toLocaleString('en-US')} {cur}</td>
                      <td className="px-4 py-3 text-gray-600">{(h.orderIds || []).length}</td>
                      <td className="px-4 py-3">{statusBadge(h.status)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{h.cashierName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="lg:hidden space-y-3">
              {myHandovers.slice(0, 30).map(h => (
                <div key={h.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy text-sm">{(h.amount || 0).toLocaleString('en-US')} {cur}</span>
                    {statusBadge(h.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{(h.orderIds || []).length} طلب</span>
                    <span>{h.cashierName || '—'}</span>
                  </div>
                  <p className="text-[10px] text-gray-400">{formatDateTime(h.createdAt)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Handover Modal */}
      <Modal
        open={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title="تسليم العهدة النقدية"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button onClick={() => setShowHandoverModal(false)} className="px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 cursor-pointer">إلغاء</button>
            <button
              onClick={handleSubmitHandover}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 min-h-[44px] rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {submitting ? 'جاري الإرسال...' : 'تأكيد التسليم'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <p className="text-sm text-indigo-700 font-medium mb-1">المبلغ المراد تسليمه</p>
            <p className="text-3xl font-bold text-indigo-800">{custodyTotal.toLocaleString('en-US')} {cur}</p>
            <p className="text-xs text-indigo-500 mt-1">
              {myCustodyOrders.length} طلب
              {myCustodyRepays.length > 0 ? ` + ${myCustodyRepays.length} سداد دين` : ''}
            </p>
          </div>
          <p className="text-sm text-gray-600">
            سيتم إرسال إشعار للكاشير لتأكيد استلام المبلغ. بعد التأكيد سيُضاف المبلغ لحساب الدرج.
          </p>
          <textarea
            value={handoverNote}
            onChange={e => setHandoverNote(e.target.value)}
            placeholder="ملاحظات (اختياري)..."
            rows={2}
            className="w-full px-3 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm text-navy placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
          />
        </div>
      </Modal>

      {/* Pending Debts Modal */}
      <PendingDebtsModal
        open={showDebtsModal}
        onClose={() => setShowDebtsModal(false)}
        user={user}
        toast={toast}
        config={config}
        orders={orders}
        debts={debts}
        saveOrders={saveOrders}
        onSettled={handleRefresh}
      />
    </div>
  );
}
