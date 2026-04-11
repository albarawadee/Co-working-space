import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronLeft, TrendingUp, Receipt, FileText, Download } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, exportCSV } from '../../utils';
import { Modal, Input, Select, Badge, StatCard, ConfirmDialog } from '../../components/ui';
import { HorizontalBarChart } from '../../components/charts';

const EXP_CATS = ['إيجار','مستلزمات','رواتب','صيانة','كهرباء','إنترنت','أخرى'];

export default function AdminExpenses({ user, config, toast }) {
  const [expenses, saveExpenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm]   = useState({ category:'أخرى', description:'', amount:'', date:now.toISOString().slice(0,10) });
  const [errors, setErrors] = useState({});

  const changeMonth = (d) => {
    const [y,m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m-1+d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  };

  const monthExpenses = useMemo(() => expenses.filter(e=>e.date?.startsWith(monthKey)).sort((a,b)=>b.date.localeCompare(a.date)), [expenses, monthKey]);
  const total   = monthExpenses.reduce((s,e)=>s+(e.amount||0),0);
  const maxItem = monthExpenses.reduce((max,e)=>e.amount>max.amount?e:max,{amount:0,category:'—'});
  const catTotals = EXP_CATS.map(cat=>({ label:cat, value:monthExpenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0), color:'#1a1f3d' })).filter(c=>c.value>0);

  const openAdd  = () => { setEditing(null); setForm({category:'أخرى',description:'',amount:'',date:now.toISOString().slice(0,10)}); setErrors({}); setShowForm(true); };
  const openEdit = (e) => { setEditing(e); setForm({category:e.category,description:e.description,amount:e.amount,date:e.date}); setErrors({}); setShowForm(true); };

  const validate = () => {
    const e={};
    if (!form.description.trim()) e.description='الوصف مطلوب';
    if (!form.amount||Number(form.amount)<=0) e.amount='المبلغ مطلوب';
    setErrors(e); return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      saveExpenses(expenses.map(e=>e.id===editing.id?{...e,...form,amount:Number(form.amount)}:e));
      toast('تم تعديل المصروف','success');
    } else {
      saveExpenses([...expenses, {id:generateId('exp'),...form,amount:Number(form.amount),createdAt:new Date().toISOString()}]);
      logActivity('إضافة مصروف', `${form.category}: ${form.amount} ${config.currency}`, user.id);
      toast('تمت إضافة المصروف','success');
    }
    setShowForm(false);
  };

  const monthLabel = new Date(monthKey+'-01').toLocaleDateString('ar-EG',{year:'numeric',month:'long'});

  const handleExport = () => {
    exportCSV(`expenses-${monthKey}.csv`,
      ['التاريخ', 'الفئة', 'الوصف', 'المبلغ'],
      monthExpenses.map(e => [e.date, e.category, e.description, e.amount])
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">المصروفات</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Download size={14}/>تصدير CSV</button>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"><Plus size={15}/><span>إضافة</span></button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-2xl p-2.5 shadow-sm border border-cream-200 w-fit">
        <button onClick={()=>changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronRight size={15}/></button>
        <span className="font-semibold text-navy px-2 min-w-[130px] text-center text-sm">{monthLabel}</span>
        <button onClick={()=>changeMonth(1)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy transition-colors duration-200 cursor-pointer"><ChevronLeft size={15}/></button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="إجمالي المصروفات" value={`${total.toLocaleString('en-US')} ${config.currency}`} subtitle={`${monthExpenses.length} معاملة`} icon={Receipt} color="red" />
        <StatCard title="أكبر بند" value={`${maxItem.amount.toLocaleString('en-US')} ${config.currency}`} subtitle={maxItem.category} icon={TrendingUp} color="amber" />
        <StatCard title="عدد المعاملات" value={monthExpenses.length} subtitle="هذا الشهر" icon={FileText} color="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {catTotals.length>0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
            <h2 className="font-semibold text-navy mb-4">حسب الفئة</h2>
            <HorizontalBarChart items={catTotals} currency={config.currency} />
          </div>
        )}
        <div className={`bg-white rounded-2xl shadow-sm border border-cream-200 ${catTotals.length>0?'lg:col-span-2':'lg:col-span-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-cream-50 text-navy-500 text-xs uppercase">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الفئة</th>
                <th className="px-4 py-3 text-right font-semibold">الوصف</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
              </tr></thead>
              <tbody>
                {monthExpenses.length===0?(<tr><td colSpan={5} className="py-10 text-center text-navy-400">لا توجد مصروفات لهذا الشهر</td></tr>):
                  monthExpenses.map(e=>(
                    <tr key={e.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                      <td className="px-4 py-3 text-navy-500">{e.date}</td>
                      <td className="px-4 py-3"><Badge variant="navy">{e.category}</Badge></td>
                      <td className="px-4 py-3 text-navy">{e.description}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{e.amount.toLocaleString('en-US')} {config.currency}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-1">
                        <button onClick={()=>openEdit(e)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold cursor-pointer transition-colors duration-200"><Edit2 size={13}/></button>
                        <button onClick={()=>setConfirmDelete(e)} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 cursor-pointer transition-colors duration-200"><Trash2 size={13}/></button>
                      </div></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?'تعديل المصروف':'إضافة مصروف'}
        footer={<div className="flex gap-3 justify-end"><button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={handleSave} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="الفئة" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{EXP_CATS.map(c=><option key={c} value={c}>{c}</option>)}</Select>
            <Input label="التاريخ" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} />
          </div>
          <Input label="الوصف *" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} error={errors.description} placeholder="وصف المصروف" />
          <Input label={`المبلغ (${config.currency}) *`} type="number" min="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} error={errors.amount} />
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDelete} onClose={()=>setConfirmDelete(null)} onConfirm={()=>{saveExpenses(expenses.filter(e=>e.id!==confirmDelete.id));toast('تم الحذف','info');}} title="حذف المصروف" message={`هل تريد حذف "${confirmDelete?.description}"؟`} />
    </div>
  );
}
