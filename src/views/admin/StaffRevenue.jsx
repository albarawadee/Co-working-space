import { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Download, Users as UsersIcon, TrendingUp, FileText } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { exportCSV, formatDate, formatTime } from '../../utils';

export default function AdminStaffRevenue({ config }) {
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [staff] = useStorage(STORAGE_KEYS.STAFF, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedStaffId, setSelectedStaffId] = useState('all');

  const cur = config.currency || 'ج.م';

  const changeMonth = (d) => {
    const [y, m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  const [y, m] = monthKey.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

  // Filter invoices by selected month
  const monthInvoices = useMemo(
    () => invoices.filter(inv => inv.createdAt?.startsWith(monthKey)),
    [invoices, monthKey]
  );

  // Per-cashier breakdown
  const cashierBreakdown = useMemo(() => {
    const map = new Map();
    monthInvoices.forEach(inv => {
      const id = inv.cashierId || 'unknown';
      if (!map.has(id)) {
        const member = staff.find(s => s.id === id);
        map.set(id, {
          id,
          name: member?.name || (id === 'unknown' ? 'غير محدد' : id),
          role: member?.role || '',
          total: 0,
          count: 0,
          cash: 0,
          transfer: 0,
          instapay: 0,
        });
      }
      const row = map.get(id);
      row.total += inv.total || 0;
      row.count += 1;
      const pm = inv.paymentMethod || 'cash';
      if (pm === 'cash') row.cash += inv.total || 0;
      else if (pm === 'transfer') row.transfer += inv.total || 0;
      else if (pm === 'instapay') row.instapay += inv.total || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [monthInvoices, staff]);

  // Detailed invoices for selected staff (or all)
  const detailedInvoices = useMemo(() => {
    const filtered = selectedStaffId === 'all'
      ? monthInvoices
      : monthInvoices.filter(inv => (inv.cashierId || 'unknown') === selectedStaffId);
    return [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [monthInvoices, selectedStaffId]);

  const grandTotal = cashierBreakdown.reduce((s, c) => s + c.total, 0);
  const grandCount = cashierBreakdown.reduce((s, c) => s + c.count, 0);

  const handleExport = () => {
    const targetName = selectedStaffId === 'all'
      ? 'all'
      : (staff.find(s => s.id === selectedStaffId)?.name || selectedStaffId);
    exportCSV(
      `staff-revenue-${targetName}-${monthKey}.csv`,
      ['التاريخ', 'الوقت', 'الموظف', 'الطالب', 'الإجمالي', 'الجلسة', 'المطبخ', 'طريقة الدفع'],
      detailedInvoices.map(inv => {
        const member = staff.find(s => s.id === inv.cashierId);
        return [
          formatDate(inv.createdAt),
          formatTime(inv.createdAt),
          member?.name || inv.cashierId || 'غير محدد',
          inv.studentName || '',
          inv.total || 0,
          inv.amount || 0,
          inv.kitchenTotal || 0,
          inv.paymentMethod || 'cash',
        ];
      })
    );
  };

  const paymentLabel = (pm) => {
    if (!pm || pm === 'cash') return 'نقدي';
    if (pm === 'transfer') return 'تحويل';
    if (pm === 'instapay') return 'InstaPay';
    if (pm === 'wallet')   return 'محفظة';
    if (pm === 'owner')    return 'حساب';
    if (pm === 'admin')    return 'مدير';
    return pm;
  };

  const paymentClass = (pm) => {
    if (!pm || pm === 'cash') return 'bg-gray-100 text-gray-700';
    if (pm === 'transfer')    return 'bg-blue-100 text-blue-700';
    if (pm === 'instapay')    return 'bg-purple-100 text-purple-700';
    if (pm === 'wallet')      return 'bg-teal-100 text-teal-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">تحصيل الموظفين</h1>
          <p className="text-sm text-gray-500 mt-0.5">تفاصيل ما حصّله كل موظف خلال {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Download size={14} />تصدير CSV
          </button>
          <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-200">
            <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-navy transition-colors cursor-pointer">
              <ChevronRight size={15} />
            </button>
            <span className="font-semibold text-navy px-2 min-w-[130px] text-center text-sm">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-navy transition-colors cursor-pointer">
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-teal-600" />
            <p className="text-xs text-teal-600 font-medium">إجمالي التحصيل</p>
          </div>
          <p className="text-2xl font-bold text-teal-800">{grandTotal.toLocaleString('en-US')}</p>
          <p className="text-xs text-teal-500 mt-0.5">{cur}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-indigo-600" />
            <p className="text-xs text-indigo-600 font-medium">عدد الفواتير</p>
          </div>
          <p className="text-2xl font-bold text-indigo-800">{grandCount}</p>
          <p className="text-xs text-indigo-500 mt-0.5">فاتورة</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon size={16} className="text-amber-600" />
            <p className="text-xs text-amber-600 font-medium">عدد الموظفين</p>
          </div>
          <p className="text-2xl font-bold text-amber-800">{cashierBreakdown.length}</p>
          <p className="text-xs text-amber-500 mt-0.5">موظف</p>
        </div>
      </div>

      {/* Per-Cashier Cards */}
      {cashierBreakdown.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cashierBreakdown.map(c => {
            const isSelected = selectedStaffId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedStaffId(isSelected ? 'all' : c.id)}
                className={`text-right rounded-2xl p-5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-300 shadow-md'
                    : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-navy">{c.name}</p>
                    {c.role && <p className="text-xs text-gray-400 mt-0.5">{c.role}</p>}
                  </div>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg font-medium">
                    {c.count}
                  </span>
                </div>
                <p className="text-2xl font-bold text-teal-700 mb-3">
                  {c.total.toLocaleString('en-US')} <span className="text-sm font-normal text-gray-400">{cur}</span>
                </p>
                <div className="flex items-center gap-3 text-xs">
                  {c.cash > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      <span className="text-gray-600">{c.cash.toLocaleString('en-US')}</span>
                    </div>
                  )}
                  {c.transfer > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="text-blue-600">{c.transfer.toLocaleString('en-US')}</span>
                    </div>
                  )}
                  {c.instapay > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span className="text-purple-600">{c.instapay.toLocaleString('en-US')}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter chip */}
      {selectedStaffId !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">عرض فواتير:</span>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-medium">
            {staff.find(s => s.id === selectedStaffId)?.name || selectedStaffId}
          </span>
          <button
            onClick={() => setSelectedStaffId('all')}
            className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            عرض الكل
          </button>
        </div>
      )}

      {/* Detailed invoices table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-navy">تفاصيل الفواتير</h2>
          <p className="text-xs text-gray-400 mt-0.5">{detailedInvoices.length} فاتورة</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                <th className="px-4 py-3 text-right font-semibold">الموظف</th>
                <th className="px-4 py-3 text-right font-semibold">الطالب</th>
                <th className="px-4 py-3 text-right font-semibold">الجلسة</th>
                <th className="px-4 py-3 text-right font-semibold">المطبخ</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right font-semibold">طريقة الدفع</th>
              </tr>
            </thead>
            <tbody>
              {detailedInvoices.map(inv => {
                const member = staff.find(s => s.id === inv.cashierId);
                return (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <p className="text-navy font-medium">{formatDate(inv.createdAt)}</p>
                      <p className="text-xs text-gray-400">{formatTime(inv.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3 text-navy">{member?.name || inv.cashierId || 'غير محدد'}</td>
                    <td className="px-4 py-3 text-gray-700">{inv.studentName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.amount > 0 ? `${(inv.amount || 0).toLocaleString('en-US')} ${cur}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.kitchenTotal > 0 ? `${(inv.kitchenTotal || 0).toLocaleString('en-US')} ${cur}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-teal-700">{(inv.total || 0).toLocaleString('en-US')} {cur}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${paymentClass(inv.paymentMethod)}`}>
                        {paymentLabel(inv.paymentMethod)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {detailedInvoices.length === 0 && (
            <div className="p-10 text-center">
              <FileText size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد فواتير</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
