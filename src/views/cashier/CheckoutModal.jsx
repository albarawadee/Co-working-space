import { useState, useEffect } from 'react';
import { Check, Wallet, CreditCard, Loader, ChevronDown, ChevronUp, Plus, Minus, X, UserCheck, Zap, AlertTriangle } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { useSubmitLock } from '../../hooks/useSubmitLock';
import { trackedWrites } from '../../hooks/useInFlightTracker';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { supabase, generateId, formatTime, formatDate, calcElapsedMinutes, calcBestPrice, calcBillableHours, logActivity, getActiveSubscription, resolveSubscriptionBilling, localDateStr, matchOfferCriteria, computeRecipeStockChanges, isActiveOrder, settleStudentDebts } from '../../utils';
import { toSnake } from '../../lib/fieldMaps';
import { mtkDisable } from '../../lib/mikrotikApi';
import { Modal } from '../../components/ui';

export default function CheckoutModal({ open, onClose, session, config, user, toast, onCheckedOut, onStudentClick }) {
  const [pricing]  = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [orders]   = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [owners]   = useStorage(STORAGE_KEYS.OWNERS, []);
  const [products] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [recipes]  = useStorage(STORAGE_KEYS.PRODUCT_RECIPES, []);
  const [staff]    = useStorage(STORAGE_KEYS.STAFF, []);
  const [shifts]   = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [debts]    = useStorage(STORAGE_KEYS.DEBTS, []);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [kitchenPayMethod, setKitchenPayMethod] = useState('cash');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [activeSub, setActiveSub] = useState(null);
  const [useSubscription, setUseSubscription] = useState(true);
  const [useWallet, setUseWallet] = useState(false);
  const { run: runCheckout, isLocked: isProcessing } = useSubmitLock();
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [amountReceived, setAmountReceived] = useState('');
  const [addChangeToWallet, setAddChangeToWallet] = useState(true);
  const [allowDebt, setAllowDebt] = useState(true);
  const [dayOverflowBilling, setDayOverflowBilling] = useState('hourly'); // 'hourly' or 'extra_day'
  const [frozenMinutes, setFrozenMinutes] = useState(0);
  const [debtAcknowledged, setDebtAcknowledged] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');

  const activeShift = shifts.find(s => s.cashierId === user.id && s.status === 'active');

  // Fetch active subscription when modal opens
  useEffect(() => {
    if (!open || !session) return;
    setActiveSub(null);
    setUseSubscription(true);
    setUseWallet(true);
    setAddedItems([]);
    setAddProductId('');
    setAddQty(1);
    setSelectedAdminId('');
    setKitchenPayMethod('cash');
    setAmountReceived('');
    setAddChangeToWallet(true);
    setAllowDebt(true);
    setDayOverflowBilling('hourly');
    setDebtAcknowledged(false);
    setSettleAmount('');
    setFrozenMinutes(calcElapsedMinutes(session.checkInTime));
    getActiveSubscription(session.studentId).then(sub => setActiveSub(sub));
  }, [open, session?.studentId]);

  if (!open || !session) return null;

  const minutes = frozenMinutes;
  const { best } = calcBestPrice(minutes, pricing);
  const sessionOrders = orders.filter(o => o.sessionId === session.id && isActiveOrder(o));
  const kitchenTotal  = sessionOrders.reduce((s, o) => s + (o.total || 0), 0);
  const hrs = Math.floor(minutes / 60), mins = minutes % 60;

  const hasActiveSub  = !!activeSub;
  const useSubBilling = hasActiveSub && useSubscription;
  
  // -- Day Package calculations
  const isDaySub = activeSub?.quotaType === 'days';
  const isOver12h = isDaySub && minutes > 720;
  const extraMinutes = Math.max(0, minutes - 720);
  
  let subDeductionAmount = 1;
  let subSessionCost = 0;
  
  if (useSubBilling) {
    if (isOver12h) {
      if (dayOverflowBilling === 'extra_day' && activeSub.remainingQuota >= 2) {
        subDeductionAmount = 2; // deduct 2 days altogether
        subSessionCost = 0;
      } else {
        // Fallback to hourly for the extra time
        const { best: extraBest } = calcBestPrice(extraMinutes, pricing);
        subSessionCost = extraBest.amount;
      }
    }
  }

  // Session offer matching — find best matching session offer for the student
  const sessionStudent  = students.find(s => s.id === session.studentId);
  const sessionOffer = (() => {
    if (useSubBilling) return null; // subscription billing takes precedence
    if (best.amount === 0) return null; // free session — no offer override
    const offers = (pricing?.specialOffers || []).filter(o =>
      o.active && o.sessionPricePerHour > 0 &&
      (o.appliesTo === 'session' || o.appliesTo === 'both') &&
      matchOfferCriteria(o, sessionStudent)
    );
    if (offers.length === 0) return null;
    return offers.reduce((min, o) => o.sessionPricePerHour < min.sessionPricePerHour ? o : min, offers[0]);
  })();

  const sessionCost = useSubBilling
    ? subSessionCost
    : sessionOffer
      ? calcBillableHours(minutes, Number(pricing?.graceMinutes ?? 10)) * sessionOffer.sessionPricePerHour
      : best.amount;

  const addedTotal      = addedItems.reduce((s, i) => s + i.subtotal, 0);
  const subtotalBeforeDiscount = sessionCost + kitchenTotal + addedTotal;

  const walletBalance   = sessionStudent ? (sessionStudent.walletBalance || 0) : 0;

  // Discounts completely removed from standard CheckoutModal!
  const discountAmount = 0;
  const baseTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);

  // Admin split: session on staff tab, kitchen must be paid
  const adminKitchenAmount = kitchenTotal + addedTotal;
  const isAdminSplit = paymentMethod === 'admin' && adminKitchenAmount > 0;
  const adminSessionAmount = sessionCost;

  // When admin split, only the kitchen portion needs collection
  const effectiveCollectible = isAdminSplit ? adminKitchenAmount : baseTotal;

  // Split payment logic: Use wallet first
  const walletToApply = (useWallet && walletBalance > 0) ? Math.min(effectiveCollectible, walletBalance) : 0;
  const grandTotal = effectiveCollectible - walletToApply;

  const linkedOwners    = owners.filter(o => (o.studentIds || []).includes(session.studentId));
  const selectedOwner   = linkedOwners.find(o => o.id === selectedOwnerId) || null;
  const allStaff        = staff.filter(s => s.active !== false);
  const selectedAdmin   = allStaff.find(s => s.id === selectedAdminId) || null;
  const availableProducts = products.filter(p => p.available !== false && !p.ingredientOnly);
  const needsPayment    = grandTotal > 0;
  const todayStr        = localDateStr();

  // Existing debt calculation (before this session's charges)
  const existingWalletDebt = walletBalance < 0 ? Math.abs(walletBalance) : 0;
  const studentDebtRecords = debts.filter(d => d.personId === session.studentId && d.personType === 'student');
  const totalBorrowed = studentDebtRecords.filter(d => d.type === 'borrow').reduce((s, d) => s + (d.amount || 0), 0);
  const totalRepaid   = studentDebtRecords.filter(d => d.type === 'repay').reduce((s, d) => s + (d.amount || 0), 0);
  const existingInstallmentDebt = Math.max(0, totalBorrowed - totalRepaid);
  const totalExistingDebt = existingWalletDebt + existingInstallmentDebt;
  const hasExistingDebt = totalExistingDebt > 0;
  const settleNum = parseFloat(settleAmount) || 0;
  // Wallet balance after settlement (for display in underpayment sections)
  const walletSettleAmount = (settleNum > 0 && existingWalletDebt > 0) ? Math.min(settleNum, existingWalletDebt) : 0;
  const walletAfterSettle = walletBalance + walletSettleAmount + Math.max(0, settleNum - totalExistingDebt);

  const activePayMethod = isAdminSplit ? kitchenPayMethod : paymentMethod;
  const showAmountReceived = needsPayment && ['cash', 'transfer', 'instapay'].includes(activePayMethod);
  const receivedNum = parseFloat(amountReceived) || 0;
  const change = showAmountReceived ? Math.max(0, receivedNum - grandTotal) : 0;

  const handleAddItem = () => {
    if (!addProductId) return;
    const prod = availableProducts.find(p => p.id === addProductId);
    if (!prod) return;
    const qty = Math.max(1, addQty);
    setAddedItems(prev => {
      const existing = prev.find(i => i.productId === addProductId);
      if (existing) {
        return prev.map(i => i.productId === addProductId
          ? { ...i, qty: i.qty + qty, subtotal: (i.qty + qty) * i.unitPrice }
          : i);
      }
      return [...prev, { productId: prod.id, name: prod.name, qty, unitPrice: prod.price, subtotal: prod.price * qty }];
    });
    setAddProductId('');
    setAddQty(1);
  };

  const handleRemoveAdded = (productId) => {
    setAddedItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleCheckout = () => runCheckout(async () => {
    // Validate debt acknowledgment
    if (hasExistingDebt && !debtAcknowledged) {
      if (settleNum <= 0) {
        toast('يجب الإقرار بالمديونية أو تسويتها قبل الخروج', 'error'); return;
      }
      if (settleNum > 0 && settleNum < totalExistingDebt) {
        toast('المبلغ أقل من المديونية — وافق على تخطي الباقي أولاً', 'error'); return;
      }
    }

    // Validate payment
    if (needsPayment) {
      if (paymentMethod === 'admin') {
        if (!selectedAdmin) { toast('اختر الموظف المسؤول', 'error'); return; }
        // For admin split, validate the kitchen payment method
        if (isAdminSplit) {
          if (kitchenPayMethod === 'wallet') {
            if (walletBalance < grandTotal && !allowDebt) { toast('رصيد المحفظة غير كافٍ — فعّل خيار تسجيل الدين أولاً', 'error'); return; }
          }
          if (showAmountReceived && receivedNum < grandTotal && !allowDebt) {
            toast('المبلغ المدفوع أقل من الإجمالي — فعّل خيار تسجيل الدين أولاً', 'error'); return;
          }
        }
      } else if (paymentMethod === 'owner') {
        if (!selectedOwner) { toast('اختر صاحب الحساب', 'error'); return; }
        if ((selectedOwner.balance || 0) < grandTotal) { toast('رصيد الحساب غير كافٍ', 'error'); return; }
      } else if (paymentMethod === 'wallet') {
        if (walletBalance < grandTotal && !allowDebt) { toast('رصيد المحفظة غير كافٍ — فعّل خيار تسجيل الدين أولاً', 'error'); return; }
      } else {
        if (showAmountReceived && receivedNum < grandTotal && !allowDebt) {
          toast('المبلغ المدفوع أقل من الإجمالي — فعّل خيار تسجيل الدين أولاً', 'error'); return;
        }
      }
    }

    const now = new Date().toISOString();
    const invoiceId = generateId('inv');

    try {
      // Refetch fresh server state for the two stale-prone inputs (wallet + debts).
      // The useStorage closures captured these at modal-open time — Realtime usually
      // keeps them current, but a concurrent topup/charge from another tab can drift
      // the values between modal-open and submit.
      const { data: freshStudent, error: sErr } = await supabase
        .from('students')
        .select('id, wallet_balance, name')
        .eq('id', session.studentId)
        .maybeSingle();
      if (sErr || !freshStudent) throw sErr || new Error('Student not found');
      const freshWalletBalance = Number(freshStudent.wallet_balance) || 0;

      const { data: freshDebtsRows, error: dErr } = await supabase
        .from('debts')
        .select('id, person_id, person_type, type, source, amount, created_at, in_custody')
        .eq('person_id', session.studentId)
        .eq('person_type', 'student');
      if (dErr) throw dErr;
      const freshDebts = (freshDebtsRows || []).map(d => ({
        id: d.id, personId: d.person_id, personType: d.person_type,
        type: d.type, source: d.source, amount: d.amount,
        createdAt: d.created_at, inCustody: d.in_custody,
      }));
      const freshNetDebt = freshDebts.reduce((sum, d) =>
        d.type === 'borrow' ? sum + (d.amount || 0) : sum - (d.amount || 0), 0);
      const freshInstallmentDebt = Math.max(0, freshNetDebt);

      // Divergence guard — if what the cashier saw on screen no longer matches
      // the server, abort and force a re-read. Avoid silently proceeding with
      // stale figures that the cashier never approved.
      if (Math.abs(freshWalletBalance - walletBalance) > 0.5
          || Math.abs(freshInstallmentDebt - existingInstallmentDebt) > 0.5) {
        toast('تغيّر رصيد الطالب/مديونيته — أعد فحص الشاشة قبل التأكيد', 'error');
        return;
      }

      const writes = [];

      // Track running wallet balance — all wallet ops update this, written ONCE at the end
      let runningWallet = freshWalletBalance;

      // 1. Wallet Deduction (If used for split)
      if (walletToApply > 0) {
        const before = runningWallet;
        runningWallet -= walletToApply;
        writes.push(
          supabase.from('wallet_transactions').upsert(toSnake({
            id: generateId('wtx'),
            studentId: session.studentId,
            studentName: session.studentName,
            type: 'deduct',
            amount: walletToApply,
            balanceBefore: before,
            balanceAfter: runningWallet,
            note: 'خصم جزئي من المحفظة للجلسة',
            invoiceId,
            staffId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
      }

      // 2. Subscription billing (only when cashier chose to use it)
      if (useSubBilling) {
        const { updatedSub } = resolveSubscriptionBilling(activeSub, minutes, todayStr, subDeductionAmount);
        writes.push(
          supabase.from('student_subscriptions').upsert(toSnake({
            ...updatedSub,
            id: activeSub.id,
          }), { onConflict: 'id' })
        );
      }

      // 2. Owner balance deduction
      if (needsPayment && paymentMethod === 'owner' && selectedOwner) {
        writes.push(
          supabase.from('owners').update({
            balance: (selectedOwner.balance || 0) - grandTotal,
          }).eq('id', selectedOwner.id)
        );
      }

      // 3. Wallet deduction + wallet transaction (full wallet payment method)
      if (needsPayment && activePayMethod === 'wallet') {
        const before = runningWallet;
        runningWallet -= grandTotal;
        writes.push(
          supabase.from('wallet_transactions').upsert(toSnake({
            id: generateId('wtx'),
            studentId: session.studentId,
            studentName: session.studentName,
            type: 'deduct',
            amount: grandTotal,
            balanceBefore: before,
            balanceAfter: runningWallet,
            note: 'خصم جلسة',
            invoiceId,
            staffId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
      }

      // 3b. Change → wallet topup
      if (addChangeToWallet && change > 0) {
        const before = runningWallet;
        runningWallet += change;
        const topupInvId = generateId('inv');
        writes.push(
          supabase.from('wallet_transactions').upsert(toSnake({
            id: generateId('wtx'),
            studentId: session.studentId,
            studentName: session.studentName,
            type: 'topup',
            amount: change,
            balanceBefore: before,
            balanceAfter: runningWallet,
            note: 'باقي جلسة',
            invoiceId: topupInvId,
            staffId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
        // Create second invoice for the topup cash to ensure drawer balance is correct
        writes.push(
          supabase.from('invoices').upsert(toSnake({
            id: topupInvId,
            shiftId: activeShift ? activeShift.id : null,
            studentId: session.studentId,
            studentName: session.studentName,
            billingType: 'topup',
            priceType: 'topup',
            pricingLabel: 'باقي جلسة (محفظة)',
            amount: change,
            kitchenTotal: 0,
            total: change,
            paymentMethod: activePayMethod === 'owner' ? 'cash' : activePayMethod,
            cashierId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
      }

      // 3c. Debt — underpayment recorded as rows in the `debts` table.
      // Wallet invariant: never goes below 0. Split underpayment between session
      // and kitchen so each carries its own detailed note.
      const debtAmount = (showAmountReceived && allowDebt && receivedNum < grandTotal)
        ? grandTotal - receivedNum
        : 0;

      if (debtAmount > 0) {
        // Proportional split: session vs kitchen+addedItems (using effectiveCollectible as base)
        const kitchenComponent = (kitchenTotal + addedTotal) - (isAdminSplit ? 0 : 0);
        const sessionComponent = isAdminSplit ? 0 : sessionCost;
        const totalCollectibleComponents = sessionComponent + kitchenComponent;

        let sessionShare = 0;
        let kitchenShare = 0;
        if (totalCollectibleComponents > 0) {
          // Apply received amount to session first (or proportionally)
          // Use proportional split to keep notes accurate to what's actually unpaid.
          sessionShare = Math.round((debtAmount * sessionComponent / totalCollectibleComponents) * 100) / 100;
          kitchenShare = Math.round((debtAmount - sessionShare) * 100) / 100;
        } else {
          // Fallback — all goes to session bucket
          sessionShare = debtAmount;
        }

        if (sessionShare > 0) {
          const sessionDate = formatDate(session.checkInTime);
          const sessionTime = formatTime(session.checkInTime);
          writes.push(
            supabase.from('debts').upsert(toSnake({
              id: generateId('debt'),
              personId: session.studentId,
              personName: session.studentName,
              personType: 'student',
              type: 'borrow',
              source: 'session',
              amount: sessionShare,
              note: `دين جلسة — ${sessionDate} - ${sessionTime}`,
              invoiceId,
              cashierId: user.id === 'admin' ? null : user.id,
              cashierName: user.name || '',
              createdAt: now,
            }), { onConflict: 'id' })
          );
        }

        if (kitchenShare > 0) {
          const itemsInOrder = sessionOrders.flatMap(o => o.items || []);
          const addedAsLine = addedItems.map(i => ({ productName: i.name, qty: i.qty }));
          const allItems = [...itemsInOrder, ...addedAsLine];
          const itemList = allItems
            .map(i => `${i.productName || i.product_name}×${i.qty}`)
            .join('، ');
          writes.push(
            supabase.from('debts').upsert(toSnake({
              id: generateId('debt'),
              personId: session.studentId,
              personName: session.studentName,
              personType: 'student',
              type: 'borrow',
              source: 'kitchen',
              amount: kitchenShare,
              note: itemList ? `دين مطبخ — ${itemList}` : 'دين مطبخ',
              invoiceId,
              cashierId: user.id === 'admin' ? null : user.id,
              cashierName: user.name || '',
              createdAt: now,
            }), { onConflict: 'id' })
          );
        }
      }

      // Debt settlement at checkout — delegated to shared helper.
      // Helper applies cash against outstanding debts (oldest first) and routes
      // any remainder to the wallet via a topup transaction. We capture its
      // walletAfter into runningWallet so the consolidated student update below
      // persists the right balance.
      //
      // Drawer accounting: `repay` rows already count toward calcDrawerExpected
      // `repayments`, so we write an invoice ONLY for the wallet-overpayment
      // portion to avoid double-counting cash income. debtPaid + walletAdded
      // always equals settleNum, matching the cash actually received.
      if (settleNum > 0 && hasExistingDebt) {
        const { writes: settleWrites, walletAfter, walletAdded } = settleStudentDebts({
          studentId: session.studentId,
          studentName: session.studentName,
          cashIn: settleNum,
          debts: freshDebts,
          walletBalance: runningWallet,
          cashierId: user.id === 'admin' ? null : user.id,
          cashierName: user.name || '',
          invoiceId: null,
          now,
        });
        writes.push(...settleWrites);
        runningWallet = walletAfter;

        if (walletAdded > 0) {
          writes.push(
            supabase.from('invoices').upsert(toSnake({
              id: generateId('inv'),
              shiftId: activeShift?.id || null,
              studentId: session.studentId,
              studentName: session.studentName,
              billingType: 'topup',
              priceType: 'topup',
              pricingLabel: 'فائض تسوية مديونية — أضيف للمحفظة',
              amount: walletAdded,
              kitchenTotal: 0,
              total: walletAdded,
              paymentMethod: 'cash',
              cashierId: user.id === 'admin' ? null : user.id,
              createdAt: now,
            }), { onConflict: 'id' })
          );
        }
      }

      // Single consolidated wallet balance write (avoids race conditions from multiple concurrent writes)
      if (runningWallet !== freshWalletBalance) {
        writes.push(
          supabase.from('students').update({
            wallet_balance: runningWallet,
          }).eq('id', session.studentId)
        );
      }

      // 4b. Added items kitchen order
      if (addedItems.length > 0) {
        const addedCostTotal = addedItems.reduce((sum, i) => {
          const p = availableProducts.find(x => x.id === i.productId);
          const cost = p?.recipeCost || ((p?.costPrice || 0) / (p?.subUnitRatio || 1));
          return sum + cost * i.qty;
        }, 0);
        writes.push(
          supabase.from('kitchen_orders').upsert(toSnake({
            id: generateId('ORD'),
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
            items: addedItems.map(i => ({
              productId: i.productId,
              productName: i.name,
              qty: i.qty,
              unitPrice: i.unitPrice,
              total: i.subtotal,
            })),
            total: addedTotal,
            costTotal: addedCostTotal,
            orderType: 'cowork',
            note: 'أضيف عند الخروج',
            status: 'completed',
            createdAt: now,
            staffId: user.id,
          }), { onConflict: 'id' })
        );

        // Decrement stock for added items
        const cartItems = addedItems.map(i => ({
          product: products.find(p => p.id === i.productId) || { id: i.productId, trackStock: false },
          qty: i.qty,
        })).filter(i => i.product);
        const { stockUpdates } = computeRecipeStockChanges(cartItems, recipes, products, -1);
        for (const upd of stockUpdates) {
          writes.push(supabase.from('products').update({ stock_qty: upd.newStockQty }).eq('id', upd.productId));
          writes.push(supabase.from('stock_movements').upsert(toSnake({
            id: generateId('stk'),
            productId: upd.productId,
            productName: upd.productName,
            type: 'order',
            delta: upd.delta,
            stockAfter: upd.newStockQty,
            note: `أضيف عند الخروج - ${session.studentName}`,
            staffId: user.id,
            createdAt: now,
          })));
        }
      }

      // 4a + 4. Admin split: two invoices (session on staff, kitchen collected)
      if (isAdminSplit && selectedAdmin) {
        // Admin charge — session cost only (not kitchen)
        if (adminSessionAmount > 0) {
          writes.push(
            supabase.from('admin_charges').upsert({
              id: generateId('chg'),
              admin_id: selectedAdmin.id,
              admin_name: selectedAdmin.name,
              invoice_id: invoiceId,
              session_id: session.id,
              student_name: session.studentName,
              amount: adminSessionAmount,
              source: 'session',
              note: '',
              settled: false,
              created_at: now,
            }, { onConflict: 'id' })
          );
        }

        // Invoice A: admin-session (excluded from revenue by existing filters)
        writes.push(
          supabase.from('invoices').upsert(toSnake({
            id: invoiceId,
            shiftId: activeShift ? activeShift.id : null,
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
            minutes,
            priceType: useSubBilling ? 'subscription' : best.type,
            pricingLabel: `${useSubBilling ? `اشتراك: ${activeSub.planName}${isOver12h ? ' + إضافي' : ''}` : best.label} (على موظف)`,
            amount: sessionCost,
            kitchenTotal: 0,
            discountId: null,
            discountLabel: null,
            discountAmount: 0,
            total: sessionCost,
            billingType: useSubBilling ? 'subscription' : 'normal',
            subscriptionId: useSubBilling ? activeSub.id : null,
            paymentMethod: adminSessionAmount > 0 ? 'admin' : null,
            ownerId: null,
            cashierId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );

        // Invoice B: kitchen-collected (real revenue)
        const kitchenInvoiceId = generateId('inv');
        writes.push(
          supabase.from('invoices').upsert(toSnake({
            id: kitchenInvoiceId,
            shiftId: activeShift ? activeShift.id : null,
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
            minutes: 0,
            priceType: 'kitchen',
            pricingLabel: 'طلبات مطبخ (مدفوع)',
            amount: 0,
            kitchenTotal: adminKitchenAmount,
            discountId: null,
            discountLabel: null,
            discountAmount: 0,
            total: grandTotal - debtAmount,
            billingType: 'normal',
            subscriptionId: null,
            paymentMethod: grandTotal > 0 ? kitchenPayMethod : null,
            ownerId: null,
            cashierId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
      } else {
        // Standard single-invoice path (non-split)

        // Admin charge (full grandTotal when no kitchen)
        if (needsPayment && paymentMethod === 'admin' && selectedAdmin) {
          writes.push(
            supabase.from('admin_charges').upsert({
              id: generateId('chg'),
              admin_id: selectedAdmin.id,
              admin_name: selectedAdmin.name,
              invoice_id: invoiceId,
              session_id: session.id,
              student_name: session.studentName,
              amount: grandTotal,
              source: 'session',
              note: '',
              settled: false,
              created_at: now,
            }, { onConflict: 'id' })
          );
        }

        const effectivePaymentMethod = !needsPayment ? null : paymentMethod;

        writes.push(
          supabase.from('invoices').upsert(toSnake({
            id: invoiceId,
            shiftId: activeShift ? activeShift.id : null,
            sessionId: session.id,
            studentId: session.studentId,
            studentName: session.studentName,
            minutes,
            priceType: useSubBilling ? 'subscription' : best.type,
            pricingLabel: `${useSubBilling ? `اشتراك: ${activeSub.planName}${isOver12h ? ' + إضافي' : ''}` : best.label}${debtAmount > 0 ? ' (دفع جزئي)' : ''}`,
            amount: sessionCost,
            kitchenTotal,
            discountId: null,
            discountLabel: null,
            discountAmount: 0,
            total: grandTotal - debtAmount,
            billingType: useSubBilling ? 'subscription' : 'normal',
            subscriptionId: useSubBilling ? activeSub.id : null,
            paymentMethod: effectivePaymentMethod,
            ownerId: effectivePaymentMethod === 'owner' ? selectedOwnerId : null,
            cashierId: user.id === 'admin' ? null : user.id,
            createdAt: now,
          }), { onConflict: 'id' })
        );
      }

      // Mark session kitchen orders as paid — kept INSIDE the main writes batch
      // so a partial failure doesn't leave the cashier with a closed session but
      // unpaid kitchen orders (which would let a second checkout double-charge).
      const sessionOrderIds = (orders || [])
        .filter(o => o.sessionId === session.id && isActiveOrder(o))
        .map(o => o.id);
      if (sessionOrderIds.length > 0) {
        writes.push(
          supabase.from('kitchen_orders')
            .update({ paid: true, status: 'delivered', updated_at: now })
            .in('id', sessionOrderIds)
        );
      }

      // 5. Close session
      writes.push(
        supabase.from('sessions').update({
          status: 'closed',
          check_out_time: now,
          checked_out_by: user.id,
        }).eq('id', session.id)
      );

      const results = await trackedWrites(writes);
      const firstErr = results.find(r => r.error);
      if (firstErr?.error) throw firstErr.error;

      const checkoutStudent = students.find(s => s.id === session.studentId);
      if (checkoutStudent?.studentId) mtkDisable(config, checkoutStudent).catch(() => {});

      // Fire-and-forget log
      if (isAdminSplit) {
        logActivity('تسجيل خروج', `${session.studentName} — جلسة على ${selectedAdmin.name}: ${adminSessionAmount} ${config.currency} + مطبخ: ${grandTotal} ${config.currency}`, user.id);
        toast(`تم تسجيل الخروج • جلسة على ${selectedAdmin.name} (${adminSessionAmount} ${config.currency}) + مطبخ محصّل (${grandTotal} ${config.currency})`, 'success');
      } else {
        logActivity('تسجيل خروج', `${session.studentName} — ${grandTotal} ${config.currency}`, user.id);
        toast(`تم تسجيل الخروج • ${grandTotal} ${config.currency}`, 'success');
      }
      onCheckedOut();
      onClose();
    } catch (err) {
      console.error('Checkout error:', err);
      toast(err?.message || 'حدث خطأ أثناء تسجيل الخروج', 'error');
    }
  });

  return (
    <Modal open={open} onClose={onClose} title="تسجيل الخروج والدفع"
      footer={<div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">إلغاء</button>
        <button onClick={handleCheckout} disabled={isProcessing} className="bg-teal hover:bg-teal-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70">
          {isProcessing ? <Loader size={15} className="animate-spin"/> : <Check size={15}/>}
          <span>{isProcessing ? 'جاري المعالجة…' : 'تأكيد الخروج'}</span>
        </button>
      </div>}>
      <div className="space-y-4">
        {/* Session header */}
        <div className="bg-navy rounded-xl p-4 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div><button onClick={() => onStudentClick?.(session.studentId)} className="font-bold text-lg text-white hover:underline cursor-pointer text-right">{session.studentName}</button><p className="text-white/70 text-sm">دخل: {formatTime(session.checkInTime)}</p></div>
            <div className="text-left"><p className="text-2xl font-bold">{hrs}h {mins}m</p><p className="text-white/60 text-xs">مدة الجلسة</p></div>
          </div>
        </div>

        {/* Existing debt alert */}
        {hasExistingDebt && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">تنبيه: على هذا الطالب مديونية سابقة</p>
                <div className="mt-2 space-y-1">
                  {existingWalletDebt > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-700">رصيد محفظة سالب (دين جلسة)</span>
                      <span className="font-bold text-red-800">{existingWalletDebt.toLocaleString('en-US')} {config.currency}</span>
                    </div>
                  )}
                  {existingInstallmentDebt > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-700">دين أقساط اشتراك</span>
                      <span className="font-bold text-red-800">{existingInstallmentDebt.toLocaleString('en-US')} {config.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm pt-1 border-t border-red-200">
                    <span className="font-bold text-red-900">إجمالي المديونية</span>
                    <span className="font-bold text-red-900">{totalExistingDebt.toLocaleString('en-US')} {config.currency}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Settlement input */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-red-800">تسوية المديونية (اختياري):</p>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={settleAmount}
                  onChange={e => { setSettleAmount(e.target.value); setDebtAcknowledged(false); }}
                  placeholder={`أدخل مبلغ التسوية (حتى ${totalExistingDebt.toLocaleString('en-US')})…`}
                  max={totalExistingDebt}
                  className="w-full border border-red-200 rounded-xl px-4 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-300 pl-24"
                  dir="ltr"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{config.currency}</span>
              </div>
              {settleNum > totalExistingDebt && (
                <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                  سيتم تسوية المديونية بالكامل ({totalExistingDebt.toLocaleString('en-US')} {config.currency}) وإضافة {(settleNum - totalExistingDebt).toLocaleString('en-US')} {config.currency} للمحفظة
                </p>
              )}
            </div>

            {/* Acknowledge checkbox (required if not fully settling) */}
            {settleNum < totalExistingDebt && (
              <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-red-200">
                <input
                  type="checkbox"
                  checked={debtAcknowledged}
                  onChange={e => setDebtAcknowledged(e.target.checked)}
                  className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                />
                <span className="text-sm text-red-800 font-medium">
                  {settleNum > 0
                    ? `تخطي الباقي (${(totalExistingDebt - settleNum).toLocaleString('en-US')} ${config.currency}) والخروج`
                    : 'تخطي التسوية والخروج بالدين'}
                </span>
              </label>
            )}
          </div>
        )}

        {/* Subscription toggle */}
        {hasActiveSub && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">اشتراك نشط — {activeSub.planName}</p>
            <p className="text-xs text-gray-500">
              متبقٍ: {activeSub.remainingQuota} {activeSub.quotaType === 'hours' ? 'ساعة' : 'يوم'} · ينتهي: {activeSub.expiryDate}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setUseSubscription(true)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${useSubscription ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Zap size={14}/>استخدام الاشتراك
              </button>
              <button
                onClick={() => setUseSubscription(false)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${!useSubscription ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>محاسبة عادية
              </button>
            </div>
          </div>
        )}

        {/* Day overflow billing section */}
        {useSubBilling && isOver12h && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-red-800">تنبيه: الجلسة تجاوزت باقة اليوم (12 ساعة)</p>
              <p className="text-xs text-red-600 mt-1">
                الوقت الزائد: {(extraMinutes/60).toFixed(1)} ساعة. اختر كيفية الدفع للوقت التابع:
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setDayOverflowBilling('hourly')}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${dayOverflowBilling === 'hourly' ? 'border-red-500 bg-white text-red-700 shadow-sm' : 'border-red-200 bg-red-100/50 text-red-600 hover:bg-white'}`}
              >
                حساب الأجر الساعي
              </button>
              <button
                disabled={activeSub.remainingQuota < 2}
                onClick={() => setDayOverflowBilling('extra_day')}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${activeSub.remainingQuota < 2 ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500' : dayOverflowBilling === 'extra_day' ? 'border-red-500 bg-white text-red-700 shadow-sm' : 'border-red-200 bg-red-100/50 text-red-600 hover:bg-white'}`}
              >
                خصم يوم إضافي
              </button>
            </div>
          </div>
        )}

        {/* Auto-calculated pricing — show when not using subscription or if paying additional hours */}
        {(!useSubBilling || (useSubBilling && isOver12h && dayOverflowBilling === 'hourly')) && (
          <div className={`${sessionOffer ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'} border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-navy">{!useSubBilling ? (sessionOffer ? `${sessionOffer.sessionPricePerHour} ${config.currency}/ساعة` : best.label) : 'حساب الوقت الزائد'}</p>
                {sessionOffer && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{sessionOffer.label}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{!useSubBilling ? (best.billableHours || Math.ceil(minutes / 60)) : Math.ceil(extraMinutes / 60)} ساعة محسوبة</p>
              {sessionOffer && (
                <p className="text-[10px] text-gray-400 mt-0.5 line-through">السعر العادي: {best.amount.toLocaleString('en-US')} {config.currency}</p>
              )}
            </div>
            <span className={`text-lg font-bold ${sessionOffer ? 'text-green-700' : 'text-indigo-700'}`}>{sessionCost.toLocaleString('en-US')} {config.currency}</span>
          </div>
        )}

        {/* Kitchen orders — expandable detail */}
        {kitchenTotal > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowOrderDetail(v => !v)}
              className="w-full flex justify-between items-center p-3 cursor-pointer text-right"
            >
              <div><p className="text-sm font-semibold text-amber-900">طلبات المطبخ</p><p className="text-xs text-amber-700">{sessionOrders.length} طلب</p></div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900">{kitchenTotal.toLocaleString('en-US')} {config.currency}</span>
                {showOrderDetail ? <ChevronUp size={14} className="text-amber-700"/> : <ChevronDown size={14} className="text-amber-700"/>}
              </div>
            </button>
            {showOrderDetail && (
              <div className="border-t border-amber-200 px-3 pb-3 space-y-2 pt-2">
                {sessionOrders.map(order => (
                  <div key={order.id}>
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-amber-800 py-0.5">
                        <span>{item.productName} × {item.qty}</span>
                        <span className="font-medium">{item.total.toLocaleString('en-US')} {config.currency}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add items at checkout */}
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-sm font-semibold text-navy">إضافة منتجات عند الخروج</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={addProductId}
              onChange={e => setAddProductId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
              dir="rtl"
            >
              <option value="">اختر منتجاً…</option>
              {availableProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.price} {config.currency}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setAddQty(q => Math.max(1, q - 1))} className="px-2 py-2 hover:bg-gray-100 cursor-pointer transition-colors"><Minus size={12}/></button>
                <span className="px-2 text-sm font-medium min-w-[2rem] text-center">{addQty}</span>
                <button onClick={() => setAddQty(q => q + 1)} className="px-2 py-2 hover:bg-gray-100 cursor-pointer transition-colors"><Plus size={12}/></button>
              </div>
              <button onClick={handleAddItem} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors"><Plus size={14}/></button>
            </div>
          </div>
          {addedItems.length > 0 && (
            <div className="space-y-1">
              {addedItems.map(item => (
                <div key={item.productId} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-gray-700">{item.name} × {item.qty}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy">{item.subtotal.toLocaleString('en-US')} {config.currency}</span>
                    <button onClick={() => handleRemoveAdded(item.productId)} className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors"><X size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discounts removed from Check-Out. Moved to WalletSubs. */}

        {/* Grand total & Wallet Deduction */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          {walletBalance > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${useWallet ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  <Wallet size={16}/>
                </div>
                <div>
                  <p className="text-xs font-bold text-navy">محفظة الطالب ({walletBalance.toLocaleString('en-US')} {config.currency})</p>
                  <p className="text-[10px] text-gray-400">استخدام الرصيد المتاح للخصم من الإجمالي</p>
                </div>
              </div>
              <button
                onClick={() => setUseWallet(!useWallet)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${useWallet ? 'bg-teal text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                {useWallet ? 'تم التفعيل ✓' : 'تفعيل الخصم'}
              </button>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>قبل الخصم</span>
              <span className="line-through">{subtotalBeforeDiscount.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}
          
          {walletToApply > 0 && (
            <div className="flex justify-between items-center text-xs text-teal-600 font-bold">
              <span>خصم من المحفظة</span>
              <span>-{walletToApply.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}

          {isAdminSplit && (
            <div className="flex justify-between items-center text-xs text-orange-600">
              <span>إجمالي الجلسة (على الموظف)</span>
              <span className="font-medium">{adminSessionAmount.toLocaleString('en-US')} {config.currency}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 pt-1">
            <span className="font-bold text-navy">{isAdminSplit ? 'المطلوب تحصيله (مطبخ)' : 'الإجمالي المطلوب'}</span>
            <span className="text-2xl font-bold text-teal">{grandTotal.toLocaleString('en-US')} {config.currency}</span>
          </div>
        </div>

        {/* Payment method */}
        {needsPayment && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">طريقة دفع المتبقي:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${paymentMethod === 'cash' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                نقدي
              </button>
              <button
                onClick={() => setPaymentMethod('transfer')}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paymentMethod === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>تحويل
              </button>
              <button
                onClick={() => setPaymentMethod('instapay')}
                className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paymentMethod === 'instapay' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <CreditCard size={14}/>InstaPay
              </button>
              {linkedOwners.length > 0 && (
                <button
                  onClick={() => { setPaymentMethod('owner'); if (!selectedOwnerId && linkedOwners.length === 1) setSelectedOwnerId(linkedOwners[0].id); }}
                  className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${paymentMethod === 'owner' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <Wallet size={14}/>حساب
                </button>
              )}
              {allStaff.length > 0 && (
                <button
                  onClick={() => { setPaymentMethod('admin'); if (!selectedAdminId && allStaff.length === 1) setSelectedAdminId(allStaff[0].id); }}
                  className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-2 ${paymentMethod === 'admin' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                >
                  <UserCheck size={14}/>على موظف
                </button>
              )}
            </div>

            {/* Wallet info */}
            {paymentMethod === 'wallet' && (
              <div className={`rounded-xl p-3 border text-sm ${walletAfterSettle >= grandTotal ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <p className="font-semibold text-navy">محفظة الطالب</p>
                    <p className={`text-xs mt-0.5 ${walletAfterSettle >= grandTotal ? 'text-teal-600' : 'text-red-600'}`}>
                      الرصيد: {walletAfterSettle.toLocaleString('en-US')} {config.currency}
                      {walletAfterSettle < grandTotal && ` · ينقص ${(grandTotal - walletAfterSettle).toLocaleString('en-US')} ${config.currency}`}
                    </p>
                  </div>
                  {walletAfterSettle >= grandTotal ? (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium shrink-0">رصيد كافٍ</span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium shrink-0">رصيد غير كافٍ</span>
                  )}
                </div>
                {walletAfterSettle < grandTotal && (
                  <label className="flex items-center gap-3 cursor-pointer mt-3 pt-3 border-t border-red-200">
                    <input
                      type="checkbox"
                      checked={allowDebt}
                      onChange={e => setAllowDebt(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-sm text-red-800 font-medium">تسجيل {(grandTotal - walletAfterSettle).toLocaleString('en-US')} {config.currency} كدين (رصيد سالب)</span>
                      <p className="text-xs text-red-600 mt-0.5">
                        الرصيد: {walletAfterSettle.toLocaleString('en-US')} → {(walletAfterSettle - grandTotal).toLocaleString('en-US')} {config.currency}
                      </p>
                    </div>
                  </label>
                )}
              </div>
            )}

            {/* Admin selection */}
            {paymentMethod === 'admin' && allStaff.length > 0 && (
              <div className="space-y-2">
                {allStaff.length > 1 && (
                  <select
                    value={selectedAdminId}
                    onChange={e => setSelectedAdminId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-300"
                    dir="rtl"
                  >
                    <option value="">اختر الموظف…</option>
                    {allStaff.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
                {selectedAdmin && !isAdminSplit && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <p className="font-semibold text-navy">{selectedAdmin.name}</p>
                      <p className="text-xs text-orange-600 mt-0.5">سيُسجَّل المبلغ دَيناً على الموظف</p>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium shrink-0">على موظف</span>
                  </div>
                )}

                {/* Admin split summary + kitchen payment */}
                {selectedAdmin && isAdminSplit && (
                  <div className="space-y-3">
                    {/* Split summary */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-orange-800 font-medium">بند الجلسة — على {selectedAdmin.name}</span>
                        <span className="font-bold text-orange-700">{adminSessionAmount.toLocaleString('en-US')} {config.currency}</span>
                      </div>
                      {adminSessionAmount === 0 && (
                        <p className="text-xs text-orange-600">الجلسة مجانية (ضمن الوقت المجاني)</p>
                      )}
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-red-800 font-medium">بند المطبخ — مطلوب الدفع</span>
                        <span className="font-bold text-red-700">{adminKitchenAmount.toLocaleString('en-US')} {config.currency}</span>
                      </div>
                    </div>

                    {/* Kitchen payment method selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-navy">طريقة دفع المطبخ:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          onClick={() => setKitchenPayMethod('cash')}
                          className={`py-2 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer ${kitchenPayMethod === 'cash' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          نقدي
                        </button>
                        <button
                          onClick={() => setKitchenPayMethod('transfer')}
                          className={`py-2 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${kitchenPayMethod === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          <CreditCard size={13}/>تحويل
                        </button>
                        <button
                          onClick={() => setKitchenPayMethod('instapay')}
                          className={`py-2 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${kitchenPayMethod === 'instapay' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          <CreditCard size={13}/>InstaPay
                        </button>
                        <button
                          onClick={() => setKitchenPayMethod('wallet')}
                          className={`py-2 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1 ${kitchenPayMethod === 'wallet' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                        >
                          <Wallet size={13}/>محفظة
                        </button>
                      </div>
                    </div>

                    {/* Wallet info for kitchen split */}
                    {kitchenPayMethod === 'wallet' && (
                      <div className={`rounded-xl p-3 border text-sm ${walletAfterSettle >= grandTotal ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <p className="font-semibold text-navy">محفظة الطالب</p>
                            <p className={`text-xs mt-0.5 ${walletAfterSettle >= grandTotal ? 'text-teal-600' : 'text-red-600'}`}>
                              الرصيد: {walletAfterSettle.toLocaleString('en-US')} {config.currency}
                              {walletAfterSettle < grandTotal && ` · ينقص ${(grandTotal - walletAfterSettle).toLocaleString('en-US')} ${config.currency}`}
                            </p>
                          </div>
                          {walletAfterSettle >= grandTotal ? (
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium shrink-0">رصيد كافٍ</span>
                          ) : (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium shrink-0">رصيد غير كافٍ</span>
                          )}
                        </div>
                        {walletAfterSettle < grandTotal && (
                          <label className="flex items-center gap-3 cursor-pointer mt-3 pt-3 border-t border-red-200">
                            <input type="checkbox" checked={allowDebt} onChange={e => setAllowDebt(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0" />
                            <div>
                              <span className="text-sm text-red-800 font-medium">تسجيل {(grandTotal - walletAfterSettle).toLocaleString('en-US')} {config.currency} كدين</span>
                              <p className="text-xs text-red-600 mt-0.5">الرصيد: {walletAfterSettle.toLocaleString('en-US')} → {(walletAfterSettle - grandTotal).toLocaleString('en-US')} {config.currency}</p>
                            </div>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Owner account selection */}
            {paymentMethod === 'owner' && linkedOwners.length > 0 && (
              <div className="space-y-2">
                {linkedOwners.length > 1 && (
                  <select
                    value={selectedOwnerId}
                    onChange={e => setSelectedOwnerId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                    dir="rtl"
                  >
                    <option value="">اختر الحساب…</option>
                    {linkedOwners.map(o => (
                      <option key={o.id} value={o.id}>{o.name} — {(o.balance || 0).toLocaleString('en-US')} {config.currency}</option>
                    ))}
                  </select>
                )}
                {selectedOwner && (
                  <div className={`rounded-xl p-3 border text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${(selectedOwner.balance || 0) >= grandTotal ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}`}>
                    <div>
                      <p className="font-semibold text-navy">{selectedOwner.name}</p>
                      <p className={`text-xs mt-0.5 ${(selectedOwner.balance || 0) >= grandTotal ? 'text-teal-600' : 'text-red-600'}`}>
                        رصيد الحساب: {(selectedOwner.balance || 0).toLocaleString('en-US')} {config.currency}
                      </p>
                    </div>
                    {(selectedOwner.balance || 0) >= grandTotal ? (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium shrink-0">رصيد كافٍ</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium shrink-0">رصيد غير كافٍ</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Remaining money / change to wallet */}
        {showAmountReceived && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-navy">المبلغ المستلم:</p>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                value={amountReceived}
                onChange={e => { setAmountReceived(e.target.value); }}
                placeholder="أدخل المبلغ المستلم…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-300 pl-24"
                dir="ltr"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{config.currency}</span>
            </div>
            {receivedNum > 0 && (
              <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 px-1 gap-1">
                <span>المطلوب: {grandTotal.toLocaleString('en-US')} {config.currency}</span>
                {receivedNum >= grandTotal
                  ? <span className="text-emerald-600 font-medium">الباقي: {change.toLocaleString('en-US')} {config.currency}</span>
                  : <span className="text-red-500 font-medium">ينقص: {(grandTotal - receivedNum).toLocaleString('en-US')} {config.currency}</span>
                }
              </div>
            )}
            {/* Debt: underpayment warning + confirmation */}
            {showAmountReceived && receivedNum < grandTotal && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDebt}
                    onChange={e => setAllowDebt(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-sm text-red-800 font-medium">تسجيل {(grandTotal - receivedNum).toLocaleString('en-US')} {config.currency} كدين على الطالب</span>
                    <p className="text-xs text-red-600 mt-0.5">
                      رصيد المحفظة: {walletAfterSettle.toLocaleString('en-US')} → {(walletAfterSettle - (grandTotal - receivedNum)).toLocaleString('en-US')} {config.currency}
                    </p>
                  </div>
                </label>
              </div>
            )}
            {change > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addChangeToWallet}
                    onChange={e => setAddChangeToWallet(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-sm text-emerald-800 font-medium">إضافة {change.toLocaleString('en-US')} {config.currency} للمحفظة</span>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      الرصيد: {walletAfterSettle.toLocaleString('en-US')} → {(walletAfterSettle + change).toLocaleString('en-US')} {config.currency}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
