import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  MapPin,
  Briefcase,
  BarChart2,
  PieChart,
  List,
  ChevronDown
} from 'lucide-react';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportSalesReport } from '../utils/exportExcel';
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

const CUSTOMER_CATEGORIES = {
  'BV': 'Bệnh viện',
  'TM': 'Thẩm mỹ viện',
  'PK': 'Phòng khám',
  'NG': 'Khách ngoại giao',
  'SP': 'Spa / Khác'
};

const SalesReport = () => {
  const navigate = useNavigate();
  const { fetchSalesReport, fetchFilterOptions, loading } = useReports();
  const [activeTab, setActiveTab] = useState('summary');
  const [data, setData] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    warehouses: [],
    salespersons: [],
    categories: [],
    years: [new Date().getFullYear()]
  });

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [selectedSalespersons, setSelectedSalespersons] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedWarehouses, selectedSalespersons, selectedCategories]);

  const loadData = async () => {
    const filters = {
      year: selectedYear,
      month: selectedMonth,
      warehouse: selectedWarehouses.length > 0 ? selectedWarehouses[0] : null,
      nvkd: selectedSalespersons.length > 0 ? selectedSalespersons[0] : null,
      customer_category: selectedCategories.length > 0 ? selectedCategories[0] : null
    };
    const result = await fetchSalesReport(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions({
      warehouses: options.warehouses || [],
      salespersons: options.salespersons || [],
      categories: options.categories || [],
      years: options.years || [new Date().getFullYear()]
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('vi-VN').format(num || 0);
  };

  const filteredData = data.filter(item =>
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalRevenue = filteredData.reduce((sum, item) => sum + (item.doanh_so || 0), 0);
  const totalOrders = filteredData.reduce((sum, item) => sum + (item.so_don_hang || 0), 0);
  const totalCustomers = new Set(filteredData.map(item => item.customer_name)).size;

  const topCustomers = [...filteredData]
    .sort((a, b) => b.doanh_so - a.doanh_so)
    .slice(0, 10);

  const getCategoryStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const cat = item.loai_khach || 'Khác';
      const label = CUSTOMER_CATEGORIES[cat] || cat;
      stats[label] = (stats[label] || 0) + (item.doanh_so || 0);
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getNvkdStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const nvkd = item.nvkd || 'Không xác định';
      stats[nvkd] = (stats[nvkd] || 0) + (item.doanh_so || 0);
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  };

  const chartColors = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
  ];

  const handleExport = () => {
    exportSalesReport(filteredData, { year: selectedYear, month: selectedMonth });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col p-2 md:p-4 bg-muted/20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Báo cáo Doanh số</h1>
          <p className="text-muted-foreground text-sm">Phân tích kết quả kinh doanh theo thời gian và đối tượng</p>
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
          {/* Year Select */}
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

          {/* Month Select */}
          <div className="min-w-[120px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Tháng</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all"
            >
              <option value="">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
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
              />
            )}
          </div>

          {/* Salesperson Filter */}
          <div className="relative min-w-[200px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">NVKD</label>
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'nvkd' ? null : 'nvkd')}
              className={clsx(
                "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[13px] font-medium transition-all bg-muted/30",
                selectedSalespersons.length > 0 ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden truncate">
                <Briefcase size={14} className="shrink-0" />
                <span>{selectedSalespersons.length > 0 ? selectedSalespersons[0] : 'Tất cả NVKD'}</span>
              </div>
              <ChevronDown size={14} className={clsx("transition-transform shrink-0", activeDropdown === 'nvkd' && "rotate-180")} />
            </button>
            {activeDropdown === 'nvkd' && (
              <FilterDropdown
                options={filterOptions.salespersons.map(s => ({ id: s, label: s }))}
                selected={selectedSalespersons}
                setSelected={(vals) => { setSelectedSalespersons(vals); setActiveDropdown(null); }}
                filterSearch={filterSearch}
                setFilterSearch={setFilterSearch}
              />
            )}
          </div>

          {/* Customer Search */}
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1 px-1">Tìm khách hàng</label>
            <Search className="absolute left-3 bottom-2.5 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Tên khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-muted/30 border border-border rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 bottom-2.5 text-muted-foreground"><X size={14} /></button>}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Tổng doanh số</p>
            <p className="text-2xl font-black text-foreground">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Tổng số đơn</p>
            <p className="text-2xl font-black text-foreground">{formatNumber(totalOrders)} đơn</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Users size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Số khách hàng</p>
            <p className="text-2xl font-black text-foreground">{formatNumber(totalCustomers)} khách</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        {/* Left Side: Visualization */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <BarChart2 size={20} className="text-primary" /> Phân tích doanh số
              </h3>
              <div className="flex bg-muted/30 p-1 rounded-xl">
                 <button onClick={() => setActiveTab('customer')} className={clsx("px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all", activeTab === 'customer' || activeTab === 'summary' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>Khách hàng</button>
                 <button onClick={() => setActiveTab('nvkd')} className={clsx("px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all", activeTab === 'nvkd' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>NVKD</button>
                 <button onClick={() => setActiveTab('category')} className={clsx("px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all", activeTab === 'category' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>Loại khách</button>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              {activeTab === 'nvkd' ? (
                <BarChartJS
                  data={{
                    labels: getNvkdStats().map(i => i.name),
                    datasets: [{
                      label: 'Doanh số (VNĐ)',
                      data: getNvkdStats().map(i => i.value),
                      backgroundColor: 'rgba(37, 99, 235, 0.8)',
                      borderRadius: 8,
                      barThickness: 30
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => formatNumber(v) } },
                      x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                    }
                  }}
                />
              ) : activeTab === 'category' ? (
                <div className="flex h-full items-center justify-center">
                  <div className="w-full max-w-[400px]">
                    <PieChartJS
                      data={{
                        labels: getCategoryStats().map(i => i.name),
                        datasets: [{
                          data: getCategoryStats().map(i => i.value),
                          backgroundColor: chartColors,
                          borderColor: '#fff',
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { weight: 'bold' } } } }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <BarChartJS
                  data={{
                    labels: topCustomers.map(i => i.customer_name),
                    datasets: [{
                      label: 'Doanh số (VNĐ)',
                      data: topCustomers.map(i => i.doanh_so),
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      borderRadius: 8,
                      barThickness: 30
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => formatNumber(v) } },
                      y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Table */}
        <div className="lg:w-1/3 flex flex-col min-h-0 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-base flex items-center gap-2">
              <List size={18} className="text-primary" /> Bảng chi tiết
            </h3>
            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold">{filteredData.length} Khách</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F8FAFC] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border">Khách hàng / Cơ sở</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase border-b border-border text-right">Doanh số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr><td colSpan="2" className="px-4 py-12 text-center text-sm italic text-muted-foreground">Đang tải...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan="2" className="px-4 py-12 text-center text-sm italic text-muted-foreground">Không có dữ liệu</td></tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-bold text-foreground">{item.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                           <Briefcase size={10} /> {item.nvkd || '-'} • {CUSTOMER_CATEGORIES[item.loai_khach] || item.loai_khach}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-[13px] font-bold text-primary">{formatNumber(item.doanh_so)}</p>
                        <p className="text-[10px] text-muted-foreground">{item.so_don_hang} đơn</p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
