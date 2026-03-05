# Logic Trang Danh Sách Đơn Hàng

**Route:** `/danh-sach-don-hang`  
**File:** `src/pages/Orders.jsx`

---

## 📋 Tổng Quan

Trang Danh Sách Đơn Hàng là trang quản lý đơn hàng chính của hệ thống, cung cấp 2 chế độ xem:
- **Danh sách**: Hiển thị bảng đơn hàng với các tính năng lọc, tìm kiếm, chỉnh sửa
- **Thống kê**: Hiển thị các biểu đồ phân tích dữ liệu đơn hàng

---

## 🏗️ Cấu Trúc Component

### 1. Imports & Dependencies

```javascript
// Chart.js cho biểu đồ thống kê
- Chart.js components (Bar, Pie, Line)
- react-chartjs-2

// UI Components
- lucide-react icons
- React hooks (useState, useEffect)
- React Router (useNavigate)

// Custom Components
- ColumnToggle: Quản lý hiển thị cột
- OrderFormModal: Modal tạo/sửa đơn hàng
- OrderStatusUpdater: Modal cập nhật trạng thái
- OrderPrintTemplate: Template in đơn hàng

// Constants & Hooks
- orderConstants: Các hằng số (status, types, categories)
- useColumnVisibility: Hook quản lý cột hiển thị
- usePermissions: Hook kiểm tra quyền
- supabase: Client kết nối database
```

---

## 🔄 State Management

### 2.1. Core States

```javascript
// View State
activeView: 'list' | 'stats'  // Chế độ xem hiện tại

// Data States
orders: []                     // Danh sách đơn hàng từ DB
isLoading: boolean            // Trạng thái loading
filteredOrders: []            // Danh sách đơn hàng sau khi lọc (computed)

// Selection States
selectedIds: []               // IDs các đơn hàng đã chọn
selectedOrder: Order | null   // Đơn hàng đang được xử lý

// Modal States
isActionModalOpen: boolean    // Modal cập nhật trạng thái
isFormModalOpen: boolean      // Modal form tạo/sửa
serialsModalOrder: Order | null  // Modal xem mã serial
ordersToPrint: Order | Order[]  // Đơn hàng để in
orderToEdit: Order | null     // Đơn hàng đang chỉnh sửa

// Search & Filter States
searchTerm: string            // Từ khóa tìm kiếm
selectedStatuses: []          // Trạng thái đã chọn
selectedCustomerCategories: [] // Loại khách đã chọn
selectedOrderTypes: []        // Loại đơn đã chọn
selectedProductTypes: []      // Loại hàng hóa đã chọn
selectedCustomers: []         // Khách hàng đã chọn
uniqueCustomers: []           // Danh sách khách hàng unique (computed)
```

### 2.2. Column Visibility State

```javascript
// Quản lý bởi hook useColumnVisibility
visibleColumns: Set<string>   // Các cột đang hiển thị
visibleTableColumns: []       // Các cột hiển thị (computed từ TABLE_COLUMNS)
```

---

## 📊 Logic Xử Lý Dữ Liệu

### 3.1. Fetch Data

```javascript
fetchOrders()
├── Gọi Supabase: from('orders').select('*')
├── Sắp xếp: order('created_at', { ascending: false })
├── Set state: setOrders(data)
└── Error handling: alert nếu có lỗi
```

**Trigger:** Component mount (useEffect)

### 3.2. Extract Unique Customers

```javascript
useEffect(() => {
    const customers = [...new Set(orders.map(o => o.customer_name).filter(Boolean))];
    setUniqueCustomers(customers);
}, [orders]);
```

**Mục đích:** Tạo danh sách khách hàng unique cho bộ lọc

---

## 🔍 Logic Lọc Dữ Liệu

### 4.1. Filter Function

```javascript
filteredOrders = orders.filter(order => {
    // 1. Tìm kiếm text
    matchesSearch = 
        order.order_code?.includes(search) ||
        order.customer_name?.includes(search) ||
        order.recipient_name?.includes(search) ||
        order.recipient_phone?.includes(search)
    
    // 2. Lọc theo trạng thái
    matchesStatus = 
        selectedStatuses.length === 0 || 
        selectedStatuses.includes(order.status)
    
    // 3. Lọc theo loại khách
    matchesCategory = 
        selectedCustomerCategories.length === 0 || 
        selectedCustomerCategories.includes(order.customer_category)
    
    // 4. Lọc theo loại đơn
    matchesOrderType = 
        selectedOrderTypes.length === 0 || 
        selectedOrderTypes.includes(order.order_type)
    
    // 5. Lọc theo hàng hóa
    matchesProductType = 
        selectedProductTypes.length === 0 || 
        selectedProductTypes.includes(order.product_type)
    
    // 6. Lọc theo khách hàng
    matchesCustomer = 
        selectedCustomers.length === 0 || 
        selectedCustomers.includes(order.customer_name)
    
    // Kết hợp tất cả điều kiện
    return matchesSearch && matchesStatus && matchesCategory && 
           matchesOrderType && matchesProductType && matchesCustomer
})
```

