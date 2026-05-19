export const STORAGE_KEYS = {
  STUDENTS:              'lib-students',
  SESSIONS:              'lib-sessions',
  INVOICES:              'lib-invoices',
  KITCHEN_ORDERS:        'lib-kitchen-orders',
  PRODUCTS:              'lib-products',
  CATEGORIES:            'lib-categories',
  EXPENSES:              'lib-expenses',
  CENTER_EXPENSES:       'lib-center-expenses',
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
  ADMIN_CHARGES:         'lib-admin-charges',
  STOCK_MOVEMENTS:       'lib-stock-movements',
  SHIFTS:                'lib-shifts',
  SAFE_TRANSACTIONS:     'lib-safe-transactions',
  ADMIN_COLLECTIONS:     'lib-admin-collections',
  DEBTS:                 'lib-debts',
  CASH_ADJUSTMENTS:      'lib-cash-adjustments',
  SALARY_CONFIGS:        'lib-salary-configs',
  PAYROLL_ENTRIES:       'lib-payroll-entries',
  PRODUCT_RECIPES:       'lib-product-recipes',
  CUSTODY_HANDOVERS:     'lib-custody-handovers',
  // WiFi Network Management
  WIFI_SESSION_TIERS:    'lib-wifi-session-tiers',
  WIFI_SESSIONS:         'lib-wifi-sessions',
  WIFI_VOUCHER_BATCHES:  'lib-wifi-voucher-batches',
  WIFI_FULL_ACCESS:      'lib-wifi-full-access',
  WIFI_BLOCKED_CATEGORIES: 'lib-wifi-blocked-categories',
  WIFI_BLOCKED_DOMAINS:  'lib-wifi-blocked-domains',
  WIFI_WALLED_GARDEN:    'lib-wifi-walled-garden',
  WIFI_USAGE_LOGS:       'lib-wifi-usage-logs',
  WIFI_EVENTS:           'lib-wifi-events',
  // WiFi v2 (Phase 1 — parallel system, see WIFI-SYSTEM.md §14)
  WIFI_DEVICES:          'lib-wifi-devices',
  WIFI_PROFILES_V2:      'lib-wifi-profiles-v2',
  WIFI_REALTIME_EVENTS:  'lib-wifi-realtime-events',
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
  name:         'Smart Vision',
  capacity:     50,
  wifiName:     'Smart-Vision-WiFi',
  currency:     'ج.م',
  openTime:     '08:00',
  closeTime:    '24:00',
  dayStartHour: 8,
  universities:  [],
  colleges:      [],
  lectureHalls:  [],
};

