import { useState, useMemo } from 'react';
import { Receipt, Check, AlertCircle, X, Search } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { supabase, formatDate, formatDateTime, localDateStr } from '../../utils';
import { Modal, RefreshButton, Pagination } from '../../components/ui';
import { usePagination } from '../../hooks/usePagination';

export default function AdminCharges({ user, config, toast, onStudentClick }) {
  const [charges, saveCharges, refreshCharges] = useStorage(STORAGE_KEYS.ADMIN_CHARGES, []);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'settled'
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'session' | 'kitchen'
  // `settling` keeps the per-row id so buttons display "settling" state per row.
  // The submit-lock prevents concurrent settle calls (single-row OR bulk) racing
  // — if user hammers two settle buttons, the second runs after the first
  // releases. The id is purely for UI feedback, not safety.
  const [settling, setSettling] = useState(null);
  const { run: runSettle } = useSubmitLock();
  const [staffModal, setStaffModal] = useState(null); // { adminId, name } for per-staff drill-down

  const todayStr = localDateStr(new Date());
  const [searchTerm, setSearchTerm]       = useState('');
  const [period, setPeriod]               = useState('all');
  const [selectedDay, setSelectedDay]     = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(0, 7));

  const periodFilter = (d) => {
    if (period === 'day')   return localDateStr(new Date(d.createdAt)) === selectedDay;
    if (period === 'month') return (d.createdAt || '').slice(0, 7) === selectedMonth;
    return true;
  };

  const filtered = useMemo(() => {
    let list = charges.filter(periodFilter);
    if (filter === 'pending') list = list.filter(c => !c.settled);
    if (filter === 'settled') list = list.filter(c => c.settled);
    if (sourceFilter === 'session') list = list.filter(c => c.source !== 'kitchen');
    if (sourceFilter === 'kitchen') list = list.filter(c => c.source === 'kitchen');
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c =>
        (c.adminName || '').toLowerCase().includes(q) ||
        (c.studentName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [charges, filter, sourceFilter, period, selectedDay, selectedMonth, searchTerm]);

  const handleRefresh = () => refreshCharges();
  const { page, pageCount, pageItems, setPage, startIndex, endIndex, totalItems, isFirstPage, isLastPage } = usePagination(filtered, 25);

  // Group by admin for summary cards (both session & kitchen are debts ON the staff)
  const byAdmin = useMemo(() => {
    const map = {};
    charges.filter(c => !c.settled).filter(periodFilter).forEach(c => {
      if (!map[c.adminId]) map[c.adminId] = { adminId: c.adminId, name: c.adminName, sessionTotal: 0, kitchenTotal: 0 };
      if (c.source === 'kitchen') {
        map[c.adminId].kitchenTotal += c.amount || 0;
      } else {
        map[c.adminId].sessionTotal += c.amount || 0;
      }
    });
    return Object.values(map).map(a => ({ ...a, debt: a.sessionTotal + a.kitchenTotal }));
  }, [charges, period, selectedDay, selectedMonth]);

  const totalPending = byAdmin.reduce((s, a) => s + a.debt, 0);

  const handleBulkSettle = (adminId, adminName) => runSettle(async () => {
    const pending = charges.filter(c => c.adminId === adminId && !c.settled).filter(periodFilter);
    if (!pending.length) { toast('لا توجد مديونيات معلقة', 'info'); return; }
    const ids = pending.map(c => c.id);
    // Both session and kitchen sources are debts the staff owes — sum positive.
    // (Previously kitchen was subtracted, giving |session - kitchen| in the toast
    // which under-reported the settled amount when staff had mixed-source debts.)
    const total = pending.reduce((s, c) => s + (c.amount || 0), 0);
    setSettling('bulk-' + adminId);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('admin_charges')
        .update({ settled: true, settled_at: now })
        .in('id', ids);
      if (error) throw error;
      const idSet = new Set(ids);
      saveCharges(prev => prev.map(c => idSet.has(c.id) ? { ...c, settled: true, settledAt: now } : c));
      toast(`تمت تسوية ${ids.length} سجل — ${total.toLocaleString('en-US')} ${config.currency}`, 'success');
      setStaffModal(null);
    } catch (err) {
      toast(err?.message || 'حدث خطأ', 'error');
    } finally {
      setSettling(null);
    }
  });

  const handleSettle = (charge) => runSettle(async () => {
    setSettling(charge.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('admin_charges')
        .update({ settled: true, settled_at: now })
        .eq('id', charge.id);
      if (error) throw error;

      saveCharges(prev => prev.map(c => c.id === charge.id ? { ...c, settled: true, settledAt: now } : c));
      toast('تمت التسوية', 'success');
    } catch (err) {
      toast(err?.message || 'حدث خطأ', 'error');
    } finally {
      setSettling(null);
    }
  });

  return (
    <div className="space-y-5 fade-in p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">مديونيات الموظفين</h1>
          <RefreshButton onRefresh={handleRefresh} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { key: 'day',   label: 'يوم'  },
              { key: 'month', label: 'شهر'  },
              { key: 'all',   label: 'الكل' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${period === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'day' && (
            <input type="date" value={selectedDay} max={todayStr}
              onChange={e => setSelectedDay(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-navy outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer" />
          )}
          {period === 'month' && (
            <input type="month" value={selectedMonth} max={todayStr.slice(0,7)}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-medium text-navy outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer" />
          )}
        </div>
      </div>

      {/* Summary cards */}
      {byAdmin.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {byAdmin.map((a, i) => (
            <div key={i} onClick={() => setStaffModal(a)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 cursor-pointer hover:border-red-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-100">
                  <Receipt size={16} className="text-red-600"/>
                </div>
                <p className="font-semibold text-navy text-sm">{a.name}</p>
                <span className="mr-auto text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">اضغط للتفاصيل</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {a.debt.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {config.currency} مدين
              </p>
              {(a.sessionTotal > 0 || a.kitchenTotal > 0) && (
                <div className="flex gap-3 mt-2 text-[10px]">
                  {a.sessionTotal > 0 && (
                    <span className="text-red-500">جلسات: {a.sessionTotal.toLocaleString('en-US')}</span>
                  )}
                  {a.kitchenTotal > 0 && (
                    <span className="text-red-500">مطبخ: {a.kitchenTotal.toLocaleString('en-US')}</span>
                  )}
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleBulkSettle(a.adminId, a.name); }}
                disabled={settling === 'bulk-' + a.adminId}
                className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <Check size={12}/>تسوية مجمعة
              </button>
            </div>
          ))}
        </div>
      )}

      {byAdmin.length === 0 && charges.filter(c => !c.settled).length === 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
          <Check size={18} className="text-teal-600"/>
          <p className="text-sm text-teal-700 font-medium">لا توجد مديونيات معلقة</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'all',     label: 'الكل' },
            { key: 'pending', label: 'غير مسددة' },
            { key: 'settled', label: 'مسددة' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                filter === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'all',     label: 'كل المصادر' },
            { key: 'session', label: 'جلسات' },
            { key: 'kitchen', label: 'طلبات مطبخ' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSourceFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                sourceFilter === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            dir="rtl"
          />
        </div>
      </div>

      {/* Charges table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">لا توجد سجلات</td>
                </tr>
              ) : pageItems.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-navy">{c.adminName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-2">
                      {c.studentId ? <button onClick={() => onStudentClick?.(c.studentId)} className="font-medium text-navy hover:text-indigo-600 hover:underline cursor-pointer transition-colors">{c.studentName}</button> : <span>{c.studentName || '—'}</span>}
                      {c.source === 'kitchen' ? (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">طلب مطبخ</span>
                      ) : (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">جلسة</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-red-600">
                      {(c.amount || 0).toLocaleString('en-US')} {config.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {c.settled ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        <Check size={10}/>مسددة
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        <AlertCircle size={10}/>معلقة
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.settled && (
                      <button
                        onClick={() => handleSettle(c)}
                        disabled={settling === c.id}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={11}/>تسوية
                      </button>
                    )}
                    {c.settled && c.settledAt && (
                      <span className="text-xs text-gray-400">{c.settledAt.slice(0, 10)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400">لا توجد سجلات</div>
          ) : pageItems.map(c => (
            <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors duration-150">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-navy">{c.adminName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {c.studentId ? <button onClick={() => onStudentClick?.(c.studentId)} className="text-xs text-gray-600 hover:text-indigo-600 hover:underline cursor-pointer transition-colors">{c.studentName}</button> : <span className="text-xs text-gray-500">{c.studentName || '—'}</span>}
                    {c.source === 'kitchen' ? (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">مطبخ</span>
                    ) : (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">جلسة</span>
                    )}
                  </div>
                </div>
                {c.settled ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                    <Check size={10}/>مسددة
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    <AlertCircle size={10}/>معلقة
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-600">
                  {(c.amount || 0).toLocaleString('en-US')} {config.currency}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
              </div>
              {!c.settled && (
                <button
                  onClick={() => handleSettle(c)}
                  disabled={settling === c.id}
                  className="mt-2 w-full bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1 min-h-[44px]"
                >
                  <Check size={11}/>تسوية
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} isFirstPage={isFirstPage} isLastPage={isLastPage} />

      {/* Per-staff drill-down modal */}
      {staffModal && (
        <Modal open={!!staffModal} onClose={() => setStaffModal(null)} title={`مديونيات ${staffModal.name}`}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-600 font-bold mb-1">جلسات</p>
                <p className="text-lg font-bold text-red-600">{staffModal.sessionTotal.toLocaleString('en-US')}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xs text-red-600 font-bold mb-1">مطبخ</p>
                <p className="text-lg font-bold text-red-600">{staffModal.kitchenTotal.toLocaleString('en-US')}</p>
              </div>
              <div className="rounded-xl p-3 bg-red-50">
                <p className="text-xs text-gray-500 font-bold mb-1">إجمالي الدين</p>
                <p className="text-lg font-bold text-red-600">
                  {staffModal.debt.toLocaleString('en-US')} {config.currency}
                </p>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-right">الطالب</th>
                    <th className="px-3 py-2 text-right">المبلغ</th>
                    <th className="px-3 py-2 text-right">المصدر</th>
                    <th className="px-3 py-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.filter(c => c.adminId === staffModal.adminId && !c.settled).filter(periodFilter).map(c => (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2">{c.studentId ? <button onClick={() => onStudentClick?.(c.studentId)} className="font-medium text-navy hover:text-indigo-600 hover:underline cursor-pointer transition-colors">{c.studentName}</button> : (c.studentName || '—')}</td>
                      <td className="px-3 py-2 font-bold text-red-600">
                        {(c.amount || 0).toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{c.source === 'kitchen' ? 'مطبخ' : 'جلسة'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{c.createdAt?.slice(0,10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => handleBulkSettle(staffModal.adminId, staffModal.name)}
              disabled={settling === 'bulk-' + staffModal.adminId}
              className="mt-3 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-xl cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check size={14}/>تسوية مجمعة لكل المعلقات
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
