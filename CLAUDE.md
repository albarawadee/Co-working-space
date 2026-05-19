# Smart Vision System — CLAUDE.md

> **This file is the single source of truth for AI assistants modifying this codebase.**
> Read it fully before making ANY change. Violating these rules WILL break the app.

## Self-Updating Rule (MANDATORY)

**After completing ANY task that changes the codebase, you MUST update this CLAUDE.md file to reflect those changes.** This is non-negotiable. Examples:

- Added a new view? → Update the View Registry table and the Adding a New View checklist if the process changed
- Added/renamed a STORAGE_KEY? → Update the Data Model section and the dependency chain if affected
- Changed the financial formula? → Update the uncollectedBalance documentation
- Added a new Supabase table? → Add it to the Data Model table
- Added a new shared component? → Update the Shared Components table
- Changed a util function signature? → Update the Async Functions or relevant section
- Added a new hook? → Add it to Core Infrastructure table
- Changed sharedProps? → Update Rule 4
- Added a new payment method? → Update the invoice table docs and Common Pitfalls
- Fixed a bug caused by a pattern? → Add it to Common Pitfalls so it never recurs
- Changed the database schema (added/removed/renamed a table or column, added an index, changed defaults, modified RLS)? → Update `supabase/schema.sql` to match

**What to update**: Only the sections directly affected by your change. Do not rewrite unrelated sections.
**When to update**: At the end of the task, after verifying the code works, before presenting results to the user.

## Ripple-Effect Rule (MANDATORY)

**When modifying ANY value, display, or data flow — you MUST trace and update all connected usages.** Do not change something in isolation. Examples:

- Changed a computed value (e.g. `walletBalance`)? → Find every UI element that displays it and update them to reflect the new state
- Added a settlement/payment that changes balance? → Every section that shows that balance (wallet info, underpayment warning, change-to-wallet) must use the post-settlement value
- Modified a state variable's meaning? → Every `if` check, display, and write that references it must be reviewed
- Added a new data source (e.g. debts at checkout)? → Check if existing UI sections need to react to it

**How**: Search the file for the variable/value name. Read every usage. Decide the best update for each based on what that section does. Do not leave stale references.

## Communication Language

**Always reply in English.** Even if the user writes in Arabic or another language, all explanations, summaries, and discussions must be in English. Code comments and UI strings remain in Arabic as per the app's RTL design.

## Project Overview

Library/study-hall POS system (Arabic RTL). React 18 + Vite + Tailwind CSS + Supabase (PostgreSQL).
Three user roles: **admin**, **cashier**, **kitchen**. No router — views are swapped via `VIEW_MAP` in `App.jsx`.

---

## Critical Architecture — The Dependency Chain

```
constants/index.js          (STORAGE_KEYS, MENU, defaults)
       ↓
lib/tableMap.js             (STORAGE_KEY string → Supabase table name)
       ↓
lib/fieldMaps.js            (toCamel / toSnake — DB ↔ JS key conversion)
       ↓
lib/supabaseClient.js       (singleton Supabase client)
       ↓
hooks/useSupabaseTable.js   (THE core data hook — all reads/writes go through here)
       ↓
hooks/useStorage.js         (re-exports useSupabaseTable as useStorage)
       ↓
App.jsx                     (loads global stores, computes uncollectedBalance, passes sharedProps)
       ↓
views/*                     (consume useStorage + sharedProps + utils)
```

**If you break any link in this chain, the entire app breaks.**

---

## The 5 Rules That Prevent Cascading Breakage

### Rule 1: STORAGE_KEYS ↔ TABLE_MAP Must Stay in Sync

Every `STORAGE_KEYS.X` string MUST have a matching entry in `lib/tableMap.js`.
- Adding a new storage key? Add the table mapping too. Always.
- Renaming a key string? Update BOTH files AND every file that references it.
- The key strings (e.g. `'lib-students'`) are used as localStorage keys AND as lookup keys into TABLE_MAP.

### Rule 2: Field Name Convention — camelCase in JS, snake_case in DB

- `toCamel()` converts DB rows → JS objects (top-level keys only)
- `toSnake()` converts JS objects → DB rows (top-level keys only)
- JSONB columns (like `items` in kitchen_orders) are NOT converted — their inner keys stay as-is
- **When writing direct Supabase queries** (not through useStorage), you must manually call `toSnake()` before insert/upsert and `toCamel()` after select
- Common mistake: mixing `student_id` and `studentId` in the same object. Pick one context and be consistent.

### Rule 3: useStorage is the ONLY Way to Read/Write Persistent Data

```js
const [data, save, refresh, loading] = useStorage(STORAGE_KEYS.X, defaultValue);
```

- `save(newArray)` or `save(prev => [...prev, newItem])` — diffs against snapshot, upserts changes, deletes removed rows
- `save` has a **mass-deletion guard**: blocks if you'd delete >5 rows or >30% of data. This protects against stale-state bugs.
- `save` waits for initial load before allowing writes. Never save before data is loaded.
- `refresh()` re-fetches from Supabase
- The hook also subscribes to Supabase Realtime for live updates
- **NEVER bypass this hook** with raw `supabase.from().insert()` for data that's also managed by useStorage in the same component — it will cause state desync

Exception: Fire-and-forget writes (like `logActivity`, checkout writes in `CheckoutModal`) that write to tables NOT currently held in a useStorage hook in that component are fine to do directly.

### Rule 4: sharedProps Contract — What Every View Receives

```js
const sharedProps = { user, toast, config, setActiveView, uncollectedBalance, onStudentClick };
```

Every view component in VIEW_MAP receives these props via `<ActiveView {...sharedProps} />`.

- `user` — `{ id, name, username, role, active, createdAt }` (camelCase, from staff table)
- `toast(message, type)` — type: `'info'` | `'success'` | `'error'`
- `config` — singleton from `app_config` table (library name, capacity, currency, etc.)
- `setActiveView(viewKey)` — **guarded** navigation; rejects views not in `ROLE_VIEWS[user.role]` with error toast
- `uncollectedBalance` — computed cash amount in App.jsx (complex formula, see below)
- `onStudentClick(studentId)` — opens the StudentProfileModal

**Do NOT add props to sharedProps without updating App.jsx AND confirming no view destructures unexpected props.**

### Rule 5: The Financial Formula — uncollectedBalance

The drawer expected cash formula lives in a **single shared function**: `calcDrawerExpected()` in `src/utils/index.js`. It is called by:
- `App.jsx` — sidebar `uncollectedBalance` (global scope, `startExclusive: true`)
- `cashier/Log.jsx` — active shift expected cash (shift scope with `shiftId` + `cashierId`)
- `admin/Shifts.jsx` — `getShiftStats()` for active & closed shifts (shift scope with `shiftId` + `cashierId` + `end`)

