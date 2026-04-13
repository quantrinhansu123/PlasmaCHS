# ✅ Sửa lỗi User Session và Customer Mapping

## 📋 Tóm tắt các lỗi đã sửa

### 1. ✅ Lỗi User Session khi cập nhật trạng thái đơn hàng
**Vấn đề**: Khi cập nhật trạng thái đơn hàng, hệ thống ghi log với `created_by: 'Hệ thống'` thay vì tên người dùng thực tế đang thực hiện thao tác.

**Hậu quả**: 
- Tài khoản A cập nhật đơn hàng nhưng log hiển thị "Hệ thống" thay vì tên tài khoản A
- Không thể truy vết được ai đã thực hiện thao tác
- Gây nhầm lẫn trong audit trail

**Giải pháp**: 
- Lấy thông tin user từ localStorage/sessionStorage
- Ghi log với tên user thực tế

**File**: `src/components/Orders/OrderStatusUpdater.jsx`

```javascript
// TRƯỚC (SAI):
await supabase.from('order_history').insert([{
    order_id: order.id,
    action: 'STATUS_CHANGED',
    old_status: order.status,
    new_status: transition.nextStatus,
    created_by: 'Hệ thống'  // ❌ Hardcoded
}]);

// SAU (ĐÚNG):
const currentUser =
    localStorage.getItem('user_name') ||
    sessionStorage.getItem('user_name') ||
    'Hệ thống';

await supabase.from('order_history').insert([{
    order_id: order.id,
    action: 'STATUS_CHANGED',
    old_status: order.status,
    new_status: transition.nextStatus,
    created_by: currentUser  // ✅ Lấy user thực tế
}]);
```

---

### 2. ✅ Lỗi User Session khi chốt khách hàng thành công
**Vấn đề**: Khi chuyển trạng thái khách hàng sang "Thành công", thông báo hiển thị tên NV từ trường `care_by` (có thể là người khác) thay vì người đang thực hiện thao tác.

**Hậu quả**:
- Tài khoản A chốt hàng nhưng thông báo hiển thị "NV Kinh doanh (C) vừa chốt thành công"
- Gây nhầm lẫn về ai thực sự đã chốt đơn
- Không công bằng trong việc ghi nhận thành tích

**Giải pháp**:
- Lấy thông tin user hiện tại từ localStorage/sessionStorage
- Hiển thị đúng tên người đang thực hiện thao tác

**File**: `src/pages/Customers.jsx`

```javascript
// TRƯỚC (SAI):
if (newStatus === 'Thành công') {
    const updatedCustomer = customers.find(c => c.id === id);
    if (updatedCustomer && updatedCustomer.status !== 'Thành công') {
        notificationService.add({
            title: `🎉 Khách hàng chốt Thành công: ${updatedCustomer.name}`,
            description: `NV Kinh doanh (${updatedCustomer.care_by || 'Không rõ'}) vừa chuyển trạng thái...`,
            // ❌ Sử dụng care_by từ database (có thể là người khác)
            type: 'success',
            link: '/khach-hang'
        });
    }
}

// SAU (ĐÚNG):
if (newStatus === 'Thành công') {
    const updatedCustomer = customers.find(c => c.id === id);
    if (updatedCustomer && updatedCustomer.status !== 'Thành công') {
        // Get current logged-in user
        const currentUser =
            localStorage.getItem('user_name') ||
            sessionStorage.getItem('user_name') ||
            'Không rõ';
        
        notificationService.add({
            title: `🎉 Khách hàng chốt Thành công: ${updatedCustomer.name}`,
            description: `NV Kinh doanh (${currentUser}) vừa chuyển trạng thái...`,
            // ✅ Sử dụng user hiện tại đang đăng nhập
            type: 'success',
            link: '/khach-hang'
        });
    }
}
```

---

