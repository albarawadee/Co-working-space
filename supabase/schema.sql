-- ============================================================================
-- Smart Vision System — Complete Database Schema
-- Generated from live database on 2026-05-09
-- Supabase (PostgreSQL) — Project: co-working-space
-- ============================================================================
--
-- HOW TO USE:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor in the Supabase Dashboard
-- 3. Paste this entire file and run it
-- 4. Deploy the staff-manager Edge Function (see supabase/functions/)
-- 5. Enable Realtime on kitchen_orders table (Dashboard → Database → Replication)
-- 6. Update .env with your new project's URL and anon key
--
-- NOTE: RLS is disabled on most tables (open access). Some tables have RLS
--       enabled with permissive "allow all" policies for compatibility.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. SINGLETON TABLES (single-row config)
-- ────────────────────────────────────────────────────────────────────────────

-- App Configuration
CREATE TABLE IF NOT EXISTS app_config (
  id               text        PRIMARY KEY DEFAULT 'singleton',
  name             text        NOT NULL DEFAULT 'Smart Vision',
  capacity         integer     NOT NULL DEFAULT 50,
  wifi_name        text        NOT NULL DEFAULT 'Smart-Vision-WiFi',
  currency         text        NOT NULL DEFAULT 'ج.م',
  open_time        text        NOT NULL DEFAULT '08:00',
  close_time       text        NOT NULL DEFAULT '24:00',
  universities     jsonb       DEFAULT '[]'::jsonb,
  colleges         jsonb       DEFAULT '[]'::jsonb,
  mikrotik_bridge_url    text DEFAULT '',
  mikrotik_bridge_secret text DEFAULT '',
  -- WiFi v2 (migration 20260520000000_wifi_v2_foundations.sql)
  wifi_v2_enabled         boolean DEFAULT false,
  whatsapp_support_number text,
  bridge_url_v2           text,
  bridge_secret_v2        text
);

-- App Pricing
CREATE TABLE IF NOT EXISTS app_pricing (
  id               text        PRIMARY KEY DEFAULT 'singleton',
  hourly           numeric     NOT NULL DEFAULT 15,
  half_day         numeric     NOT NULL DEFAULT 50,
  half_day_hours   integer     NOT NULL DEFAULT 5,
  full_day         numeric     NOT NULL DEFAULT 80,
  hour_tiers       jsonb       DEFAULT '[]'::jsonb,
  extra_hour_rate  numeric     DEFAULT 10,
  grace_minutes    numeric     DEFAULT 10,
  special_offers   jsonb       DEFAULT '[]'::jsonb,
  free_minutes     numeric     DEFAULT 15
);