**Formula**: `startingCash + income - outflow`

Where:
- `startingCash` = actualCash from the most recent closed shift (global) or shift.startingCash (shift scope)
- `start` = endTime of last closed shift (global) or shift.startTime (shift scope)
- Income (after start): cash invoices (`!inCustody`) + deposits + debt repayments (`!inCustody`) + cash adjustments + settled admin charges (keyed on `settledAt`)
- Outflow (after start): non-student/non-kitchen borrows + cash expenses + collections + safe withdrawals

**Admin charges always use `settledAt`** (when cash was actually collected), never `createdAt`.

**Tables involved**: invoices, shifts, deposits, debts, expenses, cash_adjustments, admin_charges, safe_transactions, admin_collections

> If you modify ANY of these tables' schemas, payment flows, or how records are created — **you MUST verify the `calcDrawerExpected` function still works correctly**. Since it's shared, a single fix applies everywhere.

### Rule 6: Wallet ≥ 0 Invariant — Debts table is the only source of truth for what students owe

`students.wallet_balance` must always be `>= 0`. Student debts live in **one place**: the `debts` table with `personType: 'student'`. The old pattern of using a negative wallet balance to represent debt is **removed**.

**Implication for every code path that takes cash from a student:**
- A topup (any "money in" event) MUST call `settleStudentDebts()` from `src/utils/index.js`. The helper applies cash against outstanding debts (oldest first) and routes any remainder to the wallet. Drawer accounting: helper writes `debts.repay` rows (counted in `calcDrawerExpected.repayments`) + an optional `wallet_transactions.topup` (NOT counted) — caller is responsible for the `students.update({ wallet_balance })` write and for emitting a topup `invoice` only for the `walletAdded` portion (the cash that went to wallet, NOT the cash that paid debts — that would double-count drawer income).
- A debt (any "money owed" event) MUST insert a `debts` row with the correct `source` value. NEVER reduce `students.wallet_balance` below 0.

**Debt sources** (`debts.source` column):
- `'session'` — session underpayment at checkout (`CheckoutModal.jsx`)
- `'kitchen'` — kitchen order debt (student underpayment for kitchen items, staff kitchen orders)
- `'legacy'` — auto-converted from the pre-refactor negative-wallet model (one-time migration)
- `'drawer'` (default) — generic borrow that affects drawer balance
- Subscription installments leave `source` null/default (counted as student debt, neutral to drawer until repaid)

**Debt note convention** — each debt row must carry enough context to identify what was owed:
- Session debt: `"دين جلسة — ${formatDate(checkInTime)} - ${formatTime(checkInTime)}"`
- Kitchen debt: `"دين مطبخ — ${items.map(i => i.productName + '×' + i.qty).join('، ')}"`
- Subscription installment: `"قسط اشتراك — ${planName} (دفع ${paid} من ${total})"`

If both session and kitchen are underpaid at checkout, write **two** debt rows (one per source) so each carries its own detailed note.

---

## File-by-File Reference

### Core Infrastructure

| File | Purpose | Danger Level |
|------|---------|-------------|
| `src/constants/index.js` | STORAGE_KEYS, MENU definitions, DEFAULT_*, NATIONALITIES, ROLE_VIEWS, icon imports | HIGH — Menu/key changes cascade everywhere |
| `src/lib/tableMap.js` | Maps STORAGE_KEY strings → `{ table, singleton, order? }` | HIGH — Must match constants AND Supabase schema |
| `src/lib/fieldMaps.js` | `toCamel()` / `toSnake()` key converters | HIGH — Breaks all DB I/O if modified |
| `src/lib/supabaseClient.js` | Singleton `createClient(url, key)` | LOW — Rarely needs changes |
| `src/lib/offlineQueue.js` | Queues failed writes, auto-flushes on reconnect | MEDIUM |
| `src/lib/mikrotikApi.js` | WiFi router bridge API (~25 functions: user mgmt, profiles, blocking, sessions, stats, events) | MEDIUM — Fire-and-forget, never throws |
| `src/hooks/useSupabaseTable.js` | Core data hook: fetch, save (with diff), Realtime subscription | CRITICAL — Touch with extreme care |
| `src/hooks/useStorage.js` | Re-exports useSupabaseTable as useStorage | LOW — Just an alias |
| `src/hooks/useToast.js` | Toast notification state manager | LOW |
| `src/hooks/useLiveTimer.js` | Interval-based re-render trigger (for live elapsed times) | LOW |
| `src/hooks/useIdleTimeout.js` | Auto-logout after 30 min idle; warns 5 min before; defers when `hasInFlight()` is true so in-flight writes finish | LOW |
| `src/hooks/useSubmitLock.js` | `useRef`-backed sync double-submit guard. `useSubmitLock() → { run, isLocked }`; second call to `run` while in-flight returns `{ skipped: true }` synchronously. Use on every money-touching submit handler. | MEDIUM — Wrong call sites can leave races; correct call sites prevent duplicate writes |
| `src/hooks/useInFlightTracker.js` | Global counter of pending financial write batches: `beginWrite() / endWrite() / hasInFlight()` + `trackedWrites(promises)` wrapper around `Promise.all`. Used by `useIdleTimeout` to defer sign-out while writes are landing. | MEDIUM — Mis-balanced begin/end can stick the idle-timeout forever; prefer `trackedWrites()` which auto-pairs |
| `src/utils/index.js` | generateId, generateStudentId (async!), formatTime/Date, calcBestPrice, calcDrawerExpected, settleStudentDebts, logActivity, getActiveSubscription, resolveSubscriptionBilling, checkActiveSession, searchStudents, exportCSV, computeRecipeStockChanges, isActiveOrder | HIGH — Many views depend on these |
| `src/utils/devInit.js` | Seeds localStorage with defaults when Supabase is not configured | LOW |

### Layout

