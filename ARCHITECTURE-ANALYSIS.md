# Phân tích Kiến trúc & Database - PlasmaVN

## 🏗️ KIẾN TRÚC TỔNG QUAN

### Tech Stack
- **Frontend**: React 18.3 + Vite
- **Routing**: React Router DOM v6
- **UI Framework**: Tailwind CSS v3.4 + Radix UI
- **State Management**: React Hooks (useState, useEffect)
- **Database**: Supabase (PostgreSQL)
- **Charts**: Chart.js + React-Chartjs-2
- **Icons**: Lucide React
- **Forms**: React Hook Form (implied)
- **Notifications**: React Toastify
- **PDF**: jsPDF + jsPDF-AutoTable
- **Excel**: XLSX
- **Barcode/QR**: @zxing/library, html5-qrcode
- **Authentication**: Supabase Auth + bcryptjs

### Cấu trúc Project
```
src/
├── components/          # React components
│   ├── Common/         # Shared components
│   ├── layout/         # Layout components (Header, Sidebar, etc)
│   ├── ui/             # UI primitives (Button, Modal, etc)
│   ├── Orders/         # Order-specific components
│   ├── Cylinders/      # Cylinder management
│   ├── Machines/       # Machine management
│   └── ...             # Domain-specific components
├── pages/              # Page components (Routes)
├── constants/          # Constants & configurations
├── hooks/              # Custom React hooks
├── services/           # Business logic services
├── utils/              # Utility functions
├── database/sql/       # SQL schemas & migrations
└── supabase/           # Supabase config
```

## 📊 DATABASE SCHEMA

### Core Entities (11 bảng chính)

#### 1. **customers** - Khách hàng
```sql
- id (UUID)
- code (VARCHAR) - Mã KH: KH001, BV-BM
- name, phone, address
- warehouse_id - Kho xuất hàng
- managed_by - NV phụ trách
- care_by - NV chăm sóc
- category - Loại KH (BV, TM, PK, NG, SP)
- customer_type - công/tư
- current_cylinders, current_machines
- borrowed_cylinders - Số vỏ đang mượn
- tax_code, invoice_address, invoice_email
- last_order_date, care_expiry_date
- status - Thành công/Chưa thành công
- success_at - Ngày thành công
```

**Business Logic:**
- Phân loại: Bệnh viện (BV), Thẩm mỹ (TM), Phòng khám (PK), Ngoại giao (NG), Spa (SP)
- Tracking nợ vỏ bình (borrowed_cylinders)
- Quản lý chăm sóc khách hàng (60 ngày)

#### 2. **orders** - Đơn hàng
```sql
- id (UUID)
- order_code (VARCHAR) - Mã đơn: 804, 3659
- customer_category - BV, TM, PK, NG, SP
- warehouse - HN, TP.HCM, TH, DN
- customer_name, recipient_name, recipient_address, recipient_phone
- order_type - Thường, Demo, DNXM (Đề nghị xuất máy)
- product_type - BINH, MAY, MAY_ROSY, MAY_MED, BINH_4L, BINH_8L
- quantity, unit_price, total_amount
- department - Khoa sử dụng
- promotion_code
- delivery_unit, shipper_id, shipping_fee
- delivery_image_url - Ảnh chứng từ
- assigned_cylinders (TEXT[]) - Mảng serial RFID
- status - Workflow states (13 trạng thái)
- ordered_by, sales_person
```

**Workflow States:**
1. CHO_DUYET - Chờ Lead duyệt
2. CHO_CTY_DUYET - Chờ Công ty duyệt  
3. KHO_XU_LY - Kho xử lý
4. DIEU_CHINH - Điều chỉnh
5. DA_DUYET - Đã duyệt
6. CHO_GIAO_HANG - Chờ giao hàng
7. DANG_GIAO_HANG - Đang giao
8. CHO_DOI_SOAT - Chờ đối soát
9. DOI_SOAT_THAT_BAI - Đối soát thất bại
10. HOAN_THANH - Hoàn thành
11. TRA_HANG - Trả hàng
12. HUY_DON - Hủy đơn

#### 3. **cylinders** - Vỏ bình khí
```sql
- id (UUID)
- serial_number (VARCHAR) - RFID: QR04116
- status - 8 trạng thái
- net_weight - Khối lượng tịnh
- category - BV (Bệnh viện), TM (Thẩm mỹ)
- volume, gas_type, valve_type, handle_type
- customer_name - Nếu thuộc KH
- cylinder_code - Mã khắc trên vỏ
- expiry_date - Ngày hết hạn
- error_reason, error_fixed_date, error_reported_by
```

