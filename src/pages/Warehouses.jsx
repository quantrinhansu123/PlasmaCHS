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
    Edit,
    Eye,
    Filter,
    List,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    Warehouse,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import WarehouseDetailsModal from '../components/Warehouses/WarehouseDetailsModal';
import WarehouseFormModal from '../components/Warehouses/WarehouseFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { WAREHOUSE_STATUSES } from '../constants/warehouseConstants';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';

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
    { key: 'name', label: 'Tên kho' },
    { key: 'manager_name', label: 'Thủ kho' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'capacity', label: 'Sức chứa' },
    { key: 'status', label: 'Trạng thái' }
];

const Warehouses = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);
    const [uniqueManagers, setUniqueManagers] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingManagers, setPendingManagers] = useState([]);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = TABLE_COLUMNS_DEF.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_warehouses_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_warehouses') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS_DEF.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        const managers = [...new Set(warehouses.map(w => w.manager_name).filter(Boolean))];
        setUniqueManagers(managers);
    }, [warehouses]);

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
        localStorage.setItem('columns_warehouses', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_warehouses_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingManagers(selectedManagers);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedManagers(pendingManagers);
        closeMobileFilter();
    };

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;
            setWarehouses(data || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            alert('❌ Không thể tải danh sách kho hàng: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteWarehouse = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa kho "${name}" không? Dữ liệu liên quan có thể bị ảnh hưởng và không thể khôi phục.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('warehouses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchWarehouses();
        } catch (error) {
            console.error('Error deleting warehouse:', error);
            alert('❌ Có lỗi xảy ra khi xóa kho: ' + error.message);
        }
    };

    const handleEditWarehouse = (warehouse) => {
        setSelectedWarehouse(warehouse);
        setIsFormModalOpen(true);
    };

    const handleViewWarehouse = (warehouse) => {
        setSelectedWarehouse(warehouse);
        setIsDetailsModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchWarehouses();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const filteredWarehouses = warehouses.filter(w => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (w.name?.toLowerCase().includes(search)) ||
            (w.manager_name?.toLowerCase().includes(search)) ||
            (w.address?.toLowerCase().includes(search))
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(w.status);
        const matchesManager = selectedManagers.length === 0 || selectedManagers.includes(w.manager_name);

        return matchesSearch && matchesStatus && matchesManager;
    });

    const filteredWarehousesCount = filteredWarehouses.length;
    const totalCapacity = filteredWarehouses.reduce((sum, w) => sum + (w.capacity || 0), 0);
    const activeCount = filteredWarehouses.filter(w => w.status === 'Đang hoạt động').length;

    const hasActiveFilters = selectedStatuses.length > 0 || selectedManagers.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedManagers.length;

    const statusOptions = WAREHOUSE_STATUSES.map(status => ({
        id: status.id,
        label: status.label,
        count: warehouses.filter(x => x.status === status.id).length
    }));

    const managerOptions = uniqueManagers.map(name => ({
        id: name,
        label: name,
        count: warehouses.filter(x => x.manager_name === name).length
    }));

    const getStatusStats = () => {
        const stats = {};
        filteredWarehouses.forEach(warehouse => {
            const status = warehouse.status || 'Không xác định';
            stats[status] = (stats[status] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getManagerStats = () => {
        const stats = {};
        filteredWarehouses.forEach(warehouse => {
            const manager = warehouse.manager_name || 'Không xác định';
            stats[manager] = (stats[manager] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCapacityStats = () => {
        return filteredWarehouses
            .map(w => ({ name: w.name || 'Không tên', value: w.capacity || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedManagers([]);
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'statuses':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            case 'managers':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'statuses':
                return 'bg-emerald-600 text-white';
            case 'managers':
                return 'bg-cyan-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'statuses':
                return isActive ? 'text-emerald-700' : 'text-emerald-600';
            case 'managers':
                return isActive ? 'text-cyan-700' : 'text-cyan-600';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Tạm ngưng': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Đóng cửa': return 'bg-rose-50 text-rose-500 border-rose-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getRowStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động':
                return 'hover:bg-emerald-50/60';
            case 'Tạm ngưng':
                return 'hover:bg-amber-50/60';
            case 'Đóng cửa':
                return 'hover:bg-rose-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getNameCellClass = (status) => clsx(
        'px-4 py-4 whitespace-nowrap text-sm font-semibold text-foreground border-r border-primary/20 border-l-4',
        status === 'Đang hoạt động' && 'border-l-emerald-400',
        status === 'Tạm ngưng' && 'border-l-amber-400',
        status === 'Đóng cửa' && 'border-l-rose-400',
        !status && 'border-l-primary/50'
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all',
                        activeView === 'list'
                            ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <List size={14} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all',
                        activeView === 'stats'
                            ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <BarChart2 size={14} />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm . . ."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                hasActiveFilters ? getFilterButtonClass('statuses', true) : getFilterButtonClass('statuses', false),
                            )}
                        >
                            <Filter size={18} className={getFilterIconClass('statuses', hasActiveFilters)} />
                            {hasActiveFilters && (
                                <span className={clsx(
                                    'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                                    getFilterCountBadgeClass('statuses')
                                )}>
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setSelectedWarehouse(null);
                                setIsFormModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredWarehouses.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredWarehouses.map((w) => (
                                <div key={w.id} className="rounded-2xl border border-primary/20 bg-gradient-to-br from-white to-primary/[0.03] shadow-sm p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kho hàng</p>
                                            <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{w.name}</h3>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusStyle(w.status))}>
                                            {w.status || 'Không xác định'}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 mb-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                            <User className="w-3.5 h-3.5" />
                                            <span>{w.manager_name || '—'}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                                            <Warehouse className="w-3.5 h-3.5 mt-0.5" />
                                            <span className="line-clamp-2">{w.address || '—'}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-xl bg-muted/30 border border-border/60 p-2.5 mb-3">
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Sức chứa</p>
                                            <p className="text-[13px] font-bold text-foreground">{formatNumber(w.capacity || 0)} vỏ bình</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewWarehouse(w)} className="text-blue-500 hover:text-blue-700 transition-colors"><Eye size={18} /></button>
                                            <button onClick={() => handleEditWarehouse(w)} className="text-amber-500 hover:text-amber-700 transition-colors"><Edit size={18} /></button>
                                            {(role === 'admin' || role === 'manager') && (
                                                <button onClick={() => handleDeleteWarehouse(w.id, w.name)} className="text-rose-500 hover:text-rose-700 transition-colors"><Trash2 size={18} /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="hidden md:block p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm . . ."
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
                                        Cột ({visibleCount}/{totalCount})
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
                                    onClick={() => {
                                        setSelectedWarehouse(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'statuses' ? null : 'statuses')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <Filter size={14} className={getFilterIconClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('statuses'))}>
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'statuses' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'statuses' && (
                                    <FilterDropdown
                                        options={statusOptions}
                                        selected={selectedStatuses}
                                        setSelected={setSelectedStatuses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'managers' ? null : 'managers')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)
                                    )}
                                >
                                    <User size={14} className={getFilterIconClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)} />
                                    Thủ kho
                                    {selectedManagers.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managers'))}>
                                            {selectedManagers.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managers' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'managers' && (
                                    <FilterDropdown
                                        options={managerOptions}
                                        selected={selectedManagers}
                                        setSelected={setSelectedManagers}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto border-t border-primary/20">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    {visibleTableColumns.map(col => (
                                        <th key={col.key} className={clsx('px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide', col.key === 'name' && 'border-l border-r border-primary/30')}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredWarehouses.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy kho hàng nào
                                        </td>
                                    </tr>
                                ) : filteredWarehouses.map((w) => (
                                    <tr key={w.id} className={getRowStyle(w.status)}>
                                        {isColumnVisible('name') && <td className={getNameCellClass(w.status)}>{w.name}</td>}
                                        {isColumnVisible('manager_name') && <td className="px-4 py-4 text-sm text-muted-foreground">{w.manager_name || '—'}</td>}
                                        {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-muted-foreground">{w.address || '—'}</td>}
                                        {isColumnVisible('capacity') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{formatNumber(w.capacity || 0)}</td>}
                                        {isColumnVisible('status') && (
                                            <td className="px-4 py-4">
                                                <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border', getStatusStyle(w.status))}>
                                                    {w.status || 'Không xác định'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewWarehouse(w)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditWarehouse(w)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button onClick={() => handleDeleteWarehouse(w.id, w.name)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>{filteredWarehouses.length > 0 ? `1–${filteredWarehouses.length}` : '0'}/Tổng {filteredWarehouses.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{formatNumber(totalCapacity)} sức chứa</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">{activeCount} hoạt động</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled>
                                <ChevronLeft size={16} />
                                <ChevronLeft size={16} className="-ml-2.5" />
                            </button>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled>
                                <ChevronLeft size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">1</div>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled>
                                <ChevronRight size={16} />
                            </button>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled>
                                <ChevronRight size={16} />
                                <ChevronRight size={16} className="-ml-2.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                    <div className="space-y-0">
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
                                    hasActiveFilters ? getFilterButtonClass('statuses', true) : getFilterButtonClass('statuses', false),
                                )}
                            >
                                <Filter size={18} className={getFilterIconClass('statuses', hasActiveFilters)} />
                                {hasActiveFilters && (
                                    <span className={clsx(
                                        'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                                        getFilterCountBadgeClass('statuses')
                                    )}>
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="hidden md:block p-4 border-b border-border" ref={dropdownRef}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'statuses' ? null : 'statuses')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className={getFilterIconClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('statuses'))}>
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'statuses' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'statuses' && (
                                        <FilterDropdown
                                            options={statusOptions}
                                            selected={selectedStatuses}
                                            setSelected={setSelectedStatuses}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'managers' ? null : 'managers')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)} />
                                        Thủ kho
                                        {selectedManagers.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managers'))}>
                                                {selectedManagers.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managers' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'managers' && (
                                        <FilterDropdown
                                            options={managerOptions}
                                            selected={selectedManagers}
                                            setSelected={setSelectedManagers}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1 md:col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Warehouse className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng kho</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredWarehousesCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1 md:col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Tổng sức chứa</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(totalCapacity)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1 md:col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <Filter className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đang hoạt động</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(activeCount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Trạng thái</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getStatusStats().map(item => item.name),
                                                datasets: [{
                                                    data: getStatusStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getStatusStats().length),
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

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Thủ kho</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getManagerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số kho',
                                                    data: getManagerStats().map(item => item.value),
                                                    backgroundColor: chartColors[0],
                                                    borderColor: chartColors[0],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                indexAxis: 'y',
                                                plugins: { legend: { display: false } },
                                                scales: { x: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 kho theo Sức chứa</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCapacityStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Sức chứa',
                                                    data: getCapacityStats().map(item => item.value),
                                                    backgroundColor: chartColors[1],
                                                    borderColor: chartColors[1],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { display: false },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: (context) => `${formatNumber(context.parsed.y)} vỏ bình`
                                                        }
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        ticks: {
                                                            callback: (value) => formatNumber(value)
                                                        }
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
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
                            id: 'statuses',
                            label: 'Trạng thái',
                            icon: <Filter size={16} className="text-emerald-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'managers',
                            label: 'Thủ kho',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: managerOptions,
                            selectedValues: pendingManagers,
                            onSelectionChange: setPendingManagers,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <WarehouseFormModal
                    warehouse={selectedWarehouse}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedWarehouse && (
                <WarehouseDetailsModal
                    warehouse={selectedWarehouse}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Warehouses;