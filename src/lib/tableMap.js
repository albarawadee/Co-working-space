// Maps every STORAGE_KEY string → { table, singleton, order? }
// order: { col: 'column_name', asc: false } for default sort
export const TABLE_MAP = {
  'lib-students':              { table: 'students',              singleton: false },
  'lib-sessions':              { table: 'sessions',              singleton: false, order: { col: 'check_in_time', asc: false } },
  'lib-invoices':              { table: 'invoices',              singleton: false, order: { col: 'created_at', asc: false } },
  'lib-kitchen-orders':        { table: 'kitchen_orders',        singleton: false, order: { col: 'created_at', asc: false } },
  'lib-products':              { table: 'products',              singleton: false },
  'lib-categories':            { table: 'categories',            singleton: false },
  'lib-expenses':              { table: 'expenses',              singleton: false, order: { col: 'created_at', asc: false } },
  'lib-staff':                 { table: 'staff',                 singleton: false },
  'lib-config':                { table: 'app_config',            singleton: true  },
  'lib-pricing':               { table: 'app_pricing',           singleton: true  },
  'lib-daily-logs':            { table: 'daily_logs',            singleton: false, order: { col: 'timestamp', asc: false } },
  'lib-owners':                { table: 'owners',                singleton: false },
  'lib-deposits':              { table: 'deposits',              singleton: false, order: { col: 'created_at', asc: false } },
  'lib-wallet-transactions':   { table: 'wallet_transactions',   singleton: false, order: { col: 'created_at', asc: false } },
  'lib-subscription-plans':    { table: 'subscription_plans',    singleton: false },
  'lib-student-subscriptions': { table: 'student_subscriptions', singleton: false },
  'lib-gateway-config':        { table: 'gateway_config',        singleton: true  },
  'lib-gateway-logs':          { table: 'gateway_logs',          singleton: false, order: { col: 'created_at', asc: false } },
  'lib-admin-charges':         { table: 'admin_charges',         singleton: false, order: { col: 'created_at', asc: false } },
};