**Đặc điểm:**
- Tất cả bộ lọc là AND logic (phải thỏa mãn tất cả)
- Nếu không chọn gì trong một bộ lọc → hiển thị tất cả
- Tìm kiếm không phân biệt hoa thường

### 4.2. Tính Toán Tổng Hợp

```javascript
// Số lượng đơn hàng sau lọc
filteredOrdersCount = filteredOrders.length

// Tổng tiền
totalAmount = filteredOrders.reduce((sum, order) => {
    return sum + (order.total_amount || (order.quantity || 0) * (order.unit_price || 0));
}, 0)
```

---

## 🎨 UI Components Logic

### 5.1. Navigation Tabs

```javascript
// State: activeView
// Values: 'list' | 'stats'

onClick Tab "Danh sách" → setActiveView('list')
onClick Tab "Thống kê" → setActiveView('stats')

// Conditional Rendering:
activeView === 'list' ? <ListView /> : <StatsView />
```

### 5.2. Search Bar

```javascript
// State: searchTerm
// Real-time filtering: onChange → setSearchTerm → filteredOrders tự động cập nhật
```

### 5.3. Summary Stats Box

```javascript
// Hiển thị:
- Số lượng đơn hàng: filteredOrdersCount
- Tổng tiền: formatNumber(totalAmount) + " đ"

// Format số: formatNumber(num) → "1.234.567"
```

### 5.4. Filter Dropdowns

**Component:** `FilterDropdown`

**Props:**
- `label`: Tên bộ lọc
- `selectedCount`: Số lượng đã chọn
- `totalCount`: Tổng số options
- `onSelectAll`: Callback chọn/bỏ chọn tất cả
- `children`: Danh sách checkbox

**Logic:**
```javascript
// Mở/đóng dropdown
isOpen state → toggle khi click button

// Chọn tất cả
onSelectAll() {
    if (selectedCount === totalCount) {
        clearSelection()
    } else {
        selectAll()
    }
}

// Chọn từng item
onChange checkbox → 
    if checked: add to selection
    if unchecked: remove from selection
```

**5 Bộ lọc:**
1. **Trạng thái**: `selectedStatuses` ↔ `ORDER_STATUSES`
2. **Loại khách**: `selectedCustomerCategories` ↔ `CUSTOMER_CATEGORIES`
3. **Loại đơn**: `selectedOrderTypes` ↔ `ORDER_TYPES`
4. **Hàng hóa**: `selectedProductTypes` ↔ `PRODUCT_TYPES`
5. **Khách hàng**: `selectedCustomers` ↔ `uniqueCustomers`

---

## 📋 Table Logic

### 6.1. Column Visibility

```javascript
// Hook: useColumnVisibility('columns_orders', TABLE_COLUMNS)
// Lưu preferences vào localStorage

visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key))

// Các cột có thể ẩn/hiện:
- code (Mã ĐH)
- category (Loại khách)
- customer (Khách hàng)
- recipient (Người nhận)
- type (Loại đơn)
- product (Hàng hóa)
- quantity (Số lượng)
- department (Mã máy)
- cylinders (Mã bình)
- status (Trạng thái)
- date (Ngày đặt)
```

### 6.2. Row Selection

```javascript
// Select All
toggleSelectAll() {
    if (all selected) → clear selection
    else → select all filteredOrders
}

// Select Single
toggleSelect(id) {
    if (selected) → remove
    else → add
}
```

### 6.3. Status Badge Colors

```javascript
getStatusConfig(statusId) → { label, color }

// Color mapping:
'blue' → bg: #E0E7FF, text: #4338CA, border: #C7D2FE
'yellow' → bg: #FEF3C7, text: #92400E, border: #FDE68A
'orange' → bg: #FFEDD5, text: #C2410C, border: #FED7AA
'indigo' → bg: #E0E7FF, text: #4338CA, border: #C7D2FE
'purple' → bg: #F3E8FF, text: #7C3AED, border: #E9D5FF
'cyan' → bg: #CFFAFE, text: #0E7490, border: #A5F3FC
'red' → bg: #FEE2E2, text: #991B1B, border: #FECACA
'green' → bg: #D1FAE5, text: #065F46, border: #A7F3D0
'gray' → bg: #F3F4F6, text: #374151, border: #E5E7EB
```

### 6.4. Cylinders Display

