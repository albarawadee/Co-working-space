import { useState } from 'react';
import { useToast } from './hooks/useToast';
import { useStorage } from './hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_VIEWS } from './constants';
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
import AdminDeposits from './views/admin/Deposits';
import AdminSubscriptions from './views/admin/Subscriptions';
import AdminInternetGate from './views/admin/InternetGate';

// Cashier Views
import CashierCurrent from './views/cashier/Current';
import CashierCheckIn from './views/cashier/CheckIn';
import CashierStudents from './views/cashier/Students';
import CashierNewStudent from './views/cashier/NewStudent';
import CashierLog from './views/cashier/Log';
import CashierInternetGate from './views/cashier/InternetGate';

// Kitchen Views
import { KitchenNewOrder } from './views/kitchen/NewOrder';
import { KitchenActiveOrders } from './views/kitchen/ActiveOrders';
import { KitchenLog } from './views/kitchen/Log';
import { KitchenProducts } from './views/kitchen/Products';

const VIEW_MAP = {
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
  admin_deposits:       AdminDeposits,
  admin_subscriptions:  AdminSubscriptions,
  admin_internet_gate:  AdminInternetGate,
  // Cashier
  cashier_current:     CashierCurrent,
  cashier_checkin:     CashierCheckIn,
  cashier_students:    CashierStudents,
  cashier_new_student:  CashierNewStudent,
  cashier_internet_gate: CashierInternetGate,
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
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('');

  function handleLogin(member) {
    setUser(member);
    setActiveView(DEFAULT_VIEWS[member.role] || '');
  }

  function handleLogout() {
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

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FB' }}>
      <Sidebar
        user={user}
        activeView={activeView}
        onNavigate={setActiveView}
        onLogout={handleLogout}
        config={config}
      />
      <main className="flex-1 overflow-y-auto">
        {ActiveView ? (
          <ActiveView {...sharedProps} />
        ) : (
          <div className="flex items-center justify-center h-full text-navy-400 text-sm">
            اختر قسماً من القائمة
          </div>
        )}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
