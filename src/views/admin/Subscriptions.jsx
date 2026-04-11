import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, X, CreditCard, Check } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { storage, generateId, formatDate, logActivity } from '../../utils';
import { Modal, Input, Badge, ConfirmDialog } from '../../components/ui';

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminSubscriptions({ user, config, toast }) {
  const [plans, savePlans]             = useStorage(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  const [studentSubs, saveStudentSubs] = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
  const [students]                     = useStorage(STORAGE_KEYS.STUDENTS, []);

  // Plan form state
  const [showPlanForm, setShowPlanForm]   = useState(false);
  const [editingPlan, setEditingPlan]     = useState(null);
  const [confirmDeletePlan, setConfirmDeletePlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', quotaType: 'hours', quota: '', validityDays: '', price: '', active: true });
  const [planErrors, setPlanErrors] = useState({});

  // Assign form state
  const [assignSearch, setAssignSearch]   = useState('');
  const [assignStudent, setAssignStudent] = useState(null);
  const [assignPlanId, setAssignPlanId]   = useState('');
  const [assignStartDate, setAssignStartDate] = useState(todayStr());

  const activePlans = plans.filter(p => p.active);
  const selectedAssignPlan = plans.find(p => p.id === assignPlanId) || null;
  const computedExpiry = selectedAssignPlan && assignStartDate
    ? addDays(assignStartDate, selectedAssignPlan.validityDays - 1)
    : null;

  const assignFiltered = useMemo(() => {
    if (!assignSearch.trim()) return [];
    const q = assignSearch.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [students, assignSearch]);

  // Plan CRUD
  const openAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({ name: '', quotaType: 'hours', quota: '', validityDays: '', price: '', active: true });
    setPlanErrors({});
    setShowPlanForm(true);
  };

  const openEditPlan = (p) => {
    setEditingPlan(p);
    setPlanForm({ name: p.name, quotaType: p.quotaType, quota: String(p.quota), validityDays: String(p.validityDays), price: String(p.price), active: p.active });
    setPlanErrors({});
    setShowPlanForm(true);
  };

  const validatePlan = () => {
    const e = {};
    if (!planForm.name.trim()) e.name = 'الاسم مطلوب';
    if (!planForm.quota || isNaN(planForm.quota) || Number(planForm.quota) <= 0) e.quota = 'حصة غير صالحة';
    if (!planForm.validityDays || isNaN(planForm.validityDays) || Number(planForm.validityDays) <= 0) e.validityDays = 'مدة الصلاحية غير صالحة';
    if (!planForm.price || isNaN(planForm.price) || Number(planForm.price) < 0) e.price = 'السعر غير صالح';
    setPlanErrors(e);
    return !Object.keys(e).length;
  };

  const handleSavePlan = () => {
    if (!validatePlan()) return;
    const data = {
      name: planForm.name.trim(),
      quotaType: planForm.quotaType,
      quota: Number(planForm.quota),
      validityDays: Number(planForm.validityDays),
      price: Number(planForm.price),
      active: planForm.active,
    };
    if (editingPlan) {
      savePlans(plans.map(p => p.id === editingPlan.id ? { ...p, ...data } : p));
      logActivity('تعديل خطة اشتراك', data.name, user.id);
      toast('تم تعديل الخطة', 'success');
    } else {
      savePlans([...plans, { id: generateId('plan'), ...data, createdAt: new Date().toISOString() }]);
      logActivity('إضافة خطة اشتراك', data.name, user.id);
      toast('تمت إضافة الخطة', 'success');
    }
    setShowPlanForm(false);
  };

  const handleDeletePlan = (p) => {
    const hasActive = studentSubs.some(s => s.planId === p.id && s.status === 'active');
    if (hasActive) { toast('لا يمكن حذف خطة لها اشتراكات نشطة', 'error'); return; }
    savePlans(plans.filter(pl => pl.id !== p.id));
    logActivity('حذف خطة اشتراك', p.name, user.id);
    toast('تم حذف الخطة', 'info');
  };

  // Assign plan
  const handleAssign = () => {
    if (!assignStudent) { toast('اختر الطالب', 'error'); return; }
    if (!assignPlanId) { toast('اختر الخطة', 'error'); return; }
    if (!assignStartDate) { toast('حدد تاريخ البدء', 'error'); return; }
    const plan = plans.find(p => p.id === assignPlanId);
    if (!plan) return;
    const expiryDate = addDays(assignStartDate, plan.validityDays - 1);
    const sub = {
      id: generateId('sub'),
      studentId: assignStudent.id,
      studentName: assignStudent.name,
      planId: plan.id,
      planName: plan.name,
      quotaType: plan.quotaType,
      totalQuota: plan.quota,
      remainingQuota: plan.quota,
      usedDates: [],
      validityDays: plan.validityDays,
      startDate: assignStartDate,
      expiryDate,
      status: 'active',
      activatedBy: user.id,
      createdAt: new Date().toISOString(),
    };
    saveStudentSubs([sub, ...studentSubs]);
    logActivity('تفعيل اشتراك', `${assignStudent.name} — ${plan.name}`, user.id);
    toast(`تم تفعيل اشتراك ${assignStudent.name}`, 'success');
    setAssignStudent(null);
    setAssignSearch('');
    setAssignPlanId('');
    setAssignStartDate(todayStr());
  };

  // Cancel subscription
  const handleCancel = (sub) => {
    saveStudentSubs(studentSubs.map(s => s.id === sub.id ? { ...s, status: 'expired' } : s));
    logActivity('إلغاء اشتراك', `${sub.studentName} — ${sub.planName}`, user.id);
    toast('تم إلغاء الاشتراك', 'info');
  };

  const statusBadge = (s) => {
    if (s.status === 'active') return <span className="bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">نشط</span>;
    if (s.status === 'exhausted') return <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">منتهي الحصة</span>;
    return <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">منتهي</span>;
  };

  const planFormFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={() => setShowPlanForm(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer">إلغاء</button>
      <button onClick={handleSavePlan} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-6 fade-in p-6">
      <h1 className="text-2xl font-bold text-navy">الاشتراكات</h1>

      {/* ── Section 1: Plan Templates ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-navy">خطط الاشتراك</h2>
            <p className="text-xs text-gray-400 mt-0.5">{plans.length} خطة</p>
          </div>
          <button onClick={openAddPlan} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer flex items-center gap-2">
            <Plus size={15}/><span>إضافة خطة</span>
          </button>
        </div>
        {plans.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <CreditCard size={36} className="mx-auto mb-3 text-gray-200"/>
            لا توجد خطط بعد
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-right font-semibold">النوع</th>
                  <th className="px-4 py-3 text-right font-semibold">الحصة</th>
                  <th className="px-4 py-3 text-right font-semibold">الصلاحية</th>
                  <th className="px-4 py-3 text-right font-semibold">السعر</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.quotaType === 'hours' ? 'ساعات' : 'أيام'}</td>
                    <td className="px-4 py-3 text-gray-700">{p.quota} {p.quotaType === 'hours' ? 'ساعة' : 'يوم'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.validityDays} يوم</td>
                    <td className="px-4 py-3 font-semibold text-teal-700">{p.price.toLocaleString('en-US')} {config.currency}</td>
                    <td className="px-4 py-3">
                      {p.active
                        ? <span className="bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">مفعّل</span>
                        : <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">موقوف</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditPlan(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 cursor-pointer"><Edit2 size={13}/></button>
                        <button onClick={() => setConfirmDeletePlan(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Assign Plan ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="font-semibold text-navy mb-4">تفعيل اشتراك لطالب</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Student search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">الطالب</label>
            {assignStudent ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-navy text-sm">{assignStudent.name}</p>
                  <p className="text-xs text-gray-400">{assignStudent.studentId}</p>
                </div>
                <button onClick={() => { setAssignStudent(null); setAssignSearch(''); }} className="p-1 text-gray-400 hover:text-navy cursor-pointer"><X size={14}/></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  placeholder="بحث باسم الطالب أو الكود…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  dir="rtl"
                />
                {assignFiltered.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {assignFiltered.map(s => (
                      <button key={s.id} onClick={() => { setAssignStudent(s); setAssignSearch(''); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-right border-b border-gray-100 last:border-0 hover:bg-indigo-50 cursor-pointer text-sm">
                        <div>
                          <p className="font-medium text-navy">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.studentId}</p>
                        </div>
                        <span className="text-xs text-indigo-400">اختر</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Plan select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">الخطة</label>
            <select
              value={assignPlanId}
              onChange={e => setAssignPlanId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
              dir="rtl"
            >
              <option value="">اختر خطة…</option>
              {activePlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.quota} {p.quotaType === 'hours' ? 'ساعة' : 'يوم'} / {p.validityDays} يوم / {p.price} {config.currency}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">تاريخ البدء</label>
            <input
              type="date"
              value={assignStartDate}
              onChange={e => setAssignStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {/* Expiry preview */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">تاريخ الانتهاء</label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500">
              {computedExpiry || '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={handleAssign} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium cursor-pointer flex items-center gap-2">
            <Check size={15}/><span>تفعيل الاشتراك</span>
          </button>
        </div>
      </div>

      {/* ── Section 3: Active Subscriptions Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-navy">سجل الاشتراكات</h2>
          <p className="text-xs text-gray-400 mt-0.5">{studentSubs.length} اشتراك</p>
        </div>
        {studentSubs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">لا توجد اشتراكات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                  <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                  <th className="px-4 py-3 text-right font-semibold">الخطة</th>
                  <th className="px-4 py-3 text-right font-semibold">الحصة المتبقية</th>
                  <th className="px-4 py-3 text-right font-semibold">تاريخ الانتهاء</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {studentSubs.map(sub => (
                  <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy">{sub.studentName}</td>
                    <td className="px-4 py-3 text-gray-600">{sub.planName}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-navy">{sub.remainingQuota}</span>
                      <span className="text-gray-400 text-xs">/{sub.totalQuota} {sub.quotaType === 'hours' ? 'ساعة' : 'يوم'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{sub.expiryDate}</td>
                    <td className="px-4 py-3">{statusBadge(sub)}</td>
                    <td className="px-4 py-3">
                      {sub.status === 'active' && (
                        <button
                          onClick={() => handleCancel(sub)}
                          className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                        >
                          إلغاء
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan form modal */}
      <Modal open={showPlanForm} onClose={() => setShowPlanForm(false)} title={editingPlan ? 'تعديل خطة' : 'إضافة خطة اشتراك'} footer={planFormFooter}>
        <div className="space-y-4">
          <Input label="اسم الخطة *" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} error={planErrors.name} placeholder="مثال: اشتراك شهري 30 ساعة" />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">نوع الحصة *</label>
            <div className="flex gap-3">
              {['hours', 'days'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPlanForm({ ...planForm, quotaType: t })}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium cursor-pointer transition-all ${planForm.quotaType === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {t === 'hours' ? 'ساعات' : 'أيام'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={`الحصة (${planForm.quotaType === 'hours' ? 'ساعة' : 'يوم'}) *`} type="number" value={planForm.quota} onChange={e => setPlanForm({ ...planForm, quota: e.target.value })} error={planErrors.quota} placeholder="30" />
            <Input label="مدة الصلاحية (يوم) *" type="number" value={planForm.validityDays} onChange={e => setPlanForm({ ...planForm, validityDays: e.target.value })} error={planErrors.validityDays} placeholder="30" />
          </div>
          <Input label={`السعر (${config.currency}) *`} type="number" value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} error={planErrors.price} placeholder="0" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlanForm({ ...planForm, active: !planForm.active })}
              className={`w-10 h-6 rounded-full transition-all cursor-pointer relative ${planForm.active ? 'bg-teal-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${planForm.active ? 'right-0.5' : 'left-0.5'}`}/>
            </button>
            <span className="text-sm text-gray-600">مفعّلة</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeletePlan}
        onClose={() => setConfirmDeletePlan(null)}
        onConfirm={() => { handleDeletePlan(confirmDeletePlan); setConfirmDeletePlan(null); }}
        title="حذف الخطة"
        message={`هل أنت متأكد من حذف "${confirmDeletePlan?.name}"؟`}
      />
    </div>
  );
}
