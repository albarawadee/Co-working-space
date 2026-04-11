import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Download, Wallet, CreditCard } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { storage, generateId, generateStudentId, formatDate, logActivity, exportCSV, getActiveSubscription } from '../../utils';
import { Modal, Input, Textarea, Badge, SearchInput, ConfirmDialog } from '../../components/ui';

export default function AdminStudents({ user, config, toast }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions]  = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices]  = useStorage(STORAGE_KEYS.INVOICES, []);
  const [search, setSearch]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editing, setEditing]       = useState(null);
  const [selected, setSelected]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm]   = useState({ name:'', phone:'', memberNumber:'', email:'', tags:'', notes:'' });
  const [errors, setErrors] = useState({});

  // Wallet top-up modal
  const [showTopup, setShowTopup] = useState(false);
  const [topupForm, setTopupForm] = useState({ amount: '', note: '', paymentMethod: 'cash' });
  const [topupErrors, setTopupErrors] = useState({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || (s.studentId||'').toLowerCase().includes(q) || (s.phone||'').includes(q) || (s.memberNumber||'').includes(q));
  }, [students, search]);

  const openAdd = () => { setEditing(null); setForm({name:'',phone:'',memberNumber:'',email:'',tags:'',notes:''}); setErrors({}); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({name:s.name,phone:s.phone||'',memberNumber:s.memberNumber||'',email:s.email||'',tags:(s.tags||[]).join(', '),notes:s.notes||''}); setErrors({}); setShowForm(true); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    setErrors(e); return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    const tags = form.tags.split(',').map(t=>t.trim()).filter(Boolean);
    if (editing) {
      saveStudents(students.map(s => s.id===editing.id ? {...s,...form,tags,memberNumber:form.memberNumber.trim()} : s));
      logActivity('تعديل طالب', form.name, user.id);
      toast('تم تعديل بيانات الطالب', 'success');
    } else {
      const ns = { id:generateId('stu'), studentId:generateStudentId(), name:form.name.trim(), phone:form.phone.trim(), memberNumber:form.memberNumber.trim(), email:form.email.trim(), tags, notes:form.notes.trim(), walletBalance: 0, createdAt:new Date().toISOString() };
      saveStudents([...students, ns]);
      logActivity('إضافة طالب', `${ns.name} — ${ns.studentId}`, user.id);
      toast('تمت إضافة الطالب', 'success');
    }
    setShowForm(false);
  };

  const handleDelete = (s) => { saveStudents(students.filter(st=>st.id!==s.id)); logActivity('حذف طالب', s.name, user.id); toast('تم حذف الطالب','info'); };

  const getStats = (s) => {
    const inv = invoices.filter(i=>i.studentId===s.id);
    return { sessions: sessions.filter(se=>se.studentId===s.id).length, spend: inv.reduce((sum,i)=>sum+(i.total||0),0), lastVisit: sessions.filter(se=>se.studentId===s.id).slice(-1)[0]?.checkInTime };
  };

  const handleExport = () => {
    exportCSV('students.csv',
      ['الكود', 'الاسم', 'رقم العضوية', 'الهاتف', 'البريد الإلكتروني', 'الوسوم', 'تاريخ التسجيل'],
      students.map(s => [s.studentId, s.name, s.memberNumber||'', s.phone||'', s.email||'', (s.tags||[]).join(' | '), s.createdAt?.slice(0,10)||''])
    );
  };

  // Wallet top-up
  const openTopup = (s) => {
    setSelected(s);
    setTopupForm({ amount: '', note: '', paymentMethod: 'cash' });
    setTopupErrors({});
    setShowTopup(true);
  };

  const handleTopup = () => {
    const e = {};
    if (!topupForm.amount || isNaN(topupForm.amount) || Number(topupForm.amount) <= 0) e.amount = 'أدخل مبلغاً صحيحاً';
    setTopupErrors(e);
    if (Object.keys(e).length) return;

    const amount = Number(topupForm.amount);
    const now = new Date().toISOString();

    // Update student balance
    const updatedStudents = students.map(s =>
      s.id === selected.id ? { ...s, walletBalance: (s.walletBalance || 0) + amount } : s
    );
    saveStudents(updatedStudents);

    // Create wallet transaction
    const balanceBefore = selected.walletBalance || 0;
    const tx = {
      id: generateId('wtx'),
      studentId: selected.id,
      studentName: selected.name,
      type: 'topup',
      amount,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      note: topupForm.note || 'شحن محفظة',
      paymentMethod: topupForm.paymentMethod,
      staffId: user.id,
      createdAt: now,
    };
    const existingTxs = storage.get(STORAGE_KEYS.WALLET_TRANSACTIONS) || [];
    storage.set(STORAGE_KEYS.WALLET_TRANSACTIONS, [tx, ...existingTxs]);

    logActivity('شحن محفظة', `${selected.name} — +${amount} ${config.currency}`, user.id);
    toast(`تم شحن المحفظة بـ ${amount} ${config.currency}`, 'success');

    // Update selected to reflect new balance
    setSelected(s => s ? { ...s, walletBalance: balanceBefore + amount } : s);
    setShowTopup(false);
  };

  const formFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button>
      <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">حفظ</button>
    </div>
  );

  const topupFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={() => setShowTopup(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer">إلغاء</button>
      <button onClick={handleTopup} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer">شحن</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">إدارة الطلاب</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
            <Download size={14}/>تصدير CSV
          </button>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
            <Plus size={15}/><span>إضافة طالب</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود أو الهاتف أو رقم العضوية…" className="flex-1" />
          <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} طالب</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <th className="px-4 py-3 text-right font-semibold">الكود</th>
              <th className="px-4 py-3 text-right font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right font-semibold">رقم العضوية</th>
              <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
              <th className="px-4 py-3 text-right font-semibold">تاريخ التسجيل</th>
              <th className="px-4 py-3 text-right font-semibold">الوسوم</th>
              <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
            </tr></thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">لا توجد نتائج</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{s.studentId}</code></td>
                  <td className="px-4 py-3"><button onClick={()=>{setSelected(s);setShowProfile(true);}} className="font-medium text-navy hover:text-indigo-600 transition-colors cursor-pointer">{s.name}</button></td>
                  <td className="px-4 py-3 text-gray-500">{s.memberNumber || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone||'—'}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{(s.tags||[]).slice(0,3).map((t,i)=><Badge key={i} variant="navy">{t}</Badge>)}</div></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button onClick={()=>openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"><Edit2 size={13}/></button>
                    <button onClick={()=>setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={13}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit student form modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?'تعديل بيانات الطالب':'إضافة طالب جديد'} footer={formFooter}>
        <div className="space-y-4">
          <Input label="الاسم الكامل *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errors.name} placeholder="اسم الطالب" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="رقم الهاتف" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="01xxxxxxxxx" />
            <Input label="رقم العضوية" value={form.memberNumber} onChange={e=>setForm({...form,memberNumber:e.target.value})} placeholder="رقم العضوية (اختياري)" />
          </div>
          <Input label="البريد الإلكتروني" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" placeholder="example@email.com" />
          <Input label="الوسوم (مفصولة بفاصلة)" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="طالب جامعي, صباحي" />
          <Textarea label="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="أي ملاحظات…" />
        </div>
      </Modal>

      {/* Student profile modal */}
      {selected && (() => {
        const stats = getStats(selected);
        const inv   = invoices.filter(i=>i.studentId===selected.id).slice(0,8);
        const activeSub = getActiveSubscription(selected.id);
        const walletBalance = selected.walletBalance || 0;
        const walletTxs = (storage.get(STORAGE_KEYS.WALLET_TRANSACTIONS) || [])
          .filter(tx => tx.studentId === selected.id)
          .slice(0, 5);
        return (
          <Modal open={showProfile} onClose={()=>setShowProfile(false)} title="ملف الطالب" size="lg">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">{selected.name[0]}</div>
                <div>
                  <h3 className="text-lg font-bold text-navy">{selected.name}</h3>
                  <code className="text-xs text-gray-400">{selected.studentId}</code>
                  {selected.memberNumber && <span className="text-xs text-indigo-600 mr-2">· رقم العضوية: {selected.memberNumber}</span>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(selected.tags||[]).map((t,i)=><Badge key={i} variant="gold">{t}</Badge>)}
                    {activeSub && (
                      <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        اشتراك: {activeSub.planName} · {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} متبقٍ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[{v:stats.sessions,l:'جلسة'},{v:`${stats.spend.toLocaleString('en-US')}`,l:`${config.currency} إجمالي`},{v:stats.lastVisit?formatDate(stats.lastVisit):'—',l:'آخر زيارة'}].map((item,i)=>(
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-navy">{item.v}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.l}</p>
                  </div>
                ))}
              </div>

              {/* Wallet card */}
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center">
                      <Wallet size={16} className="text-white"/>
                    </div>
                    <span className="font-semibold text-teal-800">المحفظة الرقمية</span>
                  </div>
                  <button
                    onClick={() => openTopup(selected)}
                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Plus size={12}/>شحن المحفظة
                  </button>
                </div>
                <p className="text-3xl font-bold text-teal-800">
                  {walletBalance.toLocaleString('en-US')}
                  <span className="text-sm font-normal text-teal-600 mr-1">{config.currency}</span>
                </p>
                {walletTxs.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-medium text-teal-700 mb-1">آخر المعاملات</p>
                    {walletTxs.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${tx.type === 'topup' ? 'bg-teal-500' : 'bg-red-400'}`}/>
                          <span className="text-gray-600">{tx.note || (tx.type === 'topup' ? 'شحن' : 'خصم')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${tx.type === 'topup' ? 'text-teal-700' : 'text-red-600'}`}>
                            {tx.type === 'topup' ? '+' : '-'}{tx.amount.toLocaleString('en-US')}
                          </span>
                          <span className="text-gray-300">{tx.createdAt?.slice(0,10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {inv.length>0 && <div>
                <h4 className="font-semibold text-navy mb-2 text-sm">آخر الفواتير</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {inv.map(i=>(
                    <div key={i.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2 text-xs">
                      <span className="text-gray-500">{formatDate(i.createdAt)}</span>
                      <Badge variant={i.priceType==='fullDay'?'navy':i.priceType==='halfDay'?'teal':'gold'}>
                        {i.priceType==='fullDay'?'يوم كامل':i.priceType==='halfDay'?'نصف يوم':i.priceType==='subscription'?'اشتراك':'ساعي'}
                      </Badge>
                      <span className="font-semibold text-navy">{(i.total||0).toLocaleString('en-US')} {config.currency}</span>
                    </div>
                  ))}
                </div>
              </div>}

              {selected.notes && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"><span className="font-semibold">ملاحظات: </span>{selected.notes}</div>}
            </div>
          </Modal>
        );
      })()}

      {/* Wallet top-up modal */}
      <Modal open={showTopup} onClose={() => setShowTopup(false)} title="شحن المحفظة" footer={topupFooter}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-teal-800">{selected.name}</p>
              <p className="text-teal-600 text-xs mt-0.5">الرصيد الحالي: {(selected.walletBalance || 0).toLocaleString('en-US')} {config.currency}</p>
            </div>
            <Input
              label={`المبلغ (${config.currency}) *`}
              type="number"
              value={topupForm.amount}
              onChange={e => setTopupForm({ ...topupForm, amount: e.target.value })}
              error={topupErrors.amount}
              placeholder="0"
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">طريقة الدفع</label>
              <div className="flex gap-2">
                {['cash', 'transfer'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTopupForm({ ...topupForm, paymentMethod: m })}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium cursor-pointer transition-all flex items-center justify-center gap-1.5 ${topupForm.paymentMethod === m ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {m === 'cash' ? 'نقدي' : <><CreditCard size={14}/>تحويل</>}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="ملاحظة"
              value={topupForm.note}
              onChange={e => setTopupForm({ ...topupForm, note: e.target.value })}
              placeholder="اختياري"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={()=>setConfirmDelete(null)} onConfirm={()=>handleDelete(confirmDelete)} title="حذف الطالب" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟`} />
    </div>
  );
}