**Status Flow:**
- sẵn sàng → đang vận chuyển → đang sử dụng → đã sử dụng → chờ nạp
- hỏng, thuộc khách hàng, bình rỗng

#### 4. **machines** - Máy móc thiết bị
```sql
- id (UUID)
- serial_number - Mã máy: PLT-25D1-50-TM
- machine_account - Auto từ serial
- status - 6 trạng thái
- warehouse - HN, TP.HCM, TH, DN
- bluetooth_mac
- machine_type - BV, TM, FM, IOT
- version, cylinder_volume, gas_type, valve_type
- emission_head_type - Loại đầu phát
- customer_name, department_in_charge
- maintenance_date, maintenance_type, maintenance_note
- next_maintenance_date, maintenance_by
```

#### 5. **warehouses** - Kho hàng
```sql
- id (UUID)
- name - Hà Nội, TP.HCM, Thanh Hóa, Đà Nẵng
- manager_name - Thủ kho
- address, capacity
- status - Đang hoạt động, Tạm ngưng, Đóng cửa
- branch_office - Chi nhánh
```

#### 6. **inventory** - Tồn kho (Master)
```sql
- id (UUID)
- warehouse_id - HN, TP.HCM, TH, DN
- item_type - MAY, BINH, VAT_TU
- item_name
- quantity - Số lượng tồn
- UNIQUE(warehouse_id, item_type, item_name)
```

#### 7. **inventory_transactions** - Lịch sử xuất/nhập
```sql
- id (UUID)
- inventory_id (FK)
- transaction_type - IN (nhập), OUT (xuất)
- reference_id, reference_code - PN001, Order Code
- quantity_changed
- note
```

**Inventory Logic:**
- Master-Detail pattern
- Real-time tracking
- Audit trail cho mọi giao dịch

### Supporting Tables

#### 8. **order_items** - Chi tiết đơn hàng
- Multi-product support
- product_type, quantity per item

#### 9. **order_history** - Lịch sử thay đổi đơn
- Audit trail
- changed_by, changed_at, old_status, new_status

#### 10. **shippers** - Đơn vị vận chuyển
- Viettel Post, GHN, Giao hàng nội bộ
- Tracking công nợ cước phí

#### 11. **goods_receipts** - Phiếu nhập kho
- receipt_code: PN001, PN002
- supplier_id, warehouse_id
- items (JSONB)

#### 12. **goods_issues** - Phiếu xuất kho
- issue_code: PX001
- order_id, warehouse_id
- items (JSONB)

#### 13. **cylinder_recoveries** - Thu hồi vỏ bình
- recovery_code
- customer_id, driver_name
- status workflow
- photos (TEXT[])

#### 14. **machine_recoveries** - Thu hồi máy
- Similar to cylinder_recoveries

#### 15. **repair_tickets** - Phiếu sửa chữa
- ticket_code
- machine_id, customer_id
- error_category, error_level
- expected_completion_date

#### 16. **promotions** - Khuyến mãi
- promotion_code
- discount_type, discount_value
- valid_from, valid_to

#### 17. **app_users** - Người dùng hệ thống
- username, password (bcrypt)
- role, department
- nguoi_quan_ly - Manager
- avatar

#### 18. **permissions** - Phân quyền
- role-based access control
- module_name, action_name

#### 19. **notifications** - Thông báo
- Real-time notifications
- user_id, message, read_status

#### 20. **customer_care_history** - Lịch sử chăm sóc KH
- customer_id, care_date
- care_type, notes

## 🔄 BUSINESS WORKFLOWS

### 1. Order Fulfillment Flow
```
Tạo đơn → CHO_DUYET (Lead) → CHO_CTY_DUYET (Company) 
→ KHO_XU_LY (Warehouse) → CHO_GIAO_HANG 
→ DANG_GIAO_HANG → CHO_DOI_SOAT → HOAN_THANH
```

**Roles:**
- Sales: Tạo đơn
- Lead: Duyệt đơn
- Company: Duyệt công ty
- Thủ kho: Xuất kho, gán serial RFID
- Shipper: Giao hàng, chụp ảnh chứng từ
- Accountant: Đối soát

