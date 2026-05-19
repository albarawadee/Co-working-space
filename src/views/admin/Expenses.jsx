import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronLeft, TrendingUp, Receipt, FileText, Download, Calendar, Settings, X } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../../constants';
import { generateId, logActivity, exportCSV } from '../../utils';
import { Modal, Input, Select, Badge, StatCard, ConfirmDialog, RefreshButton, Pagination } from '../../components/ui';
import { usePagination } from '../../hooks/usePagination';
import { HorizontalBarChart } from '../../components/charts';

const DEFAULT_CATS = ['إيجار','مستلزمات','رواتب','صيانة','كهرباء','إنترنت','أخرى'];

export default function AdminExpenses({ user, config, toast }) {
  const [expenses, saveExpenses, refreshExpenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const [, saveConfig, refreshConfig] = useStorage(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [viewMode, setViewMode]     = useState('list'); // 'list' | 'daily'
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm]   = useState({ category:'أخرى', description:'', amount:'', date:now.toISOString().slice(0,10) });
  const [errors, setErrors] = useState({});
  const { run: runSave, isLocked: isSaving } = useSubmitLock();
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const allCategories = useMemo(() => {
    const custom = config?.expenseCategories || [];
    return [...DEFAULT_CATS, ...custom.filter(c => !DEFAULT_CATS.includes(c))];
  }, [config?.expenseCategories]);

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    if (allCategories.includes(name)) { toast('هذا التصنيف موجود بالفعل', 'error'); return; }
    const updated = [...(config.expenseCategories || []), name];
    await saveConfig(prev => ({ ...prev, expenseCategories: updated }));
    setNewCatName('');
    toast('تمت إضافة التصنيف', 'success');
  };

  const removeCategory = async (cat) => {
    if (DEFAULT_CATS.includes(cat)) return;
    const updated = (config.expenseCategories || []).filter(c => c !== cat);
    await saveConfig(prev => ({ ...prev, expenseCategories: updated }));
    toast('تم حذف التصنيف', 'info');
  };

  const changeMonth = (d) => {
    const [y,m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m-1+d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  };

  const monthExpenses = useMemo(() => {
    let list = expenses.filter(e => e.date?.startsWith(monthKey));
    if (selectedDay) {
      list = list.filter(e => e.date === selectedDay);
    }
    return list.sort((a,b) => b.date.localeCompare(a.date));
  }, [expenses, monthKey, selectedDay]);
  const total   = monthExpenses.reduce((s,e)=>s+(e.amount||0),0);
  const maxItem = monthExpenses.reduce((max,e)=>e.amount>max.amount?e:max,{amount:0,category:'—'});
  const catTotals = allCategories.map(cat=>({ label:cat, value:monthExpenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0), color:'#1a1f3d' })).filter(c=>c.value>0);

  const todayStr = now.toISOString().slice(0, 10);
  const todayTotal = expenses.filter(e => e.date === todayStr).reduce((s, e) => s + (e.amount || 0), 0);
  const grandTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const dailyTotals = useMemo(() => {
    const groups = monthExpenses.reduce((acc, e) => {
      const d = e.date;
      if (!acc[d]) acc[d] = { date: d, total: 0, count: 0 };
      acc[d].total += (e.amount || 0);
      acc[d].count += 1;
      return acc;
    }, {});
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthExpenses]);

  const handleRefresh = () => Promise.all([refreshExpenses(), refreshConfig()]);
  const { pageItems, page, pageCount, setPage, startIndex, endIndex, totalItems, isFirstPage, isLastPage } = usePagination(monthExpenses, 25);

  const openAdd  = () => { setEditing(null); setForm({category:'أخرى',description:'',amount:'',date:now.toISOString().slice(0,10)}); setErrors({}); setShowForm(true); };
  const openEdit = (e) => { setEditing(e); setForm({category:e.category,description:e.description,amount:e.amount,date:e.date}); setErrors({}); setShowForm(true); };

  const validate = () => {
    const e={};
    if (!form.description.trim()) e.description='الوصف مطلوب';
    if (!form.amount||Number(form.amount)<=0) e.amount='المبلغ مطلوب';
    setErrors(e); return !Object.keys(e).length;
  };

  const handleSave = () => runSave(async () => {
    if (!validate()) return;
    try {
      if (editing) {
        await saveExpenses(prev => prev.map(e=>e.id===editing.id?{...e,...form,amount:Number(form.amount)}:e));
        toast('تم تعديل المصروف','success');
      } else {
        await saveExpenses(prev => [...prev, {id:generateId('exp'),...form,amount:Number(form.amount),createdAt:new Date().toISOString()}]);
        logActivity('إضافة مصروف', `${form.category}: ${form.amount} ${config.currency}`, user.id);
        toast('تمت إضافة المصروف','success');
      }
      setShowForm(false);
    } catch (err) {
      toast('فشل حفظ المصروف - يرجى المحاولة مرة أخرى','error');
    }
  });

  const monthLabel = new Date(monthKey+'-01').toLocaleDateString('ar-EG',{year:'numeric',month:'long'});

  const handleExport = () => {
    exportCSV(`expenses-${monthKey}.csv`,
      ['التاريخ', 'الفئة', 'الوصف', 'المبلغ'],
      monthExpenses.map(e => [e.date, e.category, e.description, e.amount])
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-navy">المصروفات</h1>
          <RefreshButton onRefresh={handleRefresh} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>setShowCatManager(true)} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Settings size={14}/>التصنيفات</button>
          <button onClick={handleExport} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Download size={14}/>تصدير CSV</button>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Plus size={15}/><span>إضافة</span></button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 bg-white rounded-2xl p-2 shadow-sm border border-cream-200 w-fit">
          <button onClick={()=>changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronRight size={15}/></button>
          <span className="font-semibold text-navy px-2 min-w-[130px] text-center text-sm">{monthLabel}</span>
          <button onClick={()=>changeMonth(1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronLeft size={15}/></button>
        </div>

        <div className="flex gap-1 bg-cream-100 p-1 rounded-xl">
          <button 
            onClick={() => { setViewMode('list'); setSelectedDay(null); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'list' && !selectedDay ? 'bg-white text-navy shadow-sm' : 'text-navy-400 hover:text-navy'}`}
          >
            كل المعاملات
          </button>
          <button 
            onClick={() => setViewMode('daily')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'daily' ? 'bg-white text-navy shadow-sm' : 'text-navy-400 hover:text-navy'}`}
          >
            الملخص اليومي
          </button>
        </div>
      </div>

      {selectedDay && viewMode === 'list' && (
        <div className="flex items-center justify-between bg-gold/10 border border-gold/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gold" />
            <span className="text-sm font-bold text-navy">عرض نتائج يوم: {selectedDay}</span>
          </div>
          <button 
            onClick={() => setSelectedDay(null)}
            className="text-xs font-bold text-navy-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            إلغاء الفلتر
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="مصروفات اليوم" value={`${todayTotal.toLocaleString('en-US')} ${config.currency}`} subtitle="اليوم" icon={Calendar} color="indigo" />
        <StatCard title="مصروفات الشهر" value={`${total.toLocaleString('en-US')} ${config.currency}`} subtitle={`${monthExpenses.length} معاملة`} icon={Receipt} color="red" />
        <StatCard title="أكبر بند" value={`${maxItem.amount.toLocaleString('en-US')} ${config.currency}`} subtitle={maxItem.category} icon={TrendingUp} color="amber" />
        <StatCard title="الإجمالي الكلي" value={`${grandTotal.toLocaleString('en-US')} ${config.currency}`} subtitle="كل الفترات" icon={FileText} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {catTotals.length>0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">حسب نوع المصروف</h2>
            <HorizontalBarChart items={catTotals} currency={config.currency} />
          </div>
        )}
        <div className={`bg-white rounded-2xl shadow-sm border border-cream-200 ${catTotals.length>0?'lg:col-span-2':'lg:col-span-3'}`}>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            {viewMode === 'list' ? (
              <table className="w-full text-sm">
                <thead><tr className="bg-cream-50 text-navy-500 text-xs uppercase text-right">
                  <th className="px-5 py-4 font-semibold">التاريخ</th>
                  <th className="px-5 py-4 font-semibold">نوع المصروف</th>
                  <th className="px-5 py-4 font-semibold">البيان</th>
                  <th className="px-5 py-4 font-semibold">المبلغ</th>
                  <th className="px-5 py-4 font-semibold text-left">إجراءات</th>
                </tr></thead>
                <tbody className="divide-y divide-cream-100">
                  {monthExpenses.length===0?(<tr><td colSpan={5} className="py-12 text-center text-navy-400">لا توجد مصروفات لهذا الشهر</td></tr>):
                    pageItems.map(e=>(
                      <tr key={e.id} className="hover:bg-cream-50 transition-colors duration-150">
                        <td className="px-5 py-4 text-navy-400 font-mono text-xs">{e.date}</td>
                        <td className="px-5 py-4"><Badge variant="navy">{e.category}</Badge></td>
                        <td className="px-5 py-4 text-navy font-medium">{e.description}</td>
                        <td className="px-5 py-4 font-bold text-red-600">{e.amount.toLocaleString('en-US')} {config.currency}</td>
                        <td className="px-5 py-4 text-left"><div className="flex items-center justify-end gap-1">
                          <button onClick={()=>openEdit(e)} className="p-2 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold cursor-pointer transition-colors duration-200"><Edit2 size={14}/></button>
                          <button onClick={()=>setConfirmDelete(e)} className="p-2 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors duration-200"><Trash2 size={14}/></button>
                        </div></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-cream-50 text-navy-500 text-xs uppercase text-right">
                  <th className="px-5 py-4 font-semibold">التاريخ</th>
                  <th className="px-5 py-4 font-semibold">عدد المعاملات</th>
                  <th className="px-5 py-4 font-semibold">إجمالي مصروفات اليوم</th>
                </tr></thead>
                <tbody className="divide-y divide-cream-100">
                  {dailyTotals.length===0?(<tr><td colSpan={3} className="py-12 text-center text-navy-400">لا توجد سجلات</td></tr>):
                    dailyTotals.map(d=>(
                      <tr
                        key={d.date}
                        onClick={() => { setSelectedDay(d.date); setViewMode('list'); }}
                        className="hover:bg-cream-100 cursor-pointer transition-colors duration-150 group"
                      >
                        <td className="px-5 py-4 text-navy font-bold group-hover:text-gold">{d.date}</td>
                        <td className="px-5 py-4 text-navy-400">{d.count} معاملة</td>
                        <td className="px-5 py-4 font-bold text-red-600 text-lg">{d.total.toLocaleString('en-US')} {config.currency}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          {/* Mobile card list */}
          <div className="lg:hidden divide-y divide-cream-100">
            {viewMode === 'list' ? (
              monthExpenses.length===0 ? (
                <p className="py-12 text-center text-navy-400 text-sm">لا توجد مصروفات لهذا الشهر</p>
              ) : pageItems.map(e=>(
                <div key={e.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-navy font-medium text-sm truncate">{e.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="navy">{e.category}</Badge>
                        <span className="text-navy-400 font-mono text-xs">{e.date}</span>
                      </div>
                    </div>
                    <p className="font-bold text-red-600 text-sm whitespace-nowrap">{e.amount.toLocaleString('en-US')} {config.currency}</p>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={()=>openEdit(e)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold cursor-pointer transition-colors duration-200"><Edit2 size={16}/></button>
                    <button onClick={()=>setConfirmDelete(e)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors duration-200"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))
            ) : (
              dailyTotals.length===0 ? (
                <p className="py-12 text-center text-navy-400 text-sm">لا توجد سجلات</p>
              ) : dailyTotals.map(d=>(
                <div
                  key={d.date}
                  onClick={() => { setSelectedDay(d.date); setViewMode('list'); }}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-cream-50 active:bg-cream-100 transition-colors duration-150"
                >
                  <div>
                    <p className="text-navy font-bold text-sm">{d.date}</p>
                    <p className="text-navy-400 text-xs">{d.count} معاملة</p>
                  </div>
                  <p className="font-bold text-red-600">{d.total.toLocaleString('en-US')} {config.currency}</p>
                </div>
              ))
            )}
          </div>
          {viewMode === 'list' && <Pagination page={page} pageCount={pageCount} setPage={setPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} isFirstPage={isFirstPage} isLastPage={isLastPage} />}
        </div>
      </div>

      <Modal open={showForm} onClose={()=>!isSaving && setShowForm(false)} title={editing?'تعديل المصروف':'إضافة مصروف'}
        footer={<div className="flex gap-3 justify-end"><button onClick={()=>setShowForm(false)} disabled={isSaving} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200 disabled:opacity-50">إلغاء</button><button onClick={handleSave} disabled={isSaving} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200 disabled:opacity-50">{isSaving?'جاري الحفظ...':'حفظ'}</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="نوع المصروف" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{allCategories.map(c=><option key={c} value={c}>{c}</option>)}</Select>
            <Input label="التاريخ" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <Input label="البيان *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} error={errors.description} placeholder="بيان المصروف" />
          <Input label={`المبلغ (${config.currency}) *`} type="number" min="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} error={errors.amount} />
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDelete} onClose={()=>setConfirmDelete(null)} onConfirm={()=>{saveExpenses(prev => prev.filter(e=>e.id!==confirmDelete.id));toast('تم الحذف','info');}} title="حذف المصروف" message={`هل تريد حذف "${confirmDelete?.description}"؟`} />

      <Modal open={showCatManager} onClose={()=>setShowCatManager(false)} title="إدارة تصنيفات المصروفات">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e=>setNewCatName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addCategory()}
              placeholder="اسم التصنيف الجديد…"
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
              dir="rtl"
            />
            <button onClick={addCategory} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5">
              <Plus size={14}/>إضافة
            </button>
          </div>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {allCategories.map(cat=>(
              <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-navy">{cat}</span>
                {DEFAULT_CATS.includes(cat) ? (
                  <span className="text-[10px] text-gray-400">افتراضي</span>
                ) : (
                  <button onClick={()=>removeCategory(cat)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"><X size={14}/></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
