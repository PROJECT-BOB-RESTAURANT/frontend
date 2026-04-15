# Restaurant Floor Planner

Restaurant Floor Planner is a React + Vite app that combines floor-layout design, waiter table operations, and guest booking in one interface.

The current build is frontend-first (Zustand in-memory state), structured so backend APIs can be introduced incrementally.

## 1. Product Snapshot

Current capabilities:
- Default login page with account sign-in.
- Admin-only pre-page with entry options for user management and restaurant management.
- Simplified restaurant list cards with a single `Manage Restaurant` action.
- Sectioned restaurant management hub with dedicated `Restaurant Management`, `Floor Manager`, and `Staff Manager` areas.
- Fixed user status widget (bottom-left) showing current username and role, with hide and logout actions.
- Dedicated workers management page where restaurant workers are assigned from searchable system users.
- Multi-restaurant management with isolated data contexts.
- Per-restaurant floor management and canvas editing.
- Table metadata with seat counts and labels.
- Waiter table management (orders + reservations + occupancy).
- Staff kitchen touchscreen workflow (incoming queue, color-coded statuses, timing panel).
- Reservation statistics page with per-floor/per-table occupancy timelines and direct reservation creation.
- Manager analytics cards in reservation statistics for served income, open ticket value, reservation totals, active reservations, and floor-level reservation breakdown.
- Analytics diagrams in reservation statistics for revenue split and per-floor reservation distribution.
- Floor-wide reservation action that reserves all tables on a selected floor for the same customer and time window.
- Guest reservation flow (restaurant -> floor -> table -> booking).
- Restaurant operations setup (workers, opening hours, nested menu catalog).

Main user groups:
- Planner or manager: builds restaurant layout and operational metadata.
- Waiter or floor staff: manages table orders and reservation states.
- Guest or host operator: creates new bookings quickly.

## 2. Quick Start

Install and run development server:

```bash
npm install
npm run dev
```

Run backend and database before frontend for full API behavior:

```bash
cd ../database
sudo docker compose up -d

cd ../backend
./mvnw spring-boot:run

cd ../frontend
npm run dev
```

When the app opens, the first screen is the login page.

- `POST /api/v1/auth/login` is used for sign-in.
- Successful sign-in stores JWT session data in browser storage and uses `Authorization: Bearer <token>` on protected API calls.

Build and preview production output:

```bash
npm run build
npm run preview
```

### API Base URL

Frontend uses `VITE_API_BASE_URL` when provided.
If not set, it defaults to `/api/v1`.

In development, Vite proxies `/api/*` to `http://localhost:8080`.

## 3. Current Uses

## 3.1 Planning Workflow

Use the app to set up a restaurant for service:
1. Create restaurant.
2. Add floors.
3. Open floor editor.
4. Place objects and tables.
5. Set table seats and labels.

## 3.2 Operations Workflow

Use waiter mode for in-service table operations:
1. Open table in waiter manager from `Manage Table` or jump directly to reservations from `Manage Reservation`.
2. Add catalog or custom order items.
3. Set worker attribution.
4. Add reservations or manual occupancy.
5. Monitor timeline and table status.

Use reservation statistics for floor-level booking blocks:
1. Open reservation statistics.
2. Select a floor and choose `Reserve Entire Floor`.
3. Fill customer and time range once.
4. Save to create reservations across all persisted tables on that floor.

Use kitchen mode for back-of-house ticket flow:
1. Open kitchen for a restaurant (staff entry).
2. Review incoming tickets in created-time order.
3. Move line statuses through incoming, in progress, prep, ready, and served.
4. Open ticket timing panel to inspect queue/prep/wait durations.

## 3.3 Booking Workflow

Use guest reservation page to create bookings:
1. Select restaurant.
2. Select floor.
3. Select table.
4. Enter guest details and time range.
5. Submit reservation.

## 4. How The App Works

## 4.1 Navigation Model

The app uses store-driven page state (not React Router).

Authentication is handled before store-driven navigation: unauthenticated users see the login page first.

