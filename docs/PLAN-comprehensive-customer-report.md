# PLAN: Báo cáo khách hàng tổng hợp (All-in-one)

Nâng cấp báo cáo khách hàng hiện tại thành báo cáo tổng hợp đầy đủ thông tin nhất: Mã máy, Số lượng bình, Mã bình đang giữ.

## Proposed Changes

### [Component] Database (Supabase Views)

#### [MODIFY] [schema_report_views.sql](file:///c:/Users/dungv/PlasmaVN_Acc/src/database/sql/schema_report_views.sql)
- Cập nhật `view_customer_stats` để bổ sung cột `danh_sach_binh`:
  ```sql
  (SELECT STRING_AGG(serial_number, ', ') FROM cylinders cy WHERE cy.customer_name = c.name) AS danh_sach_binh
  ```

---

### [Component] Frontend Reports

#### [MODIFY] [CustomerReport.jsx](file:///c:/Users/dungv/PlasmaVN_Acc/src/pages/CustomerReport.jsx)
- Thêm cột mới hoặc tích hợp hiển thị mã bình vào cột "Bình Bán/Demo".
- Hiển thị danh sách `danh_sach_binh`.

## Verification Plan

### Manual Verification
- Truy cập "Báo cáo khách hàng".
- Kiểm tra hiển thị đủ: Tên KH, Mã Máy, Số lượng bình, Mã các bình đang giữ.
