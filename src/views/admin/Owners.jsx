import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Wallet, Users, TrendingUp, Search, X, PlusCircle, MinusCircle } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, exportCSV } from '../../utils';
import { Modal, Input, Textarea, ConfirmDialog } from '../../components/ui';

export default function AdminOwners({ user, config, toast }) {
  const [owners, saveOwners] = useStorage(STORAGE_KEYS.OWNERS, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);

  const [showForm, setShowForm] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [editing, setEditing] = useState(null);
  const [topUpOwner, setTopUpOwner] = useState(null);
  const [linkOwner, setLinkOwner] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [topUpAmount, setTopUpAmount] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return owners.filter(o =>
      o.name.toLowerCase().includes(q) || (o.phone || '').includes(q)
    );
  }, [owners, search]);

  const totalBalance = owners.reduce((s, o) => s + (o.balance || 0), 0);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', notes: '' });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setForm({ name: o.name, phone: o.phone || '', notes: o.notes || '' });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      saveOwners(owners.map(o => o.id === editing.id ? { ...o, ...form } : o));
      logActivity('تعديل حساب', form.name, user.id);
      toast('تم تعديل الحساب', 'success');
    } else {
      const no = {
        id: generateId('own'),
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
        balance: 0,
        studentIds: [],
        createdAt: new Date().toISOString(),
      };
      saveOwners([...owners, no]);
      logActivity('إضافة حساب', form.name, user.id);
      toast('تمت إضافة الحساب', 'success');
    }
    setShowForm(false);
  };

  const handleDelete = (o) => {
    saveOwners(owners.filter(ow => ow.id !== o.id));
    logActivity('حذف حساب', o.name, user.id);
    toast('تم حذف الحساب', 'info');
  };

  const handleTopUp = () => {
    const amt = Number(topUpAmount);
    if (!amt || amt <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }
    saveOwners(owners.map(o => o.id === topUpOwner.id ? { ...o, balance: (o.balance || 0) + amt } : o));
    logActivity('شحن رصيد', `${topUpOwner.name} +${amt} ${config.currency}`, user.id);
    toast(`تم إضافة ${amt} ${config.currency} لحساب ${topUpOwner.name}`, 'success');
    setTopUpAmount('');
    setShowTopUp(false);
  };

  const linkedStudentsForOwner = (o) =>
    students.filter(s => (o.studentIds || []).includes(s.id));

  const filteredStudentsForLink = useMemo(() => {
    if (!linkOwner || !studentSearch.trim()) return [];
    const q = studentSearch.toLowerCase();
    return students.filter(s =>
      (s.name.toLowerCase().includes(q) || (s.studentId || '').toLowerCase().includes(q) || (s.phone || '').includes(q)) &&
      !(linkOwner.studentIds || []).includes(s.id)
    ).slice(0, 8);
  }, [students, studentSearch, linkOwner]);

  const addStudentToOwner = (student) => {
    saveOwners(owners.map(o =>
      o.id === linkOwner.id
        ? { ...o, studentIds: [...(o.studentIds || []), student.id] }
        : o
    ));
    setLinkOwner(prev => ({ ...prev, studentIds: [...(prev.studentIds || []), student.id] }));
    setStudentSearch('');
    toast(`تم ربط ${student.name}`, 'success');
  };

  const removeStudentFromOwner = (studentId) => {
    saveOwners(owners.map(o =>
      o.id === linkOwner.id
        ? { ...o, studentIds: (o.studentIds || []).filter(id => id !== studentId) }
        : o
    ));
    setLinkOwner(prev => ({ ...prev, studentIds: (prev.studentIds || []).filter(id => id !== studentId) }));
  };

  const handleExport = () => {
    exportCSV('owners.csv',
      ['الاسم', 'الهاتف', 'الرصيد', 'عدد الطلاب', 'تاريخ الإنشاء'],
      owners.map(o => [o.name, o.phone || '', o.balance || 0, (o.studentIds || []).length, o.createdAt?.slice(0, 10) || ''])
    );
  };

  const formFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">إلغاء</button>
      <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">الحسابات</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
            <TrendingUp size={14}/>تصدير CSV
          </button>
          <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2">
            <Plus size={15}/><span>إضافة حساب</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={18} className="text-indigo-600"/>
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{owners.length}</p>
              <p className="text-xs text-gray-500">إجمالي الحسابات</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Wallet size={18} className="text-teal-600"/>
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{totalBalance.toLocaleString('en-US')} {config.currency}</p>
              <p className="text-xs text-gray-500">إجمالي الأرصدة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              dir="rtl"
            />
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap">{filtered.length} حساب</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
                <th className="px-4 py-3 text-right font-semibold">الرصيد</th>
                <th className="px-4 py-3 text-right font-semibold">الطلاب المرتبطون</th>
                <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-gray-400">لا توجد حسابات</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-navy">{o.name}</td>
                  <td className="px-4 py-3 text-gray-500">{o.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${(o.balance || 0) > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                      {(o.balance || 0).toLocaleString('en-US')} {config.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{(o.studentIds || []).length} طالب</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setTopUpOwner(o); setTopUpAmount(''); setShowTopUp(true); }} title="شحن رصيد" className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors cursor-pointer"><PlusCircle size={14}/></button>
                      <button onClick={() => { setLinkOwner(o); setStudentSearch(''); setShowLink(true); }} title="ربط طلاب" className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"><Users size={14}/></button>
                      <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"><Edit2 size={13}/></button>
                      <button onClick={() => setConfirmDelete(o)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? 'تعديل الحساب' : 'إضافة حساب جديد'} footer={formFooter}>
        <div className="space-y-4">
          <Input label="الاسم *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="اسم صاحب الحساب" />
          <Input label="رقم الهاتف" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
          <Textarea label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات…" />
        </div>
      </Modal>

      {/* Top-Up Modal */}
      <Modal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        title={`شحن رصيد — ${topUpOwner?.name}`}
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowTopUp(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm cursor-pointer hover:bg-gray-50 transition-colors">إلغاء</button>
            <button onClick={handleTopUp} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors">تأكيد الشحن</button>
          </div>
        }
      >
        {topUpOwner && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">الرصيد الحالي</span>
              <span className="font-bold text-navy">{(topUpOwner.balance || 0).toLocaleString('en-US')} {config.currency}</span>
            </div>
            <Input
              label={`المبلغ (${config.currency})`}
              type="number"
              min="1"
              value={topUpAmount}
              onChange={e => setTopUpAmount(e.target.value)}
              placeholder="أدخل المبلغ"
            />
            {topUpAmount && Number(topUpAmount) > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-teal-700">الرصيد بعد الشحن</span>
                <span className="font-bold text-teal-700">{((topUpOwner.balance || 0) + Number(topUpAmount)).toLocaleString('en-US')} {config.currency}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Link Students Modal */}
      <Modal
        open={showLink}
        onClose={() => setShowLink(false)}
        title={`ربط طلاب — ${linkOwner?.name}`}
        size="lg"
      >
        {linkOwner && (
          <div className="space-y-4">
            {/* Linked students */}
            {linkedStudentsForOwner(linkOwner).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-navy mb-2">الطلاب المرتبطون حالياً</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {linkedStudentsForOwner(linkOwner).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-navy">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.studentId}{s.phone && ` · ${s.phone}`}</p>
                      </div>
                      <button onClick={() => removeStudentFromOwner(s.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><MinusCircle size={15}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Search to add */}
            <div>
              <p className="text-sm font-semibold text-navy mb-2">إضافة طالب</p>
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الكود أو الهاتف…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  dir="rtl"
                />
              </div>
              {filteredStudentsForLink.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mt-2 shadow-sm">
                  {filteredStudentsForLink.map(s => (
                    <button key={s.id} onClick={() => addStudentToOwner(s)}
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-indigo-50 transition-colors cursor-pointer text-right">
                      <div>
                        <p className="text-sm font-medium text-navy">{s.name}</p>
                        <p className="text-xs text-gray-500">{s.studentId}{s.phone && ` · ${s.phone}`}</p>
                      </div>
                      <span className="text-xs text-indigo-500">إضافة</span>
                    </button>
                  ))}
                </div>
              )}
              {studentSearch && filteredStudentsForLink.length === 0 && (
                <p className="text-center text-sm text-gray-400 mt-3">لا توجد نتائج</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete)}
        title="حذف الحساب"
        message={`هل أنت متأكد من حذف حساب "${confirmDelete?.name}"؟`}
      />
    </div>
  );
}