| File | Purpose |
|------|---------|
| `src/App.jsx` | Root component: auth, VIEW_MAP, global stores, uncollectedBalance, sharedProps |
| `src/layout/Sidebar.jsx` | Navigation sidebar (reads MENU from constants, shows uncollectedBalance) |
| `src/layout/LoginScreen.jsx` | Supabase Auth login (email = `username@smartvision.internal`) |
| `src/main.jsx` | Entry point: hash routing for `#portal` / `#order`, offline queue init |
| `src/views/portal/PortalChrome.jsx` | `PortalChromeProvider` + `usePortalChrome()` context (lang / theme / **navigate** / t / dir). Also exports the standalone `viewTransition(kind, fn)` helper (`kind`: `'theme' \| 'lang' \| 'nav' \| 'nav-back'`) for components outside the provider (e.g. `WiFiPortal.jsx`). `navigate(fn, 'forward' \| 'back')` wraps any state-changing fn in a View Transitions API swap so screen-to-screen navigation animates smoothly. CSS keyframes (`vtNavOut/In`, `vtNavBackOut/In`) live in `src/index.css`. `WiFiPortal.jsx`'s root carries the `.wifi-portal-root` class so it participates in the same `portal-root` view-transition-name as `.portal-v2`. |

### Shared Components

| File | Exports |
|------|---------|
| `src/components/ui/index.js` | Modal, ToastContainer, Input, Select, Textarea, SearchableSelect, StatCard, Badge, SearchInput, ConfirmDialog |
| `src/components/ui/FormFields.jsx` | Input, Select, Textarea, SearchableSelect |
| `src/components/StudentProfileModal.jsx` | Full student profile viewer (opened via `onStudentClick`) |
| `src/components/SessionDetailModal.jsx` | Session drill-down modal: pricing, payment, kitchen orders, wallet txs, debts (opened via row click in Log/AttendanceLog) |
| `src/components/CompleteProfileModal.jsx` | Prompts for missing student fields at check-in |
| `src/components/charts/index.jsx` | Chart components for dashboard/reports |
| `src/components/PasswordStrength.jsx` | 4-bar password strength indicator (Arabic labels) |
| `src/components/NetworkStatusBadge.jsx` | WiFi connection status indicator (green pulse / gray) |
| `src/views/kitchen/PendingDebtsModal.jsx` | Interactive modal launched from the kitchen Custody "ديون معلقة" card. Lists every debtor (unpaid kitchen orders + open kitchen debt rows), shows per-line history (date/time/items/amount), and exposes a "سداد" button that collects cash into kitchen custody (NOT drawer) until handover |

---

## View Registry (VIEW_MAP)

### Admin Views
| Key | Component | File |
|-----|-----------|------|
| `admin_dashboard` | AdminDashboard | `views/admin/Dashboard.jsx` |
| `admin_sessions` | CashierHub (reused) | `views/cashier/Hub.jsx` |
| `admin_students` | AdminStudents | `views/admin/Students.jsx` |
| `admin_staff` | AdminStaff | `views/admin/Staff.jsx` |
| `admin_pricing` | AdminPricing | `views/admin/Pricing.jsx` |
| `admin_products` | AdminProducts | `views/admin/Products.jsx` |
| `admin_expenses` | AdminExpenses | `views/admin/Expenses.jsx` |
| `admin_reports` | AdminReports | `views/admin/Reports.jsx` |
| `admin_settings` | AdminSettings | `views/admin/Settings.jsx` |
| `admin_daily` | AdminDailyRevenue | `views/admin/DailyRevenue.jsx` |
| `admin_staff_revenue` | AdminStaffRevenue | `views/admin/StaffRevenue.jsx` |
| `admin_deposits` | AdminDeposits | `views/admin/Deposits.jsx` |
| `admin_subscriptions` | AdminSubscriptions | `views/admin/Subscriptions.jsx` |
| `admin_network` | AdminNetworkDashboard | `views/admin/NetworkDashboard.jsx` |
| `admin_wallet_subs` | AdminWalletSubs | `views/admin/WalletSubs.jsx` |
| `admin_shifts` | AdminShifts | `views/admin/Shifts.jsx` |
| `admin_charges` | AdminCharges | `views/admin/AdminCharges.jsx` |
| `admin_inventory` | AdminInventory | `views/admin/Inventory.jsx` |
| `admin_log` | AdminAttendanceLog | `views/admin/AttendanceLog.jsx` |
| `admin_collections` | AdminCollections | `views/admin/Collections.jsx` |
| `admin_debts` | AdminDebts | `views/admin/Debts.jsx` |
| `admin_wallets` | AdminWallets | `views/admin/Wallets.jsx` |
| `admin_payroll` | AdminPayroll | `views/admin/Payroll.jsx` |
| `admin_financial` | AdminFinancialLedger | `views/admin/FinancialLedger.jsx` |
| `admin_kitchen_capital` | AdminKitchenCapital | `views/admin/KitchenCapital.jsx` |
| `admin_sales_ledger` | AdminSalesLedger | `views/admin/SalesLedger.jsx` |

### Cashier Views
| Key | Component | File |
|-----|-----------|------|
| `cashier_hub` | CashierHub | `views/cashier/Hub.jsx` |
| `cashier_current` | CashierCurrent | `views/cashier/Current.jsx` |
| `cashier_checkin` | CashierCheckIn | `views/cashier/CheckIn.jsx` |
| `cashier_students` | CashierStudents | `views/cashier/Students.jsx` |
| `cashier_new_student` | CashierNewStudent | `views/cashier/NewStudent.jsx` |
| `cashier_internet_gate` | CashierInternetGate | `views/cashier/InternetGate.jsx` (reused) |
| `cashier_wallet_subs` | CashierWalletSubs | `views/cashier/WalletSubs.jsx` |
| `cashier_debts` | CashierDebts | `views/cashier/Debts.jsx` |
| `cashier_wallets` | CashierWallets | `views/cashier/Wallets.jsx` |
| `cashier_log` | CashierLog | `views/cashier/Log.jsx` |

### Kitchen Views
| Key | Component | File |
|-----|-----------|------|
| `kitchen_new_order` | KitchenNewOrder | `views/kitchen/NewOrder.jsx` |
| `kitchen_active_orders` | KitchenActiveOrders | `views/kitchen/ActiveOrders.jsx` |
| `cashier_guest_orders` | CashierGuestOrders | `views/cashier/GuestOrders.jsx` |
| `kitchen_custody` | KitchenCustody | `views/kitchen/Custody.jsx` |
| `kitchen_log` | KitchenLog | `views/kitchen/Log.jsx` |
| `kitchen_products` | KitchenProducts | `views/kitchen/Products.jsx` |

---

## Data Model — Supabase Tables

### Singleton Tables (fetched as single row with `id = 'singleton'`)
- `app_config` — library name, capacity, currency, hours, universities list, `lectureHalls` (JSONB array of hall name strings), `expenseCategories` (JSONB array of custom expense category names)
- `app_pricing` — hourTiers[], extraHourRate, graceMinutes, freeMinutes, legacy hourly/halfDay/fullDay
- `gateway_config` — MikroTik bridge URL and settings

