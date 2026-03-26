import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as ChartLegend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  ArcElement
} from 'chart.js';
import { Bar as BarChartJS, Pie as PieChartJS, Line as LineChartJS } from 'react-chartjs-2';
import {
  AlertTriangle,
  Calendar,
  Download,
  Filter,
  Search,
  X,
  MapPin,
  TrendingDown,
  BarChart2,
  PieChart,
  List,
  ChevronDown,
  Activity,
  Laptop,
  Box
} from 'lucide-react';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportErrorReport } from '../utils/exportExcel';
import FilterDropdown from '../components/ui/FilterDropdown';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  ChartTooltip,
  ChartLegend
);

const ErrorReport = () => {
  const navigate = useNavigate();
  const { fetchErrorReport, fetchFilterOptions, loading } = useReports();
  const [activeTab, setActiveTab] = useState('summary');
  const [data, setData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    warehouses: [],
    years: [new Date().getFullYear()]
  });

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedQuarter, selectedCategory, selectedWarehouses]);

  const loadData = async () => {
    const filters = {
      year: selectedYear,
      month: selectedMonth,
      quarter: selectedQuarter,
      category: selectedCategory,
      warehouse: selectedWarehouses.length > 0 ? selectedWarehouses[0] : null
    };
    const result = await fetchErrorReport(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions({
      warehouses: options.warehouses || [],
      years: options.years || [new Date().getFullYear()]
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  const filteredData = data.filter(item =>
    item.serial_thiet_bi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ten_khach_hang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ten_loi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalErrors = filteredData.length;
  const machineErrors = filteredData.filter(i => i.error_category === 'Máy').length;
  const cylinderErrors = filteredData.filter(i => i.error_category === 'Bình').length;

  const typeStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const type = item.ten_loi || 'Chưa phân loại';
      stats[type] = (stats[type] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const timelineStats = () => {
    const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    const counts = new Array(12).fill(0);
    
    filteredData.forEach(item => {
      if (item.thang) {
        counts[item.thang - 1]++;
      }
    });

    return {
      labels: months,
      datasets: [{
        label: 'Số lượng lỗi',
        data: counts,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#EF4444'
      }]
    };
  };

  const handleExport = () => {
    exportErrorReport(filteredData, { year: selectedYear, month: selectedMonth, quarter: selectedQuarter });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col p-2 md:p-4 bg-muted/20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo Lỗi thiết bị</h1>
          <p className="text-muted-foreground text-sm">Phân tích tỷ lệ hỏng hóc và chất lượng máy/bình theo thời gian</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20"
          >
            <Download size={16} /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-border shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Year */}
          <div className="min-w-[100px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Quarter */}
          <div className="min-w-[100px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Quý</label>
            <select
              value={selectedQuarter}
              onChange={(e) => { setSelectedQuarter(e.target.value); setSelectedMonth(''); }}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="">Tất cả</option>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)}
            </select>
          </div>

          {/* Month */}
          <div className="min-w-[120px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Tháng</label>
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedQuarter(''); }}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="">Tất cả</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div className="min-w-[120px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Loại thiết bị</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="">Tất cả</option>
              <option value="Máy">Máy</option>
              <option value="Bình">Bình</option>
            </select>
          </div>

          {/* Warehouse */}
          <div className="relative min-w-[180px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Kho</label>
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse')}
              className={clsx(
                "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[13px] font-medium transition-all bg-muted/30",
                selectedWarehouses.length > 0 ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <MapPin size={14} className="shrink-0" />
                <span>{selectedWarehouses.length > 0 ? selectedWarehouses[0] : 'Tất cả kho'}</span>
              </div>
              <ChevronDown size={14} className={clsx("transition-transform shrink-0", activeDropdown === 'warehouse' && "rotate-180")} />
            </button>
            {activeDropdown === 'warehouse' && (
              <FilterDropdown
                options={filterOptions.warehouses.map(w => ({ id: w.name, label: w.name }))}
                selected={selectedWarehouses}
                setSelected={(vals) => { setSelectedWarehouses(vals); setActiveDropdown(null); }}
                filterSearch={filterSearch}
                setFilterSearch={setFilterSearch}
                singleSelect={true}
              />
            )}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Tìm kiếm chi tiết</label>
            <Search className="absolute left-3 bottom-2.5 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Mã máy, tên khách hàng, loại lỗi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-muted/30 border border-border rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 bottom-2.5 text-muted-foreground"><X size={14} /></button>}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Tổng số lỗi</p>
            <p className="text-2xl font-black text-foreground">{formatNumber(totalErrors)} lỗi</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Laptop size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Lỗi Máy</p>
            <p className="text-2xl font-black text-foreground">{formatNumber(machineErrors)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Box size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Lỗi Bình</p>
            <p className="text-2xl font-black text-foreground">{formatNumber(cylinderErrors)}</p>
          </div>
        </div>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm h-[400px] flex flex-col">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
            <Activity size={20} className="text-rose-500" /> Xu hướng báo lỗi trong năm
          </h3>
          <div className="flex-1">
             <LineChartJS 
                data={timelineStats()} 
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                    }
                }}
             />
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm h-[400px] flex flex-col">
          <h3 className="font-bold text-lg flex items-center gap-2 mb-6">
            <PieChart size={20} className="text-primary" /> Phân loại lỗi phổ biến nhất
          </h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-[320px]">
                <PieChartJS 
                    data={{
                        labels: typeStats().map(i => i.name),
                        datasets: [{
                            data: typeStats().map(i => i.value),
                            backgroundColor: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'],
                            borderWidth: 2,
                            borderColor: '#fff'
                        }]
                    }}
                    options={{
                        responsive: true,
                        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold', size: 11 } } } }
                    }}
                />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <List size={18} className="text-primary" /> Nhật ký sửa chữa & báo lỗi
          </h3>
          <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold">{filteredData.length} Phiếu</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F8FAFC] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Ticket</th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Thiết bị / Khách hàng</th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Nội dung lỗi</th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Ngày báo</th>
                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-[13px]">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-12 text-center italic text-muted-foreground">Đang tải...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-12 text-center italic text-muted-foreground">Không tìm thấy dữ liệu báo lỗi</td></tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800">#{item.stt}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold flex items-center gap-1">
                            {item.error_category === 'Máy' ? <Laptop size={12} className="text-blue-500" /> : <Box size={12} className="text-amber-500" />}
                            {item.serial_thiet_bi}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{item.ten_khach_hang}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{item.ten_loi || 'Chưa phân loại'}</span>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{item.mo_ta_chi_tiet}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600">
                      {new Date(item.ngay_bao_loi).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        item.trang_thai_phieu === 'Hoàn thành' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        item.trang_thai_phieu === 'Mới' ? "bg-blue-50 text-blue-600 border-blue-200" :
                        item.trang_thai_phieu === 'Đang xử lý' ? "bg-amber-50 text-amber-600 border-amber-200" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {item.trang_thai_phieu}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ErrorReport;
