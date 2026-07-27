# RetailPro — Full UI Design Brief

**Paste this whole document as your design prompt.**

---

## 0. What you are designing

RetailPro is a **multi-tenant inventory management and point-of-sale web app for Pakistani retail SMEs** — kiryana (corner grocery) stores, general stores, medical stores, and small wholesalers. It replaces the paper ledger (*bahi khata*) these shops currently use.

**Design for these people, not for an office worker:**

- The primary user is a shop owner or a hired cashier, often with limited formal education and limited English. Many are more comfortable in Urdu.
- The POS screen is used **hundreds of times a day**, standing at a counter, often one-handed, frequently while a customer waits. Speed and unambiguous feedback beat elegance every time.
- Devices are mid-to-low-end Android phones and older Windows desktops. Screens are often dim, sometimes viewed in bright daylight through a shop window.
- Connectivity drops regularly. The app keeps working offline and syncs later, so **offline state must be visible and reassuring, never alarming**.
- Money is in Pakistani Rupees. Amounts get long: `Rs 248,910`. Never let a number truncate or wrap mid-figure.

**Tone:** trustworthy, calm, businesslike. This app handles someone's livelihood. Avoid playful illustration, avoid startup-y gradients, avoid anything that reads as a toy. Think "reliable instrument," not "consumer app."

---

## 1. Design language

Use **Material 3 (Material You)**, light theme only. Follow M3's structure faithfully: colour *roles* (not raw hex picked by eye), the type scale, the shape scale, tonal elevation, and state layers.

Two deliberate departures from stock M3, both for this audience:

1. **Density is tighter than M3 default.** Shopkeepers scan long product and sales tables. Use M3's compact density (-2) for tables and lists. Keep full density for the POS screen and all primary buttons.
2. **Touch targets stay 48×48dp minimum everywhere**, even in compact tables. If density and target size conflict, target size wins.

---

## 2. Colour

Generate the scheme from seed **`#1B7F4B`** (a grounded retail green — reads as "fresh produce / trusted local business" in this market, and is distinct from the blue every banking app uses).

### Light scheme roles

| Role | Hex |
|---|---|
| Primary | `#16653C` |
| On Primary | `#FFFFFF` |
| Primary Container | `#A2F2BF` |
| On Primary Container | `#002110` |
| Secondary | `#4F6353` |
| On Secondary | `#FFFFFF` |
| Secondary Container | `#D2E8D4` |
| On Secondary Container | `#0D1F13` |
| Tertiary | `#3B6470` |
| On Tertiary | `#FFFFFF` |
| Tertiary Container | `#BFE9F7` |
| On Tertiary Container | `#001F27` |
| Error | `#BA1A1A` |
| On Error | `#FFFFFF` |
| Error Container | `#FFDAD6` |
| On Error Container | `#410002` |
| Surface | `#F6FBF4` |
| On Surface | `#181D19` |
| Surface Variant | `#DCE5DC` |
| On Surface Variant | `#414942` |
| Outline | `#717972` |
| Outline Variant | `#C0C9C0` |
| Surface Container Lowest | `#FFFFFF` |
| Surface Container Low | `#F0F5EF` |
| Surface Container | `#EAEFE9` |
| Surface Container High | `#E5EAE3` |
| Surface Container Highest | `#DFE4DE` |
| Inverse Surface | `#2D322E` |
| Inverse On Surface | `#EEF2EC` |
| Inverse Primary | `#87D6A4` |

Regenerate in Material Theme Builder from the seed if you prefer — keep the roles, not necessarily these exact values.

### Domain semantic colours

These carry business meaning and must be **consistent across every screen**. Always pair with a text label or icon — never colour alone, since colour-blind users and washed-out phone screens both defeat it.

