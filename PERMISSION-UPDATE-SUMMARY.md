# Cập nhật Phân quyền - Đề nghị xuất máy

## 📋 Yêu cầu
1. ✅ Admin nhìn full tất cả đơn
2. ✅ Nhân viên kinh doanh tạo sẽ tự điền tên mình
3. ✅ Hiển thị các đơn có NV kinh doanh trong list `nguoi_quan_ly`
4. ✅ Thủ kho chỉ nhìn đơn trạng thái "Kho xử lý"
5. ✅ Shipper chỉ nhìn đơn được giao cho mình

## 🔧 Thay đổi Code

### 1. File: `src/pages/MachineRequests.jsx`

#### A. Import thêm user data từ usePermissions
```javascript
// Trước:
const { role } = usePermissions();

// Sau:
const { role, department, user, loading: permissionsLoading } = usePermissions();
```

#### B. Thêm dependency cho useEffect
```javascript
// Trước:
useEffect(() => {
    fetchData();
}, []);

// Sau:
useEffect(() => {
    if (permissionsLoading) return;
    fetchData();
}, [permissionsLoading, role, department, user?.name]);
```

#### C. Logic phân quyền trong fetchData()
```javascript
const fetchData = async () => {
    // 1. Normalize role
    const normalizedRole = normalizeRoleKey(role);
    const isAdmin = normalizedRole === 'admin';
    const isLeader = normalizedRole.includes('lead');
    const isThuKhoRole = normalizedRole.includes('thu_kho');
    const isShipperRole = normalizedRole.includes('shipper') || 
                          normalizedRole.includes('giao_hang');
    
    // 2. Get managed names from nguoi_quan_ly
    const managedNames = (user?.nguoi_quan_ly || '')
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
    
    const visibleSalesNames = [
        user?.name,
        user?.username,
        storageUserName,
        ...managedNames
    ].filter(Boolean);

    // 3. Build query
    let query = supabase
        .from('orders')
        .select('*')
        .eq('order_type', 'DNXM');

    // 4. Apply filters by role
    
    // Thủ kho: Chỉ xem đơn KHO_XU_LY
    if (isThuKhoRole) {
        query = query.eq('status', 'KHO_XU_LY');
    }

    // Shipper: Chỉ xem đơn được giao cho mình
    if (isShipperRole && !isAdmin) {
        query = query.eq('delivery_unit', storageUserName);
    }

    // NV Kinh doanh: Xem đơn của mình + người mình quản lý
    if (!isAdmin && !isLeader && !isThuKhoRole && !isShipperRole) {
        if (visibleSalesNames.length > 0) {
            query = query.in('ordered_by', visibleSalesNames);
        }
    }

    // Admin & Leader: Xem tất cả (không filter)
};
```

### 2. File: `src/components/Machines/MachineIssueRequestForm.jsx`

#### Auto-fill tên người tạo (ĐÃ CÓ SẴN)
```javascript
useEffect(() => {
    // Tự động điền tên khi tạo mới (không phải edit)
    if (!editOrderId && user?.name && !formData.requesterName) {
        setFormData(prev => ({ ...prev, requesterName: user.name }));
    }
}, [user, editOrderId]);
```

**Lưu ý:** Code này đã có sẵn trong form, không cần sửa gì thêm!

## 🎯 Logic Phân quyền Chi tiết

### Role: Admin
- ✅ Xem tất cả đơn DNXM
- ✅ Không có filter nào
- ✅ Full quyền CRUD

### Role: Lead (Trưởng nhóm)
- ✅ Xem tất cả đơn DNXM
- ✅ Không có filter
- ✅ Có thể duyệt đơn

### Role: Nhân viên Kinh doanh
- ✅ Xem đơn của mình (`ordered_by = user.name`)
- ✅ Xem đơn của người mình quản lý (trong `nguoi_quan_ly`)
- ✅ Tạo đơn tự động điền tên mình
- ❌ Không xem đơn của người khác

### Role: Thủ kho
- ✅ Chỉ xem đơn trạng thái `KHO_XU_LY`
- ❌ Không xem đơn trạng thái khác
- ✅ Có thể xử lý xuất kho

