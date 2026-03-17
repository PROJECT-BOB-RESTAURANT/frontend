## Spring Boot (Backend) + React (Frontend)

This document defines strict rules for AI-generated code. All output must meet production-grade standards.

---

## 🚨 Core Principles

- Produce **senior-level, production-ready code only**
- Enforce **clean architecture and clean code**
- Ensure **readability, scalability, and maintainability**
- Maintain **consistency across backend and frontend**

---

## 🧼 Clean Code Requirements

- Use descriptive, intention-revealing names
- Enforce single responsibility principle
- Keep functions/methods small and focused
- Avoid deep nesting
- Eliminate duplication (DRY)
- Prefer explicit logic over implicit behavior

---

## ❌ Strict Prohibitions

### No Junior-Level Code
- No shortcuts or hacks
- No incomplete implementations
- No ignoring edge cases
- No inconsistent structure

### No Comments in Code
- Do not write comments
- Code must be self-explanatory via naming and structure
- Refactor instead of explaining

---

## 📂 Project Structure

### Backend (Spring Boot)

Follow layered architecture:

- `controller/` → REST endpoints
- `service/` → business logic
- `repository/` → data access
- `model/` or `entity/` → database entities
- `dto/` → request/response objects
- `mapper/` → entity ↔ DTO mapping
- `config/` → configuration classes

Rules:
- No business logic in controllers
- No direct entity exposure in APIs (use DTOs)
- Services must encapsulate logic
- Repositories only handle persistence

---

### Frontend (React)

Use modular, scalable structure:

- `components/` → reusable UI components
- `pages/` → route-level components
- `services/` → API calls
- `hooks/` → custom hooks
- `types/` → TypeScript types/interfaces
- `utils/` → helper functions

Rules:
- No API calls directly inside UI components (use services/hooks)
- Keep components small and reusable
- Separate logic from presentation
- Avoid prop drilling (use proper state management if needed)

---

## 🧱 Architecture Rules

### Backend
- Use RESTful design principles
- Validate all inputs
- Handle errors properly (global exception handling)
- Use DTOs for all external communication
- Ensure transactional boundaries where needed

### Frontend
- Use functional components only
- Use hooks for state and lifecycle
- Keep state minimal and localized
- Ensure predictable data flow

---

## 🔗 Backend–Frontend Contract

- API responses must be consistent and predictable
- Use clearly defined DTOs
- Avoid breaking changes
- Maintain alignment between backend models and frontend types

---

## 📘 README Documentation (Mandatory)

Every change must update `README.md`.

### Always include:
- Feature descriptions
- API endpoints (with request/response examples)
- Setup instructions (backend + frontend)
- Environment configuration
- Architecture overview

---

## 🔁 Maintainability Rules

- Code must be easy to extend
- Avoid tight coupling
- Follow consistent patterns
- Ensure high cohesion within modules

---

## ⚙️ Implementation Expectations

### Backend
- Use proper exception handling
- Validate inputs (e.g., annotations)
- Follow Spring Boot best practices
- Use constructor injection only

### Frontend
- Use TypeScript (mandatory)
- Type all props and API responses
- Handle loading and error states properly
- Avoid unnecessary re-renders

---

## 📦 File Discipline

- Never dump everything into one file
- Each file must have a single responsibility
- Split large files into smaller modules

---

## ✅ Definition of Done

A task is complete only if:
- Code is production-ready
- Clean architecture is followed
- No comments are present
- Files are properly separated
- Backend and frontend are aligned
- `README.md` is updated

---

## 🔒 Enforcement

These rules are strict and non-optional.  
Any violation results in rejection of the implementation.

---
