# Kế hoạch điều chuyển nhiều hàng hóa cùng lúc

## 1. Mục tiêu (Mô tả vấn đề)
Thay đổi tính năng "Điều chuyển kho nội bộ" hiện tại (chỉ cho phép chọn 1 loại hàng hóa mỗi lần điều chuyển) thành tính năng cho phép **chọn nhiều hàng hóa cùng lúc và nhập số lượng/mã cụ thể cho từng loại hàng hóa**, sau đó thực hiện điều chuyển tất cả trong một lần bấm xác nhận.

## 2. Các câu hỏi cần xác nhận (Socratic Gate)
> [!IMPORTANT]
> **Vui lòng trả lời các câu hỏi sau trước khi chúng ta tiến hành lập trình:**
>
> 1. **Giao diện nhập liệu (UI/UX)**: Khi chọn nhiều mặt hàng, bạn muốn người dùng thao tác theo cách nào?
>    - *Cách 1*: Chọn Loại -> Chọn Tên -> Nhập Số Lượng -> Bấm "Thêm vào danh sách". Danh sách các mặt hàng sẽ hiện ở dưới.
>    - *Cách 2*: Hiện một bảng có nút "Thêm dòng mới", người dùng chọn trực tiếp trên các dòng của bảng (giống như xuất/nhập Excel).
> 2. **Trải nghiệm Quét mã máy/mã bình (Serial/RFID)**: Với các loại hàng cần quét mã (Máy/Bình), người dùng sẽ quét mã ngay khi vừa chọn số lượng, hay sẽ có một nút "Quét mã" ở mỗi dòng trong danh sách để bấm vào và hiện popup quét mã?
> 3. **In Biên Bản Bàn Giao (BBBG)**: Biên bản bàn giao sẽ gộp chung MỘT phiếu duy nhất chứa **tất cả** các hàng hóa đã chọn trong lần điều chuyển này, đúng không?

## 3. Đề xuất quy trình thực hiện (Dự kiến)

### Hạng mục 1: Cập nhật State Management & Logic
- Đổi trạng thái `formData.item_name`, `formData.item_type`, `formData.quantity`, `formData.specific_codes` thành một mảng `transfer_items: []`.
- Form chính quản lý `from_warehouse_id`, `to_warehouse_id`, `note`. 

### Hạng mục 2: Điều chỉnh UI `InventoryTransfer.jsx`
- **Khối thêm hàng hóa**: Khu vực để chọn `item_type`, `item_name`, `quantity` và nút "Thêm vào điều chuyển".
- **Danh sách mặt hàng đã chọn**: Hiển thị dưới dạng danh sách/bảng các món đã thêm.
    - Cho phép xóa món đã thêm.
    - Với "Máy" và "Bình", mở rộng khu vực nhập mã (`specific_codes`) cho phép quét mã (hoặc mở modal quét mã).
- **In BBBG**: Sinh dữ liệu dạng mảng `orders` map từ `transfer_items` đưa vào `MachineHandoverPrintTemplate`.

### Hạng mục 3: Xử lý Submit API (Đưa lên Supabase)
- Sinh chung một `transferCode` (VD: `TRF...`).
- Lặp qua từng `item` trong `transfer_items`:
    - Trừ tồn kho nguồn.
    - Cộng/tạo tồn kho đích.
    - Cập nhật kho (`warehouse_id`) của từng Máy/Bình theo các `specific_codes`.
    - Ghi nhận `inventory_transactions` IN và OUT bằng chung một `transferCode` kết hợp lại.

## 4. Các tệp (Files) bị ảnh hưởng
- `src/pages/InventoryTransfer.jsx` (Sửa đổi logic và UI toàn diện phần chi tiết vật tư)
- `src/components/MachineHandoverPrintTemplate.jsx` (Kiểm tra lại xem đã hỗ trợ render mảng rỗng hoặc nhiều items liền mạch chưa, vì cấu trúc hiện tại đang lấy `orders` array).

## 5. Kế hoạch kiểm tra (Verification)
- [ ] Chọn 1 Máy + 1 Vật tư và tiến hành điều chuyển cùng lúc.
- [ ] Kiểm tra cảnh báo giới hạn tồn kho với nhiều mặt hàng.
- [ ] Xác nhận tính năng quét barcode tự động nhảy dòng trên từng Máy/Bình cụ thể nằm chung trong một bill.
- [ ] In BBBG ra đầy đủ các mặt hàng.
- [ ] Kiểm tra lịch sử hệ thống (`inventory_transactions`) hiện đúng các dòng điều chuyển chung mã phiếu.
