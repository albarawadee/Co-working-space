import { useState, useEffect } from 'react';
import { Menu, BookOpen } from 'lucide-react';
import { useToast } from './hooks/useToast';
import { useStorage } from './hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_VIEWS, MENU } from './constants';
import { ToastContainer } from './components/ui';
import { Sidebar } from './layout/Sidebar';
import { LoginScreen } from './layout/LoginScreen';

// Admin Views
import AdminDashboard from './views/admin/Dashboard';
import AdminStudents from './views/admin/Students';
import AdminStaff from './views/admin/Staff';
import AdminPricing from './views/admin/Pricing';
import AdminProducts from './views/admin/Products';
import AdminExpenses from './views/admin/Expenses';
import AdminReports from './views/admin/Reports';
import AdminSettings from './views/admin/Settings';
import AdminOwners from './views/admin/Owners';
import AdminDailyRevenue from './views/admin/DailyRevenue';
import AdminStaffRevenue from './views/admin/StaffRevenue';
import AdminDeposits from './views/admin/Deposits';
import AdminSubscriptions from './views/admin/Subscriptions';
import AdminInternetGate from './views/admin/InternetGate';
import AdminWalletSubs from './views/admin/WalletSubs';
import AdminCharges from './views/admin/AdminCharges';

// Cashier Views
import CashierHub from './views/cashier/Hub';
import CashierCurrent from './views/cashier/Current';
import CashierCheckIn from './views/cashier/CheckIn';
import CashierStudents from './views/cashier/Students';
import CashierNewStudent from './views/cashier/NewStudent';
import CashierLog from './views/cashier/Log';
import CashierInternetGate from './views/cashier/InternetGate';
import CashierWalletSubs from './views/cashier/WalletSubs';

// Kitchen Views
import { KitchenNewOrder } from './views/kitchen/NewOrder';
import { KitchenActiveOrders } from './views/kitchen/ActiveOrders';
import { KitchenLog } from './views/kitchen/Log';
import { KitchenProducts } from './views/kitchen/Products';

const VIEW_MAP = {
  // Cashier Hub (combined)
  cashier_hub: CashierHub,
  // Admin
  admin_dashboard:  AdminDashboard,
  admin_students:   AdminStudents,
  admin_staff:      AdminStaff,
  admin_pricing:    AdminPricing,
  admin_products:   AdminProducts,
  admin_expenses:   AdminExpenses,
  admin_reports:    AdminReports,
  admin_settings:   AdminSettings,
  admin_owners:     AdminOwners,
  admin_daily:      AdminDailyRevenue,
  admin_staff_revenue: AdminStaffRevenue,
  admin_deposits:       AdminDeposits,
  admin_subscriptions:  AdminSubscriptions,
  admin_internet_gate:  AdminInternetGate,
  admin_wallet_subs:    AdminWalletSubs,
  admin_charges:        AdminCharges,
  // Cashier
  cashier_current:     CashierCurrent,
  cashier_checkin:     CashierCheckIn,
  cashier_students:    CashierStudents,
  cashier_new_student:  CashierNewStudent,
  cashier_internet_gate: CashierInternetGate,
  cashier_wallet_subs:   CashierWalletSubs,
  cashier_log:           CashierLog,
  // Kitchen
  kitchen_new_order:     KitchenNewOrder,
  kitchen_active_orders: KitchenActiveOrders,
  kitchen_log:           KitchenLog,
  kitchen_products:      KitchenProducts,
};

export default function App() {
  const { toasts, toast } = useToast();
  const [config] = useStorage(STORAGE_KEYS.CONFIG, {});
  const [staff] = useStorage(STORAGE_KEYS.STAFF, []);
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Rehydrate session on refresh
  useEffect(() => {
    if (staff.length === 0) return;          // still loading
    if (user) return;                        // already logged in
    const savedId = sessionStorage.getItem('sv_user_id');
    if (!savedId) return;
    const member = staff.find(s => s.id === savedId && s.active !== false);
    if (member) {
      setUser(member);
      setActiveView(prev => prev || DEFAULT_VIEWS[member.role] || '');
    } else {
      sessionStorage.removeItem('sv_user_id'); // account disabled/deleted
    }
  }, [staff]);

  function handleLogin(member) {
    sessionStorage.setItem('sv_user_id', member.id);
    setUser(member);
    setActiveView(DEFAULT_VIEWS[member.role] || '');
  }

  function handleLogout() {
    sessionStorage.removeItem('sv_user_id');
    setUser(null);
    setActiveView('');
  }

  const sharedProps = { user, toast, config, setActiveView };

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
        onNavigate={setActiveView}
        onLogout={handleLogout}
        config={config}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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

        <main className="flex-1 overflow-y-auto">
          {ActiveView ? (
            <ActiveView {...sharedProps} />
          ) : (
            <div className="flex items-center justify-center h-full text-navy-400 text-sm">
              اختر قسماً من القائمة
            </div>
          )}
        </main>
      </div>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