| Meaning | Container / Text | Used for |
|---|---|---|
| Healthy stock | `#A2F2BF` / `#002110` | Stock badge at or above threshold |
| Low stock | `#FFE08A` / `#4A3500` | Stock at or below threshold; "needs restock" |
| Out of stock | `#FFDAD6` / `#410002` | Zero stock; disabled POS tile |
| Profit / positive | `#16653C` | Net profit, margin above target |
| Loss / negative | `#BA1A1A` | Negative net profit, below-cost margin |
| Pending / awaiting | `#BFE9F7` / `#001F27` | Pending purchase order, queued offline sale |
| Refunded / void | `#DCE5DC` / `#414942` | Refunded sale, cancelled PO |
| Khata (credit owed) | `#FFE08A` / `#4A3500` | Customer credit balance above zero |

---

## 3. Typography

**Latin:** `Inter` (or Roboto Flex if you prefer stock M3). Tabular figures **must** be enabled for all currency, quantity, and date columns — `font-feature-settings: "tnum"`. Misaligned digits in a money column look untrustworthy.

**Urdu:** `Noto Sans Arabic` for all UI. Do **not** use Nastaliq for interface text, tables, or buttons — it is beautiful but its steep baseline makes small sizes and dense tables genuinely hard to read. Nastaliq (`Noto Nastaliq Urdu`) is acceptable *only* for the marketing/login headline if you want cultural warmth there.

Urdu at the same nominal size reads smaller than Latin. **Bump Urdu UI text by ~1pt and increase line-height by ~0.15em** versus the Latin equivalent.

### Type scale

| M3 role | Size / Line | Weight | Used for |
|---|---|---|---|
| Display Small | 36 / 44 | 400 | POS running total only |
| Headline Medium | 28 / 36 | 500 | Login/Register card heading |
| Headline Small | 24 / 32 | 500 | Dashboard stat card values, page totals |
| Title Large | 22 / 28 | 500 | Page titles ("Inventory", "Reports") |
| Title Medium | 16 / 24 | 500 | Card headings, dialog titles, table section heads |
| Title Small | 14 / 20 | 500 | Nav items, tab labels |
| Body Large | 16 / 24 | 400 | Form input values, POS product names |
| Body Medium | 14 / 20 | 400 | Table cell content, paragraph copy |
| Body Small | 12 / 16 | 400 | Helper text, timestamps, secondary metadata |
| Label Large | 14 / 20 | 500 | Button labels |
| Label Medium | 12 / 16 | 500 | Badges, chips, table column headers |
| Label Small | 11 / 16 | 500 | Notification type tags |

**Currency rule:** render as `Rs 1,650` — space after `Rs`, comma thousands separators, no decimals unless non-zero. In tables, right-align every currency and quantity column.

---

## 4. Shape, elevation, spacing, motion

**Shape:** M3 scale — buttons/chips `full`, text fields `4dp` top-rounded (filled) or `4dp` (outlined), cards `12dp`, dialogs and bottom sheets `28dp`, POS product tiles `12dp`, badges `full`.

**Elevation:** prefer M3 *tonal* elevation (surface container steps) over drop shadows. Reserve real shadow for level 3 dialogs and the level 2 POS cart panel. Flat surfaces read cleaner on cheap LCD panels.

**Spacing:** 4dp base grid. Page padding 24dp desktop / 16dp mobile. Card padding 20dp desktop / 16dp mobile. 8dp between related controls, 24dp between form sections.

**Motion:** M3 standard easing, 200ms for most transitions. Keep POS interactions at or under 100ms — a cashier must never wait on an animation. **Do not animate cart row removal**; removal is instant, deliberately, so the cashier gets immediate confirmation the sale went through.

---

## 5. Global patterns

### Navigation

Responsive, per M3 adaptive guidance:

- **Expanded (≥1240dp):** standard navigation drawer, always visible, 280dp wide.
- **Medium (600–1239dp):** navigation rail, 80dp, icon + short label.
- **Compact (<600dp):** bottom navigation bar with the 5 most-used destinations (Dashboard, POS, Inventory, Sales, More), remainder in a "More" bottom sheet.

Nav destinations in order: Dashboard, POS, Inventory, Categories, Sales, Purchases, Suppliers, Customers, Expenses, Reports, Staff, Settings.

**Critical:** the app hides destinations the signed-in user lacks permission for. A cashier sees roughly half this list. **Design the rail and drawer to look correct and balanced with as few as 6 items** — don't rely on a full list for visual rhythm.

