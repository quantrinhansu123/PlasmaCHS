# Kế hoạch: Lọc sản phẩm theo kho trong Modal Đơn hàng

Kế hoạch này nhằm mục đích tự động lọc danh sách "Loại sản phẩm" trong Modal tạo/chỉnh sửa đơn hàng dựa trên "Kho xuất hàng" đã chọn, đảm bảo Sale không chọn nhầm sản phẩm không có hàng tại kho đó.

## Mục tiêu
- Tự động hiển thị danh sách sản phẩm thực sự khả dụng tại kho đã chọn.
- Ngăn ngừa lỗi chọn sai kho khi giao hàng.
- Cải thiện UX cho đội ngũ Sale và Kế toán.

## Các thay đổi đề xuất

### 1. Phía Cơ sở dữ liệu (Supabase)
- Cần truy vấn thông tin tồn kho thực tế từ bảng `machines` và `cylinders`.
- Đề xuất tạo một View tổng hợp nếu cần thiết để lấy nhanh danh sách loại sản phẩm theo kho.

### 2. Phía Giao diện (Frontend)
- **Tệp chỉnh sửa:** `src/components/Orders/OrderFormModal.jsx`
- **Logic mới:** 
    - Theo dõi state `formData.warehouse`.
    - Khi thay đổi kho: Gọi API lấy danh sách sản phẩm thuộc kho đó.
    - Cập nhật Dropdown để chỉ hiển thị các sản phẩm có tồn kho > 0.

## Câu hỏi làm rõ dành cho người dùng

> [!IMPORTANT]
> 1. Bạn muốn hiện **Số lượng tồn còn lại** (VD: Máy PlasmaRosy - Còn 5) ngay trong Dropdown không?
> 2. Nếu kho trống hoàn toàn, chúng ta nên hiện thông báo gì cho người dùng?
> 3. Hiện tại hệ thống có bảng `stocks` tổng hợp không hay tôi cần tự đếm từ các bảng sản phẩm (`machines`, `cylinders`)?

## Các bước thực hiện
1. Nghiên cứu chính xác các bảng dữ liệu gốc.
2. Xây dựng hàm `fetchAvailableProductsByWarehouse` trong `OrderFormModal`.
3. Thay thế hằng số tĩnh `PRODUCT_TYPES` bằng dữ liệu động từ API.
4. Kiểm thử với nhiều kho khác nhau.

---
[OK] Plan created: docs/PLAN-filter-products-by-warehouse.md
Next steps:
- Review the plan
- Run `/create` to start implementation
- Or modify plan manually