### 2. Inventory Management
```
Nhập kho (goods_receipts) → inventory +
Xuất kho (goods_issues) → inventory -
```

**Tracking:**
- Real-time balance
- Transaction history
- Multi-warehouse support

### 3. Cylinder Lifecycle
```
Mới → Sẵn sàng → Giao cho KH → Đang sử dụng 
→ Thu hồi → Chờ nạp → Sẵn sàng
```

**Special Cases:**
- Hỏng → Sửa chữa → Sẵn sàng
- Thuộc khách hàng (permanent)
- Quá hạn kiểm định

### 4. Machine Management
```
Nhập kho → Sẵn sàng → Giao cho KH → Thuộc KH
→ Bảo trì định kỳ → Sửa chữa (nếu cần)
```

**Maintenance:**
- Quarterly reports
- Preventive maintenance
- Repair tracking

### 5. Customer Care
```
Khách mới → Chưa thành công → Chăm sóc 60 ngày 
→ Thành công → Chăm sóc định kỳ
```

**Metrics:**
- Last order date
- Care expiry date
- Success rate

## 🎯 KEY FEATURES

### 1. RFID/Barcode Tracking
- Cylinder serial scanning
- Machine serial tracking
- Real-time location updates

### 2. Multi-Warehouse
- 4 warehouses: HN, TP.HCM, TH, DN
- Independent inventory
- Transfer between warehouses

### 3. Customer Debt Tracking
- Borrowed cylinders
- Shipping fees
- Payment reconciliation

### 4. Approval Workflow
- Multi-level approval (Lead → Company → Warehouse)
- Role-based permissions
- Audit trail

### 5. Reporting
- Customer reports
- Inventory reports
- Sales reports
- Machine/Cylinder aging
- Quarterly maintenance

### 6. Mobile Responsive
- Touch-friendly UI
- Mobile filters
- Card-based layouts
- Bottom navigation

## 🔐 SECURITY & PERMISSIONS

### Role-Based Access Control (RBAC)
```javascript
Roles:
- Admin: Full access
- Lead: Approve orders, view reports
- Sales: Create orders, view customers
- Thủ kho: Manage inventory, assign serials
- Shipper: Update delivery status
- Accountant: Reconciliation
- CSKH: Customer care
```

### Row Level Security (RLS)
- Supabase RLS policies
- User-based data filtering
- Warehouse-based filtering

### Authentication
- Supabase Auth
- bcryptjs password hashing
- Session management

## 📱 FRONTEND ARCHITECTURE

### Component Structure
```
Pages (Routes)
  ↓
Layout Components (Header, Sidebar)
  ↓
Feature Components (Orders, Cylinders)
  ↓
UI Components (Button, Modal, Table)
```

### State Management
- Local state: useState
- Side effects: useEffect
- Custom hooks: usePermissions, useReports
- No global state library (Redux/Zustand)

### Data Fetching
- Supabase client
- Real-time subscriptions
- Optimistic updates

### UI Patterns
- Mobile-first design
- Card-based layouts
- Filter sheets
- Pagination
- Toast notifications
- Modal dialogs

### Performance
- Code splitting (React.lazy)
- Memoization (useMemo, useCallback)
- Virtual scrolling (for large lists)
- Image lazy loading

## 🗄️ DATABASE RELATIONSHIPS

### Entity Relationship Diagram (ERD)

```
customers (1) ──< (N) orders
customers (1) ──< (N) cylinder_recoveries
customers (1) ──< (N) machine_recoveries
customers (1) ──< (N) customer_care_history

orders (1) ──< (N) order_items
orders (1) ──< (N) order_history
orders (N) ──> (1) shippers
orders (N) ──> (1) warehouses

cylinders (N) ──> (1) customers (via customer_name)
machines (N) ──> (1) customers (via customer_name)

inventory (N) ──> (1) warehouses
inventory (1) ──< (N) inventory_transactions

goods_receipts (N) ──> (1) warehouses
goods_receipts (N) ──> (1) suppliers

goods_issues (N) ──> (1) warehouses
goods_issues (N) ──> (1) orders

repair_tickets (N) ──> (1) machines
repair_tickets (N) ──> (1) customers

app_users (1) ──< (N) permissions
```