### Top app bar

Small top app bar, `surface` background, no elevation until content scrolls under it (then `surfaceContainer`).

Left: shop name (Title Medium). Right, in order: notification bell with badge, EN/اردو segmented button, user name + role (tappable → Profile), logout icon button.

On compact, collapse the user name to an avatar and move logout into an overflow menu.

### Data tables

Every list screen uses one table pattern:

- Header row: `surfaceContainerLow`, Label Medium, `onSurfaceVariant`.
- Row height 52dp compact. Divider `outlineVariant` at 1dp between rows.
- Row hover: primary state layer at 8%.
- Text columns left-aligned; numeric/currency right-aligned with tabular figures.
- Actions column pinned right, icon buttons with tooltips.
- Horizontal scroll on overflow — **the page body must never scroll horizontally**, only the table container.
- On compact screens, tables become stacked cards: primary identifier as the card title, remaining fields as label/value rows, actions in an overflow menu.

### Text fields

Outlined text fields throughout (better contrast on cheap screens than filled). 56dp height. Helper text slot always reserved so layout doesn't jump when validation appears. Errors use `error` colour plus an error icon plus text — never colour alone.

### Buttons

- **Filled** — the one primary action per screen/dialog (Charge, Save, Create Shop).
- **Tonal** — secondary meaningful actions (Send Low Stock Alert Now).
- **Outlined** — Cancel, Clear.
- **Text** — inline table actions, "Retry now".
- **Destructive** — filled with `errorContainer` / `onErrorContainer`; reserve solid `error` for the confirm button inside a delete dialog.

### Feedback states

Design **all four** for every data screen:

1. **Loading** — skeleton rows matching the real table shape. Not a spinner; skeletons feel faster on slow connections.
2. **Empty** — a short line of plain-language guidance plus the primary action button. Example, Inventory: *"No products yet. Add your first product to start selling."* No decorative illustration.
3. **Error** — inline card with `errorContainer`, plain-language cause, and a Retry button. Never show a raw status code.
4. **Offline** — see below.

### Offline and sync

The POS keeps taking sales without a connection. Two banner states, both **calm and informational — never red, never alarming**:

- **Offline:** low-stock/warning container. *"Offline. Sales are saved on this device."*
- **Pending sync:** tertiary container. *"2 sales waiting to sync."* with a "Retry now" text button.

When sync succeeds, a snackbar: *"2 offline sales synced."* If a queued sale is rejected because stock ran out while offline, that gets a **persistent dismissible error card**, not a snackbar — it needs the shopkeeper's decision, not a glance.

### Snackbars

Bottom-centre on compact, bottom-left on expanded. 4s default, 10s with a Dismiss action for anything money-related.

### RTL / Urdu

The whole layout mirrors when Urdu is selected — this is a hard requirement, not a nice-to-have.

- Nav drawer/rail moves to the right; active-item indicator flips to the item's right edge.
- Tables mirror column order; **numbers and currency stay LTR** (`Rs 1,650` is never reversed).
- Icons with direction (back arrow, chevrons) mirror. Icons without (search, cart, bell) do not.
- Notification panel and dropdowns anchor to the opposite edge.
- Design and present **at least the POS, Dashboard, and Inventory screens in both LTR and RTL.**

---

## 6. Screens

Design each at **1440dp (expanded)** and **390dp (compact)** unless noted.

### 6.1 Login

Centred card, max 420dp, on a `surfaceContainerLow` page. Brand mark (storefront icon) + "RetailPro" wordmark above. Headline Medium: "Sign in to manage your shop". Email and password outlined fields. Filled primary button "Sign In", full width. Text link "New shop? Create an account". Inline error card above the form for failed login.

Include the EN/اردو switch here — a user who can't read English needs it **before** signing in.

### 6.2 Register

Same shell, max 480dp. Fields: Shop Name, Business Type (dropdown: Kiryana Store / General Store / Medical Store / Wholesale Shop / Other), Owner Name, Phone, City, Email, Password. Group into "About your shop" and "Your account" with 24dp separation. Filled button "Create Shop".

