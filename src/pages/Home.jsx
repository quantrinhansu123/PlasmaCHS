import {
  ActivitySquare,
  Building2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Layers,
  Layout,
  Menu,
  MonitorIcon,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  Warehouse
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChangePasswordModal } from "../components/modals/ChangePasswordModal";
import { usePermissions } from "../hooks/usePermissions";

// Navigation and Feature Configuration
const SIDEBAR_ITEMS = [
  {
    id: "dashboard",
    label: "Bảng điều khiển",
    icon: Layout,
    path: "/trang-chu",
  },
  {
    id: "orders",
    label: "Danh sách đơn hàng",
    icon: Package,
    path: "/danh-sach-don-hang",
  },

  {
    id: "customers",
    label: "Danh sách khách hàng",
    icon: Users,
    path: "/khach-hang",
  },
  {
    id: "machines",
    label: "Danh sách máy",
    icon: MonitorIcon,
    path: "/danh-sach-may",
  },
  {
    id: "cylinders",
    label: "Danh sách bình",
    icon: ActivitySquare,
    path: "/danh-sach-binh",
  },
  {
    id: "warehouses",
    label: "Danh sách kho",
    icon: Warehouse,
    path: "/danh-sach-kho",
  },
  {
    id: "suppliers",
    label: "Danh sách nhà cung cấp",
    icon: Building2,
    path: "/nha-cung-cap",
  },
  {
    id: "goods-receipts",
    label: "Nhập hàng từ NCC",
    icon: PackagePlus,
    path: "/nhap-hang",
  },
  {
    id: "goods-issues",
    label: "Xuất trả về NCC",
    icon: PackageMinus,
    path: "/xuat-kho",
  },
  {
    id: "recovery",
    label: "Thu hồi vỏ bình (KH)",
    icon: PackageCheck,
    path: "/thu-hoi-vo",
  },
  {
    id: "shippers",
    label: "Đơn vị vận chuyển",
    icon: Truck,
    path: "/danh-sach-dvvc",
  },
  {
    id: "materials",
    label: "Danh sách nguồn vật tư",
    icon: Layers,
    path: "/thong-tin-vat-tu",
  },
  {
    id: "promotions",
    label: "Danh sách khuyến mãi",
    icon: Gift,
    path: "/danh-sach-khuyen-mai",
  },
  {
    id: "users",
    label: "Quản lý người dùng",
    icon: Users,
    path: "/nguoi-dung",
  },
  {
    id: "permissions",
    label: "Phân quyền chi tiết",
    icon: ShieldCheck,
    path: "/phan-quyen",
  },
];

