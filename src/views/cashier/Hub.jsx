import { useState, useMemo, useEffect } from 'react';
import {
  LogOut, Users, TrendingUp, Clock, Search, Check, X,
  UserPlus, Hash, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useLiveTimer } from '../../hooks/useLiveTimer';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import {
  formatTime, calcElapsedMinutes, calcBestPrice,
  generateId, generateStudentId, logActivity,
  getActiveSubscription,
} from '../../utils';
import { Input, Select, Textarea } from '../../components/ui';
import CheckoutModal from './CheckoutModal';

/* ─── helpers ─── */
function getInitials(name = '') {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function rowColor(m) {
  if (m < 180) return { row: 'hover:bg-teal-50/60',  dot: 'bg-teal-400',  label: 'عادي',  badge: 'bg-teal-100 text-teal-700' };
  if (m < 300) return { row: 'hover:bg-amber-50/60', dot: 'bg-amber-400', label: 'طويل', badge: 'bg-amber-100 text-amber-700' };
  return           { row: 'hover:bg-red-50/60',   dot: 'bg-red-400',   label: 'تجاوز', badge: 'bg-red-100 text-red-700' };
}

/* ─── Check-in panel ─── */
function CheckInPanel({ user, config, toast, sessions, saveSessions }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [sessionType, setSessionType] = useState('regular');
  const [activeSub, setActiveSub]     = useState(null);

  useEffect(() => {
    if (!selected) { setActiveSub(null); return; }
    getActiveSubscription(selected.id).then(sub => setActiveSub(sub));
  }, [selected?.id]);

  const activeIds = new Set(sessions.filter(s => s.status === 'active').map(s => s.studentId));

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.memberNumber || '').includes(q)
    ).slice(0, 8);
  }, [students, search]);

  const handleCheckin = () => {
    if (!selected || activeIds.has(selected.id)) return;
    saveSessions([...sessions, {
      id: generateId('ses'),
      studentId:    selected.id,
      studentName:  selected.name,
      studentPhone: selected.phone || '',
      checkInTime:  new Date().toISOString(),
      type:   sessionType,
      status: 'active',
    }]);
    logActivity('تسجيل دخول', selected.name, user.id);
    toast(`تم تسجيل دخول ${selected.name}`, 'success');
    setSelected(null); setSearch('');
  };

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
                className={`w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-0 text-right transition-colors ${
                  isActive ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:bg-indigo-50 cursor-pointer'
                }`}
              >
                <div>
                  <p className="font-medium text-navy text-sm">{s.name}</p>
                  <p className="text-xs text-navy-400">
                    {s.studentId}{s.memberNumber && ` · #${s.memberNumber}`}{s.phone && ` · ${s.phone}`}
                  </p>
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
                {selected.studentId}{selected.memberNumber && ` · #${selected.memberNumber}`}{selected.phone && ` · ${selected.phone}`}
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
          <Select label="نوع الجلسة" value={sessionType} onChange={e => setSessionType(e.target.value)}>
            <option value="regular">عادية</option>
            <option value="exam">امتحان</option>
            <option value="group">مجموعة</option>
          </Select>
          <button
            onClick={handleCheckin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Check size={14}/><span>تسجيل الدخول</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── New Student panel ─── */
function NewStudentPanel({ user, config, toast, sessions, saveSessions }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [form, setForm]   = useState({ name:'', phone:'', userNumber:'', notes:'', university:'', college:'', academicYear:'' });
  const [errors, setErrors] = useState({});
  const [checkinNow, setCheckinNow] = useState(true);

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name       = 'الاسم مطلوب';
    if (!form.phone.trim()) {
      e.phone = 'رقم الهاتف مطلوب';
    } else {
      const dup = students.find(s => s.phone?.trim() === form.phone.trim());
      if (dup) e.phone = `مسجل بالفعل: ${dup.name}`;
    }
    if (!form.userNumber.trim()) {
      e.userNumber = 'رقم المستخدم مطلوب';
    } else {
      const dup = students.find(s => s.memberNumber?.trim() === form.userNumber.trim());
      if (dup) e.userNumber = `مستخدم من قبل: ${dup.name}`;
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
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
      notes:        form.notes.trim(),
      tags:         [],
      createdAt:    new Date().toISOString(),
    };
    saveStudents([...students, ns]);
    logActivity('تسجيل طالب جديد', `${ns.name} — ${ns.studentId} · #${ns.memberNumber}`, user.id);
    if (checkinNow) {
      saveSessions([...sessions, {
        id: generateId('ses'),
        studentId:    ns.id,
        studentName:  ns.name,
        studentPhone: ns.phone,
        checkInTime:  new Date().toISOString(),
        type:   'regular',
        status: 'active',
      }]);
      logActivity('تسجيل دخول', ns.name, user.id);
      toast(`تم تسجيل ${ns.name} ودخوله للمكتبة`, 'success');
    } else {
      toast(`تم تسجيل ${ns.name}`, 'success');
    }
    setForm({ name:'', phone:'', userNumber:'', notes:'', university:'', college:'', academicYear:'' });
    setErrors({});
  };

  return (
    <div className="space-y-3">
      <Input label="الاسم الكامل *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errors.name} placeholder="اسم الطالب"/>
      <div className="grid grid-cols-2 gap-3">
        <Input label="رقم الهاتف *" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} error={errors.phone} placeholder="01XXXXXXXXX"/>
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
          {errors.userNumber
            ? <p className="text-xs text-red-500 mt-1">{errors.userNumber}</p>
            : <p className="text-xs text-gray-400 mt-1">رقم مخصص وإلزامي</p>
          }
        </div>
      </div>
      <Textarea label="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="أي ملاحظات…" rows={2}/>

      {/* University / College / Year */}
      <Select label="الجامعة" value={form.university} onChange={e=>setForm({...form,university:e.target.value})}>
        <option value="">— اختر —</option>
        {(config.universities || []).map(u => <option key={u} value={u}>{u}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
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
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        <UserPlus size={14}/><span>تسجيل الطالب</span>
      </button>
    </div>
  );
}

/* ─── Main Hub ─── */
export default function CashierHub({ user, config, toast }) {
  const [sessions, saveSessions, refresh] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [invoices]           = useStorage(STORAGE_KEYS.INVOICES, []);
  const [allSubs]            = useStorage(STORAGE_KEYS.STUDENT_SUBSCRIPTIONS, []);
  const [pricing]            = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [checkoutSes, setCheckoutSes] = useState(null);
  const [tab, setTab] = useState('checkin'); // 'checkin' | 'newstudent'
  const [sessionSearch, setSessionSearch] = useState('');
  useLiveTimer(30000);

  const active     = sessions.filter(s => s.status === 'active').sort((a,b) => new Date(a.checkInTime)-new Date(b.checkInTime));
  const displayed  = sessionSearch.trim()
    ? active.filter(s => s.studentName?.toLowerCase().includes(sessionSearch.toLowerCase()) || s.studentPhone?.includes(sessionSearch))
    : active;
  const todayStr   = new Date().toISOString().slice(0,10);
  const todayRev   = invoices.filter(i => i.createdAt?.startsWith(todayStr)).reduce((s,i)=>s+(i.total||0),0);
  const capacity   = config.capacity || 50;
  const pct        = Math.round((active.length / capacity) * 100);

  return (
    <div className="h-full flex flex-col gap-4 p-5 fade-in">

      {/* ── Top stats bar ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-navy">الجلسات النشطة</h1>
          <span className="flex items-center gap-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse inline-block"/>
            {active.length} نشط
          </span>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-2 flex items-center gap-3 shadow-sm">
          <span className="text-xs text-navy-500 shrink-0">{active.length}/{capacity}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${pct>=90?'bg-red-400':pct>=70?'bg-amber-400':'bg-teal-400'}`}
              style={{width:`${Math.min(pct,100)}%`}}
            />
          </div>
          <span className="text-xs text-navy-400 shrink-0">{capacity-active.length} متاح</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-sm">
          <TrendingUp size={14} className="text-teal-500"/>
          <span className="font-semibold text-navy">{todayRev.toLocaleString('en-US')}</span>
          <span className="text-navy-400 text-xs">{config.currency}</span>
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="flex gap-4 flex-1 min-h-0">

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
          ) : (
            <div className="overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200 text-navy-500 text-xs uppercase">
                    <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                    <th className="px-4 py-3 text-right font-semibold">الدخول</th>
                    <th className="px-4 py-3 text-right font-semibold">المدة</th>
                    <th className="px-4 py-3 text-right font-semibold">التكلفة</th>
                    <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                    <th className="px-4 py-3"/>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(s => {
                    const mins = calcElapsedMinutes(s.checkInTime);
                    const { best } = calcBestPrice(mins, pricing);
                    const hrs = Math.floor(mins/60), m = mins%60;
                    const { row, dot, label, badge } = rowColor(mins);
                    const hasSub = allSubs.some(sub => sub.studentId===s.studentId && sub.status==='active');
                    return (
                      <tr key={s.id} className={`border-b border-gray-100 transition-colors ${row}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(s.studentName)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <p className="font-semibold text-navy text-sm">{s.studentName}</p>
                                {hasSub && <span className="bg-teal-100 text-teal-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">اشتراك</span>}
                              </div>
                              {s.studentPhone && <p className="text-xs text-navy-400">{s.studentPhone}</p>}
                            </div>
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
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`}/>{label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={()=>setCheckoutSes(s)}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            <LogOut size={11}/><span>خروج</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Tab panel */}
        <div className="w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
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
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'checkin'
              ? <CheckInPanel user={user} config={config} toast={toast} sessions={sessions} saveSessions={saveSessions}/>
              : <NewStudentPanel user={user} config={config} toast={toast} sessions={sessions} saveSessions={saveSessions}/>
            }
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
        onCheckedOut={()=>{ refresh(); setCheckoutSes(null); }}
      />
    </div>
  );
}