Defined page values:
- `restaurant-management`
- `management`
- `editor`
- `waiter-management`
- `kitchen-management`
- `reservation-statistics`
- `guest-reservation`

Additional app-level admin views:
- `admin-home`
- `admin-users`

Key files:
- `src/App.jsx`: top-level page switch that composes route-level page components.
- `src/hooks/useAppController.js`: application orchestration for backend loading, CRUD flows, and editor drag/drop handlers.
- `src/pages/*.jsx`: route-level page components for restaurant management, floor management, and editor screens.
- `src/store/useFloorStore.js`: navigation actions and all domain state.

Management hub behavior:
- Restaurant list is intentionally minimal and only opens selected restaurant management.
- Restaurant-specific actions are grouped on the management screen:
	- `Management Menu`: split into `Restaurant Manager Buttons` and `Staff Managing Buttons`.
	- `Restaurant Manager Buttons`: kitchen, reservation stats, guest page, rename/delete restaurant.
	- `Admin Buttons`: restaurant rename/delete actions.
	- `Floor Manager`: floor list and floor CRUD/editor actions, menu/opening-hours management tools.
	- `Staff Managing Buttons`: worker management page entry.

## 4.2 State and Domain Model

State is centralized in Zustand (`src/store/useFloorStore.js`).

Top-level entities:
- `restaurant`: contains floors, workers, opening hours, menu tree.
- `floor`: contains canvas parameters and floor objects.
- `floor object`: geometry + metadata; table objects hold seats/orders/reservations.
- `worker`: name + role for assignment and attribution.
- `goods catalog`: nested folders and priced menu items.
- `reservation`: time-range booking tied to a table object.
- `order line`: table-bound item with qty, status, price, worker attribution.

Important runtime behavior:
- Active floor edits are persisted back to current restaurant when navigating.
- Restaurant switching isolates each restaurant dataset.
- Backend endpoints are the source of truth; Zustand holds synchronized client state for rendering and interactions.

## 4.3 Layout Editor Flow

Layout flow:
1. Open restaurant -> floor -> editor.
2. Drag object preset from library to canvas.
3. Move/resize/rotate objects.
4. Edit metadata in inspector (including table seats).
5. Export/import floor data as needed.

Technical notes:
- Canvas interactions are handled through `dnd-kit`.
- Grid snapping and zoom/position are managed via store state.

## 4.4 Waiter Flow

Waiter panel has two operation sections:
- `orders`: add catalog/custom items, adjust qty/status/price, assign worker.
- `reservations`: add/remove/extend reservations, manual occupancy control, timeline view.

Status behavior:
- Table shown as free (green) when no active reservation/manual occupancy.
- Table shown as occupied/reserved (red) when active reservation or manual occupancy exists.

## 4.5 Reservation and Occupancy Rules

Current implemented rules:
- Default reservation duration: 3 hours when end time is omitted or invalid.
- Reservation party size is clamped to minimum 1.
- Multiple reservations can exist per table.
- Reservation timeline can be inspected per selected day.
- Manual occupancy can be set, extended, and cleared.

## 5. Options Available in the UI

## 5.0 Authentication Options

From login page:
- Sign in with username and password
- Continue to management pages after successful authentication

From authenticated pages:
- See active username and role in the bottom-left user status widget
- Logout and return to login page
- For admins in restaurant flow: return to admin pre-page using the `Admin` button in the user status widget

Admin-only pre-page:
- `Manage Users`: open admin user creation screen
- `Manage Restaurants`: continue to restaurant list and operations

### Backend Integration Notes

- Restaurant and floor create/rename/delete operations are connected to backend endpoints.
- Worker and menu-folder/menu-item management is connected to backend endpoints.
- Guest reservations are created through backend reservation endpoints.
- Waiter orders and reservations are loaded and persisted through backend table/order/reservation endpoints.
- Floor-object editing remains interactive in-canvas and is persisted with the `Save Floor Layout` button.
- Table-level backend calls only run for persisted table UUIDs; unsaved local table IDs are blocked in frontend with a save-layout message.
- Floor planner now refreshes reservation data for all tables on the current floor after backend hydration and restaurant/floor switch, so free/reserved colors stay in sync after user changes.
- Opening-hours changes are persisted with the `Save Opening Hours` button.

