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
  AlertTriangle,
  Calendar,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportCustomerExpiryReport } from '../utils/exportExcel';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import ColumnPicker from '../components/ui/ColumnPicker';

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
  ten_khach_hang: { label: 'Tên Khách Hàng' },
  kho: { label: 'Kho' },
  nhan_vien_kinh_doanh: { label: 'NVKD' },
  binh_ton: { label: 'Bình đang giữ' },
  may_dang_su_dung: { label: 'Máy đang dùng' },
  danh_sach_binh: { label: 'Mã bình' },
  danh_sach_may: { label: 'Mã máy' },
  ngay_dat_hang_gan_nhat: { label: 'Ngày đặt gần nhất' },
  so_ngay_chua_phat_sinh: { label: 'Ngày chưa PS' },
  ma_don_gan_nhat: { label: 'Mã đơn gần nhất' }
};

const defaultColOrder = Object.keys(COLUMN_DEFS);

const CustomerExpiryReport = () => {
  const navigate = useNavigate();
  const { fetchCustomerExpiry, fetchFilterOptions, loading } = useReports();
  const [activeView, setActiveView] = useState('list');
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Filters
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]); // Filter by days range

  const [filterOptions, setFilterOptions] = useState({
    warehouses: [],
    daysBrackets: [
      { id: '30', label: 'Trên 30 ngày' },
      { id: '60', label: 'Trên 60 ngày' },
      { id: '90', label: 'Trên 90 ngày' }
    ]
  });

  // Column visibility & Order
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_customer_expiry_report') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_customer_expiry_report_order') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('columns_customer_expiry_report', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('columns_customer_expiry_report_order', JSON.stringify(columnOrder));
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
  const [pendingDays, setPendingDays] = useState([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedWarehouses, selectedDays]);

  const loadData = async () => {
    const filters = {
      warehouse_id: selectedWarehouses.length > 0 ? selectedWarehouses[0] : '',
      min_days: selectedDays.length > 0 ? selectedDays[0] : ''
    };
    const result = await fetchCustomerExpiry(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions(prev => ({
      ...prev,
      warehouses: options.warehouses || []
    }));
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

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }
    exportCustomerExpiryReport(filteredData);
  };

  const filteredData = data.filter(item =>
    item.ten_khach_hang?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const dayOptions = filterOptions.daysBrackets.map(d => ({
    id: d.id,
    label: d.label,
    count: data.filter(item => item.so_ngay_chua_phat_sinh >= parseInt(d.id)).length
  }));

  const warehouseOptions = useMemo(() => filterOptions.warehouses.map(w => ({
    id: w.id,
    label: w.name,
    count: data.filter(d => d.kho === w.id).length
  })), [filterOptions.warehouses, data]);

  const getFilterButtonClass = (isActive, color) => {
    if (!isActive) return 'border-border bg-white text-muted-foreground hover:text-foreground';
    return color === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700';
  };

  const getFilterIconClass = (isActive, color) => {
    return color === 'blue' ? (isActive ? 'text-blue-700' : 'text-blue-500') : (isActive ? 'text-amber-700' : 'text-amber-500');
  };

  const getFilterCountBadgeClass = (color) => color === 'blue' ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white';

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

  // Mobile filter handlers
  const openMobileFilter = () => { setPendingWarehouses(selectedWarehouses); setPendingDays(selectedDays); setShowMobileFilter(true); };
  const applyMobileFilter = () => { setSelectedWarehouses(pendingWarehouses); setSelectedDays(pendingDays); closeMobileFilter(); };
  const closeMobileFilter = () => { setMobileFilterClosing(true); setTimeout(() => { setShowMobileFilter(false); setMobileFilterClosing(false); }, 300); };

  // Stats calculations
  const statsSummary = {
    totalCustomers: data.length,
    criticalExpiry: data.filter(item => item.so_ngay_chua_phat_sinh > 90).length,
    avgExpiry: data.length > 0 ? Math.round(data.reduce((sum, item) => sum + (item.so_ngay_chua_phat_sinh || 0), 0) / data.length) : 0,
    maxExpiry: data.length > 0 ? Math.max(...data.map(item => item.so_ngay_chua_phat_sinh || 0)) : 0
  };

  const getExpiryBracketStats = () => {
    const brackets = [
      { name: '30-60 ngày', count: data.filter(d => d.so_ngay_chua_phat_sinh >= 30 && d.so_ngay_chua_phat_sinh < 60).length },
      { name: '60-90 ngày', count: data.filter(d => d.so_ngay_chua_phat_sinh >= 60 && d.so_ngay_chua_phat_sinh < 90).length },
      { name: '90+ ngày', count: data.filter(d => d.so_ngay_chua_phat_sinh >= 90).length }
    ];
    return brackets;
  };

  const getWarehouseStats = () => {
    const stats = {};
    data.forEach(item => {
      const warehouse = item.kho || 'Không xác định';
      stats[warehouse] = (stats[warehouse] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const chartColors = ['#F59E0B', '#EF4444', '#8B5CF6', '#2563EB', '#10B981', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'];

  const hasActiveFilters = selectedWarehouses.length > 0 || selectedDays.length > 0;
  const totalActiveFilters = selectedWarehouses.length + selectedDays.length;

  const filterSections = useMemo(() => [
    { id: 'warehouses', label: 'Kho quản lý', icon: <MapPin size={16} />, options: warehouseOptions, selectedValues: pendingWarehouses, onSelectionChange: setPendingWarehouses },
    { id: 'days', label: 'Thời gian quá hạn', icon: <Clock size={16} />, options: dayOptions, selectedValues: pendingDays, onSelectionChange: setPendingDays }
  ], [warehouseOptions, dayOptions, pendingWarehouses, pendingDays]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
      {/* Top Tabs */}
      {/* View Switcher (Mobile Only) */}
      <div className="flex md:hidden items-center p-1 bg-white border border-border rounded-xl mb-4 shadow-sm">
          <button
              onClick={() => setActiveView('list')}
              className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold transition-all",
                  activeView === 'list' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted-foreground"
              )}
          >
              <List size={16} /> Danh sách
          </button>
          <button
              onClick={() => setActiveView('stats')}
              className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold transition-all",
                  activeView === 'stats' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-muted-foreground"
              )}
          >
              <BarChart2 size={16} /> Thống kê
          </button>
      </div>

      {/* Desktop-only View Switcher */}
      <div className="hidden md:flex items-center gap-1 mb-6">
          <button
              onClick={() => setActiveView('list')}
              className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                  activeView === 'list' ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              )}
          >
              <List size={14} /> Danh sách
          </button>
          <button
              onClick={() => setActiveView('stats')}
              className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                  activeView === 'stats' ? "bg-white text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              )}
          >
              <BarChart2 size={14} /> Thống kê
          </button>
      </div>

      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
          {/* MOBILE TOOLBAR */}
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input type="text" placeholder="Tìm khách hàng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
            </div>
            <button onClick={openMobileFilter} className={clsx('relative p-2 rounded-xl border shrink-0 transition-all', hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground')}><Filter size={18} />{hasActiveFilters && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{totalActiveFilters}</span>}</button>
            <button onClick={handleExport} className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-md shadow-emerald-600/20"><Download size={18} /></button>
          </div>

          {/* DESKTOP TOOLBAR */}
          <div className="hidden md:block p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"><ChevronLeft size={16} /> Quay lại</button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input type="text" placeholder="Tìm khách hàng . . ." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
                </div>
              </div>
              <div className="flex items-center gap-2" ref={columnPickerRef}>
                <div className="relative">
                  <button
                    onClick={() => setShowColumnPicker(!showColumnPicker)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-light transition-all",
                      showColumnPicker ? "bg-primary/5 border-primary text-primary" : "bg-white border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
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
              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass(selectedWarehouses.length > 0, 'blue'))}>
                  <MapPin size={14} className={getFilterIconClass(selectedWarehouses.length > 0, 'blue')} /> Kho {selectedWarehouses.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('blue'))}>{selectedWarehouses.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'warehouses' && <FilterDropdown options={warehouseOptions} selected={selectedWarehouses} setSelected={setSelectedWarehouses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'days' ? null : 'days'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass(selectedDays.length > 0, 'amber'))}>
                  <Clock size={14} className={getFilterIconClass(selectedDays.length > 0, 'amber')} /> Thời gian quá hạn {selectedDays.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('amber'))}>{selectedDays.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'days' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'days' && <FilterDropdown options={dayOptions} selected={selectedDays} setSelected={setSelectedDays} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); setSelectedDays([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block flex-1 overflow-x-auto bg-white">
            <table className="w-full border-collapse">
              <thead className="bg-[#F1F5FF]">
                <tr>
                  <th className="px-4 py-3.5 w-10 sticky left-0 bg-[#F1F5FF] z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.length === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} /></div></th>
                  {visibleTableColumns.map(col => (
                    <th key={col.key} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide", col.key === 'so_ngay_chua_phat_sinh' ? "text-right" : "text-left")}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {loading ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Đang tải dữ liệu...</td></tr>) : filteredData.length === 0 ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Không tìm thấy dữ liệu</td></tr>) : (
                  filteredData.map((item, index) => (
                    <tr key={index} className={clsx("group transition-all hover:bg-blue-50/40", selectedIds.includes(index) && "bg-blue-50/60")}>
                      <td className="px-4 py-4 sticky left-0 bg-white group-hover:bg-blue-50/40 z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes(index)} onChange={() => toggleSelect(index)} /></div></td>
                      {columnOrder.filter(isColumnVisible).map(colKey => {
                        if (colKey === 'ten_khach_hang') return <td key={colKey} className="px-4 py-4 font-bold text-foreground text-[13px]">{item.ten_khach_hang}</td>;
                        if (colKey === 'kho') return <td key={colKey} className="px-4 py-4 text-[13px] text-muted-foreground font-medium">{item.kho || '-'}</td>;
                        if (colKey === 'nhan_vien_kinh_doanh') return <td key={colKey} className="px-4 py-4 text-[13px] text-muted-foreground">{item.nhan_vien_kinh_doanh || '-'}</td>;
                        if (colKey === 'binh_ton') return <td key={colKey} className="px-4 py-4 text-[13px] text-center font-bold text-amber-600">{item.binh_ton || 0}</td>;
                        if (colKey === 'may_dang_su_dung') return <td key={colKey} className="px-4 py-4 text-[13px] text-center font-bold text-blue-600">{item.may_dang_su_dung || 0}</td>;
                        if (colKey === 'danh_sach_binh') return (
                          <td key={colKey} className="px-4 py-4 text-[12px] text-muted-foreground max-w-[200px]">
                            <div className="line-clamp-2" title={item.danh_sach_binh}>{item.danh_sach_binh || '-'}</div>
                          </td>
                        );
                        if (colKey === 'danh_sach_may') return (
                          <td key={colKey} className="px-4 py-4 text-[12px] text-muted-foreground max-w-[200px]">
                            <div className="line-clamp-2" title={item.danh_sach_may}>{item.danh_sach_may || '-'}</div>
                          </td>
                        );
                        if (colKey === 'ngay_dat_hang_gan_nhat') return <td key={colKey} className="px-4 py-4 text-[13px] text-muted-foreground">{item.ngay_dat_hang_gan_nhat || 'Chưa đặt'}</td>;
                        if (colKey === 'so_ngay_chua_phat_sinh') return (
                          <td key={colKey} className="px-4 py-4 text-right">
                            <span className={clsx(
                              "px-2 py-0.5 rounded text-[11px] font-bold uppercase",
                              item.so_ngay_chua_phat_sinh > 90 ? "bg-red-50 text-red-600 border border-red-100" :
                              item.so_ngay_chua_phat_sinh > 60 ? "bg-orange-50 text-orange-600 border border-orange-100" :
                              "bg-amber-50 text-amber-600 border border-amber-100"
                            )}>
                              {item.so_ngay_chua_phat_sinh} ngày
                            </span>
                          </td>
                        );
                        if (colKey === 'ma_don_gan_nhat') return <td key={colKey} className="px-4 py-4 text-[13px] text-primary hover:underline cursor-pointer">{item.ma_don_gan_nhat || '-'}</td>;
                        return null;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE LIST */}
          <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-muted/5">
            {loading ? (<div className="py-16 text-center italic text-muted-foreground">Đang tải...</div>) : filteredData.length === 0 ? (<div className="py-16 text-center italic text-muted-foreground">Không tìm thấy dữ liệu</div>) : (
              filteredData.map((item, index) => (
                <div key={index} className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes(index)} onChange={() => toggleSelect(index)} />
                      <span className="text-[12px] font-bold text-muted-foreground uppercase">{item.kho}</span>
                    </div>
                    <span className={clsx(
                      "px-2 py-0.5 rounded text-[10px] font-bold",
                      item.so_ngay_chua_phat_sinh > 90 ? "bg-red-50 text-red-600" :
                      item.so_ngay_chua_phat_sinh > 60 ? "bg-orange-50 text-orange-600" :
                      "bg-amber-50 text-amber-600"
                    )}>
                      {item.so_ngay_chua_phat_sinh} ngày
                    </span>
                  </div>
                  <h3 className="text-[14px] font-bold text-foreground mb-3">{item.ten_khach_hang}</h3>
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground pt-2 border-t border-border/60">
                    <div className="flex items-center gap-1"><Calendar size={13} />{item.ngay_dat_hang_gan_nhat || 'Chưa đặt'}</div>
                    <div className="text-primary font-medium">{item.ma_don_gan_nhat || '-'}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* FOOTER */}
          <div className="px-4 py-4 border-t border-border flex items-center justify-between bg-muted/5 rounded-b-2xl">
            <span className="text-[12px] text-muted-foreground font-medium">Tổng {filteredData.length} KH quá hạn</span>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronLeft size={16} /></button>
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold">1</div>
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'stats' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
          {/* Header */}
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê quá hạn</h2>
            <button onClick={openMobileFilter} className={clsx('relative p-2 rounded-xl border shrink-0 transition-all', hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground')}><Filter size={18} />{hasActiveFilters && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{totalActiveFilters}</span>}</button>
          </div>

          <div className="hidden md:block p-4 border-b border-border" ref={statsDropdownRef}>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"><ChevronLeft size={16} /> Quay lại</button>
              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'warehouses_stats' ? null : 'warehouses_stats'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass(selectedWarehouses.length > 0, 'blue'))}>
                  <MapPin size={14} className={getFilterIconClass(selectedWarehouses.length > 0, 'blue')} /> Kho {selectedWarehouses.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('blue'))}>{selectedWarehouses.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses_stats' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'warehouses_stats' && <FilterDropdown options={warehouseOptions} selected={selectedWarehouses} setSelected={setSelectedWarehouses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'days_stats' ? null : 'days_stats'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass(selectedDays.length > 0, 'amber'))}>
                  <Clock size={14} className={getFilterIconClass(selectedDays.length > 0, 'amber')} /> Thời gian quá hạn {selectedDays.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('amber'))}>{selectedDays.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'days_stats' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'days_stats' && <FilterDropdown options={dayOptions} selected={selectedDays} setSelected={setSelectedDays} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); setSelectedDays([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
            </div>
          </div>

          <div className="w-full p-4 md:p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-red-50/70 border border-red-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-red-200/70">
                    <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-red-600 uppercase tracking-wider">Nguy cấp (&gt;90n)</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(statsSummary.criticalExpiry)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                    <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Trung bình</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{statsSummary.avgExpiry} <span className="text-sm font-normal text-muted-foreground">ngày</span></p>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Cao nhất</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{statsSummary.maxExpiry} <span className="text-sm font-normal text-muted-foreground">ngày</span></p>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                    <Building className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tổng khách quá hạn</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(statsSummary.totalCustomers)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Mức độ quá hạn</h3>
                <div style={{ height: '300px' }}>
                  <PieChartJS
                    data={{
                      labels: getExpiryBracketStats().map(i => i.name),
                      datasets: [{
                        data: getExpiryBracketStats().map(i => i.count),
                        backgroundColor: ['#F59E0B', '#F97316', '#EF4444'],
                        borderColor: '#fff',
                        borderWidth: 2
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } }
                    }}
                  />
                </div>
              </div>
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Kho nhiều khách quá hạn</h3>
                <div style={{ height: '300px' }}>
                  <BarChartJS
                    data={{
                      labels: getWarehouseStats().slice(0, 10).map(i => i.name),
                      datasets: [{
                        label: 'Số khách',
                        data: getWarehouseStats().slice(0, 10).map(i => i.value),
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderRadius: 8,
                        barThickness: 20
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <MobileFilterSheet isOpen={showMobileFilter} isClosing={mobileFilterClosing} onClose={closeMobileFilter} onApply={applyMobileFilter} title="Lọc khách quá hạn" sections={filterSections} hasActiveFilters={hasActiveFilters} totalActiveFilters={totalActiveFilters} />
    </div>
  );
};

export default CustomerExpiryReport;

