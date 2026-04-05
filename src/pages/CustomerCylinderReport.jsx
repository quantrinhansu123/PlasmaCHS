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
  PackageMinus,
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
  History,
  ArrowLeft
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar as BarChartJS, Line as LineChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
    month: (new Date().getMonth() + 1).toString(),
    startDate: '',
    endDate: '',
    warehouse: '',
    customer_category: '',
    isDateRange: false
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
  const hasActiveFilters = filters.warehouse !== '' || filters.customer_category !== '';
  const totalActiveFilters = (filters.warehouse ? 1 : 0) + (filters.customer_category ? 1 : 0);

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

  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }
    exportCustomerCylinderReport(filteredData, filters);
  };

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
    },
    {
      id: 'dateRangeToggle',
      label: 'Chế độ xem',
      icon: <SlidersHorizontal size={18} className="text-slate-500" />,
      options: [
        { id: 'monthly', label: 'Theo Tháng' },
        { id: 'custom', label: 'Tùy chọn ngày' }
      ],
      selectedValues: [filters.isDateRange ? 'custom' : 'monthly'],
      onSelectionChange: (val) => setFilters(prev => ({ ...prev, isDateRange: val[0] === 'custom' })),
      singleSelect: true
    },
    ...(filters.isDateRange ? [
      {
        id: 'startDate',
        label: 'Từ ngày',
        icon: <Calendar size={18} className="text-emerald-500" />,
        type: 'date',
        value: filters.startDate,
        onDateChange: (val) => setFilters(prev => ({ ...prev, startDate: val }))
      },
      {
        id: 'endDate',
        label: 'Đến ngày',
        icon: <Calendar size={18} className="text-emerald-500" />,
        type: 'date',
        value: filters.endDate,
        onDateChange: (val) => setFilters(prev => ({ ...prev, endDate: val }))
      }
    ] : [])
  ];

  // Internal FilterButtons component to avoid repetition
  const renderFilterButtons = () => (
    <>
      <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border mr-2 shadow-inner">
        <button 
          onClick={() => setFilters(prev => ({ ...prev, isDateRange: false }))}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            !filters.isDateRange ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Theo Tháng
        </button>
        <button 
          onClick={() => setFilters(prev => ({ ...prev, isDateRange: true }))}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all",
            filters.isDateRange ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tùy chọn ngày
        </button>
      </div>

      {!filters.isDateRange ? (
        <>
          <div className="relative">
            <button
              onClick={() => {
                if (activeDropdown !== 'year') setFilterSearch('');
                setActiveDropdown(activeDropdown === 'year' ? null : 'year');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-[12px] font-bold hover:border-primary/50 transition-all shadow-sm"
            >
              <Calendar size={14} className="text-blue-500" /> Năm {filters.year} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'year' ? "rotate-180" : "")} />
            </button>
            {activeDropdown === 'year' && (
              <FilterDropdown
                options={filterOptions.years.map(y => ({ id: y.toString(), label: `Năm ${y}` }))}
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-[12px] font-bold hover:border-primary/50 transition-all shadow-sm"
            >
              <Calendar size={14} className="text-cyan-500" /> Tháng {filters.month} <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'month' ? "rotate-180" : "")} />
            </button>
            {activeDropdown === 'month' && (
              <FilterDropdown
                options={Array.from({ length: 12 }, (_, i) => ({ id: (i + 1).toString(), label: `Tháng ${i + 1}` }))}
                selected={[filters.month]}
                setSelected={(val) => { setFilters(prev => ({ ...prev, month: val[0] })); setActiveDropdown(null); }}
                filterSearch={filterSearch}
                setFilterSearch={setFilterSearch}
                singleSelect={true}
              />
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm group focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Từ:</span>
            <input 
              type="date" 
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-foreground cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-xl shadow-sm group focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Đến:</span>
            <input 
              type="date" 
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-foreground cursor-pointer"
            />
          </div>
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => {
            if (activeDropdown !== 'warehouse') setFilterSearch('');
            setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse');
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white text-[12px] font-bold hover:border-primary/50 transition-all shadow-sm"
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
    </>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
      <PageViewSwitcher
        activeView={activeView}
        setActiveView={setActiveView}
        views={[
          { id: 'list', label: 'Danh sách', icon: <List size={14} /> },
          { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={14} /> },
        ]}
      />

      <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        {/* TOOLBAR */}
        {activeView === 'list' ? (
          <MobilePageHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchPlaceholder="Tìm khách hàng..."
            onFilterClick={() => setShowMobileFilter(true)}
            hasActiveFilters={hasActiveFilters}
            totalActiveFilters={totalActiveFilters}
            actions={
              <button
                onClick={handleExport}
                className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 active:scale-95 transition-all shadow-sm flex items-center justify-center"
              >
                <Download size={20} />
              </button>
            }
          />
        ) : (
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border glass-header sticky top-0 z-30 rounded-t-2xl bg-white/80 backdrop-blur-md">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 active:scale-95 transition-all shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base font-bold text-slate-800 flex-1 text-center">Thống kê tồn vỏ</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowMobileFilter(true)}
                className={clsx(
                  "relative p-2 rounded-xl border shrink-0 active:scale-95 transition-all shadow-sm",
                  hasActiveFilters ? "bg-primary/5 border-primary/30 text-primary" : "bg-white border-border text-muted-foreground"
                )}
              >
                <Filter size={20} />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-white">
                    {totalActiveFilters}
                  </span>
                )}
              </button>
              <button
                onClick={handleExport}
                className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 active:scale-95 transition-all shadow-sm flex items-center justify-center"
              >
                <Download size={20} />
              </button>
            </div>
          </div>
        )}

        {/* DESKTOP TOOLBAR */}
        <div className="hidden md:block p-3 border-b border-border/50">
          {activeView === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                  >
                    <ArrowLeft size={16} /> Quay lại
                  </button>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm nhanh khách hàng..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={columnPickerRef}>
                    <button
                      onClick={() => setShowColumnPicker(!showColumnPicker)}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm',
                        showColumnPicker ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                      )}
                    >
                      <SlidersHorizontal size={15} />
                      Cột ({visibleColumns.length}/{defaultColOrder.length})
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
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <Download size={18} /> Xuất Excel
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                {renderFilterButtons()}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2" ref={dropdownRef}>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
              >
                <ArrowLeft size={16} /> Quay lại
              </button>
              {renderFilterButtons()}
            </div>
          )}
        </div>

        {activeView === 'list' ? (
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white">
            {/* DESKTOP TABLE */}
            <div className="hidden md:block flex-1 overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-[#F1F5FF] sticky top-0 z-10">
                  <tr>
                    {columnOrder.filter(key => visibleColumns.includes(key)).map(colKey => (
                      <th key={colKey} className={clsx("px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60", colKey.includes('balance') || colKey === 'xuat' || colKey === 'thu_hoi' ? "text-right" : "text-left")}>
                        {COLUMN_DEFS[colKey].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {loading ? (
                    <tr><td colSpan={visibleColumns.length} className="px-4 py-16 text-center text-muted-foreground italic">Đang tải dữ liệu...</td></tr>
                  ) : paginatedData.length === 0 ? (
                    <tr><td colSpan={visibleColumns.length} className="px-4 py-16 text-center text-muted-foreground italic">Không có dữ liệu trong kỳ báo cáo này</td></tr>
                  ) : (
                    paginatedData.map((item, index) => (
                      <tr key={index} className="group hover:bg-blue-50/40 transition-all">
                        {columnOrder.filter(key => visibleColumns.includes(key)).map(colKey => (
                          <td key={colKey} className={clsx("px-4 py-4", colKey.includes('balance') || colKey === 'xuat' || colKey === 'thu_hoi' ? "text-right" : "text-left")}>
                            {colKey === 'customer_name' ? (
                              <span className="text-[13px] font-bold text-foreground">{item.customer_name}</span>
                            ) : colKey === 'loai_khach' ? (
                              <span className={getCategoryBadgeClass(item.loai_khach)}>{getLabel(CUSTOMER_CATEGORIES, item.loai_khach)}</span>
                            ) : colKey === 'kho' ? (
                              <span className="text-[13px] text-muted-foreground">{item.kho || '-'}</span>
                            ) : colKey === 'opening_balance' ? (
                              <span className="text-[13px] font-medium text-slate-500">{formatNumber(item.opening_balance)}</span>
                            ) : colKey === 'xuat' ? (
                              <span className="text-[13px] font-bold text-emerald-600">+{formatNumber(item.xuat)}</span>
                            ) : colKey === 'thu_hoi' ? (
                              <span className="text-[13px] font-bold text-rose-500">-{formatNumber(item.thu_hoi)}</span>
                            ) : colKey === 'closing_balance' ? (
                              <span className="text-[13px] font-bold text-primary">{formatNumber(item.closing_balance)}</span>
                            ) : (
                              <span className="text-[13px] text-foreground">{item[colKey]}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST */}
            <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-muted/5">
              {loading ? (
                <div className="py-20 text-center italic text-muted-foreground animate-pulse">Đang tải dữ liệu...</div>
              ) : paginatedData.length === 0 ? (
                <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-2">
                  <Package size={32} className="text-slate-300 opacity-80" />
                  <span>Không tìm thấy dữ liệu báo cáo bình</span>
                </div>
              ) : (
                paginatedData.map((item, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index;
                  return (
                  <div key={globalIndex} className="rounded-2xl border border-primary/15 bg-white shadow-sm p-4 transition-all duration-200">
                    <div className="flex items-start justify-between gap-2 mb-2 ml-1">
                        <div className="flex gap-3">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{globalIndex + 1}</p>
                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 flex items-center gap-1 font-mono">{item.customer_name}</h3>
                            </div>
                        </div>
                        <span className={clsx(getCategoryBadgeClass(item.loai_khach), "px-2")}>{getLabel(CUSTOMER_CATEGORIES, item.loai_khach)}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <div className="text-center group flex flex-col justify-center border-r border-slate-200/60">
                        <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1 flex justify-center items-center gap-1"><History size={10} className="hidden sm:inline" /> Đầu kỳ</p>
                        <p className="text-[13px] font-black text-slate-600">{formatNumber(item.opening_balance)}</p>
                      </div>
                      <div className="text-center flex flex-col justify-center border-r border-slate-200/60">
                        <p className="text-[9px] font-bold uppercase text-emerald-500/80 tracking-wider mb-1 flex justify-center items-center gap-1"><PackagePlus size={10} className="hidden sm:inline" /> Nhập</p>
                        <p className="text-[13px] font-black text-emerald-600">+{formatNumber(item.xuat)}</p>
                      </div>
                      <div className="text-center flex flex-col justify-center border-r border-slate-200/60">
                        <p className="text-[9px] font-bold uppercase text-rose-500/80 tracking-wider mb-1 flex justify-center items-center gap-1"><PackageMinus size={10} className="hidden sm:inline" /> Thu</p>
                        <p className="text-[13px] font-black text-rose-500">-{formatNumber(item.thu_hoi)}</p>
                      </div>
                      <div className="text-center flex flex-col justify-center">
                        <p className="text-[9px] font-bold uppercase text-primary tracking-wider mb-1 flex justify-center items-center gap-1"><PackageCheck size={10} className="hidden sm:inline" /> Cuối kỳ</p>
                        <p className="text-[13px] font-black text-primary">{formatNumber(item.closing_balance)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3 pl-1 text-[12px] text-muted-foreground">
                        <MapPin size={13} className="text-blue-500" />
                        <span className="font-bold flex-1 text-slate-700">{item.kho || 'Chưa rõ kho'}</span>
                    </div>
                  </div>
                );
                })
              )}
            </div>

            {/* Pagination / Footer */}
            <div className="block md:hidden border-t border-border mt-auto">
              <MobilePagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalRecords={filteredData.length}
                pageSize={pageSize}
                setPageSize={setPageSize}
              />
            </div>

            {/* FOOTER Desktop*/}
            <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5 mt-auto">
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
        ) : (
          /* STATS VIEW */
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/30">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard icon={<History />} label="Tổng tồn đầu" value={stats_summary.totalOpening} color="blue" />
              <SummaryCard icon={<PackagePlus />} label="Tổng nhập vỏ" value={stats_summary.totalXuat} color="emerald" />
              <SummaryCard icon={<PackageMinus />} label="Tổng thu vỏ" value={stats_summary.totalThuHoi} color="rose" />
              <SummaryCard icon={<PackageCheck />} label="Tổng tồn cuối" value={stats_summary.totalClosing} color="indigo" />
            </div>

            <div className="bg-white border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-1">Top 10 Khách hàng giữ bình</h3>
                  <p className="text-[12px] text-muted-foreground font-medium italic">Thống kê theo số lượng tồn cuối lớn nhất</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-xl text-primary text-[11px] font-bold uppercase tracking-tight border border-primary/20">
                  <TrendingUp size={14} /> Tăng trưởng dữ liệu
                </div>
              </div>
              <div style={{ height: '400px' }}>
                <BarChartJS
                  data={getChartData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        displayColors: false,
                        boxPadding: 6
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                        ticks: { font: { size: 12, weight: 'medium' }, color: '#64748b' }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: 'bold' }, color: '#64748b' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <MobileFilterSheet
        isOpen={showMobileFilter}
        isClosing={mobileFilterClosing}
        onClose={() => setShowMobileFilter(false)}
        onApply={() => setShowMobileFilter(false)}
        title="Lọc báo cáo tồn bình vỏ"
        sections={filterSections}
      />
    </div>
  );
};

const SummaryCard = ({ icon, label, value, color }) => {
  const colorStyles = {
    blue: { bg: 'bg-blue-50/70', border: 'border-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-100/80', ring: 'ring-blue-200/70' },
    emerald: { bg: 'bg-green-50/70', border: 'border-green-100', text: 'text-green-600', iconBg: 'bg-green-100/80', ring: 'ring-green-200/70' },
    rose: { bg: 'bg-rose-50/70', border: 'border-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100/80', ring: 'ring-rose-200/70' },
    indigo: { bg: 'bg-indigo-50/70', border: 'border-indigo-100', text: 'text-indigo-600', iconBg: 'bg-indigo-100/80', ring: 'ring-indigo-200/70' },
    amber: { bg: 'bg-amber-50/70', border: 'border-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100/80', ring: 'ring-amber-200/70' }
  };
  
  const style = colorStyles[color] || colorStyles.blue;
  
  return (
    <div className={clsx("border rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:shadow-md", style.bg, style.border)}>
      <div className="flex flex-col md:flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
        <div className={clsx("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ring-1 transition-transform group-hover:scale-110", style.iconBg, style.ring)}>
          {React.cloneElement(icon, { className: clsx("w-5 h-5 md:w-6 md:h-6", style.text) })}
        </div>
        <div>
          <p className={clsx("text-[10px] md:text-[11px] font-bold uppercase tracking-wider mb-0.5 md:mb-1", style.text)}>{label}</p>
          <p className="text-2xl md:text-3xl font-black text-slate-800 leading-none">{value.toLocaleString('vi-VN')}</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerCylinderReport;