```javascript
// Hiển thị tối đa 3 mã đầu tiên
// Nếu > 3: hiển thị button "+N nữa"
// Click button → mở modal xem tất cả
```

---

## 🎯 Action Handlers

### 7.1. Print

```javascript
handlePrint(order)
├── setOrdersToPrint(order)
└── setTimeout(() => window.print(), 150)

handleBulkPrint()
├── Validate: selectedIds.length > 0
├── Filter: orders.filter(o => selectedIds.includes(o.id))
├── setOrdersToPrint(selectedOrders)
└── setTimeout(() => window.print(), 150)
```

### 7.2. Edit

```javascript
handleEditOrder(order)
├── setOrderToEdit(order)
└── setIsFormModalOpen(true)

// Modal sẽ load order data vào form
```

### 7.3. Delete

```javascript
handleDeleteOrder(id, orderCode)
├── Confirm: window.confirm()
├── Supabase: from('orders').delete().eq('id', id)
├── Refresh: fetchOrders()
└── Error handling: alert nếu có lỗi
```

### 7.4. Update Status

```javascript
handleAction(order)
├── setSelectedOrder(order)
└── setIsActionModalOpen(true)

// Modal OrderStatusUpdater sẽ xử lý cập nhật
```

---

## 📊 Statistics Logic

### 8.1. Statistics Functions

```javascript
// 1. Thống kê theo Trạng thái
getStatusStats()
├── Loop: filteredOrders
├── Group by: getStatusConfig(order.status).label
├── Count: stats[label]++
└── Return: [{ name, value }]

// 2. Thống kê theo Loại khách
getCategoryStats()
├── Loop: filteredOrders
├── Group by: getLabel(CUSTOMER_CATEGORIES, order.customer_category)
├── Count: stats[label]++
└── Return: [{ name, value }]

// 3. Thống kê theo Loại đơn
getOrderTypeStats()
├── Loop: filteredOrders
├── Group by: getLabel(ORDER_TYPES, order.order_type)
├── Count: stats[label]++
└── Return: [{ name, value }]

// 4. Thống kê theo Hàng hóa
getProductTypeStats()
├── Loop: filteredOrders
├── Group by: getLabel(PRODUCT_TYPES, order.product_type)
├── Count: stats[label]++
└── Return: [{ name, value }]

// 5. Top 10 Khách hàng
getCustomerStats()
├── Loop: filteredOrders
├── Group by: order.customer_name
├── Count: stats[customer]++
├── Sort: descending by value
├── Slice: top 10
└── Return: [{ name, value }]

// 6. Doanh thu theo Trạng thái
getRevenueByStatus()
├── Loop: filteredOrders
├── Group by: getStatusConfig(order.status).label
├── Sum: amount = total_amount || (quantity * unit_price)
├── Accumulate: stats[label] += amount
└── Return: [{ name, value }]
```

### 8.2. Chart Configuration

**Chart Colors:**
```javascript
chartColors = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
]
```

**Chart Types:**
- **Pie Chart**: Trạng thái, Loại khách
- **Bar Chart**: Loại đơn, Hàng hóa, Doanh thu theo trạng thái
- **Horizontal Bar Chart**: Top 10 Khách hàng

---

## 🔄 Data Flow

### 9.1. Initial Load

```
Component Mount
    ↓
useEffect → fetchOrders()
    ↓
Supabase Query
    ↓
setOrders(data)
    ↓
useEffect → Extract uniqueCustomers
    ↓
filteredOrders computed
    ↓
Render UI
```

### 9.2. Filter Flow

```
User Action (Search/Filter)
    ↓
State Update (setSearchTerm, setSelectedStatuses, ...)
    ↓
filteredOrders recomputed
    ↓
filteredOrdersCount & totalAmount recomputed
    ↓
UI Re-render với data mới
```

### 9.3. Statistics Flow

```
Switch to Stats View
    ↓
getStatusStats() → compute from filteredOrders
getCategoryStats() → compute from filteredOrders
...
    ↓
Chart data prepared
    ↓
Charts render với data
```

---

## 🎨 UI/UX Features

### 10.1. Responsive Design
- Grid layout tự động điều chỉnh
- Table có horizontal scroll trên mobile
- Dropdown filters wrap trên màn hình nhỏ

### 10.2. Loading States
- Spinner khi đang tải dữ liệu
- Empty state khi không có kết quả

### 10.3. Interactive Elements
- Hover effects trên rows
- Transition animations
- Click outside để đóng dropdown

### 10.4. Typography
- Font: Roboto (system fallback)
- Consistent color scheme
- Professional spacing

---

## 🔐 Permissions & Security

