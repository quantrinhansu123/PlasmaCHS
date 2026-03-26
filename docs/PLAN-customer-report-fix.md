# PLAN: Fix Báo cáo khách hàng (Customer Report)

Cải thiện báo cáo khách hàng để hiển thị đúng loại khách hàng (mapping labels/colors) và bổ sung danh sách mã máy đang sử dụng.

## Phân tích hiện trạng
1. **Loại khách hàng**: Database lưu giá trị đầy đủ (ví dụ: "Bệnh viện"), trong khi Frontend mapping dựa trên mã viết tắt (ví dụ: "BV"). Điều này dẫn đến việc hiển thị label thô và mất styling màu sắc (badge).
2. **Mã máy**: View `view_customer_stats` hiện chỉ lấy số lượng (`current_machines`), thiếu trường `machines_in_use` (danh sách mã máy).

## Proposed Changes

### [Component] Database (Supabase Views)
Cập nhật view để bổ sung dữ liệu cần thiết.

#### [MODIFY] [schema_report_views.sql](file:///c:/Users/dungv/PlasmaVN_Acc/src/database/sql/schema_report_views.sql)
- Cập nhật `view_customer_stats` để lấy thêm cột `machines_in_use` từ bảng `customers`.

---

### [Component] Frontend Reports
Cập nhật UI để xử lý mapping và hiển thị mã máy.

#### [MODIFY] [CustomerReport.jsx](file:///c:/Users/dungv/PlasmaVN_Acc/src/pages/CustomerReport.jsx)
- Cập nhật `CUSTOMER_CATEGORIES` hoặc logic `getCustomerTypeBadgeClass` để hỗ trợ cả tên đầy đủ và tên viết tắt.
- Cập nhật cột `may_dang_su_dung` (Máy SD) để hiển thị danh sách mã máy (thử nghiệm hiển thị dưới dạng tooltip hoặc list nhỏ nếu có dữ liệu).
- Cập nhật header cột "Máy SD" thành "Máy & Mã Máy" hoặc tương đương nếu cần phân biệt.

## Verification Plan

### Automated Tests
- Kiểm tra query Supabase trả về đầy đủ cột `machines_in_use`.

### Manual Verification
- Truy cập trang "Báo cáo khách hàng".
- Kiểm tra cột "Loại" có hiển thị đúng màu (Xanh cho BV, Hồng cho TM, etc.) thay vì màu xám mặc định.
- Kiểm tra cột "Máy SD" có hiển thị các mã máy (ví dụ: ME-001, ME-002) thay vì chỉ con số.