export const NATIONALITIES = [
  // الدول العربية (مرتبة في المقدمة للوصول السريع)
  'مصري', 'سعودي', 'إماراتي', 'كويتي', 'قطري', 'بحريني', 'عماني', 'يمني',
  'سوري', 'لبناني', 'أردني', 'فلسطيني', 'عراقي',
  'سوداني', 'جنوب سوداني', 'ليبي', 'تونسي', 'جزائري', 'مغربي', 'موريتاني',
  'صومالي', 'جيبوتي', 'قمري',
  // باقي دول العالم (أبجدياً)
  'أفغاني', 'ألباني', 'ألماني', 'أندوري', 'أنغولي', 'أنتيغي وبربودي',
  'أرجنتيني', 'أرميني', 'أسترالي', 'نمساوي', 'أذربيجاني',
  'باهامي', 'بنغلاديشي', 'بربادوسي', 'بيلاروسي', 'بلجيكي', 'بليزي', 'بنيني',
  'بوتاني', 'بوليفي', 'بوسني', 'بوتسواني', 'برازيلي', 'بروناي', 'بلغاري',
  'بوركيني', 'بوروندي',
  'كمبودي', 'كاميروني', 'كندي', 'الرأس الأخضر', 'أفريقي وسطى', 'تشادي',
  'تشيلي', 'صيني', 'كولومبي', 'كونغولي', 'كوستاريكي', 'إيفواري', 'كرواتي',
  'كوبي', 'قبرصي', 'تشيكي',
  'دنماركي', 'دومينيكي', 'دومينيكاني',
  'إكوادوري', 'سلفادوري', 'غيني استوائي', 'إريتري', 'إستوني', 'إسواتيني',
  'إثيوبي',
  'فيجي', 'فنلندي', 'فرنسي',
  'غابوني', 'غامبي', 'جورجي', 'غاني', 'يوناني', 'غرينادي', 'غواتيمالي',
  'غيني', 'غيني بيساوي', 'غياني',
  'هايتي', 'هندوراسي', 'مجري',
  'آيسلندي', 'هندي', 'إندونيسي', 'إيراني', 'أيرلندي', 'إسرائيلي', 'إيطالي',
  'جامايكي', 'ياباني',
  'كازاخي', 'كيني', 'كيريباتي', 'كوسوفي', 'قيرغيزي',
  'لاوسي', 'لاتفي', 'ليسوتي', 'ليبيري', 'ليختنشتايني', 'ليتواني', 'لوكسمبورغي',
  'مدغشقري', 'مالاوي', 'ماليزي', 'مالديفي', 'مالي', 'مالطي', 'مارشالي',
  'موريشيوسي', 'مكسيكي', 'ميكرونيزي', 'مولدوفي', 'موناكي', 'منغولي',
  'مونتنيغري', 'موزمبيقي', 'ميانماري',
  'ناميبي', 'ناوروي', 'نيبالي', 'هولندي', 'نيوزيلندي', 'نيكاراغوي',
  'نيجيري', 'نيجيري (النيجر)', 'كوري شمالي', 'مقدوني شمالي', 'نرويجي',
  'باكستاني', 'بالاوي', 'بنمي', 'بابوا غيني', 'باراغواي', 'بيروفي',
  'فلبيني', 'بولندي', 'برتغالي',
  'روماني', 'روسي', 'رواندي',
  'سانت كيتس ونيفيس', 'سانت لوسي', 'سانت فنسنت', 'ساموي', 'سان ماريني',
  'ساو تومي', 'سنغالي', 'صربي', 'سيشلي', 'سيراليوني', 'سنغافوري',
  'سلوفاكي', 'سلوفيني', 'جزر سليمان', 'جنوب أفريقي', 'كوري جنوبي',
  'إسباني', 'سريلانكي', 'سورينامي', 'سويدي', 'سويسري',
  'تايواني', 'طاجيكي', 'تنزاني', 'تايلندي', 'تيموري', 'توغولي', 'تونغي',
  'ترينيدادي', 'تركي', 'تركماني', 'توفالي',
  'أوغندي', 'أوكراني', 'بريطاني', 'أمريكي', 'أوروغواني', 'أوزبكي',
  'فانواتي', 'فاتيكاني', 'فنزويلي', 'فيتنامي',
  'زامبي', 'زيمبابوي',
  'أخرى',
];

export const DEFAULT_PRICING = {
  // Legacy fields (used as fallback if hourTiers is empty)
  hourly:       15,
  halfDay:      50,
  halfDayHours: 5,
  fullDay:      80,
  // Tier-based pricing — primary system
  hourTiers: [
    { id: 'tier-3',  hours: 3,  price: 45,  active: true },
    { id: 'tier-4',  hours: 4,  price: 50,  active: true },
    { id: 'tier-5',  hours: 5,  price: 60,  active: true },
    { id: 'tier-12', hours: 12, price: 100, active: true },
    { id: 'tier-24', hours: 24, price: 125, active: true },
  ],
  extraHourRate: 10, // price per extra hour beyond a tier's base hours
  graceMinutes:  10, // first N minutes of a new hour are free (don't bump to next hour)
  freeMinutes:   15, // first N minutes of ANY session are completely free (no charge at all)
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
  CalendarDays, ArrowUpCircle, CreditCard, Globe, Warehouse, Banknote,
  AlarmClock, ScrollText, Landmark, TrendingUp,
} from 'lucide-react';

