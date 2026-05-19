import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Wallet, Search, TrendingUp, TrendingDown, Users,
  Phone, GraduationCap, History, X, ArrowUpRight, ArrowDownLeft,
  CreditCard, Trash2, Plus, Minus, AlertCircle, Calendar, Clock,
  CheckCircle2, XCircle, Loader2, FileText, Ban
} from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { formatDate, searchStudents, generateId, logActivity, supabase, settleStudentDebts } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';
import { RefreshButton } from '../../components/ui';

/* ═══════════════════════════════════════════════════════════════
   Student Detail Modal — wallet + subscriptions in one panel
   ═══════════════════════════════════════════════════════════════ */
function StudentDetailModal({ student, walletTxs, onClose, config, user, onDeleteTx, onAdjust, shifts }) {
  const [detailTab, setDetailTab] = useState('wallet'); // 'wallet' | 'subscriptions' | 'debts'
  const [subs, setSubs] = useState(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [debtRecords, setDebtRecords] = useState(null);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayNote, setRepayNote] = useState('');
  // Single lock shared by repay + write-off (mutually exclusive actions on the same row of buttons)
  const { run: runDebtAction, isLocked: repaying } = useSubmitLock();

  const cur = config?.currency ?? 'ج.م';
  const bal = student.walletBalance ?? 0;

  // Load subscriptions on first tab switch
  const loadSubs = async () => {
    if (subs !== null) return;
    setSubsLoading(true);
    try {
      const { data } = await supabase
        .from('student_subscriptions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });
      setSubs(data || []);
    } catch {
      setSubs([]);
    } finally {
      setSubsLoading(false);
    }
  };

  // Load debts on first tab switch
  const loadDebts = async () => {
    if (debtRecords !== null) return;
    setDebtsLoading(true);
    try {
      const { data } = await supabase
        .from('debts')
        .select('*')
        .eq('person_id', student.id)
        .eq('person_type', 'student')
        .order('created_at', { ascending: false });
      setDebtRecords(data || []);
    } catch {
      setDebtRecords([]);
    } finally {
      setDebtsLoading(false);
    }
  };

  const netDebt = (debtRecords || []).reduce((sum, d) => {
    const t = d.type || d.type;
    return t === 'borrow' ? sum + (d.amount || 0) : sum - (d.amount || 0);
  }, 0);

  const activeShift = shifts?.find(s => s.cashierId === user.id && s.status === 'active');

  const handleRepay = () => runDebtAction(async () => {
    const amt = Number(repayAmount);
    if (!amt || amt <= 0) return;
    const now = new Date().toISOString();
    try {
      const record = {
        id: generateId('debt'),
        person_id: student.id,
        person_name: student.name,
        person_type: 'student',
        type: 'repay',
        amount: amt,
        note: repayNote || 'سداد دين',
        cashier_id: user.id === 'admin' ? null : user.id,
        cashier_name: user.name || '',
        created_at: now,
      };
      const { error } = await supabase.from('debts').upsert(record, { onConflict: 'id' });
      if (error) throw error;
      setDebtRecords(prev => [record, ...(prev || [])]);
      logActivity('سداد دين', `${student.name} — ${amt} ${cur}`, user.id);
      setRepayAmount('');
      setRepayNote('');
    } catch (err) {
      alert(`خطأ: ${err.message || 'فشل سداد الدين'}`);
    }
  });

  const handleWriteOff = () => runDebtAction(async () => {
    if (netDebt <= 0) return;
    if (!confirm(`هل أنت متأكد من إلغاء الدين (${netDebt} ${cur})؟ سيتم تسجيل مصروف مقابل.`)) return;
    const now = new Date().toISOString();
    try {
      const repayRecord = {
        id: generateId('debt'),
        person_id: student.id,
        person_name: student.name,
        person_type: 'student',
        type: 'repay',
        amount: netDebt,
        note: 'إلغاء دين (write-off)',
        cashier_id: user.id === 'admin' ? null : user.id,
        cashier_name: user.name || '',
        created_at: now,
      };
      const expenseRecord = {
        id: generateId('exp'),
        amount: netDebt,
        description: `إلغاء دين — ${student.name}`,
        category: 'إلغاء ديون',
        date: now.slice(0, 10),
        payment_method: 'cash',
        shift_id: activeShift?.id || null,
        staff_id: user.id === 'admin' ? null : user.id,
        created_at: now,
      };
      const [r1, r2] = await Promise.all([
        supabase.from('debts').upsert(repayRecord, { onConflict: 'id' }),
        supabase.from('expenses').upsert(expenseRecord, { onConflict: 'id' }),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      setDebtRecords(prev => [repayRecord, ...(prev || [])]);
      logActivity('إلغاء دين', `${student.name} — ${netDebt} ${cur}`, user.id);
    } catch (err) {
      alert(`خطأ: ${err.message || 'فشل إلغاء الدين'}`);
    }
  });

  const history = walletTxs
    .filter(t => t.studentId === student.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const todayStr = new Date().toISOString().slice(0, 10);

  const effectiveStatus = sub => {
    if (sub.status !== 'active') return sub.status;
    const expiry = sub.expiry_date || sub.expiryDate;
    if (expiry && expiry < todayStr) return 'expired';
    return 'active';
  };

  const statusLabel = s => s === 'active' ? 'نشط' : s === 'expired' ? 'منتهي' : s === 'cancelled' ? 'ملغى' : 'مستنفد';
  const statusCls = s => s === 'active'
    ? 'bg-teal-100 text-teal-700'
    : s === 'cancelled' ? 'bg-red-100 text-red-700'
    : 'bg-gray-200 text-gray-600';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      dir="rtl"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                {(student.name || '؟').split(' ').slice(0, 2).map(w => w[0]).join('')}
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-navy text-sm sm:text-base truncate">{student.name}</h2>
                <p className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1.5 sm:gap-2">
                  {student.memberNumber && <span className="font-mono"># {student.memberNumber}</span>}
                  {student.phone && <span className="flex items-center gap-0.5"><Phone size={10} /> {student.phone}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className={`font-bold text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full ${bal < 0 ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
                {bal >= 0 ? '+' : ''}{bal.toLocaleString()} {cur}
              </span>
              <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer transition-all">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setDetailTab('wallet')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer ${detailTab === 'wallet' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
            >
              <Wallet size={13} /> المحفظة
            </button>
            <button
              onClick={() => { setDetailTab('subscriptions'); loadSubs(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer ${detailTab === 'subscriptions' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
            >
              <Calendar size={13} /> الاشتراكات
            </button>
            <button
              onClick={() => { setDetailTab('debts'); loadDebts(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer ${detailTab === 'debts' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
            >
              <FileText size={13} /> ديون
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Wallet Tab ── */}
          {detailTab === 'wallet' && (
            <div>
              {/* Action row */}
              <div className="px-4 sm:px-6 py-3 border-b border-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400 font-medium">{history.length} معاملة</p>
                <button
                  onClick={() => onAdjust(student)}
                  className="flex items-center gap-1.5 min-h-[44px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus size={12} /> تعديل الرصيد
                </button>
              </div>

              {history.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <History size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">لا يوجد سجل معاملات</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map(tx => {
                    const isTopup = tx.type === 'topup';
                    return (
                      <div key={tx.id} className="px-4 sm:px-6 py-3.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isTopup ? 'bg-teal-50 text-teal-600' : 'bg-red-50 text-red-500'}`}>
                            {isTopup ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-navy">{isTopup ? 'شحن رصيد' : 'خصم رصيد'}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(tx.createdAt)}</p>
                            {tx.note && <p className="text-[10px] text-gray-500 mt-0.5 max-w-[200px] truncate">{tx.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <p className={`font-bold text-sm ${isTopup ? 'text-teal-600' : 'text-red-500'}`}>
                              {isTopup ? '+' : '-'}{Number(tx.amount).toLocaleString()} {cur}
                            </p>
                            {tx.balanceAfter != null && (
                              <p className="text-[10px] text-gray-400">الرصيد: {Number(tx.balanceAfter).toLocaleString()}</p>
                            )}
                          </div>
                          <button
                            onClick={() => onDeleteTx(tx)}
                            className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="حذف العملية"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Subscriptions Tab ── */}
          {detailTab === 'subscriptions' && (
            <div className="p-4 sm:p-5">
              {subsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-indigo-400" />
                </div>
              ) : !subs || subs.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Calendar size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">لا توجد اشتراكات</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subs.map(sub => {
                    const eff = effectiveStatus(sub);
                    return (
                      <div
                        key={sub.id}
                        className={`rounded-xl border p-3 sm:p-4 ${
                          eff === 'active' ? 'border-teal-200 bg-teal-50/60' :
                          eff === 'cancelled' ? 'border-red-200 bg-red-50/40' :
                          'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <p className="font-semibold text-navy text-sm">{sub.plan_name}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCls(eff)}`}>
                            {statusLabel(eff)}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            المتبقي: <strong className="text-navy mr-1">{sub.remaining_quota} / {sub.total_quota} {sub.quota_type === 'hours' ? 'ساعة' : 'يوم'}</strong>
                          </span>
                          <span>يبدأ: <strong className="text-navy">{sub.start_date}</strong></span>
                          <span>ينتهي: <strong className="text-navy">{sub.expiry_date}</strong></span>
                          {sub.quota_type === 'days' && sub.used_dates?.length > 0 && (
                            <span>مستخدم: <strong className="text-navy">{sub.used_dates.length} يوم</strong></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Debts Tab ── */}
          {detailTab === 'debts' && (
            <div className="p-4 sm:p-5">
              {debtsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-indigo-400" />
                </div>
              ) : (
                <>
                  {/* Net debt summary */}
                  <div className={`rounded-xl border p-4 mb-4 ${netDebt > 0 ? 'bg-red-50 border-red-200' : 'bg-teal-50 border-teal-200'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">صافي المديونية</p>
                    <p className={`text-2xl font-black ${netDebt > 0 ? 'text-red-600' : 'text-teal-600'}`}>
                      {netDebt > 0 ? netDebt.toLocaleString() : 0} <span className="text-sm font-semibold opacity-60">{cur}</span>
                    </p>
                  </div>

                  {/* Repay form */}
                  {netDebt > 0 && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mb-4 space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">سداد دين</p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={repayAmount}
                          onChange={e => setRepayAmount(e.target.value)}
                          placeholder={`المبلغ (${cur})`}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                          dir="rtl"
                        />
                        <button
                          onClick={handleRepay}
                          disabled={!repayAmount || Number(repayAmount) <= 0 || repaying}
                          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[44px] flex items-center gap-1.5"
                        >
                          {repaying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          سداد
                        </button>
                      </div>
                      <input
                        type="text"
                        value={repayNote}
                        onChange={e => setRepayNote(e.target.value)}
                        placeholder="ملاحظة (اختياري)"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
                        dir="rtl"
                      />
                      <button
                        onClick={handleWriteOff}
                        disabled={repaying}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg py-2 transition-colors cursor-pointer min-h-[44px]"
                      >
                        <Ban size={12} />
                        إلغاء الدين بالكامل (write-off)
                      </button>
                    </div>
                  )}

                  {/* Debt records list */}
                  {!debtRecords || debtRecords.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                      <FileText size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm">لا يوجد سجل ديون</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {debtRecords.map(d => {
                        const isBorrow = d.type === 'borrow';
                        return (
                          <div key={d.id} className="flex items-center justify-between py-3 px-1">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isBorrow ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-600'}`}>
                                {isBorrow ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-navy">{isBorrow ? 'سلفة / دين' : 'سداد'}</p>
                                <p className="text-[10px] text-gray-400">{formatDate(d.created_at)}</p>
                                {d.note && <p className="text-[10px] text-gray-500 mt-0.5 max-w-[180px] truncate">{d.note}</p>}
                              </div>
                            </div>
                            <span className={`font-bold text-sm ${isBorrow ? 'text-red-600' : 'text-teal-600'}`}>
                              {isBorrow ? '-' : '+'}{Number(d.amount).toLocaleString()} {cur}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════
   Adjustment Modal
   ═══════════════════════════════════════════════════════════════ */
function AdjustmentModal({ student, config, user, shifts, onClose, onDone }) {
  const [form, setForm] = useState({ amount: '', note: '', type: 'topup', paymentMethod: 'cash' });
  const { run: runAdjustment, isLocked: saving } = useSubmitLock();

  const cur = config?.currency ?? 'ج.م';
  const activeShift = shifts.find(s => s.cashierId === user.id && s.status === 'active');

  const handleSubmit = () => runAdjustment(async () => {
    if (!form.amount) return;
    const amount = Number(form.amount);
    const type = form.type;
    const balanceBefore = student.walletBalance || 0;
    const now = new Date().toISOString();

    try {
      const writes = [];

      if (type === 'topup') {
        // Auto-settle outstanding debts first, leftover goes to wallet.
        // Fetch fresh debt rows to avoid stale local state.
        const { data: dbDebts } = await supabase
          .from('debts')
          .select('*')
          .eq('person_id', student.id)
          .eq('person_type', 'student');
        const debtsCamel = (dbDebts || []).map(d => ({
          id: d.id,
          personId: d.person_id,
          personType: d.person_type,
          type: d.type,
          source: d.source,
          amount: d.amount,
          createdAt: d.created_at,
        }));

        const { writes: settleWrites, walletAfter, walletAdded, debtPaid } = settleStudentDebts({
          studentId: student.id,
          studentName: student.name,
          cashIn: amount,
          debts: debtsCamel,
          walletBalance: balanceBefore,
          cashierId: user.id === 'admin' ? null : user.id,
          cashierName: user.name || '',
          invoiceId: null,
          now,
        });
        writes.push(...settleWrites);

        // Persist the new wallet balance (helper does NOT do this).
        if (walletAfter !== balanceBefore) {
          writes.push(
            supabase.from('students').update({ wallet_balance: walletAfter }).eq('id', student.id)
          );
        }

        // Invoice for wallet-portion only. Repay rows already count toward
        // drawer income via calcDrawerExpected.repayments, so invoicing the
        // full amount would double-count cash.
        if (walletAdded > 0) {
          writes.push(supabase.from('invoices').insert(toSnake({
            id: generateId('inv'),
            shiftId: activeShift?.id || null,
            studentId: student.id,
            studentName: student.name,
            billingType: 'topup',
            priceType: 'topup',
            pricingLabel: `شحن يدوي${form.note ? ` - ${form.note}` : ''}`,
            amount: walletAdded,
            kitchenTotal: 0,
            total: walletAdded,
            paymentMethod: form.paymentMethod,
            cashierId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          })));
        }

        const results = await Promise.all(writes);
        const err = results.find(r => r?.error);
        if (err) throw err.error;

        const summary = debtPaid > 0 && walletAdded > 0
          ? `سداد ${debtPaid} + شحن ${walletAdded} ${cur}`
          : debtPaid > 0
            ? `سداد دين ${debtPaid} ${cur}`
            : `شحن ${walletAdded} ${cur}`;
        logActivity('تعديل محفظة يدوي', `${student.name} — ${summary}`, user.id);
      } else {
        // Charge: deduct from wallet only. Wallet invariant: cannot go below 0.
        if (amount > balanceBefore) {
          alert(`لا يمكن الخصم — رصيد المحفظة ${balanceBefore} ${cur} غير كافٍ. سجّل دَيْنًا عبر سياق الجلسة/المطبخ بدلاً من خصم الرصيد.`);
          return;
        }
        const balanceAfter = balanceBefore - amount;
        const tx = {
          id: generateId('wtx'),
          studentId: student.id,
          studentName: student.name,
          type: 'deduct',
          amount,
          balanceBefore,
          balanceAfter,
          note: form.note || 'تعديل يدوي (خصم)',
          invoiceId: null,
          staffId: user.id === 'admin' ? null : user.id,
          createdAt: now,
        };
        writes.push(
          supabase.from('students').update({ wallet_balance: balanceAfter }).eq('id', student.id),
          supabase.from('wallet_transactions').insert(toSnake(tx)),
        );
        const results = await Promise.all(writes);
        const err = results.find(r => r?.error);
        if (err) throw err.error;
        logActivity('تعديل محفظة يدوي', `${student.name} — -${amount} ${cur}`, user.id);
      }

      onDone();
    } catch (err) {
      console.error('Adjustment Error:', err);
      alert(`حدث خطأ أثناء حفظ التعديل: ${err.message || 'خطأ غير معروف'}`);
    }
  });

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" dir="rtl" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-right">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="font-bold text-navy text-sm sm:text-base truncate">تعديل رصيد: {student.name}</h2>
          <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer transition-all shrink-0"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => setForm(f => ({ ...f, type: 'topup' }))}
              className={`min-h-[44px] py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${form.type === 'topup' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-100 text-gray-400'}`}
            >
              <Plus size={14} /> شحن رصيد
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, type: 'charge' }))}
              className={`min-h-[44px] py-2.5 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${form.type === 'charge' ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-100 text-gray-400'}`}
            >
              <Minus size={14} /> خصم رصيد
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">المبلغ ({cur})</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300" dir="rtl" autoFocus />
          </div>

          {form.type === 'topup' && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">طريقة الدفع</label>
              <div className="flex gap-2">
                {['cash', 'transfer', 'instapay'].map(m => (
                  <button key={m} onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                    className={`flex-1 min-h-[44px] py-2 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${form.paymentMethod === m ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-gray-100 text-gray-400'}`}>
                    {m === 'cash' ? 'نقدي' : m === 'transfer' ? 'تحويل' : 'InstaPay'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">سبب التعديل (اختياري)</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-300" dir="rtl" placeholder="مثال: تصحيح خطأ، استرداد مبلغ..." />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 leading-relaxed text-right">سيتم تعديل رصيد الطالب فوراً وسيكتمل الإجراء بتسجيل معاملة جديدة في السجل.</p>
          </div>

          <button onClick={handleSubmit} disabled={!form.amount || saving}
            className="w-full min-h-[44px] bg-navy text-white py-3.5 rounded-2xl font-bold transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-navy/20">
            {saving ? 'جاري الحفظ…' : 'تأكيد التعديل'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Wallets View
   ═══════════════════════════════════════════════════════════════ */
export default function Wallets({ config, user }) {
  const [students, saveStudents, refreshStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [walletTxs, saveWalletTxs, refreshWalletTxs] = useStorage(STORAGE_KEYS.WALLET_TRANSACTIONS, []);
  const [shifts, , refreshShifts] = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [debts, , refreshDebts] = useStorage(STORAGE_KEYS.DEBTS, []);

  const handleRefresh = () => Promise.all([refreshStudents(), refreshWalletTxs(), refreshShifts(), refreshDebts()]);

  const [tab, setTab] = useState('credit');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);   // student for detail modal
  const [adjStudent, setAdjStudent] = useState(null); // student for adjustment modal

  const cur = config?.currency ?? 'ج.م';

  // ── Per-student outstanding debt (from debts table, single source of truth) ──
  const studentDebtMap = useMemo(() => {
    const map = new Map();
    for (const d of debts) {
      if (d.personType !== 'student') continue;
      const delta = d.type === 'borrow' ? (d.amount || 0) : -(d.amount || 0);
      map.set(d.personId, (map.get(d.personId) || 0) + delta);
    }
    return map;
  }, [debts]);

  const getDebt = (id) => Math.max(0, studentDebtMap.get(id) || 0);

  // ── Split students ──
  // credit tab: positive wallet OR zero with no debt (all "clean" students)
  // debt tab: outstanding net debt > 0 in debts table
  const debtStudents = useMemo(
    () => students.filter(s => getDebt(s.id) > 0).sort((a, b) => getDebt(b.id) - getDebt(a.id)),
    [students, studentDebtMap]
  );

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list;
    if (search.trim()) {
      list = students;
    } else if (tab === 'credit') {
      list = students.filter(s => (s.walletBalance ?? 0) > 0);
    } else {
      list = debtStudents;
    }
    if (!search.trim()) {
      return tab === 'credit'
        ? list.sort((a, b) => (b.walletBalance ?? 0) - (a.walletBalance ?? 0))
        : list;
    }
    return searchStudents(list, search);
  }, [students, tab, search, debtStudents]);

  // ── Totals — credit tab sums wallets, debt tab sums outstanding debts ──
  const filteredSum = useMemo(() => {
    if (tab === 'credit') {
      return Math.round(filtered.reduce((s, st) => s + (st.walletBalance || 0), 0));
    }
    return Math.round(filtered.reduce((s, st) => s + getDebt(st.id), 0));
  }, [filtered, tab, studentDebtMap]);

  // ── Delete transaction ──
  const handleDeleteTx = async (tx) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟ سيتم عكس تأثيرها على الرصيد.')) return;
    const student = students.find(s => s.id === tx.studentId);
    if (!student) return;
    const diff = tx.type === 'topup' ? -tx.amount : tx.amount;
    const newBalance = (student.walletBalance || 0) + diff;
    try {
      await saveStudents(prev => prev.map(s => s.id === student.id ? { ...s, walletBalance: newBalance } : s));
      await saveWalletTxs(prev => prev.filter(t => t.id !== tx.id));
      logActivity('حذف معاملة محفظة', `حذف ${tx.type === 'topup' ? 'شحن' : 'خصم'} بقيمة ${tx.amount} للطالب ${student.name}`, 'admin');
      if (selected?.id === student.id) setSelected({ ...student, walletBalance: newBalance });
    } catch (err) {
      console.error('Delete Tx Error:', err);
      alert(`حدث خطأ أثناء الحذف: ${err.message || 'خطأ غير معروف'}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Wallet size={22} className="text-indigo-500" /> المحافظ
          </h1>
          <p className="text-sm text-gray-400 mt-1">رصيد الطلاب — أرصدة دائنة ومديونيات</p>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* Summary Cards — computed from filtered list so totals match table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tab === 'credit' ? (
          <>
            <SummaryCard icon={<TrendingUp size={18} className="text-teal-600" />} bg="bg-teal-50" label="طلاب برصيد" value={filtered.length} unit="طالب" valueClass="text-teal-700" />
            <SummaryCard icon={<Wallet size={18} className="text-teal-600" />} bg="bg-teal-50" label="إجمالي الأرصدة" value={filteredSum.toLocaleString()} unit={cur} valueClass="text-teal-700" />
          </>
        ) : (
          <>
            <SummaryCard icon={<TrendingDown size={18} className="text-red-500" />} bg="bg-red-50" label="طلاب عليهم دَيْن" value={filtered.length} unit="طالب" valueClass="text-red-600" />
            <SummaryCard icon={<CreditCard size={18} className="text-red-500" />} bg="bg-red-50" label="إجمالي المديونيات" value={Math.abs(filteredSum).toLocaleString()} unit={cur} valueClass="text-red-600" />
          </>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl shrink-0">
          <TabBtn active={tab === 'credit'} onClick={() => setTab('credit')}>
            الأرصدة ({students.filter(s => (s.walletBalance ?? 0) > 0).length})
          </TabBtn>
          <TabBtn active={tab === 'debt'} onClick={() => setTab('debt')}>
            المديونيات ({debtStudents.length})
          </TabBtn>
        </div>
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="بحث بالاسم أو الجوال أو الكود…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full min-h-[44px] bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300" dir="rtl" />
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">لا يوجد طلاب</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3">الطالب</th>
                    <th className="px-5 py-3">الجوال</th>
                    <th className="px-5 py-3">الجامعة / الكلية</th>
                    <th className="px-5 py-3">الرصيد</th>
                    <th className="px-5 py-3 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(st => {
                    const wallet = st.walletBalance ?? 0;
                    const debt = getDebt(st.id);
                    const showDebt = tab === 'debt' && debt > 0;
                    return (
                      <tr key={st.id} className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer" onClick={() => setSelected(st)}>
                        <td className="px-5 py-4">
                          <button type="button" onClick={e => { e.stopPropagation(); setSelected(st); }} className="font-semibold text-navy hover:text-indigo-600 hover:underline cursor-pointer transition-colors text-right">{st.name}</button>
                          {st.memberNumber && <p className="text-[10px] text-gray-400 font-mono"># {st.memberNumber}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} /> {st.phone || '—'}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">
                          {st.university || st.college ? (
                            <span className="flex items-center gap-1"><GraduationCap size={11} /> {[st.university, st.college].filter(Boolean).join(' / ')}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`font-bold text-sm px-3 py-1 rounded-full ${showDebt ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
                            {showDebt ? `-${debt.toLocaleString()}` : `+${wallet.toLocaleString()}`} {cur}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-left">
                          <button
                            onClick={e => { e.stopPropagation(); setAdjStudent(st); }}
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all cursor-pointer"
                            title="تعديل الرصيد"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filtered.map(st => {
                const wallet = st.walletBalance ?? 0;
                const debt = getDebt(st.id);
                const showDebt = tab === 'debt' && debt > 0;
                const recentTxs = walletTxs
                  .filter(t => t.studentId === st.id)
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .slice(0, 2);
                return (
                  <div key={st.id} className="p-4 hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelected(st)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy text-sm truncate">{st.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                          {st.memberNumber && <span className="font-mono"># {st.memberNumber}</span>}
                          {st.phone && <span className="flex items-center gap-0.5"><Phone size={10} /> {st.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-bold text-sm px-3 py-1 rounded-full ${showDebt ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}`}>
                          {showDebt ? `-${debt.toLocaleString()}` : `+${wallet.toLocaleString()}`} {cur}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); setAdjStudent(st); }}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all cursor-pointer"
                          title="تعديل الرصيد"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                    {recentTxs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {recentTxs.map(tx => {
                          const isTopup = tx.type === 'topup';
                          return (
                            <div key={tx.id} className="flex items-center justify-between text-[11px] bg-gray-50 rounded-lg px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                {isTopup ? <ArrowUpRight size={11} className="text-teal-500" /> : <ArrowDownLeft size={11} className="text-red-400" />}
                                <span className="text-gray-500">{isTopup ? 'شحن' : 'خصم'}</span>
                                <span className="text-gray-400">{formatDate(tx.createdAt)}</span>
                              </div>
                              <span className={`font-bold ${isTopup ? 'text-teal-600' : 'text-red-500'}`}>
                                {isTopup ? '+' : '-'}{Number(tx.amount).toLocaleString()} {cur}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Student Detail Modal (wallet + subscriptions + debts) ── */}
      {selected && (
        <StudentDetailModal
          student={selected}
          walletTxs={walletTxs}
          config={config}
          user={user}
          shifts={shifts}
          onClose={() => setSelected(null)}
          onDeleteTx={handleDeleteTx}
          onAdjust={(st) => { setAdjStudent(st); }}
        />
      )}

      {/* ── Adjustment Modal ── */}
      {adjStudent && (
        <AdjustmentModal
          student={adjStudent}
          config={config}
          user={user}
          shifts={shifts}
          onClose={() => setAdjStudent(null)}
          onDone={() => setAdjStudent(null)}
        />
      )}
    </div>
  );
}

/* ── Helpers ── */
function SummaryCard({ icon, bg, label, value, unit, valueClass }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value} <span className="text-xs font-normal text-gray-400">{unit}</span></p>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer ${active ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}>
      {children}
    </button>
  );
}