### Collection Tables

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `students` | id, student_id, member_number, name, phone, wallet_balance, university, college, year, nationality | `student_id` = "LIB-XXXXX", `member_number` = user-facing number; `wallet_balance >= 0` is an invariant — debt lives in the `debts` table |
| `sessions` | id, student_id, student_name, check_in_time, check_out_time, status, type, note, shift_id | status: `'active'` or `'closed'` |
| `invoices` | id, session_id, student_id, minutes, amount, kitchen_total, total, payment_method, billing_type, shift_id, cashier_id, in_custody | `student_id` and `student_name` are nullable (walk-in/staff/guest orders); payment_method: `'cash'`\|`'transfer'`\|`'instapay'`\|`'owner'`\|`'wallet'`\|`'admin'`\|null; `in_custody` (boolean, default false): true when cash is held by kitchen staff — excluded from `calcDrawerExpected()` until handover confirmed |
| `kitchen_orders` | id, session_id, student_id, items (JSONB), total, cost_total, status, staff_id, staff_name, hall, order_type, custody_holder_id, paid_by, deleted_by, deleted_by_name, deleted_at | items inner keys are camelCase (not converted); `cost_total` = sum of ingredient costs for profit tracking; `hall` (nullable text) = lecture hall name for hall delivery orders; `order_type` (nullable text) = `'cowork'`\|`'hall'`\|`'guest'` — portal order source, set by StudentOrder.jsx; `custody_holder_id` = who physically holds the cash; `paid_by` = who collected payment; status: `'pending'`\|`'preparing'`\|`'ready'`\|`'delivered'`\|`'cancelled'`\|`'deleted'`; `staff_name` = denormalized creator name; `deleted_by/deleted_by_name/deleted_at` = soft-delete audit fields |
| `products` | id, category_id, name, price, cost_price, available, unit_type, sub_unit_ratio, sub_unit_name, recipe_cost, track_stock, stock_qty, low_stock_threshold, ingredient_only | `unit_type`: `'piece'`\|`'kg'`\|`'liter'`; `sub_unit_ratio`: sell-units per bulk unit (e.g., 10 portions per kg); `recipe_cost`: ingredient cost per sellable unit; `ingredient_only`: raw material hidden from order menus but visible in inventory/recipes |
| `categories` | id, name, emoji, color | |
| `expenses` | id, amount, description, category, date, payment_method, shift_id, staff_id, created_at | `payment_method` filters cash-vs-noncash in `calcDrawerExpected()`; null/`'cash'` counts as cash |
| `staff` | id, name, username, display_name, role, active, auth_id, created_at | auth_id links to Supabase Auth |
| `owners` | id, name, balance, student_ids (JSONB array) | Pre-paid parent/sponsor accounts |
| `deposits` | id, owner_id, student_id, amount, note, staff_id | Money added to owner accounts |
| `wallet_transactions` | id, student_id, type, amount, balance_before, balance_after, invoice_id | type: `'topup'`\|`'deduct'` |
| `subscription_plans` | id, name, quota_type, quota, validity_days, price, discount_percent, active | quota_type: `'hours'`\|`'days'`; `discount_percent` (0–100): auto-applied at purchase, compared with nationality offer — higher wins |
| `student_subscriptions` | id, student_id, plan_id, remaining_quota, used_dates, expiry_date, status | status: `'active'`\|`'exhausted'`\|`'expired'` |
| `shifts` | id, cashier_id, start_time, end_time, starting_cash, actual_cash, status | status: `'active'`\|`'closed'` |
| `debts` | id, person_id, person_type, type, amount, note, invoice_id, source, in_custody | type: `'borrow'`\|`'repay'`; person_type: `'staff'`\|`'student'`; source: `'drawer'`(default)\|`'kitchen'`\|`'session'`\|`'legacy'` — kitchen debts don't affect drawer balance; `'session'`/`'legacy'` are student-only sources. `in_custody` (boolean, default false): true on a `repay` row when cash is held by kitchen staff — excluded from `calcDrawerExpected.repayments` until handover confirmed |
| `admin_charges` | id, admin_id, invoice_id, amount, settled, created_at | Staff-owed amounts from sessions |
| `admin_collections` | id, cashier_id, amount, note, created_at | Cash moved to safe |
| `safe_transactions` | id, type, amount, shift_id | type: `'withdrawal'` |
| `custody_handovers` | id, staff_id, staff_name, amount, order_ids (JSONB), debt_repay_ids (JSONB), status, cashier_id, cashier_name, shift_id, note, confirmed_at | status: `'pending'`\|`'confirmed'`\|`'rejected'`; kitchen-to-cashier cash transfer protocol. `debt_repay_ids` lists `debts.id` of kitchen-collected repay rows included in the handover (their `in_custody` is cleared on confirm) |
| `cash_adjustments` | id, amount, reason, created_at | Manual drawer corrections |
| `daily_logs` | id, action, details, staff_id, timestamp | Activity audit trail; actions include `order_edit` (order item changes with before/after) |
| `stock_movements` | id, product_id, product_name, type, delta, stock_after, note, staff_id, created_at | type: `'received'`\|`'order'`\|`'cancel'`\|`'adjustment'`\|`'waste'`\|`'edit_add'`\|`'edit_remove'` |
| `product_recipes` | id, product_id, ingredient_id, quantity, created_at | Defines composite product ingredients; `quantity` = sub-units of ingredient per 1 product unit |
| `salary_configs` | id, staff_id, base_salary, created_at | |
| `payroll_entries` | id, staff_id, period, amount, created_at | |
| `gateway_logs` | id, action, student_id, created_at | MikroTik bridge logs |
| `student_backups` | id, snapshot (JSONB), student_count, trigger, created_at | Auto-backup every 24h |
| `login_attempts` | id, username, success, ip_address, attempted_at | Server-side brute force protection (no STORAGE_KEY — edge function only) |
| `wifi_session_tiers` | id, name, duration_minutes, price, speed_profile, max_devices, active | Configurable WiFi session pricing tiers |
| `wifi_sessions` | id, username, password, tier_id, student_id, duration_minutes, price, payment_method, invoice_id, status, is_voucher, batch_id, started_at, expires_at, sold_by | Sold WiFi session records |
| `wifi_voucher_batches` | id, tier_id, tier_name, quantity, price_each, generated_by | Bulk voucher generation tracking |
| `wifi_full_access` | id, person_id, person_name, person_type, speed_profile, max_devices, granted_by, active | VIP/staff unlimited access accounts |
| `wifi_blocked_categories` | id, name, label, domains (JSONB), enabled | Block categories with domain arrays |
| `wifi_blocked_domains` | id, domain, comment, blocked_by | Custom individual domain blocks |
| `wifi_walled_garden` | id, name, domains (JSONB), bandwidth_limit, comment | Free access site groups |
| `wifi_usage_logs` | id, username, date, bytes_in, bytes_out, sessions_count | Daily aggregated per-user bandwidth |
| `wifi_events` | id, event_type, target, details (JSONB), staff_id, staff_name | Admin WiFi action audit log |

