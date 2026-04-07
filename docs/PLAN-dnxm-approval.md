# Kế hoạch điều chỉnh quy trình Duyệt Phiếu Đề Nghị Xuất Máy

## Mục tiêu
Dời tính năng Duyệt/Từ chối từ ngoài danh sách dạng bảng (`MachineRequests.jsx`) vào trong màn hình Xem chi tiết (`MachineIssueRequestForm.jsx`) để người dùng có thể xem lại chính xác thông tin phiếu trước duyệt. Đồng thời, áp dụng quy trình duyệt xoay vòng qua 3 cấp xử lý: Trưởng Kinh Doanh -> Kinh Doanh -> Kho.

## Phân Tích Hiện Trạng & Thay Đổi Đề Xuất

### 1. `src/pages/MachineRequests.jsx`
- **Thay đổi**: Loại bỏ toàn bộ code render nút "Duyệt" (`handleApprove`) trên cả Desktop và Mobile view.
- Thay vào đó, nút "Xem chi tiết" (icon con Mắt) sẽ đóng vai trò duy nhất đưa người dùng vào giao diện xem thông tin phiếu và thao tác duyệt ở đó.

### 2. `src/components/Machines/MachineIssueRequestForm.jsx`
- **Giao diện**: Trong block `isReadOnly` (khi đang ở chế độ xem chi tiết `viewOnly=true`), bổ sung mảng Action Buttons nổi lên gồm các nút: `Duyệt Phiếu Xong` và `Từ Chối Phiếu`.
- **Logic Trạng thái mới (Status Flow)**: 
  Logic duyệt không chỉ update cứng về `DA_DUYET` như hiện tại, mà trạng thái luân chuyển sẽ tuần tự 3 giai đoạn:
  1. Mới tạo -> `TRUONG_KD_XU_LY` (Chờ Trưởng kinh doanh xử lý)
  2. TKD Duyệt -> `KD_XU_LY` (Chờ Kinh doanh xử lý) 
  3. KD Duyệt -> `KHO_XU_LY` (Kho xử lý)

## Open Questions
> [!WARNING]
> Xin vui lòng cung cấp thêm các thông tin sau:
1. Bạn muốn mã trạng thái cập nhật vào Database cụ thể là gì? (Ví dụ: `CHO_DUYET` -> `TRUONG_KD_DUYET` -> `KD_XU_LY` -> `KHO_XU_LY`?).
2. Phân quyền duyệt: Role nào thì thấy nút duyệt ứng với trạng thái nào? Hay là không giới hạn Role?
3. Nếu bấm "Từ chối" thì trạng thái sửa dứt điểm về `TU_CHOI` luôn phải không?

## Nắm giữ
- **Agent**: `orchestrator` / `frontend-specialist`
- **Output**: Cập nhật logic Status mới và dời component duyệt.