const DASHBOARD_FEATURES = [
  {
    id: "orders",
    title: "Danh sách đơn hàng",
    description: "Theo dõi, quản lý và xử lý các đơn hàng của hệ thống.",
    icon: Package,
    color: "blue",
    path: "/danh-sach-don-hang",
  },
  {
    id: "create-order",
    title: "Thêm đơn hàng",
    description: "Tạo mới đơn hàng nhanh chóng với các mẫu thông tin có sẵn.",
    icon: Plus,
    color: "green",
    path: "/tao-don-hang",
  },

  {
    id: "customers",
    title: "Danh sách khách hàng",
    description: "Quản lý dữ liệu người liên hệ và theo dõi tài sản, máy móc phân bổ.",
    icon: Users,
    color: "indigo",
    path: "/khach-hang",
  },
  {
    id: "add-customer",
    title: "Thêm khách hàng",
    description: "Tạo hồ sơ khách hàng, đối tác mới vào cơ sở dữ liệu.",
    icon: UserPlus,
    color: "pink",
    path: "/tao-khach-hang",
  },
  {
    id: "machines",
    title: "Danh sách máy",
    description: "Theo dõi trạng thái, vị trí và lịch sử cấp phát máy.",
    icon: MonitorIcon,
    color: "gray",
    path: "/danh-sach-may",
  },
  {
    id: "add-machine",
    title: "Thêm máy mới",
    description: "Khai báo serial, bluetooth và cấu hình máy mới vào kho.",
    icon: Plus,
    color: "purple",
    path: "/tao-may-moi",
  },
  {
    id: "cylinders",
    title: "Danh sách bình",
    description: "Quản lý RFID, thể tích và theo dõi vị trí vỏ bình.",
    icon: ActivitySquare,
    color: "teal",
    path: "/danh-sach-binh",
  },
  {
    id: "add-cylinder",
    title: "Thêm bình mới",
    description: "Nhập vỏ bình mới vào hệ thống thông qua mã quét RFID.",
    icon: Plus,
    color: "orange",
    path: "/tao-binh-moi",
  },
  {
    id: "warehouses",
    title: "Danh sách Kho",
    description: "Quản lý sức chứa, vị trí và thủ kho của từng điểm tập kết.",
    icon: Warehouse,
    color: "amber",
    path: "/danh-sach-kho",
  },
  {
    id: "add-warehouse",
    title: "Thêm kho mới",
    description: "Thêm địa điểm lưu trữ mới vào mạng lưới phân phối.",
    icon: Plus,
    color: "red",
    path: "/tao-kho-moi",
  },
  {
    id: "shippers",
    title: "Đơn vị vận chuyển",
    description: "Quản lý danh sách các nhà xe nội bộ và đơn vị thuê ngoài.",
    icon: Truck,
    color: "cyan",
    path: "/danh-sach-dvvc",
  },
  {
    id: "add-shipper",
    title: "Thêm ĐVVC mới",
    description: "Tạo hồ sơ công ty và người quản lý vận chuyển mới.",
    icon: Plus,
    color: "rose",
    path: "/tao-dvvc",
  },
  {
    id: "suppliers",
    title: "Danh sách nhà cung cấp",
    description: "Quản lý danh sách các đối tác cung cấp vật tư và vỏ bình.",
    icon: Building2,
    color: "teal",
    path: "/nha-cung-cap",
  },
  {
    id: "add-supplier",
    title: "Thêm nhà cung cấp",
    description: "Khai báo thông tin đối tác cung cấp mới vào hệ thống.",
    icon: Plus,
    color: "cyan",
    path: "/tao-nha-cung-cap",
  },
  {
    id: "goods-receipts",
    title: "Nhập hàng từ NCC",
    description: "Quản lý phiếu nhập hàng hóa từ nhà cung cấp vào kho công ty.",
    icon: PackagePlus,
    color: "emerald",
    path: "/nhap-hang",
  },
  {
    id: "create-goods-receipt",
    title: "Tạo phiếu nhập kho",
    description: "Lập phiếu nhập mới: chọn NCC, kho nhận, khai báo hàng hóa chi tiết.",
    icon: Plus,
    color: "green",
    path: "/tao-phieu-nhap",
  },
  {
    id: "goods-issues",
    title: "Xuất trả về NCC",
    description: "Quản lý phiếu xuất trả vỏ bình hoặc máy móc về cho nhà cung cấp.",
    icon: PackageMinus,
    color: "rose",
    path: "/xuat-kho",
  },
  {
    id: "create-goods-issue",
    title: "Tạo phiếu xuất trả",
    description: "Lập phiếu xuất mới: chọn kho, NCC nhận và điền hàng hóa cần trả.",
    icon: Plus,
    color: "orange",
    path: "/tao-phieu-xuat",
  },
  {
    id: "recovery",
    title: "Thu hồi vỏ bình",
    description: "Quản lý phiếu thu hồi vỏ bình từ khách hàng, quét barcode và xuất PDF.",
    icon: PackageCheck,
    color: "teal",
    path: "/thu-hoi-vo",
  },
  {
    id: "create-recovery",
    title: "Tạo phiếu thu hồi",
    description: "Lập phiếu thu hồi mới: chọn KH, quét barcode vỏ bình, chụp ảnh hiện trường.",
    icon: Plus,
    color: "cyan",
    path: "/tao-phieu-thu-hoi",
  },
  {
    id: "materials",
    title: "Danh sách nguồn vật tư",
    description: "Lưu trữ các danh mục cấu kiện cơ bản phục vụ lắp ráp hệ thống (Bình khí, Máy Plasma).",
    icon: Layers,
    color: "sky",
    path: "/thong-tin-vat-tu",
  },
  {
    id: "add-material",
    title: "Thêm mới vật tư",
    description: "Khai báo thông số cấu kiện mới vào từ điển chung.",
    icon: Plus,
    color: "emerald",
    path: "/tao-vat-tu",
  },
  {
    id: "users",
    title: "Quản lý người dùng",
    description: "Quản lý tài khoản, phân quyền tự động và theo dõi lịch sử truy cập.",
    icon: Users,
    color: "indigo",
    path: "/nguoi-dung",
  },
  {
    id: "add-user",
    title: "Thêm người dùng",
    description: "Cấp tài khoản mới cho nhân viên hoặc người quản lý trên hệ thống.",
    icon: UserPlus,
    color: "rose",
    path: "/tao-nguoi-dung",
  },
  {
    id: "permissions",
    title: "Phân quyền chi tiết",
    description: "Thiết lập quyền truy cập và chức năng cho từng nhóm người dùng.",
    icon: ShieldCheck,
    color: "slate",
    path: "/phan-quyen"
  },
  {
    id: "promotions",
    title: "Danh sách Khuyến mãi",
    description: "Quản lý mã khuyến mãi, khấu trừ bình cho khách hàng và đại lý.",
    icon: Gift,
    color: "amber",
    path: "/danh-sach-khuyen-mai"
  },
  {
    id: "add-promotion",
    title: "Tạo mã khuyến mãi",
    description: "Thiết lập chương trình khuyến mãi bình mới cho khách hàng.",
    icon: Plus,
    color: "orange",
    path: "/tao-khuyen-mai"
  }
];

