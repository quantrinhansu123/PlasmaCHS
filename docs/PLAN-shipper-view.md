# PLAN: Shipper Task View & Delivery Confirmation

Xây dựng giao diện dành riêng cho nhân viên vận chuyển (shippers) để quản lý công việc giao hàng, xác nhận thành công và tải lên ảnh bằng chứng (proof of delivery).

## 1. Mục tiêu và Phạm vi
- **Mục tiêu:** Cung cấp công cụ di động cho shipper để xác nhận đơn hàng đã giao và lưu trữ ảnh thực tế tại hiện trường.
- **Phạm vi:**
    - Giao diện danh sách đơn hàng dành cho shipper (Tích hợp vào hệ thống hiện tại).
    - Nút "Xác nhận giao hàng thành công".
    - Tải được nhiều ảnh (không bắt buộc) lên Supabase Storage.
    - Phân quyền theo vai trò shipper.

## 2. Các câu hỏi Socratic (Cần người dùng phản hồi)
1. **Lối vào giao diện:** Tích hợp trực tiếp vào menu điều hướng chính, chỉ hiển thị với người có quyền (Shipper/Admin). Link dự kiến: `/nhiem-vu-giao-hang`.
2. **Quy trình chụp ảnh:** Không bắt buộc có ảnh để xác nhận giao hàng. Cho phép tải lên/chụp nhiều ảnh bằng chứng.
3. **Phân quyền:** Sử dụng hệ thống phân quyền hiện tại (`app_roles`). Shipper chỉ thấy đơn hàng được gán cho mình hoặc đơn hàng trong trạng thái chờ giao.

## 3. Phân tích kỹ thuật
- **Frontend:** 
    - Trang mới: `src/pages/ShippingTasks.jsx`.
    - Component upload ảnh: Cải tiến để hỗ trợ đa file.
- **Backend:**
    - Cập nhật schema: Đổi `delivery_image_url` (text) thành `delivery_images` (text[]).
    - Lưu ảnh vào bucket `delivery_proofs`.
- **Trạng thái:** Chuyển từ `DANG_GIAO_HANG` sang `HOAN_THANH` (hoặc `CHO_DOI_SOAT` tùy quy trình).

## 4. Các bước thực hiện (Dự kiến)
- [ ] **Giai đoạn 1: Cơ sở hạ tầng**
    - Kiểm tra/Tạo bucket `delivery_proofs` trên Supabase.
    - Cấp quyền (RLS) cho phép `authenticated` user upload ảnh.
- [ ] **Giai đoạn 2: Phát triển Giao diện**
    - Tạo trang `ShippingTasks.jsx` tối ưu cho di động.
    - Hiển thị danh sách đơn hàng có `shipper_id` khớp với user hiện tại.
- [ ] **Giai đoạn 3: Logic nghiệp vụ**
    - Implement hàm `handleConfirmDelivery` (Update status + Link image URL).
    - Tích hợp component chụp ảnh/chọn file.
- [ ] **Giai đoạn 4: Kiểm thử và Bàn giao**
    - Test upload ảnh từ điện thoại thực tế.
    - Xác nhận trạng thái và ảnh đã lưu đúng trong DB.

## 5. Kế hoạch xác minh
- Truy cập bằng tài khoản Shipper.
- Chọn một đơn hàng đang giao.
- Chụp ảnh và ấn "Giao thành công".
- Kiểm tra lại trong trang Quản lý đơn hàng (Admin) xem đơn đó đã `Hoàn thành` và có link ảnh chưa.
