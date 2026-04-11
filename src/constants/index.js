export const STORAGE_KEYS = {
  STUDENTS:              'lib-students',
  SESSIONS:              'lib-sessions',
  INVOICES:              'lib-invoices',
  KITCHEN_ORDERS:        'lib-kitchen-orders',
  PRODUCTS:              'lib-products',
  CATEGORIES:            'lib-categories',
  EXPENSES:              'lib-expenses',
  STAFF:                 'lib-staff',
  CONFIG:                'lib-config',
  PRICING:               'lib-pricing',
  DAILY_LOGS:            'lib-daily-logs',
  OWNERS:                'lib-owners',
  DEPOSITS:              'lib-deposits',
  WALLET_TRANSACTIONS:   'lib-wallet-transactions',
  SUBSCRIPTION_PLANS:    'lib-subscription-plans',
  STUDENT_SUBSCRIPTIONS: 'lib-student-subscriptions',
  GATEWAY_CONFIG:        'lib-gateway-config',
  GATEWAY_LOGS:          'lib-gateway-logs',
};

export const DEFAULT_GATEWAY_CONFIG = {
  url:            '',
  method:         'POST',
  authHeader:     '',
  disconnectPath: '/disconnect',
  reconnectPath:  '/reconnect',
  enabled:        false,
};

export const DEFAULT_CONFIG = {
  name:      'Smart Vision',
  capacity:  50,
  wifiName:  'Smart-Vision-WiFi',
  currency:  'ج.م',
  openTime:  '08:00',
  closeTime: '24:00',
};

export const DEFAULT_PRICING = {
  hourly:       15,
  halfDay:      50,
  halfDayHours: 5,
  fullDay:      80,
};

export const DEFAULT_STAFF = [
  { id: 'stf-admin',    username: 'admin',    password: 'admin123', role: 'admin',   name: 'المدير',         active: true, createdAt: new Date().toISOString() },
  { id: 'stf-cashier1', username: 'cashier1', password: 'cash123',  role: 'cashier', name: 'أمين الصندوق',   active: true, createdAt: new Date().toISOString() },
  { id: 'stf-kitchen1', username: 'kitchen1', password: 'kit123',   role: 'kitchen', name: 'موظف المطبخ',    active: true, createdAt: new Date().toISOString() },
];

export const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'مشروبات ساخنة', emoji: '☕', color: 'teal'  },
  { id: 'cat-2', name: 'مشروبات باردة', emoji: '🧊', color: 'blue'  },
  { id: 'cat-3', name: 'وجبات خفيفة',  emoji: '🥪', color: 'amber' },
  { id: 'cat-4', name: 'حلويات',        emoji: '🍰', color: 'pink'  },
];

export const DEFAULT_PRODUCTS = [
  { id: 'prod-1',  categoryId: 'cat-1', name: 'قهوة عربية',        price: 25, costPrice: 10, available: true },
  { id: 'prod-2',  categoryId: 'cat-1', name: 'شاي بالنعناع',      price: 15, costPrice:  5, available: true },
  { id: 'prod-3',  categoryId: 'cat-1', name: 'كابتشينو',          price: 35, costPrice: 15, available: true },
  { id: 'prod-4',  categoryId: 'cat-1', name: 'شاي أخضر',          price: 15, costPrice:  5, available: true },
  { id: 'prod-5',  categoryId: 'cat-1', name: 'لاتيه',             price: 40, costPrice: 18, available: true },
  { id: 'prod-6',  categoryId: 'cat-2', name: 'عصير برتقال',       price: 20, costPrice:  8, available: true },
  { id: 'prod-7',  categoryId: 'cat-2', name: 'عصير مانجو',        price: 25, costPrice: 10, available: true },
  { id: 'prod-8',  categoryId: 'cat-3', name: 'ساندويتش جبنة',     price: 30, costPrice: 12, available: true },
  { id: 'prod-9',  categoryId: 'cat-4', name: 'كيك الشوكولاتة',    price: 25, costPrice: 10, available: true },
  { id: 'prod-10', categoryId: 'cat-4', name: 'بسكويت شوكولاتة',   price: 15, costPrice:  5, available: true },
];

import {
  Home, Users, Users2, UserPlus, Shield, Coffee, Wifi, Settings,
  Check, Package, Tag, Receipt, BarChart2,
  ShoppingCart, Activity, Clock, FileText, Wallet,
  CalendarDays, ArrowUpCircle, CreditCard, Globe,
} from 'lucide-react';

export const MENU = {
  admin: [
    { view: 'admin_dashboard', label: 'لوحة التحكم',  icon: Home      },
    { view: 'admin_students',  label: 'الطلاب',        icon: Users     },
    { view: 'admin_staff',     label: 'الموظفون',      icon: Shield    },
    { view: 'admin_owners',    label: 'الحسابات',       icon: Wallet    },
    { view: 'admin_pricing',       label: 'الأسعار',        icon: Tag        },
    { view: 'admin_subscriptions', label: 'الاشتراكات',    icon: CreditCard },
    { view: 'admin_products',  label: 'المنتجات',       icon: Package   },
    { view: 'admin_expenses',  label: 'المصروفات',       icon: Receipt      },
    { view: 'admin_reports',   label: 'التقارير',         icon: BarChart2    },
    { view: 'admin_daily',     label: 'الإيرادات اليومية', icon: CalendarDays },
    { view: 'admin_deposits',      label: 'إضافة رصيد',      icon: ArrowUpCircle },
    { view: 'admin_internet_gate', label: 'بوابة الإنترنت',   icon: Globe         },
    { view: 'admin_settings',      label: 'الإعدادات',       icon: Settings      },
  ],
  cashier: [
    { view: 'cashier_current',     label: 'الجلسات النشطة', icon: Users    },
    { view: 'cashier_checkin',     label: 'تسجيل الدخول',  icon: Check    },
    { view: 'cashier_students',     label: 'الطلاب',          icon: Users2   },
    { view: 'cashier_new_student',  label: 'طالب جديد',      icon: UserPlus },
    { view: 'cashier_internet_gate', label: 'بوابة الإنترنت', icon: Globe    },
    { view: 'cashier_log',          label: 'سجل اليوم',      icon: FileText },
  ],
  kitchen: [
    { view: 'kitchen_new_order',     label: 'طلب جديد',       icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة', icon: Activity     },
    { view: 'kitchen_log',           label: 'سجل المطبخ',      icon: Clock        },
    { view: 'kitchen_products',      label: 'القائمة',          icon: Coffee       },
  ],
};

export const DEFAULT_VIEWS = {
  admin:   'admin_dashboard',
  cashier: 'cashier_current',
  kitchen: 'kitchen_active_orders',
};