### 3. ✅ Lỗi Mapping ID khách hàng khi edit đơn hàng
**Vấn đề**: Khi edit đơn hàng, hệ thống tìm khách hàng theo tên trước, sau đó mới theo ID. Nếu có nhiều khách hàng cùng tên, sẽ lấy nhầm ID.

**Hậu quả**:
- Khách hàng A có tên "Công ty ABC"
- Khách hàng B cũng có tên "Công ty ABC"
- Khi edit đơn của khách hàng A, hệ thống có thể lấy nhầm ID của khách hàng B
- Dẫn đến thông tin khách hàng bị "cắm" nhầm vào đơn hàng

**Giải pháp**:
- Ưu tiên sử dụng `customer_id` từ order trước
- Chỉ fallback sang tìm theo tên nếu không có customer_id
- Đảm bảo lưu `customer_id` vào database khi tạo/sửa đơn

**File**: `src/components/Orders/OrderFormModal.jsx`

#### A. Sửa logic load order data

```javascript
// TRƯỚC (SAI):
const matchedCustomer = customers.find(c => 
    c.name === order.customer_name || c.id === order.customerId
    // ❌ Tìm theo name trước, có thể bị nhầm
);

setFormData({
    ...
    customerId: matchedCustomer?.id || order.customerId || '',
    ...
});

// SAU (ĐÚNG):
// PRIORITY: Use order.customer_id first, then fallback to name matching
let matchedCustomerId = '';

if (order.customer_id) {
    // First priority: Use the stored customer_id from order
    const customerExists = customers.find(c => c.id === order.customer_id);
    if (customerExists) {
        matchedCustomerId = order.customer_id;  // ✅ Ưu tiên customer_id
    }
}

// Fallback: If no customer_id or customer not found, try matching by name
if (!matchedCustomerId && order.customer_name) {
    const matchedCustomer = customers.find(c => c.name === order.customer_name);
    if (matchedCustomer) {
        matchedCustomerId = matchedCustomer.id;
    }
}

setFormData({
    ...
    customerId: matchedCustomerId,
    ...
});
```

#### B. Sửa logic submit form - Thêm customer_id vào payload

```javascript
// TRƯỚC (SAI):
const payload = {
    order_code: formData.orderCode,
    customer_category: formData.customerCategory,
    warehouse: formData.warehouse,
    customer_name: customerName,  // ❌ Chỉ lưu tên, không lưu ID
    recipient_name: formData.recipientName,
    ...
};

// SAU (ĐÚNG):
const payload = {
    order_code: formData.orderCode,
    customer_category: formData.customerCategory,
    warehouse: formData.warehouse,
    customer_id: formData.customerId,  // ✅ CRITICAL: Lưu customer_id
    customer_name: customerName,
    recipient_name: formData.recipientName,
    ...
};
```

---

## 🎯 Tóm tắt thay đổi

| Lỗi | File | Dòng | Thay đổi |
|-----|------|------|----------|
| User session trong order history | `OrderStatusUpdater.jsx` | ~491 | `created_by: 'Hệ thống'` → `created_by: currentUser` |
| User session trong notification | `Customers.jsx` | ~720 | `care_by` → `currentUser` |
| Customer mapping priority | `OrderFormModal.jsx` | ~365 | Ưu tiên `customer_id` trước `name` |
| Missing customer_id in payload | `OrderFormModal.jsx` | ~703 | Thêm `customer_id: formData.customerId` |

---

## 🧪 Test Cases

### Test 1: Cập nhật trạng thái đơn hàng
```
✅ Login as User A
✅ Vào trang /don-hang
✅ Chọn 1 đơn hàng và cập nhật trạng thái
✅ Kiểm tra order_history → created_by phải là "User A"
✅ KHÔNG được là "Hệ thống"
```

### Test 2: Chốt khách hàng thành công
```
✅ Login as User A
✅ Vào trang /khach-hang
✅ Chuyển trạng thái 1 khách hàng sang "Thành công"
✅ Kiểm tra notification → phải hiển thị "NV Kinh doanh (User A)"
✅ KHÔNG được hiển thị tên người khác
```