## 5.1 Restaurant Management Options

From restaurants view:
- Add restaurant
- Open selected restaurant via `Manage Restaurant`

From restaurant management hub (`Restaurant Management` section):
- Open kitchen
- Open reservation statistics
- Open guest reservation page

From restaurant management hub (`Admin Buttons` section):
- Rename restaurant
- Delete restaurant

From restaurant management hub (`Floor Manager` section):
- Add floor
- Rename floor
- Delete floor
- Open floor in view mode
- Open floor in edit mode
- Manage opening hours per day
- Mark day as closed
- Manage nested menu folders
- Manage menu items with pricing

From restaurant management hub (`Staff Manager` section):
- Open dedicated workers page

From workers page:
- Search users by username
- Assign selected user as worker for the current restaurant
- Set worker role at assignment time
- Update assigned worker role
- Remove worker from restaurant

## 5.2 Floor and Editor Options

From floor management:
- Open floor in view mode
- Open floor in edit mode
- For manager/admin: add floor, rename floor, delete floor

From editor:
- Switch edit/view mode
- Place object presets
- Move objects
- Edit object dimensions and metadata
- Set table seats
- Toggle snapping
- Export and import floor data (admin only)

Confirmation dialogs:
- Delete restaurant requires explicit confirmation.
- Save Floor Layout requires explicit confirmation.
- Save Opening Hours requires explicit confirmation.

Floor planner UX behavior:
- Touch-friendly controls with larger tap targets in the top toolbar and side panels
- Canvas panning supports touch/pen drag for tablet navigation
- Floor planner toolbar includes a `Time` selector to preview table free/reserved colors at any chosen datetime
- Floor planner `Time` includes `-` and `+` step buttons (30 minutes) for quick backward/forward availability preview
- Floor viewer toolbar includes a `Restore View` button to instantly return canvas zoom and position to centered defaults
- JSON layout tools are visible only for admin users
- Staff users in planner view only get table service actions (no object data editing panels), including `Manage Table` and `Manage Reservation` when selecting a table
- Manager and admin can place new library elements in both edit mode and table/view mode
- Planner side panels use larger widths/heights for easier touch navigation

Keyboard shortcuts:
- `Delete` or `Backspace`: delete selected object
- `Ctrl/Cmd + D`: duplicate selected object

## 5.3 Waiter Options

Order operations:
- Add custom order line
- Add menu item line
- Increment/decrement quantity
- Set status
- Set unit price
- Assign worker
- Remove order line
- Clear all table orders
- Receive ready-to-serve notifications for own placed orders with item and table/floor context

Reservation operations:
- Add reservation with guest details
- Remove reservation
- Extend reservation by minutes
- Mark table occupied (quick duration)
- Extend manual occupancy
- Clear manual occupancy
- View day timeline with current-time marker

## 5.4 Kitchen Options

Kitchen operations:
- View active kitchen queue in incoming order
- See table, server, note, quantity, and price per line
- Tap quick status actions with color-coded states
- Auto-hide served lines from active queue (with optional served toggle)
- Inspect per-ticket timing stats (queue, in progress, prep, waiting for server, total)

## 5.5 Reservation Statistics Options

Reservation statistics operations:
- Select restaurant and day
- Inspect occupancy timeline for each table grouped by floor
- View closed (non-operating) periods directly on timelines
- Add reservation directly from any table timeline row

## 5.4 Guest Reservation Options

Guest page options:
- Select restaurant/floor/table
- Enter guest name
- Enter party size
- Pick start and end time
- Add optional note
- Submit with inline success/error feedback

## 6. How It Should Work (Behavior Contract)

Use these rules as the product contract for future work.

## 6.1 Isolation and Scoping

