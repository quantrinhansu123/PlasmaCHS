# Vỏ Bình Field Extension Plan

## Overview
The goal is to modify the system's "Add New Cylinder Shell" (Thêm mới vỏ bình) feature to include two new fields: **Customer (Khách hàng)** and **Warehouse (Kho)**. This allows better tracking of where a cylinder shell is currently assigned when created or edited in the system.

## Project Type
WEB

## Success Criteria
- The "Create Cylinder" page and "Edit Cylinder" modal display select dropdowns for Customer & Warehouse.
- The dropdowns correctly load options from the `customers` and `warehouses` tables in Supabase.
- New cylinders are saved with correct `customer_id` and `warehouse_id`.
- Existing cylinders are updated with changes to these fields properly.

## Tech Stack
- **Frontend:** React (Vite.js) + Tailwind CSS + Lucide React
- **Backend/DB:** Supabase (PostgreSQL)

## File Structure
Changes will occur in:
- `src/pages/CreateCylinder.jsx`
- `src/components/Cylinders/CylinderFormModal.jsx`
- (Optional) database schema alterations via Supabase Dashboard if columns do not exist.

---

## Task Breakdown

### Task 1: Identify Schema & Update if Necessary
- **Agent**: `database-architect`
- **Skills**: `database-design`
- **Priority**: P0
- **Dependencies**: None
- **INPUT**: Database structure at Supabase.
- **OUTPUT**: Confirmation or creation of `customer_id` and `warehouse_id` as foreign keys in the `cylinders` table.
- **VERIFY**: The schema can successfully store associations natively.

### Task 2: Fetch Associations for the UI Forms
- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`, `clean-code`
- **Priority**: P1
- **Dependencies**: Task 1
- **INPUT**: `CreateCylinder.jsx` and `CylinderFormModal.jsx`
- **OUTPUT**: Setup local state variables (e.g., `customersList`, `warehousesList`) and fetch them within a `useEffect` on component mount via `supabase.from('customers').select('*')` etc.
- **VERIFY**: Data streams successfully output available options in console/React DevTools without infinite loops.

### Task 3: Build UI and Connect Save Actions
- **Agent**: `frontend-specialist`
- **Skills**: `frontend-design`, `clean-code`
- **Priority**: P1
- **Dependencies**: Task 2
- **INPUT**: Fetched lists, existing formData struct.
- **OUTPUT**: Add standard `<select>` dropdowns into the UI grid. Update the `defaultState` and `handleCreateCylinder`/`handleSubmit` functionality to parse the associations into payload appropriately.
- **VERIFY**: Perform a manual add & edit test to verify payload is mapped into DB. 

---

## ✅ PHASE X COMPLETE
- Lint: [ ] Pending
- Security: [ ] Pending
- Build: [ ] Pending
- Date: [Pending]
