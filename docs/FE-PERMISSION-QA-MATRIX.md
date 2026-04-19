# Ma tran phan quyen FE va checklist QA

Ngay cap nhat: 2026-04-19
Pham vi: Frontend visibility va action-level permission theo 5 rule da chot.

Ghi chu role: Manager duoc map vao nhom Cong ty (scope all) de dong nhat voi helper phan quyen trung tam.

## 1) Rule scope chuan

1. NVKD: chi thay du lieu cua minh (own)
2. Leader: thay du lieu cua team minh (team)
3. Cong ty: thay tat ca du lieu (all)
4. Kho: thay du lieu thuoc kho phu trach (warehouse)
5. Shipper: thay don duoc giao cho minh (assigned_orders)

Quy uoc alias hien tai:
- Cong ty = Admin + Manager
- Kho = cac role chua tu khoa kho/thukho/warehouse

## 2) Nguon su that phan quyen

- Role helper trung tam: src/utils/accessControl.js
- Hook phan quyen: src/hooks/usePermissions.js
- Scope cho report: src/hooks/useReports.js
- DB RLS migration: src/database/sql/add_role_scope_rls_policies.sql

Ghi chu: Khi QA thay ket qua lech policy, uu tien doi chieu 3 file tren truoc.

## 3) Ma tran doi chieu theo trang

| Trang / Chuc nang | NVKD | Leader | Cong ty | Kho | Shipper |
|---|---|---|---|---|---|
| Don hang (Orders) list | Own theo ordered_by | Team theo ordered_by | Full | Theo warehouse + luong kho | Theo delivery_unit |
| De nghi xuat may (MachineRequests) list | Own theo ordered_by | Team theo ordered_by | Full | Theo warehouse (va luong kho khi xu ly) | Theo delivery_unit |
| Khach hang (Customers) list | Own theo managed_by/care_by | Team theo managed_by/care_by | Full | Theo kho neu role kho | Khong uu tien scope rieng |
| Bao cao (useReports) | Own / team tuy view | Team | Full | Theo kho phu trach | Theo assigned orders neu lien quan don |
| Cylinders list | Theo policy hien tai + loc nghiep vu | Theo policy hien tai + loc nghiep vu | Full + manage actions | Theo kho phu trach | Theo policy hien tai |
| Machines list | Theo policy hien tai + loc nghiep vu | Theo policy hien tai + loc nghiep vu | Full + manage actions | Theo kho phu trach | Theo policy hien tai |
| Goods Issues | Theo policy hien tai | Theo policy hien tai | Full | Theo warehouse_id | Theo policy hien tai |
| Goods Receipts | Theo policy hien tai | Theo policy hien tai | Full | Theo warehouse_id | Theo policy hien tai |
| Inventory Transfer / TransferList | Theo policy hien tai | Theo policy hien tai | Full + duyet | Theo kho + duyet | Theo policy hien tai |
| Warehouses CRUD | Khong phai role quan tri thi han che action | Khong phai role quan tri thi han che action | Full manage | Theo scope kho (khong full manage) | Khong full manage |
| Suppliers CRUD | Han che xoa/sua theo policy | Han che xoa/sua theo policy | Full manage | Han che | Han che |
| Shippers CRUD | Han che xoa/sua theo policy | Han che xoa/sua theo policy | Full manage | Han che | Han che |
| Cylinder Recoveries | Han che xoa/sua theo policy | Han che xoa/sua theo policy | Full manage | Theo scope nghiep vu | Theo scope nghiep vu |

## 4) Checklist test tay theo role

### 4.1 Admin / Manager / Cong ty

- Dang nhap role cong ty.
- Mo Orders, MachineRequests, Customers, Reports.
- Ky vong: thay full data, khong bi ep scope own/team/warehouse/assigned.
- Thu action quan tri o cac trang master (Warehouses, Suppliers, Shippers, Cylinders, Machines, Cylinder Recoveries).
- Ky vong: cac nut quan tri hien day du theo thiet ke.

Test bo sung cho Manager:
- Dang nhap role Manager.
- Ky vong: hanh vi giong Admin/Cong ty tren cac trang pham vi FE da migrate.

### 4.2 NVKD

- Dang nhap role NVKD.
- Vao Orders va MachineRequests.
- Ky vong: chi thay ban ghi ordered_by trung ten minh (hoac username alias da map).
- Vao Customers.
- Ky vong: chi thay ban ghi co managed_by hoac care_by thuoc minh.
- Thu tao don moi.
- Ky vong: thong tin NV phu trach tu dien dung user hien tai.

### 4.3 Leader

- Dang nhap role Leader.
- Vao Orders va MachineRequests.
- Ky vong: thay du lieu cua minh va nhom minh quan ly.
- Vao Customers.
- Ky vong: thay tap own + team theo managed_by/care_by.
- Thu duyet theo cac muc trang thai cho phep.
- Ky vong: hien dung nut duyet theo workflow.

### 4.4 Kho

- Dang nhap role Kho, bao dam user co department map kho.
- Vao Orders, MachineRequests, GoodsIssues, GoodsReceipts, Cylinders, Machines.
- Ky vong: du lieu bi gioi han theo kho phu trach (warehouse code/warehouse_id).
- Vao TransferList.
- Ky vong: role kho co quyen duyet dieu chuyen theo policy.
- Thu tao don co san pham binh.
- Ky vong: danh sach serial goi y va validate serial chi trong dung kho dang chon.

### 4.5 Shipper

- Dang nhap role Shipper.
- Vao Orders va MachineRequests.
- Ky vong: chi thay don co delivery_unit trung voi shipper hien tai.
- Thu cap nhat thao tac giao hang cho don duoc gan.
- Ky vong: thao tac hop le tren don cua minh, khong thay don shipper khac.

## 5) Checklist regression cross-role

- Chuyen nhanh giua 2 role tren 2 tab, hard refresh tung tab.
- Ky vong: scope cap nhat dung ngay sau khi doi role.
- Kiem tra bo loc UI (status, warehouse, customer) khong mo rong vuot scope role.
- Kiem tra tong so ban ghi tren header va list khong gay hieu nham (tong vs da loc).
- Kiem tra submit form loi validation luon co thong bao ro rang, khong con trang thai bam nut khong phan hoi.

## 6) Data setup de test nhanh

- Tao toi thieu 6 user test: 1 admin, 1 manager, 1 leader, 1 NVKD, 1 kho, 1 shipper.
- Tao bo du lieu mau co:
  - Don hang phan bo cho 2 NVKD khac nhau.
  - Don giao cho 2 shipper khac nhau.
  - Don thuoc it nhat 2 kho khac nhau.
  - Khach hang co managed_by va care_by chia theo own/team.
- Dam bao cac ten user trong ordered_by, delivery_unit, managed_by, care_by dung format dang luu tren he thong.

## 7) Tieu chi pass

- Moi role chi thay dung tap du lieu theo scope da chot.
- Khong co nut action vuot quyen.
- Khong co luong tao/sua/duyet nao bi treo im lang khi fail validate.
- Build va diagnostics xanh tren cac file da migrate.
