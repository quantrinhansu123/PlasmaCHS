import React, { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import {
  FileText,
  Users,
  Megaphone,
  Wallet,
  ShoppingCart,
  Box,
  Layers,
  Bot,
  Copyright,
  Search,
} from 'lucide-react';

import { ActionCard } from '../components/ui/ActionCard';
import { ModuleCard } from '../components/ui/ModuleCard';
import { moduleData } from '../constants/moduleData';

const dashboardModules = [
  {
    icon: ShoppingCart,
    title: 'Danh sách đơn hàng',
    description: 'Theo dõi, quản lý và xử lý các đơn hàng của hệ thống.',
    href: '/danh-sach-don-hang',
    colorScheme: 'blue',
  },
  {
    icon: FileText,
    title: 'Thêm đơn hàng',
    description: 'Tạo mới đơn hàng nhanh chóng với các mẫu thông tin có sẵn.',
    href: '/tao-don-hang',
    colorScheme: 'green',
  },
  {
    icon: Users,
    title: 'Danh sách khách hàng',
    description: 'Quản lý dữ liệu người liên hệ và theo dõi tài sản, máy móc phân bổ.',
    href: '/khach-hang',
    colorScheme: 'blue',
  },
  {
    icon: Users,
    title: 'Thêm khách hàng',
    description: 'Tạo hồ sơ khách hàng, đối tác mới vào cơ sở dữ liệu.',
    href: '/tao-khach-hang',
    colorScheme: 'pink',
  },
  {
    icon: Box,
    title: 'Danh sách máy',
    description: 'Theo dõi trạng thái, vị trí và lịch sử cấp phát máy.',
    href: '/danh-sach-may',
    colorScheme: 'slate',
  },
  {
    icon: Box,
    title: 'Thêm máy mới',
    description: 'Khai báo serial, bluetooth và cấu hình máy mới vào kho.',
    href: '/tao-may-moi',
    colorScheme: 'purple',
  },
  {
    icon: Box,
    title: 'Danh sách bình',
    description: 'Quản lý RFID, thể tích và theo dõi vị trí vỏ bình.',
    href: '/danh-sach-binh',
    colorScheme: 'teal',
  },
  {
    icon: Box,
    title: 'Thêm bình mới',
    description: 'Nhập vỏ bình mới vào hệ thống thông qua mã quét RFID.',
    href: '/tao-binh-moi',
    colorScheme: 'orange',
  },
  {
    icon: Box,
    title: 'Danh sách Kho',
    description: 'Quản lý sức chứa, vị trí và thủ kho của từng điểm tập kết.',
    href: '/danh-sach-kho',
    colorScheme: 'amber',
  },
  {
    icon: Box,
    title: 'Thêm kho mới',
    description: 'Thêm địa điểm lưu trữ mới vào mạng lưới phân phối.',
    href: '/tao-kho-moi',
    colorScheme: 'red',
  },
  {
    icon: Box,
    title: 'Đơn vị vận chuyển',
    description: 'Quản lý danh sách các nhà xe nội bộ và đơn vị thuê ngoài.',
    href: '/danh-sach-dvvc',
    colorScheme: 'cyan',
  },
  {
    icon: Box,
    title: 'Thêm ĐVVC mới',
    description: 'Tạo hồ sơ công ty và người quản lý vận chuyển mới.',
    href: '/tao-dvvc',
    colorScheme: 'pink',
  },
  {
    icon: ShoppingCart,
    title: 'Danh sách nhà cung cấp',
    description: 'Quản lý danh sách các đối tác cung cấp vật tư và vỏ bình.',
    href: '/nha-cung-cap',
    colorScheme: 'teal',
  },
  {
    icon: ShoppingCart,
    title: 'Thêm nhà cung cấp',
    description: 'Khai báo thông tin đối tác cung cấp mới vào hệ thống.',
    href: '/tao-nha-cung-cap',
    colorScheme: 'cyan',
  },
  {
    icon: ShoppingCart,
    title: 'Nhập hàng từ NCC',
    description: 'Quản lý phiếu nhập hàng hóa từ nhà cung cấp vào kho công ty.',
    href: '/nhap-hang',
    colorScheme: 'emerald',
  },
  {
    icon: FileText,
    title: 'Tạo phiếu nhập kho',
    description: 'Lập phiếu nhập mới: chọn NCC, kho nhận, khai báo hàng hóa chi tiết.',
    href: '/tao-phieu-nhap',
    colorScheme: 'green',
  },
  {
    icon: ShoppingCart,
    title: 'Xuất trả về NCC',
    description: 'Quản lý phiếu xuất trả vỏ bình hoặc máy móc về cho nhà cung cấp.',
    href: '/xuat-kho',
    colorScheme: 'pink',
  },
  {
    icon: FileText,
    title: 'Tạo phiếu xuất trả',
    description: 'Lập phiếu xuất mới: chọn kho, NCC nhận và điền hàng hóa cần trả.',
    href: '/tao-phieu-xuat',
    colorScheme: 'orange',
  },
  {
    icon: Box,
    title: 'Thu hồi vỏ bình',
    description: 'Quản lý phiếu thu hồi vỏ bình từ khách hàng, quét barcode và xuất PDF.',
    href: '/thu-hoi-vo',
    colorScheme: 'teal',
  },
  {
    icon: FileText,
    title: 'Tạo phiếu thu hồi',
    description: 'Lập phiếu thu hồi mới: chọn KH, quét barcode vỏ bình, chụp ảnh hiện trường.',
    href: '/tao-phieu-thu-hoi',
    colorScheme: 'cyan',
  },
  {
    icon: Layers,
    title: 'Danh sách nguồn vật tư',
    description: 'Lưu trữ danh mục cấu kiện cơ bản phục vụ lắp ráp hệ thống.',
    href: '/thong-tin-vat-tu',
    colorScheme: 'cyan',
  },
  {
    icon: FileText,
    title: 'Thêm mới vật tư',
    description: 'Khai báo thông số cấu kiện mới vào từ điển chung.',
    href: '/tao-vat-tu',
    colorScheme: 'emerald',
  },
  {
    icon: Users,
    title: 'Quản lý người dùng',
    description: 'Quản lý tài khoản, phân quyền tự động và theo dõi lịch sử truy cập.',
    href: '/nguoi-dung',
    colorScheme: 'blue',
  },
  {
    icon: Users,
    title: 'Thêm người dùng',
    description: 'Cấp tài khoản mới cho nhân viên hoặc người quản lý trên hệ thống.',
    href: '/tao-nguoi-dung',
    colorScheme: 'pink',
  },
  {
    icon: Layers,
    title: 'Phân quyền chi tiết',
    description: 'Thiết lập quyền truy cập và chức năng cho từng nhóm người dùng.',
    href: '/phan-quyen',
    colorScheme: 'slate',
  },
  {
    icon: Megaphone,
    title: 'Danh sách Khuyến mãi',
    description: 'Quản lý mã khuyến mãi, khấu trừ bình cho khách hàng và đại lý.',
    href: '/danh-sach-khuyen-mai',
    colorScheme: 'amber',
  },
  {
    icon: Megaphone,
    title: 'Tạo mã khuyến mãi',
    description: 'Thiết lập chương trình khuyến mãi bình mới cho khách hàng.',
    href: '/tao-khuyen-mai',
    colorScheme: 'orange',
  },
];

function Home() {
  const [activeTab, setActiveTab] = useState('chuc-nang');
  const [searchQuery, setSearchQuery] = useState('');

  const allSections = useMemo(() => Object.values(moduleData).flat(), []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8 lg:p-10">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2 text-foreground">
          Chào buổi tối, <span className="text-primary">Lê Minh Công</span> 👋
        </h1>
      </div>

      <div
        className={clsx(
          'bg-card rounded-xl shadow-sm border border-border p-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 lg:mb-8 transition-all duration-300',
          activeTab === 'tat-ca' ? 'w-full' : 'max-w-fit'
        )}
      >
        <div className="flex bg-muted/20 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setActiveTab('chuc-nang')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200',
              activeTab === 'chuc-nang'
                ? 'bg-card text-primary shadow-sm ring-1 ring-black/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Chức năng
          </button>
          <button
            onClick={() => setActiveTab('danh-dau')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200',
              activeTab === 'danh-dau'
                ? 'bg-card text-primary shadow-sm ring-1 ring-black/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Đánh dấu
          </button>
          <button
            onClick={() => setActiveTab('tat-ca')}
            className={clsx(
              'px-4 py-1.5 rounded-md text-[13px] font-bold transition-all duration-200',
              activeTab === 'tat-ca'
                ? 'bg-card text-primary shadow-sm ring-1 ring-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Tất cả
          </button>
        </div>

        {activeTab === 'tat-ca' && (
          <div className="flex-1 flex items-center bg-muted/20 rounded-lg px-3 py-1.5 animate-in slide-in-from-left-2 duration-300">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm module, chức năng..."
              className="bg-transparent border-none outline-none text-[13px] text-foreground w-full ml-2 placeholder:text-muted-foreground/60"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        )}
      </div>

      {activeTab === 'chuc-nang' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-5">
          {dashboardModules.map((module, index) => (
            <ActionCard key={index} {...module} />
          ))}
        </div>
      )}

      {activeTab === 'danh-dau' && (
        <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border border-dashed">
          Chưa có module nào được đánh dấu.
        </div>
      )}

      {activeTab === 'tat-ca' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="space-y-8">
            {allSections.map((section, index) => {
              const filteredItems = section.items.filter(
                (item) =>
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.description.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (filteredItems.length === 0) {
                return null;
              }

              return (
                <div
                  key={`${section.section}-${index}`}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <h2 className="text-[14px] font-bold text-primary mb-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-1 h-4 bg-primary rounded-full" />
                      <span>{section.section}</span>
                    </div>
                    <div className="h-px flex-1 bg-border/60" />
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredItems.map((item, itemIndex) => (
                      <ModuleCard key={`${item.title}-${itemIndex}`} {...item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
