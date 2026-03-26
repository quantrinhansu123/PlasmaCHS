import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend as ChartLegend,
  Tooltip as ChartTooltip,
  LinearScale,
  LineElement,
  PointElement,
  Title
} from 'chart.js';
import {
  BarChart2,
  Building,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layout,
  List,
  MapPin,
  Package,
  PackageCheck,
  PackagePlus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
  History
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar as BarChartJS, Line as LineChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportCustomerCylinderReport } from '../utils/exportExcel';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import ColumnPicker from '../components/ui/ColumnPicker';
import { CUSTOMER_CATEGORIES } from '../constants/orderConstants';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  ChartLegend
);

const COLUMN_DEFS = {
  customer_name: { label: 'Tên Khách Hàng' },
  loai_khach: { label: 'Loại' },
  kho: { label: 'Kho' },
  opening_balance: { label: 'Tồn đầu' },
  xuat: { label: 'Xuất bình' },
  thu_hoi: { label: 'Thu hồi' },
  closing_balance: { label: 'Tồn cuối' }
};

const defaultColOrder = Object.keys(COLUMN_DEFS);

const CustomerCylinderReport = () => {
  const navigate = useNavigate();
  const { fetchCustomerCylinderReport, fetchFilterOptions, loading } = useReports();
  const [activeView, setActiveView] = useState('list');
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    warehouse: '',
    customer_category: ''
  });

  const [filterOptions, setFilterOptions] = useState({
    years: [new Date().getFullYear()],
    warehouses: [],
    customerTypes: []
  });

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const dropdownRef = useRef(null);

  // Column visibility & Order
  const [visibleColumns, setVisibleColumns] = useState(defaultColOrder);
  const [columnOrder, setColumnOrder] = useState(defaultColOrder);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  // Mobile filters
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [mobileFilterClosing, setMobileFilterClosing] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions({
      years: options.years || [new Date().getFullYear()],
      warehouses: options.warehouses || [],
      customerTypes: options.customerTypes || []
    });
  };

  const loadData = async () => {
    const result = await fetchCustomerCylinderReport(filters);
    setData(result || []);
  };

  const filteredData = data.filter(item =>
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleExport = () => exportCustomerCylinderReport(filteredData, filters);

  const stats_summary = {
    totalOpening: filteredData.reduce((sum, item) => sum + (item.opening_balance || 0), 0),
    totalXuat: filteredData.reduce((sum, item) => sum + (item.xuat || 0), 0),
    totalThuHoi: filteredData.reduce((sum, item) => sum + (item.thu_hoi || 0), 0),
    totalClosing: filteredData.reduce((sum, item) => sum + (item.closing_balance || 0), 0),
  };

  const getCategoryBadgeClass = (categoryId) => clsx(
    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
    categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
    categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
    categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
    categoryId === 'NG' && 'bg-violet-50 text-violet-700 border-violet-200',
    categoryId === 'SP' && 'bg-amber-50 text-amber-700 border-amber-200',
    !categoryId && 'bg-muted text-muted-foreground border-border'
  );

  const getLabel = (list, id) => {
    const matched = list.find(item => (item.id === id || item.name === id));
    return matched?.label || matched?.name || id;
  };

  const getChartData = () => {
    const top10 = [...filteredData]
      .sort((a, b) => (b.closing_balance || 0) - (a.closing_balance || 0))
      .slice(0, 10);
    
    return {
      labels: top10.map(item => item.customer_name),
      datasets: [
        {
          label: 'Số lượng bình',
          data: top10.map(item => item.closing_balance),
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
          borderRadius: 8,
          barThickness: 30
        }
      ]
    };
  };

  const filterSections = [
    {
      id: 'years',
      label: 'Năm',
      icon: <Calendar size={18} className="text-blue-500" />,
      options: filterOptions.years.map(y => ({ id: y.toString(), label: `Năm ${y}` })),
      selectedValues: [filters.year],
      onSelectionChange: (val) => setFilters(prev => ({ ...prev, year: val[0] })),
      singleSelect: true
    },
    {
      id: 'months',
      label: 'Tháng',
      icon: <Calendar size={18} className="text-cyan-500" />,
      options: Array.from({ length: 12 }, (_, i) => ({ id: (i + 1).toString(), label: `Tháng ${i + 1}` })),
      selectedValues: [filters.month],
      onSelectionChange: (val) => setFilters(prev => ({ ...prev, month: val[0] })),
      singleSelect: true
    },
    {
      id: 'warehouses',
      label: 'Kho',
      icon: <MapPin size={18} className="text-amber-500" />,
      options: filterOptions.warehouses.map(w => ({ id: w.name, label: w.name })),
      selectedValues: filters.warehouse ? [filters.warehouse] : [],
      onSelectionChange: (val) => setFilters(prev => ({ ...prev, warehouse: val[0] || '' })),
      singleSelect: true
    }
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
      {/* Top Tabs */}
      <div className="flex items-center gap-1 mb-3 mt-1">
        <button onClick={() => setActiveView('list')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all", activeView === 'list' ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
          <List size={14} /> Danh sách
        </button>
        <button onClick={() => setActiveView('stats')} className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all", activeView === 'stats' ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
          <BarChart2 size={14} /> Thống kê
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
        {/* MOBILE TOOLBAR */}
        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 shadow-sm"><ChevronLeft size={18} /></button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <input type="text" placeholder="Tìm khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
          </div>
          <button onClick={() => setShowMobileFilter(true)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 shadow-sm"><Filter size={18} /></button>
        </div>

        {/* DESKTOP TOOLBAR */}
        <div className="hidden md:block p-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"><ChevronLeft size={16} /> Quay lại</button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input type="text" placeholder="Tìm nhanh khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"><Download size={18} /> Xuất Excel</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
            <div className="relative">
              <button 
                onClick={() => {
                  if (activeDropdown !== 'year') setFilterSearch('');
                  setActiveDropdown(activeDropdown === 'year' ? null : 'year');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-[13px] font-bold hover:border-primary/50 transition-all shadow-sm"
              >
                <Calendar size={14} className="text-blue-500" /> Năm {filters.year} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'year' ? "rotate-180" : "")} />
              </button>
              {activeDropdown === 'year' && (
                <FilterDropdown 
                  options={filterOptions.years.map(y => ({ id: y.toString(), label: `Năm ${y}`, count: filteredData.filter(d => d.nam === y).length }))} 
                  selected={[filters.year]} 
                  setSelected={(val) => { setFilters(prev => ({ ...prev, year: val[0] })); setActiveDropdown(null); }} 
                  filterSearch={filterSearch}
                  setFilterSearch={setFilterSearch}
                  singleSelect={true}
                />
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => {
                  if (activeDropdown !== 'month') setFilterSearch('');
                  setActiveDropdown(activeDropdown === 'month' ? null : 'month');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-[13px] font-bold hover:border-primary/50 transition-all shadow-sm"
              >
                <Calendar size={14} className="text-cyan-500" /> Tháng {filters.month} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'month' ? "rotate-180" : "")} />
              </button>
              {activeDropdown === 'month' && (
                <FilterDropdown 
                  options={Array.from({ length: 12 }, (_, i) => ({ id: (i + 1).toString(), label: `Tháng ${i + 1}`, count: filteredData.filter(d => d.thang === (i + 1)).length }))} 
                  selected={[filters.month]} 
                  setSelected={(val) => { setFilters(prev => ({ ...prev, month: val[0] })); setActiveDropdown(null); }} 
                  filterSearch={filterSearch}
                  setFilterSearch={setFilterSearch}
                  singleSelect={true}
                />
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => {
                  if (activeDropdown !== 'warehouse') setFilterSearch('');
                  setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-white text-[13px] font-bold hover:border-primary/50 transition-all shadow-sm"
              >
                <MapPin size={14} className="text-amber-500" /> {filters.warehouse || 'Tất cả kho'} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouse' ? "rotate-180" : "")} />
              </button>
              {activeDropdown === 'warehouse' && (
                <FilterDropdown 
                  options={[{ id: '', label: 'Tất cả kho', count: filteredData.length }, ...filterOptions.warehouses.map(w => ({ id: w.name, label: w.name, count: filteredData.filter(d => d.kho === w.name).length }))]} 
                  selected={[filters.warehouse]} 
                  setSelected={(val) => { setFilters(prev => ({ ...prev, warehouse: val[0] || '' })); setActiveDropdown(null); }} 
                  filterSearch={filterSearch}
                  setFilterSearch={setFilterSearch}
                />
              )}
            </div>
          </div>
        </div>

        {activeView === 'list' ? (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block flex-1 overflow-x-auto bg-white">
              <table className="w-full border-collapse">
                <thead className="bg-[#F1F5FF]">
                  <tr>
                    {defaultColOrder.map(colKey => (
                      <th key={colKey} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide", colKey.includes('balance') || colKey === 'xuat' || colKey === 'thu_hoi' ? "text-right" : "text-left")}>
                        {COLUMN_DEFS[colKey].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {loading ? (
                    <tr><td colSpan={defaultColOrder.length} className="px-4 py-16 text-center text-muted-foreground italic">Đang tải dữ liệu...</td></tr>
                  ) : filteredData.length === 0 ? (
                    <tr><td colSpan={defaultColOrder.length} className="px-4 py-16 text-center text-muted-foreground italic">Không có dữ liệu trong kỳ báo cáo này</td></tr>
                  ) : (
                    filteredData.map((item, index) => (
                      <tr key={index} className="group hover:bg-blue-50/40 transition-all">
                        <td className="px-4 py-4"><span className="text-[13px] font-bold text-foreground">{item.customer_name}</span></td>
                        <td className="px-4 py-4"><span className={getCategoryBadgeClass(item.loai_khach)}>{getLabel(CUSTOMER_CATEGORIES, item.loai_khach)}</span></td>
                        <td className="px-4 py-4"><span className="text-[13px] text-muted-foreground">{item.kho || '-'}</span></td>
                        <td className="px-4 py-4 text-right font-medium text-slate-500">{formatNumber(item.opening_balance)}</td>
                        <td className="px-4 py-4 text-right font-bold text-emerald-600">+{formatNumber(item.xuat)}</td>
                        <td className="px-4 py-4 text-right font-bold text-rose-500">-{formatNumber(item.thu_hoi)}</td>
                        <td className="px-4 py-4 text-right font-bold text-primary">{formatNumber(item.closing_balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST */}
            <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-muted/5">
              {loading ? (
                <div className="py-16 text-center italic text-muted-foreground">Đang tải...</div>
              ) : filteredData.map((item, index) => (
                <div key={index} className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-[14px] font-bold text-foreground leading-tight">{item.customer_name}</h3>
                    <span className={getCategoryBadgeClass(item.loai_khach)}>{getLabel(CUSTOMER_CATEGORIES, item.loai_khach)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] mb-2 font-bold uppercase text-muted-foreground">
                    <div>Đầu</div>
                    <div className="text-emerald-600">Nhập</div>
                    <div className="text-rose-500">Thu</div>
                    <div className="text-primary">Cuối</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm font-bold">
                    <div className="text-slate-500">{formatNumber(item.opening_balance)}</div>
                    <div className="text-emerald-600">+{formatNumber(item.xuat)}</div>
                    <div className="text-rose-500">-{formatNumber(item.thu_hoi)}</div>
                    <div className="text-primary">{formatNumber(item.closing_balance)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* STATS VIEW */
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard icon={<History />} label="Tổng tồn đầu" value={stats_summary.totalOpening} color="blue" />
              <SummaryCard icon={<PackagePlus />} label="Tổng nhập vỏ" value={stats_summary.totalXuat} color="emerald" />
              <SummaryCard icon={<PackageMinus />} label="Tổng thu vỏ" value={stats_summary.totalThuHoi} color="rose" />
              <SummaryCard icon={<PackageCheck />} label="Tổng tồn cuối" value={stats_summary.totalClosing} color="indigo" />
            </div>

            <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Khách hàng giữ bình</h3>
              <div style={{ height: '400px' }}>
                <BarChartJS 
                  data={getChartData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                      x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="px-4 py-4 border-t border-border flex items-center justify-between bg-muted/5">
          <span className="text-[12px] text-muted-foreground font-medium">Tổng {filteredData.length} khách hàng</span>
        </div>
      </div>

      <MobileFilterSheet 
        isOpen={showMobileFilter} 
        isClosing={mobileFilterClosing} 
        onClose={() => setShowMobileFilter(false)} 
        onApply={() => setShowMobileFilter(false)} 
        title="Lọc báo cáo bình" 
        sections={filterSections} 
      />
    </div>
  );
};

const SummaryCard = ({ icon, label, value, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 ring-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 ring-rose-200',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 ring-indigo-200'
  };
  
  return (
    <div className={clsx("border rounded-2xl p-4 shadow-sm", colorMap[color].split(' ').slice(0, 3).join(' '))}>
      <div className="flex items-center gap-3 mb-2">
        <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center ring-1", colorMap[color])}>
          {React.cloneElement(icon, { size: 16 })}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-bold leading-none">{value.toLocaleString('vi-VN')}</p>
    </div>
  );
};

export default CustomerCylinderReport;
