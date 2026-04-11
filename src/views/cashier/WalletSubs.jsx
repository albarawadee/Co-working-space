import { useState, useMemo } from 'react';
import { Search, Wallet, CreditCard, CalendarDays, Check } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, formatDate } from '../../utils';

export default function CashierWalletSubs({ user, config, toast }) {
  const [activeTab, setActiveTab] = useState('wallet');
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [walletTxs, saveWalletTxs] = useStorage(STORAGE_KEYS.WALLET_TRANSACTIONS, []);
  const [plans] = useStorage(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  const [studentSubs, saveStudentSubs] = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);

  // ── Shared student search ──
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  // ── Wallet form ──
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [walletPayMethod, setWalletPayMethod] = useState('cash');

  // ── Subscription form ──
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);

  const activePlans = useMemo(() => plans.filter(p => p.active !== false), [plans]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.memberNumber || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [students, search]);

  const selectStudent = (s) => { setSelected(s); setSearch(''); };
  const clearStudent  = () => { setSelected(null); setSearch(''); };

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSub = selected
    ? studentSubs.find(s =>
        s.studentId === selected.id &&
        s.status === 'active' &&
        s.expiryDate >= todayStr
      )
    : null;

  // ── Wallet top-up ──
  const handleWalletTopup = () => {
    if (!selected) { toast('اختر الطالب أولاً', 'error'); return; }
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) { toast('أدخل مبلغاً صحيحاً', 'error'); return; }

    const now = new Date().toISOString();
    const balanceBefore = selected.walletBalance || 0;
    const balanceAfter  = balanceBefore + amount;

    const tx = {
      id: generateId('wtx'),
      studentId: selected.id,
      studentName: selected.name,
      type: 'topup',
      amount,
      balanceBefore,
      balanceAfter,
      note: walletNote || 'شحن محفظة',
      paymentMethod: walletPayMethod,
      staffId: user.id,
      createdAt: now,
    };

    saveStudents(students.map(s =>
      s.id === selected.id ? { ...s, walletBalance: balanceAfter } : s
    ));
    saveWalletTxs([tx, ...walletTxs]);
    logActivity('شحن محفظة', `${selected.name} — +${amount} ${config.currency}`, user.id);
    toast(`تم شحن المحفظة بـ ${amount} ${config.currency}`, 'success');
    setSelected(s => s ? { ...s, walletBalance: balanceAfter } : s);
    setWalletAmount('');
    setWalletNote('');
  };

  // ── New subscription ──
  const selectedPlan = activePlans.find(p => p.id === planId) || null;

  const calcExpiryDate = () => {
    if (!selectedPlan || !startDate) return '';
    const d = new Date(startDate);
    d.setDate(d.getDate() + (selectedPlan.validityDays || 30));
    return d.toISOString().slice(0, 10);
  };

  const handleAssignSub = () => {
    if (!selected)     { toast('اختر الطالب أولاً', 'error'); return; }
    if (!selectedPlan) { toast('اختر خطة الاشتراك', 'error'); return; }
    if (!startDate)    { toast('اختر تاريخ البدء', 'error'); return; }

    const expiryDate = calcExpiryDate();
    const now = new Date().toISOString();
    const newSub = {
      id: generateId('sub'),
      studentId: selected.id,
      studentName: selected.name,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      quotaType: selectedPlan.quotaType,
      totalQuota: selectedPlan.quota,
      remainingQuota: selectedPlan.quota,
      usedDates: [],
      startDate,
      expiryDate,
      status: 'active',
      activatedBy: user.id,
      createdAt: now,
    };

    saveStudentSubs([newSub, ...studentSubs]);
    logActivity('تفعيل اشتراك', `${selected.name} — ${selectedPlan.name}`, user.id);
    toast(`تم تفعيل اشتراك "${selectedPlan.name}"`, 'success');
    setPlanId('');
    setStartDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-5 fade-in p-6">
      <h1 className="text-2xl font-bold text-navy">الرصيد والاشتراكات</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'wallet', label: 'شحن رصيد',    icon: Wallet       },
          { key: 'sub',    label: 'اشتراك جديد', icon: CalendarDays },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'
            }`}
          >
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      <div className="max-w-lg space-y-4">
        {/* Student search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-3">
          <p className="text-sm font-semibold text-navy">اختر الطالب</p>
          {!selected ? (
            <>
              <div className="relative">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الكود أو الهاتف…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-4 py-3 text-sm text-navy outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                  dir="rtl"
                />
              </div>
              {filteredStudents.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {filteredStudents.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectStudent(s)}
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-indigo-50 text-right cursor-pointer transition-colors"
                    >
                      <div>
                        <p className="font-medium text-navy text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.memberNumber || s.studentId}{s.phone && ` · ${s.phone}`}</p>
                      </div>
                      <span className="text-xs text-indigo-400">اختر</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-navy text-sm">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.memberNumber || selected.studentId}</p>
                {activeTab === 'wallet' && (
                  <p className="text-xs text-teal-600 mt-0.5">الرصيد: {(selected.walletBalance || 0).toLocaleString('en-US')} {config.currency}</p>
                )}
              </div>
              <button onClick={clearStudent} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer px-2 py-1 rounded hover:bg-gray-100 transition-colors">تغيير</button>
            </div>
          )}
        </div>

        {/* Wallet top-up */}
        {activeTab === 'wallet' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-teal-500"/>
              <p className="font-semibold text-navy text-sm">شحن المحفظة</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">المبلغ ({config.currency}) *</label>
              <input
                type="number"
                min="1"
                value={walletAmount}
                onChange={e => setWalletAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">طريقة الدفع</label>
              <div className="flex gap-2">
                {['cash', 'transfer'].map(m => (
                  <button
                    key={m}
                    onClick={() => setWalletPayMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium cursor-pointer transition-all flex items-center justify-center gap-1.5 ${walletPayMethod === m ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    {m === 'cash' ? 'نقدي' : <><CreditCard size={14}/>تحويل</>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">ملاحظة</label>
              <input
                value={walletNote}
                onChange={e => setWalletNote(e.target.value)}
                placeholder="اختياري"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
                dir="rtl"
              />
            </div>
            <button
              onClick={handleWalletTopup}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Check size={15}/>شحن المحفظة
            </button>
          </div>
        )}

        {/* New subscription */}
        {activeTab === 'sub' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-indigo-500"/>
              <p className="font-semibold text-navy text-sm">تفعيل اشتراك</p>
            </div>

            {activeSub && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-teal-800">اشتراك نشط: {activeSub.planName}</p>
                <p className="text-xs text-teal-600 mt-0.5">
                  متبقٍ: {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} · ينتهي: {activeSub.expiryDate}
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">الخطة *</label>
              <select
                value={planId}
                onChange={e => setPlanId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                dir="rtl"
              >
                <option value="">اختر خطة…</option>
                {activePlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.quota} {p.quotaType === 'hours' ? 'ساعة' : 'يوم'} · {p.price} {config.currency}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">تاريخ البدء</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {selectedPlan && startDate && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm grid grid-cols-2 gap-2">
                <div><p className="text-xs text-gray-400">تنتهي في</p><p className="font-semibold text-navy">{formatDate(calcExpiryDate())}</p></div>
                <div><p className="text-xs text-gray-400">القيمة</p><p className="font-semibold text-navy">{selectedPlan.price} {config.currency}</p></div>
              </div>
            )}

            <button
              onClick={handleAssignSub}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Check size={15}/>تفعيل الاشتراك
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
