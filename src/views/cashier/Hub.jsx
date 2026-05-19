import { useState, useMemo, useEffect } from 'react';
import {
  LogOut, Users, TrendingUp, Clock, Search, Check, X, Pencil,
  UserPlus, Hash, ChevronLeft, ChevronRight, LogIn, CreditCard, Wallet,
  Loader2, CheckCircle2, AlertCircle, Settings, AlertTriangle, Calendar
} from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { STORAGE_KEYS, DEFAULT_PRICING, NATIONALITIES } from '../../constants';
import {
  formatTime, calcElapsedMinutes, calcBestPrice,
  generateId, generateStudentId, logActivity,
  getActiveSubscription, localDateStr, searchStudents, checkActiveSession, supabase, matchOfferCriteria,
  settleStudentDebts
} from '../../utils';
import { Input, Select, Textarea, SearchableSelect, Modal, RefreshButton } from '../../components/ui';
import CheckoutModal from './CheckoutModal';
import EditSessionModal from './EditSessionModal';
import { CompleteProfileModal, hasMissingFields } from '../../components/CompleteProfileModal';
import { mtkEnable } from '../../lib/mikrotikApi';
import { toSnake } from '../../lib/fieldMaps';

/* ─── helpers ─── */
function getInitials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function rowColor(m) {
  if (m < 180) return { row: 'hover:bg-gray-50',     dot: null,            label: null,                    badge: null };
  if (m < 300) return { row: 'hover:bg-amber-50/60', dot: 'bg-amber-400',  label: `${Math.floor(m/60)}س ${m%60}د — جلسة طويلة`,  badge: 'bg-amber-100 text-amber-700' };
  return           { row: 'hover:bg-red-50/60',   dot: 'bg-red-400',    label: `${Math.floor(m/60)}س ${m%60}د — تجاوز الوقت`,  badge: 'bg-red-100 text-red-600' };
}

