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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  TrendingUp,
  ArrowUpRight,
  Monitor,
  AlertTriangle,
  Hash,
  Calendar,
  Clock
} from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportCylinderExpiryReport } from '../utils/exportExcel';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import ColumnPicker from '../components/ui/ColumnPicker';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';

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
  ma_binh: { label: 'Mã bình' },
  loai_binh: { label: 'Loại' },
  khach_hang: { label: 'Khách hàng' },
  ngay_het_han: { label: 'Ngày hết hạn' },
  so_ngay_ton: { label: 'Ngày tồn' },
  kho: { label: 'Kho' }
};

const defaultColOrder = Object.keys(COLUMN_DEFS);

const AGING_TIERS = [
  { label: '0-30 ngày', min: 0, max: 30, color: 'bg-emerald-100 text-emerald-700' },
  { label: '31-60 ngày', min: 31, max: 60, color: 'bg-blue-100 text-blue-700' },
  { label: '61-90 ngày', min: 61, max: 90, color: 'bg-amber-100 text-amber-700' },
  { label: 'Trên 90 ngày', min: 91, max: Infinity, color: 'bg-red-100 text-red-700' }
];

const CylinderExpiryReport = () => {
  const navigate = useNavigate();
  const { fetchCylinderExpiry, fetchFilterOptions, loading } = useReports();
  const [activeView, setActiveView] = useState('list');
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [selectedMinDays, setSelectedMinDays] = useState([]);
  const [isDateRange, setIsDateRange] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [filterOptions, setFilterOptions] = useState({
    warehouses: [],
    minDays: [
      { id: '30', label: 'Trên 30 ngày' },
      { id: '60', label: 'Trên 60 ngày' },
      { id: '90', label: 'Trên 90 ngày' }
    ]
  });

  // Column visibility & Order
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_cylinder_expiry_report') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_cylinder_expiry_report_order') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('columns_cylinder_expiry_report', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('columns_cylinder_expiry_report_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
        setShowColumnPicker(false);
      }
    };
    if (showColumnPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnPicker]);

  const isColumnVisible = (key) => visibleColumns.includes(key);
  const visibleTableColumns = columnOrder
    .filter(key => visibleColumns.includes(key))
    .map(key => ({ key, ...COLUMN_DEFS[key] }));

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const listDropdownRef = useRef(null);
  const statsDropdownRef = useRef(null);

  // Mobile filter sheet state
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
  const [pendingWarehouses, setPendingWarehouses] = useState([]);
  const [pendingMinDays, setPendingMinDays] = useState([]);

  useEffect(() => { loadFilterOptions(); }, []);
  useEffect(() => { loadData(); }, [selectedWarehouses, selectedMinDays]);

  const loadData = async () => {
    const filters = {
      warehouse_id: selectedWarehouses.length > 0 ? selectedWarehouses[0] : '',
      min_days: !isDateRange && selectedMinDays.length > 0 ? selectedMinDays[0] : '',
      startDate: isDateRange ? dateRange.start : '',
      endDate: isDateRange ? dateRange.end : ''
    };
    const result = await fetchCylinderExpiry(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions(prev => ({ ...prev, warehouses: options.warehouses || [] }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideList = listDropdownRef.current && listDropdownRef.current.contains(event.target);
      const isClickInsideStats = statsDropdownRef.current && statsDropdownRef.current.contains(event.target);
      if (activeDropdown && !isClickInsideList && !isClickInsideStats) {
        setActiveDropdown(null);
        setFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const handleExport = () => exportCylinderExpiryReport(data, { 
    warehouse_id: selectedWarehouses[0], 
    min_days: selectedMinDays[0],
    startDate: isDateRange ? dateRange.start : '',
    endDate: isDateRange ? dateRange.end : '',
    isDateRange 
  });

  const filteredData = data.filter(item =>
    item.ma_binh?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.khach_hang?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getAgingBadgeClass = (days) => {
    const tier = AGING_TIERS.find(t => days >= t.min && days <= t.max);
    return clsx('px-1.5 py-0.5 rounded text-xs font-medium', tier?.color || 'bg-muted text-muted-foreground');
  };

  const getFilterButtonClass = (filterKey, isActive) => {
    if (!isActive) return 'border-border bg-white text-muted-foreground hover:text-foreground';
    return filterKey === 'warehouses' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  };

  const getFilterIconClass = (filterKey, isActive) => {
    return filterKey === 'warehouses' ? (isActive ? 'text-blue-700' : 'text-blue-500') : (isActive ? 'text-emerald-700' : 'text-emerald-500');
  };

  const getFilterCountBadgeClass = (filterKey) => filterKey === 'warehouses' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white';

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((_, index) => index));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const openMobileFilter = () => { setPendingWarehouses(selectedWarehouses); setPendingMinDays(selectedMinDays); setShowMobileFilter(true); };
  const applyMobileFilter = () => { setSelectedWarehouses(pendingWarehouses); setSelectedMinDays(pendingMinDays); closeMobileFilter(); };
  const closeMobileFilter = () => { setMobileFilterClosing(true); setTimeout(() => { setShowMobileFilter(false); setMobileFilterClosing(false); }, 280); };

  // Stats calculations
  const stats_summary = {
    total: filteredData.length,
    expired: filteredData.filter(item => item.so_ngay_ton > 0).length,
    avgAging: filteredData.length > 0 ? Math.round(filteredData.reduce((sum, item) => sum + (item.so_ngay_ton || 0), 0) / filteredData.length) : 0,
    maxAging: Math.max(0, ...filteredData.map(item => item.so_ngay_ton || 0))
  };

  const getWarehouseStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const warehouse = item.kho || 'Không xác định';
      stats[warehouse] = (stats[warehouse] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getTypeStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const type = item.loai_binh || 'Khác';
      stats[type] = (stats[type] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getAgingTierStats = () => {
    const stats = AGING_TIERS.map(tier => ({ name: tier.label, value: 0 }));
    filteredData.forEach(item => {
      const days = item.so_ngay_ton || 0;
      const index = AGING_TIERS.findIndex(t => days >= t.min && days <= t.max);
      if (index !== -1) stats[index].value += 1;
    });
    return stats;
  };

  const chartColors = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
  ];

  const warehouseOptions = useMemo(() => filterOptions.warehouses.map(w => ({ id: w.id, label: w.name, count: data.filter(d => d.kho === w.name).length })), [filterOptions.warehouses, data]);
  const minDaysOptions = useMemo(() => filterOptions.minDays.map(o => ({ id: o.id, label: o.label, count: data.filter(d => d.so_ngay_ton >= parseInt(o.id)).length })), [filterOptions.minDays, data]);

  const hasActiveFilters = selectedWarehouses.length > 0 || selectedMinDays.length > 0;
  const totalActiveFilters = selectedWarehouses.length + selectedMinDays.length;

  const filterSections = useMemo(() => [
    { id: 'warehouses', label: 'Kho quản lý', icon: <MapPin size={16} />, options: warehouseOptions, selectedValues: pendingWarehouses, onSelectionChange: setPendingWarehouses },
    { 
      id: 'dateMode', 
      label: 'Chế độ lọc', 
      icon: <SlidersHorizontal size={16} />, 
      options: [
        { id: 'aging', label: 'Theo số ngày tồn' },
        { id: 'range', label: 'Theo khoảng ngày hết hạn' }
      ],
      selectedValues: [isDateRange ? 'range' : 'aging'],
      onSelectionChange: (val) => setIsDateRange(val[0] === 'range'),
      singleSelect: true
    },
    ...(!isDateRange ? [
      { id: 'minDays', label: 'Số ngày tồn', icon: <Clock size={16} />, options: minDaysOptions, selectedValues: pendingMinDays, onSelectionChange: setPendingMinDays }
    ] : [
      {
        id: 'startDate',
        label: 'Hết hạn từ',
        icon: <Calendar size={16} className="text-emerald-500" />,
        type: 'date',
        value: dateRange.start,
        onDateChange: (val) => setDateRange(prev => ({ ...prev, start: val }))
      },
      {
        id: 'endDate',
        label: 'Hết hạn đến',
        icon: <Calendar size={16} className="text-emerald-500" />,
        type: 'date',
        value: dateRange.end,
        onDateChange: (val) => setDateRange(prev => ({ ...prev, end: val }))
      }
    ])
  ], [warehouseOptions, minDaysOptions, pendingWarehouses, pendingMinDays, isDateRange, dateRange]);


  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
      <PageViewSwitcher
        activeView={activeView}
        setActiveView={setActiveView}
        views={[
          { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
          { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
        ]}
      />

      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
          {/* MOBILE TOOLBAR */}
          <MobilePageHeader
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              searchPlaceholder="Tìm kiếm . . ."
              onFilterClick={openMobileFilter}
              hasActiveFilters={hasActiveFilters}
              totalActiveFilters={totalActiveFilters}
              actions={
                  <button onClick={handleExport} className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-md shadow-emerald-600/20 active:scale-95 transition-all">
                      <Download size={20} />
                  </button>
              }
              selectionBar={
                  selectedIds.length > 0 ? (
                      <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                          <span className="text-[13px] font-bold text-slate-600">
                              Đã chọn <span className="text-primary">{selectedIds.length}</span> bình
                          </span>
                          <div className="flex items-center gap-2">
                              <button onClick={toggleSelectAll} className="text-[12px] font-bold text-primary hover:underline px-2 py-1">
                                  Bỏ chọn
                              </button>
                          </div>
                      </div>
                  ) : null
              }
          />

          {/* DESKTOP TOOLBAR */}
          <div className="hidden md:block p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"><ChevronLeft size={16} /> Quay lại</button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Tìm kiếm . . ." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
                </div>
              </div>
              <div className="flex items-center gap-2" ref={columnPickerRef}>
                <div className="relative">
                  <button onClick={() => setShowColumnPicker(!showColumnPicker)} className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-light transition-all", showColumnPicker ? "bg-primary/5 border-primary text-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50")}>
                    <SlidersHorizontal size={14} />
                    <span>Cột ({visibleColumns.length}/{defaultColOrder.length})</span>
                  </button>
                  {showColumnPicker && (
                    <ColumnPicker
                      columnOrder={columnOrder}
                      setColumnOrder={setColumnOrder}
                      visibleColumns={visibleColumns}
                      setVisibleColumns={setVisibleColumns}
                      defaultColOrder={defaultColOrder}
                      columnDefs={COLUMN_DEFS}
                    />
                  )}
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"><Download size={16} /> Xuất Excel</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2" ref={listDropdownRef}>
              <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border mr-2 shadow-inner">
                <button 
                  onClick={() => setIsDateRange(false)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                    !isDateRange ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Theo số ngày
                </button>
                <button 
                  onClick={() => setIsDateRange(true)}
                  className={clsx(
                    "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
                    isDateRange ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Khoảng ngày hết hạn
                </button>
              </div>

              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('warehouses', selectedWarehouses.length > 0))}>
                  <MapPin size={14} className={getFilterIconClass('warehouses', selectedWarehouses.length > 0)} /> Kho {selectedWarehouses.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>{selectedWarehouses.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'warehouses' && <FilterDropdown options={warehouseOptions} selected={selectedWarehouses} setSelected={setSelectedWarehouses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>

              {!isDateRange ? (
                <div className="relative">
                  <button onClick={() => { setActiveDropdown(activeDropdown === 'minDays' ? null : 'minDays'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('minDays', selectedMinDays.length > 0))}>
                    <Clock size={14} className={getFilterIconClass('minDays', selectedMinDays.length > 0)} /> Tồn trên {selectedMinDays.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('minDays'))}>{selectedMinDays.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'minDays' ? "rotate-180" : "")} />
                  </button>
                  {activeDropdown === 'minDays' && <FilterDropdown options={minDaysOptions} selected={selectedMinDays} setSelected={setSelectedMinDays} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                </div>
              ) : (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm group focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Từ:</span>
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-transparent border-none outline-none text-[13px] font-bold text-foreground cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm group focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Đến:</span>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="bg-transparent border-none outline-none text-[13px] font-bold text-foreground cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {(hasActiveFilters || isDateRange) && <button onClick={() => { setSelectedWarehouses([]); setSelectedMinDays([]); setIsDateRange(false); setDateRange({ start: '', end: '' }); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block flex-1 overflow-x-auto bg-white">
            <table className="w-full border-collapse">
              <thead className="bg-[#F1F5FF]">
                <tr>
                  <th className="px-4 py-3.5 w-10 sticky left-0 bg-[#F1F5FF] z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.length === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} /></div></th>
                  {visibleTableColumns.map(col => (
                    <th key={col.key} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide", col.key === 'so_ngay_ton' ? "text-right" : "text-left")}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {loading ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Đang tải dữ liệu...</td></tr>) : paginatedData.length === 0 ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Không tìm thấy dữ liệu</td></tr>) : (
                  paginatedData.map((item, index) => {
                    const globalIndex = (currentPage - 1) * pageSize + index;
                    return (
                    <tr key={globalIndex} className={clsx("group transition-all hover:bg-blue-50/40", selectedIds.includes(globalIndex) && "bg-blue-50/60")}>
                      <td className="px-4 py-4 sticky left-0 bg-white group-hover:bg-blue-50/40 z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes(globalIndex)} onChange={() => toggleSelect(globalIndex)} /></div></td>
                      {columnOrder.filter(isColumnVisible).map(colKey => {
                        if (colKey === 'ma_binh') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-bold text-primary">{item.ma_binh}</span></td>;
                        if (colKey === 'loai_binh') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] text-foreground">{item.loai_binh}</span></td>;
                        if (colKey === 'khach_hang') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-medium text-foreground">{item.khach_hang || '-'}</span></td>;
                        if (colKey === 'ngay_het_han') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] text-muted-foreground font-medium">{item.ngay_het_han || '-'}</span></td>;
                        if (colKey === 'so_ngay_ton') return <td key={colKey} className="px-4 py-4 text-right"><span className={getAgingBadgeClass(item.so_ngay_ton)}>{item.so_ngay_ton} ngày</span></td>;
                        if (colKey === 'kho') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] text-muted-foreground font-medium">{item.kho || '-'}</span></td>;
                        return null;
                      })}
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex-1 overflow-y-auto p-3 pb-4 flex flex-col gap-3">
            {loading ? (
              <div className="py-20 text-center italic text-muted-foreground animate-pulse">Đang tải dữ liệu...</div>
            ) : paginatedData.length === 0 ? (
              <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-2">
                <AlertTriangle size={32} className="text-amber-500 opacity-50" />
                <span>Không có dữ liệu phù hợp</span>
              </div>
            ) : (
              paginatedData.map((item, index) => {
                const globalIndex = (currentPage - 1) * pageSize + index;
                return (
                  <div key={globalIndex} className={clsx(
                      "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                      selectedIds.includes(globalIndex)
                          ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                          : "border-primary/15 bg-white"
                  )}>
                    <div className="flex items-start justify-between gap-2 mb-2 ml-1">
                        <div className="flex gap-3">
                            <div className="pt-1">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer" 
                                    checked={selectedIds.includes(globalIndex)} 
                                    onChange={() => toggleSelect(globalIndex)} 
                                />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{globalIndex + 1}</p>
                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 flex items-center gap-1 font-mono"><Hash size={14} className="text-muted-foreground" />{item.ma_binh}</h3>
                            </div>
                        </div>
                        <span className={clsx(getAgingBadgeClass(item.so_ngay_ton), "px-2")}>
                            Tồn {item.so_ngay_ton} ngày
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div className="col-span-2">
                            <h3 className="text-[14px] font-bold text-foreground mb-1">{item.khach_hang || 'Chưa có KH'}</h3>
                        </div>
                        <div className="flex flex-col justify-center">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1"><Monitor size={10} /> Loại bình</p>
                            <p className="text-[12px] font-bold text-slate-700">{item.loai_binh}</p>
                        </div>
                        <div className="flex flex-col justify-center">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1"><Calendar size={10} /> Hết hạn</p>
                            <p className="text-[12px] font-bold text-slate-700">{item.ngay_het_han}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pl-1 text-[12px] text-muted-foreground">
                        <MapPin size={13} className="text-blue-500" />
                        <span className="font-bold flex-1 text-slate-700">{item.kho || '-'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Mobile Pagination */}
          {!loading && (
              <MobilePagination
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                  totalRecords={filteredData.length}
              />
          )}

          {/* FOOTER Desktop*/}
          <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
              <span>{filteredData.length > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredData.length)}` : '0'} / Tổng {filteredData.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(1)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage === 1} title="Trang đầu">
                <ChevronLeft size={16} />
                <ChevronLeft size={16} className="-ml-2.5" />
              </button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage === 1} title="Trang trước">
                <ChevronLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                {currentPage}
              </div>
              <button onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredData.length / pageSize), prev + 1))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage >= Math.ceil(filteredData.length / pageSize)} title="Trang sau">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setCurrentPage(Math.ceil(filteredData.length / pageSize))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage >= Math.ceil(filteredData.length / pageSize)} title="Trang cuối">
                <ChevronRight size={16} />
                <ChevronRight size={16} className="-ml-2.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'stats' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
          {/* Header Parity with List View */}
          <div className="space-y-0 text-left">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
              <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
              <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê tồn vỏ</h2>
              <button onClick={openMobileFilter} className={clsx('relative p-2 rounded-xl border shrink-0 transition-all', hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground')}><Filter size={18} />{hasActiveFilters && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{totalActiveFilters}</span>}</button>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block p-4 border-b border-border" ref={statsDropdownRef}>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"><ChevronLeft size={16} /> Quay lại</button>
                <div className="relative">
                  <button onClick={() => { setActiveDropdown(activeDropdown === 'warehouses_stats' ? null : 'warehouses_stats'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('warehouses', selectedWarehouses.length > 0))}>
                    <MapPin size={14} className={getFilterIconClass('warehouses', selectedWarehouses.length > 0)} /> Kho {selectedWarehouses.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>{selectedWarehouses.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses_stats' ? "rotate-180" : "")} />
                  </button>
                  {activeDropdown === 'warehouses_stats' && <FilterDropdown options={warehouseOptions} selected={selectedWarehouses} setSelected={setSelectedWarehouses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                </div>
                <div className="relative">
                  <button onClick={() => { setActiveDropdown(activeDropdown === 'minDays_stats' ? null : 'minDays_stats'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('minDays', selectedMinDays.length > 0))}>
                    <Clock size={14} className={getFilterIconClass('minDays', selectedMinDays.length > 0)} /> Tồn trên {selectedMinDays.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('minDays'))}>{selectedMinDays.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'minDays_stats' ? "rotate-180" : "")} />
                  </button>
                  {activeDropdown === 'minDays_stats' && <FilterDropdown options={minDaysOptions} selected={selectedMinDays} setSelected={setSelectedMinDays} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                </div>
                {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); setSelectedMinDays([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
              </div>
            </div>
          </div>

          <div className="w-full p-4 md:p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-blue-50/70 border border-blue-100 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col items-center text-center group hover:bg-blue-50 transition-all duration-300">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Hash className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-[10px] md:text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">Tổng số bình</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black text-foreground leading-none">{formatNumber(stats_summary.total)}</span>
                </div>
              </div>

              <div className="bg-red-50/70 border border-red-100 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col items-center text-center group hover:bg-red-50 transition-all duration-300">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-[10px] md:text-[11px] font-bold text-red-600 uppercase tracking-widest mb-1">Bình quá hạn</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black text-foreground leading-none">{formatNumber(stats_summary.expired)}</span>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-100 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col items-center text-center group hover:bg-amber-50 transition-all duration-300">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-[10px] md:text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-1">Ngày tồn TB</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black text-foreground leading-none">{stats_summary.avgAging}</span>
                  <span className="text-sm md:text-base font-bold text-foreground/70">ngày</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-100 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col items-center text-center group hover:bg-emerald-50 transition-all duration-300">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-[10px] md:text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Tồn lâu nhất</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black text-foreground leading-none">{stats_summary.maxAging}</span>
                  <span className="text-sm md:text-base font-bold text-foreground/70">ngày</span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Phân khúc tồn</h3>
                <div style={{ height: '300px' }}>
                  <PieChartJS
                    data={{
                      labels: getAgingTierStats().map(item => item.name),
                      datasets: [{
                        data: getAgingTierStats().map(item => item.value),
                        backgroundColor: ['#10B981', '#2563EB', '#F59E0B', '#EF4444'],
                        borderColor: '#fff',
                        borderWidth: 2
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                </div>
              </div>
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Kho</h3>
                <div style={{ height: '300px' }}>
                  <PieChartJS
                    data={{
                      labels: getWarehouseStats().map(item => item.name),
                      datasets: [{
                        data: getWarehouseStats().map(item => item.value),
                        backgroundColor: chartColors.slice(0, getWarehouseStats().length).reverse(),
                        borderColor: '#fff',
                        borderWidth: 2
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                  />
                </div>
              </div>
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-bold text-foreground mb-4">Thống kê theo Loại bình</h3>
                <div style={{ height: '350px' }}>
                  <BarChartJS
                    data={{
                      labels: getTypeStats().map(item => item.name),
                      datasets: [{
                        label: 'Số lượng bình',
                        data: getTypeStats().map(item => item.value),
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
                        y: { beginAtZero: true, grid: { display: true, color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <MobileFilterSheet isOpen={showMobileFilter} isClosing={mobileFilterClosing} onClose={closeMobileFilter} onApply={applyMobileFilter} title="Lọc báo cáo" sections={filterSections} hasActiveFilters={hasActiveFilters} totalActiveFilters={totalActiveFilters} />
    </div>
  );
};

export default CylinderExpiryReport;
