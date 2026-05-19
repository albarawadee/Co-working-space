import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Menu, BookOpen, Bell, X } from 'lucide-react';
import { useToast } from './hooks/useToast';
import { useStorage } from './hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_VIEWS, MENU, ROLE_VIEWS } from './constants';
import { ToastContainer } from './components/ui';
import { Sidebar } from './layout/Sidebar';
import { LoginScreen } from './layout/LoginScreen';
import StudentProfileModal from './components/StudentProfileModal';
import { supabase } from './lib/supabaseClient';
import { generateId, calcDrawerExpected } from './utils';
import { useIdleTimeout } from './hooks/useIdleTimeout';

async function fetchStaffByAuthId(authId) {
  const { data } = await supabase
    .from('staff')
    .select('id, name, username, display_name, role, active, created_at')
    .eq('auth_id', authId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    active: data.active,
    createdAt: data.created_at,
  };
}

// Admin Views
import AdminDashboard from './views/admin/Dashboard';
import AdminStudents from './views/admin/Students';
import AdminStaff from './views/admin/Staff';
import AdminPricing from './views/admin/Pricing';
import AdminProducts from './views/admin/Products';
import AdminExpenses from './views/admin/Expenses';
import AdminCenterExpenses from './views/admin/CenterExpenses';
import AdminReports from './views/admin/Reports';
import AdminSettings from './views/admin/Settings';
import AdminDailyRevenue from './views/admin/DailyRevenue';
import AdminStaffRevenue from './views/admin/StaffRevenue';
import AdminDeposits from './views/admin/Deposits';
import AdminSubscriptions from './views/admin/Subscriptions';
import AdminNetworkDashboard from './views/admin/NetworkDashboard';
import AdminNetworkV2Console from './views/admin/network-v2/Console';
import AdminWalletSubs from './views/admin/WalletSubs';
import AdminCharges from './views/admin/AdminCharges';
import AdminInventory from './views/admin/Inventory';
import AdminShifts from './views/admin/Shifts';
import AdminAttendanceLog from './views/admin/AttendanceLog';
import AdminCollections from './views/admin/Collections';
import AdminDebts from './views/admin/Debts';
import AdminWallets from './views/admin/Wallets';
import AdminPayroll from './views/admin/Payroll';
import AdminFinancialLedger from './views/admin/FinancialLedger';
import AdminKitchenCapital from './views/admin/KitchenCapital';
import AdminSalesLedger from './views/admin/SalesLedger';
import AdminFreeSites from './views/admin/FreeSites';

// Cashier Views
import CashierHub from './views/cashier/Hub';
import CashierCurrent from './views/cashier/Current';
import CashierCheckIn from './views/cashier/CheckIn';
import CashierStudents from './views/cashier/Students';
import CashierNewStudent from './views/cashier/NewStudent';
import CashierLog from './views/cashier/Log';
import CashierInternetGate from './views/cashier/InternetGate';
import CashierNetworkV2Ops from './views/cashier/network-v2/Ops';
import CashierWalletSubs from './views/cashier/WalletSubs';
import CashierDebts from './views/cashier/Debts';
import CashierWallets from './views/cashier/Wallets';
import CashierGuestOrders from './views/cashier/GuestOrders';

// Kitchen Views
import { KitchenNewOrder } from './views/kitchen/NewOrder';
import { KitchenActiveOrders } from './views/kitchen/ActiveOrders';
import { KitchenLog } from './views/kitchen/Log';
import { KitchenCustody } from './views/kitchen/Custody';
import { KitchenProducts } from './views/kitchen/Products';

