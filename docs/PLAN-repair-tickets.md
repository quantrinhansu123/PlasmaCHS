# PLAN: Repair Tickets Module

This project plan outlines the implementation of the "Ticket sửa chữa" (Repair Ticket) module to track and manage equipment repairs and technical feedback.

## User Review Required

> [!IMPORTANT]
> **Key Field Behaviors**
> 1. **Mã thiết bị**: Type-to-select with auto-fill for Machine Name.
> 2. **Loại Lỗi**: Dropdown with a custom "+" button to add new error types dynamically.
> 3. **Roles**: "Kinh doanh" (Sales) and "Kỹ thuật" (Technical) will be populated from respective user groups.
> 4. **Multi-Image Support**: Both initial detail and technical feedback sections support multiple images.

## Phase 1: Database Schema

### [NEW] [schema_repair_tickets.sql](file:///c:/Users/dungv/PlasmaVN_Acc/src/database/sql/schema_repair_tickets.sql)
- `stt`: SERIAL ID.
- `ngay`: DATE (default CURRENT_DATE).
- `khach_hang_id`: UUID (FK to `khach_hang`).
- `ma_thiet_bi`: VARCHAR (Linked to `may` table).
- `ten_thiet_bi`: VARCHAR (Auto-populated).
- `loai_loi_id`: UUID (FK to `loai_loi` table, with support for custom strings).
- `loi_chi_tiet`: TEXT (Long text).
- `hinh_anh_chi_tiet`: TEXT[] (Array of image URLs/paths).
- `kinh_doanh_id`: UUID (FK to `users` with Sales role).
- `ky_thuat_id`: UUID (FK to `users` with Technical role).
- `phan_hoi_ky_thuat`: TEXT (Long text).
- `hinh_anh_ky_thuat`: TEXT[] (Array of image URLs).

## Phase 2: Backend & API

### Supabase Integration
- Ensure RLS policies are in place for the new `phieu_sua_chua` table.
- Create storage buckets for repair ticket images.

## Phase 3: Frontend Implementation

### 1. View & List
#### [MODIFY] [RepairTickets.jsx](file:///c:/Users/dungv/PlasmaVN_Acc/src/pages/RepairTickets.jsx)
- Replace placeholder with active ticket list.
- Implement search, status filtering, and sorting by Date/STT.

### 2. Creation / Edit Form
#### [NEW] [RepairTicketForm.jsx](file:///c:/Users/dungv/PlasmaVN_Acc/src/components/Repairs/RepairTicketForm.jsx)
- **UI Architecture**: Follow the `OrderFormModal.jsx` pattern:
  - Sticky header with Ticket ID and status.
  - Sectioned body with `rounded-3xl` cards for field grouping.
  - Floating footer for "Save"/"Cancel" buttons (mobile-friendly).
- **Field: Khách hàng**: Use the custom searchable dropdown from `OrderFormModal`.
- **Field: Mã thiết bị**: Searchable input with auto-completion; auto-fills machine name upon selection.
- **Field: Loại Lỗi**: Dropdown with an inline "+" button to add new entries to a `loai_loi` table.
- **Field: Images**: Multi-image upload component with visual previews, aligned with the app's aesthetic.

## Phase 4: Verification Plan

### Automated Tests
- Test auto-filling machine name by `ma_thiet_bi`.
- Test multi-image upload and deletion.
- Verify role filters for "Kinh doanh" and "Kỹ thuật" dropdowns.

### Manual Verification
- Create a new ticket and verify all fields save correctly.
- Add a new error type via the "+" button and check for persistence.
- Update a ticket with technical feedback and images.