```javascript
// Sử dụng usePermissions hook
const { role } = usePermissions();

// Role-based features có thể được implement
// Hiện tại: Tất cả users đều có quyền xem và chỉnh sửa
```

---

## 📝 Constants Reference

### ORDER_STATUSES
```javascript
[
    { id: 'CHO_DUYET', label: 'Chờ KD duyệt', color: 'yellow' },
    { id: 'CHO_CTY_DUYET', label: 'Chờ Cty duyệt', color: 'orange' },
    { id: 'KHO_XU_LY', label: 'Kho đang xử lý', color: 'blue' },
    { id: 'DA_DUYET', label: 'Đã xuất kho', color: 'indigo' },
    { id: 'HOAN_THANH', label: 'Hoàn thành', color: 'green' },
    // ... và các status khác
]
```

### CUSTOMER_CATEGORIES
```javascript
[
    { id: 'BV', label: 'Bệnh viện' },
    { id: 'TM', label: 'Thẩm mỹ viện' },
    { id: 'PK', label: 'Phòng khám' },
    { id: 'NG', label: 'Khách ngoại giao' }
]
```

### ORDER_TYPES
```javascript
[
    { id: 'THUONG', label: 'Đơn thường' },
    { id: 'DEMO', label: 'Đơn demo' },
    { id: 'NGOAI_GIAO', label: 'Đơn ngoại giao' },
    { id: 'NGHIEN_CUU', label: 'Đơn nghiên cứu' }
]
```

### PRODUCT_TYPES
```javascript
[
    { id: 'MAY', label: 'Máy' },
    { id: 'BINH', label: 'Bình' }
]
```

---

## 🐛 Error Handling

### 11.1. Fetch Errors
```javascript
try {
    const { data, error } = await supabase...
    if (error) throw error;
} catch (error) {
    console.error('Error:', error);
    alert('❌ Không thể tải danh sách đơn hàng: ' + error.message);
}
```

### 11.2. Delete Errors
```javascript
try {
    const { error } = await supabase.from('orders').delete()...
    if (error) throw error;
    fetchOrders(); // Refresh on success
} catch (error) {
    alert('❌ Có lỗi xảy ra khi xóa đơn hàng: ' + error.message);
}
```

---

## 🔄 Component Lifecycle

```
1. Component Mount
   ├── Register Chart.js components
   ├── Initialize states
   └── useEffect → fetchOrders()

2. Data Loaded
   ├── setOrders(data)
   ├── Extract uniqueCustomers
   └── Compute filteredOrders

3. User Interactions
   ├── Search → update searchTerm
   ├── Filter → update filter states
   ├── Select → update selectedIds
   └── Actions → open modals

4. Data Updates
   ├── Modal submit → fetchOrders()
   ├── Delete → fetchOrders()
   └── Status update → fetchOrders()
```

---

## 📦 Dependencies

- **react**: ^18.3.1
- **react-router-dom**: ^6.26.0
- **chart.js**: ^4.5.1
- **react-chartjs-2**: ^5.3.1
- **@supabase/supabase-js**: ^2.90.0
- **lucide-react**: ^0.553.0

---

## 🎯 Key Features Summary

1. ✅ **Dual View Mode**: Danh sách và Thống kê
2. ✅ **Advanced Filtering**: 5 bộ lọc với checkbox, chọn nhiều
3. ✅ **Real-time Search**: Tìm kiếm theo nhiều trường
4. ✅ **Bulk Operations**: Chọn nhiều, in hàng loạt
5. ✅ **Column Management**: Ẩn/hiện cột, lưu preferences
6. ✅ **Statistics Dashboard**: 6 biểu đồ phân tích
7. ✅ **CRUD Operations**: Tạo, đọc, sửa, xóa đơn hàng
8. ✅ **Status Management**: Cập nhật trạng thái đơn hàng
9. ✅ **Print Functionality**: In đơn hàng đơn lẻ hoặc hàng loạt
10. ✅ **Responsive Design**: Tối ưu cho mọi kích thước màn hình

---

## 🔍 Performance Considerations

1. **Computed Values**: `filteredOrders`, `filteredOrdersCount`, `totalAmount` được tính toán mỗi render
2. **Memoization**: Có thể optimize bằng `useMemo` cho các tính toán phức tạp
3. **Chart Rendering**: Charts chỉ render khi ở Stats view
4. **Column Visibility**: Lưu preferences vào localStorage để tránh re-render

---

## 📌 Notes

- Tất cả dữ liệu được lọc từ `filteredOrders` (đã áp dụng search + filters)
- Statistics charts tự động cập nhật khi filters thay đổi
- Font Roboto được áp dụng inline style để đảm bảo hiển thị
- Màu sắc được định nghĩa theo design system chuyên nghiệp