### 6.3 Dashboard

Page title "Dashboard".

**Stat card row** — 6 responsive cards (3×2 expanded, 2×3 medium, 1 column compact). Each: Label Medium caption, Headline Small value, a 3dp top accent bar in a role colour. Cards are outlined, `surfaceContainerLowest`.

Cards: Today's Sales (currency), Transactions Today (count), Products in Stock (count), Stock Value (currency), **Low Stock Items** (count, warning accent, tappable → Inventory), **Pending Purchases** (count, tertiary accent, tappable → Purchases). Show the two tappable ones with an affordance — a trailing chevron.

**Charts** — two cards side by side, stacking on compact:
- *Sales — Last 14 Days*: area chart, primary colour, soft vertical gradient fill, horizontal gridlines only, no chart junk.
- *Best Sellers — Last 30 Days*: horizontal bar chart, tertiary colour, 5 bars, product names as the category axis.

Charts must have empty states: *"No sales recorded yet."*

### 6.4 POS — the most important screen

Two-pane on expanded, stacked with a bottom-sheet cart on compact.

**Left — catalogue (flexible width):**
- Search field, full width, placeholder "Search or scan barcode...", leading search icon. Auto-focused.
- A filled tonal "Scan" button beside it with a barcode icon — opens the camera scanner.
- Product tile grid, `minmax(150dp, 1fr)`, 12dp gap. Each tile: product name (Body Large, max 2 lines, ellipsis), price (Title Medium, primary colour), stock badge (semantic colour + quantity + unit).
- Out-of-stock tiles: 38% opacity, not clickable, "Out of stock" label replacing the badge.
- Tiles are large, comfortable tap targets — this is the highest-frequency interaction in the app.

**Right — cart (380dp fixed):**
- Header "Cart" (Title Medium) with an item count badge.
- Sync/offline banner slot directly beneath.
- Cart rows: name + unit price stacked left; a −/quantity/+ stepper; line total right-aligned; a remove icon button. Row dividers, scrollable.
- Empty state: *"No items yet. Tap a product to add it."*
- Footer, visually separated with a divider: Customer dropdown (default "Walk-in customer"), Payment Method (segmented or dropdown: Cash / Card / Credit / JazzCash / EasyPaisa), Discount field.
- Totals block: Subtotal, Discount, then **Total in Display Small** — the single largest number in the entire app.
- Filled primary button, full width, 56dp: **"Charge Rs 1,030"** — the amount is *in the button*, so a cashier confirms the figure without looking elsewhere.

**Credit/khata rule:** selecting "Credit" requires a customer. Show inline validation on the customer field, not a dialog.

### 6.5 Barcode scanner (dialog)

Full-screen on compact, 380dp dialog on expanded. Live camera feed, rounded 12dp. A scan reticle overlay — corner brackets, not a full box. Helper text: "Point the rear camera at the product barcode." Outlined Cancel button.

Design three error states, each with plain-language copy: camera permission denied, no camera found, and **"Camera needs a secure connection"** (this appears on plain-HTTP LAN addresses and will genuinely happen to users).

### 6.6 Inventory

Page title + filled "Add Product" button. Search field below, max 400dp, placeholder "Search by name, SKU, or barcode...".

Table columns: Name, SKU, Category, Stock (semantic badge with quantity + unit), Cost Price, Selling Price, Actions (Edit / Delete icon buttons).

**Product dialog** (max 480dp, 28dp radius): Name; SKU + Barcode side by side; Category dropdown + Unit dropdown side by side; an inline "add new category" row (text field + tonal Add button); Cost Price + Selling Price side by side; Stock Quantity + Low Stock Alert side by side. Outlined Cancel, filled Save.

Show a **live computed margin hint** under the price pair — e.g. *"Margin: 12.1%"* — turning warning-coloured under 15% and error-coloured if negative. Thin margins are a real problem for these shops and this is the moment to surface it.

### 6.7 Categories

Simple table: Name, Urdu Name, Description, Products (count badge), Actions. Filled "Add Category" button. Small dialog: Name, Urdu Name, Description.