export const MENU = {
  admin: [
    // ── الرئيسية
    { section: 'الرئيسية' },
    { view: 'admin_dashboard', label: 'لوحة التحكم',    icon: Home  },
    { view: 'admin_sessions',  label: 'الجلسات النشطة', icon: Clock },

    // ── الطلاب
    { section: 'الطلاب' },
    { view: 'admin_students',     label: 'الطلاب',              icon: Users      },
    { view: 'admin_wallet_subs',  label: 'الرصيد والاشتراكات', icon: Wallet     },
    { view: 'admin_log',          label: 'سجل الحضور اليومي',  icon: ScrollText },

    // ── المالية
    { section: 'المالية' },
    { view: 'admin_financial',   label: 'السجل المالي',       icon: Landmark      },
    { view: 'admin_collections', label: 'تحصيل الأموال',    icon: ArrowUpCircle },
    { view: 'admin_daily',       label: 'الإيرادات اليومية', icon: CalendarDays  },
    { view: 'admin_expenses',    label: 'المصروفات',          icon: Receipt       },
    { view: 'admin_center_expenses', label: 'مصروفات السنتر', icon: Wallet      },
    { view: 'admin_reports',     label: 'التقارير',           icon: BarChart2     },

    // ── الموظفون
    { section: 'الموظفون' },
    { view: 'admin_staff',         label: 'الموظفون',          icon: Shield    },
    { view: 'admin_debts',         label: 'الديون',             icon: Receipt   },
    { view: 'admin_staff_revenue', label: 'تحصيل الموظفين',    icon: UserPlus  },
    { view: 'admin_charges',       label: 'مديونيات الموظفين', icon: Banknote  },
    { view: 'admin_payroll',       label: 'الرواتب',            icon: Banknote  },
    { view: 'admin_shifts',        label: 'الشفتات',            icon: AlarmClock },

    // ── المطبخ
    { section: 'المطبخ' },
    { view: 'cashier_guest_orders',  label: 'طلبات البوابة',  icon: UserPlus },
    { view: 'kitchen_new_order',     label: 'طلب جديد',       icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة', icon: Activity     },
    { view: 'kitchen_products',      label: 'القائمة',         icon: Coffee       },
    { view: 'admin_kitchen_capital', label: 'إدارة المطبخ', icon: TrendingUp   },
    { view: 'admin_sales_ledger',   label: 'سجل المبيعات', icon: Receipt     },

    // ── الإعداد
    { section: 'الإعداد' },
    { view: 'admin_pricing',       label: 'الأسعار',        icon: Tag       },
    { view: 'admin_subscriptions', label: 'خطط الاشتراك',   icon: CreditCard },
    { view: 'admin_products',      label: 'المنتجات',        icon: Package   },
    { view: 'admin_inventory',     label: 'المخزون',         icon: Warehouse },
    { view: 'admin_network',       label: 'إدارة الشبكة',     icon: Wifi      },
    { view: 'admin_network_v2',    label: 'إدارة الشبكة v2',  icon: Wifi      },
    { view: 'admin_free_sites',    label: 'المواقع المجانية', icon: Globe     },
    { view: 'admin_settings',      label: 'الإعدادات',       icon: Settings  },
  ],
  cashier: [
    { view: 'cashier_hub',           label: 'الجلسات والدخول',  icon: Users    },
    { view: 'cashier_students',      label: 'الطلاب',            icon: Users2   },
    { view: 'cashier_wallet_subs',   label: 'الرصيد والاشتراكات', icon: Wallet  },
    { view: 'cashier_guest_orders',  label: 'طلبات البوابة',     icon: UserPlus },
    { view: 'cashier_internet_gate', label: 'بوابة الإنترنت',   icon: Globe    },
    { view: 'cashier_network_v2',    label: 'بوابة الإنترنت v2', icon: Globe   },
    { view: 'cashier_log',           label: 'سجل اليوم',        icon: FileText },
    { view: 'cashier_debts',         label: 'الديون',          icon: Receipt      },
    { view: 'admin_center_expenses', label: 'مصروفات السنتر',  icon: Wallet       },
    { view: 'kitchen_new_order',     label: 'طلب جديد',         icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة',   icon: Activity     },
    { view: 'kitchen_products',      label: 'القائمة',           icon: Coffee       },
  ],
  kitchen: [
    { view: 'kitchen_new_order',     label: 'طلب جديد',       icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة', icon: Activity     },
    { view: 'cashier_guest_orders',  label: 'طلبات البوابة',  icon: UserPlus     },
    { view: 'kitchen_custody',       label: 'العهدة النقدية',  icon: Wallet       },
    { view: 'kitchen_log',           label: 'سجل المطبخ',      icon: Clock        },
    { view: 'kitchen_products',      label: 'القائمة',          icon: Coffee       },
  ],
  employee: [
    { view: 'cashier_hub',           label: 'الجلسات والدخول',  icon: Users    },
    { view: 'cashier_students',      label: 'الطلاب',            icon: Users2   },
    { view: 'cashier_wallet_subs',   label: 'الرصيد والاشتراكات', icon: Wallet  },
    { view: 'cashier_internet_gate', label: 'بوابة الإنترنت',   icon: Globe    },
    { view: 'cashier_network_v2',    label: 'بوابة الإنترنت v2', icon: Globe   },
    { view: 'cashier_log',           label: 'سجل اليوم',        icon: FileText },
    { view: 'cashier_debts',         label: 'الديون',          icon: Receipt      },
    { view: 'admin_center_expenses', label: 'مصروفات السنتر',  icon: Wallet       },
    { view: 'kitchen_new_order',     label: 'طلب جديد',         icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة',   icon: Activity     },
    { view: 'kitchen_products',      label: 'القائمة',           icon: Coffee       },
  ],
};

export const DEFAULT_VIEWS = {
  admin:    'admin_dashboard',
  cashier:  'cashier_hub',
  kitchen:  'kitchen_active_orders',
  employee: 'cashier_hub',
};

// Role-based view access control — explicit allowlist per role
export const ROLE_VIEWS = {
  admin: Object.keys({
    admin_dashboard:1, admin_sessions:1, admin_students:1, admin_staff:1,
    admin_pricing:1, admin_products:1, admin_expenses:1, admin_center_expenses:1, admin_reports:1,
    admin_settings:1, admin_daily:1, admin_staff_revenue:1, admin_deposits:1,
    admin_subscriptions:1, admin_network:1, admin_network_v2:1, admin_free_sites:1, admin_wallet_subs:1,
    admin_shifts:1, admin_charges:1, admin_inventory:1, admin_log:1,
    admin_collections:1, admin_debts:1, admin_wallets:1, admin_payroll:1,
    admin_financial:1, admin_kitchen_capital:1, admin_sales_ledger:1,
    // Admin can also access cashier/kitchen views
    cashier_hub:1, cashier_current:1, cashier_checkin:1, cashier_students:1,
    cashier_new_student:1, cashier_internet_gate:1, cashier_network_v2:1, cashier_wallet_subs:1,
    cashier_debts:1, cashier_wallets:1, cashier_guest_orders:1, cashier_log:1,
    kitchen_new_order:1, kitchen_active_orders:1, kitchen_custody:1, kitchen_log:1, kitchen_products:1,
  }),
  cashier: [
    'cashier_hub', 'cashier_current', 'cashier_checkin', 'cashier_students',
    'cashier_new_student', 'cashier_internet_gate', 'cashier_network_v2', 'cashier_wallet_subs',
    'cashier_debts', 'cashier_wallets', 'cashier_guest_orders', 'cashier_log',
    'kitchen_new_order', 'kitchen_active_orders', 'kitchen_products',
    'admin_center_expenses',
  ],
  kitchen: [
    'kitchen_new_order', 'kitchen_active_orders', 'cashier_guest_orders', 'kitchen_custody', 'kitchen_log', 'kitchen_products',
  ],
  employee: [
    'cashier_hub', 'cashier_current', 'cashier_checkin', 'cashier_students',
    'cashier_new_student', 'cashier_internet_gate', 'cashier_network_v2', 'cashier_wallet_subs',
    'cashier_debts', 'cashier_wallets', 'cashier_guest_orders', 'cashier_log',
    'kitchen_new_order', 'kitchen_active_orders', 'kitchen_products',
    'admin_center_expenses',
  ],
};
