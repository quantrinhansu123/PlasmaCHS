# Project Plan: Import Cylinder QC/Test Data

## Overview
Xây dựng tính năng quản lý và import dữ liệu kiểm định vỏ bình khí (Cylinder QC/Test Data) dựa trên biểu mẫu được cung cấp từ nhà máy (dạng bảng Excel/PDF có song ngữ Anh - Trung). Tính năng này sẽ cho phép người dùng import dữ liệu hàng loạt để cập nhật thông tin chi tiết (trọng lượng vỏ, dung tích, kết quả test) cho từng mã bình (Serial Number).

## Project Type
**WEB** (Tích hợp vào module Quản lý Bình khí - Cylinders).

## Success Criteria
- [ ] Parse được các trường dữ liệu từ biểu mẫu mẫu.
- [ ] Cập nhật DB schema (bảng `items` hoặc tạo bảng mới `cylinder_qc_data`) để lưu trữ các thông số kỹ thuật chi tiết của bình.
- [ ] Xây dựng giao diện cho phép Import file Excel/CSV chứa dữ liệu QC.
- [ ] Hiển thị thông tin kiểm định này trong trang Chi tiết Bình.

## Tech Stack
- Frontend: React, Tailwind CSS. Sử dụng thư viện `xlsx` (nếu chưa có) để đọc file Excel phía client.
- Backend (DB): Supabase PostgreSQL (alter table hoặc create table).

## Phân tích Dữ liệu từ Ảnh (Data Structure)

Biểu mẫu từ ảnh là một bảng theo dõi kiểm định bình chứa khí áp lực cao (thường từ nhà sản xuất). Các trường dữ liệu (Fields) có thể trích xuất được:

### 1. Thông tin chung (Header/Metadata)
Những thông tin này thường áp dụng chung cho một lô hàng (Batch):
*   **Product type** (Quy cách/Model): `LWH160-8-15`
*   **Standard** (Tiêu chuẩn thực thi): `UN ISO7866`
*   **Material** (Chất liệu): `6061` (Hợp kim nhôm)
*   **Batch No.** (Số hiệu lô): `2529EMD`
*   **Test Pressure** (Áp suất thử nghiệm): `15MPa`
*   **Hold time** (Thời gian giữ áp suất): `0.5 min` (phút)

### 2. Dữ liệu chi tiết từng bình (Rows)
Bảng chia làm 2 nửa trái/phải để tiết kiệm giấy, nhưng cấu trúc mỗi dòng (đại diện cho 1 bình) là giống nhau:
*   **Cylinder No. / 瓶号** (Số Series bình): Ví dụ `TN12801`, `TN12802`... _(Đây là khóa chính để đối chiếu với `serial_number` trong hệ thống của chúng ta)_.
*   **Empty Weight / 重量 (kg)** (Trọng lượng vỏ): Ví dụ `7.52`, `7.53`.
*   **Water Capacity / 容积 (L)** (Dung lượng nước/Thể tích thực): Ví dụ `8.18`, `8.17`.
*   **Conclusion / 试验结论** (Kết luận thử nghiệm): Ví dụ `OK`.

## File Structure & DB Changes

### 1. Database Schema
Cần thiết kế bảng để lưu trữ. Có 2 cách tiếp cận:
- **Cách A (Alter table `items`)**: Thêm các cột metadata trực tiếp vào bảng `items` (vì mỗi serial là một item).
- **Cách B (Bảng mới `cylinder_qc_records`)**: Tạo bảng riêng liên kết 1-1 với bảng `items` via `serial_number`. _(Khuyến nghị cách này để db sạch sẽ và dễ scale nếu sau này có nhiều lần test nghiệm thu)_.

**Đề xuất Schema `cylinder_qc_records`:**
- `id` (uuid, PK)
- `serial_number` (varchar, liên kết tới `items.serial_number`)
- `batch_no` (varchar) - Ví dụ: 2529EMD
- `product_type` (varchar) - Ví dụ: LWH160-8-15
- `empty_weight` (numeric, kg)
- `water_capacity` (numeric, L)
- `test_pressure` (varchar) - Ví dụ: 15MPa
- `conclusion` (varchar) - Ví dụ: OK
- `created_at` (timestamp)

