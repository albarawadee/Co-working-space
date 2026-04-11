import { useState, useMemo } from 'react';
import { Receipt, Check, AlertCircle } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { supabase, formatDate, formatDateTime } from '../../utils';

export default function AdminCharges({ user, config, toast }) {
  const [charges, saveCharges] = useStorage(STORAGE_KEYS.ADMIN_CHARGES, []);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'settled'
  const [settling, setSettling] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'pending') return charges.filter(c => !c.settled);
    if (filter === 'settled') return charges.filter(c => c.settled);
    return charges;
  }, [charges, filter]);

  // Group by admin for summary cards
  const byAdmin = useMemo(() => {
    const map = {};
    charges.filter(c => !c.settled).forEach(c => {
      if (!map[c.adminId]) map[c.adminId] = { name: c.adminName, total: 0 };
      map[c.adminId].total += c.amount || 0;
    });
    return Object.values(map);
  }, [charges]);

  const handleSettle = async (charge) => {
    setSettling(charge.id);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('admin_charges')
        .update({ settled: true, settled_at: now })
        .eq('id', charge.id);
      if (error) throw error;

      saveCharges(charges.map(c => c.id === charge.id ? { ...c, settled: true, settledAt: now } : c));
      toast('تمت التسوية', 'success');
    } catch (err) {
      toast(err?.message || 'حدث خطأ', 'error');
    } finally {
      setSettling(null);
    }
  };

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">مستحقات الموظفين</h1>

      {/* Summary cards */}
      {byAdmin.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {byAdmin.map((a, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Receipt size={16} className="text-orange-600"/>
                </div>
                <p className="font-semibold text-navy text-sm">{a.name}</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">{a.total.toLocaleString('en-US')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{config.currency} مستحقة</p>
            </div>
          ))}
        </div>
      )}

      {byAdmin.length === 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-center gap-3">
          <Check size={18} className="text-teal-600"/>
          <p className="text-sm text-teal-700 font-medium">لا توجد مستحقات معلقة</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all',     label: 'الكل' },
          { key: 'pending', label: 'غير مسددة' },
          { key: 'settled', label: 'مسددة' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              filter === key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Charges table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                <th className="px-4 py-3 text-right font-semibold">المبلغ</th>
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">لا توجد سجلات</td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-navy">{c.adminName}</td>
                  <td className="px-4 py-3 text-gray-600">{c.studentName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-orange-600">{(c.amount || 0).toLocaleString('en-US')} {config.currency}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDateTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {c.settled ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        <Check size={10}/>مسددة
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        <AlertCircle size={10}/>معلقة
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.settled && (
                      <button
                        onClick={() => handleSettle(c)}
                        disabled={settling === c.id}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={11}/>تسوية
                      </button>
                    )}
                    {c.settled && c.settledAt && (
                      <span className="text-xs text-gray-400">{c.settledAt.slice(0, 10)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
