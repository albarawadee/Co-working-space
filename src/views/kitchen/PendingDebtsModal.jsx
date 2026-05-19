import { useState, useMemo } from 'react';
import { Clock, Banknote, AlertTriangle, Check } from 'lucide-react';
import { Modal, ConfirmDialog } from '../../components/ui';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { formatDate, formatTime, generateId, logActivity, supabase, isActiveOrder } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';

/**
 * Modal listing every person who currently owes the kitchen money — both
 * unpaid kitchen orders (no debt row) and open kitchen debt rows (staff on credit).
 * Settling a person collects cash into kitchen custody (NOT drawer); hand-over
 * to cashier moves it into the drawer.
 *
 * Props:
 *  - open, onClose
 *  - user, toast, config
 *  - orders          (KITCHEN_ORDERS rows)
 *  - debts           (DEBTS rows)
 *  - saveOrders      (useStorage save fn)
 *  - onSettled()     callback after a successful settlement
 */
export default function PendingDebtsModal({
  open, onClose,
  user, toast, config,
  orders = [], debts = [],
  saveOrders, onSettled,
}) {
  const cur = config?.currency || 'ج.م';
  const [expandedKey, setExpandedKey] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const { run: runSettle, isLocked: submitting } = useSubmitLock();

  // Group debtors. Key = `${personType}:${personId}` for known persons, or
  // `walkin:${order.id}` for anonymous walk-in unpaid orders.
  const debtors = useMemo(() => {
    const map = new Map();

    // Unpaid kitchen orders → either grouped under their staff/student debtor,
    // or as standalone walk-in entries.
    (orders || []).forEach(o => {
      if (!isActiveOrder(o)) return;
      if (o.paid) return;
      if (o.sessionId) return; // student session debts are handled at checkout
      const total = o.total || 0;
      if (total <= 0) return;

      let key, personId, personName, personType;
      if (o.orderType === 'staff' && o.debtId) {
        // Staff debt order — the debt row is the source of truth, skip here.
        return;
      } else if (o.studentId) {
        key = `student:${o.studentId}`;
        personId = o.studentId;
        personName = o.studentName || '—';
        personType = 'student';
      } else {
        // Walk-in / guest unpaid order
        key = `walkin:${o.id}`;
        personId = null;
        personName = o.studentName || 'تيك أواي';
        personType = 'walkin';
      }

      if (!map.has(key)) {
        map.set(key, { key, personId, personName, personType, total: 0, lines: [] });
      }
      const entry = map.get(key);
      entry.total += total;
      entry.lines.push({
        kind: 'order',
        orderId: o.id,
        when: o.createdAt,
        amount: total,
        items: (o.items || []).map(i => `${i.productName}×${i.qty}`).join('، '),
        note: o.note || '',
      });
    });

    // Open kitchen debt rows (FIFO: borrow amount minus matched repays)
    const kitchenDebts = (debts || []).filter(d => d.source === 'kitchen');
    const byPerson = new Map();
    kitchenDebts.forEach(d => {
      const pid = d.personId;
      if (!pid) return;
      if (!byPerson.has(pid)) byPerson.set(pid, { borrows: [], repays: [], personName: d.personName, personType: d.personType });
      const bucket = byPerson.get(pid);
      if (d.type === 'borrow') bucket.borrows.push(d);
      else if (d.type === 'repay') bucket.repays.push(d);
    });

    byPerson.forEach(({ borrows, repays, personName, personType }, pid) => {
      const sortedBorrows = borrows.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map(b => ({ ...b, remaining: b.amount || 0 }));
      let pool = repays.reduce((s, r) => s + (r.amount || 0), 0);
      for (const b of sortedBorrows) {
        if (pool <= 0) break;
        const take = Math.min(pool, b.remaining);
        b.remaining -= take;
        pool -= take;
      }
      const openBorrows = sortedBorrows.filter(b => b.remaining > 0);
      if (openBorrows.length === 0) return;

      const key = `${personType}:${pid}`;
      if (!map.has(key)) {
        map.set(key, { key, personId: pid, personName, personType, total: 0, lines: [] });
      }
      const entry = map.get(key);
      openBorrows.forEach(b => {
        entry.total += b.remaining;
        entry.lines.push({
          kind: 'debt',
          debtId: b.id,
          orderId: null,
          when: b.createdAt,
          amount: b.remaining,
          items: b.note || '',
          note: '',
        });
      });
    });

    // Sort lines by when (oldest first) within each entry
    const list = [...map.values()];
    list.forEach(e => e.lines.sort((a, b) => new Date(a.when) - new Date(b.when)));
    // Sort entries by total descending so biggest debtor surfaces first
    list.sort((a, b) => b.total - a.total);
    return list;
  }, [orders, debts]);

  const grandTotal = debtors.reduce((s, e) => s + e.total, 0);

  const settle = (entry) => runSettle(async () => {
    if (!entry) return;
    try {
      const now = new Date().toISOString();
      const writes = [];
      const orderIdsToUpdate = [];

      for (const line of entry.lines) {
        if (line.kind === 'order') {
          // Walk-in / student unpaid order: create invoice with inCustody:true,
          // then mark order paid w/ kitchen custody.
          const invoiceId = generateId('inv');
          writes.push(
            supabase.from('invoices').upsert(toSnake({
              id: invoiceId,
              sessionId: null,
              studentId: entry.personType === 'student' ? entry.personId : null,
              studentName: entry.personName,
              amount: 0,
              kitchenTotal: line.amount,
              total: line.amount,
              paymentMethod: 'cash',
              createdAt: now,
              cashierId: user?.id,
              cashierName: user?.name,
              shiftId: null,
              inCustody: true,
            }), { onConflict: 'id' })
          );
          orderIdsToUpdate.push({ id: line.orderId, invoiceId });
        } else if (line.kind === 'debt') {
          // Kitchen debt row: insert repay with inCustody:true (held by kitchen until handover)
          writes.push(
            supabase.from('debts').upsert(toSnake({
              id: generateId('debt'),
              personId: entry.personId,
              personName: entry.personName,
              personType: entry.personType,
              type: 'repay',
              amount: line.amount,
              source: 'kitchen',
              note: `سداد دين مطبخ — ${line.items || ''}`.trim(),
              cashierId: user?.id,
              cashierName: user?.name,
              inCustody: true,
              createdAt: now,
            }), { onConflict: 'id' })
          );
          // If this debt is tied to a kitchen order (staff debt path), mark order paid
          const linkedOrder = (orders || []).find(o => o.debtId === line.debtId);
          if (linkedOrder && !linkedOrder.paid) {
            orderIdsToUpdate.push({ id: linkedOrder.id, invoiceId: null });
          }
        }
      }

      const results = await Promise.all(writes);
      const failed = results.find(r => r && r.error);
      if (failed) {
        toast('خطأ في حفظ السداد: ' + (failed.error.message || ''), 'error');
        return;
      }

      // Update local order rows: mark paid, set custody fields
      if (orderIdsToUpdate.length > 0) {
        const updateMap = new Map(orderIdsToUpdate.map(u => [u.id, u]));
        await saveOrders(prev => (prev || []).map(o => {
          const upd = updateMap.get(o.id);
          if (!upd) return o;
          return {
            ...o,
            paid: true,
            paymentMethod: 'cash',
            invoiceId: upd.invoiceId || o.invoiceId || null,
            paidBy: user?.id,
            custodyHolderId: user?.id,
            updatedAt: now,
          };
        }));
      }

      logActivity('kitchen_settle', `سداد ديون مطبخ — ${entry.personName} (${entry.total} ${cur})`, user?.id);
      toast(`تم سداد ${entry.total} ${cur} من ${entry.personName} وأُضيفت لعهدتك`, 'success');
      setConfirmTarget(null);
      setExpandedKey(null);
      if (onSettled) onSettled();
    } catch (err) {
      toast(err?.message || 'حدث خطأ', 'error');
    }
  });

  return (
    <>
      <Modal open={open} onClose={onClose} title="الديون المعلقة على المطبخ" size="lg">
        <div className="space-y-4">
          {/* Summary banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-red-600 font-semibold">إجمالي الديون المعلقة</p>
                <p className="text-2xl font-bold text-red-700">{grandTotal.toLocaleString('en-US')} {cur}</p>
              </div>
            </div>
            <p className="text-xs text-red-500">{debtors.length} مديون</p>
          </div>

          {debtors.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
              <Check size={36} className="mx-auto text-teal-300 mb-3" />
              <p className="text-sm text-gray-500">لا توجد ديون معلقة على المطبخ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {debtors.map(entry => {
                const expanded = expandedKey === entry.key;
                return (
                  <div key={entry.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedKey(expanded ? null : entry.key)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer text-right"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {entry.personName?.[0] || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy truncate">{entry.personName}</p>
                          <p className="text-[11px] text-gray-400">
                            {entry.personType === 'staff' ? 'موظف' : entry.personType === 'student' ? 'طالب' : 'تيك أواي'} • {entry.lines.length} عملية
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-lg font-bold text-red-700">{entry.total.toLocaleString('en-US')} {cur}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmTarget(entry); }}
                          className="px-3 py-1.5 min-h-[36px] rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Banknote size={13} /> سداد
                        </button>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-gray-100 bg-gray-50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 uppercase">
                              <th className="px-4 py-2 text-right font-semibold">التاريخ</th>
                              <th className="px-4 py-2 text-right font-semibold">الوقت</th>
                              <th className="px-4 py-2 text-right font-semibold">التفاصيل</th>
                              <th className="px-4 py-2 text-right font-semibold">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.lines.map((l, idx) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="px-4 py-2 text-gray-600">{formatDate(l.when)}</td>
                                <td className="px-4 py-2 text-gray-500"><Clock size={11} className="inline ml-1" />{formatTime(l.when)}</td>
                                <td className="px-4 py-2 text-gray-700 leading-relaxed">{l.items || '—'}</td>
                                <td className="px-4 py-2 font-bold text-red-700">{l.amount.toLocaleString('en-US')} {cur}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700 leading-relaxed">
            بعد السداد يدخل المبلغ في عهدتك النقدية كمطبخ، ثم تسلّمه للكاشير لاحقاً ضمن التسليم العادي.
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => !submitting && setConfirmTarget(null)}
        onConfirm={() => settle(confirmTarget)}
        title="تأكيد السداد"
        message={confirmTarget ? `سيتم تحصيل ${confirmTarget.total} ${cur} من "${confirmTarget.personName}" وإضافتها لعهدة المطبخ.` : ''}
      />
    </>
  );
}