---

## Async Functions — MUST Await

These functions are async. Forgetting `await` will cause silent bugs:

```js
await generateStudentId()           // queries Supabase for uniqueness
await getActiveSubscription(id)     // queries student_subscriptions table
await checkActiveSession(id)        // queries sessions table
```

`logActivity(action, details, staffId)` is fire-and-forget — do NOT await it.

`settleStudentDebts({ studentId, studentName, cashIn, debts, walletBalance, cashierId, cashierName, invoiceId, now })` is **synchronous** — it returns `{ writes, debtPaid, walletAdded, walletAfter }`. Caller pushes `writes` into its own `Promise.all` and is responsible for the final `students.update({ wallet_balance: walletAfter })` and any `invoices` row for the `walletAdded` portion.

---

## Pricing System

The pricing engine is in `utils/index.js → calcBestPrice(minutes, pricing)`.

1. **freeMinutes** (default 15): Sessions <= this are completely free
2. **graceMinutes** (default 10): Minutes into a new hour that don't count as a full hour
3. **hourTiers** (primary): Array of `{ hours, price, active }` — system picks cheapest tier for the student
4. **extraHourRate**: Cost per hour beyond a tier's base hours
5. **Legacy fallback**: hourly/halfDay/fullDay rates (only if no tiers configured)

`calcBestPrice` returns `{ options, best, billableHours }`.

### Targeted Offers (Session & Subscription)

`specialOffers[]` in `app_pricing` supports conditional pricing for specific student groups.

**Extended offer schema**:
```js
{
  id, label, active,
  appliesTo: 'session' | 'subscription' | 'both',  // default: 'subscription'
  sessionPricePerHour: number,  // flat rate per billable hour (session offers only)
  discountType: 'fixed' | 'percentage',  // subscription discount type
  price: number, percentage: number,     // subscription discount values
  criteria: {
    nationalities: string[],   // Arabic text, normAr-compared
    academicYears: string[],   // e.g., ['4', '5']
    universities: string[],    // from config.universities
    colleges: string[],        // from config.colleges
    tags: string[],
  }
}
```

**Matching rule** (`matchOfferCriteria` in `utils/index.js`): AND logic across criteria types, OR within each array. Empty arrays are ignored. At least one criterion must be specified.

**Session offers** (`CheckoutModal.jsx`): Active offers with `appliesTo === 'session' || 'both'` and `sessionPricePerHour > 0` are matched against the student. If multiple match, lowest `sessionPricePerHour` wins. Override: `sessionCost = billableHours * offer.sessionPricePerHour`. Does NOT override free sessions (freeMinutes) or subscription billing.

**Subscription offers** (`Hub.jsx`, `WalletSubs.jsx`): Same matching via `matchOfferCriteria`. Compared against plan's `discountPercent` — higher discount wins. Backward compatible: offers without `appliesTo` default to `'subscription'`.

---

## Checkout Flow — The Most Complex Transaction

`CheckoutModal.jsx` writes to **7+ tables atomically** via `Promise.all`:

1. Wallet deduction (split payment) → `wallet_transactions` + `students.wallet_balance`
2. Subscription billing → `student_subscriptions`
3. Owner balance deduction → `owners`
4. Full wallet payment → `wallet_transactions`
5. Change to wallet → `wallet_transactions` + `invoices` (topup invoice)
6. Debt recording → `wallet_transactions` (negative balance)
7. **Existing debt settlement** → `wallet_transactions` (topup for wallet debt) + `debts` (repay for installment debt) + overpayment → wallet topup
8. Admin charge → `admin_charges`
9. Added items → `kitchen_orders`
10. Invoice → `invoices`
11. Close session → `sessions`

### Debt Alert at Checkout

CheckoutModal shows a **mandatory debt alert** when the student has existing debt (negative wallet balance OR unpaid installment debts from the `debts` table). The cashier must either:
- Enter a settlement amount (partial or full), OR
- Check the acknowledgment checkbox to proceed without settling

If partial settlement: checkbox shows remaining amount. If overpayment: excess is added to the student's wallet. All wallet balance displays in the modal (wallet payment, underpayment, change-to-wallet) use `walletAfterSettle` to reflect the post-settlement balance.

**Modifying this file requires understanding ALL of these writes and how they affect uncollectedBalance.**

### Admin Split Billing (Session Free, Kitchen Must Pay)

When `paymentMethod === 'admin'` AND there are kitchen orders (`kitchenTotal + addedTotal > 0`), the checkout splits into two invoices:

- **Invoice A** (`paymentMethod: 'admin'`): session cost only — excluded from revenue by existing `paymentMethod !== 'admin'` filters
- **Invoice B** (`paymentMethod: kitchenPayMethod`): kitchen cost only — counted as real revenue, collected from whoever is present

The `admin_charges` record amount is `sessionCost` only (not the full grandTotal). `grandTotal` in split mode equals the kitchen portion only.

When there are no kitchen orders, the existing single-invoice admin path is used unchanged.

**NewOrder.jsx admin mode**: Staff kitchen orders now require payment (cash/transfer/instapay). No `admin_charges` record is created — the order is marked `paid: true` with a `paymentMethod` field. Revenue flows through `kitchen_orders.total`.

**SessionDetailModal.jsx**: Fetches all invoices for a session (not just one). When split billing produced two invoices, both are displayed with labels "فاتورة الجلسة (على موظف)" and "فاتورة المطبخ (مدفوع)".

---

## Styling Conventions

- **Font**: IBM Plex Sans Arabic (RTL direction)
- **Sidebar**: navy bg, w-60/w-64, indigo active state
- **Main bg**: `#F8F9FB`
- **Action buttons**: `bg-indigo-600 hover:bg-indigo-700`
- **Success/active**: teal palette
- **Cards**: `bg-white rounded-2xl shadow-sm border border-gray-200`
- **Table headers**: `bg-gray-50 border-b border-gray-200 text-xs uppercase`
- **Custom colors** (in tailwind.config.js): navy, gold, teal, cream
- **All text is RTL** — use `text-right`, `dir="rtl"` on inputs, sidebar is on the right