### Test 3: Edit đơn hàng với khách hàng trùng tên
```
✅ Tạo 2 khách hàng cùng tên "Công ty ABC" (ID khác nhau)
✅ Tạo đơn hàng cho khách hàng A (ID: xxx-111)
✅ Edit đơn hàng đó
✅ Kiểm tra customerId trong form phải là xxx-111
✅ KHÔNG được là ID của khách hàng B
✅ Submit form
✅ Kiểm tra database → customer_id phải là xxx-111
```

### Test 4: Tạo đơn hàng mới
```
✅ Login as User A
✅ Tạo đơn hàng mới
✅ Chọn khách hàng "Công ty XYZ" (ID: yyy-222)
✅ Submit form
✅ Kiểm tra database:
   - customer_id = yyy-222 ✅
   - customer_name = "Công ty XYZ" ✅
   - ordered_by = "User A" ✅
```

---

## 📊 Ảnh hưởng

### Trước khi sửa:
- ❌ Log history hiển thị "Hệ thống" thay vì user thực tế
- ❌ Notification hiển thị sai người chốt đơn
- ❌ Customer ID bị nhầm lẫn khi có khách hàng trùng tên
- ❌ Không lưu customer_id vào database

### Sau khi sửa:
- ✅ Log history hiển thị đúng user thực tế
- ✅ Notification hiển thị đúng người chốt đơn
- ✅ Customer ID được map chính xác theo priority
- ✅ Customer_id được lưu vào database để tránh nhầm lẫn

---

## ⚠️ Lưu ý quan trọng

### 1. Data Inheritance (Tính kế thừa dữ liệu)
Hệ thống đã được sửa để:
- ✅ Giữ nguyên customer_id khi edit đơn hàng
- ✅ Không thay đổi thông tin khách hàng trừ khi user chủ động sửa
- ✅ Ưu tiên dữ liệu từ database (customer_id) hơn là tìm kiếm lại

### 2. Database Schema
Đảm bảo bảng `orders` có cột `customer_id`:
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
```

### 3. Migration cho dữ liệu cũ
Nếu có đơn hàng cũ chưa có customer_id, chạy script sau:
```sql
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_name = c.name
AND o.customer_id IS NULL;
```

---

## 🚀 Deployment Checklist

- [x] Code đã được cập nhật
- [x] Không có lỗi syntax
- [x] Logic đã được verify
- [ ] Test với nhiều user khác nhau
- [ ] Test với khách hàng trùng tên
- [ ] Verify database có cột customer_id
- [ ] Chạy migration cho dữ liệu cũ (nếu cần)
- [ ] Deploy lên production

---

## 📚 Files đã sửa

1. `src/components/Orders/OrderStatusUpdater.jsx` - Sửa user session trong order history
2. `src/pages/Customers.jsx` - Sửa user session trong notification
3. `src/components/Orders/OrderFormModal.jsx` - Sửa customer mapping và thêm customer_id

---

## ✅ Kết luận

Đã sửa thành công 3 lỗi nghiêm trọng:

1. ✅ User session trong order history - Giờ hiển thị đúng người thực hiện
2. ✅ User session trong notification - Giờ hiển thị đúng người chốt đơn
3. ✅ Customer mapping - Giờ không bị nhầm lẫn ID khách hàng

**Hệ thống giờ đã:**
- Ghi log đúng người thực hiện thao tác
- Hiển thị notification đúng người chốt đơn
- Map customer ID chính xác, không bị nhầm lẫn
- Lưu customer_id vào database để tránh lỗi trong tương lai

**Sẵn sàng để test và deploy!** 🎉

---

**Tạo bởi**: Kiro AI Assistant  
**Ngày**: 2026-04-13  
**Status**: ✅ Completed & Ready for Testing
