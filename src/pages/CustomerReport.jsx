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
  Package,
  Search,
  SlidersHorizontal, Users,
  X,
  TrendingUp,
  ArrowUpRight,
  Monitor,
} from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportCustomerReport } from '../utils/exportExcel';
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
  ma_khach_hang: { label: 'Mã KH' },
  ten_khach_hang: { label: 'Tên Khách Hàng' },
  loai_khach: { label: 'Loại' },
  kho: { label: 'Kho' },
  may_dang_su_dung: { label: 'Máy SD' },
  binh_ban: { label: 'Bình Bán' },
  binh_demo: { label: 'Bình Demo' },
  nhan_vien_kinh_doanh: { label: 'NVKD' }
};

const defaultColOrder = Object.keys(COLUMN_DEFS);

const CUSTOMER_CATEGORIES = {
  'BV': 'Bệnh viện',
  'TM': 'Thẩm mỹ viện',
  'PK': 'Phòng khám',
  'NG': 'Khách ngoại giao',
  'GD': 'Gia đình',
  'SP': 'Spa / Khác'
};

const CustomerReport = () => {
  const navigate = useNavigate();
  const { fetchCustomerStats, fetchFilterOptions, loading } = useReports();
  const [activeView, setActiveView] = useState('list');
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Filters
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState([]);

  const [filterOptions, setFilterOptions] = useState({
    warehouses: [],
    customerTypes: [],
    categories: []
  });

  // Column visibility & Order
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_customer_report') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_customer_report_order') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('columns_customer_report', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('columns_customer_report_order', JSON.stringify(columnOrder));
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
  const [pendingCustomerTypes, setPendingCustomerTypes] = useState([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedWarehouses, selectedCustomerTypes]);

  const loadData = async () => {
    const filters = {
      warehouse_id: selectedWarehouses.length > 0 ? selectedWarehouses[0] : '',
      customer_type: selectedCustomerTypes.length > 0 ? selectedCustomerTypes[0] : ''
    };
    const result = await fetchCustomerStats(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions({
      warehouses: options.warehouses || [],
      customerTypes: options.customerTypes || [],
      categories: options.categories || []
    });
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

  const handleExport = () => exportCustomerReport(data);

  const filteredData = data.filter(item =>
    item.ten_khach_hang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ma_khach_hang?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getCustomerTypeBadgeClass = (categoryId) => clsx(
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
    categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
    categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
    categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
    categoryId === 'NG' && 'bg-violet-50 text-violet-700 border-violet-200',
    categoryId === 'SP' && 'bg-amber-50 text-amber-700 border-amber-200',
    (!categoryId || categoryId === 'công' || categoryId === 'tư') && 'bg-muted text-muted-foreground border-border'
  );

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
      setSelectedIds(filteredData.map((_, index) => index)); // Using index for this report if ID is not unique
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Mobile filter handlers
  const openMobileFilter = () => { setPendingWarehouses(selectedWarehouses); setPendingCustomerTypes(selectedCustomerTypes); setShowMobileFilter(true); };
  const applyMobileFilter = () => { setSelectedWarehouses(pendingWarehouses); setSelectedCustomerTypes(pendingCustomerTypes); closeMobileFilter(); };
  const closeMobileFilter = () => { setMobileFilterClosing(true); setTimeout(() => { setShowMobileFilter(false); setMobileFilterClosing(false); }, 280); };

  // Stats calculations
  const stats_summary = {
    totalCustomers: filteredData.length,
    totalMachines: filteredData.reduce((sum, item) => sum + (item.may_dang_su_dung || 0), 0),
    totalBan: filteredData.reduce((sum, item) => sum + (item.binh_ban || 0), 0),
    totalDemo: filteredData.reduce((sum, item) => sum + (item.binh_demo || 0), 0),
  };

  const getCategoryStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const cat = item.loai_khach || item.loai_khach_hang || 'Khác';
      const label = CUSTOMER_CATEGORIES[cat] || cat;
      stats[label] = (stats[label] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getWarehouseStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const warehouse = item.kho || 'Không xác định';
      stats[warehouse] = (stats[warehouse] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getSalespersonStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const nvkd = item.nhan_vien_kinh_doanh || 'Không xác định';
      stats[nvkd] = (stats[nvkd] || 0) + 1;
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

  const warehouseOptions = useMemo(() => filterOptions.warehouses.map(w => ({ id: w.id, label: w.name, count: data.filter(d => d.kho === w.id).length })), [filterOptions.warehouses, data]);
  const categoryOptions = useMemo(() => filterOptions.categories.map(c => ({ id: c, label: CUSTOMER_CATEGORIES[c] || c, count: data.filter(d => d.loai_khach === c).length })), [filterOptions.categories, data, CUSTOMER_CATEGORIES]);

  const hasActiveFilters = selectedWarehouses.length > 0 || selectedCustomerTypes.length > 0;
  const totalActiveFilters = selectedWarehouses.length + selectedCustomerTypes.length;

  const filterSections = useMemo(() => [
    { id: 'warehouses', label: 'Kho quản lý', icon: <MapPin size={16} />, options: warehouseOptions, selectedValues: pendingWarehouses, onSelectionChange: setPendingWarehouses },
    { id: 'categories', label: 'Loại khách hàng', icon: <Monitor size={16} />, options: categoryOptions, selectedValues: pendingCustomerTypes, onSelectionChange: setPendingCustomerTypes }
  ], [warehouseOptions, categoryOptions, pendingWarehouses, pendingCustomerTypes]);

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

      {activeView === 'list' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
          {/* MOBILE TOOLBAR */}
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input type="text" placeholder="Tìm kiếm . . ." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-8 py-2 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
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
                  <input type="text" placeholder="Tìm kiếm . . ." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
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
                <button onClick={() => { setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('warehouses', selectedWarehouses.length > 0))}>
                  <MapPin size={14} className={getFilterIconClass('warehouses', selectedWarehouses.length > 0)} /> Kho {selectedWarehouses.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>{selectedWarehouses.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'warehouses' && <FilterDropdown options={warehouseOptions} selected={selectedWarehouses} setSelected={setSelectedWarehouses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              <div className="relative">
                <button onClick={() => { setActiveDropdown(activeDropdown === 'customerTypes' ? null : 'customerTypes'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('customerTypes', selectedCustomerTypes.length > 0))}>
                  <Building size={14} className={getFilterIconClass('customerTypes', selectedCustomerTypes.length > 0)} /> Loại khách {selectedCustomerTypes.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customerTypes'))}>{selectedCustomerTypes.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'customerTypes' ? "rotate-180" : "")} />
                </button>
                {activeDropdown === 'customerTypes' && <FilterDropdown options={categoryOptions} selected={selectedCustomerTypes} setSelected={setSelectedCustomerTypes} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
              </div>
              {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); setSelectedCustomerTypes([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block flex-1 overflow-x-auto bg-white">
            <table className="w-full border-collapse">
              <thead className="bg-[#F1F5FF]">
                <tr>
                  <th className="px-4 py-3.5 w-10 sticky left-0 bg-[#F1F5FF] z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.length === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} /></div></th>
                  {visibleTableColumns.map(col => (
                    <th key={col.key} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide", col.key.includes('may') || col.key.includes('binh') ? "text-right" : "text-left")}>
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
                        if (colKey === 'ma_khach_hang') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-bold text-primary">{item.ma_khach_hang}</span></td>;
                        if (colKey === 'ten_khach_hang') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-bold text-foreground">{item.ten_khach_hang}</span></td>;
                        if (colKey === 'loai_khach') return (
                          <td key={colKey} className="px-4 py-4">
                            <span className={getCustomerTypeBadgeClass(item.loai_khach || item.loai_khach_hang)}>
                              {CUSTOMER_CATEGORIES[item.loai_khach] || item.loai_khach_hang || item.loai_khach || '-'}
                            </span>
                          </td>
                        );
                        if (colKey === 'kho') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] text-muted-foreground font-medium">{item.kho || '-'}</span></td>;
                        if (colKey === 'may_dang_su_dung') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-primary">{formatNumber(item.may_dang_su_dung)}</span></td>;
                        if (colKey === 'binh_ban') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-emerald-600">{formatNumber(item.binh_ban)}</span></td>;
                        if (colKey === 'binh_demo') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-orange-600">{formatNumber(item.binh_demo)}</span></td>;
                        if (colKey === 'nhan_vien_kinh_doanh') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-medium text-foreground">{item.nhan_vien_kinh_doanh || '-'}</span></td>;
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
            {loading ? (<div className="py-16 text-center italic text-muted-foreground">Đ đang tải...</div>) : filteredData.length === 0 ? (<div className="py-16 text-center italic text-muted-foreground">Không tìm thấy dữ liệu</div>) : (
              filteredData.map((item, index) => (
                <div key={index} className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes(index)} onChange={() => toggleSelect(index)} />
                      <span className="text-[12px] font-bold text-muted-foreground uppercase">{item.ma_khach_hang}</span>
                    </div>
                    <span className={getCustomerTypeBadgeClass(item.loai_khach || item.loai_khach_hang)}>
                      {CUSTOMER_CATEGORIES[item.loai_khach] || item.loai_khach_hang || item.loai_khach || '-'}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-bold text-foreground mb-3">{item.ten_khach_hang}</h3>
                  <div className="grid grid-cols-3 gap-2 bg-muted/10 rounded-xl p-2.5 border border-border/60">
                    <div className="text-center"><p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Máy</p><p className="text-sm font-bold text-primary">{formatNumber(item.may_dang_su_dung)}</p></div>
                    <div className="text-center border-x border-border/60"><p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Bán</p><p className="text-sm font-bold text-emerald-600">{formatNumber(item.binh_ban)}</p></div>
                    <div className="text-center"><p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Demo</p><p className="text-sm font-bold text-orange-600">{formatNumber(item.binh_demo)}</p></div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* FOOTER */}
          <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
              <span>{filteredData.length > 0 ? `1–${filteredData.length}` : '0'}/Tổng {filteredData.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronLeft size={16} /><ChevronLeft size={16} className="-ml-2.5" /></button>
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronLeft size={16} /></button>
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold">1</div>
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronRight size={16} /></button>
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronRight size={16} /><ChevronRight size={16} className="-ml-2.5" /></button>
            </div>
          </div>
          <div className="md:hidden px-4 py-3 border-t border-border flex items-center justify-between bg-muted/5">
            <span className="text-[12px] text-muted-foreground font-medium">Tổng {filteredData.length} KH</span>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronLeft size={15} /></button>
              <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center text-[11px] font-bold">1</div>
              <button className="p-1.5 rounded-lg text-muted-foreground opacity-20" disabled><ChevronRight size={15} /></button>
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
              <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê báo cáo</h2>
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
                  <button onClick={() => { setActiveDropdown(activeDropdown === 'categories_stats' ? null : 'categories_stats'); setFilterSearch(''); }} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('customerTypes', selectedCustomerTypes.length > 0))}>
                    <Building size={14} className={getFilterIconClass('customerTypes', selectedCustomerTypes.length > 0)} /> Loại khách {selectedCustomerTypes.length > 0 && <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customerTypes'))}>{selectedCustomerTypes.length}</span>} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'categories_stats' ? "rotate-180" : "")} />
                  </button>
                  {activeDropdown === 'categories_stats' && <FilterDropdown options={categoryOptions} selected={selectedCustomerTypes} setSelected={setSelectedCustomerTypes} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                </div>
                {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); setSelectedCustomerTypes([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
              </div>
            </div>
          </div>

          <div className="w-full p-4 md:p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng Khách Hàng</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalCustomers)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Máy Đang Sử Dụng</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalMachines)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tổng Bình Bán</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalBan)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-orange-200/70">
                    <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Tổng Bình Demo</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalDemo)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại khách</h3>
                <div style={{ height: '300px' }}>
                  <PieChartJS
                    data={{
                      labels: getCategoryStats().map(item => item.name),
                      datasets: [{
                        data: getCategoryStats().map(item => item.value),
                        backgroundColor: chartColors.slice(0, getCategoryStats().length),
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
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } }
                    }}
                  />
                </div>
              </div>

              <div className="bg-white border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Nhân viên kinh doanh</h3>
                <div style={{ height: '350px' }}>
                  <BarChartJS
                    data={{
                      labels: getSalespersonStats().map(item => item.name),
                      datasets: [{
                        label: 'Số lượng khách hàng',
                        data: getSalespersonStats().map(item => item.value),
                        backgroundColor: 'rgba(37, 99, 235, 0.8)',
                        borderRadius: 8,
                        barThickness: 25
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

export default CustomerReport;