-- MikroTik Gateway Configuration
CREATE TABLE IF NOT EXISTS gateway_config (
  id               text        PRIMARY KEY DEFAULT 'singleton',
  url              text        DEFAULT '',
  method           text        DEFAULT 'POST',
  auth_header      text        DEFAULT '',
  disconnect_path  text        DEFAULT '/disconnect',
  reconnect_path   text        DEFAULT '/reconnect',
  enabled          boolean     DEFAULT false
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- Staff
CREATE TABLE IF NOT EXISTS staff (
  id               text        PRIMARY KEY,
  username         text        NOT NULL UNIQUE,
  password         text        NOT NULL,
  role             text        NOT NULL,    -- 'admin' | 'cashier' | 'kitchen' | 'employee' | 'worker'
  name             text        NOT NULL,
  active           boolean     DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  display_name     text,
  auth_id          uuid                     -- links to Supabase Auth user
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id                 text        PRIMARY KEY,
  student_id         text        NOT NULL UNIQUE,  -- format: 'LIB-XXXXX'
  name               text        NOT NULL,
  phone              text        DEFAULT '',
  member_number      text        DEFAULT '',        -- user-facing number
  email              text        DEFAULT '',
  tags               jsonb       DEFAULT '[]'::jsonb,
  notes              text        DEFAULT '',
  wallet_balance     numeric     DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  university         text,
  college            text,
  academic_year      text,
  nationality        text        DEFAULT '',
  wifi_max_devices   integer     DEFAULT 2,
  wifi_speed_profile text        DEFAULT 'svs-normal',
  wifi_data_limit_mb integer     DEFAULT 0
);

-- Sessions (check-in / check-out)
CREATE TABLE IF NOT EXISTS sessions (
  id                    text        PRIMARY KEY,
  student_id            text        NOT NULL,
  student_name          text        NOT NULL,
  student_phone         text        DEFAULT '',
  check_in_time         timestamptz NOT NULL,
  type                  text        NOT NULL DEFAULT 'regular',
  status                text        NOT NULL DEFAULT 'active',  -- 'active' | 'closed'
  check_out_time        timestamptz,
  invoice_id            text,
  created_at            timestamptz DEFAULT now(),
  checked_in_by         text,       -- staff_id of cashier
  checked_out_by        text,       -- staff_id of cashier
  student_member_number text        DEFAULT '',
  tags                  jsonb       DEFAULT '[]'::jsonb,
  notes                 text        DEFAULT ''
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id               text        PRIMARY KEY,
  session_id       text,
  student_id       text,
  student_name     text        DEFAULT '',
  minutes          integer     DEFAULT 0,
  price_type       text,
  pricing_label    text,
  amount           numeric     DEFAULT 0,          -- session charge
  kitchen_total    numeric     DEFAULT 0,          -- kitchen orders total
  total            numeric     DEFAULT 0,          -- amount + kitchen_total
  billing_type     text        DEFAULT 'normal',   -- 'normal' | 'subscription'
  subscription_id  text,
  payment_method   text,                           -- 'cash' | 'transfer' | 'instapay' | 'owner' | 'wallet' | 'admin' | null
  owner_id         text,
  cashier_id       text,
  created_at       timestamptz DEFAULT now(),
  discount_id      text,
  discount_label   text,
  discount_amount  numeric     DEFAULT 0,
  shift_id         text,
  in_custody       boolean     DEFAULT false         -- true = cash held by kitchen, excluded from drawer until handover confirmed
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id                    text        PRIMARY KEY,
  cashier_id            text,
  cashier_name          text,
  start_time            timestamptz DEFAULT now(),
  end_time              timestamptz,
  starting_cash         numeric     DEFAULT 0,
  expected_starting_cash numeric,
  start_shortage        numeric     DEFAULT 0,
  start_note            text        DEFAULT '',
  expected_cash         numeric,
  actual_cash           numeric,
  shortage              numeric     DEFAULT 0,
  shortage_justified    boolean     DEFAULT false,
  shortage_note         text        DEFAULT '',
  status                text        DEFAULT 'active',  -- 'active' | 'closed'
  created_at            timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. KITCHEN / PRODUCTS
-- ────────────────────────────────────────────────────────────────────────────

-- Product Categories
CREATE TABLE IF NOT EXISTS categories (
  id               text        PRIMARY KEY,
  name             text        NOT NULL,
  emoji            text        DEFAULT '',
  color            text        DEFAULT 'gray',
  created_at       timestamptz DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id                  text        PRIMARY KEY,
  category_id         text,
  name                text        NOT NULL,
  price               numeric     NOT NULL DEFAULT 0,
  cost_price          numeric     DEFAULT 0,
  available           boolean     DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  track_stock         boolean     DEFAULT false,
  stock_qty           integer     DEFAULT 0,
  low_stock_threshold integer     DEFAULT 5,
  unit_type           text        DEFAULT 'piece',  -- 'piece' | 'kg' | 'liter'
  sub_unit_ratio      numeric     DEFAULT 1,        -- sell-units per bulk unit
  sub_unit_name       text        DEFAULT '',
  recipe_cost         numeric     DEFAULT 0,         -- ingredient cost per sellable unit
  ingredient_only     boolean     DEFAULT false       -- raw material, hidden from order menus
);

-- Kitchen Orders
CREATE TABLE IF NOT EXISTS kitchen_orders (
  id               text        PRIMARY KEY,
  student_id       text,
  student_name     text        DEFAULT '',
  session_id       text,
  items            jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- inner keys are camelCase
  total            numeric     DEFAULT 0,
  status           text        NOT NULL DEFAULT 'pending',    -- 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  note             text        DEFAULT '',
  staff_id         text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz,
  seat_number      text,
  hall             text,                                      -- lecture hall name (nullable)
  order_type       text,                                      -- 'cowork' | 'hall' | 'guest' (nullable)
  self_service     boolean     DEFAULT false,
  cost_total       numeric     DEFAULT 0,                     -- sum of ingredient costs
  paid             boolean     DEFAULT false,
  invoice_id       text,                                      -- linked invoice for reversal on cancel
  payment_method   text                                       -- 'cash' | 'transfer' | 'instapay' | 'debt'
);

-- Stock Movements (inventory tracking)
CREATE TABLE IF NOT EXISTS stock_movements (
  id               text        PRIMARY KEY,
  product_id       text        NOT NULL,
  product_name     text        NOT NULL,
  type             text        NOT NULL,  -- 'received' | 'order' | 'cancel' | 'adjustment' | 'waste'
  delta            integer     NOT NULL,
  stock_after      integer     NOT NULL,
  note             text        DEFAULT '',
  staff_id         text,
  created_at       timestamptz DEFAULT now()
);

-- Product Recipes (ingredient composition for composite products)
CREATE TABLE IF NOT EXISTS product_recipes (
  id               text        PRIMARY KEY,
  product_id       text        NOT NULL,       -- the composite product
  ingredient_id    text        NOT NULL,       -- raw ingredient product
  quantity         numeric     NOT NULL,       -- sub-units of ingredient per 1 product unit
  created_at       timestamptz DEFAULT now()
);

-- Custody Handovers (kitchen-to-cashier cash transfer protocol)
CREATE TABLE IF NOT EXISTS custody_handovers (
  id               text        PRIMARY KEY,
  staff_id         text        NOT NULL,       -- kitchen staff handing over
  staff_name       text        NOT NULL,
  amount           numeric     NOT NULL,
  order_ids        jsonb       DEFAULT '[]'::jsonb,  -- which orders are included
  status           text        DEFAULT 'pending',    -- 'pending' | 'confirmed' | 'rejected'
  cashier_id       text,                             -- who confirmed
  cashier_name     text,
  shift_id         text,                             -- which shift received the money
  note             text        DEFAULT '',
  created_at       timestamptz DEFAULT now(),
  confirmed_at     timestamptz
);

-- Add custody columns to kitchen_orders
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS custody_holder_id text;  -- who physically holds the cash
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS paid_by text;            -- who collected payment

-- Add soft-delete + audit columns to kitchen_orders
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS staff_name    text;          -- who created the order (denormalized)
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS deleted_by      text;          -- staff ID who deleted
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS deleted_by_name text;          -- staff name who deleted
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS deleted_at      timestamptz;   -- when deleted
-- status now also supports 'deleted' alongside 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

-- ────────────────────────────────────────────────────────────────────────────
-- 4. FINANCIAL TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id               text        PRIMARY KEY,
  description      text        NOT NULL,
  amount           numeric     NOT NULL,
  category         text        DEFAULT '',
  date             date        NOT NULL,
  payment_method   text,
  shift_id         text,
  staff_id         text,
  created_at       timestamptz DEFAULT now()
);

-- Center Expenses (isolated — NOT wired into calcDrawerExpected or any drawer/shift/revenue view)
-- Read only by src/views/admin/CenterExpenses.jsx. Never aggregate elsewhere.
CREATE TABLE IF NOT EXISTS center_expenses (
  id               text        PRIMARY KEY,
  amount           numeric     NOT NULL,
  category         text        NOT NULL,
  description      text        NOT NULL,
  spent_by_id      text        DEFAULT '',
  spent_by_name    text        DEFAULT '',
  date             date        NOT NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS center_expenses_date_idx       ON center_expenses (date DESC);
CREATE INDEX IF NOT EXISTS center_expenses_created_at_idx ON center_expenses (created_at DESC);

-- Debts (borrow / repay tracking)
CREATE TABLE IF NOT EXISTS debts (
  id               text        PRIMARY KEY,
  person_id        text,
  person_name      text,
  person_type      text,                   -- 'staff' | 'student'
  amount           numeric,
  type             text,                   -- 'borrow' | 'repay'
  note             text,
  cashier_id       text,
  cashier_name     text,
  created_at       timestamptz DEFAULT now(),
  invoice_id       text,
  source           text        DEFAULT 'drawer',  -- 'drawer' | 'kitchen' | 'session' | 'legacy'
  in_custody       boolean     DEFAULT false      -- true = repay's cash held by kitchen, excluded from drawer until handover confirmed
);

-- Admin Charges (staff-owed amounts from sessions)
CREATE TABLE IF NOT EXISTS admin_charges (
  id               text        PRIMARY KEY,
  admin_id         text        NOT NULL,
  admin_name       text        NOT NULL,
  invoice_id       text,
  session_id       text,
  student_name     text        DEFAULT '',
  amount           numeric     NOT NULL DEFAULT 0,
  note             text        DEFAULT '',
  settled          boolean     DEFAULT false,
  settled_at       timestamptz,
  created_at       timestamptz DEFAULT now(),
  source           text        DEFAULT 'session'  -- 'session' | 'kitchen'
);

-- Admin Collections (cash moved to safe)
CREATE TABLE IF NOT EXISTS admin_collections (
  id               text        PRIMARY KEY,
  admin_id         text,
  admin_name       text,
  staff_id         text,
  staff_name       text,
  amount           numeric,
  note             text,
  created_at       timestamptz DEFAULT now()
);

-- Safe Transactions
CREATE TABLE IF NOT EXISTS safe_transactions (
  id               text        PRIMARY KEY,
  shift_id         text,
  type             text,       -- 'withdrawal'
  amount           numeric,
  admin_id         text,
  admin_name       text,
  note             text        DEFAULT '',
  created_at       timestamptz DEFAULT now()
);

-- Cash Adjustments (manual drawer corrections)
CREATE TABLE IF NOT EXISTS cash_adjustments (
  id               text        PRIMARY KEY,
  amount           numeric     DEFAULT 0,
  note             text        DEFAULT '',
  created_at       timestamptz DEFAULT now(),
  created_by       text        DEFAULT ''
);

-- Deposits (money added to owner accounts)
CREATE TABLE IF NOT EXISTS deposits (
  id               text        PRIMARY KEY,
  owner_id         text        NOT NULL,
  owner_name       text        NOT NULL,
  student_id       text,
  student_name     text        DEFAULT '',
  amount           numeric     NOT NULL,
  note             text        DEFAULT '',
  staff_id         text        DEFAULT '',
  created_at       timestamptz DEFAULT now()
);

-- Owners (pre-paid parent/sponsor accounts)
CREATE TABLE IF NOT EXISTS owners (
  id               text        PRIMARY KEY,
  name             text        NOT NULL,
  phone            text        DEFAULT '',
  notes            text        DEFAULT '',
  balance          numeric     DEFAULT 0,
  student_ids      jsonb       DEFAULT '[]'::jsonb,  -- array of linked student IDs
  created_at       timestamptz DEFAULT now()
);

-- Wallet Transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id               text        PRIMARY KEY,
  student_id       text        NOT NULL,
  student_name     text        NOT NULL,
  type             text        NOT NULL,   -- 'topup' | 'deduct'
  amount           numeric     NOT NULL,
  balance_before   numeric     NOT NULL,
  balance_after    numeric     NOT NULL,
  note             text        DEFAULT '',
  invoice_id       text,
  staff_id         text        DEFAULT '',
  created_at       timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────────────────────

-- Subscription Plans (templates)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id               text        PRIMARY KEY,
  name             text        NOT NULL,
  quota_type       text        NOT NULL DEFAULT 'hours',  -- 'hours' | 'days'
  quota            integer     NOT NULL,
  validity_days    integer     NOT NULL,
  price            numeric     NOT NULL,
  active           boolean     DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- Student Subscriptions (active assignments)
CREATE TABLE IF NOT EXISTS student_subscriptions (
  id               text        PRIMARY KEY,
  student_id       text        NOT NULL,
  student_name     text        NOT NULL,
  plan_id          text        NOT NULL,
  plan_name        text        NOT NULL,
  quota_type       text        NOT NULL,
  total_quota      integer     NOT NULL,
  remaining_quota  integer     NOT NULL,
  used_dates       jsonb       DEFAULT '[]'::jsonb,
  start_date       date        NOT NULL,
  expiry_date      date        NOT NULL,
  status           text        NOT NULL DEFAULT 'active',  -- 'active' | 'exhausted' | 'expired'
  activated_by     text        DEFAULT '',
  created_at       timestamptz DEFAULT now(),
  validity_days    integer,
  subscription_id  text
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. PAYROLL
-- ────────────────────────────────────────────────────────────────────────────

-- Salary Configurations
CREATE TABLE IF NOT EXISTS salary_configs (
  id               text        PRIMARY KEY,
  staff_id         text        NOT NULL,
  staff_name       text,
  base_salary      numeric     DEFAULT 0,
  overtime_rate    numeric     DEFAULT 0,
  notes            text,
  updated_at       timestamptz DEFAULT now()
);

-- Payroll Entries
CREATE TABLE IF NOT EXISTS payroll_entries (
  id               text        PRIMARY KEY,
  staff_id         text        NOT NULL,
  staff_name       text,
  type             text        NOT NULL,   -- 'salary' | 'bonus' | 'deduction' | 'advance'
  month            text        NOT NULL,   -- e.g. '2026-05'
  date             text,
  hours            numeric     DEFAULT 0,
  amount           numeric     DEFAULT 0,
  note             text,
  created_by       text,
  created_at       timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. LOGGING & SECURITY
-- ────────────────────────────────────────────────────────────────────────────

-- Daily Activity Logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id               text        PRIMARY KEY,
  action           text        NOT NULL,
  details          text        DEFAULT '',
  staff_id         text        DEFAULT '',
  "timestamp"      timestamptz DEFAULT now()
);

-- Gateway Logs (MikroTik bridge)
CREATE TABLE IF NOT EXISTS gateway_logs (
  id               text        PRIMARY KEY,
  action           text        NOT NULL,
  payload          jsonb       DEFAULT '{}'::jsonb,
  success          boolean     DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- Login Attempts (brute force protection — used by edge function only)
CREATE TABLE IF NOT EXISTS login_attempts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text        NOT NULL,
  success          boolean     NOT NULL DEFAULT false,
  ip_address       text,
  attempted_at     timestamptz NOT NULL DEFAULT now()
);

-- Student Backups (auto-backup snapshots)
CREATE TABLE IF NOT EXISTS student_backups (
  id               text        PRIMARY KEY,
  snapshot         jsonb       NOT NULL,
  student_count    integer     NOT NULL DEFAULT 0,
  "trigger"        text        NOT NULL DEFAULT 'manual',  -- 'manual' | 'auto'
  note             text        DEFAULT '',
  created_by       text,
  created_at       timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 7b. WIFI v2 — additive parallel system (migration 20260520000000)
-- ────────────────────────────────────────────────────────────────────────────
-- Built alongside the v1 wifi_* tables. v1 keeps running daily; v2 is opt-in
-- via app_config.wifi_v2_enabled. See WIFI-SYSTEM.md §14.

CREATE TABLE IF NOT EXISTS wifi_devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mac           text NOT NULL,
  username      text NOT NULL,             -- member_number or WIFI-* voucher username
  ip            text,
  device_id     text,                      -- browser fingerprint
  user_agent    text,
  hostname      text,
  first_seen    timestamptz DEFAULT now(),
  last_seen     timestamptz DEFAULT now(),
  banned        boolean DEFAULT false,
  banned_by     text REFERENCES staff(id),  -- staff.id is text, not uuid
  banned_reason text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wifi_profiles_v2 (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text UNIQUE NOT NULL,
  label_ar            text NOT NULL,
  label_en            text NOT NULL,
  download_mbps       numeric NOT NULL,
  upload_mbps         numeric NOT NULL,
  max_devices         int     NOT NULL DEFAULT 2,
  applies_to          text    NOT NULL DEFAULT 'normal',  -- 'normal' | 'staff' | 'voucher'
  locked              boolean DEFAULT false,
  description         text,
  -- Advanced RouterOS hotspot user-profile fields (Phase 5)
  mac_cookie_timeout  text,
  idle_timeout        text,
  keepalive_timeout   text,
  session_timeout     text,
  transparent_proxy   boolean DEFAULT false,
  status_autorefresh  text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wifi_realtime_events (
  id          bigserial PRIMARY KEY,
  event_type  text NOT NULL,
  target      text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      text DEFAULT 'bridge-v2',
  created_at  timestamptz DEFAULT now()
);

-- Per-user profile pin (admin can fix a profile to a specific student/staff)
ALTER TABLE students ADD COLUMN IF NOT EXISTS wifi_profile_id uuid REFERENCES wifi_profiles_v2(id);
ALTER TABLE staff    ADD COLUMN IF NOT EXISTS wifi_profile_id uuid REFERENCES wifi_profiles_v2(id);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. INDEXES
-- ────────────────────────────────────────────────────────────────────────────

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS sessions_check_in_time_idx ON sessions (check_in_time);
CREATE INDEX IF NOT EXISTS sessions_cashier_id_idx ON sessions (checked_in_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_one_active_per_student
  ON sessions (student_id) WHERE (status = 'active');

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices (created_at);
CREATE INDEX IF NOT EXISTS invoices_shift_id_idx ON invoices (shift_id);

-- Debts
CREATE INDEX IF NOT EXISTS debts_person_id_idx ON debts (person_id);
CREATE INDEX IF NOT EXISTS debts_cashier_id_idx ON debts (cashier_id);

-- Daily Logs
CREATE INDEX IF NOT EXISTS idx_daily_logs_ts ON daily_logs ("timestamp" DESC);

-- Login Attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time
  ON login_attempts (username, attempted_at DESC);

-- Student Subscriptions
CREATE INDEX IF NOT EXISTS idx_student_subs_student ON student_subscriptions (student_id);

-- Student Backups
CREATE INDEX IF NOT EXISTS student_backups_created_at_idx ON student_backups (created_at DESC);

-- WiFi v2
CREATE UNIQUE INDEX IF NOT EXISTS uq_wifi_devices_mac_user ON wifi_devices(mac, username);
CREATE INDEX IF NOT EXISTS idx_wifi_devices_username       ON wifi_devices(username);
CREATE INDEX IF NOT EXISTS idx_wifi_devices_mac            ON wifi_devices(mac);
CREATE INDEX IF NOT EXISTS idx_wifi_devices_last_seen      ON wifi_devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_wifi_rt_events_created      ON wifi_realtime_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wifi_rt_events_target       ON wifi_realtime_events (target, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 9. ROW-LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────────────────────
-- Most tables have RLS disabled (open access via anon key).
-- The following tables have RLS enabled with permissive "allow all" policies.
-- This is required because Supabase blocks anon access when RLS is enabled
-- without a matching policy.

ALTER TABLE admin_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON admin_collections FOR ALL USING (true);

ALTER TABLE cash_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_adjustments_open" ON cash_adjustments FOR ALL USING (true);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON debts FOR ALL USING (true);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to deposits" ON deposits FOR ALL USING (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to expenses" ON expenses FOR ALL USING (true);

ALTER TABLE center_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to center_expenses" ON center_expenses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- login_attempts has NO policy — only accessible via service_role (edge function)

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to owners" ON owners FOR ALL USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 10. REALTIME
-- ────────────────────────────────────────────────────────────────────────────
-- Enable Realtime on all tables used by useSupabaseTable for cross-device sync.
-- Without this, changes made by one cashier won't appear on another device.
-- Run this in the SQL Editor AFTER creating tables:

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE sessions;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE students;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoices;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE kitchen_orders;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE staff;                 EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE shifts;                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE debts;                 EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE expenses;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE center_expenses;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE admin_charges;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE admin_collections;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE safe_transactions;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE cash_adjustments;      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE custody_handovers;     EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE student_subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE deposits;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stock_movements;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE products;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE categories;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE app_config;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE app_pricing;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE daily_logs;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE product_recipes;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. SEED DATA (singletons)
-- ────────────────────────────────────────────────────────────────────────────
-- Insert default singleton rows so the app doesn't crash on first load.

INSERT INTO app_config (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;
INSERT INTO app_pricing (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;
INSERT INTO gateway_config (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- WiFi v2 default profiles
INSERT INTO wifi_profiles_v2 (name, label_ar, label_en, download_mbps, upload_mbps, max_devices, applies_to, locked, description)
VALUES
  ('svs-v2-normal',  'عادي', 'Normal',  10, 2,  2, 'normal',  true, 'Default member access — 10 Mbps down / 2 Mbps up, 2 devices'),
  ('svs-v2-staff',   'موظف', 'Staff',   25, 10, 4, 'staff',   true, 'Staff and admin access — higher throughput, 4 devices'),
  ('svs-v2-voucher', 'زائر', 'Voucher',  5, 1,  1, 'voucher', true, 'Time-limited voucher access — single device')
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. INITIAL ADMIN ACCOUNT
-- ────────────────────────────────────────────────────────────────────────────
-- After running this schema:
-- 1. Deploy the staff-manager Edge Function
-- 2. Use the Edge Function to create a Supabase Auth user
-- 3. Insert a staff row linking to that auth_id
--
-- Or manually insert a bootstrap admin (password handled by Supabase Auth):
--
-- INSERT INTO staff (id, username, password, role, name, active, auth_id)
-- VALUES ('stf-admin', 'admin', '', 'admin', 'المدير', true, '<auth-user-uuid>');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