Delete confirmation must warn when the category is in use: *"'Grocery' has 4 products. They will become uncategorised. Continue?"*

### 6.8 Sales

Page title "Sales History". Date range filters (From / To date fields) plus a Clear text button.

Table: Receipt, Date, Customer (or "Walk-in"), Items (count), Payment, Total, Status (semantic chip: completed / refunded / voided), Actions (View / Refund).

**Receipt dialog:** styled like an actual thermal receipt — shop name centred, receipt number, timestamp, customer, then a monospace-feel line-item table (Item / Qty / Price / Total), a dashed divider, then Subtotal / Discount / Tax / **Total**. Actions: outlined Close, filled "Download PDF".

Refund is a destructive confirm dialog: *"Refund receipt RCPT-123? Stock will be returned to inventory."*

### 6.9 Purchases

Page title "Purchase Orders" + filled "New Purchase".

Table: Date, Supplier, Invoice #, Items, Total, Paid, Status (chip: pending / received / cancelled), Actions (Receive / Cancel — only on pending rows).

**New PO dialog** (600dp): Supplier dropdown + Invoice # side by side. Then a repeatable line-item row — Product dropdown (flexible), Qty (80dp), Cost (100dp), remove icon — plus a text button "+ Add item". Then Amount Paid field and a read-only Order Total. Cost auto-fills from the product when selected.

"Receive" confirmation: *"Mark as received? Stock will be added to inventory."*

### 6.10 Suppliers

Table: Name, Contact Person, Phone, Balance Owed (semantic — warning when above zero), Actions. Search by name or phone. Dialog: Name, Contact Person, Phone, Email, Address.

### 6.11 Customers

Table: Name, Phone, **Khata Balance** (warning colour when above zero — this is money the customer owes the shop, a concept every shopkeeper here understands instantly), Actions. Dialog: Name, Phone, Email, Address.

### 6.12 Expenses

An inline entry card at the top rather than a dialog — expenses get logged quickly and often. Row: Title, Amount, Category dropdown (Rent / Utilities / Salaries / Transport / Maintenance / Supplies / Other), then a Note field, then a filled "+ Record Expense" button.

Table below: Date, Title, Category (chip), Amount, Actions. **Footer row with the period total**, right-aligned and bold.

### 6.13 Reports

Six scrollable filter chips (M3 filter chip, single-select): Profit & Loss, Best Sellers, Fast Moving, Reorder Suggestions, Low Margin, Dead Stock.

- **Profit & Loss** — a date-range caption, then 5 stat cards: Revenue, Cost of Goods Sold, Gross Profit, Expenses, **Net Profit** (green when positive, red when negative, visually emphasised above the others).
- **Best Sellers** — ranked table: #, Product, Units Sold, Revenue.
- **Fast Moving** — Product, Sold (30d), Per Day, In Stock, **Days of Cover** (semantic badge; warning under 7 days). Explanatory caption above: *"Days of cover is how long current stock lasts at the recent selling rate."*
- **Reorder Suggestions** — Product, In Stock, Per Day, **Order Qty** (bold, the actionable number), Est. Cost, Supplier. Caption shows the estimated grand total. Add a "Send order to supplier on WhatsApp" tonal button per supplier group.
- **Low Margin** — Product, Cost, Selling, Profit/Unit, Margin % (warning chip, error chip with "(loss)" when negative).
- **Dead Stock** — Product, SKU, Stock, Tied-up Capital. Caption: *"Products with stock but zero sales in 60 days — capital sitting idle on your shelves."*

Every tab needs a genuine empty state — e.g. Dead Stock: *"No dead stock. Every product is moving."*

### 6.14 Staff

Page title + filled "Add Staff". Explanatory caption about what each role can do.

Table: Name (with "(you)" suffix on own row), Email, Role (chip), Extra Permissions (comma list, or "full access" for owner), Last Login, Status (active / suspended chip), Actions (Edit / Suspend / Remove).

The **owner row is protected** — no action buttons, just the text "owner account".

