import { useState, useMemo, useEffect } from 'react';
import { Check, X, Search } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, getActiveSubscription } from '../../utils';
import { Select } from '../../components/ui';

export default function CashierCheckIn({ user, config, toast }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null);
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
      (s.phone || '').includes(q)
    ).slice(0, 8);
  }, [students, search]);

  const handleCheckin = () => {
    if (!selected) return;
    if (activeIds.has(selected.id)) return;
    saveSessions([...sessions, {
      id: generateId('ses'),
      studentId: selected.id,
      studentName: selected.name,
      studentPhone: selected.phone || '',
      checkInTime: new Date().toISOString(),
      type: sessionType,
      status: 'active',
    }]);
    logActivity('تسجيل دخول', selected.name, user.id);
    toast(`تم تسجيل دخول ${selected.name}`, 'success');
    setSelected(null);
    setSearch('');
  };

  return (
    <div className="space-y-5 fade-in p-6">
      <h1 className="text-2xl font-bold text-navy">تسجيل الدخول</h1>
      <div className="max-w-lg">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); }}
              placeholder="بحث بالاسم أو الكود أو الهاتف…"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-9 pl-4 py-3 text-sm text-navy outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150"
              dir="rtl"
              autoFocus
            />
          </div>

          {/* Results dropdown */}
          {filtered.length > 0 && !selected && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {filtered.map(s => {
                const isActive = activeIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => !isActive && setSelected(s)}
                    disabled={isActive}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 text-right transition-colors duration-150 ${
                      isActive
                        ? 'opacity-60 cursor-not-allowed bg-gray-50'
                        : 'hover:bg-indigo-50 cursor-pointer'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-navy text-sm">{s.name}</p>
                      <p className="text-xs text-navy-400">{s.studentId}{s.phone && ` · ${s.phone}`}{s.memberNumber && ` · #${s.memberNumber}`}</p>
                    </div>
                    {isActive ? (
                      <span className="text-xs bg-teal-100 text-teal-700 font-medium px-2 py-0.5 rounded-full">داخل حالياً</span>
                    ) : (
                      <span className="text-xs text-indigo-400">اختر</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {search && filtered.length === 0 && !selected && (
            <div className="text-center py-6 text-navy-400 text-sm">لا توجد نتائج</div>
          )}

          {/* Selected student card */}
          {selected && (() => {
            return (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-navy">{selected.name}</p>
                  <p className="text-xs text-navy-400">{selected.studentId}{selected.phone && ` · ${selected.phone}`}{selected.memberNumber && ` · #${selected.memberNumber}`}</p>
                  {activeSub && (
                    <span className="inline-flex items-center mt-1.5 bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      اشتراك نشط — {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} متبقٍ
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setSelected(null); setSearch(''); }}
                  className="p-1 rounded text-navy-400 hover:text-navy cursor-pointer transition-colors"
                >
                  <X size={15}/>
                </button>
              </div>
              <Select label="نوع الجلسة" value={sessionType} onChange={e => setSessionType(e.target.value)}>
                <option value="regular">عادية</option>
                <option value="exam">امتحان</option>
                <option value="group">مجموعة</option>
              </Select>
              <button
                onClick={handleCheckin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2"
              >
                <Check size={15}/>
                <span>تسجيل الدخول</span>
              </button>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
