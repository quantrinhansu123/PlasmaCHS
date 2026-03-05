# Plan: Lịch sử chỉnh sửa / duyệt đơn hàng + Lý do chỉnh sửa

## Mục tiêu
- Ghi lại **mọi thay đổi** trên đơn hàng (chỉnh sửa, duyệt, chuyển trạng thái)
- Hiển thị **timeline lịch sử** khi xem chi tiết đơn hàng
- Bắt buộc nhập **lý do** khi chỉnh sửa đơn hàng

---

## Phase 1: Database — Bảng `order_history`

### [NEW] `schema_order_history.sql`

```sql
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,        -- 'CREATED', 'EDITED', 'STATUS_CHANGED', 'APPROVED'
    old_status VARCHAR(50),             -- Trạng thái cũ
    new_status VARCHAR(50),             -- Trạng thái mới
    changed_fields JSONB,               -- { "field": {"old": "X", "new": "Y"} }
    reason TEXT,                         -- Lý do chỉnh sửa (bắt buộc khi EDITED)
    created_by VARCHAR(255) NOT NULL,   -- Người thực hiện
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Cột | Mô tả |
|-----|-------|
| `action` | `CREATED` / `EDITED` / `STATUS_CHANGED` |
| `changed_fields` | JSON chứa trường cũ → mới (chỉ khi EDITED) |
| `reason` | Bắt buộc khi chỉnh sửa, tùy chọn khi đổi trạng thái |

---

## Phase 2: Backend Logic — Ghi history tự động

### [MODIFY] `CreateOrder.jsx` → `handleCreateOrder()`
- **Khi tạo mới**: Insert 1 record `action = 'CREATED'`
- **Khi chỉnh sửa**: So sánh old vs new fields → ghi `changed_fields` JSON + bắt buộc nhập `reason`

### [MODIFY] `OrderStatusUpdater.jsx` → `handleUpdateStatus()`
- Sau khi update status → Insert record `action = 'STATUS_CHANGED'` với `old_status`, `new_status`

### [MODIFY] `OrderFormModal.jsx` → `handleSubmit()`
- Tương tự CreateOrder: so sánh + ghi history + bắt buộc `reason`

---

## Phase 3: UI — Hiển thị lịch sử

### [NEW] `OrderHistoryTimeline.jsx`
Component timeline hiển thị:
```
🟢 03/03/2026 14:30 — Nguyễn Văn A tạo đơn hàng
🔵 03/03/2026 15:00 — Admin duyệt đơn (CHO_DUYET → DA_DUYET)
🟡 03/03/2026 16:00 — Kế toán chỉnh sửa: Số lượng 5→8
   Lý do: "Khách yêu cầu tăng thêm 3 bình"
```

### [MODIFY] `OrderStatusUpdater.jsx`
- Thêm tab/section **"Lịch sử"** hiện `OrderHistoryTimeline`

### UI cho "Lý do chỉnh sửa"
- Khi bấm Lưu chỉnh sửa → popup nhỏ yêu cầu nhập lý do (textarea)
- Không cho lưu nếu chưa nhập lý do

---

## Phase 4: Lý do chỉnh sửa

### Flow chỉnh sửa mới:
```
Bấm "Lưu" → Modal "Lý do chỉnh sửa" → Nhập lý do → Xác nhận
→ Ghi order_history (changed_fields + reason) → Update order
```

---

## Danh sách files

| File | Hành động | Mô tả |
|------|-----------|-------|
| `schema_order_history.sql` | **NEW** | Bảng lưu lịch sử |
| `OrderHistoryTimeline.jsx` | **NEW** | Component timeline |
| `CreateOrder.jsx` | MODIFY | Ghi history khi tạo/sửa + modal lý do |
| `OrderFormModal.jsx` | MODIFY | Ghi history khi sửa + modal lý do |
| `OrderStatusUpdater.jsx` | MODIFY | Ghi history khi đổi trạng thái + hiện timeline |

---

## SQL cần chạy trên Supabase

```sql
-- Chạy sau khi duyệt plan
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    changed_fields JSONB,
    reason TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE order_history IS 'Lịch sử thay đổi đơn hàng';
```

---

## Verification
- [ ] Tạo đơn mới → kiểm tra record CREATED trong order_history
- [ ] Sửa đơn → bắt buộc nhập lý do → kiểm tra record EDITED
- [ ] Đổi trạng thái → kiểm tra record STATUS_CHANGED
- [ ] Xem timeline hiển thị đúng thứ tự thời gian
