# Phiếu Thu Hồi Vỏ Bình Từ Khách Hàng

## Mô tả
Module dành cho **nhân viên vận chuyển** để thu hồi vỏ bình từ khách hàng. Giao diện responsive (mobile + PC). Tích hợp quét barcode, chụp ảnh, in phiếu hàng loạt, và xuất PDF biên bản thu nhận vỏ.

---

## Socratic Gate ✅
| Câu hỏi | Trả lời |
|---------|---------|
| Mẫu biên bản | Cố định 1 mẫu cho tất cả KH |
| Lưu ảnh | Supabase Storage |
| In hàng loạt | Chọn nhiều phiếu → in/xuất PDF cùng lúc |
| Responsive | Cả mobile (NV vận chuyển) và PC (văn phòng) |

---

## Luồng nghiệp vụ

```
NV vận chuyển đến KH
  → Tạo phiếu thu hồi (chọn KH, kho nhận)
  → Quét barcode từng vỏ bình (camera điện thoại)
  → Chụp ảnh hiện trường / vỏ bình
  → Lưu phiếu
  → Xuất PDF "Biên bản thu nhận vỏ"
  → KH ký xác nhận (trên giấy hoặc ảnh)
```

---

## Database

### Bảng `cylinder_recoveries`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| recovery_code | VARCHAR(100) UNIQUE | Mã phiếu (TH2403001) |
| recovery_date | DATE | Ngày thu hồi |
| customer_id | UUID FK → customers | Khách hàng |
| warehouse_id | VARCHAR(50) | Kho nhận về |
| driver_name | VARCHAR(255) | Tên NV vận chuyển |
| notes | TEXT | Ghi chú |
| total_items | INTEGER | Tổng số vỏ |
| status | VARCHAR(50) | CHO_DUYET / HOAN_THANH / HUY |
| photos | TEXT[] | Mảng URLs ảnh (Supabase Storage) |
| created_at | TIMESTAMPTZ | |

### Bảng `cylinder_recovery_items`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID PK | |
| recovery_id | UUID FK → cylinder_recoveries | |
| serial_number | VARCHAR(100) | Mã barcode vỏ bình (quét) |
| condition | VARCHAR(50) | Tình trạng: tốt / hỏng / méo |
| note | TEXT | Ghi chú riêng |

---

## Trang & Components

### 1. Danh sách phiếu thu hồi (`CylinderRecoveries.jsx`)
- Route: `/thu-hoi-vo`
- Bảng danh sách + bộ lọc (KH, trạng thái, ngày)
- Checkbox chọn nhiều phiếu → **Nút "In hàng loạt"**
- Nút tạo phiếu mới

### 2. Tạo phiếu thu hồi (`CreateCylinderRecovery.jsx`)
- Route: `/tao-phieu-thu-hoi`
- Form: Chọn KH, kho nhận, tên NV, ngày, ghi chú
- Danh sách vỏ bình: **Quét barcode** (camera) hoặc nhập tay serial
- **Chụp ảnh**: Nút mở camera → chụp → preview → upload Supabase Storage
- Nút lưu phiếu

### 3. Xuất PDF Biên bản thu nhận vỏ
- Thư viện: `jspdf` + `jspdf-autotable`
- Mẫu cố định gồm: header công ty, thông tin KH, bảng danh sách vỏ (serial, tình trạng), chữ ký 2 bên
- Hỗ trợ xuất 1 phiếu hoặc hàng loạt (merge PDF)

---

## Task Breakdown

### Phase 1: Database
- [ ] Tạo SQL schema `cylinder_recoveries` + `cylinder_recovery_items`
- [ ] Tạo Supabase Storage bucket `recovery-photos`

### Phase 2: Constants & Config
- [ ] `recoveryConstants.js` (statuses, conditions, columns)

### Phase 3: UI — Danh sách
- [ ] `CylinderRecoveries.jsx` — bảng, lọc, checkbox, in hàng loạt
- [ ] Route `/thu-hoi-vo` trong `App.jsx`
- [ ] Link sidebar trong `Home.jsx`

### Phase 4: UI — Tạo phiếu
- [ ] `CreateCylinderRecovery.jsx` — form + quét barcode + chụp ảnh
- [ ] Route `/tao-phieu-thu-hoi`
- [ ] Upload ảnh lên Supabase Storage

### Phase 5: PDF Export
- [ ] Cài `jspdf` + `jspdf-autotable`
- [ ] Component/util `generateRecoveryPDF()`
- [ ] Mẫu biên bản cố định (header, bảng vỏ, chữ ký)
- [ ] In hàng loạt (loop xuất nhiều PDF hoặc merge)

### Phase X: Verification
- [ ] Tạo phiếu → quét barcode → chụp ảnh → lưu OK
- [ ] Xuất PDF 1 phiếu → đúng mẫu
- [ ] Chọn nhiều phiếu → in hàng loạt OK
- [ ] Test trên mobile (responsive)
