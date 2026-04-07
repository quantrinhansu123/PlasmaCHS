---
status: pending-review
agent: project-planner
---

# KẾ HOẠCH: Tách riêng trang Đề Nghị Xuất Máy (DNXM)

## 1. Đánh giá bối cảnh (Giai đoạn -1)
- **Mục tiêu:** Di chuyển/Tách phần "Đề nghị xuất máy" (DNXM) thành một trang riêng biệt với đầy đủ các chức năng Xem, Sửa và Xóa.
- **Hiện trạng:** Các dữ liệu DNXM hiện đang bị trộn lẫn bên trong trang `Orders` chính (`src/pages/Orders.jsx`) và được phân biệt bằng `order_type = 'DNXM'`.
- **Lý do:** Tách riêng DNXM sẽ giúp giao diện Quản lý Đơn hàng (Orders) gọn gàng hơn và cho phép xử lý chuyên sâu quy trình luân chuyển máy móc, như yêu cầu của người dùng.

## 2. Cổng Socratic: Các Câu Hỏi Mở (Giai đoạn 0)
> **⚠️ CHÚ Ý:** Vui lòng trả lời các câu hỏi sau trước khi chúng ta tiến hành code.

1. **Hiển thị:** Bạn muốn *ẩn hoàn toàn* các phiếu DNXM khỏi danh sách "Đơn hàng" (Orders) chính, hay vẫn giữ chúng ở đó để theo dõi tổng quan (nhưng chỉ có thể thao tác Đầy đủ chức năng tại trang mới)?
2. **Tái sử dụng Component:** Đối với chức năng Thêm mới/Chỉnh sửa, chúng ta có thể tận dụng lại form `MachineIssueRequestForm.jsx` đang có, và chỉ việc gọi nó ra từ trang mới này không?
3. **Vị trí Menu:** Trang mới này nên được đặt ở vị trí nào trên thanh Menu bên trái (Sidebar)? (Ví dụ: Đặt trong nhóm "Kho & Vận chuyển", ở ngay bên dưới cạnh "Thu hồi máy"?)

## 3. Dự kiến Chia Nhỏ Công Việc (Giai đoạn 1)
*Đây là lộ trình triển khai dự kiến sau khi các câu hỏi trên được trả lời.*

### Bước 1: Tạo trang `MachineRequests`
- Tạo file `src/pages/MachineRequests.jsx` với giao diện tương tự như phần Thu hồi máy (`MachineRecoveries.jsx`).
- Triển khai hàm `fetchData` để gọi dữ liệu từ bảng `orders` chỉ lọc riêng biệt `order_type = 'DNXM'`.
- Thêm các cột cho table và card cho mobile tập trung hiển thị các thông tin liên quan đến xuất máy.

### Bước 2: Tích hợp Thao tác (Xem, Sửa, Xóa)
- Triển khai chức năng Xóa (Delete) áp dụng riêng cho các records `order_type = 'DNXM'`.
- Tích hợp `MachineIssueRequestForm.jsx` (hoặc modal chuyên dụng) cho thao tác Sửa/View.
- Thiết lập chế độ Chỉ xem (Read-only) khi người dùng nhấn nút Xem chi tiết.

### Bước 3: Cập nhật Router & Menu điều hướng
- Định nghĩa route mới `/machine-requests` trong file cấu hình Router (vd: `App.jsx`).
- Thêm đường dẫn tương ứng vào thanh Sidebar.

### Bước 4: Tối ưu lại trang Orders gốc (Tùy thuộc câu trả lời số 1)
- Nếu DNXM cần được ẩn đi: Sửa lại hàm `fetchOrders` trong `src/pages/Orders.jsx` để loại bỏ `order_type = 'DNXM'`.
- Xóa bỏ các nút thao tác dư thừa liên quan đến DNXM bên trong trang Orders gốc nếu không cần thiết nữa.

---
**Phân công AI Agent:**
- `@project-planner` (Tạo bản kế hoạch này)
- `@frontend-specialist` (Sẽ triển khai giao diện và logic)
- `@backend-specialist` (Nếu cần tùy chỉnh câu truy vấn Supabase)
