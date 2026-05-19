import { useState, useMemo } from 'react';
import { ArrowUpCircle, History, User, CreditCard, FileText, Plus, Trash2, Settings, AlertCircle, Search } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS } from '../../constants';
import { generateId, formatDate, formatDateTime, logActivity, supabase, toSnake, localDateStr } from '../../utils';
import { Modal, Input, Select, Badge, ConfirmDialog, RefreshButton, Pagination } from '../../components/ui';
import { usePagination } from '../../hooks/usePagination';

export default function AdminCollections({ user, config, toast, uncollectedBalance }) {
  const [collections, saveCollections, refreshCollections] = useStorage(STORAGE_KEYS.ADMIN_COLLECTIONS, []);
  const [staff, , refreshStaff]                             = useStorage(STORAGE_KEYS.STAFF, []);
  const [cashAdj, saveCashAdj, refreshCashAdj]              = useStorage(STORAGE_KEYS.CASH_ADJUSTMENTS, []);

  const [showForm, setShowForm] = useState(false);
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [form, setForm]         = useState({ staffId: '', amount: '', note: '' });
  const [adjForm, setAdjForm]   = useState({ amount: '', note: '', type: 'correction' });
  // Two handlers (collect, adjust) share one lock — they're mutually-exclusive
  // dialog actions, never both in flight at once. Single lock prevents
  // accidental concurrent submission across the two forms.
  const { run: runSubmit, isLocked: isSubmitting } = useSubmitLock();
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  const filteredCollections = useMemo(() => {
    let list = collections.filter(periodFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c =>
        (c.adminName || '').toLowerCase().includes(q) ||
        (c.staffName || '').toLowerCase().includes(q) ||
        (c.note || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [collections, period, selectedDay, selectedMonth, searchTerm]);

  const filteredAdj = useMemo(() =>
    cashAdj.filter(periodFilter),
  [cashAdj, period, selectedDay, selectedMonth]);

  const totalCollected = filteredCollections.reduce((s, c) => s + (c.amount || 0), 0);
  const totalAdjusted  = filteredAdj.reduce((s, a) => s + (a.amount || 0), 0);

  const handleRefresh = () => Promise.all([refreshCollections(), refreshStaff(), refreshCashAdj()]);
  const { pageItems, page, pageCount, setPage, startIndex, endIndex, totalItems, isFirstPage, isLastPage } = usePagination(filteredCollections, 25);

  const handleCollect = () => runSubmit(async () => {
    if (!form.staffId || !form.amount || Number(form.amount) <= 0) {
      toast('يرجى اختيار الموظف وإدخال مبلغ صحيح', 'error');
      return;
    }
    try {
      const selectedStaff = staff.find(s => s.id === form.staffId);
      const newCol = {
        id: generateId('col'),
        adminId: user.id,
        adminName: user.name,
        staffId: form.staffId,
        staffName: selectedStaff?.name || form.staffId,
        amount: Number(form.amount),
        note: form.note,
        createdAt: new Date().toISOString(),
      };

      // saveCollections handles both state update and Supabase sync
      await saveCollections(prev => [newCol, ...prev]);

      logActivity('تحصيل أموال', `تحصيل ${form.amount} من ${newCol.staffName}`, user.id);
      toast('تم تسجيل التحصيل بنجاح', 'success');
      setShowForm(false);
      setForm({ staffId: '', amount: '', note: '' });
    } catch (err) {
      console.error(err);
      toast('فشل حفظ التحصيل - يرجى المحاولة مرة أخرى', 'error');
    }
  });

  const handleAdjust = () => runSubmit(async () => {
    if (!adjForm.amount || Number(adjForm.amount) === 0) {
      toast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }
    try {
      const newAdj = {
        id: generateId('adj'),
        amount: Number(adjForm.amount),
        note: adjForm.note,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };
      await saveCashAdj(prev => [newAdj, ...prev]);
      logActivity('تعديل رصيد الدرج', `تعديل بقيمة ${adjForm.amount}`, user.id);
      toast('تم تعديل الرصيد بنجاح', 'success');
      setShowAdjForm(false);
      setAdjForm({ amount: '', note: '', type: 'correction' });
    } catch (err) {
      toast('فشل التعديل', 'error');
    }
  });

  const handleDelete = async (col) => {
    try {
      await saveCollections(prev => prev.filter(c => c.id !== col.id));
      toast('تم حذف السجل', 'info');
    } catch (err) {
      toast('فشل الحذف من السيرفر', 'error');
    }
    setConfirmDelete(null);
  };

  const handleDeleteAdj = async (adj) => {
    try {
      await saveCashAdj(prev => prev.filter(a => a.id !== adj.id));
      toast('تم حذف التعديل', 'info');
    } catch (err) {
      toast('فشل الحذف', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 fade-in">
      {/* Header & Global Balance */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">تحصيل الأموال</h1>
            <p className="text-sm text-gray-500 mt-1">تسجيل المبالغ التي يتم استلامها من الموظفين يدوياً</p>
          </div>
          <RefreshButton onRefresh={handleRefresh} />
        </div>
        
        <div className="bg-gradient-to-br from-navy to-indigo-900 text-white rounded-2xl p-4 shadow-lg min-w-[200px] border border-white/10">
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <CreditCard size={14} />
            <span className="text-xs font-medium">المبلغ المتبقي مع الموظفين</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{(uncollectedBalance || 0).toLocaleString('en-US')}</span>
            <span className="text-xs opacity-70">{config.currency}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <button
          onClick={() => setShowAdjForm(true)}
          className="bg-white border border-gray-200 text-navy hover:bg-gray-50 px-5 py-2.5 min-h-[44px] rounded-xl font-medium transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Settings size={18} className="text-gray-400" />
          تعديل رصيد الدرج (تسوية)
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 min-h-[44px] rounded-xl font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={18} />
          تسجيل عملية تحصيل
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[
              { key: 'day',   label: 'يوم'  },
              { key: 'month', label: 'شهر'  },
              { key: 'all',   label: 'الكل' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 min-h-[44px] rounded-lg text-xs font-bold transition-all cursor-pointer ${period === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {period === 'day' && (
            <input type="date" value={selectedDay} max={todayStr}
              onChange={e => setSelectedDay(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 min-h-[44px] text-xs font-medium text-navy outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer" />
          )}
          {period === 'month' && (
            <input type="month" value={selectedMonth} max={todayStr.slice(0,7)}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 min-h-[44px] text-xs font-medium text-navy outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer" />
          )}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الملاحظة…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-4 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            dir="rtl"
          />
        </div>
      </div>

      {/* Period Stats */}
      {period !== 'all' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                <ArrowUpCircle size={16} className="text-teal-500" />
              </div>
              <span className="text-xs font-bold text-gray-500">إجمالي التحصيلات {period === 'day' ? `— ${selectedDay}` : `— ${selectedMonth}`}</span>
            </div>
            <p className="text-2xl font-bold text-navy">{totalCollected.toLocaleString('en-US')} <span className="text-xs font-normal text-gray-400">{config.currency}</span></p>
          </div>
          {filteredAdj.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Settings size={16} className="text-amber-500" />
                </div>
                <span className="text-xs font-bold text-gray-500">صافي التسويات {period === 'day' ? `— ${selectedDay}` : `— ${selectedMonth}`}</span>
              </div>
              <p className={`text-2xl font-bold ${totalAdjusted >= 0 ? 'text-teal-600' : 'text-red-600'}`}>{totalAdjusted > 0 ? '+' : ''}{totalAdjusted.toLocaleString('en-US')} <span className="text-xs font-normal text-gray-400">{config.currency}</span></p>
            </div>
          )}
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-navy">سجل التحصيلات السابقة</h2>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">بواسطة (المدير)</th>
                <th className="px-4 py-3 text-right font-semibold">من (الموظف)</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">ملاحظات</th>
                <th className="px-4 py-3 text-center font-semibold text-red-400">حذف</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} strokeWidth={1} />
                      <p>لا توجد عمليات تحصيل مسجلة</p>
                    </div>
                  </td>
                </tr>
              ) : pageItems.map(col => (
                <tr key={col.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{formatDate(col.createdAt)}</p>
                    <p className="text-[10px] text-gray-400">{formatDateTime(col.createdAt).split(' ')[1]}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{col.adminName}</td>
                  <td className="px-4 py-3 text-indigo-700 font-semibold">{col.staffName}</td>
                  <td className="px-4 py-3 font-bold text-teal-600">{(col.amount || 0).toLocaleString('en-US')} {config.currency}</td>
                  <td className="px-4 py-3 text-gray-400 italic max-w-xs truncate">{col.note || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setConfirmDelete(col)}
                      className="p-2 min-h-[44px] text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="lg:hidden">
          {filteredCollections.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <FileText size={32} strokeWidth={1} />
                <p>لا توجد عمليات تحصيل مسجلة</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 p-3 space-y-3">
              {pageItems.map(col => (
                <div key={col.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-indigo-700 font-semibold text-sm">{col.staffName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{col.adminName}</p>
                    </div>
                    <span className="font-bold text-teal-600 text-sm whitespace-nowrap">{(col.amount || 0).toLocaleString('en-US')} {config.currency}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-400">
                      <span>{formatDate(col.createdAt)}</span>
                      <span className="mx-1">-</span>
                      <span>{formatDateTime(col.createdAt).split(' ')[1]}</span>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(col)}
                      className="p-2 min-h-[44px] text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {col.note && <p className="text-xs text-gray-400 italic mt-2 pt-2 border-t border-gray-50">{col.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Pagination page={page} pageCount={pageCount} setPage={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} isFirstPage={isFirstPage} isLastPage={isLastPage} />
      </div>

      {/* Adjustments Table (Manual Recalibration) */}
      {filteredAdj.length > 0 && (
        <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-100 flex items-center gap-2">
            <Settings size={16} className="text-amber-600" />
            <h2 className="font-semibold text-amber-900 text-sm">تسويات الرصيد اليدوية (تصحيح الرصيد)</h2>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-amber-100/50 text-amber-700">
                <tr>
                  <th className="px-4 py-2 text-right">التاريخ</th>
                  <th className="px-4 py-2 text-right">المبلغ</th>
                  <th className="px-4 py-2 text-right">السبب / الملاحظة</th>
                  <th className="px-4 py-2 text-center text-red-400">حذف</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdj.map(adj => (
                  <tr key={adj.id} className="border-b border-amber-100/50 last:border-0 hover:bg-amber-100/30 transition-colors">
                    <td className="px-4 py-2 text-amber-800">{formatDate(adj.createdAt)}</td>
                    <td className={`px-4 py-2 font-bold ${adj.amount > 0 ? 'text-teal-600' : 'text-red-500'}`}>
                      {adj.amount > 0 ? '+' : ''}{adj.amount} {config.currency}
                    </td>
                    <td className="px-4 py-2 text-amber-600 italic truncate max-w-xs">{adj.note || '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteAdj(adj)}
                        className="p-1.5 min-h-[44px] text-amber-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                      >
                        <Trash2 size={12}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="lg:hidden divide-y divide-amber-100/50 p-3 space-y-3">
            {filteredAdj.map(adj => (
              <div key={adj.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-xs text-amber-800">{formatDate(adj.createdAt)}</span>
                  <span className={`font-bold text-sm ${adj.amount > 0 ? 'text-teal-600' : 'text-red-500'}`}>
                    {adj.amount > 0 ? '+' : ''}{adj.amount} {config.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-amber-600 italic flex-1 truncate">{adj.note || '—'}</p>
                  <button
                    onClick={() => handleDeleteAdj(adj)}
                    className="p-2 min-h-[44px] text-amber-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                  >
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Modal */}
      <Modal 
        open={showForm} 
        onClose={() => setShowForm(false)} 
        title="تسجيل تحصيل مبلغ"
        footer={(
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer">إلغاء</button>
            <button
              onClick={handleCollect}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 min-h-[44px] rounded-xl text-sm font-medium cursor-pointer shadow-indigo-200 shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تأكيد التحصيل'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100 leading-relaxed font-medium">
            ⚠️ هذا المبلغ سيتم خصمه مباشرة من "المبلغ المتبقي مع الموظفين" الظاهر في أعلى الصفحة.
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">تحصيل من (الموظف)</label>
              <select
                value={form.staffId}
                onChange={e => setForm({ ...form, staffId: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                dir="rtl"
              >
                <option value="">اختر الموظف...</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>

            <Input
              label="المبلغ المستلم"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
            />

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">ملاحظات إضافية</label>
              <textarea
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 min-h-[80px]"
                placeholder="رقم الفاتورة، سبب التحصيل، إلخ..."
                dir="rtl"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Adjustment Form Modal */}
      <Modal 
        open={showAdjForm} 
        onClose={() => setShowAdjForm(false)} 
        title="تعديل رصيد الدرج (تسوية يدوية)"
        footer={(
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button onClick={() => setShowAdjForm(false)} className="px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer">إلغاء</button>
            <button
              onClick={handleAdjust}
              disabled={isSubmitting}
              className="bg-navy text-white px-6 py-2 min-h-[44px] rounded-xl text-sm font-medium cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديل'}
            </button>
          </div>
        )}
      >
        <div className="space-y-4 py-2">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 text-blue-800 text-xs leading-relaxed">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>يمكنك استخدام هذه الخاصية لمطابقة الرصيد الرقمي مع الكاش الحقيقي. أدخل مبلغاً **موجباً** للزيادة أو **سالباً** للخصم.</p>
          </div>
          
          <Input
            label="مبلغ التعديل (مثال: -250 للخصم)"
            type="number"
            placeholder="0.00"
            value={adjForm.amount}
            onChange={e => setAdjForm({ ...adjForm, amount: e.target.value })}
            autoFocus
          />

          <Input
            label="سبب التعديل / ملاحظة"
            placeholder="مثال: تسوية رصيد البداية، فرق عجز..."
            value={adjForm.note}
            onChange={e => setAdjForm({ ...adjForm, note: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="حذف سجل التحصيل؟"
        message={`هل أنت متأكد من حذف عملية التحصيل بقيمة ${confirmDelete?.amount}؟ هذا سيعيد المبلغ إلى "المستحقات غير المحصلة".`}
        type="danger"
      />
    </div>
  );
}
