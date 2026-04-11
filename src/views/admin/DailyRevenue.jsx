import { useState } from 'react';
import { ChevronRight, ChevronLeft, Download, BookOpen, Coffee, TrendingUp, DollarSign, CalendarDays } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { exportCSV } from '../../utils';

export default function AdminDailyRevenue({ config }) {
  const [invoices] = useStorage(STORAGE_KEYS.INVOICES, []);
  const [expenses] = useStorage(STORAGE_KEYS.EXPENSES, []);
  const now = new Date();
  const [monthKey, setMonthKey] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  const changeMonth = (d) => {
    const [y, m] = monthKey.split('-').map(Number);
    const dt = new Date(y, m - 1 + d, 1);
    setMonthKey(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  const [y, m] = monthKey.split('-').map(Number);
  const daysCount = new Date(y, m, 0).getDate();
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  const cur = config.currency || 'ج.م';
  const todayStr = now.toISOString().slice(0, 10);

  const dailyData = Array.from({ length: daysCount }, (_, i) => {
    const day = i + 1;
    const ds = `${monthKey}-${String(day).padStart(2, '0')}`;
    const dayInvs = invoices.filter(inv => inv.createdAt?.startsWith(ds));
    const dayExps = expenses.filter(e => e.date?.startsWith(ds));
    const studyHall = dayInvs.reduce((s, inv) => s + (inv.amount || 0), 0);
    const kitchen = dayInvs.reduce((s, inv) => s + (inv.kitchenTotal || 0), 0);
    const total = studyHall + kitchen;
    const expense = dayExps.reduce((s, e) => s + (e.amount || 0), 0);
    const cash = dayInvs.filter(i => i.paymentMethod === 'cash' || !i.paymentMethod).reduce((s, i) => s + (i.total || 0), 0);
    const transfer = dayInvs.filter(i => i.paymentMethod === 'transfer').reduce((s, i) => s + (i.total || 0), 0);
    const instapay = dayInvs.filter(i => i.paymentMethod === 'instapay').reduce((s, i) => s + (i.total || 0), 0);
    return { day, ds, studyHall, kitchen, total, expense, net: total - expense, count: dayInvs.length, cash, transfer, instapay };
  });

  const totals = dailyData.reduce(
    (acc, d) => ({
      studyHall: acc.studyHall + d.studyHall,
      kitchen: acc.kitchen + d.kitchen,
      total: acc.total + d.total,
      expense: acc.expense + d.expense,
      count: acc.count + d.count,
      cash: acc.cash + d.cash,
      transfer: acc.transfer + d.transfer,
      instapay: acc.instapay + d.instapay,
    }),
    { studyHall: 0, kitchen: 0, total: 0, expense: 0, count: 0, cash: 0, transfer: 0, instapay: 0 }
  );
  totals.net = totals.total - totals.expense;

  const handleExport = () => {
    exportCSV(`daily-revenue-${monthKey}.csv`,
      ['اليوم', 'التاريخ', 'قاعة الدراسة', 'المطبخ', 'الإجمالي', 'نقدي', 'تحويل', 'InstaPay', 'المصروفات', 'صافي الربح', 'فواتير'],
      dailyData.map(d => [d.day, d.ds, d.studyHall, d.kitchen, d.total, d.cash, d.transfer, d.instapay, d.expense, d.net, d.count])
    );
  };

  return (
    <div className="p-6 space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">الإيرادات اليومية</h1>
          <p className="text-sm text-gray-500 mt-0.5">{monthLabel}</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-indigo-600" />
            <p className="text-xs text-indigo-600 font-medium">قاعة الدراسة</p>
          </div>
          <p className="text-2xl font-bold text-indigo-800">{totals.studyHall.toLocaleString('en-US')}</p>
          <p className="text-xs text-indigo-500 mt-0.5">{cur}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Coffee size={16} className="text-amber-600" />
            <p className="text-xs text-amber-600 font-medium">المطبخ</p>
          </div>
          <p className="text-2xl font-bold text-amber-800">{totals.kitchen.toLocaleString('en-US')}</p>
          <p className="text-xs text-amber-500 mt-0.5">{cur}</p>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-teal-600" />
            <p className="text-xs text-teal-600 font-medium">إجمالي الإيرادات</p>
          </div>
          <p className="text-2xl font-bold text-teal-800">{totals.total.toLocaleString('en-US')}</p>
          <p className="text-xs text-teal-500 mt-0.5">{cur} · {totals.count} فاتورة</p>
        </div>
        <div className={`border rounded-2xl p-5 ${totals.net >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className={totals.net >= 0 ? 'text-green-600' : 'text-red-600'} />
            <p className={`text-xs font-medium ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>صافي الربح</p>
          </div>
          <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {totals.net.toLocaleString('en-US')}
          </p>
          <p className={`text-xs mt-0.5 ${totals.net >= 0 ? 'text-green-500' : 'text-red-500'}`}>{cur}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-gray-600" />
            <p className="text-xs text-gray-600 font-medium">نقدي</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{totals.cash.toLocaleString('en-US')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{cur}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-blue-600" />
            <p className="text-xs text-blue-600 font-medium">تحويل</p>
          </div>
          <p className="text-2xl font-bold text-blue-800">{totals.transfer.toLocaleString('en-US')}</p>
          <p className="text-xs text-blue-500 mt-0.5">{cur}</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-purple-600" />
            <p className="text-xs text-purple-600 font-medium">InstaPay</p>
          </div>
          <p className="text-2xl font-bold text-purple-800">{totals.instapay.toLocaleString('en-US')}</p>
          <p className="text-xs text-purple-500 mt-0.5">{cur}</p>
        </div>
      </div>

      {/* Revenue Distribution Bar */}
      {totals.total > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <p className="text-sm font-semibold text-navy mb-3">توزيع الإيرادات — {monthLabel}</p>
          <div className="flex h-6 rounded-xl overflow-hidden">
            <div
              className="bg-indigo-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{ width: `${totals.total > 0 ? (totals.studyHall / totals.total) * 100 : 0}%` }}
            >
              {totals.total > 0 && totals.studyHall > 0 && `${Math.round((totals.studyHall / totals.total) * 100)}%`}
            </div>
            <div
              className="bg-amber-400 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{ width: `${totals.total > 0 ? (totals.kitchen / totals.total) * 100 : 0}%` }}
            >
              {totals.total > 0 && totals.kitchen > 0 && `${Math.round((totals.kitchen / totals.total) * 100)}%`}
            </div>
          </div>
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
              <span className="text-xs text-gray-600">قاعة الدراسة ({totals.studyHall.toLocaleString('en-US')} {cur})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span className="text-xs text-gray-600">المطبخ ({totals.kitchen.toLocaleString('en-US')} {cur})</span>
            </div>
          </div>
        </div>
      )}

      {/* Daily Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-navy">تفاصيل كل يوم</h2>
          <p className="text-xs text-gray-400 mt-0.5">{totals.count} فاتورة في هذا الشهر</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 text-right font-semibold">اليوم</th>
                <th className="px-4 py-3 text-right font-semibold">التوزيع</th>
                <th className="px-4 py-3 text-right font-semibold">قاعة الدراسة</th>
                <th className="px-4 py-3 text-right font-semibold">المطبخ</th>
                <th className="px-4 py-3 text-right font-semibold">الإجمالي</th>
                <th className="px-4 py-3 text-right font-semibold">نقدي</th>
                <th className="px-4 py-3 text-right font-semibold">تحويل</th>
                <th className="px-4 py-3 text-right font-semibold">InstaPay</th>
                <th className="px-4 py-3 text-right font-semibold">المصروفات</th>
                <th className="px-4 py-3 text-right font-semibold">صافي الربح</th>
                <th className="px-4 py-3 text-right font-semibold">فواتير</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map(d => {
                const isToday = d.ds === todayStr;
                return (
                  <tr
                    key={d.day}
                    className={`border-b border-gray-100 transition-colors duration-150 ${
                      isToday ? 'bg-indigo-50/60' : d.total === 0 ? 'opacity-40 hover:opacity-70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isToday && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>}
                        <div>
                          <p className="font-semibold text-navy">{d.day}</p>
                          <p className="text-xs text-gray-400">{d.ds}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {d.total > 0 ? (
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-indigo-400"
                            style={{ width: `${(d.studyHall / d.total) * 100}%` }}
                          />
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${(d.kitchen / d.total) * 100}%` }}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-200 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.studyHall > 0 ? 'text-indigo-700 font-medium' : 'text-gray-300'}>
                        {d.studyHall > 0 ? `${d.studyHall.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.kitchen > 0 ? 'text-amber-700 font-medium' : 'text-gray-300'}>
                        {d.kitchen > 0 ? `${d.kitchen.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.total > 0 ? 'font-bold text-teal-700' : 'text-gray-300'}>
                        {d.total > 0 ? `${d.total.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.cash > 0 ? 'text-gray-700 font-medium' : 'text-gray-300'}>
                        {d.cash > 0 ? `${d.cash.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.transfer > 0 ? 'text-blue-700 font-medium' : 'text-gray-300'}>
                        {d.transfer > 0 ? `${d.transfer.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.instapay > 0 ? 'text-purple-700 font-medium' : 'text-gray-300'}>
                        {d.instapay > 0 ? `${d.instapay.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={d.expense > 0 ? 'text-red-600 font-medium' : 'text-gray-300'}>
                        {d.expense > 0 ? `${d.expense.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          d.net > 0 ? 'text-green-700' : d.net < 0 ? 'text-red-600' : 'text-gray-300'
                        }`}
                      >
                        {d.total > 0 || d.expense > 0 ? `${d.net.toLocaleString('en-US')} ${cur}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.count > 0 ? (
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg font-medium">
                          {d.count}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300 text-sm font-bold">
                <td className="px-4 py-3 text-navy" colSpan={2}>الإجمالي الشهري</td>
                <td className="px-4 py-3 text-indigo-700">{totals.studyHall.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-amber-700">{totals.kitchen.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-teal-700">{totals.total.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-gray-700">{totals.cash.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-blue-700">{totals.transfer.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-purple-700">{totals.instapay.toLocaleString('en-US')} {cur}</td>
                <td className="px-4 py-3 text-red-600">{totals.expense.toLocaleString('en-US')} {cur}</td>
                <td className={`px-4 py-3 ${totals.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {totals.net.toLocaleString('en-US')} {cur}
                </td>
                <td className="px-4 py-3 text-gray-600">{totals.count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totals.total === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
          <CalendarDays size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد إيرادات لهذا الشهر</p>
        </div>
      )}
    </div>
  );
}