const VIEW_MAP = {
  // Cashier Hub (combined)
  cashier_hub: CashierHub,
  // Admin
  admin_dashboard:  AdminDashboard,
  admin_sessions:   CashierHub,
  admin_students:   AdminStudents,
  admin_staff:      AdminStaff,
  admin_pricing:    AdminPricing,
  admin_products:   AdminProducts,
  admin_expenses:   AdminExpenses,
  admin_center_expenses: AdminCenterExpenses,
  admin_reports:    AdminReports,
  admin_settings:   AdminSettings,
  admin_daily:      AdminDailyRevenue,
  admin_staff_revenue: AdminStaffRevenue,
  admin_deposits:       AdminDeposits,
  admin_subscriptions:  AdminSubscriptions,
  admin_network:        AdminNetworkDashboard,
  admin_network_v2:     AdminNetworkV2Console,
  admin_wallet_subs:    AdminWalletSubs,
  admin_shifts:         AdminShifts,
  admin_charges:        AdminCharges,
  admin_inventory:      AdminInventory,
  admin_log:            AdminAttendanceLog,
  admin_collections:    AdminCollections,
  admin_debts:          AdminDebts,
  admin_wallets:        AdminWallets,
  admin_payroll:        AdminPayroll,
  admin_financial:      AdminFinancialLedger,
  admin_kitchen_capital: AdminKitchenCapital,
  admin_sales_ledger: AdminSalesLedger,
  admin_free_sites:   AdminFreeSites,
  // Cashier
  cashier_current:     CashierCurrent,
  cashier_checkin:     CashierCheckIn,
  cashier_students:    CashierStudents,
  cashier_new_student:  CashierNewStudent,
  cashier_internet_gate: CashierInternetGate,
  cashier_network_v2:    CashierNetworkV2Ops,
  cashier_wallet_subs:   CashierWalletSubs,
  cashier_debts:         CashierDebts,
  cashier_wallets:       CashierWallets,
  cashier_guest_orders:  CashierGuestOrders,
  cashier_log:           CashierLog,
  // Kitchen
  kitchen_new_order:     KitchenNewOrder,
  kitchen_active_orders: KitchenActiveOrders,
  kitchen_custody:       KitchenCustody,
  kitchen_log:           KitchenLog,
  kitchen_products:      KitchenProducts,
};

