import * as XLSX from 'xlsx';

export const exportToExcel = (data, filename, sheetName = 'Báo cáo') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    ) + 2
  }));
  ws['!cols'] = colWidths;

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filename}_${timestamp}.xlsx`);
};

export const exportCustomerReport = (data) => {
  const formattedData = data.map(item => ({
    'Mã KH': item.ma_khach_hang,
    'Tên khách hàng / Tên cơ sở': item.ten_khach_hang,
    'Loại KH': item.loai_khach_hang === 'công' ? 'Bệnh viện công' : 'Bệnh viện tư',
    'Kho': item.kho,
    'Máy đang dùng': item.may_dang_su_dung,
    'Bình hiện có': item.binh_hien_co,
    'Bình xuất': item.binh_xuat,
    'Bình bán': item.binh_ban,
    'Bình demo': item.binh_demo,
    'Vỏ thu hồi': item.vo_thu_hoi,
    'NVKD': item.nhan_vien_kinh_doanh,
    'Ngày đặt gần nhất': item.ngay_dat_hang_gan_nhat
  }));
  exportToExcel(formattedData, 'BaoCao_KhachHang', 'Khách hàng');
};

export const exportSalespersonReport = (data) => {
  const formattedData = data.map(item => ({
    'Tên NV': item.ten_nhan_vien,
    'SĐT': item.so_dien_thoai,
    'Vai trò': item.vai_tro,
    'Tổng KH': item.tong_khach_hang,
    'Đơn xuất bán': item.don_xuat_ban,
    'Bình bán': item.binh_ban,
    'Đơn demo': item.don_demo,
    'Bình demo': item.binh_demo,
    'Đơn thu hồi': item.don_thu_hoi,
    'Bình thu hồi': item.binh_thu_hoi,
    'Máy bán': item.may_ban,
    'Máy đang dùng': item.may_dang_su_dung,
    'Bình tồn kho': item.binh_ton_kho
  }));
  exportToExcel(formattedData, 'BaoCao_NhanVienKD', 'NVKD');
};

export const exportCylinderExpiryReport = (data) => {
  const formattedData = data.map(item => ({
    'Mã bình': item.ma_binh,
    'Mã khắc trên vỏ': item.ma_khac_tren_vo,
    'Loại bình': item.loai_binh,
    'Thể tích': item.the_tich,
    'Loại khí': item.loai_khi,
    'Trạng thái': item.trang_thai,
    'Khách hàng': item.khach_hang,
    'Ngày hết hạn': item.ngay_het_han,
    'Số ngày tồn': item.so_ngay_ton,
    'NVKD': item.nhan_vien_kinh_doanh,
    'Kho': item.kho
  }));
  exportToExcel(formattedData, 'BaoCao_BinhQuaHan', 'Bình quá hạn');
};

export const exportCustomerExpiryReport = (data) => {
  const formattedData = data.map(item => ({
    'Mã KH': item.ma_khach_hang,
    'Tên KH': item.ten_khach_hang,
    'Kho': item.kho,
    'Loại khách': item.loai_khach,
    'Bình đang giữ': item.binh_ton,
    'Máy đang dùng': item.may_dang_su_dung,
    'Mã bình': item.danh_sach_binh,
    'Mã máy': item.danh_sach_may,
    'Ngày đặt gần nhất': item.ngay_dat_hang_gan_nhat,
    'Số ngày chưa phát sinh': item.so_ngay_chua_phat_sinh,
    'Mã đơn gần nhất': item.ma_don_gan_nhat,
    'NVKD': item.nhan_vien_kinh_doanh
  }));
  exportToExcel(formattedData, 'BaoCao_KhachQuaHan', 'KH quá hạn');
};

export const exportCylinderErrorReport = (data) => {
  const formattedData = data.map(item => ({
    'Mã bình': item.ma_binh,
    'Mã khắc trên vỏ': item.ma_khac_tren_vo,
    'Loại bình': item.loai_binh,
    'Thể tích': item.the_tich,
    'Loại khí': item.loai_khi,
    'Trạng thái': item.trang_thai,
    'Lý do lỗi': item.ly_do_loi,
    'Khách hàng': item.khach_hang,
    'Ngày phát hiện lỗi': item.ngay_phat_hien_loi,
    'Ngày sửa xong': item.ngay_sua_xong,
    'Người báo lỗi': item.nguoi_bao_loi,
    'Số ngày chưa sửa': item.so_ngay_chua_sua,
    'Thời gian xử lý (ngày)': item.thoi_gian_xu_ly_ngay,
    'NVKD': item.nhan_vien_kinh_doanh,
    'Kho': item.kho
  }));
  exportToExcel(formattedData, 'BaoCao_BinhLoi', 'Bình lỗi');
};

export const exportMachineStatsReport = (data) => {
  const formattedData = data.map(item => ({
    'Serial máy': item.serial_may,
    'Loại máy': item.loai_may,
    'Trạng thái': item.trang_thai,
    'Khách hàng': item.khach_hang,
    'Khoa phụ trách': item.khoa_phu_trach,
    'Kho': item.kho,
    'Loại khí': item.loai_khi,
    'Ngày bảo trì gần nhất': item.ngay_bao_tri_gan_nhat,
    'Loại bảo trì': item.loai_bao_tri,
    'Ngày bảo trì tiếp': item.ngay_bao_tri_tiep,
    'NVKD': item.nhan_vien_kinh_doanh
  }));
  exportToExcel(formattedData, 'BaoCao_May', 'Máy');
};

export const exportOrdersMonthlyReport = (data) => {
  const formattedData = data.map(item => ({
    'Mã đơn': item.ma_don,
    'Loại KH': item.loai_khach_hang,
    'Kho': item.kho,
    'Tên KH': item.ten_khach_hang,
    'Người nhận': item.nguoi_nhan,
    'Địa chỉ nhận': item.dia_chi_nhan,
    'Loại đơn': item.loai_don,
    'Loại hàng': item.loai_hang,
    'Số lượng': item.so_luong,
    'Đơn giá': item.don_gia,
    'Thành tiền': item.thanh_tien,
    'Khoa sử dụng': item.khoa_su_dung,
    'Trạng thái': item.trang_thai,
    'NVKD': item.nhan_vien_kinh_doanh,
    'Người đặt': item.nguoi_dat,
    'Ngày tạo': item.ngay_tao,
    'Tháng/Năm': item.thang_nam
  }));
  exportToExcel(formattedData, 'BaoCao_DonHang_Thang', 'Đơn hàng tháng');
};

export const exportMachineRevenueReport = (data) => {
  const formattedData = data.map(item => ({
    'Serial máy': item.serial_may,
    'Loại máy': item.loai_may,
    'Khách hàng': item.khach_hang,
    'Khoa': item.khoa,
    'Kho': item.kho,
    'Loại KH': item.loai_khach_hang,
    'NVKD': item.nhan_vien_kinh_doanh,
    'Số đơn hàng': item.so_don_hang,
    'Tổng doanh số': item.tong_doanh_so
  }));
  exportToExcel(formattedData, 'BaoCao_DoanhSo_May', 'Doanh số máy');
};



export const exportErrorReport = (data, filters) => {
  const fileName = `Bao_cao_loi_thiet_bi_${filters.year}${filters.month ? '_Thang_' + filters.month : filters.quarter ? '_Quy_' + filters.quarter : ''}.xlsx`;
  const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
    'STT': item.stt,
    'Ngày báo lỗi': item.ngay_bao_loi,
    'Loại (Máy/Bình)': item.error_category,
    'Tên lỗi': item.ten_loi,
    'Serial': item.serial_thiet_bi,
    'Tên thiết bị': item.ten_thiet_bi,
    'Khách hàng / Cơ sở': item.ten_khach_hang,
    'Kho': item.kho,
    'Người báo': item.nguoi_bao_loi,
    'Kỹ thuật xử lý': item.ky_thuat_xu_ly,
    'Trạng thái': item.trang_thai_phieu
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");
  XLSX.writeFile(workbook, fileName);
};

export const exportCustomerCylinderReport = (data, filters) => {
  const formattedData = data.map(item => ({
    'Tên khách hàng / Tên cơ sở': item.customer_name,
    'Loại': item.loai_khach,
    'Kho': item.kho,
    'Năm': item.nam,
    'Tháng': item.thang,
    'Tồn đầu': item.opening_balance,
    'Xuất bình': item.xuat,
    'Thu hồi': item.thu_hoi,
    'Tồn cuối': item.closing_balance
  }));
  const filename = `BaoCao_BinhTheoKhach_${filters.year}_${filters.month}`;
  exportToExcel(formattedData, filename, 'Bình theo khách');
};

export const exportMachineInventoryReport = (data, filters) => {
    const filename = `bao_cao_may_khach_${filters.month || 'all'}_${filters.year || 'all'}.xlsx`;
    const headers = ['Năm', 'Tháng', 'Khách hàng', 'Kho', 'Tồn đầu', 'Bàn giao', 'Thu hồi', 'Tồn cuối'];
    const rows = data.map(item => [
        item.nam,
        item.thang,
        item.customer_name,
        item.kho,
        item.ton_dau,
        item.ban_giao,
        item.thu_hoi,
        item.ton_cuoi
    ]);
    exportToExcel(rows, headers, filename);
};

export const exportSalesReport = (data, filters) => {
    const filename = `bao_cao_doanh_so_${filters.month || 'all'}_${filters.year || 'all'}.xlsx`;
    const headers = ['Khách hàng / Cơ sở', 'NVKD', 'Loại khách', 'Kho', 'Tháng', 'Năm', 'Doanh số', 'Số đơn hàng'];
    const rows = data.map(item => [
        item.customer_name,
        item.nvkd,
        item.loai_khach,
        item.kho,
        item.thang,
        item.nam,
        item.doanh_so,
        item.so_don_hang
    ]);
    exportToExcel(rows, headers, filename);
};
