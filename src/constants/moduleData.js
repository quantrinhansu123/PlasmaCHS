import {
  Calendar, ClipboardList, FileSignature, Target,
  Banknote, Scale, Settings,
  FileText, Send, SquarePen, FolderLock,
  FileBox, UserCog, Briefcase, FileCode,
  PieChart, LayoutGrid, Database,
  Wallet, RefreshCw, Wrench,
  Car, ScrollText, CalendarDays, Fuel,
  Users, ShieldCheck, UserPlus,
  Megaphone, GraduationCap, Star, Award,
  CheckSquare, Medal, GitCompare, Network,
  Mail, MessageSquare, Share2, Image,
  Layout, MousePointer2,
  TrendingUp,
  BarChart3, TrendingDown, Landmark, FileEdit,
  Receipt, Coins, CreditCard, CheckCircle2,
  BookOpen, Calculator as CalcIcon, History,
  Truck, Package, ShoppingCart, FileCheck, Tag,
  Warehouse, Box, ArrowLeftRight, Download, Upload, Factory, MapPin, Truck as DeliveryIcon,
  Building2, List, ClipboardCheck, Building, Monitor, Ticket
} from 'lucide-react';

// Comprehensive mock data for module pages to match the 5F template precisely
export const moduleData = {
  '/hanh-chinh': [
    {
      section: 'Công lương',
      items: [
        { icon: Calendar, title: 'Chấm công', description: 'Quản lý chấm công, ca làm việc.', colorScheme: 'blue' },
        { icon: ClipboardList, title: 'Tổng hợp chấm công', description: 'Tổng hợp và báo cáo chấm công theo nhân viên.', colorScheme: 'orange' },
        { icon: FileSignature, title: 'Phiếu hành chính', description: 'Phiếu đề xuất, xác nhận hành chính.', colorScheme: 'purple' },
        { icon: Target, title: 'Chấm điểm KPI', description: 'Đánh giá và chấm điểm KPI theo kỳ, nhân viên.', colorScheme: 'purple' },
        { icon: Banknote, title: 'Bảng lương', description: 'Tính lương, phiếu lương, báo cáo.', colorScheme: 'green' },
        { icon: Scale, title: 'Điểm cộng trừ', description: 'Ghi nhận điểm cộng, trừ của nhân viên theo tháng.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập công lương', description: 'Cấu hình hệ số, quy tắc tính lương.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Tài liệu',
      items: [
        { icon: FileText, title: 'Văn bản đến', description: 'Tiếp nhận, vào sổ công văn đến.', colorScheme: 'blue' },
        { icon: Send, title: 'Văn bản đi', description: 'Soạn, phát hành công văn đi.', colorScheme: 'purple' },
        { icon: SquarePen, title: 'Soạn thảo văn bản', description: 'Soạn thảo, trình duyệt, ký số.', colorScheme: 'purple' },
        { icon: FolderLock, title: 'Lưu trữ hồ sơ', description: 'Lưu trữ, tra cứu, mượn trả hồ sơ.', colorScheme: 'teal' },
        { icon: FileBox, title: 'Quản lý hợp đồng', description: 'Hợp đồng, gia hạn, lưu trữ.', colorScheme: 'red' },
        { icon: UserCog, title: 'Thiết lập tài liệu', description: 'Quy trình, mẫu văn bản, phân quyền.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Công việc',
      items: [
        { icon: Briefcase, title: 'Dự án', description: 'Quản lý dự án, phòng ban, thời gian, mục tiêu.', colorScheme: 'blue' },
        { icon: FileCode, title: 'Công việc', description: 'Giao việc, theo dõi tiến độ, báo cáo kết quả.', colorScheme: 'green' },
        { icon: PieChart, title: 'Báo cáo', description: 'Thống kê công việc theo dự án, phòng ban, người, thời gian.', colorScheme: 'teal' },
        { icon: LayoutGrid, title: 'Thiết lập công việc', description: 'Cảnh báo đến hạn, mẫu công việc, quy tắc mặc định.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Tài sản',
      items: [
        { icon: Database, title: 'Danh mục tài sản', description: 'Mã tài sản, nhóm, phòng ban quản lý.', colorScheme: 'blue' },
        { icon: RefreshCw, title: 'Cấp phát / Thu hồi', description: 'Cấp phát, bàn giao, thu hồi tài sản.', colorScheme: 'purple' },
        { icon: ShieldCheck, title: 'Kiểm kê tài sản', description: 'Đợt kiểm kê, đối chiếu, biên bản.', colorScheme: 'green' },
        { icon: Wrench, title: 'Bảo trì - Sửa chữa', description: 'Kế hoạch bảo trì, yêu cầu sửa chữa.', colorScheme: 'orange' },
        { icon: Wallet, title: 'Khấu hao tài sản', description: 'Tính khấu hao, báo cáo khấu hao.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập tài sản', description: 'Nhóm tài sản, tham số khấu hao.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Quản lý xe',
      items: [
        { icon: Car, title: 'Danh sách xe', description: 'Thông tin xe, biển số, trạng thái.', colorScheme: 'blue' },
        { icon: ScrollText, title: 'Đăng ký sử dụng xe', description: 'Đặt xe, phê duyệt, lịch sử dụng.', colorScheme: 'teal' },
        { icon: CalendarDays, title: 'Lịch bảo dưỡng', description: 'Định kỳ bảo dưỡng, nhắc lịch.', colorScheme: 'orange' },
        { icon: Fuel, title: 'Phiếu xăng - Chi phí xe', description: 'Đổ xăng, chi phí đi lại, đối soát.', colorScheme: 'orange' },
        { icon: Users, title: 'Quản lý lái xe', description: 'Danh sách lái xe, phân công, bảng lương.', colorScheme: 'red' },
        { icon: UserCog, title: 'Thiết lập quản lý xe', description: 'Loại xe, quy trình đặt xe, phân quyền.', colorScheme: 'slate' }
      ]
    }
  ],
  '/nhan-su': [
    {
      section: 'Tuyển dụng',
      items: [
        { icon: Megaphone, title: 'Tin tuyển dụng', description: 'Đăng tin, vị trí tuyển dụng, yêu cầu.', colorScheme: 'blue' },
        { icon: UserPlus, title: 'Ứng viên', description: 'Quản lý hồ sơ, trạng thái ứng viên.', colorScheme: 'purple', path: '/nhan-su/ung-vien' },
        { icon: Calendar, title: 'Lịch phỏng vấn', description: 'Đặt lịch, phỏng vấn, người vấn.', colorScheme: 'purple' },
        { icon: Send, title: 'Đề xuất tuyển dụng', description: 'Yêu cầu tuyển từ phòng ban, phê duyệt.', colorScheme: 'teal' },
        { icon: PieChart, title: 'Báo cáo tuyển dụng', description: 'Thống kê theo kênh, vị trí, thời gian.', colorScheme: 'cyan' },
        { icon: Settings, title: 'Thiết lập tuyển dụng', description: 'Mẫu tin, quy trình, phản hồi mặc định.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Đào tạo',
      items: [
        { icon: CalendarDays, title: 'Kế hoạch đào tạo', description: 'Kế hoạch năm, quý, chủ đề, ngân sách.', colorScheme: 'blue' },
        { icon: GraduationCap, title: 'Khóa đào tạo', description: 'Danh sách khóa, giảng viên, thời lượng.', colorScheme: 'emerald' },
        { icon: ClipboardList, title: 'Đăng ký / Ghi danh', description: 'Nhân viên đăng ký, duyệt, danh sách lớp.', colorScheme: 'teal' },
        { icon: Star, title: 'Đánh giá đào tạo', description: 'Đánh giá khóa học, chất lượng.', colorScheme: 'orange' },
        { icon: Award, title: 'Chứng chỉ / Bằng cấp', description: 'Lưu chứng chỉ nhân viên, hạn hiệu lực.', colorScheme: 'pink' },
        { icon: Settings, title: 'Thiết lập đào tạo', description: 'Loại khóa, danh mục kỹ năng, quy trình.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Đánh giá & Phát triển',
      items: [
        { icon: CheckSquare, title: 'Đánh giá nhân viên', description: 'Kỳ đánh giá, form đánh giá.', colorScheme: 'blue' },
        { icon: Target, title: 'Mục tiêu KPI / OKR', description: 'Giao mục tiêu, tiến độ, đánh giá hoàn thành.', colorScheme: 'green' },
        { icon: Medal, title: 'Khen thưởng & Kỷ luật', description: 'Quyết định khen thưởng, kỷ luật, lưu hồ sơ.', colorScheme: 'orange' },
        { icon: GitCompare, title: 'Thăng tiến & Luân chuyển', description: 'Đề xuất thăng tiến, luân chuyển, bổ nhiệm.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập đánh giá', description: 'Chu kỳ đánh giá, thang điểm, quy trình.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Kế hoạch nhân sự',
      items: [
        { icon: UserCog, title: 'Định biên', description: 'Số lượng vị trí theo phòng ban, thực tế.', colorScheme: 'blue' },
        { icon: Calendar, title: 'Kế hoạch nhân sự', description: 'Kế hoạch tuyển, giảm, đào tạo theo năm.', colorScheme: 'purple' },
        { icon: Network, title: 'Sơ đồ tổ chức', description: 'Xem sơ đồ tổ chức, cây phòng ban.', colorScheme: 'teal' },
        { icon: FileText, title: 'Báo cáo nhân sự', description: 'Headcount, biến động, turnover.', colorScheme: 'cyan' },
        { icon: Settings, title: 'Thiết lập kế hoạch', description: 'Mẫu kế hoạch, quy trình phê duyệt.', colorScheme: 'slate' }
      ]
    }
  ],
  '/marketing': [
    {
      section: 'Chiến dịch Marketing',
      items: [
        { icon: Megaphone, title: 'Chiến dịch', description: 'Tạo chiến dịch, mục tiêu, thời gian, ngân sách.', colorScheme: 'pink' },
        { icon: Mail, title: 'Email Marketing', description: 'Gửi email hàng loạt, mẫu, A/B test.', colorScheme: 'blue' },
        { icon: MessageSquare, title: 'SMS & Thông báo', description: 'SMS, push, tin nhắn trong app.', colorScheme: 'green' },
        { icon: Share2, title: 'Mạng xã hội', description: 'Lịch đăng bài, đa kênh, lịch sử đăng.', colorScheme: 'purple' },
        { icon: PieChart, title: 'Báo cáo chiến dịch', description: 'Hiệu quả, tỷ lệ mở/click, chuyển đổi.', colorScheme: 'teal' },
        { icon: Settings, title: 'Thiết lập chiến dịch', description: 'Kênh, mẫu, giới hạn gửi.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Nội dung & Truyền thông',
      items: [
        { icon: FileText, title: 'Quản lý nội dung', description: 'Bài viết, landing page, bài quảng cáo.', colorScheme: 'pink' },
        { icon: Image, title: 'Thư viện tài sản', description: 'Hình ảnh, video, file tái sử dụng.', colorScheme: 'purple' },
        { icon: Layout, title: 'Landing page', description: 'Tạo trang đích, form đăng ký, theo dõi.', colorScheme: 'teal' },
        { icon: MousePointer2, title: 'Form thu thập lead', description: 'Form nhúng, popup, tích hợp.', colorScheme: 'orange' },
        { icon: Settings, title: 'Thiết lập nội dung', description: 'Mẫu, thư viện thương hiệu.', colorScheme: 'slate' }
      ]
    }
  ],
  '/tai-chinh': [
    {
      section: 'Kế toán tổng hợp',
      items: [
        { icon: BookOpen, title: 'Sổ cái', description: 'Sổ cái tài khoản, đối chiếu số dư.', colorScheme: 'purple' },
        { icon: CalcIcon, title: 'Định khoản / Hạch toán', description: 'Chứng từ, bút toán, luồng duyệt.', colorScheme: 'purple' },
        { icon: Calendar, title: 'Kỳ kế toán', description: 'Đóng kỳ, khóa sổ, mở kỳ mới.', colorScheme: 'blue' },
        { icon: RefreshCw, title: 'Đối soát số liệu', description: 'Đối chiếu nội bộ, số liệu liên kết.', colorScheme: 'teal' },
        { icon: FileText, title: 'Báo cáo tài chính', description: 'BCKQKD, CĐKT, Lưu chuyển tiền tệ.', colorScheme: 'cyan' },
        { icon: Settings, title: 'Thiết lập kế toán', description: 'Danh mục tài khoản, kỳ, phân quyền.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Công nợ & Thu chi',
      items: [
        { icon: Banknote, title: 'Công nợ phải thu', description: 'Công nợ khách hàng, theo dõi thu, đối soát.', colorScheme: 'green' },
        { icon: CreditCard, title: 'Công nợ phải trả', description: 'Công nợ nhà cung cấp, lịch thanh toán.', colorScheme: 'orange' },
        { icon: Wallet, title: 'Thu tiền / Phiếu thu', description: 'Phiếu thu, đối ứng công nợ, quỹ.', colorScheme: 'teal' },
        { icon: Coins, title: 'Chi tiền / Phiếu chi', description: 'Phiếu chi, tạm ứng, thanh toán.', colorScheme: 'red' },
        { icon: History, title: 'Đối soát công nợ', description: 'Đối soát công nợ, số dư, điều chỉnh.', colorScheme: 'orange' },
        { icon: Settings, title: 'Thiết lập công nợ', description: 'Loại chứng từ, quy trình duyệt.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Ngân sách',
      items: [
        { icon: Calendar, title: 'Kế hoạch ngân sách', description: 'Lập ngân sách năm, quý theo phòng ban, mục.', colorScheme: 'purple' },
        { icon: Share2, title: 'Phân bổ ngân sách', description: 'Phân bổ theo dự án, chi phí, điều chuyển.', colorScheme: 'blue' },
        { icon: TrendingUp, title: 'Theo dõi thực chi', description: 'So sánh dự toán và thực chi, cảnh báo vượt.', colorScheme: 'teal' },
        { icon: BarChart3, title: 'Báo cáo ngân sách', description: 'Báo cáo sử dụng, còn lại, biến động.', colorScheme: 'cyan' },
        { icon: Settings, title: 'Thiết lập ngân sách', description: 'Cấu trúc ngân sách, mẫu, quy trình phê duyệt.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Quỹ, Ngân hàng & Thuế',
      items: [
        { icon: Wallet, title: 'Quỹ tiền mặt', description: 'Sổ quỹ, thu chi tiền mặt, tồn quỹ.', colorScheme: 'teal' },
        { icon: Landmark, title: 'Tài khoản ngân hàng', description: 'Số phụ ngân hàng, giao dịch, số dư.', colorScheme: 'blue' },
        { icon: TrendingDown, title: 'Dự báo dòng tiền', description: 'Dự báo thu chi theo kỳ, kịch bản.', colorScheme: 'teal' },
        { icon: CheckCircle2, title: 'Đối soát ngân hàng', description: 'Đối chiếu số sách và sao kê.', colorScheme: 'teal' },
        { icon: FileEdit, title: 'Kê khai thuế', description: 'Tờ khai GTGT, TNCN, TNDN, tạm tính.', colorScheme: 'orange' },
        { icon: Receipt, title: 'Hóa đơn', description: 'Hóa đơn điện tử, phát hành, hủy, đối soát.', colorScheme: 'red' },
        { icon: Settings, title: 'Thiết lập quỹ & thuế', description: 'Thuế suất, mã thuế, tài khoản ngân hàng.', colorScheme: 'slate' }
      ]
    }
  ],
  '/mua-hang': [
    {
      section: 'Nhà cung cấp',
      items: [
        { icon: Users, title: 'Danh sách nhà cung cấp', description: 'Hồ sơ NCC, liên hệ, điều kiện thanh toán.', colorScheme: 'orange' },
        { icon: Tag, title: 'Phân loại nhà cung cấp', description: 'Nhóm, hạng, ngành hàng.', colorScheme: 'blue' },
        { icon: Star, title: 'Đánh giá nhà cung cấp', description: 'Chất lượng, giao hàng, điểm số.', colorScheme: 'orange' },
        { icon: FileText, title: 'Hợp đồng khung', description: 'Hợp đồng khung, giá, thời hạn.', colorScheme: 'teal' },
        { icon: Settings, title: 'Thiết lập nhà cung cấp', description: 'Trình tự tùy chỉnh, quy trình duyệt, phân quyền.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Đặt hàng & Mua hàng',
      items: [
        { icon: ClipboardList, title: 'Yêu cầu mua hàng', description: 'Đề xuất mua, duyệt, chuyển thành đơn đặt hàng.', colorScheme: 'orange' },
        { icon: ShoppingCart, title: 'Đơn đặt hàng', description: 'Tạo PO, gửi NCC, theo dõi trạng thái.', colorScheme: 'blue' },
        { icon: CheckCircle2, title: 'Duyệt đơn đặt hàng', description: 'Luồng duyệt theo giá trị, phòng ban.', colorScheme: 'green' },
        { icon: Truck, title: 'Theo dõi đơn hàng', description: 'Tiến độ giao hàng, nhắc hạn, nhập kho.', colorScheme: 'blue' },
        { icon: BarChart3, title: 'Báo cáo đặt hàng', description: 'Thống kê theo NCC, mặt hàng, thời gian.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập đặt hàng', description: 'Mẫu PO, hạn mức, quy tắc duyệt.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Đấu thầu / Mời thầu',
      items: [
        { icon: Package, title: 'Gói thầu', description: 'Tạo gói thầu, nội dung, thời hạn.', colorScheme: 'orange' },
        { icon: Send, title: 'Mời thầu', description: 'Mời NCC, hồ sơ mời thầu, deadline.', colorScheme: 'purple' },
        { icon: FileText, title: 'Hồ sơ dự thầu', description: 'Nhận hồ sơ, đánh giá, so sánh.', colorScheme: 'teal' },
        { icon: Award, title: 'Kết quả & Hợp đồng', description: 'Trúng thầu, ký hợp đồng, lưu trữ.', colorScheme: 'orange' },
        { icon: BarChart3, title: 'Báo cáo đấu thầu', description: 'Tổng hợp đấu thầu, tỷ lệ trúng.', colorScheme: 'teal' },
        { icon: Settings, title: 'Thiết lập đấu thầu', description: 'Quy trình, tiêu chí đánh giá.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Hợp đồng & Thanh toán',
      items: [
        { icon: FileSignature, title: 'Hợp đồng mua hàng', description: 'Hợp đồng, điều khoản, phụ lục.', colorScheme: 'orange' },
        { icon: FileCheck, title: 'Thanh lý & Gia hạn', description: 'Thanh lý, gia hạn, điều chỉnh.', colorScheme: 'teal' },
        { icon: RefreshCw, title: 'Đối soát thanh toán', description: 'Đối chiếu PO - Hóa đơn - Thanh toán.', colorScheme: 'green' },
        { icon: BarChart3, title: 'Báo cáo hợp đồng', description: 'Thời hạn, giá trị, thực hiện.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập hợp đồng', description: 'Mẫu hợp đồng, quy trình ký.', colorScheme: 'slate' }
      ]
    }
  ],
  '/kho-van': [
    {
      section: 'Tồn kho & Kho',
      items: [
        { icon: Warehouse, title: 'Danh sách kho', description: 'Chi nhánh kho, vị trí, người phụ trách.', colorScheme: 'teal' },
        { icon: Box, title: 'Tồn kho theo mặt hàng', description: 'Tồn theo kho, theo SKU, tồn an toàn.', colorScheme: 'blue' },
        { icon: ClipboardList, title: 'Kiểm kê tồn kho', description: 'Đợt kiểm kê, đối chiếu, điều chỉnh.', colorScheme: 'teal' },
        { icon: ArrowLeftRight, title: 'Điều chuyển nội bộ', description: 'Chuyển kho, chuyển vị trí, bàn giao.', colorScheme: 'purple' },
        { icon: BarChart3, title: 'Báo cáo tồn kho', description: 'Tồn tổng hợp, biến động, tồn lâu.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập kho', description: 'Loại kho, đơn vị, quy trình.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Nhập kho',
      items: [
        { icon: Download, title: 'Phiếu nhập kho', description: 'Tạo phiếu nhập, duyệt, cập nhật tồn.', colorScheme: 'green' },
        { icon: ShoppingCart, title: 'Nhập từ đơn mua', description: 'Nhập theo PO, đối ứng với Mua hàng.', colorScheme: 'blue' },
        { icon: RefreshCw, title: 'Nhập trả / Nhập khác', description: 'Trả NCC, nhập hàng về, nhập điều chỉnh.', colorScheme: 'teal' },
        { icon: CheckCircle2, title: 'Duyệt nhập kho', description: 'Luồng duyệt phiếu nhập.', colorScheme: 'blue' },
        { icon: BarChart3, title: 'Báo cáo nhập kho', description: 'Thống kê nhập theo kỳ, kho, mặt hàng.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập nhập kho', description: 'Loại phiếu, quy tắc, mặc định.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Xuất kho',
      items: [
        { icon: Upload, title: 'Phiếu xuất kho', description: 'Tạo phiếu xuất, duyệt, trừ tồn.', colorScheme: 'red' },
        { icon: Truck, title: 'Xuất bán / Xuất đơn hàng', description: 'Xuất theo đơn bán, đối ứng bán hàng.', colorScheme: 'orange' },
        { icon: Factory, title: 'Xuất nội bộ / Sản xuất', description: 'Xuất chuyển kho, xuất sản xuất, xuất khác.', colorScheme: 'orange' },
        { icon: CheckCircle2, title: 'Duyệt xuất kho', description: 'Luồng duyệt phiếu xuất.', colorScheme: 'green' },
        { icon: BarChart3, title: 'Báo cáo xuất kho', description: 'Thống kê xuất theo kỳ, kho, mặt hàng.', colorScheme: 'teal' },
        { icon: Settings, title: 'Thiết lập xuất kho', description: 'Loại phiếu, quy tắc, mặc định.', colorScheme: 'slate' }
      ]
    },
    {
      section: 'Vận chuyển & Giao nhận',
      items: [
        { icon: DeliveryIcon, title: 'Đơn vận chuyển', description: 'Tạo đơn giao, gắn với phiếu xuất, đơn hàng.', colorScheme: 'teal' },
        { icon: MapPin, title: 'Theo dõi giao hàng', description: 'Trạng thái giao, cập nhật đã nhận.', colorScheme: 'blue' },
        { icon: Users, title: 'Đối tác vận chuyển', description: 'Đơn vị vận chuyển, cước, hợp đồng.', colorScheme: 'purple' },
        { icon: BarChart3, title: 'Báo cáo vận chuyển', description: 'Thống kê giao hàng, tỷ lệ đúng hạn.', colorScheme: 'purple' },
        { icon: Settings, title: 'Thiết lập vận chuyển', description: 'Loại đơn vận, quy trình, mặc định.', colorScheme: 'slate' }
      ]
    }
  ],
  '/he-thong': [
    {
      section: 'Sơ đồ',
      items: [
        { icon: Building2, title: 'Phòng ban', description: 'Cơ cấu tổ chức đơn vị.', colorScheme: 'purple' },
        { icon: List, title: 'Cấp bậc', description: 'Hệ thống thang bảng lương/level.', colorScheme: 'orange' },
        { icon: Briefcase, title: 'Chức vụ', description: 'Quản lý các vị trí công việc.', colorScheme: 'blue' },
        { icon: ClipboardCheck, title: 'Chức năng nhiệm vụ', description: 'Sứ mệnh, chức năng phòng ban và nhiệm vụ, bộ chỉ số KPI.', colorScheme: 'slate' },
        { icon: Users, title: 'Nhân viên', description: 'Hồ sơ và thông tin nhân sự.', colorScheme: 'emerald' }
      ]
    },
    {
      section: 'Bảo mật & Cấu hình',
      items: [
        { icon: Building, title: 'Thông tin công ty', description: 'Thiết lập thông tin pháp nhân.', colorScheme: 'purple' },
        { icon: MapPin, title: 'Chi nhánh', description: 'Quản lý danh sách chi nhánh và địa điểm.', colorScheme: 'slate' },
        { icon: ShieldCheck, title: 'Phân quyền', description: 'Vai trò và quyền hạn.', colorScheme: 'red' },
        { icon: RefreshCw, title: 'Sao lưu & Khôi phục', description: 'Xuất, nhập và khôi phục dữ liệu hệ thống.', colorScheme: 'blue' },
        { icon: Monitor, title: 'Thiết bị đăng nhập', description: 'Quản lý tài khoản đã đăng nhập trên những thiết bị nào. Đăng xuất thiết bị từ xa.', colorScheme: 'teal' }
      ]
    },
    {
      section: 'Dịch vụ & Bảo trì',
      items: [
        { icon: Ticket, title: 'Ticket sửa chữa', description: 'Quản lý phiếu yêu cầu và tiến độ sửa chữa thiết bị.', colorScheme: 'amber', path: '/phieu-sua-chua' },
        { icon: Ticket, title: 'Thêm ticket sửa chữa', description: 'Lập phiếu yêu cầu sửa chữa mới nhanh chóng cho máy móc.', colorScheme: 'orange', path: '/phieu-sua-chua/tao' },
      ]
    }
  ],
};
