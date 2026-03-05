# Kế hoạch Triển khai: Phiếu Xuất Kho - Trả Vỏ Về NCC

## Tổng quan
Xây dựng tính năng "Phiếu Xuất Kho: Trả vỏ về NCC" (Goods Issue: Return Cylinders to Supplier). Tính năng này cho phép thủ kho hoặc quản lý tạo phiếu xuất để trả lại các vỏ bình (hoặc máy) về cho nhà cung cấp, đồng thời cập nhật dòng tiền/tồn kho, ghi nhận lịch sử giao dịch và thay đổi trạng thái của các tài sản này trong hệ thống.

---

## 1. 🛑 Socratic Gate (Câu hỏi Cần Làm Rõ Trước Khi Bắt Đầu)

> **Vui lòng trả lời các câu hỏi sau để chốt phạm vi chức năng (Scope) trước khi chúng tôi tiến hành lập trình:**

1. **Phạm vi đối tượng**: Áp dụng cho cả vỏ bình (Cylinders) và máy móc (Machines).
2. **Quy trình nhập liệu**: Sẽ kết hợp cả nhập số lượng và có thể nhập RFID.
3. **Thay đổi trạng thái tài sản**: Cập nhật tồn kho hoặc ghi nhận lịch sử (Inventory/Transactions).
4. **Vị trí UI**: Ghép chung vào UI xuất kho hoặc có thể tái sử dụng một phần UI của GoodsReceipt.
5. **Flow Phê duyệt**: Lưu là xuất, trừ tồn theo phiếu.

---

## 2. Phân Tích Yêu Cầu (Analysis)

### 2.1. Mục Tiêu (Goal)
Cung cấp màn hình thao tác Nhanh, Chính xác, giúp Thủ Kho lập được danh sách các vỏ cần xuất trả về NCC (Supplier), tự động trừ tồn kho và in ra phiếu xuất chuyên nghiệp.

### 2.2. User Flow dự kiến
1. Người dùng truy cập phân hệ "Phiếu Xuất Kho".
2. Bấm "Tạo Phiếu Xuất mới" -> Nhập Loại xuất: Trả vỏ về NCC.
3. Điền thông tin cơ bản: Mã phiếu (tự sinh), Ngày xuất, Chọn Nhà Cung Cấp, Chọn Kho xuất, Ghi chú.
4. Tại bảng chi tiết: Quét/Nhập Serial RFID của các vỏ bình cần trả.
5. Kiểm tra thông tin và Lưu phiếu.
6. Khi hoàn tất, hệ thống tự động:
   - Lưu Data Phiếu Xuất.
   - Đổi trạng thái vỏ bình.
   - Ghi Log vào bảng `inventory_transactions`.

### 2.3. Tech Stack
- Frontend: React (Vite.js), Tailwind CSS, Lucide React.
- Backend: Supabase (PostgreSQL).

---

## 3. Kiến Trúc Giải Pháp Đề Xuất (Architecture & Design)

### 3.1. Database Schema
Cần bổ sung/tạo bảng `goods_issues` (Phiếu Xuất Kho) và `goods_issue_items` (Chi tiết).
* `goods_issues`: `id`, `code` (Mã PX), `issue_date`, `type` (TRA_NCC, XUAT_HAP...), `supplier_id`, `warehouse_id`, `status`.
* `goods_issue_items`: `id`, `issue_id`, `item_type`, `item_id` (Liên kết với id của bảng cylinders/machines).

### 3.2. Frontend UI
- Component `src/pages/GoodsIssues.jsx`: Danh sách các phiếu xuất kho.
- Component `src/pages/CreateGoodsIssue.jsx`: Màn hình điền form lập phiếu mới (Bao gồm chức năng quét mã RFID động tự thêm dòng).
- Định dạng in: `PrintGoodsIssue.jsx`.

---

## 4. Phân Chia Tác Vụ (Task Breakdown & Agent Routing)

- **[ ] Giai đoạn 1: Socratic Gate & Chốt Scope (Tất cả Agents)**
  - Chờ xác nhận câu trả lời cho các câu hỏi Socratic.
  - Viết lại/Cập nhật Schema phù hợp theo câu trả lời.

- **[ ] Giai đoạn 2: Database Setup (database-architect)**
  - Thiết kế bảng `goods_issues` & `goods_issue_items`.
  - Thiết lập Triggers cập nhật trạng thái kho.

- **[ ] Giai đoạn 3: Frontend UI Components (frontend-design, frontend-specialist)**
  - Build `GoodsIssues.jsx` (List & Filters).
  - Build `CreateGoodsIssue.jsx` với form nâng cao quét RFID.

- **[ ] Giai đoạn 4: Integration & Actions (backend-specialist)**
  - Mapping fetch APIs cho Supplier và Warehouse.
  - Code luồng POST khi submit phiếu.

- **[ ] Giai đoạn 5: In Ấn & Testing (webapp-testing)**
  - Custom UI/UX cho phiên bản in phiếu ra giấy (Print mode).
  - Test E2E.

---

## 5. Tiêu Chí Hoàn Thành (✅ Phase X)
- [ ] Form khởi tạo hoạt động mượt mà, cho phép nhập nhanh/quét RFID vỏ bình mà không cần dùng chuột liên tục.
- [ ] Dữ liệu được push an toàn lên Supabase cho 2 tables chính + trigger update bảng cylinders.
- [ ] Giao diện chuyên nghiệp đồng bộ với app theo thiết kế tại `frontend-design`.
