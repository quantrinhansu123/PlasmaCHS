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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  List,
  MapPin,
  Search,
  SlidersHorizontal, Users,
  X,
  TrendingUp,
  ArrowUpRight,
  User,
  Phone,
  Package,
} from 'lucide-react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useReports } from '../hooks/useReports';
import { exportSalespersonReport } from '../utils/exportExcel';
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
  ten_nhan_vien: { label: 'Tên Nhân Viên' },
  so_dien_thoai: { label: 'Số Điện Thoại' },
  tong_khach_hang: { label: 'Tổng KH' },
  don_xuat_ban: { label: 'Đơn Bán' },
  binh_ban: { label: 'Bình Bán' },
  binh_demo: { label: 'Bình Demo' },
  binh_thu_hoi: { label: 'Bình Thu Hồi' },
  may_ban: { label: 'Máy Bán' },
  may_dang_su_dung: { label: 'Máy Đang Dùng' }
};

const defaultColOrder = Object.keys(COLUMN_DEFS);

const SalespersonReport = () => {
  const navigate = useNavigate();
  const { fetchSalespersonStats, fetchFilterOptions, loading } = useReports();
  const [activeView, setActiveView] = useState('list');
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination State (Client-side for this report)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [selectedWarehouses, setSelectedWarehouses] = useState([]);

  const [filterOptions, setFilterOptions] = useState({
    warehouses: []
  });

  // Column visibility & Order
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_salesperson_report') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('columns_salesperson_report_order') || 'null');
      if (Array.isArray(saved) && saved.length > 0) return saved.filter(k => defaultColOrder.includes(k));
    } catch { }
    return defaultColOrder;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnPickerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('columns_salesperson_report', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('columns_salesperson_report_order', JSON.stringify(columnOrder));
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

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedWarehouses]);

  const loadData = async () => {
    const filters = {
      warehouse_id: selectedWarehouses.length > 0 ? selectedWarehouses[0] : ''
    };
    const result = await fetchSalespersonStats(filters);
    setData(result || []);
  };

  const loadFilterOptions = async () => {
    const options = await fetchFilterOptions();
    setFilterOptions({
      warehouses: options.warehouses || []
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

  const handleExport = () => {
    const dataToExport = selectedIds.length > 0
      ? filteredData.filter((_, index) => selectedIds.includes(index))
      : filteredData;

    if (dataToExport.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }
    exportSalespersonReport(dataToExport);
  };

  const filteredData = data.filter(item =>
    item.ten_nhan_vien?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.so_dien_thoai?.includes(searchTerm)
  );

  const totalRecords = filteredData.length;
  const paginatedData = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize;
    return filteredData.slice(from, to);
  }, [filteredData, currentPage, pageSize]);

  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getFilterButtonClass = (filterKey, isActive) => {
    if (!isActive) return 'border-border bg-white text-muted-foreground hover:text-foreground';
    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  const getFilterIconClass = (filterKey, isActive) => {
    return isActive ? 'text-blue-700' : 'text-blue-500';
  };

  const getFilterCountBadgeClass = (filterKey) => 'bg-blue-600 text-white';

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
  const openMobileFilter = () => { setPendingWarehouses(selectedWarehouses); setShowMobileFilter(true); };
  const applyMobileFilter = () => { setSelectedWarehouses(pendingWarehouses); closeMobileFilter(); };
  const closeMobileFilter = () => { setMobileFilterClosing(true); setTimeout(() => { setShowMobileFilter(false); setMobileFilterClosing(false); }, 300); };

  // Stats calculations
  const stats_summary = {
    totalSalespersons: filteredData.length,
    totalCustomers: filteredData.reduce((sum, item) => sum + (item.tong_khach_hang || 0), 0),
    totalBan: filteredData.reduce((sum, item) => sum + (item.binh_ban || 0), 0),
    totalDemo: filteredData.reduce((sum, item) => sum + (item.binh_demo || 0), 0),
    totalMayBan: filteredData.reduce((sum, item) => sum + (item.may_ban || 0), 0),
  };

  const getWarehouseStats = () => {
    const stats = {};
    filteredData.forEach(item => {
      const warehouse = item.kho || 'Không xác định';
      stats[warehouse] = (stats[warehouse] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  };

  const getTopPerformanceStats = () => {
    return [...filteredData]
      .sort((a, b) => (b.binh_ban || 0) - (a.binh_ban || 0))
      .slice(0, 10);
  };

  const chartColors = [
    '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
  ];

  const warehouseOptions = useMemo(() => filterOptions.warehouses.map(w => ({ id: w.id, label: w.name, count: data.filter(d => d.warehouse_id === w.id).length })), [filterOptions.warehouses, data]);

  const hasActiveFilters = selectedWarehouses.length > 0;
  const totalActiveFilters = selectedWarehouses.length;

  const filterSections = useMemo(() => [
    { id: 'warehouses', label: 'Kho quản lý', icon: <MapPin size={16} />, options: warehouseOptions, selectedValues: pendingWarehouses, onSelectionChange: setPendingWarehouses }
  ], [warehouseOptions, pendingWarehouses]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
      {/* Top Tabs */}
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
            searchPlaceholder="Tìm kiếm nhân viên..."
            onFilterClick={openMobileFilter}
            hasActiveFilters={hasActiveFilters}
            totalActiveFilters={totalActiveFilters}
            actions={
              <button
                onClick={handleExport}
                className="p-2 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
                title="Xuất Excel báo cáo"
              >
                <Download size={20} />
              </button>
            }
            selectionBar={
              selectedIds.length > 0 ? (
                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <span className="text-[13px] font-bold text-slate-600">
                    Đã chọn <span className="text-primary">{selectedIds.length}</span> nhân viên
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="text-[12px] font-bold text-primary hover:underline px-2 py-1"
                    >
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
                  <input type="text" placeholder="Tìm kiếm nhân viên . . ." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium" />
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
              {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block flex-1 overflow-x-auto bg-white">
            <table className="w-full border-collapse">
              <thead className="bg-[#F1F5FF]">
                <tr>
                  <th className="px-4 py-3.5 w-10 sticky left-0 bg-[#F1F5FF] z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.length === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} /></div></th>
                  {visibleTableColumns.map(col => (
                    <th key={col.key} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide", col.key.includes('tong') || col.key.includes('don') || col.key.includes('binh') ? "text-right" : "text-left")}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {loading ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Đang tải dữ liệu...</td></tr>) : paginatedData.length === 0 ? (<tr><td colSpan={visibleColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground italic">Không tìm thấy dữ liệu</td></tr>) : (
                  paginatedData.map((item, index) => (
                    <tr key={index} className={clsx("group transition-all hover:bg-blue-50/40", selectedIds.includes((currentPage - 1) * pageSize + index) && "bg-blue-50/60")}>
                      <td className="px-4 py-4 sticky left-0 bg-white group-hover:bg-blue-50/40 z-10"><div className="flex items-center justify-center"><input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes((currentPage - 1) * pageSize + index)} onChange={() => toggleSelect((currentPage - 1) * pageSize + index)} /></div></td>
                      {columnOrder.filter(isColumnVisible).map(colKey => {
                        if (colKey === 'ten_nhan_vien') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] font-bold text-foreground">{item.ten_nhan_vien}</span></td>;
                        if (colKey === 'so_dien_thoai') return <td key={colKey} className="px-4 py-4"><span className="text-[13px] text-muted-foreground font-medium">{item.so_dien_thoai || '-'}</span></td>;
                        if (colKey === 'tong_khach_hang') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-primary">{formatNumber(item.tong_khach_hang)}</span></td>;
                        if (colKey === 'don_xuat_ban') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-blue-600">{formatNumber(item.don_xuat_ban)}</span></td>;
                        if (colKey === 'binh_ban') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-emerald-600">{formatNumber(item.binh_ban)}</span></td>;
                        if (colKey === 'binh_demo') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-orange-600">{formatNumber(item.binh_demo)}</span></td>;
                        if (colKey === 'binh_thu_hoi') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-violet-600">{formatNumber(item.binh_thu_hoi)}</span></td>;
                        if (colKey === 'may_ban') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-rose-600">{formatNumber(item.may_ban)}</span></td>;
                        if (colKey === 'may_dang_su_dung') return <td key={colKey} className="px-4 py-4 text-right"><span className="text-[13px] font-bold text-indigo-600">{formatNumber(item.may_dang_su_dung)}</span></td>;
                        return null;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-muted/5">
            {loading ? (<div className="py-16 text-center italic text-muted-foreground">Đang tải...</div>) : paginatedData.length === 0 ? (<div className="py-16 text-center italic text-muted-foreground">Không tìm thấy dữ liệu</div>) : (
              paginatedData.map((item, index) => {
                const itemIndex = (currentPage - 1) * pageSize + index;
                return (
                  <div key={itemIndex} className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20" checked={selectedIds.includes(itemIndex)} onChange={() => toggleSelect(itemIndex)} />
                        <div className="bg-primary/10 p-2 rounded-xl">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-bold text-foreground leading-tight">{item.ten_nhan_vien}</span>
                          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-muted-foreground/60" />
                            {item.so_dien_thoai || '-'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 flex items-center gap-1.5">
                        <Users size={12} className="text-blue-500" />
                        <span className="text-[11px] font-black">{formatNumber(item.tong_khach_hang)} KH</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 bg-muted/10 rounded-xl p-2.5 border border-border/60">
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Đơn Bán</p>
                        <p className="text-sm font-bold text-blue-600">{formatNumber(item.don_xuat_ban)}</p>
                      </div>
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Bình Bán</p>
                        <p className="text-sm font-bold text-emerald-600">{formatNumber(item.binh_ban)}</p>
                      </div>
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Bình Demo</p>
                        <p className="text-sm font-bold text-orange-600">{formatNumber(item.binh_demo)}</p>
                      </div>
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Bình Thu Hồi</p>
                        <p className="text-sm font-bold text-violet-600">{formatNumber(item.binh_thu_hoi)}</p>
                      </div>
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Máy Bán</p>
                        <p className="text-sm font-bold text-rose-600">{formatNumber(item.may_ban)}</p>
                      </div>
                      <div className="text-center bg-white/50 rounded-lg py-2 border border-border/40">
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mb-0.5 tracking-wider">Máy Đang Dùng</p>
                        <p className="text-sm font-bold text-indigo-600">{formatNumber(item.may_dang_su_dung)}</p>
                      </div>
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
              totalRecords={totalRecords}
            />
          )}

          {/* DESKTOP FOOTER */}
          <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
              <span>{totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'}/Tổng {totalRecords}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
              >
                <ChevronLeft size={16} />
                <ChevronLeft size={16} className="-ml-2.5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">{currentPage}</div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
              >
                <ChevronRight size={16} />
                <ChevronRight size={16} className="-ml-2.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'stats' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
          {/* Header */}
          <div className="space-y-0 text-left">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
              <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
              <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê NVKD</h2>
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
                {hasActiveFilters && <button onClick={() => { setSelectedWarehouses([]); }} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"><X size={14} /> Xóa bộ lọc</button>}
              </div>
            </div>
          </div>

          <div className="w-full p-4 md:p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng Nhân Viên</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalSalespersons)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                    <Package className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Khách Hàng Quản Lý</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalCustomers)}</p>
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
              <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 md:p-5 shadow-sm">
                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-rose-200/70">
                    <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Tổng Máy Bán</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(stats_summary.totalMayBan)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ NVKD theo Kho</h3>
                <div style={{ height: '300px' }}>
                  <PieChartJS
                    data={{
                      labels: getWarehouseStats().map(item => item.name),
                      datasets: [{
                        data: getWarehouseStats().map(item => item.value),
                        backgroundColor: chartColors.slice(0, getWarehouseStats().length),
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
                <h3 className="text-lg font-bold text-foreground mb-4">Top 10 NVKD (Bình Bán)</h3>
                <div style={{ height: '300px' }}>
                  <BarChartJS
                    data={{
                      labels: getTopPerformanceStats().map(item => item.ten_nhan_vien),
                      datasets: [{
                        label: 'Số lượng bình bán',
                        data: getTopPerformanceStats().map(item => item.binh_ban),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 8,
                        barThickness: 20
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, grid: { display: true, color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="bg-white border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-bold text-foreground mb-4">So sánh Bán vs Demo (Toàn bộ)</h3>
                <div style={{ height: '350px' }}>
                  <BarChartJS
                    data={{
                      labels: filteredData.slice(0, 15).map(item => item.ten_nhan_vien),
                      datasets: [
                        {
                          label: 'Bình Bán',
                          data: filteredData.slice(0, 15).map(item => item.binh_ban),
                          backgroundColor: 'rgba(16, 185, 129, 0.8)',
                          borderRadius: 4,
                        },
                        {
                          label: 'Bình Demo',
                          data: filteredData.slice(0, 15).map(item => item.binh_demo),
                          backgroundColor: 'rgba(245, 158, 11, 0.8)',
                          borderRadius: 4,
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'top' } },
                      scales: {
                        y: { beginAtZero: true, grid: { display: true, color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 } } }
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

export default SalespersonReport;
