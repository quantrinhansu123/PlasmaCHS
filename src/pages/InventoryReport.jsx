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
    ChevronLeft,
    ChevronRight,
    Download,
    List,
    Package,
    Search,
    SlidersHorizontal,
    Warehouse,
    X,
    ChevronDown,
    Calendar,
    Filter,
    ArrowLeft,
    User
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import { supabase } from '../supabase/config';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';

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

const TABLE_COLUMNS_DEF = [
    { key: 'warehouse_name', label: 'Kho' },
    { key: 'item_type', label: 'Loại' },
    { key: 'item_name', label: 'Tên hàng hóa' },
    { key: 'quantity', label: 'Số lượng' },
    { key: 'updated_at', label: 'Cập nhật cuối' }
];

const InventoryReport = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);
    const [pendingTypes, setPendingTypes] = useState([]);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Columns state
    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = TABLE_COLUMNS_DEF.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_inventory_order') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                const valid = saved.filter(key => defaultColOrder.includes(key));
                const missing = defaultColOrder.filter(key => !valid.includes(key));
                return [...valid, ...missing];
            }
        } catch { }
        return defaultColOrder;
    });

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_inventory') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    useEffect(() => {
        fetchInventory();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        localStorage.setItem('columns_inventory', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_inventory_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const userBranch = (role !== 'Admin' && department) 
                ? (department.includes('-') ? department.split('-')[0].trim() : department.trim())
                : null;

            // 1. Fetch Materials (VAT_TU) from inventory table
            let invQuery = supabase
                .from('inventory')
                .select('*')
                .eq('item_type', 'VAT_TU')
                .gt('quantity', 0);
            
            if (userBranch) {
                // Determine warehouse IDs for this branch (for cylinders and materials if they use UUIDs)
                const { data: whs } = await supabase.from('warehouses').select('id').ilike('name', `%${userBranch}%`);
                const whIds = whs?.map(w => w.id) || [];
                if (whIds.length > 0) {
                    invQuery = invQuery.in('warehouse_id', whIds);
                }
            }
            const { data: invData, error: invError } = await invQuery;
            if (invError) throw invError;

            // 2. Fetch Machines counts grouped by warehouse and type
            let machQuery = supabase
                .from('machines')
                .select('warehouse, machine_type, status')
                .eq('status', 'sẵn sàng');
            
            if (userBranch) {
                machQuery = machQuery.ilike('warehouse', `%${userBranch}%`);
            }
            const { data: machData, error: machError } = await machQuery;
            if (machError) throw machError;

            // 3. Fetch Cylinders counts grouped by warehouse and volume
            let cylQuery = supabase
                .from('cylinders')
                .select('warehouse_id, volume, status')
                .eq('status', 'sẵn sàng');
            
            if (userBranch) {
                const { data: whs } = await supabase.from('warehouses').select('id').ilike('name', `%${userBranch}%`);
                const whIds = whs?.map(w => w.id) || [];
                if (whIds.length > 0) {
                    cylQuery = cylQuery.in('warehouse_id', whIds);
                }
            }
            const { data: cylData, error: cylError } = await cylQuery;
            if (cylError) throw cylError;

            // Process Machine real-time records
            const machRows = [];
            const machGroups = (machData || []).reduce((acc, m) => {
                const key = `${m.warehouse}-${m.machine_type}`;
                if (!acc[key]) acc[key] = { warehouse_id: m.warehouse, name: `Máy ${m.machine_type}`, qty: 0 };
                acc[key].qty++;
                return acc;
            }, {});
            
            Object.values(machGroups).forEach(g => {
                machRows.push({
                    id: `mach-${g.warehouse_id}-${g.name}`,
                    warehouse_id: g.warehouse_id,
                    item_type: 'MAY',
                    item_name: g.name,
                    quantity: g.qty,
                    updated_at: new Date().toISOString()
                });
            });

            // Process Cylinder real-time records
            const cylRows = [];
            const cylGroups = (cylData || []).reduce((acc, c) => {
                const key = `${c.warehouse_id}-${c.volume}`;
                if (!acc[key]) acc[key] = { warehouse_id: c.warehouse_id, name: `Bình ${c.volume || 'khác'}`, qty: 0 };
                acc[key].qty++;
                return acc;
            }, {});

            Object.values(cylGroups).forEach(g => {
                cylRows.push({
                    id: `cyl-${g.warehouse_id}-${g.name}`,
                    warehouse_id: g.warehouse_id,
                    item_type: 'BINH',
                    item_name: g.name,
                    quantity: g.qty,
                    updated_at: new Date().toISOString()
                });
            });

            // Combine all
            const unifiedInventory = [
                ...(invData || []),
                ...machRows,
                ...cylRows
            ];

            setInventory(unifiedInventory);
        } catch (error) {
            console.error('Error fetching real inventory report:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name');
        if (data) setWarehouses(data);
    };

    const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || id;

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(item.warehouse_id);
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.item_type);
        return matchesSearch && matchesWarehouse && matchesType;
    });

    const totalRecords = filteredInventory.length;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedInventory = filteredInventory.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedWarehouses, selectedTypes]);

    const exportToExcel = () => {
        const data = filteredInventory.map(item => ({
            'Kho': getWarehouseName(item.warehouse_id),
            'Loại': item.item_type,
            'Tên hàng': item.item_name,
            'Số lượng': item.quantity,
            'Cập nhật cuối': new Date(item.updated_at).toLocaleString('vi-VN')
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TonKho');
        XLSX.writeFile(wb, `Bao_cao_ton_kho_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getTypeStats = () => {
        const stats = {};
        filteredInventory.forEach(item => {
            stats[item.item_type] = (stats[item.item_type] || 0) + item.quantity;
        });
        return {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
                borderWidth: 0,
            }]
        };
    };

    const getWarehouseStats = () => {
        const stats = {};
        filteredInventory.forEach(item => {
            const name = getWarehouseName(item.warehouse_id);
            stats[name] = (stats[name] || 0) + item.quantity;
        });
        return {
            labels: Object.keys(stats),
            datasets: [{
                label: 'Số lượng hàng hóa',
                data: Object.values(stats),
                backgroundColor: '#3B82F6',
                borderRadius: 4,
            }]
        };
    };

    const getItemTypeStyle = (type) => {
        switch (type) {
            case 'MAY': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'BINH': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'VAT_TU': return 'bg-amber-50 text-amber-600 border-amber-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getFilterButtonClass = (isActive) => {
        return isActive
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-white text-muted-foreground hover:bg-muted/20';
    };

    const hasActiveFilters = selectedWarehouses.length > 0 || selectedTypes.length > 0;
    const totalActiveFilters = selectedWarehouses.length + selectedTypes.length;

    const openMobileFilter = () => {
        setPendingWarehouses(selectedWarehouses);
        setPendingTypes(selectedTypes);
        setShowMobileFilter(true);
    };

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 300);
    };

    const applyMobileFilter = () => {
        setSelectedWarehouses(pendingWarehouses);
        setSelectedTypes(pendingTypes);
        closeMobileFilter();
    };

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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm hàng hóa..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        actions={
                            <button
                                onClick={exportToExcel}
                                className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm active:scale-95 transition-all"
                            >
                                <Download size={20} />
                            </button>
                        }
                    />

                    {/* Desktop Header/Filter */}
                    <div className="hidden md:flex flex-col p-4 space-y-4 border-b border-border" ref={dropdownRef}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm hàng hóa..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative" ref={columnPickerRef}>
                                    <button
                                        onClick={() => setShowColumnPicker(prev => !prev)}
                                        className={clsx(
                                            'flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm',
                                            showColumnPicker
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border text-muted-foreground hover:bg-muted/20'
                                        )}
                                    >
                                        <SlidersHorizontal size={16} />
                                        Cột ({visibleColumns.length}/{TABLE_COLUMNS_DEF.length})
                                    </button>
                                    {showColumnPicker && (
                                        <ColumnPicker
                                            columnOrder={columnOrder}
                                            setColumnOrder={setColumnOrder}
                                            visibleColumns={visibleColumns}
                                            setVisibleColumns={setVisibleColumns}
                                            defaultColOrder={defaultColOrder}
                                            columnDefs={columnDefs}
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={exportToExcel}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all"
                                >
                                    <Download size={16} />
                                    Xuất Excel
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass(activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <Warehouse size={14} className={clsx(activeDropdown === 'warehouses' || selectedWarehouses.length > 0 ? "text-primary" : "text-slate-400")} />
                                    Kho hàng
                                    {selectedWarehouses.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'warehouses' && (
                                    <FilterDropdown
                                        options={warehouses.map(w => ({ id: w.id, label: w.name, count: inventory.filter(i => i.warehouse_id === w.id).length }))}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'types' ? null : 'types')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass(activeDropdown === 'types' || selectedTypes.length > 0)
                                    )}
                                >
                                    <Package size={14} className={clsx(activeDropdown === 'types' || selectedTypes.length > 0 ? "text-primary" : "text-slate-400")} />
                                    Loại hàng
                                    {selectedTypes.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                                            {selectedTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'types' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'types' && (
                                    <FilterDropdown
                                        options={[
                                            { id: 'MAY', label: 'Máy', count: inventory.filter(i => i.item_type === 'MAY').length },
                                            { id: 'BINH', label: 'Bình', count: inventory.filter(i => i.item_type === 'BINH').length },
                                            { id: 'VAT_TU', label: 'Vật tư', count: inventory.filter(i => i.item_type === 'VAT_TU').length }
                                        ]}
                                        selected={selectedTypes}
                                        setSelected={setSelectedTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {(selectedWarehouses.length > 0 || selectedTypes.length > 0) && (
                                <button
                                    onClick={() => { setSelectedWarehouses([]); setSelectedTypes([]); }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table / List Content */}
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="h-full flex items-center justify-center p-8">
                                <div className="italic text-muted-foreground text-[13px]">Đang tải dữ liệu...</div>
                            </div>
                        ) : filteredInventory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                    <Search size={32} className="text-muted-foreground/50" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">Không tìm thấy hàng hóa</h3>
                                <p className="text-sm text-muted-foreground mt-1">Hãy thử thay đổi từ khóa hoặc bộ lọc</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile View (Cards) */}
                                <div className="md:hidden flex-1 overflow-y-auto p-3 pb-4 flex flex-col gap-3">
                                    {paginatedInventory.map((item, index) => (
                                        <div key={item.id} className="rounded-2xl border border-primary/15 bg-white shadow-sm p-4 transition-all duration-200">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{startIndex + index + 1} • {getWarehouseName(item.warehouse_id)}</p>
                                                        <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{item.item_name}</h3>
                                                    </div>
                                                </div>
                                                <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0', getItemTypeStyle(item.item_type))}>
                                                    {item.item_type}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                                    <p className="text-[14px] font-black text-blue-600">
                                                        {item.quantity.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Cập nhật</p>
                                                    <p className="text-[12px] text-foreground font-medium">
                                                        {new Date(item.updated_at).toLocaleDateString('vi-VN')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop View (Table) */}
                                <table className="hidden md:table w-full text-left border-collapse min-w-[800px]">
                                    <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                                        <tr>
                                            {columnOrder.filter(key => visibleColumns.includes(key)).map(key => (
                                                <th key={key} className={clsx(
                                                    "px-4 py-3 font-bold text-[13px] uppercase tracking-wider text-slate-500",
                                                    key === 'quantity' && "text-right"
                                                )}>
                                                    {TABLE_COLUMNS_DEF.find(c => c.key === key)?.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {paginatedInventory.map(item => (
                                            <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors group">
                                                {columnOrder.filter(key => visibleColumns.includes(key)).map(key => {
                                                    if (key === 'warehouse_name') {
                                                        return (
                                                            <td key={key} className="px-4 py-4 text-[13px] font-medium text-slate-600">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                                        <Warehouse size={14} />
                                                                    </div>
                                                                    {getWarehouseName(item.warehouse_id)}
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    if (key === 'item_type') {
                                                        return (
                                                            <td key={key} className="px-4 py-4">
                                                                <span className={clsx('inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border', getItemTypeStyle(item.item_type))}>
                                                                    {item.item_type}
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    if (key === 'item_name') {
                                                        return <td key={key} className="px-4 py-4 text-[14px] font-bold text-slate-800">{item.item_name}</td>;
                                                    }
                                                    if (key === 'quantity') {
                                                        return (
                                                            <td key={key} className="px-4 py-4 text-right">
                                                                <span className="text-[15px] font-black text-blue-600">{item.quantity.toLocaleString()}</span>
                                                            </td>
                                                        );
                                                    }
                                                    if (key === 'updated_at') {
                                                        return (
                                                            <td key={key} className="px-4 py-4 text-[13px] text-slate-500">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar size={14} className="opacity-50" />
                                                                    {new Date(item.updated_at).toLocaleString('vi-VN', {
                                                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                                                        hour: '2-digit', minute: '2-digit'
                                                                    })}
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>

                    {!loading && filteredInventory.length > 0 && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}

                    {/* Desktop Footer (Total stats) */}
                    {!loading && filteredInventory.length > 0 && (
                        <div className="hidden md:flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-border">
                            <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                                <span>
                                    {totalRecords > 0 ? `${startIndex + 1}–${Math.min(endIndex, totalRecords)}` : '0'} / Tổng {totalRecords}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setCurrentPage(1)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" 
                                        disabled={currentPage === 1}
                                        title="Trang đầu"
                                    >
                                        <ChevronLeft size={16} />
                                        <ChevronLeft size={16} className="-ml-2.5" />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" 
                                        disabled={currentPage === 1}
                                        title="Trang trước"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                                        {currentPage}
                                    </div>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" 
                                        disabled={currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0}
                                        title="Trang sau"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" 
                                        disabled={currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0}
                                        title="Trang cuối"
                                    >
                                        <ChevronRight size={16} />
                                        <ChevronRight size={16} className="-ml-2.5" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 border-l border-border pl-4">
                                    <div className="text-[13px]">
                                        <span className="text-muted-foreground mr-1">Tổng cộng:</span>
                                        <span className="font-bold text-slate-800">{totalRecords.toLocaleString()} mặt hàng</span>
                                    </div>
                                    <div className="text-[13px]">
                                        <span className="text-muted-foreground mr-1">Tổng số lượng:</span>
                                        <span className="font-bold text-blue-600">
                                            {filteredInventory.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    {/* Stats Header / Filter */}
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê</h2>
                        <button 
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground'
                            )}
                        >
                            <Filter size={18} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="hidden md:flex flex-col p-4 border-b border-border" ref={dropdownRef}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                <button
                                    onClick={() => setActiveView('list')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'warehouses_stats' ? null : 'warehouses_stats')}
                                            className={clsx(
                                                'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all shadow-sm bg-white',
                                                getFilterButtonClass(activeDropdown === 'warehouses_stats' || selectedWarehouses.length > 0)
                                            )}
                                        >
                                            <Warehouse size={14} className={clsx(activeDropdown === 'warehouses_stats' || selectedWarehouses.length > 0 ? "text-primary" : "text-slate-400")} />
                                            Kho hàng
                                            {selectedWarehouses.length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                                                    {selectedWarehouses.length}
                                                </span>
                                            )}
                                            <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses_stats' ? 'rotate-180' : '')} />
                                        </button>
                                        {activeDropdown === 'warehouses_stats' && (
                                            <FilterDropdown
                                                options={warehouses.map(w => ({ id: w.id, label: w.name, count: inventory.filter(i => i.warehouse_id === w.id).length }))}
                                                selected={selectedWarehouses}
                                                setSelected={setSelectedWarehouses}
                                                filterSearch={filterSearch}
                                                setFilterSearch={setFilterSearch}
                                            />
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'types_stats' ? null : 'types_stats')}
                                            className={clsx(
                                                'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all shadow-sm bg-white',
                                                getFilterButtonClass(activeDropdown === 'types_stats' || selectedTypes.length > 0)
                                            )}
                                        >
                                            <Package size={14} className={clsx(activeDropdown === 'types_stats' || selectedTypes.length > 0 ? "text-primary" : "text-slate-400")} />
                                            Loại hàng
                                            {selectedTypes.length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                                                    {selectedTypes.length}
                                                </span>
                                            )}
                                            <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'types_stats' ? 'rotate-180' : '')} />
                                        </button>
                                        {activeDropdown === 'types_stats' && (
                                            <FilterDropdown
                                                options={[
                                                    { id: 'MAY', label: 'Máy', count: inventory.filter(i => i.item_type === 'MAY').length },
                                                    { id: 'BINH', label: 'Bình', count: inventory.filter(i => i.item_type === 'BINH').length },
                                                    { id: 'VAT_TU', label: 'Vật tư', count: inventory.filter(i => i.item_type === 'VAT_TU').length }
                                                ]}
                                                selected={selectedTypes}
                                                setSelected={setSelectedTypes}
                                                filterSearch={filterSearch}
                                                setFilterSearch={setFilterSearch}
                                            />
                                        )}
                                    </div>

                                    {(selectedWarehouses.length > 0 || selectedTypes.length > 0) && (
                                        <button
                                            onClick={() => { setSelectedWarehouses([]); setSelectedTypes([]); }}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all font-inter"
                                        >
                                            <X size={14} />
                                            Xóa bộ lọc
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm col-span-2 lg:col-span-1">
                                <div className="flex flex-row items-center justify-center lg:justify-start text-center lg:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng mặt hàng</p>
                                        <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-0.5 md:mt-1 leading-none">
                                            {filteredInventory.length.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-start text-center lg:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                                        <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tổng số lượng</p>
                                        <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-0.5 md:mt-1 leading-none">
                                            {filteredInventory.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-start text-center lg:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                                        <Warehouse className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Kho chứa hàng</p>
                                        <p className="text-2xl md:text-3xl font-bold text-slate-800 mt-0.5 md:mt-1 leading-none">
                                            {[...new Set(filteredInventory.map(i => i.warehouse_id))].length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center">
                                <h3 className="w-full text-left font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    Tỉ lệ loại hàng hóa
                                </h3>
                                <div className="w-full h-[300px] flex items-center justify-center">
                                    <PieChartJS
                                        data={getTypeStats()}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'bottom',
                                                    labels: {
                                                        usePointStyle: true,
                                                        padding: 20,
                                                        font: { size: 12, weight: '600' }
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col">
                                <h3 className="text-left font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                    Số lượng theo kho
                                </h3>
                                <div className="w-full h-[300px]">
                                    <BarChartJS
                                        data={getWarehouseStats()}
                                        options={{
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    grid: { color: 'rgba(0,0,0,0.05)' }
                                                },
                                                x: {
                                                    grid: { display: false }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    isClosing={mobileFilterClosing}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    sections={[
                        {
                            id: 'warehouses',
                            label: 'Kho hàng',
                            icon: <Warehouse size={16} className="text-blue-600" />,
                            options: warehouses.map(w => ({ 
                                id: w.id, 
                                label: w.name, 
                                count: inventory.filter(i => i.warehouse_id === w.id).length 
                            })),
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses,
                        },
                        {
                            id: 'types',
                            label: 'Loại hàng',
                            icon: <Package size={16} className="text-emerald-600" />,
                            options: [
                                { id: 'MAY', label: 'Máy', count: inventory.filter(i => i.item_type === 'MAY').length },
                                { id: 'BINH', label: 'Bình', count: inventory.filter(i => i.item_type === 'BINH').length },
                                { id: 'VAT_TU', label: 'Vật tư', count: inventory.filter(i => i.item_type === 'VAT_TU').length }
                            ],
                            selectedValues: pendingTypes,
                            onSelectionChange: setPendingTypes,
                        },
                    ]}
                />
            )}
        </div>
    );
};

export default InventoryReport;