function Home() {
  const location = useLocation();
  const { canView } = usePermissions();

  const [userRole, setUserRole] = useState("admin");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    setUserRole("admin");
  }, []);

  const menuItems = SIDEBAR_ITEMS.map(item => ({
    ...item,
    active: location.pathname === item.path || (item.path === "/trang-chu" && location.pathname === "/"),
    Icon: item.icon
  }));

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Sidebar - Desktop & Mobile Offcanvas */}
      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`bg-white border-r border-slate-100 transition-all duration-300 flex flex-col z-50 fixed md:relative h-full ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${sidebarCollapsed ? "w-20" : "w-64"}`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-50">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <Layout className="w-5 h-5" />
              </div>
              <span className="text-xl font-semibold text-slate-800 tracking-tight">
                PlasmaVN
              </span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100 mx-auto">
              <Layout className="w-6 h-6" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative ${item.active
                ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-50"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
            >
              <span className={`${item.active ? "text-blue-600" : "text-slate-400 group-hover:text-blue-600 transition-colors"}`}>
                <item.Icon className="w-5 h-5 stroke-[2.5px]" />
              </span>
              {!sidebarCollapsed && (
                <span className="font-semibold text-sm whitespace-nowrap tracking-tight">{item.label}</span>
              )}
              {item.active && !sidebarCollapsed && (
                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-blue-600" />
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className={`flex items-center gap-4 w-full px-4 py-3 rounded-2xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all ${sidebarCollapsed ? "justify-center" : ""
              }`}
          >
            <Settings className="w-5 h-5" />
            {!sidebarCollapsed && <span className="font-semibold text-sm">Cài đặt</span>}
          </button>


        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 md:px-8 z-30 shadow-sm gap-4">
          <div className="flex items-center gap-4 md:gap-6 flex-1">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-2xl bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100/50 shadow-sm"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative max-w-sm w-full hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tác vụ..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 border border-transparent focus:bg-white focus:border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-50 outline-none transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-semibold text-slate-800 leading-tight tracking-tight">Lê Minh Công</span>
              <span className="text-[10px] text-blue-500 font-semibold tracking-widest uppercase">Quản trị viên</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100 cursor-pointer hover:scale-105 transition-transform">
              LM
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] custom-scrollbar">
          <div className="p-4 md:p-12">
            <div className="max-w-[1400px] mx-auto">
              <div className="mb-12">
                <h1 className="text-3xl md:text-4xl font-semibold text-slate-800 mb-3 tracking-tight">
                  Chào buổi sáng 👋
                </h1>
                <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-2xl">
                </p>
              </div>

              {/* Dashboard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                {DASHBOARD_FEATURES.map((feature) => {
                  const cardStyles = {
                    blue: "from-blue-600 to-blue-700 shadow-blue-100",
                    green: "from-emerald-500 to-emerald-600 shadow-emerald-100",
                    indigo: "from-indigo-500 to-indigo-600 shadow-indigo-100",
                    pink: "from-rose-400 to-rose-500 shadow-rose-100",
                    gray: "from-slate-600 to-slate-700 shadow-slate-100",
                    purple: "from-purple-500 to-purple-600 shadow-purple-100",
                    teal: "from-teal-500 to-teal-600 shadow-teal-100",
                    orange: "from-orange-400 to-orange-500 shadow-orange-100",
                    amber: "from-amber-400 to-amber-500 shadow-amber-100",
                    red: "from-red-500 to-red-600 shadow-red-100",
                    cyan: "from-cyan-400 to-cyan-500 shadow-cyan-100",
                    rose: "from-rose-500 to-rose-600 shadow-rose-100",
                    sky: "from-sky-400 to-sky-500 shadow-sky-100",
                    emerald: "from-emerald-600 to-emerald-700 shadow-emerald-100",
                    slate: "from-slate-700 to-slate-800 shadow-slate-100",
                  };

                  const currentStyle = cardStyles[feature.color] || cardStyles.blue;

                  const CardContent = (
                    <div className="relative group/card h-full flex flex-col">
                      <div className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-tr ${currentStyle} rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-5 shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                        <feature.icon className={`w-5 h-5 md:w-6 md:h-6 text-white ${feature.inactive ? 'opacity-50' : ''}`} />
                      </div>

                      <h3 className={`text-sm md:text-lg mb-1 md:mb-2 tracking-tight ${feature.inactive ? 'text-slate-400' : 'text-slate-900'}`}>
                        {feature.title}
                      </h3>

                      <p className={`text-[10px] md:text-[12px] font-medium leading-relaxed mb-3 md:mb-5 flex-grow ${feature.inactive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {feature.description}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                        {feature.inactive ? (
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">
                            Dự kiến ra mắt
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 group/btn">
                            <span className="text-xs font-semibold text-blue-700 uppercase tracking-widest">Khám phá</span>
                            <ChevronRight className="w-4 h-4 text-blue-700 group-hover/btn:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </div>

                      {/* Hover effect background */}
                      <div className="absolute -inset-3 bg-blue-50/0 group-hover:bg-blue-50/50 rounded-[2.5rem] -z-10 transition-colors duration-300" />
                    </div>
                  );

                  return feature.inactive ? (
                    <div
                      key={feature.id}
                      className="p-4 md:p-7 bg-white rounded-2xl md:rounded-[2rem] border border-slate-50 opacity-60 cursor-not-allowed transition-all"
                    >
                      {CardContent}
                    </div>
                  ) : (
                    <Link
                      key={feature.id}
                      to={feature.path}
                      className="group p-4 md:p-7 bg-white rounded-2xl md:rounded-[2rem] border border-slate-50 shadow-soft hover:shadow-premium hover:-translate-y-1.5 transition-all duration-500 relative"
                    >
                      {CardContent}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}

export default Home;