/* ─── Check-in panel ─── */
function CheckInPanel({ user, config, toast, sessions, saveSessions }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [debts, saveDebts] = useStorage(STORAGE_KEYS.DEBTS, []);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [sessionType, setSessionType] = useState('regular');
  const [sessionNote, setSessionNote] = useState('');
  const [activeSub, setActiveSub]     = useState(null);
  const { run: runCheckin, isLocked: isProcessing } = useSubmitLock();
  // debtAlertData: { student, walletDebt, installmentDebt, studentDebtRecords }
  const [debtAlertData, setDebtAlertData] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const { run: runSettle, isLocked: isSettling } = useSubmitLock();
  const [profileModal, setProfileModal] = useState(false);

  useEffect(() => {
    if (!selected) { setActiveSub(null); return; }
    getActiveSubscription(selected.id).then(sub => setActiveSub(sub));
  }, [selected?.id]);

  const activeIds = new Set(sessions.filter(s => s.status === 'active').map(s => s.studentId));

  const filtered = useMemo(() => {
    return searchStudents(students, search).slice(0, 8);
  }, [students, search]);

  const handleCheckin = (skipDebtCheck = false, studentOverride = null) => runCheckin(async () => {
    const student = studentOverride || selected;
    if (!student || activeIds.has(student.id)) return;
    if (hasMissingFields(student, config) && !skipDebtCheck && !studentOverride) {
      setProfileModal(true);
      return;
    }
    if (!skipDebtCheck) {
      const wb = student.walletBalance || 0;
      const studentDebtRecords = debts.filter(d => d.personId === student.id && d.personType === 'student');
      const installmentDebt = studentDebtRecords.reduce((sum, d) =>
        d.type === 'borrow' ? sum + d.amount : sum - d.amount, 0
      );
      if (wb < 0 || installmentDebt > 0) {
        setDebtAlertData({
          student,
          walletDebt: wb < 0 ? Math.abs(wb) : 0,
          installmentDebt: installmentDebt > 0 ? installmentDebt : 0,
          studentDebtRecords,
        });
        setSettleAmount('');
        return;
      }
    }

    try {
      // Server-side duplicate check — prevents stale-state duplicates
      const existing = await checkActiveSession(student.id);
      if (existing) {
        toast(`${student.name} مسجّل دخول بالفعل`, 'error');
        return;
      }

      await saveSessions(prev => [...prev, {
        id: generateId('ses'),
        studentId:    student.id,
        studentName:  student.name,
        studentPhone: student.phone || '',
        studentMemberNumber: student.memberNumber || '',
        checkInTime:  new Date().toISOString(),
        type:   sessionType,
        notes:   sessionNote.trim() || null,
        status: 'active',
        checkedInBy:  user.id,
      }]);
      mtkEnable(config, student).catch(() => {});
      logActivity('تسجيل دخول', student.name, user.id);
      toast(`تم تسجيل دخول ${student.name}`, 'success');
      setSelected(null); setSearch(''); setSessionNote('');
    } catch (err) {
      toast('حدث خطأ أثناء تسجيل الدخول', 'error');
    }
  });

  const handleSettleDebt = () => runSettle(async () => {
    const paid = parseFloat(settleAmount);
    if (!paid || paid <= 0 || !debtAlertData) return;
    try {
      const now = new Date().toISOString();
      const student = debtAlertData.student;
      const { writes, walletAfter, debtPaid, walletAdded } = settleStudentDebts({
        studentId: student.id,
        studentName: student.name,
        cashIn: paid,
        debts,
        walletBalance: student.walletBalance || 0,
        cashierId: user.id === 'admin' ? null : user.id,
        cashierName: user.name || '',
        invoiceId: null,
        now,
      });

      if (walletAfter !== (student.walletBalance || 0)) {
        writes.push(
          supabase.from('students').update({ wallet_balance: walletAfter }).eq('id', student.id)
        );
      }

      const results = await Promise.all(writes);
      const err = results.find(r => r?.error);
      if (err) throw err.error;

      const summary = debtPaid > 0 && walletAdded > 0
        ? `${debtPaid} سداد + ${walletAdded} للمحفظة`
        : debtPaid > 0
          ? `سداد ${debtPaid}`
          : `${walletAdded} للمحفظة`;
      logActivity('تسوية دين', `${student.name} — ${summary} ${config.currency}`, user.id);
      toast(`تم تسجيل ${summary} ${config.currency}`, 'success');
      setDebtAlertData(null);
      handleCheckin(true, student);
    } catch (err) {
      console.error('Settle debt error:', err);
      toast('حدث خطأ أثناء تسجيل التسوية', 'error');
    }
  });

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
          placeholder="بحث بالاسم أو الكود أو الهاتف أو الرقم…"
          className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm text-navy outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
          dir="rtl"
          autoFocus
        />
      </div>

      {/* Results */}
      {filtered.length > 0 && !selected && (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-52 overflow-y-auto">
          {filtered.map(s => {
            const isActive = activeIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => !isActive && setSelected(s)}
                disabled={isActive}
                className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] border-b border-gray-100 last:border-0 text-right transition-colors ${
                  isActive ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:bg-indigo-50 cursor-pointer'
                }`}
              >
                <div>
                  {s.memberNumber && (
                    <p className="text-[11px] font-black text-indigo-600 leading-none mb-0.5">#{s.memberNumber}</p>
                  )}
                  <p className="font-medium text-navy text-sm">{s.name}</p>
                  {s.phone && <p className="text-xs text-navy-400">{s.phone}</p>}
                </div>
                {isActive
                  ? <span className="text-xs bg-teal-100 text-teal-700 font-medium px-2 py-0.5 rounded-full">داخل حالياً</span>
                  : <span className="text-xs text-indigo-400">اختر</span>
                }
              </button>
            );
          })}
        </div>
      )}
      {search && filtered.length === 0 && !selected && (
        <p className="text-center py-4 text-navy-400 text-sm">لا توجد نتائج</p>
      )}

      {/* Selected card */}
      {selected && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-navy">{selected.name}</p>
              <p className="text-xs text-navy-400">
                <span className="font-mono font-semibold text-indigo-600">{selected.memberNumber || '—'}</span>{selected.phone && ` · ${selected.phone}`}
              </p>
              {activeSub && (
                <span className="inline-flex items-center mt-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  اشتراك نشط — {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} متبقٍ
                </span>
              )}
            </div>
            <button onClick={() => { setSelected(null); setSearch(''); }} className="p-1 text-navy-400 hover:text-navy cursor-pointer">
              <X size={14}/>
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ملاحظة (اختياري)</label>
            <textarea
              value={sessionNote}
              onChange={e => setSessionNote(e.target.value)}
              placeholder="أي ملاحظة على الجلسة…"
              rows={2}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              dir="rtl"
            />
          </div>
          <button
            onClick={() => handleCheckin(false)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Check size={14}/><span>تسجيل الدخول</span>
          </button>
        </div>
      )}

      {profileModal && selected && (
        <CompleteProfileModal
          student={selected}
          config={config}
          onClose={() => setProfileModal(false)}
          onSaved={(updatedStudent) => {
            setSelected(updatedStudent);
            setProfileModal(false);
            handleCheckin(false, updatedStudent);
          }}
        />
      )}

      <Modal
        open={!!debtAlertData}
        onClose={() => setDebtAlertData(null)}
        title="تنبيه: مديونية سابقة"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end flex-wrap">
            <button
              onClick={() => setDebtAlertData(null)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={() => { const s = debtAlertData?.student; setDebtAlertData(null); handleCheckin(true, s); }}
              className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors cursor-pointer"
            >
              دخول بدون تسوية
            </button>
            {debtAlertData?.installmentDebt > 0 && (
              <button
                onClick={handleSettleDebt}
                disabled={isSettling || !(parseFloat(settleAmount) > 0)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSettling ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                تسوية ودخول
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle size={16} className="shrink-0"/>
            <span className="font-medium">{debtAlertData?.student?.name}</span>
          </div>
          {debtAlertData?.walletDebt > 0 && (
            <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <span className="text-red-700">رصيد محفظة سالب (دين جلسة)</span>
              <span className="font-bold text-red-700">{debtAlertData.walletDebt.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}
          {debtAlertData?.installmentDebt > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-orange-700">دين أقساط اشتراك</span>
                <span className="font-bold text-orange-700">{debtAlertData.installmentDebt.toLocaleString('en-US')} {config.currency}</span>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">المبلغ المستلم الآن:</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  placeholder={`من ${debtAlertData.installmentDebt.toLocaleString('en-US')} ${config.currency}`}
                  className="w-full border border-orange-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-300"
                  dir="ltr"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ─── New Student panel ─── */
function NewStudentPanel({ user, config, toast, sessions, saveSessions }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [form, setForm]   = useState({ name:'', phone:'', userNumber:'', notes:'', university:'', college:'', academicYear:'', nationality:'' });
  const [errors, setErrors] = useState({});
  const [checkinNow, setCheckinNow] = useState(true);
  const { run: runRegister, isLocked: isProcessing } = useSubmitLock();

  const [phoneStatus, setPhoneStatus] = useState(null);
  const [userNumStatus, setUserNumStatus] = useState(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const p = form.phone.trim();
      if (!p) return setPhoneStatus(null);
      setPhoneStatus('checking');
      try {
        const { data } = await supabase.from('students').select('phone').eq('phone', p).maybeSingle();
        setPhoneStatus(data ? 'taken' : 'available');
      } catch (err) { setPhoneStatus(null); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.phone]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const u = form.userNumber.trim().toLowerCase();
      if (!u) { setUserNumStatus(null); return; }
      
      // Instant local check first (exact or partial suffix match)
      const localMatch = students.find(s => 
        (s.memberNumber && String(s.memberNumber).toLowerCase() === u) || 
        (s.studentId && String(s.studentId).toLowerCase().includes(u))
      );
      if (localMatch) {
        setUserNumStatus({ status: 'taken', name: localMatch.name });
        return;
      }

      setUserNumStatus('checking');
      try {
        // Double check DB (member_number EXACT OR student_id CONTAINS)
        const { data: list } = await supabase
          .from('students')
          .select('name, member_number, student_id')
          .or(`member_number.eq.${u},student_id.ilike.%${u}%`)
          .limit(1);

        if (list && list.length > 0) {
          setUserNumStatus({ status: 'taken', name: list[0].name });
        } else {
          setUserNumStatus('available');
        }
      } catch (err) { setUserNumStatus(null); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.userNumber, students]);

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name       = 'الاسم مطلوب';
    if (!form.phone.trim()) {
      e.phone = 'رقم الهاتف مطلوب';
    } else if (phoneStatus === 'taken') {
      e.phone = 'مسجل بالفعل في النظام';
    }
    if (!form.userNumber.trim()) {
      e.userNumber = 'رقم المستخدم مطلوب';
    } else if (userNumStatus?.status === 'taken' || userNumStatus === 'taken') {
      e.userNumber = `الكود مستخدم بالنظام (${userNumStatus?.name || ''})`;
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = () => runRegister(async () => {
    if (!validate()) return;
    try {
      const studentId = await generateStudentId();
      const ns = {
        id: generateId('stu'),
        studentId,
        name:         form.name.trim(),
        phone:        form.phone.trim(),
        memberNumber: form.userNumber.trim(),
        university:   form.university,
        college:      form.college,
        academicYear: form.academicYear,
        nationality:  form.nationality.trim(),
        notes:        form.notes.trim(),
        email:        '',
        tags:         [],
        walletBalance: 0,
        createdAt:    new Date().toISOString(),
      };
      await saveStudents(prev => [...prev, ns]);
      logActivity('تسجيل طالب جديد', `${ns.name} — ${ns.studentId} · #${ns.memberNumber}`, user.id);

      if (checkinNow) {
        await saveSessions(prev => [...prev, {
          id: generateId('ses'),
          studentId:    ns.id,
          studentName:  ns.name,
          studentPhone: ns.phone,
          studentMemberNumber: ns.memberNumber || '',
          checkInTime:  new Date().toISOString(),
          type:   'regular',
          status: 'active',
          checkedInBy:  user.id,
        }]);
        mtkEnable(config, ns).catch(() => {});
        logActivity('تسجيل دخول', ns.name, user.id);
        toast(`تم تسجيل ${ns.name} ودخوله للمكتبة`, 'success');
      } else {
        toast(`تم تسجيل ${ns.name}`, 'success');
      }
      setForm({ name:'', phone:'', userNumber:'', notes:'', university:'', college:'', academicYear:'', nationality:'' });
      setErrors({});
    } catch (err) {
      toast('حدث خطأ أثناء التسجيل', 'error');
    }
  });

  return (
    <div className="space-y-3">
      <Input label="الاسم الكامل *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errors.name} placeholder="اسم الطالب"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Input label="رقم الهاتف *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} error={errors.phone} placeholder="01XXXXXXXXX"/>
          {form.phone.trim() && !errors.phone && (
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              {phoneStatus === 'checking' && <><Loader2 size={10} className="animate-spin text-indigo-500" /><span className="text-indigo-500">تحقق...</span></>}
              {phoneStatus === 'available' && <><CheckCircle2 size={10} className="text-teal-500" /><span className="text-teal-500">متاح</span></>}
              {phoneStatus === 'taken' && <><AlertCircle size={10} className="text-red-500" /><span className="text-red-500">مسجل مسبقاً</span></>}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
            <Hash size={12} className="text-indigo-500"/>رقم المستخدم *
          </label>
          <input
            type="text"
            value={form.userNumber}
            onChange={e=>setForm({...form,userNumber:e.target.value})}
            placeholder="مثال: 001"
            className={`w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors ${
              errors.userNumber ? 'border-red-400' : 'border-gray-200'
            }`}
            dir="rtl"
          />
          {errors.userNumber ? (
            <p className="text-xs text-red-500 mt-1">{errors.userNumber}</p>
          ) : form.userNumber.trim() ? (
            <div className="mt-1 flex items-center gap-1.5 text-[10px]">
              {userNumStatus === 'checking' && <><Loader2 size={10} className="animate-spin text-indigo-500" /><span className="text-indigo-500">تحقق...</span></>}
              {userNumStatus === 'available' && <><CheckCircle2 size={10} className="text-teal-500" /><span className="text-teal-500">متاح</span></>}
              {(userNumStatus === 'taken' || userNumStatus?.status === 'taken') && (
                <><AlertCircle size={10} className="text-red-500" /><span className="text-red-500">مسجل: {userNumStatus?.name || ''}</span></>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">رقم مخصص وإلزامي</p>
          )}
        </div>
      </div>
      <SearchableSelect label="الجنسية" value={form.nationality} onChange={v=>setForm({...form,nationality:v})} options={NATIONALITIES} placeholder="— اختر —"/>
      <Textarea label="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="أي ملاحظات…" rows={2}/>

      {/* University / College / Year */}
      <Select label="الجامعة" value={form.university} onChange={e=>setForm({...form,university:e.target.value})}>
        <option value="">— اختر —</option>
        {(config.universities || []).map(u => <option key={u} value={u}>{u}</option>)}
      </Select>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="الكلية" value={form.college} onChange={e=>setForm({...form,college:e.target.value})}>
          <option value="">— اختر —</option>
          {(config.colleges || []).map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select label="السنة" value={form.academicYear} onChange={e=>setForm({...form,academicYear:e.target.value})}>
          <option value="">— اختر —</option>
          {['1','2','3','4','5','6'].map(y => <option key={y} value={y}>السنة {y}</option>)}
        </Select>
      </div>

      {/* Check-in toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={()=>setCheckinNow(!checkinNow)}
          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${checkinNow?'bg-teal-500':'bg-gray-200'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checkinNow?'translate-x-1 right-auto left-0.5':'right-0.5'}`}/>
        </div>
        <span className="text-sm text-navy">{checkinNow ? 'تسجيل دخول فوري' : 'حفظ فقط'}</span>
      </label>

      <button
        onClick={handleSubmit}
        disabled={isProcessing}
        className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
          isProcessing
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg active:scale-[0.98] cursor-pointer'
        }`}
      >
        {isProcessing ? 'جاري الحفظ...' : (
          <><UserPlus size={18}/> {checkinNow ? 'تسجيل وحضور' : 'تسجيل فقط'}</>
        )}
      </button>
    </div>
  );
}

/* ─── helpers ─── */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

/* ─── Subscription panel ─── */
function SubscriptionPanel({ user, config, toast }) {
  const [plans]                        = useStorage(STORAGE_KEYS.SUBSCRIPTION_PLANS, []);
  const [studentSubs, saveStudentSubs] = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
  const [students, saveStudents]       = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [invoices, saveInvoices]       = useStorage(STORAGE_KEYS.INVOICES, []);
  const [pricing]                      = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [shifts]                       = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [owners]                       = useStorage(STORAGE_KEYS.OWNERS, []);

  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null);
  const [planId, setPlanId]           = useState('');
  const [startDate, setStartDate]     = useState(localDateStr());
  const [manualExpiry, setManualExpiry] = useState('');
  const [payMethod, setPayMethod]     = useState('cash');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [downPayment, setDownPayment] = useState('');
  const { run: runAssign, isLocked: isProcessing } = useSubmitLock();
  const [selectedOfferId, setSelectedOfferId] = useState(null);

  const activePlans  = plans.filter(p => p.active !== false);
  const selectedPlan = activePlans.find(p => p.id === planId) || null;
  const basePrice    = selectedPlan ? selectedPlan.price : 0;
  const activeShift  = shifts.find(s => s.cashierId === user.id && s.status === 'active');
  const linkedOwners = owners.filter(o => selected && (o.studentIds || []).includes(selected.id));
  const selectedOwner = linkedOwners.find(o => o.id === selectedOwnerId) || null;

  const availableOffers = useMemo(() =>
    (pricing?.specialOffers || []).filter(o =>
      o.active && (o.appliesTo === 'subscription' || o.appliesTo === 'both' || !o.appliesTo)
    ), [pricing]);

  const autoMatchedOfferId = useMemo(() => {
    if (!selected) return null;
    const match = availableOffers.find(o => matchOfferCriteria(o, selected));
    return match ? match.id : null;
  }, [availableOffers, selected]);

  useEffect(() => {
    setSelectedOfferId(autoMatchedOfferId);
  }, [autoMatchedOfferId]);

  const activeOffer = availableOffers.find(o => o.id === selectedOfferId) || null;

  const { discountAmount, discountLabel } = useMemo(() => {
    const planPct = selectedPlan?.discountPercent || 0;
    const planAmt = planPct > 0 ? Math.floor(basePrice * (planPct / 100)) : 0;
    const planLbl = planPct > 0 ? `خصم الباقة ${planPct}%` : null;

    let offerAmt = 0, offerLbl = null;
    if (activeOffer) {
      offerAmt = activeOffer.discountType === 'percentage'
        ? Math.floor(basePrice * (activeOffer.percentage / 100))
        : Math.max(0, basePrice - (activeOffer.price || 0));
      offerLbl = activeOffer.label;
    }

    if (offerAmt > planAmt) return { discountAmount: offerAmt, discountLabel: offerLbl };
    if (planAmt > 0) return { discountAmount: planAmt, discountLabel: planLbl };
    return { discountAmount: 0, discountLabel: null };
  }, [selectedPlan, basePrice, activeOffer]);

  const grandTotal  = Math.max(0, basePrice - discountAmount);
  const actualPay   = isInstallment ? (Number(downPayment) || 0) : grandTotal;
  const debtAmount  = Math.max(0, grandTotal - actualPay);

  const updateExpiry = (start, pId) => {
    const p = plans.find(pl => pl.id === pId);
    if (p && start) {
      const d = new Date(start);
      d.setDate(d.getDate() + (p.validityDays || 30));
      setManualExpiry(d.toISOString().slice(0, 10));
    } else setManualExpiry('');
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    return searchStudents(students, search).slice(0, 6);
  }, [students, search]);

  const reset = () => {
    setSelected(null); setSearch(''); setPlanId('');
    setStartDate(localDateStr()); setManualExpiry('');
    setPayMethod('cash'); setSelectedOwnerId('');
    setIsInstallment(false); setDownPayment('');
    setSelectedOfferId(null);
  };

  const handleAssign = () => runAssign(async () => {
    if (!selected) { toast('اختر الطالب', 'error'); return; }
    if (!selectedPlan) { toast('اختر الخطة', 'error'); return; }
    if (!startDate) { toast('حدد تاريخ البدء', 'error'); return; }

    const today = localDateStr();
    const existingActive = studentSubs.find(s =>
      s.studentId === selected.id && s.status === 'active' && (!s.expiryDate || s.expiryDate >= today)
    );
    if (existingActive) {
      toast(`لديه اشتراك نشط: ${existingActive.planName} (ينتهي ${existingActive.expiryDate})`, 'error');
      return;
    }
    if (grandTotal > 0) {
      if (payMethod === 'wallet' && (selected.walletBalance || 0) < grandTotal) { toast('رصيد المحفظة غير كافٍ', 'error'); return; }
      if (payMethod === 'owner' && (!selectedOwner || (selectedOwner.balance || 0) < grandTotal)) { toast('رصيد الحساب غير كافٍ', 'error'); return; }
    }

    try {
      const expiryDate = manualExpiry || (() => {
        const d = new Date(startDate); d.setDate(d.getDate() + (selectedPlan.validityDays || 30)); return d.toISOString().slice(0,10);
      })();
      const now = new Date().toISOString();
      const newSubId = generateId('sub');
      const invoiceId = generateId('inv');

      const newSub = {
        id: newSubId, studentId: selected.id, studentName: selected.name,
        planId: selectedPlan.id, planName: selectedPlan.name,
        quotaType: selectedPlan.quotaType, totalQuota: selectedPlan.quota,
        remainingQuota: selectedPlan.quota, usedDates: [],
        validityDays: selectedPlan.validityDays, startDate, expiryDate,
        status: 'active', activatedBy: user.id, createdAt: now,
      };

      const writes = [supabase.from('student_subscriptions').upsert(toSnake(newSub))];

      // Invoice
      if (actualPay > 0 || basePrice > 0) {
        const inv = {
          id: invoiceId, shiftId: activeShift?.id || null,
          studentId: selected.id, studentName: selected.name,
          priceType: 'subscription',
          pricingLabel: `شراء اشتراك: ${selectedPlan.name}${isInstallment ? ' (تقسيط)' : ''}`,
          amount: basePrice, kitchenTotal: 0,
          discountId: activeOffer?.id || null,
          discountLabel: discountLabel || null, discountAmount: discountAmount || 0,
          total: actualPay, billingType: 'subscription',
          subscriptionId: newSubId,
          paymentMethod: actualPay > 0 ? payMethod : null,
          ownerId: (actualPay > 0 && payMethod === 'owner') ? selectedOwnerId : null,
          cashierId: user.id, createdAt: now,
        };
        writes.push(supabase.from('invoices').upsert(toSnake(inv)));
        saveInvoices([inv, ...invoices]);
      }

      // Wallet deduction (wallet pay OR installment remainder)
      if (payMethod === 'wallet' && grandTotal > 0) {
        const newBal = (selected.walletBalance || 0) - grandTotal;
        writes.push(supabase.from('students').update({ wallet_balance: newBal }).eq('id', selected.id));
        saveStudents(prev => prev.map(s => s.id === selected.id ? { ...s, walletBalance: newBal } : s));
        setSelected(s => s ? { ...s, walletBalance: newBal } : s);
      } else if (payMethod === 'owner' && selectedOwner && grandTotal > 0) {
        writes.push(supabase.from('owners').update({ balance: (selectedOwner.balance || 0) - grandTotal }).eq('id', selectedOwner.id));
      }

      // Installment debt
      if (debtAmount > 0) {
        const debtObj = {
          id: generateId('debt'),
          personId: selected.id, personName: selected.name, personType: 'student',
          amount: debtAmount, type: 'borrow',
          note: `قسط اشتراك — ${selectedPlan.name} (دفع ${actualPay} من ${grandTotal} ${config.currency})`,
          cashierId: user.id, cashierName: user.name || '',
          createdAt: now,
        };
        writes.push(supabase.from('debts').upsert(toSnake(debtObj), { onConflict: 'id' }));
      }

      const results = await Promise.all(writes);
      const err = results.find(r => r?.error);
      if (err) throw err.error;

      saveStudentSubs([newSub, ...studentSubs]);
      logActivity('تفعيل اشتراك', `${selected.name} — ${selectedPlan.name} (${actualPay} ${config.currency})`, user.id);
      toast(`تم تفعيل اشتراك "${selectedPlan.name}" بنجاح`, 'success');
      reset();
    } catch (err) {
      toast(err?.message || 'حدث خطأ أثناء تفعيل الاشتراك', 'error');
    }
  });

  const PAY_OPTS = [
    { k: 'cash', label: 'نقدي' },
    { k: 'transfer', label: 'تحويل' },
    { k: 'wallet', label: `محفظة ${selected ? `(${(selected.walletBalance||0).toLocaleString('en-US')})` : ''}` },
    ...(linkedOwners.length > 0 ? [{ k: 'owner', label: 'حساب' }] : []),
  ];

  return (
    <div className="space-y-4">

      {/* Student search */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">الطالب</label>
        {selected ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-navy text-sm">{selected.name}</p>
              <p className="text-[11px] text-gray-400">
                {selected.memberNumber || '—'}
                {selected.walletBalance ? ` · محفظة: ${selected.walletBalance.toLocaleString('en-US')} ${config.currency}` : ''}
              </p>
              {activeOffer && (
                <span className="inline-flex items-center gap-1 mt-1 bg-teal-100 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  {autoMatchedOfferId === activeOffer.id ? '🎯' : '🏷️'} {activeOffer.label}
                </span>
              )}
            </div>
            <button onClick={reset} className="p-1 text-gray-400 hover:text-navy cursor-pointer"><X size={14}/></button>
          </div>
        ) : (
          <div className="relative">
            <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الكود أو الهاتف…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
              dir="rtl"
            />
            {filtered.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                {filtered.map(s => (
                  <button key={s.id} onClick={() => { setSelected(s); setSearch(''); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] text-right border-b border-gray-100 last:border-0 hover:bg-indigo-50 cursor-pointer text-sm">
                    <div>
                      <p className="font-medium text-navy">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{s.memberNumber || '—'}{s.phone && ` · ${s.phone}`}</p>
                    </div>
                    <span className="text-xs text-indigo-400">اختر</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">الخطة</label>
        {activePlans.length === 0 ? (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">لا توجد خطط مفعّلة</p>
        ) : (
          <div className="space-y-1.5">
            {activePlans.map(p => (
              <button key={p.id}
                onClick={() => { setPlanId(p.id); updateExpiry(startDate, p.id); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-right transition-all cursor-pointer text-sm ${
                  planId === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div>
                  <p className={`font-semibold ${planId === p.id ? 'text-indigo-700' : 'text-navy'}`}>{p.name}</p>
                  <p className="text-[11px] text-gray-400">{p.quota} {p.quotaType === 'hours' ? 'ساعة' : 'يوم'} · {p.validityDays} يوم</p>
                </div>
                <span className={`font-bold text-sm shrink-0 ${planId === p.id ? 'text-indigo-600' : 'text-teal-600'}`}>
                  {p.price.toLocaleString('en-US')} {config.currency}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Offer selector */}
      {selectedPlan && availableOffers.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">العروض المتاحة</label>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedOfferId(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all cursor-pointer ${
                !selectedOfferId ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >بدون خصم</button>
            {availableOffers.map(o => {
              const isSelected = selectedOfferId === o.id;
              const isAutoMatch = autoMatchedOfferId === o.id;
              const summary = o.discountType === 'percentage' ? `${o.percentage}%` : `${o.price} ${config.currency}`;
              return (
                <button key={o.id}
                  onClick={() => setSelectedOfferId(o.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all cursor-pointer ${
                    isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                  }`}
                >
                  {isAutoMatch && <span className="ml-1">🎯</span>}
                  {o.label} ({summary})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">تاريخ البدء</label>
          <input type="date" value={startDate}
            onChange={e => { setStartDate(e.target.value); updateExpiry(e.target.value, planId); }}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-1">تاريخ الانتهاء</label>
          <input type="date" value={manualExpiry} onChange={e => setManualExpiry(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Payment method */}
      {selectedPlan && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">طريقة الدفع</label>
          <div className="flex gap-1.5 flex-wrap">
            {PAY_OPTS.map(({k, label}) => (
              <button key={k} onClick={() => setPayMethod(k)}
                className={`flex-1 min-w-[60px] py-2 rounded-xl text-xs font-semibold border-2 transition-all cursor-pointer ${
                  payMethod === k ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}
              >{label}</button>
            ))}
          </div>
          {payMethod === 'owner' && linkedOwners.length > 0 && (
            <select value={selectedOwnerId} onChange={e => setSelectedOwnerId(e.target.value)}
              className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
              dir="rtl"
            >
              <option value="">اختر الحساب…</option>
              {linkedOwners.map(o => (
                <option key={o.id} value={o.id}>{o.name} — {(o.balance||0).toLocaleString('en-US')} {config.currency}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Installment toggle */}
      {selectedPlan && (
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setIsInstallment(v => !v)}
              className={`w-10 h-5 rounded-full transition-all relative cursor-pointer flex-shrink-0 ${isInstallment ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isInstallment ? 'right-0.5' : 'left-0.5'}`}/>
            </button>
            <span className="text-xs text-gray-700">دفع بالأقساط</span>
          </label>
          {isInstallment && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <input type="number" inputMode="decimal" value={downPayment} onChange={e => setDownPayment(e.target.value)}
                placeholder="المبلغ المدفوع الآن…"
                className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-amber-300"
                dir="ltr"
              />
              {Number(downPayment) >= 0 && (
                <p className="text-xs text-amber-800">
                  الباقي كدين: <strong>{debtAmount.toLocaleString('en-US')} {config.currency}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Price summary */}
      {selectedPlan && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>سعر الخطة</span>
            <span className="font-medium">{basePrice.toLocaleString('en-US')} {config.currency}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>{discountLabel || 'خصم'}</span>
              <span className="font-medium">- {discountAmount.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}
          <div className="flex justify-between text-navy font-bold border-t border-gray-200 pt-1.5">
            <span>{isInstallment ? 'المدفوع الآن' : 'الإجمالي'}</span>
            <span className="text-teal-600">{actualPay.toLocaleString('en-US')} {config.currency}</span>
          </div>
          {debtAmount > 0 && (
            <div className="flex justify-between text-amber-700 text-xs">
              <span>يُسجَّل كدين</span>
              <span>{debtAmount.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}
        </div>
      )}

      <button onClick={handleAssign}
        disabled={isProcessing || !selected || !planId}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
        <span>تفعيل الاشتراك</span>
      </button>
    </div>
  );
}

/* ─── Main Hub ─── */
export default function CashierHub({ user, config, toast, setActiveView, uncollectedBalance, onStudentClick }) {
  const [students, , refreshStudents]     = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions, refresh] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices, , refreshInvoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [allSubs, , refreshSubs]       = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
  const [pricing, , refreshPricing]    = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);

  const handleRefresh = () => Promise.all([refreshStudents(), refresh(), refreshInvoices(), refreshSubs(), refreshPricing()]);
  const [checkoutSes, setCheckoutSes] = useState(null);
  const [editSes, setEditSes]         = useState(null);
  const [tab, setTab] = useState('checkin'); // 'checkin' | 'newstudent'
  const [sessionSearch, setSessionSearch] = useState('');
  useLiveTimer(30000);

  const active     = sessions.filter(s => s.status === 'active').sort((a,b) => new Date(a.checkInTime)-new Date(b.checkInTime));
  const displayed = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return active;
    return active
      .map(s => {
        let score = 0;
        const stu = students.find(st => st.id === s.studentId);
        const sid = (stu?.studentId || '').toLowerCase();
        const mno = (stu?.memberNumber || '').toLowerCase();
        const name = (s.studentName || '').toLowerCase();
        const ph = (s.studentPhone || '').toLowerCase();
        if (sid === q || mno === q) score += 1000;
        else if (sid.startsWith(q) || mno.startsWith(q)) score += 500;
        else if (sid.includes(q) || mno.includes(q)) score += 100;
        else if (name.startsWith(q)) score += 50;
        else if (name.includes(q)) score += 10;
        else if (ph.includes(q)) score += 5;
        return { session: s, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.session);
  }, [active, sessionSearch, students]);
  const todayStr   = localDateStr();
  const todayRev   = invoices
    .filter(i => i.createdAt && localDateStr(new Date(i.createdAt)) === todayStr && (i.paymentMethod === 'cash' || !i.paymentMethod))
    .reduce((s,i)=>s+(i.total||0),0);
  const capacity   = config.capacity || 50;
  const pct        = Math.round((active.length / capacity) * 100);

  return (
    <div className="h-full flex flex-col gap-4 p-3 sm:p-5 fade-in" style={{ background: '#F8F9FB' }}>

      {/* ── Top stats bar ── */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-navy">الجلسات النشطة</h1>
          <RefreshButton onRefresh={handleRefresh} />
          <span className="flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block"/>
            {active.length} نشط
          </span>
        </div>
        <div className="flex items-center gap-4 order-2 sm:order-3 ml-auto">
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp size={14} className="text-teal-500"/>
            <div className="flex flex-col">
              <span className="text-[10px] text-navy-400 font-bold leading-tight">كاش اليوم:</span>
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-navy">{todayRev.toLocaleString('en-US')}</span>
                <span className="text-navy-400 text-[10px]">{config.currency}</span>
              </div>
            </div>
          </div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 text-sm bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            <Wallet size={14} className="text-indigo-500"/>
            <span className="text-xs text-indigo-400 font-bold ml-1">إجمالي العهدة:</span>
            <span className="font-bold text-navy">{(uncollectedBalance || 0).toLocaleString('en-US')}</span>
            <span className="text-navy-400 text-[10px]">{config.currency}</span>
          </div>
        </div>
        <div className="flex-1 min-w-full sm:min-w-0 order-3 sm:order-2 bg-white rounded-xl border border-gray-200 px-4 py-2 flex items-center gap-3 shadow-sm">
          <span className="text-xs text-navy-500 shrink-0">{active.length}/{capacity}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${pct>=90?'bg-red-400':pct>=70?'bg-amber-400':'bg-teal-400'}`}
              style={{width:`${Math.min(pct,100)}%`}}
            />
          </div>
          <span className="text-xs text-navy-400 shrink-0">{capacity-active.length} متاح</span>
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

        {/* Left: Sessions table */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                placeholder="بحث في الجلسات النشطة…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-8 pl-3 py-2 text-sm text-navy outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                dir="rtl"
              />
            </div>
          </div>

          {active.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <Users size={44} className="text-gray-200 mb-4"/>
              <p className="text-navy-400 font-medium text-sm">لا توجد جلسات نشطة حالياً</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <Search size={36} className="text-gray-200 mb-3"/>
              <p className="text-navy-400 text-sm">لا توجد نتائج</p>
            </div>
          ) : (<>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200 text-navy-500 text-xs uppercase">
                      <th className="px-4 py-3 text-right font-semibold">الكود</th>
                      <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                      <th className="px-4 py-3 text-right font-semibold">الدخول</th>
                      <th className="px-4 py-3 text-right font-semibold">المدة</th>
                      <th className="px-4 py-3 text-right font-semibold">التكلفة</th>
                      <th className="px-4 py-3 text-right font-semibold">اشتراك</th>
                      <th className="px-4 py-3"/>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(s => {
                      const mins = calcElapsedMinutes(s.checkInTime);
                      const { best } = calcBestPrice(mins, pricing);
                      const hrs = Math.floor(mins/60), m = mins%60;
                      const { row, dot, label, badge } = rowColor(mins);
                      const hasSub = allSubs.some(sub => sub.studentId===s.studentId && sub.status==='active' && (!sub.expiryDate || sub.expiryDate >= todayStr));
                      const stu = students.find(st => st.id === s.studentId);
                      const code = stu?.memberNumber || '';
                      return (
                        <tr key={s.id} className={`border-b transition-colors ${hasSub ? 'bg-teal-50 border-teal-100 hover:bg-teal-100/70' : `border-gray-100 ${row}`}`}>
                          <td className="px-4 py-3 text-right">
                            {code
                              ? <span className="font-mono font-bold text-indigo-600 text-sm bg-indigo-50 px-2 py-0.5 rounded-lg">{code}</span>
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <button onClick={() => onStudentClick?.(s.studentId)} className="font-semibold text-navy text-sm hover:text-indigo-600 hover:underline cursor-pointer transition-colors text-right">{s.studentName}</button>
                              {s.studentPhone && <p className="text-xs text-navy-400">{s.studentPhone}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-navy-500">
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-navy-300"/><span className="text-xs">{formatTime(s.checkInTime)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-navy text-xs">{hrs}h {m}m</td>
                          <td className="px-4 py-3 font-semibold text-teal-600 text-sm">{best.amount.toLocaleString('en-US')} {config.currency}</td>
                          <td className="px-4 py-3">
                            {hasSub
                              ? <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"/>مشترك</span>
                              : <span className="text-gray-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={()=>setCheckoutSes(s)}
                                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                              >
                                <LogOut size={11}/><span>خروج</span>
                              </button>
                              <button
                                onClick={()=>onStudentClick?.(s.studentId)}
                                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-navy px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                title="تعديل بيانات الطالب"
                              >
                                <Pencil size={12}/><span>بيانات</span>
                              </button>
                              {user.role === 'admin' && (
                                <button
                                  onClick={()=>setEditSes(s)}
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="تعديل الجلسة / الطلبات"
                                >
                                  <Settings size={14}/>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden overflow-y-auto divide-y divide-gray-100">
              {displayed.map(s => {
                const mins = calcElapsedMinutes(s.checkInTime);
                const { best } = calcBestPrice(mins, pricing);
                const hrs = Math.floor(mins/60), m = mins%60;
                const { row, badge } = rowColor(mins);
                const hasSub = allSubs.some(sub => sub.studentId===s.studentId && sub.status==='active' && (!sub.expiryDate || sub.expiryDate >= todayStr));
                const stu = students.find(st => st.id === s.studentId);
                const code = stu?.memberNumber || '';
                return (
                  <div key={s.id} className={`p-3 ${hasSub ? 'bg-teal-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => onStudentClick?.(s.studentId)} className="font-semibold text-navy text-sm hover:text-indigo-600 cursor-pointer transition-colors text-right truncate">{s.studentName}</button>
                          {code && <span className="font-mono font-bold text-indigo-600 text-xs bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">#{code}</span>}
                        </div>
                        {s.studentPhone && <p className="text-xs text-navy-400 mt-0.5">{s.studentPhone}</p>}
                      </div>
                      {hasSub && (
                        <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>مشترك
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-navy-500 mb-2.5">
                      <span className="flex items-center gap-1"><Clock size={11} className="text-navy-300"/>{formatTime(s.checkInTime)}</span>
                      <span className="font-mono font-semibold">{hrs}h {m}m</span>
                      <span className="font-semibold text-teal-600">{best.amount.toLocaleString('en-US')} {config.currency}</span>
                      {badge && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge}`}>{Math.floor(mins/60)}س</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={()=>setCheckoutSes(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                      >
                        <LogOut size={12}/><span>خروج</span>
                      </button>
                      <button
                        onClick={()=>onStudentClick?.(s.studentId)}
                        className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-navy min-h-[44px] py-2 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Pencil size={12}/>
                      </button>
                      {user.role === 'admin' && (
                        <button
                          onClick={()=>setEditSes(s)}
                          className="flex items-center justify-center min-h-[44px] p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                        >
                          <Settings size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>)}
        </div>

        {/* Right: Tab panel */}
        <div className="w-full lg:w-80 lg:shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={()=>setTab('checkin')}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab==='checkin' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-navy-400 hover:text-navy hover:bg-gray-50'
              }`}
            >
              <Check size={13}/> تسجيل دخول
            </button>
            <button
              onClick={()=>setTab('newstudent')}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab==='newstudent' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-navy-400 hover:text-navy hover:bg-gray-50'
              }`}
            >
              <UserPlus size={13}/> طالب جديد
            </button>
            <button
              onClick={()=>setTab('subscription')}
              className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab==='subscription' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-navy-400 hover:text-navy hover:bg-gray-50'
              }`}
            >
              <CreditCard size={13}/> اشتراك
            </button>
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'checkin' ? (
              <CheckInPanel user={user} config={config} toast={toast} sessions={sessions} saveSessions={saveSessions}/>
            ) : tab === 'newstudent' ? (
              <NewStudentPanel user={user} config={config} toast={toast} sessions={sessions} saveSessions={saveSessions}/>
            ) : (
              <SubscriptionPanel user={user} config={config} toast={toast}/>
            )}
          </div>
        </div>
      </div>

      <CheckoutModal
        open={!!checkoutSes}
        onClose={()=>setCheckoutSes(null)}
        session={checkoutSes}
        config={config}
        user={user}
        toast={toast}
        onCheckedOut={()=>{ refresh(); refreshInvoices(); setCheckoutSes(null); }}
        onStudentClick={onStudentClick}
      />

      <EditSessionModal
        open={!!editSes}
        onClose={()=>setEditSes(null)}
        session={editSes}
        user={user}
        toast={toast}
        onUpdated={() => { refresh(); setEditSes(null); }}
      />
    </div>
  );
}