export default function App() {
  const { toasts, toast } = useToast();
  const [config] = useStorage(STORAGE_KEYS.CONFIG, {});
  const [user, setUser] = useState(null);
  // Note: staff table is no longer fetched here — auth uses Supabase Auth session
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileStudentId, setProfileStudentId] = useState(null);
  const [kitchenNotif, setKitchenNotif] = useState(null);
  const knownOrderIdsRef = useRef(null);
  const kitchenNotifTimerRef = useRef(null);

  // Global Data for Admin Header
  const [invoices,    , refreshInvoices]    = useStorage(STORAGE_KEYS.INVOICES, []);
  const [collections, , refreshCollections] = useStorage(STORAGE_KEYS.ADMIN_COLLECTIONS, []);
  const [debts,       , refreshDebts]       = useStorage(STORAGE_KEYS.DEBTS, []);
  const [expenses,    , refreshExpenses]    = useStorage(STORAGE_KEYS.EXPENSES, []);
  const [deposits,    , refreshDeposits]    = useStorage(STORAGE_KEYS.DEPOSITS, []);
  const [walletTxs]                         = useStorage(STORAGE_KEYS.WALLET_TRANSACTIONS, []);
  const [shifts,      , refreshShifts]      = useStorage(STORAGE_KEYS.SHIFTS, []);
  const [cashAdj,     , refreshCashAdj]     = useStorage(STORAGE_KEYS.CASH_ADJUSTMENTS, []);
  const [orders,      , refreshOrders]      = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [adminCharges, , refreshAdminCharges] = useStorage(STORAGE_KEYS.ADMIN_CHARGES, []);
  const [safeTx]                              = useStorage(STORAGE_KEYS.SAFE_TRANSACTIONS, []);

  // Refresh financial stores every 20s so sidebar numbers stay current
  useEffect(() => {
    const id = setInterval(() => {
      refreshInvoices();
      refreshCollections();
      refreshDebts();
      refreshExpenses();
      refreshDeposits();
      refreshShifts();
      refreshCashAdj();
      refreshOrders();
      refreshAdminCharges();
    }, 20000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper: Find active shift for the current user
  const activeShift = useMemo(() => {
    if (!user) return null;
    return (shifts || []).find(s => s.status === 'active' && s.cashierId === user.id);
  }, [shifts, user]);

  const uncollectedBalance = useMemo(() => {
    if (user?.role === 'kitchen') return 0;

    // Global drawer calculation — always from last closed shift's actual cash
    const closedShifts = shifts.filter(s => s.status === 'closed').sort((a,b) => new Date(b.endTime) - new Date(a.endTime));
    const lastClosed = closedShifts[0];
    const baseAmount = lastClosed ? (lastClosed.actualCash || 0) : 0;
    const cutoff     = lastClosed ? lastClosed.endTime : '1970-01-01T00:00:00.000Z';

    const result = calcDrawerExpected(
      { startingCash: baseAmount, start: cutoff, startExclusive: true },
      { invoices, deposits, debts, expenses, cashAdj, adminCharges, collections, safeTx }
    );
    return result.expectedCash;
  }, [invoices, collections, debts, expenses, deposits, cashAdj, adminCharges, safeTx, user, shifts]);

  // New kitchen orders count for sidebar badge
  const newOrderCount = useMemo(() => (orders || []).filter(o => o.status === 'new').length, [orders]);

  // ── Kitchen order notification (sound + banner) ──
  useEffect(() => {
    if (!user) return;
    const hasKitchenAccess = (ROLE_VIEWS[user.role] || []).includes('kitchen_active_orders');
    if (!hasKitchenAccess) return;

    const currentOrders = orders || [];
    const currentIds = new Set(currentOrders.map(o => o.id));

    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = currentIds;
      return;
    }

    const prevIds = knownOrderIdsRef.current;
    const newOrders = currentOrders.filter(o => !prevIds.has(o.id) && o.status === 'new');

    if (newOrders.length > 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.18].forEach((offset, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = i === 0 ? 880 : 1047;
          osc.type = 'sine';
          gain.gain.value = 0.25;
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.12);
        });
      } catch (e) { /* audio not available */ }

      const latest = newOrders[newOrders.length - 1];
      setKitchenNotif({
        name: latest.studentName || 'طلب جديد',
        itemCount: latest.items?.length || 0,
        total: latest.total || 0,
        count: newOrders.length,
      });
      if (kitchenNotifTimerRef.current) clearTimeout(kitchenNotifTimerRef.current);
      kitchenNotifTimerRef.current = setTimeout(() => setKitchenNotif(null), 8000);
    }

    knownOrderIdsRef.current = currentIds;
  }, [orders, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rehydrate session via Supabase Auth on refresh + listen for auth state changes
  useEffect(() => {
    let resolved = false;
    const resolve = () => { if (!resolved) { resolved = true; setAuthLoading(false); } };

    // Primary: restore session via getSession() — guaranteed to resolve via try-catch
    // (avoids relying on INITIAL_SESSION event which can be lost in React StrictMode)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!resolved && session?.user) {
          const member = await fetchStaffByAuthId(session.user.id);
          if (member && member.active !== false) {
            setUser(member);
            setActiveView(prev => prev || DEFAULT_VIEWS[member.role] || '');
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('[Auth] session restore failed:', err);
      }
      resolve();
    })();

    // Secondary: listen for auth changes (sign-in, sign-out, token refresh)
    // IMPORTANT: callback must NOT be async — Supabase awaits async callbacks
    // internally, which deadlocks signInWithPassword (it holds an auth lock
    // that the DB query inside fetchStaffByAuthId also needs).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fetchStaffByAuthId(session.user.id).then(member => {
          if (member && member.active !== false) {
            setUser(member);
            setActiveView(prev => prev || DEFAULT_VIEWS[member.role] || '');
          }
        }).catch(err => {
          console.error('[Auth] sign-in handler failed:', err);
        }).finally(() => {
          resolve();
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setActiveView('');
        resolve();
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        fetchStaffByAuthId(session.user.id).then(member => {
          if (member && member.active !== false) {
            setUser(member);
          } else {
            supabase.auth.signOut();
          }
        }).catch(() => {});
      }
    });

    // Safety net: if getSession() hangs (e.g. token refresh stuck), force loading off
    const safety = setTimeout(resolve, 3000);

    return () => {
      resolved = true;
      subscription.unsubscribe();
      clearTimeout(safety);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time staff deactivation / role change listener ──
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`staff-watch-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'staff', filter: `id=eq.${user.id}` },
        async (payload) => {
          const updated = payload.new;
          if (updated.active === false) {
            toast('تم تعطيل حسابك من قبل المدير', 'error');
            await supabase.auth.signOut();
            return;
          }
          // Role changed — update user state and redirect
          if (updated.role !== user.role) {
            const refreshed = await fetchStaffByAuthId(updated.auth_id);
            if (refreshed) {
              setUser(refreshed);
              setActiveView(DEFAULT_VIEWS[refreshed.role] || '');
              toast('تم تغيير صلاحياتك — تم التحويل تلقائياً', 'info');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-backup students every 24h (single row, never overwrites with empty) ──
  useEffect(() => {
    const AUTO_BACKUP_ID = 'auto-daily-backup';
    const runAutoBackup = async () => {
      try {
        // Check if existing auto-backup was updated within last 24h
        const { data: existing } = await supabase
          .from('student_backups')
          .select('id, created_at')
          .eq('id', AUTO_BACKUP_ID)
          .maybeSingle();

        if (existing) {
          const lastUpdate = new Date(existing.created_at).getTime();
          const hoursSince = (Date.now() - lastUpdate) / (1000 * 60 * 60);
          if (hoursSince < 24) return; // updated recently, skip
        }

        const { data: students } = await supabase.from('students').select('*');
        // SAFETY: never overwrite backup with zero students
        if (!students || students.length === 0) return;

        await supabase.from('student_backups').upsert({
          id: AUTO_BACKUP_ID,
          snapshot: students,
          student_count: students.length,
          trigger: 'auto',
          note: `Auto-backup ${new Date().toISOString().slice(0, 10)}`,
          created_by: 'system',
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[AutoBackup] failed silently:', err.message);
      }
    };
    runAutoBackup();
  }, []);

  function handleLogin(member) {
    setUser(member);
    setActiveView(DEFAULT_VIEWS[member.role] || '');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT handler clears user/activeView
  }

  // Role-based view guard — prevents unauthorized view access
  const guardedSetActiveView = useCallback((viewKey) => {
    if (!user) return;
    const allowed = ROLE_VIEWS[user.role] || [];
    if (!allowed.includes(viewKey)) {
      toast('ليس لديك صلاحية الوصول لهذا القسم', 'error');
      return;
    }
    setActiveView(viewKey);
  }, [user, toast]);

  const isViewAllowed = useMemo(() => {
    if (!user || !activeView) return false;
    const allowed = ROLE_VIEWS[user.role] || [];
    return allowed.includes(activeView);
  }, [user, activeView]);

  // Idle timeout — auto-logout after 30 min of inactivity
  const handleIdleTimeout = useCallback(async () => {
    toast('تم تسجيل الخروج تلقائياً بسبب عدم النشاط', 'info');
    await supabase.auth.signOut();
  }, [toast]);

  const { showWarning: showIdleWarning, dismissWarning } = useIdleTimeout({
    enabled: !!user,
    onTimeout: handleIdleTimeout,
  });

  const sharedProps = { user, toast, config, setActiveView: guardedSetActiveView, uncollectedBalance, onStudentClick: setProfileStudentId };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const ActiveView = VIEW_MAP[activeView];
  const menuItems = MENU[user?.role] || [];
  const activeLabel = menuItems.find(i => i.view === activeView)?.label || '';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FB' }}>
      <Sidebar
        user={user}
        activeView={activeView}
        onNavigate={guardedSetActiveView}
        onLogout={handleLogout}
        config={config}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        uncollectedBalance={uncollectedBalance}
        newOrderCount={newOrderCount}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-navy text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <BookOpen size={15} className="text-gold" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate leading-tight">{config?.name || 'Smart Vision'}</p>
              {activeLabel && <p className="text-navy-300 text-xs truncate leading-tight">{activeLabel}</p>}
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="فتح القائمة"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          {ActiveView && isViewAllowed ? (
            <ActiveView {...sharedProps} />
          ) : user?.role === 'worker' ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <BookOpen size={28} className="text-gray-400" />
              </div>
              <p className="font-semibold text-gray-600">مرحباً، {user.name}</p>
              <p className="text-sm text-gray-400">هذا الحساب ليس له صلاحيات الوصول للنظام</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-navy-400 text-sm">
              اختر قسماً من القائمة
            </div>
          )}
        </main>
      </div>
      <ToastContainer toasts={toasts} />
      <StudentProfileModal
        studentId={profileStudentId}
        onClose={() => setProfileStudentId(null)}
        config={config}
        user={user}
      />
      {/* Kitchen order notification banner */}
      {kitchenNotif && (
        <div className="fixed top-4 inset-x-0 z-[100] flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-teal/30 px-5 py-4 flex items-center gap-4 min-w-0 sm:min-w-[300px] max-w-md notif-slide-down">
            <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center flex-shrink-0">
              <Bell size={20} className="text-teal animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy">
                {kitchenNotif.count > 1 ? `${kitchenNotif.count} طلبات جديدة!` : 'طلب جديد!'}
              </p>
              <p className="text-xs text-navy-400 truncate">
                {kitchenNotif.name} — {kitchenNotif.itemCount} عناصر — {kitchenNotif.total} ج.م
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => { guardedSetActiveView('kitchen_active_orders'); setKitchenNotif(null); }}
                className="px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-semibold hover:bg-teal/90 transition-colors cursor-pointer"
              >
                عرض
              </button>
              <button onClick={() => setKitchenNotif(null)} className="text-navy-300 hover:text-navy transition-colors cursor-pointer">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Idle timeout warning modal */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">هل أنت موجود؟</h3>
              <p className="text-sm text-gray-500 mt-1">سيتم تسجيل خروجك تلقائياً خلال 5 دقائق بسبب عدم النشاط</p>
            </div>
            <button
              onClick={dismissWarning}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm"
            >
              أنا هنا — استمر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