---

## Adding a New View — Checklist

1. Create the component file in `src/views/{role}/YourView.jsx`
2. Accept `sharedProps` destructured: `{ user, toast, config, setActiveView, uncollectedBalance, onStudentClick }`
3. Import and add to `VIEW_MAP` in `App.jsx`
4. Add menu entry to `MENU` in `constants/index.js` (with correct section, icon, view key)
5. **Add the view key to `ROLE_VIEWS`** in `constants/index.js` for every role that should access it
6. If the view needs a new data table:
   - Add `STORAGE_KEYS.YOUR_KEY` in `constants/index.js`
   - Add mapping in `lib/tableMap.js`
   - Create the Supabase table with snake_case columns
   - Use `useStorage(STORAGE_KEYS.YOUR_KEY, [])` in the component

---

## Adding a New Supabase Table — Checklist

1. Create the table in Supabase with snake_case column names
2. Add a STORAGE_KEY string in `constants/index.js`
3. Add the key → table mapping in `lib/tableMap.js`
4. Enable Realtime on the table in Supabase dashboard (if live updates needed)
5. RLS is disabled on all tables — no policies needed

---

## Common Pitfalls

| Mistake | What Breaks | Fix |
|---------|------------|-----|
| Adding STORAGE_KEY without TABLE_MAP entry | useStorage silently returns default, saves never persist | Always update both files |
| Using `save([])` on a large dataset | Mass-deletion guard blocks it, throws error | Use `save(prev => prev.filter(...))` for targeted removals |
| Forgetting `await` on `generateStudentId()` | Student gets `[object Promise]` as their ID | Always await async utils |
| Mixing camelCase/snake_case in direct Supabase queries | Insert silently creates wrong columns, data disappears | Use `toSnake()` before insert, `toCamel()` after select |
| Modifying MENU without matching VIEW_MAP entry | Click on menu item shows blank screen | Keep MENU views and VIEW_MAP keys in sync |
| Editing pricing logic without testing freeMinutes=0 edge case | Free sessions start charging, or paid sessions become free | Test: 0min, 14min, 15min, 16min, 60min, 300min |
| Changing invoice fields without updating uncollectedBalance | Admin sees wrong cash drawer amount, financial reports break | Trace every change through the formula in App.jsx |
| Adding a new payment method | uncollectedBalance, DailyRevenue, Reports all need updates | Search all files for `paymentMethod` before adding |
| Modifying shifts logic | Expected cash calculation breaks for cashiers | Test shift open → transactions → shift close flow |
| Adding a view without updating ROLE_VIEWS | View renders for admin but blocked for other roles; or cashier can access admin views via console | Add view key to `ROLE_VIEWS` in `constants/index.js` for each permitted role |
| Using `useStorage` for bulk data in public portals (`#portal`, `#order`) | All student/session data exposed to unauthenticated users | Use targeted `supabase.from().select()` queries instead |
| Creating portal order without `orderType` field | Cashier GuestOrders tab filters break — order appears in wrong tab or is invisible | Always set `orderType` to `'cowork'`\|`'hall'`\|`'guest'` in `StudentOrder.jsx`; `resolveOrderType()` fallback handles legacy rows |
| Setting password < 6 chars for new staff | Weak passwords; validation in `Staff.jsx` enforces minimum 6 | Check `PasswordStrength` component feedback during creation |
| Changing wallet/debt values without updating all display sections | UI shows stale balances (e.g. -550 instead of 0 after settlement) | Use `walletAfterSettle` in CheckoutModal; apply Ripple-Effect Rule — search for every usage of the changed value |
| Modifying debt settlement without checking `debts` + `wallet_transactions` + `students.wallet_balance` | Partial settlement lost, overpayment ignored, balance desync | Settlement writes to all 3 tables; overpayment adds to wallet |
| Re-adding manual discount % input to subscription purchase | Cashiers can set arbitrary discounts, bypassing admin control | Discounts are auto-applied: plan's `discountPercent` vs nationality offer — whichever is higher wins. No manual override. Hub.jsx and WalletSubs.jsx both use this logic. |
| Forgetting collections in uncollectedBalance | Drawer shows inflated balance after cash moved to safe | `deltaCollections` is subtracted in App.jsx formula |
| Forgetting collections in cashier shift expectedCash | Cashier sees false shortage when closing shift after admin collects cash | `cashier/Log.jsx` must subtract collections (matching `admin/Shifts.jsx` pattern); any new drawer calculation must include collections |
| Debt write-off: repay without matching expense | Drawer balance inflates (repay adds cash that doesn't exist) | Write-off creates both a `repay` debt AND an `expense` — net drawer effect is zero |
| Including `paymentMethod === 'admin'` invoices in revenue totals | DailyRevenue, Reports, Dashboard show inflated income with money not yet collected | Always filter `inv.paymentMethod !== 'admin'` before computing revenue totals; show pending admin charges separately via `adminCharges.filter(c => !c.settled && c.source !== 'kitchen')` |
| Receiving stock without multiplying by `subUnitRatio` | Stock shows 6 instead of 60 for a 6kg product with ratio=10 | Inventory.jsx receive multiplies by `subUnitRatio` for non-piece units; stockQty is always stored in sub-units |
| Forgetting `costTotal` when creating kitchen orders | KitchenCapital profit analysis shows 100% margin (zero cost) | NewOrder.jsx must set `costTotal = Σ(qty × (recipeCost \|\| costPrice \|\| 0))` on every order |
| Using `costPrice` directly as per-unit cost for products with `subUnitRatio > 1` | Cost inflated — costPrice is per bulk unit, not per sub-unit | Per-sub-unit cost = `costPrice / subUnitRatio`; use `recipeCost` for manual per-unit override |
| Admin checkout with kitchen orders using single invoice | Kitchen products given free — library absorbs material cost | CheckoutModal splits into 2 invoices: admin (session) + collected (kitchen). `isAdminSplit` flag triggers split path. Never combine session+kitchen in a single admin invoice |
| Modifying NewOrder admin mode to create `admin_charges` | Staff get free food; no revenue recorded for kitchen orders | Admin kitchen orders require payment (`adminPayMethod`), no `admin_charges` created, order marked `paid: true` |
| SessionDetailModal using `.maybeSingle()` for invoices | Split billing sessions only show one of two invoices | Use `.select('*')` (returns array) and handle multiple invoices display |
| Decrementing product's own stock for composite products | Raw ingredients never depleted; inventory drifts | If a product has recipes → decrement **ingredients only** via `computeRecipeStockChanges()`. If no recipes + `trackStock` → decrement product's own stock |
| Deleting kitchen order without restoring stock | Ingredients permanently lost from inventory | `ActiveOrders.jsx handleDelete` calls `computeRecipeStockChanges(..., +1)` to restore, inserts `type: 'cancel'` stock movements |
| Marking order paid without storing `invoiceId` | Cannot delete invoice on order cancellation | `markAsPaid` stores `invoiceId` on the order object for reliable reversal |
| Kitchen marks paid without custody fields | Cash attributed to cashier drawer instead of kitchen custody | Always set `custodyHolderId: user.id, paidBy: user.id` when kitchen collects cash; kitchen `markAsPaid` does NOT create invoice |
| Creating invoice when kitchen collects cash | uncollectedBalance inflated — invoice exists but cash is with kitchen, not drawer | Invoice is created only when handover is confirmed by cashier (`handleConfirmHandover` in `Log.jsx`) |
| Including kitchen-custody orders in shift expected cash | Cashier shift shows inflated expected cash (includes money kitchen hasn't handed over) | Shift formula filters by `custodyHolderId === shift.cashierId`; confirmed handovers added separately |
| Collecting portal order without storing `invoiceId` on order | Cannot reverse invoice on cancellation — orphaned invoice inflates revenue | `handleCollect` in `GuestOrders.jsx` must set `invoiceId: inv.id` on the order object |
| Cancelling paid portal order as kitchen role | Kitchen can't reverse cash drawer — invoice deleted but drawer balance wrong | Cancel button on paid orders only shown to admin/cashier roles; kitchen can only cancel unpaid orders |
| Creating kitchen debt without `source: 'kitchen'` | Drawer balance drops incorrectly — debt treated as cash leaving the drawer | Always set `source: 'kitchen'` on debts from kitchen orders; `uncollectedBalance`, `Shifts.jsx`, and `Log.jsx` all filter `d.source !== 'kitchen'` from `deltaDebtsOut` |
| Adding offer without `appliesTo` field | Offer defaults to 'subscription' only — won't apply to sessions | Always set `appliesTo: 'session' \| 'subscription' \| 'both'`; session offers require `sessionPricePerHour > 0` |
| Using inline nationality matching instead of `matchOfferCriteria` | New criteria (academicYears, universities, colleges) are ignored | Always use `matchOfferCriteria(offer, student)` from `utils/index.js` for offer matching |
| Adding raw material product without `ingredientOnly: true` | Product appears in order menus (NewOrder, StudentOrder, CheckoutModal) alongside sellable items | Set `ingredientOnly: true` + `trackStock: true` for raw materials; filtered via `!p.ingredientOnly` in all order menu filters |
| Editing paid order without updating invoice/debt | Drawer balance mismatch — invoice shows old total but order has new total | `EditOrderModal` auto-updates invoice `kitchen_total`/`total` and debt `amount` when total changes; audit logged as `order_edit` |
| Adding kitchen orders/handovers to shift expected cash formula | Drawer balance double-counted — same money counted via invoice AND via order/handover | Shift formula must ONLY use invoices (`shiftCashSales`). All kitchen cash flows through invoices: checkout, guest collect, markAsPaid, handover confirm. Never add raw order totals or handover amounts on top. |
| Allowing staff kitchen orders with cash/transfer/instapay | Staff get food without accountability; drawer balance confusion | Staff kitchen orders are ALWAYS debt-only (`source: 'kitchen'`). No payment method selector in NewOrder.jsx admin mode. |
| Using `createdAt` instead of `settledAt` for admin charges in cash formulas | Old charges settled during current period are invisible to drawer balance — sidebar shows less money than shift expects | Always use `settledAt` for admin charges timing. The shared `calcDrawerExpected()` in `utils/index.js` enforces this — never inline the formula |
| Duplicating the drawer formula in multiple files | Formula drifts apart, sidebar and shift show different numbers for the same transactions | Always use `calcDrawerExpected()` from `utils/index.js` — never write inline drawer math in components |
| Creating invoice with `studentId: null` without checking DB constraints | Upsert fails silently — order marked paid but invoice never created, drawer balance unchanged | `invoices.student_id` and `student_name` are nullable (migration `20260510400000`). Always check `{ error }` from direct `supabase.from('invoices').upsert()` and abort + toast on failure |
| Hard-deleting kitchen orders instead of soft-delete | Order history lost permanently; no audit trail for deleted orders; SalesLedger cannot show what was deleted or by whom | Always soft-delete: set `status: 'deleted'` + `deletedBy/deletedByName/deletedAt`. Use `isActiveOrder(o)` from `utils/index.js` to filter out cancelled+deleted orders in all consumers. Never use `prev.filter(o => o.id !== id)` for kitchen orders |
| Using `o.status !== 'cancelled'` instead of `isActiveOrder(o)` | Soft-deleted orders still appear in revenue, dashboard, reports, and checkout totals | Always use `isActiveOrder(o)` which checks both `cancelled` and `deleted` statuses |
| Creating kitchen cash invoice without `inCustody: true` | Cash physically held by kitchen inflates cashier drawer balance — sidebar/shift show more cash than actually present | Kitchen invoice creation (`ActiveOrders.jsx`, `NewOrder.jsx`) must set `inCustody: true` when `isKitchenUser && paymentMethod === 'cash'`. Cleared to `false` in `handleConfirmHandover` (cashier `Log.jsx`) when cashier receives the cash |
| Writing a `wallet_transactions.deduct` that drives `students.wallet_balance` below 0 | Breaks the wallet-is-always-≥-0 invariant; debt double-counted (in both negative wallet AND `debts` table); displays show stale "negative wallet" badges that the new UI no longer handles | Insert into the `debts` table instead with the correct `source` (`'session'` for session underpayment, `'kitchen'` for kitchen underpayment). See Rule 6 — `CheckoutModal.jsx` is the canonical pattern. |
| Topping up a wallet without auto-settling outstanding debts | Cashier collects 200 EGP but the student still shows 300 EGP debt + 200 EGP wallet — drift between the two surfaces, contradicts the user's mental model and the new invariant | Every "money in" path MUST call `settleStudentDebts()` from `src/utils/index.js` so debt clears before wallet grows. Existing call sites: `cashier/Wallets.jsx` AdjustmentModal, `cashier/CheckoutModal.jsx` settlement block, `cashier/Hub.jsx` `handleSettleDebt` |
| Invoicing the full topup amount when the topup partially settled debts | Drawer income is double-counted: `debts.repay` rows count toward `calcDrawerExpected.repayments` AND the invoice counts toward `cashSales`. Cashier shift shows a fake surplus | Invoice only the `walletAdded` portion returned by `settleStudentDebts()`. The `debtPaid` portion is already accounted for via repay rows. `debtPaid + walletAdded === cashIn` always. |
| Writing a single debt row at checkout when both session and kitchen are underpaid | Notes lose detail — cashier can't tell what part of the debt is session vs kitchen, and partial debt settlements get muddled | Split into two debt rows when both `sessionShare > 0` and `kitchenShare > 0`. Each row carries its own detailed note per Rule 6 |
| Displaying `costPrice` / `recipeCost` outside admin views | Leaks COGS data to cashier/kitchen — violates the data masking rule | Cost price is admin-only. Kitchen `Products.jsx` gates the "التكلفة" line behind `user?.role === 'admin'`. The "التكلفة" column on session tables (cashier `Current.jsx`, `Hub.jsx`) is the customer's bill, not COGS — those are fine to show |
| Settling a kitchen debt by writing a plain `repay` row without `inCustody:true` | Cash physically held by kitchen inflates the drawer immediately — the cashier shift expects more cash than actually present | When kitchen collects a debt payment, insert the repay row with `inCustody: true`. `calcDrawerExpected.repayments` excludes those rows until handover confirmation clears the flag |
| Submitting a handover with only `orderIds` after kitchen settled debts | Kitchen-held repays never get released to drawer — Custody view shows phantom cash that never clears | Handover record must also carry `debtRepayIds: string[]`. Cashier `Log.jsx handleConfirmHandover` clears `in_custody=false` on those debt rows on confirm. Kitchen `kitchenCustodyTotal` in `cashier/Log.jsx` includes the held-repay total via `debts` table |
| Guarding a money-touching submit handler with `useState`-based `if (saving) return` | `setSaving(true)` is async — a second click in the same render tick passes the guard and fires the handler twice. Result: duplicate invoices, double wallet deductions, duplicate debt rows | Use `useSubmitLock()` from `src/hooks/useSubmitLock.js`. `useRef` mutates synchronously, so the second call returns `{skipped:true}` before React schedules a re-render. Pattern: `const handle = () => run(async () => { ...writes... });`. Applied to every money-touching handler — Checkout, debt repay/write-off, wallet adjustment, deposits/expenses, kitchen mark-paid, custody handover, etc. |
| Writing financial state AFTER `await Promise.all(writes)` succeeds | If the post-await write fails (kitchen orders mark-paid, etc.), the cashier sees a success toast but the order shows as still unpaid — next checkout double-charges | All money-touching writes must be INSIDE the same `Promise.all`/`trackedWrites` batch. Only side-effect writes that are safely fire-and-forget (`mtkDisable`, `logActivity`, `toast`) should run after success. CheckoutModal kitchen-orders `paid:true` update was moved into the main batch for exactly this reason |
| Computing a financial submit against `useStorage`-derived state captured at modal-open time | `walletBalance` and `debts` arrays are captured by the modal's render. A concurrent topup/charge in another tab can drift them before submit, and the closure operates on stale values | Refetch fresh server state at submit time (the start of the lock-wrapped async fn) for any value the math depends on. CheckoutModal and Wallets AdjustmentModal both fetch fresh `students.wallet_balance` + `debts` rows directly via `supabase.from(...)`. Add a divergence guard that toasts and aborts if the fresh value drifts >0.5 from the rendered value, so cashier never silently writes against figures they never saw |
| Tearing down a financial modal via `useIdleTimeout` mid-`Promise.all` | Sign-out fires, modal unmounts, in-flight writes may or may not land — drawer state inconsistent and cashier doesn't know what's persisted | `useIdleTimeout` now reads `hasInFlight()` from `useInFlightTracker` and defers sign-out while writes are pending (up to one CHECK_INTERVAL past drain). Wrap money-batch `Promise.all` with `trackedWrites()` so the counter increments/decrements automatically |

---

## Security Architecture

### Role-Based View Guards
- `ROLE_VIEWS` in `constants/index.js` — explicit allowlist per role
- `guardedSetActiveView` in `App.jsx` — rejects unauthorized navigation with error toast
- Render-time guard: `ActiveView` only renders if `isViewAllowed` is true
- **When adding a new view**: must add its key to `ROLE_VIEWS` for each role that should access it

### Session Timeout
- `useIdleTimeout` hook tracks user activity (mouse, keyboard, touch, scroll)
- 30 min idle → auto-logout; warning modal appears 5 min before
- Checking interval: every 10 seconds

### Real-Time Staff Deactivation
- Supabase Realtime subscription on `staff` table filtered to `user.id`
- If `active` set to `false` → immediate sign-out
- If `role` changed → re-fetch staff, redirect to role's default view

### Public Portal Security
- `WiFiPortal.jsx` and `StudentOrder.jsx` use targeted Supabase queries (not `useStorage` bulk loads)
- Only products/categories/config loaded via `useStorage` (public menu data)
- Student lookup: query by search term, limit 1
- Order submission: direct `supabase.from().insert()` with `toSnake()`

### Brute Force Protection (Server-Side)
- `login_attempts` table tracks failed logins per username
- Edge function `staff-manager` handles `check_lockout` / `record_attempt` (unauthenticated actions)
- Escalating lockout: 5 fails → 1 min, 10 fails → 5 min, 15 fails → 15 min (within 60 min window)
- Success clears all failed attempts for that username
- Cannot be bypassed by clearing localStorage

---

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Environment Variables

```
VITE_SUPABASE_URL=<supabase project url>
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```

When these are missing or contain "your-project", the app falls back to localStorage mode.

---

## Before Submitting Any Change

1. Does it touch `constants/index.js`? → Check `tableMap.js`, `App.jsx VIEW_MAP`, and `MENU` are still in sync
2. Does it touch financial data (invoices, debts, expenses, shifts, collections, safe_transactions)? → Verify `calcDrawerExpected()` in `utils/index.js`
3. Does it touch `useSupabaseTable.js`? → Test: load, save single item, save batch, delete, Realtime update, offline queue
4. Does it add/remove a field from a Supabase table? → Update `toCamel`/`toSnake` won't break (they're generic), but check any manual field mappings (like in `getActiveSubscription`, `fetchStaffByAuthId`)
5. Does it change pricing logic? → Test all tiers, freeMinutes edge, legacy fallback
6. Does it modify checkout? → Test: cash, transfer, instapay, wallet, owner, admin, subscription, debt, change-to-wallet flows
