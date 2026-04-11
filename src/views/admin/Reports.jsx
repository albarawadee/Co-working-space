import { useState } from 'react';
import { ChevronRight, ChevronLeft, TrendingUp, Receipt, BarChart2, Download } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { StatCard } from '../../components/ui';
import { SVGRingChart, HorizontalBarChart, SimpleLineChart } from '../../components/charts';
import { exportCSV } from '../../utils';

export default function AdminReports({ user, config }) {
  const [invoices]  = useStorage(STORAGE_KEYS.INVOICES, []);
  const [orders]    = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [expenses]  = useStorage(STORAGE_KEYS.EXPENSES, []);
  const [students]  = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [products]  = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);

  const changeMonth = (d) => {
    const [y,m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m-1+d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  };

  const mInv  = invoices.filter(i=>i.createdAt?.startsWith(monthKey));
  const mOrd  = orders.filter(o=>o.createdAt?.startsWith(monthKey));
  const mExp  = expenses.filter(e=>e.date?.startsWith(monthKey));

  const sessionRev = mInv.reduce((s,i)=>s+(i.amount||0),0);
  const kitchenRev = mInv.reduce((s,i)=>s+(i.kitchenTotal||0),0);
  const totalRev   = mInv.reduce((s,i)=>s+(i.total||0),0);
  const totalExp   = mExp.reduce((s,e)=>s+(e.amount||0),0);
  const profit     = totalRev - totalExp;
  const cashRev    = mInv.filter(i=>i.paymentMethod==='cash'||!i.paymentMethod).reduce((s,i)=>s+(i.total||0),0);
  const transferRev= mInv.filter(i=>i.paymentMethod==='transfer').reduce((s,i)=>s+(i.total||0),0);
  const instapayRev= mInv.filter(i=>i.paymentMethod==='instapay').reduce((s,i)=>s+(i.total||0),0);

  const studentSpend = {};
  mInv.forEach(i=>{ studentSpend[i.studentId]=(studentSpend[i.studentId]||0)+(i.total||0); });
  const topStudents = Object.entries(studentSpend).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>({ label:(students.find(s=>s.id===id)?.name||'غير معروف'), value:v, color:'#c9a84c' }));

  const productQty = {};
  mOrd.forEach(o=>(o.items||[]).forEach(item=>{ productQty[item.productId]=(productQty[item.productId]||0)+(item.qty||1); }));
  const topProducts = Object.entries(productQty).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,qty])=>{ const p=products.find(x=>x.id===id); return { label:p?p.name:'غير معروف', value:qty*(p?.price||0), color:'#2d9f93' }; });

  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dailyData = Array.from({length:daysInMonth},(_,i)=>{
    const ds=`${monthKey}-${String(i+1).padStart(2,'0')}`;
    const dayInvs = mInv.filter(inv=>inv.createdAt?.startsWith(ds));
    return {
      day: i+1,
      studyHall: dayInvs.reduce((s,inv)=>s+(inv.amount||0),0),
      kitchen: dayInvs.reduce((s,inv)=>s+(inv.kitchenTotal||0),0),
      total: dayInvs.reduce((s,inv)=>s+(inv.total||0),0),
    };
  });
  const dailyTotals = dailyData.map(d => d.total);
  const ringSegs = [{label:'جلسات',value:sessionRev,color:'#4f46e5'},{label:'مطبخ',value:kitchenRev,color:'#f59e0b'}].filter(s=>s.value>0);
  const monthLabel = new Date(monthKey+'-01').toLocaleDateString('ar-EG',{year:'numeric',month:'long'});

  const handleExport = () => {
    const monthExpenses = mExp;
    const rows = dailyData.map(d => {
      const ds = `${monthKey}-${String(d.day).padStart(2,'0')}`;
      const dayInvs = mInv.filter(inv=>inv.createdAt?.startsWith(ds));
      const dayExp = monthExpenses.filter(e=>e.date===ds).reduce((s,e)=>s+(e.amount||0),0);
      const dayCash = dayInvs.filter(i=>i.paymentMethod==='cash'||!i.paymentMethod).reduce((s,i)=>s+(i.total||0),0);
      const dayTransfer = dayInvs.filter(i=>i.paymentMethod==='transfer').reduce((s,i)=>s+(i.total||0),0);
      const dayInstapay = dayInvs.filter(i=>i.paymentMethod==='instapay').reduce((s,i)=>s+(i.total||0),0);
      return [d.day, d.studyHall, d.kitchen, d.total, dayCash, dayTransfer, dayInstapay, dayExp, d.total - dayExp];
    });
    exportCSV(`reports-${monthKey}.csv`,
      ['اليوم', 'إيرادات قاعة الدراسة', 'إيرادات المطبخ', 'الإجمالي', 'نقدي', 'تحويل', 'InstaPay', 'المصروفات', 'صافي الربح'],
      rows
    );
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">التقارير</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
            <Download size={14}/>تصدير CSV
          </button>
          <div className="flex items-center gap-2 bg-white rounded-2xl p-2 shadow-sm border border-gray-200">
            <button onClick={()=>changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-navy transition-colors cursor-pointer"><ChevronRight size={15}/></button>
            <span className="font-semibold text-navy px-2 min-w-[130px] text-center text-sm">{monthLabel}</span>
            <button onClick={()=>changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-navy transition-colors cursor-pointer"><ChevronLeft size={15}/></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="إجمالي الإيرادات" value={`${totalRev.toLocaleString('en-US')} ${config.currency}`} subtitle={`${mInv.length} فاتورة`} icon={TrendingUp} color="teal" />
        <StatCard title="إجمالي المصروفات" value={`${totalExp.toLocaleString('en-US')} ${config.currency}`} subtitle={`${mExp.length} معاملة`} icon={Receipt} color="red" />
        <div className={`rounded-2xl p-5 shadow-sm border card-lift ${profit>=0?'bg-teal text-white border-teal-600':'bg-red-500 text-white border-red-600'}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80 mb-1">صافي الربح</p>
          <p className="text-2xl font-bold">{profit.toLocaleString('en-US')} {config.currency}</p>
          <p className="text-xs opacity-70 mt-1">{profit>=0?'ربح':'خسارة'}</p>
        </div>
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs text-indigo-600 font-medium mb-1">قاعة الدراسة</p>
            <p className="text-2xl font-bold text-indigo-800">{sessionRev.toLocaleString('en-US')} <span className="text-sm font-normal">{config.currency}</span></p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Receipt size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs text-amber-600 font-medium mb-1">المطبخ</p>
            <p className="text-2xl font-bold text-amber-800">{kitchenRev.toLocaleString('en-US')} <span className="text-sm font-normal">{config.currency}</span></p>
          </div>
        </div>
      </div>

      {/* Payment method split */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-600 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium mb-1">نقدي</p>
            <p className="text-2xl font-bold text-gray-800">{cashRev.toLocaleString('en-US')} <span className="text-sm font-normal">{config.currency}</span></p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium mb-1">تحويل</p>
            <p className="text-2xl font-bold text-blue-800">{transferRev.toLocaleString('en-US')} <span className="text-sm font-normal">{config.currency}</span></p>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs text-purple-600 font-medium mb-1">InstaPay</p>
            <p className="text-2xl font-bold text-purple-800">{instapayRev.toLocaleString('en-US')} <span className="text-sm font-normal">{config.currency}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {ringSegs.length>0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col items-center">
            <h2 className="font-semibold text-navy mb-4 w-full">توزيع الإيرادات</h2>
            <SVGRingChart segments={ringSegs} centerLabel={`${totalRev.toLocaleString('en-US')}`} />
          </div>
        )}
        <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-200 ${ringSegs.length>0?'lg:col-span-2':'lg:col-span-3'}`}>
          <h2 className="font-semibold text-navy mb-2">الإيرادات اليومية</h2>
          <SimpleLineChart points={dailyTotals} color="#4f46e5" height={100} />
          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>{Math.ceil(daysInMonth/2)}</span><span>{daysInMonth}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {topStudents.length>0&&<div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"><h2 className="font-semibold text-navy mb-4">أعلى 5 طلاب إنفاقاً</h2><HorizontalBarChart items={topStudents} currency={config.currency}/></div>}
        {topProducts.length>0&&<div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200"><h2 className="font-semibold text-navy mb-4">أكثر المنتجات مبيعاً</h2><HorizontalBarChart items={topProducts} currency={config.currency}/></div>}
      </div>

      {totalRev===0&&totalExp===0&&<div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center"><BarChart2 size={40} className="text-gray-300 mx-auto mb-3"/><p className="text-gray-400">لا توجد بيانات لهذا الشهر</p></div>}
    </div>
  );
}