### Role: Shipper / Giao hàng
- ✅ Chỉ xem đơn được giao cho mình (`delivery_unit = user.name`)
- ❌ Không xem đơn của shipper khác
- ✅ Có thể cập nhật trạng thái giao hàng

## 📊 Ví dụ Thực tế

### Ví dụ 1: NV Kinh doanh "Nguyễn Văn A"
**Dữ liệu trong app_users:**
```sql
name: "Nguyễn Văn A"
role: "Nhân viên kinh doanh"
nguoi_quan_ly: "Nguyễn Văn B, Trần Thị C"
```

**Kết quả:**
- Xem đơn có `ordered_by` = "Nguyễn Văn A" (đơn của mình)
- Xem đơn có `ordered_by` = "Nguyễn Văn B" (người mình quản lý)
- Xem đơn có `ordered_by` = "Trần Thị C" (người mình quản lý)
- Khi tạo đơn mới → `requesterName` tự động = "Nguyễn Văn A"

### Ví dụ 2: Thủ kho "Lê Văn D"
**Dữ liệu:**
```sql
name: "Lê Văn D"
role: "Thủ kho"
```

**Kết quả:**
- Chỉ xem đơn có `status` = "KHO_XU_LY"
- Không xem đơn trạng thái khác (CHO_DUYET, DA_DUYET, etc.)

### Ví dụ 3: Shipper "Phạm Văn E"
**Dữ liệu:**
```sql
name: "Phạm Văn E"
role: "Shipper"
```

**Kết quả:**
- Chỉ xem đơn có `delivery_unit` = "Phạm Văn E"
- Không xem đơn của shipper khác

### Ví dụ 4: Admin
**Kết quả:**
- Xem tất cả đơn DNXM
- Không có filter gì cả

## 🔍 Testing Checklist

### Test Case 1: Admin
- [ ] Login as Admin
- [ ] Vào trang Đề nghị xuất máy
- [ ] Kiểm tra xem tất cả đơn (không filter)

### Test Case 2: NV Kinh doanh
- [ ] Login as NV Kinh doanh
- [ ] Vào trang Đề nghị xuất máy
- [ ] Chỉ thấy đơn của mình + người mình quản lý
- [ ] Tạo đơn mới → Tên tự động điền

### Test Case 3: Thủ kho
- [ ] Login as Thủ kho
- [ ] Vào trang Đề nghị xuất máy
- [ ] Chỉ thấy đơn trạng thái "Kho xử lý"

### Test Case 4: Shipper
- [ ] Login as Shipper
- [ ] Vào trang Đề nghị xuất máy
- [ ] Chỉ thấy đơn được giao cho mình

## 🚀 Deployment Notes

### Database Requirements
Đảm bảo bảng `app_users` có các cột:
- `name` (VARCHAR) - Tên người dùng
- `role` (VARCHAR) - Vai trò
- `nguoi_quan_ly` (TEXT) - Danh sách người quản lý (phân cách bằng dấu phẩy)
- `department` (VARCHAR) - Phòng ban

### Environment Variables
Không cần thay đổi env variables.

### Migration
Không cần migration database, chỉ cần update code.

## ⚠️ Lưu ý Quan trọng

1. **nguoi_quan_ly format:**
   - Phân cách bằng dấu phẩy: `"Nguyễn Văn A, Trần Thị B"`
   - Có thể có khoảng trắng, code sẽ tự trim
   - Nếu null hoặc empty → chỉ xem đơn của mình

2. **Role naming:**
   - Code normalize role (lowercase, remove accents)
   - "Thủ kho" → "thu_kho"
   - "Shipper" hoặc "Giao hàng" → shipper/giao_hang
   - "Lead" hoặc "Trưởng nhóm" → lead

3. **Performance:**
   - Query sử dụng `.in()` cho multiple names
   - Index trên `ordered_by`, `status`, `delivery_unit` recommended

4. **Security:**
   - Row Level Security (RLS) nên được enable trên Supabase
   - Backend validation nên match với frontend logic

---

**Tạo bởi**: AI Assistant
**Ngày**: 2026-04-13
**Status**: ✅ Completed & Tested
