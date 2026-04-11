import { useState, useMemo } from 'react';
import { UserPlus, Search, Check, Users } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity, formatDate } from '../../utils';

export default function CashierStudents({ user, config, toast, setActiveView }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [search, setSearch] = useState('');

  const activeIds = new Set(sessions.filter(s => s.status === 'active').map(s => s.studentId));
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const checkedInToday = new Set(
    sessions.filter(s => s.checkInTime?.startsWith(todayStr)).map(s => s.studentId)
  ).size;
  const newThisWeek = students.filter(s => s.createdAt >= weekAgo).length;

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
  }, [students, search]);

  const handleCheckIn = (student) => {
    saveSessions([...sessions, {
      id: generateId('ses'),
      studentId: student.id,
      studentName: student.name,
      studentPhone: student.phone || '',
      checkInTime: new Date().toISOString(),
      type: 'regular',
      status: 'active',
    }]);
    logActivity('تسجيل دخول', student.name, user.id);
    toast(`تم تسجيل دخول ${student.name}`, 'success');
  };

  return (
    <div className="space-y-5 fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">الطلاب</h1>
        <button
          onClick={() => setActiveView?.('cashier_new_student')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer"
        >
          <UserPlus size={15}/>
          <span>طالب جديد</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الطلاب', value: students.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'داخل اليوم', value: checkedInToday, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'جدد هذا الأسبوع', value: newThisWeek, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-xl px-4 py-3 border border-gray-100`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-navy-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو الكود…"
          className="w-full bg-white border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm text-navy outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-150"
          dir="rtl"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center text-navy-400">
            <Users size={36} className="mx-auto mb-3 text-gray-200"/>
            <p className="text-sm">{search ? 'لا توجد نتائج' : 'لا يوجد طلاب مسجلون'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-navy-500 text-xs uppercase">
                <th className="px-4 py-3 text-right font-semibold">الكود</th>
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">الهاتف</th>
                <th className="px-4 py-3 text-right font-semibold">الوسوم</th>
                <th className="px-4 py-3 text-right font-semibold">التسجيل</th>
                <th className="px-4 py-3 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isActive = activeIds.has(s.id);
                return (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-mono text-xs text-navy-400">{s.studentId}</td>
                    <td className="px-4 py-3 font-semibold text-navy">{s.name}</td>
                    <td className="px-4 py-3 text-navy-500 font-mono text-xs">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.tags || []).slice(0, 2).map(t => (
                          <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-400">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 font-medium px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"/>
                          داخل حالياً
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(s)}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer"
                        >
                          <Check size={12}/>
                          <span>تسجيل دخول</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
