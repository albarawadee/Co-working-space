import { useState, useMemo } from 'react';
import { TrendingUp, Users, Clock, Wallet, LogIn, LogOut, Check, HandCoins, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { formatTime, calcElapsedMinutes, generateId, logActivity, localDateStr, calcDrawerExpected } from '../../utils';
import { Badge, Modal, Input, RefreshButton, Pagination } from '../../components/ui';
import { usePagination } from '../../hooks/usePagination';
import SessionDetailModal from '../../components/SessionDetailModal';
import { toSnake } from '../../lib/fieldMaps';
import { supabase } from '../../lib/supabaseClient';

export default function CashierLog({ user, config, toast, uncollectedBalance = 0, onStudentClick }) {
  const [sessions, , refreshSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices, , refreshInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [shifts, saveShifts, refreshShifts] = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [safeTx, , refreshSafeTx] = useStorage(STORAGE_KEYS.SAFE_TRANSACTIONS, []);
  const [collections, , refreshCollections] = useStorage(STORAGE_KEYS.ADMIN_COLLECTIONS, []);
  const [expenses, , refreshExpenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const [deposits, , refreshDeposits] = useStorage(STORAGE_KEYS.DEPOSITS, []);
  const [orders, , refreshOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [debts, , refreshDebts] = useStorage(STORAGE_KEYS.DEBTS, []);
  const [cashAdj, , refreshCashAdj] = useStorage(STORAGE_KEYS.CASH_ADJUSTMENTS, []);
  const [adminCharges, , refreshAdminCharges] = useStorage(STORAGE_KEYS.ADMIN_CHARGES, []);
  const [handovers, saveHandovers, refreshHandovers] = useStorage(STORAGE_KEYS.CUSTODY_HANDOVERS, []);

  const handleRefresh = () => Promise.all([
    refreshSessions(), refreshInvoices(), refreshShifts(), refreshSafeTx(),
    refreshCollections(), refreshExpenses(), refreshDeposits(), refreshOrders(),
    refreshDebts(), refreshCashAdj(), refreshAdminCharges(), refreshHandovers()
  ]);

  const [filter, setFilter] = useState('all');
  const [handoverExpanded, setHandoverExpanded] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState(null);
  const [isStartShiftModal, setIsStartShiftModal] = useState(false);
  const [isEndShiftModal, setIsEndShiftModal] = useState(false);
  const [startCashInput, setStartCashInput] = useState('');
  const [startNote, setStartNote] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  // One lock for confirm-handover; another shared by start/end shift since those
  // are mutually-exclusive modal actions, never both in flight at once.
  const { run: runHandover } = useSubmitLock();
  const { run: runShift } = useSubmitLock();

  const todayStr = localDateStr();
  const activeShift = shifts.find(s => s.cashierId === user.id && s.status === 'active');

  // Pending handovers for this cashier
  const pendingHandovers = (handovers || []).filter(h => h.status === 'pending');
  const pendingHandoverTotal = pendingHandovers.reduce((s, h) => s + (h.amount || 0), 0);

  // Kitchen custody: cash held by kitchen staff (not yet handed over)
  // Includes both unpaid-then-collected orders AND kitchen-held debt repays.
  const kitchenCustodyTotal = useMemo(() => {
    const handedOverOrderIds = new Set();
    const handedOverDebtIds = new Set();
    (handovers || []).forEach(h => {
      if (h.status === 'pending' || h.status === 'confirmed') {
        (h.orderIds || []).forEach(id => handedOverOrderIds.add(id));
        (h.debtRepayIds || []).forEach(id => handedOverDebtIds.add(id));
      }
    });
    const orderTotal = (orders || []).filter(o =>
      o.custodyHolderId && o.paid && o.paymentMethod === 'cash'
      && !o.sessionId && !handedOverOrderIds.has(o.id)
      && o.status !== 'cancelled' && o.status !== 'deleted'
    ).reduce((s, o) => s + (o.total || 0), 0);
    const repayTotal = (debts || []).filter(d =>
      d.type === 'repay' && d.inCustody && !handedOverDebtIds.has(d.id)
    ).reduce((s, d) => s + (d.amount || 0), 0);
    return orderTotal + repayTotal;
  }, [orders, debts, handovers]);

  const totalKitchenCash = kitchenCustodyTotal + pendingHandoverTotal;

  // Calculate shift statistics via shared formula (single source of truth)
  let shiftCashSales = 0;
  let shiftDeposits = 0, shiftRepayments = 0;
  let shiftAdj = 0, shiftSettledCharges = 0;
  let shiftExpenses = 0, shiftDebts = 0, shiftCollections = 0, shiftWithdrawals = 0;
  let expectedCash = 0;

  if (activeShift) {
    // Use global drawer perspective (same as sidebar) so numbers always match.
    // Start from last closed shift's actual cash to include gap transactions.
    const closedShifts = shifts
      .filter(s => s.status === 'closed')
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
    const lastClosed = closedShifts[0];
    const drawerBase  = lastClosed ? (lastClosed.actualCash || 0) : 0;
    const drawerStart = lastClosed ? lastClosed.endTime : '1970-01-01T00:00:00.000Z';

    const result = calcDrawerExpected(
      { startingCash: drawerBase, start: drawerStart, startExclusive: true },
      { invoices, deposits, debts, expenses, cashAdj, adminCharges, collections, safeTx }
    );
    shiftCashSales = result.cashSales;
    shiftDeposits = result.deposits;
    shiftRepayments = result.repayments;
    shiftAdj = result.adjustments;
    shiftSettledCharges = result.settledCharges;
    shiftExpenses = result.expenses;
    shiftDebts = result.debtsOut;
    shiftCollections = result.collections;
    shiftWithdrawals = result.withdrawals;
    expectedCash = result.expectedCash;
  }

  // Confirm handover — assign existing invoices to cashier's shift (or create for legacy orders),
  // and release inCustody on debt repays included in the handover.
  const handleConfirmHandover = (handoverId) => runHandover(async () => {
    const h = pendingHandovers.find(x => x.id === handoverId);
    if (!h) return;

    const now = new Date().toISOString();
    const orderIds = h.orderIds || [];
    const debtRepayIds = h.debtRepayIds || [];

    for (const orderId of orderIds) {
      const order = orders.find(o => o.id === orderId);
      if (!order) continue;

      if (order.invoiceId) {
        // Invoice already exists (created at payment) — assign to cashier's shift and release custody
        await supabase.from('invoices').update(toSnake({
          shiftId: activeShift?.id || null,
          inCustody: false,
        })).eq('id', order.invoiceId);
      } else {
        // Legacy fallback: order was paid before this fix, no invoiceId — create invoice
        const invoiceId = generateId('inv');
        const { error: invError } = await supabase.from('invoices').upsert(toSnake({
          id: invoiceId,
          sessionId: null,
          studentId: null,
          studentName: order.studentName || 'تيك أواي / Walk-in',
          amount: 0,
          kitchenTotal: order.total,
          total: order.total,
          paymentMethod: 'cash',
          createdAt: now,
          cashierId: user?.id,
          shiftId: activeShift?.id || null,
        }), { onConflict: 'id' });
        if (invError) { toast('خطأ في إنشاء الفاتورة: ' + invError.message, 'error'); return; }
      }
    }

    // Release kitchen-held repays so they count as drawer income for this shift
    if (debtRepayIds.length > 0) {
      const { error: debtErr } = await supabase.from('debts')
        .update({ in_custody: false })
        .in('id', debtRepayIds);
      if (debtErr) { toast('خطأ في تحرير الديون: ' + debtErr.message, 'error'); return; }
    }

    // Update handover status
    saveHandovers(prev => (prev || []).map(x =>
      x.id === handoverId ? {
        ...x,
        status: 'confirmed',
        cashierId: user?.id,
        cashierName: user?.name,
        shiftId: activeShift?.id || null,
        confirmedAt: now,
      } : x
    ));

    logActivity('custody_confirm', `تأكيد استلام عهدة من ${h.staffName} — ${h.amount} ${config.currency}`, user?.id);
    toast(`تم تأكيد استلام ${h.amount} ${config.currency} من ${h.staffName}`, 'success');
  });

  function handleRejectHandover(handoverId) {
    saveHandovers(prev => (prev || []).map(x =>
      x.id === handoverId ? { ...x, status: 'rejected' } : x
    ));
    toast('تم رفض طلب التسليم', 'info');
  }

  // Handle Shift Actions
  const handleStartShift = () => runShift(async () => {
    const startingCash = Number(startCashInput) || 0;
    const startShortage = uncollectedBalance - startingCash;

    const newShift = {
      id: generateId('shf'),
      cashierId: user.id,
      cashierName: user.name,
      startTime: new Date().toISOString(),
      endTime: null,
      startingCash,
      expectedStartingCash: uncollectedBalance,
      startShortage,
      startNote,
      expectedCash: null,
      actualCash: null,
      shortage: 0,
      status: 'active',
      shortageJustified: false,
      shortageNote: ''
    };
    saveShifts([...shifts, newShift]);
    logActivity('بدء وردية', `العهدة الافتتاحية: ${startingCash} ${config.currency}`, user.id);
    toast('تم بدء الوردية بنجاح', 'success');
    setIsStartShiftModal(false);
    setStartCashInput('');
    setStartNote('');
  });

  const handleEndShift = () => runShift(async () => {
    if (!activeShift) return;
    const actualCash = Number(actualCashInput) || 0;
    const shortage = expectedCash - actualCash;
    
    const updatedShifts = shifts.map(s => s.id === activeShift.id ? {
      ...s,
      status: 'closed',
      endTime: new Date().toISOString(),
      expectedCash,
      actualCash,
      shortage
    } : s);
    
    saveShifts(updatedShifts);
    logActivity('إغلاق وردية', `العهدة الفعلية: ${actualCash} ${config.currency} | العجز: ${shortage} ${config.currency}`, user.id);
    toast('تم إغلاق الوردية وإرسال التقرير', 'success');
    setIsEndShiftModal(false);
    setActualCashInput('');
  });

  const todaySessions = sessions.filter(s => s.checkInTime?.startsWith(todayStr)).sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));
  const shown = todaySessions.filter(s => filter === 'all' || (filter === 'active' && s.status === 'active') || (filter === 'closed' && s.status === 'closed'));
  const { page, pageCount, pageItems, setPage, startIndex, endIndex, totalItems, isFirstPage, isLastPage } = usePagination(shown, 25);
  const todayRevenue = invoices.filter(i => i.createdAt?.startsWith(todayStr)).reduce((s, i) => s + (i.total || 0), 0);
  const activeCount = todaySessions.filter(s => s.status === 'active').length;

  return (
    <div className="min-h-screen space-y-5 fade-in p-4 sm:p-6" style={{ background: '#F8F9FB' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">سجل اليوم والوردية</h1>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* Shift Banner */}
      {activeShift ? (
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-5 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Wallet size={24} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-teal-50 font-medium">الوردية الحالية نشطة</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold">{expectedCash.toLocaleString('en-US')}</p>
                <span className="text-sm text-teal-100">{config.currency} (المتوقع بالدرج)</span>
              </div>
              <p className="text-xs text-teal-100 mt-1">بدأت: {formatTime(activeShift.startTime)}</p>
            </div>
          </div>
          <button onClick={() => setIsEndShiftModal(true)} className="w-full sm:w-auto bg-white text-teal-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2">
            <LogOut size={16} /> <span>إغلاق الوردية (تسليم المبالغ)</span>
          </button>
        </div>
      ) : (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
              <LogOut size={24} className="text-orange-500" />
            </div>
            <div>
              <p className="font-bold text-orange-900">لا توجد وردية نشطة حالياً</p>
              <p className="text-xs text-orange-700 mt-1">يجب فتح وردية جديدة للتمكن من استلام الأموال وإدارة الصندوق.</p>
            </div>
          </div>
          <button onClick={() => setIsStartShiftModal(true)} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2">
            <LogIn size={16} /> <span>بدء وردية جديدة</span>
          </button>
        </div>
      )}

      {/* Start Shift Modal */}
      <Modal open={isStartShiftModal} onClose={() => setIsStartShiftModal(false)} title="بدء وردية جديدة"
        footer={<div className="flex gap-3 justify-end"><button onClick={() => setIsStartShiftModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button><button onClick={handleStartShift} className="bg-teal hover:bg-teal-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">بدء الوردية</button></div>}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">يرجى تأكيد المبلغ المتواجد حالياً في الدرج قبل بدء الحساب.</p>
          <div>
            <Input label={`العهدة الافتتاحية الفعلية المتوفرة بالدرج (${config.currency})`} type="number" value={startCashInput} onChange={e => setStartCashInput(e.target.value)} placeholder="0" />
            {startCashInput !== '' && Number(startCashInput) !== uncollectedBalance && (
              <p className={`text-xs mt-2 font-medium ${Number(startCashInput) < uncollectedBalance ? 'text-red-600' : 'text-emerald-600'}`}>
                يوجد {Number(startCashInput) < uncollectedBalance ? 'عجز' : 'زيادة'} بقيمة {Math.abs(uncollectedBalance - Number(startCashInput))} {config.currency} عن المتوقع.
              </p>
            )}
          </div>
          <Input label="ملاحظات (سبب التباين إن وجد / اختياري)" value={startNote} onChange={e => setStartNote(e.target.value)} placeholder="..." />
        </div>
      </Modal>

      {/* End Shift Modal */}
      <Modal open={isEndShiftModal} onClose={() => setIsEndShiftModal(false)} title="إغلاق الوردية والمطابقة"
        footer={<div className="flex gap-3 justify-end"><button onClick={() => setIsEndShiftModal(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button><button onClick={handleEndShift} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Check size={15}/> <span>تأكيد الإغلاق</span></button></div>}
      >
        <div className="space-y-5">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">العهدة الافتتاحية:</span><span className="font-semibold text-navy">{activeShift?.startingCash || 0} {config.currency}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">المبيعات النقدية:</span><span className="font-semibold text-teal-600">+{shiftCashSales} {config.currency}</span></div>
            {shiftDeposits > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">إيداعات خارجية:</span><span className="font-semibold text-teal-600">+{shiftDeposits} {config.currency}</span></div>}
            {shiftRepayments > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">سداد ديون:</span><span className="font-semibold text-teal-600">+{shiftRepayments} {config.currency}</span></div>}
            {shiftAdj !== 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">تسويات نقدية:</span><span className={`font-semibold ${shiftAdj > 0 ? 'text-teal-600' : 'text-pink-600'}`}>{shiftAdj > 0 ? '+' : ''}{shiftAdj} {config.currency}</span></div>}
            {shiftSettledCharges > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">تسوية حسابات إدارية:</span><span className="font-semibold text-teal-600">+{shiftSettledCharges} {config.currency}</span></div>}
            {shiftExpenses > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">مصروفات نقدية:</span><span className="font-semibold text-pink-600">-{shiftExpenses} {config.currency}</span></div>}
            {shiftDebts > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">سلف وديون:</span><span className="font-semibold text-pink-600">-{shiftDebts} {config.currency}</span></div>}
            {shiftCollections > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">تحصيلات للخزنة:</span><span className="font-semibold text-pink-600">-{shiftCollections} {config.currency}</span></div>}
            {shiftWithdrawals > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">مسحوبات المشرف:</span><span className="font-semibold text-pink-600">-{shiftWithdrawals} {config.currency}</span></div>}
            <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-base"><span className="text-navy">المتوقع في الدرج:</span><span className="text-indigo-700">{expectedCash} {config.currency}</span></div>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-600 mb-2">كم المبلغ الفعلي الموجود في الدرج الآن لدون النواقص؟</p>
            <Input label={`العهدة الفعلية عند التسليم (${config.currency})`} type="number" value={actualCashInput} onChange={e => setActualCashInput(e.target.value)} placeholder={expectedCash.toString()} />
            {actualCashInput !== '' && Number(actualCashInput) < expectedCash && (
               <p className="text-xs text-red-600 mt-2 font-medium">سيتم تسجيل عجز بقيمة {expectedCash - Number(actualCashInput)} {config.currency}.</p>
            )}
            {actualCashInput !== '' && Number(actualCashInput) > expectedCash && (
               <p className="text-xs text-emerald-600 mt-2 font-medium">سيتم تسجيل زيادة بقيمة {Number(actualCashInput) - expectedCash} {config.currency}.</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Pending Handovers Banner */}
      {pendingHandovers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setHandoverExpanded(prev => !prev)}
            className="w-full px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <HandCoins size={18} className="text-amber-600" />
              </div>
              <div className="text-right">
                <p className="font-bold text-amber-900 text-sm">
                  يوجد {pendingHandovers.length} تسليم عهدة بمبلغ {pendingHandoverTotal.toLocaleString('en-US')} {config.currency} في الانتظار
                </p>
                <p className="text-xs text-amber-600 mt-0.5">اضغط لعرض التفاصيل وتأكيد الاستلام</p>
              </div>
            </div>
            {handoverExpanded ? <ChevronUp size={18} className="text-amber-500" /> : <ChevronDown size={18} className="text-amber-500" />}
          </button>
          {handoverExpanded && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {pendingHandovers.map(h => (
                <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">{h.staffName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(h.orderIds || []).length} طلب — {formatTime(h.createdAt)}
                      {h.note && <span className="text-amber-600 mr-2">({h.note})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-amber-800 text-sm">{(h.amount || 0).toLocaleString('en-US')} {config.currency}</span>
                    <button
                      onClick={() => handleRejectHandover(h.id)}
                      className="px-2.5 py-1.5 bg-white border border-red-200 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-50 cursor-pointer"
                      title="رفض"
                    >
                      <X size={13} />
                    </button>
                    <button
                      onClick={() => handleConfirmHandover(h.id)}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 cursor-pointer flex items-center gap-1"
                    >
                      <Check size={13} /> تأكيد الاستلام
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Users size={16} className="text-indigo-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{todaySessions.length}</p>
            <p className="text-xs text-navy-400">جلسة اليوم</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
            <Clock size={16} className="text-teal-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{activeCount}</p>
            <p className="text-xs text-navy-400">نشط الآن</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-amber-600"/>
          </div>
          <div>
            <p className="text-xl font-bold text-navy">{todayRevenue.toLocaleString('en-US')}</p>
            <p className="text-xs text-navy-400">{config.currency} الإيرادات</p>
          </div>
        </div>
        <div className={`bg-white rounded-2xl border ${totalKitchenCash > 0 ? 'border-amber-300' : 'border-gray-200'} px-4 py-3 shadow-sm flex items-center gap-3`}>
          <div className={`w-9 h-9 rounded-lg ${totalKitchenCash > 0 ? 'bg-amber-100' : 'bg-gray-100'} flex items-center justify-center shrink-0`}>
            <HandCoins size={16} className={totalKitchenCash > 0 ? 'text-amber-600' : 'text-gray-400'}/>
          </div>
          <div>
            <p className={`text-xl font-bold ${totalKitchenCash > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{totalKitchenCash.toLocaleString('en-US')}</p>
            <p className={`text-xs ${totalKitchenCash > 0 ? 'text-amber-600' : 'text-gray-400'}`}>عهدة المطبخ ({config.currency})</p>
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hidden lg:block overflow-x-auto">
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
              pageItems.map(s => {
                const inv  = invoices.find(i => i.sessionId === s.id);
                const mins = s.status === 'active'
                  ? calcElapsedMinutes(s.checkInTime)
                  : s.checkOutTime
                    ? Math.floor((new Date(s.checkOutTime) - new Date(s.checkInTime)) / 60000)
                    : 0;
                return (
                  <tr key={s.id} onClick={() => setDetailSessionId(s.id)} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 cursor-pointer">
                    <td className="px-4 py-3"><button onClick={(e) => { e.stopPropagation(); onStudentClick?.(s.studentId); }} className="font-semibold text-navy hover:text-indigo-600 hover:underline cursor-pointer transition-colors">{s.studentName}</button></td>
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
        <Pagination page={page} pageCount={pageCount} setPage={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} isFirstPage={isFirstPage} isLastPage={isLastPage} />
      </div>

      {/* Mobile session cards */}
      <div className="lg:hidden space-y-3">
        {shown.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-navy-400 text-sm">لا توجد بيانات</div>
        ) : (
          pageItems.map(s => {
            const inv = invoices.find(i => i.sessionId === s.id);
            const mins = s.status === 'active'
              ? calcElapsedMinutes(s.checkInTime)
              : s.checkOutTime
                ? Math.floor((new Date(s.checkOutTime) - new Date(s.checkInTime)) / 60000)
                : 0;
            return (
              <div key={s.id} onClick={() => setDetailSessionId(s.id)} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={(e) => { e.stopPropagation(); onStudentClick?.(s.studentId); }} className="font-semibold text-navy hover:text-indigo-600 text-sm">{s.studentName}</button>
                  <Badge variant={s.status === 'active' ? 'teal' : 'gray'}>
                    {s.status === 'active' ? 'نشط' : 'مغلق'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-navy-500">
                  <div className="flex items-center gap-3">
                    <span>{formatTime(s.checkInTime)}</span>
                    <span>&rarr;</span>
                    <span>{s.checkOutTime ? formatTime(s.checkOutTime) : '—'}</span>
                  </div>
                  <span className="font-mono">{Math.floor(mins/60)}h {mins%60}m</span>
                </div>
                {inv && (
                  <div className="mt-2 text-left">
                    <span className="font-semibold text-teal-600 text-sm">{inv.total.toLocaleString('en-US')} {config.currency}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        <Pagination page={page} pageCount={pageCount} setPage={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} isFirstPage={isFirstPage} isLastPage={isLastPage} />
      </div>

      <SessionDetailModal
        sessionId={detailSessionId}
        onClose={() => setDetailSessionId(null)}
        config={config}
        onStudentClick={onStudentClick}
      />
    </div>
  );
}
