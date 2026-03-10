# Kế hoạch: Nâng cấp Mẫu In Phiếu Thu Hồi Vỏ Bình

## Overview
Về câu hỏi của bạn: Tính năng in phiếu thu hồi vỏ bình **đã tồn tại** trên hệ thống (tại trang Danh sách Phiếu thu hồi, bạn có thể bấm nút **Xuất PDF** ở từng dòng, hoặc chọn nhiều dòng rồi bấm **In phiếu** ở góc trên trang). 

Tuy nhiên, hiện tại hệ thống đang xuất ra file PDF khá cơ bản. Kế hoạch này đề xuất thay thế bản PDF đó bằng một **mẫu in HTML chuẩn nghiệp vụ (A4/A5)**, tương tự như các phiếu Xuất/Nhập kho hiện có trong hệ thống, giúp bạn in trực tiếp và đẹp mắt hơn.

## Project Type
**WEB**

## Success Criteria
- [ ] Có mẫu in `CylinderRecoveryPrintTemplate.jsx` chuẩn form mẫu (chứa header công ty, bảng chi tiết vỏ bình, phần chữ ký).
- [ ] Tích hợp tính năng in trực tiếp trên trình duyệt vào trang danh sách phiếu thu hồi (`CylinderRecoveries.jsx`) hoặc trang chi tiết phiếu.
- [ ] Giao diện khi in (Print Preview) đồng nhất với các thành phần khác.

## Tech Stack
- Component mẫu in (`.jsx`) kết hợp CSS Inline (đảm bảo không vỡ layout khi in bản cứng).
- Gỡ bỏ dần sự phụ thuộc vào thư viện bên thứ 3 (`jsPDF`) ở chức năng hiện tại nếu muốn.

## File Structure
- `[NEW] src/components/CylinderRecoveryPrintTemplate.jsx`
- `[MODIFY] src/pages/CylinderRecoveries.jsx`

## Task Breakdown

### Task 1: Thiết kế Mẫu In (Template)
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1
- **INPUT**: Cấu trúc dữ liệu của bảng `cylinder_recoveries` và `cylinder_recovery_items`.
- **OUTPUT**: File `CylinderRecoveryPrintTemplate.jsx` hiển thị đầy đủ tiêu đề, bảng số lượng vỏ nhận về và chữ ký giao nhận.
- **VERIFY**: Render component với dữ liệu mẫu và kiểm tra layout.

### Task 2: Tích hợp vào Trang Danh Sách Phiếu
- **Agent**: `frontend-specialist`
- **Skill**: `clean-code`
- **Priority**: P1
- **Dependencies**: Task 1
- **INPUT**: Nút in hiện tại ở `CylinderRecoveries.jsx`.
- **OUTPUT**: Đổi logic từ tải PDF thành hiện modal In / gọi lệnh in của trình duyệt (`window.print` qua component ẩn).
- **VERIFY**: Nhấn In -> hiện hộp thoại in của Chrome/Edge với đúng mẫu phiếu.

## Phase X: Verification
- [ ] Chạy `npm run lint` để đảm bảo code không có cảnh báo.
- [ ] Kiểm tra giao diện (Print Preview) không bị lẹm trang.
- [ ] (Socratic Check) Đã xin ý kiến người dùng về việc họ có muốn nâng cấp tính năng hay không.
