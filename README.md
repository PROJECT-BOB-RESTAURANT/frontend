# Restaurant Floor Planner

A modern drag-and-drop floor planning editor built with React + Vite.

## Stack

- React (JavaScript)
- Zustand (state management)
- dnd-kit (drag and drop)
- Tailwind CSS v4

## Features

- Left object library, center editable floor canvas, right inspector
- Drag objects from library onto the canvas
- Move placed objects with drag-and-drop
- Snap-to-grid placement and transforms
- Resize handles and rotate handle on selected object
- Delete (`Delete` / `Backspace`) and duplicate (`Ctrl/Cmd + D`)
- Canvas zoom and pan (`Ctrl + wheel`, `Space + drag`)
- Inspector controls for position, size, rotation, seats, label
- JSON export/import for layout persistence

## Project Structure

```text
src/
	components/
		Canvas/
			CanvasEditor.jsx
		Sidebar/
			ObjectLibrary.jsx
			LibraryItem.jsx
		Inspector/
			InspectorPanel.jsx
		FloorObjects/
			FloorObjectItem.jsx
			ObjectRenderer.jsx
	store/
		useFloorStore.js
	hooks/
		useKeyboardShortcuts.js
	utils/
		grid.js
		objectLibrary.js
	App.jsx
	main.jsx
	index.css
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Architecture Notes

- `useFloorStore` is the single source of truth for layout objects, selection, and canvas transforms.
- UI components are split by concern: library, canvas interactions, object visuals, and inspector editing.
- Drag behavior is implemented via a single `DndContext` with object/source metadata.
- Visual rendering uses lightweight SVG/div shapes for maintainability and performance.
- Re-render pressure is reduced with memoized object components and selector-based Zustand reads.

## Improvement Ideas

- Multi-select and group transforms
- Undo/redo command stack
- Alignment guides and smart snapping
- Layers panel and lock/hide controls
- Autosave to local storage or backend API