- Restaurant data must stay isolated.
- Floor, object, worker, menu, reservation, and order operations are always scoped to current restaurant.
- Switching context must not leak or overwrite other restaurants.

## 6.2 Table Integrity

- Only table-like object types accept reservation/order operations.
- Seat count should always resolve to at least 1 for table objects.

## 6.3 Reservation Integrity

- End time must be after start time.
- Missing/invalid end time defaults to start + 3h.
- Timeline view should render reservations overlapping selected day.
- Current occupancy status must be time-correct.

## 6.4 Order Integrity

- Quantity cannot go below 1.
- Price cannot be negative.
- Worker assignment is optional but must remain stable on updates.
- Clear-all actions should not affect reservations.

## 6.5 Opening Hours Integrity

- Closed days should not require valid open/close values.
- Open days should carry valid open and close times.

## 6.6 UX Integrity

- Navigating between pages should preserve active work state.
- Waiter panel should clearly distinguish order tools from reservation tools.
- Table color should instantly reflect occupancy state changes.

## 7. Scenarios

## 7.1 Scenario: Onboarding a New Restaurant

Goal:
- Bring a new location from empty to operational.

Steps:
1. Create restaurant `City Center`.
2. Add floors `Main Hall` and `Terrace`.
3. Add workers (2 waiters, 1 manager).
4. Configure opening hours, mark Sunday closed.
5. Add menu folders and items.

Expected outcome:
- Restaurant is operationally configured and ready for layout editing + service.

## 7.2 Scenario: Designing Service Layout

Goal:
- Prepare table map for dinner shift.

Steps:
1. Open `Main Hall` in editor.
2. Add table objects and non-table structure objects.
3. Set seats and labels per table.
4. Save/export floor data.

Expected outcome:
- Accurate service map with valid table metadata.

## 7.3 Scenario: Active Service Table Handling

Goal:
- Run full waiter interaction on one table.

Steps:
1. Open table in waiter manager.
2. Choose worker attribution.
3. Add two catalog items and one custom item.
4. Mark one line served.
5. Adjust one line quantity and price.

Expected outcome:
- Orders reflect current service state and remain editable.

## 7.4 Scenario: Reservation Traffic Window

Goal:
- Manage overlapping time windows across one evening.

Steps:
1. Add reservation 18:00-21:00.
2. Add second reservation 21:30-23:00.
3. Extend first by 30 minutes.
4. Switch timeline date and inspect bars.

Expected outcome:
- Timeline and table status remain consistent with time windows.

## 7.5 Scenario: Walk-In Occupancy Without Reservation

Goal:
- Reflect real occupancy without a formal booking.

Steps:
1. Mark table manually occupied for 3h.
2. Extend by 30m near the end.
3. Clear occupancy when guests leave.

Expected outcome:
- Table status red while occupied, then green once cleared.

## 7.6 Scenario: Guest Self-Booking

Goal:
- Allow booking from guest page with minimal friction.

Steps:
1. Open guest reservation page.
2. Choose restaurant, floor, and table.
3. Enter guest details and party size.
4. Submit booking.

Expected outcome:
- Booking is created and appears in waiter reservation list/timeline.

## 7.7 Scenario: Multi-Restaurant Isolation Regression Check

Goal:
- Verify no cross-restaurant data bleed after edits.

Steps:
1. Create Restaurant A and B.
2. Add unique floors/workers/menu/reservations in A.
3. Switch to B and validate independent datasets.

Expected outcome:
- No A data appears in B context.

## 8. Extending The App With New Features

This section is the implementation playbook for new features.

## 8.1 Extension Pattern (Recommended)

For almost every feature, follow this sequence:
1. Add or extend domain shape in `useFloorStore`.
2. Add store actions for create/read/update/delete behavior.
3. Wire actions into page/component UI.
4. Update helper utilities in `src/utils` if logic is shared.
5. Add clear UX messaging and fallback states.
6. Validate behavior with manual scenario tests.

