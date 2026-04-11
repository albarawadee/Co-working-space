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
  ADMIN_CHARGES:         'lib-admin-charges',
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
  universities: [],
  colleges:     [],
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
    { view: 'admin_staff_revenue', label: 'تحصيل الموظفين', icon: UserPlus  },
    { view: 'admin_deposits',      label: 'إضافة رصيد',      icon: ArrowUpCircle },
    { view: 'admin_wallet_subs',   label: 'الرصيد والاشتراكات', icon: Wallet     },
    { view: 'admin_charges',       label: 'مستحقات الموظفين',   icon: Receipt    },
    { view: 'admin_internet_gate', label: 'بوابة الإنترنت',   icon: Globe         },
    { view: 'admin_settings',      label: 'الإعدادات',       icon: Settings      },
  ],
  cashier: [
    { view: 'cashier_hub',           label: 'الجلسات والدخول',  icon: Users    },
    { view: 'cashier_students',      label: 'الطلاب',            icon: Users2   },
    { view: 'cashier_wallet_subs',   label: 'الرصيد والاشتراكات', icon: Wallet  },
    { view: 'cashier_internet_gate', label: 'بوابة الإنترنت',   icon: Globe    },
    { view: 'cashier_log',           label: 'سجل اليوم',        icon: FileText },
    { view: 'kitchen_new_order',     label: 'طلب جديد',         icon: ShoppingCart },
    { view: 'kitchen_active_orders', label: 'الطلبات النشطة',   icon: Activity     },
    { view: 'kitchen_products',      label: 'القائمة',           icon: Coffee       },
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
  cashier: 'cashier_hub',
  kitchen: 'kitchen_active_orders',
};