### 2. Frontend Files
```
src/
  pages/
    Cylinders.jsx                 # Thêm nút "Import QC Data" (dạng Excel/CSV)
  components/
    CylinderQCDialog.jsx          # Modal hiển thị UI Import và Preview dữ liệu trước khi lưu
```

## Task Breakdown

### Task 1: Thiết kế Database Schema
- **Agent**: `database-architect`
- **Priority**: P0
- **Mô tả**: Tạo script SQL trên Supabase để tạo bảng `cylinder_qc_records` (hoặc alter table `items`).
- **INPUT**: Cấu trúc các trường đã phân tích ở trên.
- **OUTPUT**: Câu lệnh SQL đã chạy thành công.
- **VERIFY**: Kiểm tra table/column có tồn tại trên Supabase.

### Task 2: Giao diện UI/UX chức năng Import
- **Agent**: `frontend-specialist`
- **Priority**: P1
- **Mô tả**: 
  - Thêm một nút `[⬆️ Import QC Data]` tại trang Danh sách Bình khí (`Cylinders.jsx`).
  - Khi bấm vào mở Modal `CylinderQCDialog.jsx`.
  - Trong Modal cho phép upload file `.xlsx` hoặc `.csv`.
  - Hiển thị bảng Preview dữ liệu (chỉ lấy các cột: Cylinder No, Weight, Capacity, Conclusion) trước khi bấm Xong.
- **INPUT**: File React.
- **OUTPUT**: Giao diện Modal hoàn chỉnh và nút gọi được mở.
- **VERIFY**: Nút bấm render, Modal mở ra, UI tuân thủ nguyên tắc Clean Code và hiện đại.

### Task 3: Logic xử lý file Excel (Parsing)
- **Agent**: `frontend-specialist` / `backend-specialist`
- **Priority**: P1
- **Mô tả**: 
  - Khai thác thư viện parse Excel/CSV để biến data từ file thành local array of objects.
  - Xử lý mapping các cột Header phức tạp (vì bảng trong ảnh có dòng gộp/tiêu đề con).
  - Tách lô data thành mảng các bản ghi chuẩn: `{ serial_number, weight, capacity, conclusion, batch_no... }`.
- **INPUT**: Browser File Buffer.
- **OUTPUT**: Array JS object.
- **VERIFY**: Log ra console array data chính xác với cấu trúc định trước.

### Task 4: API Lưu trữ lên Supabase (Upsert)
- **Agent**: `backend-specialist`
- **Priority**: P1
- **Mô tả**: Lấy Array từ Task 3, gọi Supabase API để insert/update (upsert) vào bảng `cylinder_qc_records`.
- **INPUT**: List of Objects.
- **OUTPUT**: Dữ liệu lưu thành công.
- **VERIFY**: Hiện thông báo Toast success, reload lại dữ liệu liên quan.

### Task 5: Hiển thị thông số trong Thông tin Bình (View Details)
- **Agent**: `frontend-specialist`
- **Priority**: P2
- **Mô tả**: Cập nhật popup/chức năng Xem chi tiết bình khí. Nếu bình đó đã có record QC, hiển thị thêm box thông tin (Trọng lượng vỏ: 7.52kg | Dung tích: 8.18 Lít | Lô: ...).
- **INPUT**: Giao diện chi tiết serial.
- **OUTPUT**: Component React hiển thị thông tin metadata QC.
- **VERIFY**: Nhìn rõ được thông tin, UI liền mạch.

## Phase X: Verification
- [ ] Test upload 1 file CSV/Excel mẫu với các cột Header được định sẵn (Mã số, Cân Nặng (kg), Dung tích (L)...).
- [ ] Đảm bảo dữ liệu lưu trữ không bị trùng lặp record cho cùng 1 serial.
- [ ] Giao diện (UI) đảm bảo tính nhất quán (không dùng màu Tím/Violet).