**Staff dialog:** Name; Email + Temporary Password (creation only, with helper text *"Share this with them and ask them to change it from their Profile page."*); Phone + Role side by side; then a **permissions checkbox grid** in an outlined container. Permissions already granted by the chosen role appear checked, disabled, and greyed with a small "from role" tag — so it's obvious what's inherited versus individually granted.

### 6.15 Profile

Three stacked cards:

1. **Your Details** — Name, Phone (editable); Email, Role (read-only, `surfaceContainer` fill, with helper text "Ask the shop owner to change your email").
2. **Change Password** — Current Password; New + Confirm side by side. Show a password strength hint and a clear mismatch error.
3. **What You Can Do** — the user's effective permissions as assist chips. For a plain cashier with none: *"You can ring up sales and look up products. Ask the shop owner if you need more access."*

### 6.16 Settings

Owner-only. Three cards:

1. **Language** — EN / اردو segmented button with caption "Urdu uses right-to-left layout."
2. **Shop Profile** — Shop Name + Business Type; Owner Name + Phone; City + Address.
3. **WhatsApp Alerts** — WhatsApp Number (placeholder `923001234567`) + Default Low Stock Threshold. Caption listing the schedule: *"Daily sales reports at 9:00 PM, low stock alerts at 8:00 AM, weekly profit summary Sunday evening (Pakistan time)."* Actions: filled "Save Settings", tonal "Send Low Stock Alert Now".

For non-owners the whole screen is read-only with the note *"Only the shop owner can change these settings."*

### 6.17 Notification panel

Anchored dropdown from the bell, 330dp, 12dp radius, elevation 3.

Header "Notifications" + "Mark all read" text button. Each item: type tag (Label Small, primary, uppercase) + relative timestamp on one row; title beneath; WhatsApp delivery status as Body Small when applicable (sent / failed / skipped — `failed` in error colour).

Unread rows carry a subtle `primaryContainer` tint and a 3dp leading bar. Empty: *"No notifications yet. Stock alerts and daily reports will appear here."*

---

## 7. Responsive breakpoints

| Window | Layout |
|---|---|
| Compact `<600dp` | Bottom nav, single column, tables → stacked cards, POS cart → bottom sheet, dialogs → full screen |
| Medium `600–839dp` | Navigation rail, 2-column stat grid, tables scroll horizontally in-container |
| Expanded `840–1239dp` | Navigation rail, 3-column stat grid, POS two-pane |
| Large `≥1240dp` | Permanent drawer, full tables, max content width 1440dp centred |

---

## 8. Accessibility

- WCAG AA minimum: 4.5:1 body text, 3:1 large text and UI boundaries. Verify the low-stock amber pairing specifically — amber-on-white commonly fails.
- Never encode meaning in colour alone. Every semantic badge carries text.
- Full keyboard operation. The POS must be fully driveable by keyboard for wedge-scanner workflows: scan → Enter adds to cart, without touching the mouse.
- Visible focus indicators — 2dp `primary` outline with 2dp offset.
- 48×48dp minimum touch targets, no exceptions.
- Design at 200% browser zoom without horizontal page scroll.

---

## 9. Deliverables

1. All 17 screens/surfaces at 1440dp and 390dp.
2. POS, Dashboard, and Inventory additionally in **Urdu RTL**.
3. All four states (loading / empty / error / offline) for POS, Inventory, Sales, and Reports.
4. A component sheet: buttons, text fields, chips, badges, table row, stat card, product tile, cart row, dialog shell, snackbar, nav rail, nav drawer, bottom nav.
5. Design tokens exported as CSS custom properties, named by M3 role (`--md-sys-color-primary`, etc.) so they map straight onto the existing codebase.

---

## 10. Explicitly avoid

- Dark theme (out of scope for this pass).
- Decorative illustration or mascots.
- Purple/indigo "SaaS" palettes and multi-stop gradients.
- Animated page transitions on POS.
- Icon-only actions without a tooltip or label.
- Placeholder text used *instead of* a field label.
- Currency without the `Rs` prefix.
- Nastaliq for tables, buttons, or any dense UI text.
