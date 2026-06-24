import { BarChart3, Layout } from 'lucide-react';
import { actionModuleGroups } from './actionModuleData';

/** Màu icon sidebar theo colorScheme của module (Tailwind cố định). */
const MODULE_SIDEBAR_COLORS = {
  blue: 'text-emerald-500',
  purple: 'text-cyan-500',
  amber: 'text-orange-500',
  orange: 'text-rose-500',
  cyan: 'text-sky-500',
  teal: 'text-teal-500',
  slate: 'text-indigo-500',
};

/**
 * Menu sidebar — đồng bộ thứ tự & nhãn với lưới module Trang chủ (`actionModuleGroups`).
 */
export const sidebarMenu = [
  { path: '/trang-chu', label: 'Trang chủ', icon: Layout, color: 'text-blue-500', colorScheme: 'blue' },
  { path: '/thong-ke', label: 'Thống kê', icon: BarChart3, color: 'text-amber-500', colorScheme: 'amber' },
  ...actionModuleGroups.map((group) => ({
    path: group.path,
    label: group.title,
    icon: group.icon,
    color: MODULE_SIDEBAR_COLORS[group.colorScheme] || 'text-blue-500',
    colorScheme: group.colorScheme,
  })),
];

export const extraMenuItems = [
  { path: '/trang-chu', label: 'Trang chủ', icon: Layout },
  { path: '/thong-ke', label: 'Thống kê tổng quan', icon: BarChart3 },
  { path: '/bao-cao/khach-hang', label: 'Báo cáo khách hàng', icon: BarChart3 },
  { path: '/bao-cao/nhan-vien', label: 'Báo cáo NVKD', icon: BarChart3 },
  { path: '/bao-cao/binh-qua-han', label: 'Báo cáo bình quá hạn', icon: BarChart3 },
  { path: '/bao-cao/khach-qua-han', label: 'Báo cáo KH quá hạn', icon: BarChart3 },
  { path: '/bao-cao/binh-loi', label: 'Báo cáo bình lỗi', icon: BarChart3 },
  { path: '/bao-cao/may-banh', label: 'Báo cáo máy', icon: BarChart3 },
  { path: '/bao-cao/don-xuat', label: 'Báo cáo đơn xuất', icon: BarChart3 },
  { path: '/bao-cao/doanh-so-may', label: 'Báo cáo doanh số', icon: BarChart3 },
  { path: '/bao-cao/bao-cao-quy', label: 'Báo cáo quý', icon: BarChart3 },
  { path: '/bao-cao/binh-theo-khach', label: 'Báo cáo bình theo khách', icon: BarChart3 },
  { path: '/bao-cao/ton-kho-binh-khach', label: 'Báo cáo bình theo khách', icon: BarChart3 },
  { path: '/bao-cao/ton-kho-may-khach', label: 'Báo cáo máy theo khách', icon: BarChart3 },
  { path: '/bao-cao/doanh-so', label: 'Báo cáo doanh số', icon: BarChart3 },
  { path: '/bao-cao/loi-thiet-bi', label: 'Báo cáo lỗi thiết bị', icon: BarChart3 },
  { path: '/bao-cao/doanh-so-san-luong', label: 'Doanh số/Sản lượng', icon: BarChart3 },
  { path: '/don-hang', label: 'Danh sách đơn hàng', icon: Layout },
  { path: '/danh-sach-dieu-chuyen', label: 'Danh sách điều chuyển', icon: BarChart3 },
  { path: '/de-nghi-xuat-may', label: 'Đề nghị xuất máy', icon: BarChart3 },
  { path: '/khach-hang', label: 'Danh sách khách hàng', icon: Layout },
  { path: '/khach-hang-lead', label: 'Form đăng kí khách hàng mới', icon: Layout },
  { path: '/khach-hang/tao', label: 'Thêm khách hàng', icon: Layout },
  { path: '/may', label: 'Danh sách máy', icon: Layout },
  { path: '/binh', label: 'Danh sách bình', icon: Layout },
  { path: '/binh/tao', label: 'Thêm bình mới', icon: Layout },
  { path: '/kho/danh-sach', label: 'Danh sách kho', icon: Layout },
  { path: '/kho/tao', label: 'Thêm kho mới', icon: Layout },
  { path: '/nha-cung-cap', label: 'Danh sách nhà cung cấp', icon: Layout },
  { path: '/nha-cung-cap/tao', label: 'Thêm nhà cung cấp', icon: Layout },
  { path: '/nhap-hang', label: 'Nhập hàng từ NCC', icon: Layout },
  { path: '/xuat-tra-ncc', label: 'Xuất trả về NCC', icon: Layout },
  { path: '/phieu-nhap/tao', label: 'Tạo phiếu nhập kho', icon: Layout },
  { path: '/phieu-xuat/tao', label: 'Tạo phiếu xuất trả', icon: Layout },
  { path: '/thu-hoi-vo', label: 'Thu hồi vỏ bình', icon: Layout },
  { path: '/thu-hoi-may', label: 'Thu hồi máy', icon: Layout },
  { path: '/don-hang-tra-ve', label: 'Đơn hàng trả về', icon: Layout },
  { path: '/don-vi-van-chuyen', label: 'Đơn vị vận chuyển', icon: Layout },
  { path: '/don-vi-van-chuyen/tao', label: 'Thêm ĐVVC mới', icon: Layout },
  { path: '/nhiem-vu-giao-hang', label: 'Nhiệm vụ giao hàng', icon: Layout },
  { path: '/lich-su-giao-hang', label: 'Lịch sử giao hàng', icon: Layout },
  { path: '/khuyen-mai', label: 'Khuyến mãi', icon: Layout },
  { path: '/khuyen-mai/tao', label: 'Tạo mã khuyến mãi', icon: Layout },
  { path: '/nguoi-dung', label: 'Người dùng', icon: Layout },
  { path: '/phan-quyen', label: 'Phân quyền', icon: Layout },
  { path: '/phan-quyen/tao', label: 'Tạo phân quyền', icon: Layout },
  { path: '/phieu-sua-chua', label: 'Ticket sửa chữa', icon: Layout },
];
