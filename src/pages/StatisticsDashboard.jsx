import { BarChart3, Users, Package, DollarSign, Warehouse, AlertTriangle, TrendingUp, Monitor, Calendar, FileText, Box } from 'lucide-react';
import { useReports } from '../hooks/useReports';
import { SummaryCard } from '../components/ui/SummaryCard';
import { ModuleCard } from '../components/ui/ModuleCard';
import useBookmarkedPaths from '../hooks/useBookmarkedPaths';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

const StatisticsDashboard = ({ hideHeader = false }) => {
  const { fetchDashboardSummary, fetchCylinderAgingStats, fetchCylinderAgingDetails, loading } = useReports();
  const [summary, setSummary] = useState(null);
  const [agingStats, setAgingStats] = useState(null);
  const [agingDetails, setAgingDetails] = useState([]);
  const { isBookmarked, toggleBookmark } = useBookmarkedPaths();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [summaryData, agingData, detailsData] = await Promise.all([
      fetchDashboardSummary(),
      fetchCylinderAgingStats(),
      fetchCylinderAgingDetails({ limit: 10 })
    ]);

    setSummary(summaryData);
    setAgingDetails(detailsData || []);

    if (agingData && agingData.length > 0) {
      const totalAging = agingData.reduce((acc, curr) => ({
        qua_han_30_60: acc.qua_han_30_60 + (Number(curr.qua_han_30_60) || 0),
        qua_han_60_90: acc.qua_han_60_90 + (Number(curr.qua_han_60_90) || 0),
        qua_han_tren_90: acc.qua_han_tren_90 + (Number(curr.qua_han_tren_90) || 0),
      }), { qua_han_30_60: 0, qua_han_60_90: 0, qua_han_tren_90: 0 });
      setAgingStats(totalAging);
    } else {
      setAgingStats({ qua_han_30_60: 0, qua_han_60_90: 0, qua_han_tren_90: 0 });
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'T';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className={clsx("animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pb-10", !hideHeader && "pt-2")}>
      {!hideHeader && (
        <div>
          <h1 className="text-xl lg:text-3xl font-bold flex items-center gap-3 text-foreground mb-1">
            <BarChart3 className="w-8 h-8 text-primary" />
            Trung tâm Thống kê
          </h1>
          <p className="text-muted-foreground text-sm pl-11">Báo cáo số liệu và phân tích hoạt động hệ thống PlasmaVN</p>
        </div>
      )}

      {/* Overview Section */}

      <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Tổng quan hệ thống</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="Tổng KH" value={summary?.tong_khach_hang || 0} icon={Users} colorScheme="blue" path="/bao-cao/khach-hang" />
            <SummaryCard title="Tổng đơn" value={summary?.tong_don_hang || 0} icon={Package} colorScheme="green" path="/bao-cao/don-xuat" />
            <SummaryCard title="Doanh thu" value={formatNumber(summary?.tong_doanh_thu || 0)} icon={DollarSign} colorScheme="purple" path="/bao-cao/doanh-so-may" />
            <SummaryCard title="Tồn kho" value={summary?.binh_ton_kho || 0} icon={Warehouse} colorScheme="orange" path="/bao-cao/may-banh" />

            <SummaryCard title="Bình lỗi" value={summary?.binh_loi || 0} icon={AlertTriangle} colorScheme="red" path="/bao-cao/binh-loi" />
            <SummaryCard title="Máy tồn" value={summary?.may_ton_kho || 0} icon={Monitor} colorScheme="slate" path="/bao-cao/may-banh" />
            <SummaryCard title="Máy đã bán" value={summary?.may_da_ban || 0} icon={TrendingUp} colorScheme="teal" path="/bao-cao/may-banh" />
            <SummaryCard title="KH quá hạn" value={summary?.khach_hang_qua_han || 0} icon={Calendar} colorScheme="yellow" path="/bao-cao/khach-qua-han" />
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Báo cáo nhanh
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4">
          <ModuleCard cardLayout="home" title="Báo cáo khách hàng" description="Theo nhân viên, loại" icon={Users} path="/bao-cao/khach-hang" colorScheme="blue" isBookmarked={isBookmarked("/bao-cao/khach-hang")} onToggleBookmark={toggleBookmark} />
          <ModuleCard cardLayout="home" title="Báo cáo NVKD" description="Báo cáo doanh số" icon={TrendingUp} path="/bao-cao/nhan-vien" colorScheme="green" isBookmarked={isBookmarked("/bao-cao/nhan-vien")} onToggleBookmark={toggleBookmark} />
          <ModuleCard cardLayout="home" title="Đơn hàng" description="Theo tháng, năm" icon={Package} path="/bao-cao/don-xuat" colorScheme="purple" isBookmarked={isBookmarked("/bao-cao/don-xuat")} onToggleBookmark={toggleBookmark} />
          <ModuleCard cardLayout="home" title="Quản lý máy" description="Bán/Cho thuê/Demo" icon={Monitor} path="/bao-cao/may-banh" colorScheme="teal" isBookmarked={isBookmarked("/bao-cao/may-banh")} onToggleBookmark={toggleBookmark} />
          <ModuleCard cardLayout="home" title="Báo cáo quý" description="Chi tiết bảo trì" icon={Calendar} path="/bao-cao/bao-cao-quy" colorScheme="orange" isBookmarked={isBookmarked("/bao-cao/bao-cao-quy")} onToggleBookmark={toggleBookmark} />
          <ModuleCard cardLayout="home" title="Báo cáo doanh số" description="Thống kê theo máy" icon={DollarSign} path="/bao-cao/doanh-so-may" colorScheme="yellow" isBookmarked={isBookmarked("/bao-cao/doanh-so-may")} onToggleBookmark={toggleBookmark} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 pt-2">
          <h3 className="font-semibold text-sm mb-3.5 flex items-center gap-2 text-red-500 px-1">
            <AlertTriangle className="w-4 h-4" />
            Cảnh báo rủi ro
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <SummaryCard title="Bình quá hạn" value={summary?.binh_qua_han || 0} icon={AlertTriangle} colorScheme="red" path="/bao-cao/binh-qua-han" />
            <SummaryCard title="Khách hàng quá hạn" value={summary?.khach_hang_qua_han || 0} icon={Calendar} colorScheme="orange" path="/bao-cao/khach-qua-han" />
            <SummaryCard title="Bình lỗi chưa sửa" value={summary?.binh_loi || 0} icon={AlertTriangle} colorScheme="amber" path="/bao-cao/binh-loi" />
          </div>
        </div>

        <div className="lg:col-span-2 pt-2 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Thống kê ngày tồn bình (Khách giữ)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1 items-center text-center group hover:border-yellow-200 transition-colors">
              <span className="text-[11px] font-bold text-yellow-600 uppercase tracking-tight">30 - 60 ngày</span>
              <span className="text-2xl font-black text-foreground">{agingStats?.qua_han_30_60 || 0}</span>
              <span className="text-[10px] text-muted-foreground">Bắt đầu nhắc nhở</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1 items-center text-center group hover:border-orange-200 transition-colors">
              <span className="text-[11px] font-bold text-orange-600 uppercase tracking-tight">60 - 90 ngày</span>
              <span className="text-2xl font-black text-foreground">{agingStats?.qua_han_60_90 || 0}</span>
              <span className="text-[10px] text-muted-foreground">Cần thu hồi gấp</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col gap-1 items-center text-center group hover:border-red-200 transition-colors">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-tight">{'> 90 ngày'}</span>
              <span className="text-2xl font-black text-foreground">{agingStats?.qua_han_tren_90 || 0}</span>
              <span className="text-[10px] text-muted-foreground">Đặc biệt chú ý hồ sơ</span>
            </div>
          </div>

          {/* Top Aging Details Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/5">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-[13px] text-foreground">Top 10 bình giữ lâu nhất</h3>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium bg-muted/20 px-2 py-0.5 rounded-full border border-border">Cập nhật thời gian thực</span>
            </div>
            <div className="overflow-x-auto">
              {agingDetails && agingDetails.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      <th className="py-2.5 px-4 font-bold border-b border-border">Mã bình</th>
                      <th className="py-2.5 px-4 font-bold border-b border-border">Khách hàng</th>
                      <th className="py-2.5 px-4 font-bold border-b border-border">Ngày giao</th>
                      <th className="py-2.5 px-4 font-bold border-b border-border text-right">Số ngày</th>
                    </tr>
                  </thead>
                  <tbody className="text-[12px]">
                    {agingDetails.slice(0, 5).map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-border/50 hover:bg-primary/[0.02] transition-colors group">
                        <td className="py-2.5 px-4 font-bold text-foreground group-hover:text-primary transition-colors">{item.ma_binh}</td>
                        <td className="py-2.5 px-4 text-muted-foreground truncate max-w-[150px]">{item.khach_hang}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {new Date(item.ngay_giao).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span className={clsx(
                            "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black",
                            item.so_ngay_ton > 90 ? "bg-red-100 text-red-700" :
                              item.so_ngay_ton > 60 ? "bg-orange-100 text-orange-700" :
                                "bg-yellow-100 text-yellow-700"
                          )}>
                            {item.so_ngay_ton}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center flex flex-col items-center gap-2">
                  <Box className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-muted-foreground text-[11px] font-medium">Chưa có dữ liệu bình tồn lâu.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard;
