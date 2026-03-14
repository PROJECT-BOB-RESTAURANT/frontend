# Restaurant Floor Planner

Restaurant layout planning app built with React + Vite. The app supports:

- Multiple restaurants
- Per-restaurant floor management
- Per-floor drag-and-drop object editing
- JSON import/export for layouts

## 1. Tech Stack

- React 19
- Zustand for global app/editor state
- dnd-kit for drag and drop
- Tailwind CSS v4 via `@tailwindcss/vite`
- Vite for build/dev tooling

## 2. High-Level Flow

The app has 3 top-level screens controlled by `page` in the store:

1. `restaurant-management`
	 Pick/create/rename/delete restaurants.
2. `management`
	 Manage floors for the currently active restaurant.
3. `editor`
	 Edit a specific floor on the canvas.

User journey:

1. Open restaurant
2. Choose a floor
3. Enter editor
4. Drag objects from library to canvas
5. Tune object properties in side panels
6. Save/load/export/import layout

## 3. Project Map (File-Tagged)

### Core Entry

- `src/main.jsx`
	React bootstrap, mounts `<App />`.
- `src/App.jsx`
	Top-level route-like UI switching between restaurant page, floor page, and editor page. Also hosts `DndContext` and drag-end logic.
- `src/index.css`
	Global styles, font setup, Tailwind import.

### State Layer

- `src/store/useFloorStore.js`
	Single source of truth for:
	- Restaurants
	- Floors per restaurant
	- Current editor state (selected object, zoom, pan, mode)
	- CRUD actions for restaurants/floors/objects
	- Export/import behavior

### Editor UI

- `src/components/Canvas/CanvasEditor.jsx`
	Canvas viewport, background grid, pan/zoom interactions, droppable target.
- `src/components/Sidebar/ObjectLibrary.jsx`
	Left panel for object presets and floor-level actions (snap toggle, save/load/export/import).
- `src/components/Sidebar/LibraryItem.jsx`
	Draggable source item for object presets.
- `src/components/Inspector/InspectorPanel.jsx`
	Right panel for selected object property editing + JSON panel.
- `src/components/FloorObjects/FloorObjectItem.jsx`
	Render wrapper for placed object instance, handles object dragging and selection.
- `src/components/FloorObjects/ObjectRenderer.jsx`
	Visual renderer for each object type (table, stairs, door, etc).

### Hooks + Utilities

- `src/hooks/useKeyboardShortcuts.js`
	Global keyboard behavior (`Delete/Backspace`, `Ctrl/Cmd + D`).
- `src/utils/grid.js`
	Grid utilities (`snapToGrid`, `toWorldPoint`, `clamp`, anchor origin mapping).
- `src/utils/objectLibrary.js`
	Object preset catalog and lookup helpers.

## 4. State Model Explained

Defined in `src/store/useFloorStore.js`.

Key state slices:

- `page`: active screen (`restaurant-management` | `management` | `editor`)
- `restaurants`: list of restaurant records
- `currentRestaurantId`: active restaurant context
- `floors`: active restaurant floors loaded into workspace
- `currentFloorId`: floor currently open in editor context
- `objects`: object instances for the currently loaded floor
- `selectedObjectId`: selected object for property editing
- `canvasZoom`, `canvasPosition`: camera/viewport state
- `editorMode`: `view` or `edit`
- `snapEnabled`: toggles grid snapping

Important design choice:

- The store keeps a working floor/object set in memory for fast editing.
- Before context switches (floor or restaurant switch, back navigation), helper functions persist current working changes back into the right restaurant/floor record.

This avoids losing in-progress changes while moving between screens.

## 5. Drag-and-Drop Pipeline

### Source types

- Library item drag (`source: 'library'`): create new object from preset
- Canvas item drag (`source: 'canvas'`): move existing object

### Lifecycle

1. `DndContext` in `src/App.jsx` captures `onDragEnd`
2. Drop target must be canvas droppable id `floor-canvas`
3. For library drops:
	 - Read preset from `src/utils/objectLibrary.js`
	 - Convert screen coords to world coords via `toWorldPoint` (`src/utils/grid.js`)
	 - Center object under cursor
	 - Optionally snap
	 - Call `addObjectFromPreset`