Why this pattern:
- Keeps feature state transitions centralized.
- Prevents one-off logic duplication in components.
- Makes backend API integration easier later.

## 8.2 Add a New Object Type

Example: add a `bar_counter` object preset.

Update locations:
- `src/utils/objectLibrary.js`
	- Add new preset in the catalog.
	- Configure default size/metadata.
- `src/components/FloorObjects/ObjectRenderer.jsx`
	- Add visual rendering branch if needed.
- `src/components/Inspector/InspectorPanel.jsx`
	- Add editable fields if type needs custom metadata.

Rules:
- If object should support reservations/orders, include it in table-type logic.
- If not, keep it non-table to avoid waiter operations.

## 8.3 Add a New Restaurant-Level Module

Example: add "delivery zones" management.

Steps:
1. Add `deliveryZones` to restaurant shape in store.
2. Add actions (`addDeliveryZone`, `updateDeliveryZone`, `deleteDeliveryZone`).
3. Create component under `src/components/Management/`.
4. Mount component from restaurant management page.
5. Add a scenario in this README and verify isolation across restaurants.

## 8.4 Add a New Waiter Capability

Example: add "split bill" support.

Steps:
1. Extend order model in `useFloorStore` with split metadata.
2. Add pure helper functions for split calculations.
3. Add UI in `src/components/Waiter/WaiterPanel.jsx`.
4. Preserve existing order flow compatibility.
5. Add edge-case scenario: split after partial serve.

## 8.5 Add a New Page

Current navigation is store-driven, so add a page by:
1. Adding new `page` value in store.
2. Adding open/back actions in store.
3. Handling new branch in `src/App.jsx` page rendering.
4. Ensuring state persistence behavior remains correct when navigating.

## 8.6 Prepare for Backend Integration

When replacing local store persistence with API calls:
1. Keep domain model and action names stable where possible.
2. Wrap API calls in a service/client layer (do not spread fetch calls across components).
3. Make optimistic updates optional per feature.
4. Keep error boundaries and user feedback consistent.
5. Migrate screen by screen, not all at once.

## 8.7 Extension Checklist

Before shipping any new feature, confirm:
- Restaurant scoping is preserved.
- Existing scenarios still pass.
- No table-status regression.
- New options are documented in README.
- Build passes (`npm run build`).

## 9. Architecture and File Map

- `src/App.jsx`: page orchestration and drag-drop bridge.
- `src/store/useFloorStore.js`: central domain state + all mutations.
- `src/components/Canvas/CanvasEditor.jsx`: drawing area and interactions.
- `src/components/Sidebar/ObjectLibrary.jsx`: preset library and editor tools.
- `src/components/Inspector/InspectorPanel.jsx`: selected-object editing.
- `src/components/FloorObjects/ObjectRenderer.jsx`: object visuals and occupancy color.
- `src/components/FloorObjects/FloorObjectItem.jsx`: per-object wrapper interactions.
- `src/components/Management/RestaurantGoodsManager.jsx`: workers, opening hours, menu tree.
- `src/components/Waiter/WaiterPanel.jsx`: waiter operations and timeline.
- `src/components/Guest/GuestReservationPage.jsx`: guest booking entry.
- `src/utils/objectLibrary.js`: preset definitions + table-type helpers.
- `src/utils/reservations.js`: reservation normalization and active-state helpers.
- `src/hooks/useKeyboardShortcuts.js`: keyboard handling for editor actions.

## 10. Tech Stack

- React 19
- Zustand
- dnd-kit
- Tailwind CSS v4 via `@tailwindcss/vite`
- Vite 7

## 11. Known Limits

- No backend API persistence yet.
- No authentication/authorization yet.
- No multi-user synchronization or conflict resolution yet.
- No audit log/history for changes yet.

## 12. Next Recommended Milestones

1. Add backend APIs for restaurants/floors/objects.
2. Persist reservations and orders server-side.
3. Add auth and role permissions (manager/waiter/guest).
4. Add automated tests for critical scenarios listed above.
