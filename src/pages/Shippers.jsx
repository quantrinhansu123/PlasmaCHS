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
    Phone,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    Truck,
    User,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import ShipperDetailsModal from '../components/Shippers/ShipperDetailsModal';
import ShipperFormModal from '../components/Shippers/ShipperFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { SHIPPER_STATUSES, SHIPPING_TYPES } from '../constants/shipperConstants';
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
    { key: 'name', label: 'Đơn vị vận chuyển' },
    { key: 'shipping_type', label: 'Loại hình' },
    { key: 'manager_name', label: 'Người quản lý' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'status', label: 'Trạng thái' },
];

const Shippers = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [shippers, setShippers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedShipper, setSelectedShipper] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);
    const [uniqueManagers, setUniqueManagers] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingTypes, setPendingTypes] = useState([]);
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
            const saved = JSON.parse(localStorage.getItem('columns_shippers_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_shippers') || 'null');
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
        fetchShippers();
    }, []);

    useEffect(() => {
        const managers = [...new Set(shippers.map(shipper => shipper.manager_name).filter(Boolean))];
        setUniqueManagers(managers);
    }, [shippers]);

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
        localStorage.setItem('columns_shippers', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_shippers_order', JSON.stringify(columnOrder));
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
        setPendingTypes(selectedTypes);
        setPendingManagers(selectedManagers);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedTypes(pendingTypes);
        setSelectedManagers(pendingManagers);
        closeMobileFilter();
    };

    const fetchShippers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('shippers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setShippers(data || []);
        } catch (error) {
            console.error('Error fetching shippers:', error);
            alert('❌ Không thể tải danh sách đơn vị vận chuyển: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteShipper = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa hệ thống đối tác "${name}" không? Toàn bộ dữ liệu liên quan có thể bị ảnh hưởng và không thể khôi phục.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('shippers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchShippers();
        } catch (error) {
            console.error('Error deleting shipper:', error);
            alert('❌ Có lỗi xảy ra khi xóa đơn vị vận chuyển: ' + error.message);
        }
    };

    const handleEditShipper = (shipper) => {
        setSelectedShipper(shipper);
        setIsFormModalOpen(true);
    };

    const handleViewShipper = (shipper) => {
        setSelectedShipper(shipper);
        setIsDetailsModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchShippers();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const getLabel = (list, id) => list.find(item => item.id === id)?.label || id || '—';

    const filteredShippers = shippers.filter(shipper => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            shipper.name?.toLowerCase().includes(search) ||
            shipper.manager_name?.toLowerCase().includes(search) ||
            shipper.phone?.includes(search) ||
            shipper.address?.toLowerCase().includes(search)
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(shipper.status);
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(shipper.shipping_type);
        const matchesManager = selectedManagers.length === 0 || selectedManagers.includes(shipper.manager_name);

        return matchesSearch && matchesStatus && matchesType && matchesManager;
    });

    const filteredShippersCount = filteredShippers.length;
    const activeCount = filteredShippers.filter(s => s.status === 'Đang hoạt động').length;
    const suspendedCount = filteredShippers.filter(s => s.status === 'Tạm ngưng').length;

    const hasActiveFilters = selectedStatuses.length > 0 || selectedTypes.length > 0 || selectedManagers.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedTypes.length + selectedManagers.length;

    const statusOptions = SHIPPER_STATUSES.map(status => ({
        id: status.id,
        label: status.label,
        count: shippers.filter(x => x.status === status.id).length
    }));

    const typeOptions = SHIPPING_TYPES.map(type => ({
        id: type.id,
        label: type.label,
        count: shippers.filter(x => x.shipping_type === type.id).length
    }));

    const managerOptions = uniqueManagers.map(name => ({
        id: name,
        label: name,
        count: shippers.filter(x => x.manager_name === name).length
    }));

    const getStatusStats = () => {
        const stats = {};
        filteredShippers.forEach(shipper => {
            const status = shipper.status || 'Không xác định';
            stats[status] = (stats[status] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTypeStats = () => {
        const stats = {};
        filteredShippers.forEach(shipper => {
            const typeLabel = getLabel(SHIPPING_TYPES, shipper.shipping_type);
            stats[typeLabel] = (stats[typeLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getManagerStats = () => {
        const stats = {};
        filteredShippers.forEach(shipper => {
            const manager = shipper.manager_name || 'Không xác định';
            stats[manager] = (stats[manager] || 0) + 1;
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

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedTypes([]);
        setSelectedManagers([]);
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'statuses':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            case 'types':
                return 'border-violet-200 bg-violet-50 text-violet-700';
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
            case 'types':
                return 'bg-violet-600 text-white';
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
            case 'types':
                return isActive ? 'text-violet-700' : 'text-violet-600';
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
            case 'Ngừng hợp tác': return 'bg-rose-50 text-rose-500 border-rose-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getRowStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động':
                return 'hover:bg-emerald-50/60';
            case 'Tạm ngưng':
                return 'hover:bg-amber-50/60';
            case 'Ngừng hợp tác':
                return 'hover:bg-rose-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getNameCellClass = (status) => clsx(
        'px-4 py-4 text-sm font-semibold text-foreground border-r border-primary/20 border-l-4',
        status === 'Đang hoạt động' && 'border-l-emerald-400',
        status === 'Tạm ngưng' && 'border-l-amber-400',
        status === 'Ngừng hợp tác' && 'border-l-rose-400',
        !status && 'border-l-transparent'
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
                                setSelectedShipper(null);
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
                        ) : filteredShippers.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredShippers.map((shipper) => (
                                <div key={shipper.id} className="rounded-2xl border border-primary/20 bg-gradient-to-br from-white to-primary/[0.03] shadow-sm p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Đơn vị vận chuyển</p>
                                            <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{shipper.name}</h3>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusStyle(shipper.status))}>
                                            {shipper.status || 'Không xác định'}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 mb-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>{shipper.phone || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                            <User className="w-3.5 h-3.5" />
                                            <span>{shipper.manager_name || '—'}</span>
                                        </div>
                                        <div className="text-[12px] text-muted-foreground">
                                            <span className="font-semibold text-foreground/90">Loại hình:</span> {getLabel(SHIPPING_TYPES, shipper.shipping_type)}
                                        </div>
                                        <div className="text-[12px] text-muted-foreground line-clamp-2">{shipper.address || '—'}</div>
                                    </div>

                                    <div className="flex items-center justify-end pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewShipper(shipper)} className="text-blue-500 hover:text-blue-700 transition-colors"><Eye size={18} /></button>
                                            <button onClick={() => handleEditShipper(shipper)} className="text-amber-500 hover:text-amber-700 transition-colors"><Edit size={18} /></button>
                                            {(role === 'admin' || role === 'manager') && (
                                                <button onClick={() => handleDeleteShipper(shipper.id, shipper.name)} className="text-rose-500 hover:text-rose-700 transition-colors"><Trash2 size={18} /></button>
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
                                        setSelectedShipper(null);
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'types' ? null : 'types')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('types', activeDropdown === 'types' || selectedTypes.length > 0)
                                    )}
                                >
                                    <Truck size={14} className={getFilterIconClass('types', activeDropdown === 'types' || selectedTypes.length > 0)} />
                                    Loại hình
                                    {selectedTypes.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('types'))}>
                                            {selectedTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'types' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'types' && (
                                    <FilterDropdown
                                        options={typeOptions}
                                        selected={selectedTypes}
                                        setSelected={setSelectedTypes}
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
                                    Người quản lý
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
                                ) : filteredShippers.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy đơn vị vận chuyển nào
                                        </td>
                                    </tr>
                                ) : filteredShippers.map((shipper) => (
                                    <tr key={shipper.id} className={getRowStyle(shipper.status)}>
                                        {isColumnVisible('name') && <td className={getNameCellClass(shipper.status)}>{shipper.name || '—'}</td>}
                                        {isColumnVisible('shipping_type') && <td className="px-4 py-4 text-sm text-muted-foreground">{getLabel(SHIPPING_TYPES, shipper.shipping_type)}</td>}
                                        {isColumnVisible('manager_name') && <td className="px-4 py-4 text-sm text-muted-foreground">{shipper.manager_name || '—'}</td>}
                                        {isColumnVisible('phone') && <td className="px-4 py-4 text-sm text-muted-foreground">{shipper.phone || '—'}</td>}
                                        {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-muted-foreground">{shipper.address || '—'}</td>}
                                        {isColumnVisible('status') && (
                                            <td className="px-4 py-4">
                                                <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border', getStatusStyle(shipper.status))}>
                                                    {shipper.status || 'Không xác định'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewShipper(shipper)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditShipper(shipper)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button onClick={() => handleDeleteShipper(shipper.id, shipper.name)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
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
                            <span>{filteredShippers.length > 0 ? `1–${filteredShippers.length}` : '0'}/Tổng {filteredShippers.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{activeCount} hoạt động</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">{suspendedCount} tạm ngưng</span>
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'types' ? null : 'types')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('types', activeDropdown === 'types' || selectedTypes.length > 0)
                                        )}
                                    >
                                        <Truck size={14} className={getFilterIconClass('types', activeDropdown === 'types' || selectedTypes.length > 0)} />
                                        Loại hình
                                        {selectedTypes.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('types'))}>
                                                {selectedTypes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'types' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'types' && (
                                        <FilterDropdown
                                            options={typeOptions}
                                            selected={selectedTypes}
                                            setSelected={setSelectedTypes}
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
                                        Người quản lý
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
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Truck className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng DVVC</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredShippersCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Đang hoạt động</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(activeCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <Filter className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Tạm ngưng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(suspendedCount)}</p>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại hình</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getTypeStats().map(item => item.name),
                                                datasets: [{
                                                    data: getTypeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getTypeStats().length),
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

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Người quản lý</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getManagerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số DVVC',
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
                            id: 'types',
                            label: 'Loại hình',
                            icon: <Truck size={16} className="text-violet-600" />,
                            options: typeOptions,
                            selectedValues: pendingTypes,
                            onSelectionChange: setPendingTypes,
                        },
                        {
                            id: 'managers',
                            label: 'Người quản lý',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: managerOptions,
                            selectedValues: pendingManagers,
                            onSelectionChange: setPendingManagers,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <ShipperFormModal
                    shipper={selectedShipper}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedShipper && (
                <ShipperDetailsModal
                    shipper={selectedShipper}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Shippers;