4. For canvas drags:
	 - Convert delta by zoom
	 - Optionally snap
	 - Call `moveObjectByDelta`

## 6. Rendering and Performance Notes

- `FloorObjectItem` and `ObjectRenderer` are memoized (`memo`) to reduce unnecessary rerenders.
- Zustand selectors are used per-field to limit subscription updates.
- Object visual rendering is separated from interaction wrapper, making it easier to optimize or replace visuals independently.

## 7. JSON Import/Export Behavior

Current export/import in `src/store/useFloorStore.js` is floor-layout oriented:

- Export includes current restaurant metadata plus floors payload.
- Import supports:
	- Legacy schema with top-level `objects`
	- Current schema with `floors`

Import updates floors for the currently active restaurant.

## 8. How To Run

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
npm run preview
```

## 9. Quick Start

Use this if you want to get productive in under 2 minutes.

1. Start the app:

```bash
npm install
npm run dev
```

2. Open the browser URL printed by Vite.
3. On the `Restaurants` page, click `Add New Restaurant`.
4. Open that restaurant and click `Add New Floor`.
5. Click `Edit` on a floor to enter the canvas editor.
6. Drag objects from the left sidebar onto the canvas.
7. Select an object and edit properties in the right inspector.
8. Use `Save`/`Load`/`Export`/`Import` in the left panel to persist layouts.

Keyboard shortcuts:

- `Delete` / `Backspace`: delete selected object
- `Ctrl/Cmd + D`: duplicate selected object

Canvas controls:

- Mouse wheel: pan canvas
- `Ctrl + wheel`: zoom canvas
- Drag empty canvas space: pan canvas

## 10. How To Modify or Extend

### Add a new object type

1. Add preset in `src/utils/objectLibrary.js`:
	 - new `id`
	 - `label`
	 - default `config` (size, metadata)
2. Add visual branch in `src/components/FloorObjects/ObjectRenderer.jsx` based on `object.type`.
3. Optional: add extra metadata controls in:
	 - `src/components/Sidebar/ObjectLibrary.jsx`
	 - `src/components/Inspector/InspectorPanel.jsx`

### Add a new editable property

1. Store value in object `metadata` via `updateObject` in `src/store/useFloorStore.js`.
2. Add input control in inspector/sidebar.
3. Use the new metadata in `ObjectRenderer`.
4. Ensure export/import naturally carries it via `metadata` object.

### Add a new page-level mode

1. Extend `page` options in `src/store/useFloorStore.js`.
2. Add action(s) that set the new page.
3. Add branch in `src/App.jsx` rendering the page.

### Persist restaurants/floors remotely (API)

1. Keep current store actions as UI-level intent.
2. Replace or augment persistence helpers with async calls.
3. Introduce loading/error state at store level.
4. Keep a normalization step before writing to state.

### Add undo/redo

1. Add `history` and `future` stacks in `src/store/useFloorStore.js`.
2. Push snapshots on mutating actions (`addObject`, `updateObject`, delete, floor operations).
3. Add `undo`/`redo` actions and keyboard shortcuts in `src/hooks/useKeyboardShortcuts.js`.

## 11. Conventions Used

- Object IDs: generated with `crypto.randomUUID` prefixing (`obj_`, `floor_`, `restaurant_`).
- Coordinates/sizes: stored in world units, often snapped to grid.
- Metadata-first extensibility: extra object properties live in `metadata` to avoid rigid schema growth.
- UI concern split:
	- Canvas interaction
	- Object rendering
	- Property editing
	- Store orchestration

## 12. Troubleshooting

- Objects not dropping on canvas:
	Check `DndContext` and canvas droppable id `floor-canvas` in `src/App.jsx` and `src/components/Canvas/CanvasEditor.jsx`.
- Unexpected object jump while dragging:
	Verify zoom conversion and snap logic in `src/App.jsx` and `src/utils/grid.js`.
- Imported layout not loading:
	Confirm JSON has either `objects` (legacy) or `floors` (current schema).
- Changes lost when switching context:
	Inspect persistence helpers in `src/store/useFloorStore.js` (`persistCurrentFloor`, restaurant persistence helpers).
