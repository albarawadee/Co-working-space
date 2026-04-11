import { useState, useMemo } from 'react';
import { Plus, Download, Search, Wallet, Users, X, ArrowUpCircle, TrendingUp } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, formatDate, formatTime, logActivity, exportCSV } from '../../utils';
import { Modal, Input } from '../../components/ui';

export default function AdminDeposits({ user, config, toast }) {
  const [owners, saveOwners] = useStorage(STORAGE_KEYS.OWNERS, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [deposits, saveDeposits] = useStorage(STORAGE_KEYS.DEPOSITS, []);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [form, setForm] = useState({ ownerId: '', studentId: '', amount: '', note: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [errors, setErrors] = useState({});

  const cur = config.currency || 'ج.م';
  const selectedOwner = owners.find(o => o.id === form.ownerId);
  const selectedStudent = students.find(s => s.id === form.studentId);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const q = studentSearch.toLowerCase();
    return students
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.studentId || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q)
      )
      .slice(0, 6);
  }, [students, studentSearch]);

  const filteredDeposits = useMemo(() => {
    let list = deposits;
    if (filterOwner) list = list.filter(d => d.ownerId === filterOwner);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.ownerName?.toLowerCase().includes(q) ||
        (d.studentName || '').toLowerCase().includes(q) ||
        (d.note || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [deposits, search, filterOwner]);

  const totalDeposited = deposits.reduce((s, d) => s + (d.amount || 0), 0);
  const totalBalance = owners.reduce((s, o) => s + (o.balance || 0), 0);

  const validate = () => {
    const e = {};
    if (!form.ownerId) e.ownerId = 'اختر صاحب الحساب';
    const amt = Number(form.amount);
    if (!amt || amt <= 0) e.amount = 'أدخل مبلغاً صحيحاً';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const resetForm = () => {
    setForm({ ownerId: '', studentId: '', amount: '', note: '' });
    setStudentSearch('');
    setErrors({});
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const amt = Number(form.amount);
    const deposit = {
      id: generateId('dep'),
      ownerId: selectedOwner.id,
      ownerName: selectedOwner.name,
      studentId: form.studentId || null,
      studentName: selectedStudent?.name || '',
      amount: amt,
      note: form.note.trim(),
      staffId: user.id,
      createdAt: new Date().toISOString(),
    };
    saveDeposits([deposit, ...deposits]);
    saveOwners(owners.map(o =>
      o.id === form.ownerId ? { ...o, balance: (o.balance || 0) + amt } : o
    ));
    logActivity(
      'إضافة رصيد',
      `${selectedOwner.name} +${amt} ${cur}${selectedStudent ? ' · ' + selectedStudent.name : ''}`,
      user.id
    );
    toast(`تم إضافة ${amt} ${cur} لـ ${selectedOwner.name}`, 'success');
    resetForm();
    setShowForm(false);
  };

  const handleExport = () => {
    exportCSV('deposits.csv',
      ['التاريخ', 'الوقت', 'صاحب الحساب', 'الطالب', 'المبلغ', 'ملاحظات'],
      deposits.map(d => [
        d.createdAt?.slice(0, 10) || '',
        d.createdAt ? new Date(d.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        d.ownerName,
        d.studentName || '—',
        d.amount,
        d.note || ''
      ])
    );
  };

  const formFooter = (
    <div className="flex gap-3 justify-end">
      <button
        onClick={() => { setShowForm(false); resetForm(); }}
        className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
      >
        إلغاء
      </button>
      <button
        onClick={handleSubmit}
        className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors font-medium flex items-center gap-2"
      >
        <ArrowUpCircle size={15} />تأكيد الإيداع
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">إضافة رصيد للحسابات</h1>
          <p className="text-sm text-gray-500 mt-0.5">إدارة وتتبع إيداعات أصحاب الحسابات</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Download size={14} />تصدير CSV
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Plus size={15} />إيداع جديد
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Wallet size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-navy">{totalBalance.toLocaleString('en-US')} {cur}</p>
              <p className="text-xs text-gray-500">إجمالي الأرصدة الحالية</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <TrendingUp size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-navy">{totalDeposited.toLocaleString('en-US')} {cur}</p>
              <p className="text-xs text-gray-500">إجمالي جميع الإيداعات</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-navy">{owners.length}</p>
              <p className="text-xs text-gray-500">عدد الحسابات · {deposits.length} إيداع</p>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Balances Quick View */}
      {owners.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold text-navy mb-3">أرصدة الحسابات</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {owners.map(o => (
              <div
                key={o.id}
                className="border border-gray-100 rounded-xl p-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => { resetForm(); setForm(f => ({ ...f, ownerId: o.id })); setShowForm(true); }}
                title="انقر لإضافة رصيد"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{o.name}</p>
                  <p className="text-xs text-gray-400">{(o.studentIds || []).length} طالب</p>
                </div>
                <div className="text-right flex-shrink-0 mr-2">
                  <p className={`text-sm font-bold ${(o.balance || 0) > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                    {(o.balance || 0).toLocaleString('en-US')}
                  </p>
                  <p className="text-xs text-gray-400">{cur}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposits History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الطالب أو الملاحظات…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
              dir="rtl"
            />
          </div>
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
            dir="rtl"
          >
            <option value="">كل الحسابات</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <span className="text-sm text-gray-400 whitespace-nowrap">{filteredDeposits.length} إيداع</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ والوقت</th>
                <th className="px-4 py-3 text-right font-semibold">صاحب الحساب</th>
                <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ المُودَع</th>
                <th className="px-4 py-3 text-right font-semibold">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <Wallet size={22} className="text-gray-300" />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">لا توجد إيداعات</p>
                    <p className="text-gray-300 text-xs mt-1">
                      {deposits.length > 0 ? 'لا توجد نتائج للبحث' : 'ابدأ بإضافة رصيد لأحد الحسابات'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDeposits.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <p className="text-sm text-navy font-medium">{formatDate(d.createdAt)}</p>
                      <p className="text-xs text-gray-400">{formatTime(d.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{d.ownerName}</p>
                      {d.ownerId && (
                        <p className="text-xs text-gray-400">
                          رصيد: {(owners.find(o => o.id === d.ownerId)?.balance || 0).toLocaleString('en-US')} {cur}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {d.studentName ? (
                        <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-lg font-medium">
                          {d.studentName}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-teal-700 text-base">
                        +{d.amount.toLocaleString('en-US')} {cur}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px]">
                      {d.note || <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Deposit Modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="إيداع رصيد جديد"
        footer={formFooter}
      >
        <div className="space-y-4">
          {/* Owner Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">صاحب الحساب *</label>
            <select
              value={form.ownerId}
              onChange={e => setForm({ ...form, ownerId: e.target.value })}
              className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 ${
                errors.ownerId ? 'border-red-400' : 'border-gray-200'
              }`}
              dir="rtl"
            >
              <option value="">اختر صاحب الحساب…</option>
              {owners.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} — الرصيد: {(o.balance || 0).toLocaleString('en-US')} {cur}
                </option>
              ))}
            </select>
            {errors.ownerId && <p className="text-xs text-red-500 mt-1">{errors.ownerId}</p>}
          </div>

          {selectedOwner && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-teal-800">{selectedOwner.name}</p>
                <p className="text-xs text-teal-600">
                  {(selectedOwner.studentIds || []).length} طالب مرتبط · {selectedOwner.phone || 'لا يوجد هاتف'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-teal-600">الرصيد الحالي</p>
                <p className="font-bold text-teal-800">{(selectedOwner.balance || 0).toLocaleString('en-US')} {cur}</p>
              </div>
            </div>
          )}

          {/* Student search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              نسب الإيداع لطالب <span className="text-gray-400 font-normal">(اختياري)</span>
            </label>
            {selectedStudent ? (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-navy">{selectedStudent.name}</p>
                  <p className="text-xs text-gray-500">{selectedStudent.studentId}{selectedStudent.phone && ` · ${selectedStudent.phone}`}</p>
                </div>
                <button
                  onClick={() => { setForm({ ...form, studentId: '' }); setStudentSearch(''); }}
                  className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو كود الطالب أو الهاتف…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  dir="rtl"
                />
                {filteredStudents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setForm({ ...form, studentId: s.id }); setStudentSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors cursor-pointer text-right border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-navy">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.studentId}{s.phone && ` · ${s.phone}`}</p>
                        </div>
                        <span className="text-xs text-indigo-500 font-medium">اختيار</span>
                      </button>
                    ))}
                  </div>
                )}
                {studentSearch && filteredStudents.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1.5 text-center">لا توجد نتائج</p>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <Input
            label={`المبلغ (${cur}) *`}
            type="number"
            min="1"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            error={errors.amount}
            placeholder="0"
          />

          {/* Preview */}
          {selectedOwner && form.amount && Number(form.amount) > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>الرصيد الحالي</span>
                <span className="font-medium text-navy">{(selectedOwner.balance || 0).toLocaleString('en-US')} {cur}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>الإيداع الجديد</span>
                <span className="font-medium text-teal-700">+ {Number(form.amount).toLocaleString('en-US')} {cur}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-semibold text-navy">الرصيد بعد الإيداع</span>
                <span className="font-bold text-teal-700 text-base">
                  {((selectedOwner.balance || 0) + Number(form.amount)).toLocaleString('en-US')} {cur}
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">ملاحظات</label>
            <textarea
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder="أي ملاحظات على هذا الإيداع…"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 resize-none"
              dir="rtl"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