### Key Indexes
- serial_number (cylinders, machines) - UNIQUE
- order_code (orders) - UNIQUE
- customer_code (customers) - UNIQUE
- warehouse_id + item_type + item_name (inventory) - UNIQUE
- status (orders, cylinders, machines) - For filtering
- created_at (all tables) - For sorting

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### Hosting
- Frontend: Vercel (implied from vercel.json)
- Database: Supabase (PostgreSQL)
- Storage: Supabase Storage (for images)

### Environment Variables
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Build Process
```bash
npm run dev      # Development server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
```

## 📊 BUSINESS METRICS

### KPIs Tracked
1. **Sales**
   - Total orders
   - Revenue by period
   - Orders by status
   - Orders by customer category

2. **Inventory**
   - Stock levels by warehouse
   - Stock movements
   - Low stock alerts

3. **Customer**
   - Active customers
   - Customer debt (cylinders)
   - Care expiry tracking
   - Success rate

4. **Operations**
   - Delivery success rate
   - Average delivery time
   - Reconciliation rate
   - Machine/Cylinder utilization

## 🎨 UI/UX PATTERNS

### Design System
- **Colors**: Primary (blue), Success (green), Warning (amber), Error (red)
- **Typography**: System fonts, responsive sizes
- **Spacing**: Tailwind scale (0.5, 1, 2, 3, 4, 6, 8, 12, 16)
- **Borders**: Rounded corners (lg, xl, 2xl)
- **Shadows**: Subtle elevation

### Mobile Optimizations
- Bottom navigation
- Filter sheets (slide up)
- Card-based layouts
- Touch targets (min 44x44px)
- Swipe gestures
- Pull to refresh

### Accessibility
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus states
- Color contrast (WCAG AA)

## 🔧 TECHNICAL DEBT & IMPROVEMENTS

### Current Issues
1. No global state management (can cause prop drilling)
2. Mixed data fetching patterns
3. Limited error boundaries
4. No automated testing
5. Manual SQL migrations

### Recommended Improvements
1. **State Management**: Add Zustand/Redux for complex state
2. **Data Fetching**: Standardize with React Query
3. **Testing**: Add Jest + React Testing Library
4. **CI/CD**: Automated testing + deployment
5. **Monitoring**: Add error tracking (Sentry)
6. **Performance**: Add bundle analysis
7. **Documentation**: API documentation
8. **Type Safety**: Consider TypeScript migration

## 📈 SCALABILITY CONSIDERATIONS

### Current Capacity
- Single database instance (Supabase)
- 4 warehouses
- ~20 tables
- Estimated: 1000s of orders/month

### Scaling Strategies
1. **Database**
   - Add read replicas
   - Implement caching (Redis)
   - Partition large tables
   - Archive old data

2. **Frontend**
   - CDN for static assets
   - Code splitting
   - Lazy loading
   - Service workers

3. **Backend**
   - API rate limiting
   - Queue system for heavy tasks
   - Microservices for specific domains

## 🎯 DOMAIN MODEL

### Core Concepts
1. **Product**: Cylinders (vỏ bình) + Machines (máy)
2. **Customer**: BV, TM, PK, NG, SP categories
3. **Order**: Multi-step approval workflow
4. **Inventory**: Multi-warehouse tracking
5. **Logistics**: Delivery + Recovery
6. **Maintenance**: Repair + Care

### Business Rules
- Cylinder must have valid expiry date
- Machine requires quarterly maintenance
- Customer care expires after 60 days
- Order requires multi-level approval
- Inventory cannot go negative
- RFID serial must be unique

## 🏁 CONCLUSION

### Strengths
✅ Clear domain model
✅ Comprehensive tracking (RFID/Barcode)
✅ Multi-level approval workflow
✅ Mobile-responsive UI
✅ Real-time updates (Supabase)
✅ Audit trail for all transactions
✅ Role-based access control

### Weaknesses
⚠️ No automated testing
⚠️ Limited error handling
⚠️ Manual SQL migrations
⚠️ No API documentation
⚠️ Prop drilling in some components
⚠️ Mixed coding patterns

### Overall Assessment
**Grade: B+ (Good, Production-Ready)**

PlasmaVN là một hệ thống quản lý ERP đầy đủ chức năng cho ngành khí y tế, 
với kiến trúc rõ ràng, database được thiết kế tốt, và UI/UX thân thiện với 
người dùng. Hệ thống có thể scale và maintain được, nhưng cần cải thiện về 
testing và documentation.

---

**Tạo bởi**: AI Analysis
**Ngày**: 2026-04-13
**Version**: 1.0
