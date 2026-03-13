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
    ActivitySquare,
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
import CylinderDetailsModal from '../components/Cylinders/CylinderDetailsModal';
import CylinderFormModal from '../components/Cylinders/CylinderFormModal';
import CylinderQCDialog from '../components/Cylinders/CylinderQCDialog';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { CYLINDER_STATUSES } from '../constants/machineConstants';
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

const TABLE_COLUMNS = [
    { key: 'serial_number', label: 'Mã RFID (Serial)' },
    { key: 'volume', label: 'Thể tích / Loại bình' },
    { key: 'customer_name', label: 'Tên Khách Hàng / Vị trí' },
    { key: 'warehouse', label: 'Kho Quản Lý' },
    { key: 'status', label: 'Trạng Thái' },
];

const CATEGORY_OPTIONS = [
    { id: 'BV', label: 'BV' },
    { id: 'TM', label: 'TM' },
];

const Cylinders = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [cylinders, setCylinders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQCModalOpen, setIsQCModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCylinder, setSelectedCylinder] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedVolumes, setSelectedVolumes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueVolumes, setUniqueVolumes] = useState([]);
    const [uniqueWarehouses, setUniqueWarehouses] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingVolumes, setPendingVolumes] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingCategories, setPendingCategories] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_cylinders_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_cylinders') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        fetchCylinders();
    }, []);

    useEffect(() => {
        const customers = [...new Set(cylinders.map(c => c.customer_name).filter(Boolean))];
        const volumes = [...new Set(cylinders.map(c => c.volume).filter(Boolean))];
        const warehouses = [...new Set(cylinders.map(c => c.warehouses?.name).filter(Boolean))];
        setUniqueCustomers(customers);
        setUniqueVolumes(volumes);
        setUniqueWarehouses(warehouses);
    }, [cylinders]);

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
        localStorage.setItem('columns_cylinders', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_cylinders_order', JSON.stringify(columnOrder));
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
        setPendingVolumes(selectedVolumes);
        setPendingCustomers(selectedCustomers);
        setPendingCategories(selectedCategories);
        setPendingWarehouses(selectedWarehouses);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedVolumes(pendingVolumes);
        setSelectedCustomers(pendingCustomers);
        setSelectedCategories(pendingCategories);
        setSelectedWarehouses(pendingWarehouses);
        closeMobileFilter();
    };

    const fetchCylinders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('cylinders')
                .select('*, warehouses(name)')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;
            setCylinders(data || []);
        } catch (error) {
            console.error('Error fetching cylinders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCylinder = async (id, serialNumber) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa bình khí có mã ${serialNumber} này không? Chú ý: Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('cylinders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCylinders();
        } catch (error) {
            console.error('Error deleting cylinder:', error);
            alert('❌ Có lỗi xảy ra khi xóa bình khí: ' + error.message);
        }
    };

    const handleEditCylinder = (cylinder) => {
        setSelectedCylinder(cylinder);
        setIsFormModalOpen(true);
    };

    const handleViewCylinder = (cylinder) => {
        setSelectedCylinder(cylinder);
        setIsDetailsModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchCylinders();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const getStatusLabel = (status) => {
        const item = CYLINDER_STATUSES.find(s => s.id === status);
        return item ? item.label : status;
    };

    const filteredCylinders = cylinders.filter(cylinder => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (cylinder.serial_number?.toLowerCase().includes(search)) ||
            (cylinder.volume?.toLowerCase().includes(search)) ||
            (cylinder.customer_name?.toLowerCase().includes(search))
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(cylinder.status);
        const matchesVolume = selectedVolumes.length === 0 || selectedVolumes.includes(cylinder.volume);
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(cylinder.customer_name);
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(cylinder.warehouses?.name);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(cylinder.category);

        return matchesSearch && matchesStatus && matchesVolume && matchesCustomer && matchesWarehouse && matchesCategory;
    });

    const filteredCylindersCount = filteredCylinders.length;
    const readyCount = filteredCylinders.filter(c => c.status === 'sẵn sàng').length;
    const inUseCount = filteredCylinders.filter(c => c.status === 'đang sử dụng' || c.status === 'thuộc khách hàng').length;
    const emptyCount = filteredCylinders.filter(c => c.status === 'bình rỗng' || c.status === 'chờ nạp').length;

    const hasActiveFilters = selectedStatuses.length > 0
        || selectedVolumes.length > 0
        || selectedCustomers.length > 0
        || selectedCategories.length > 0
        || selectedWarehouses.length > 0;

    const totalActiveFilters = selectedStatuses.length
        + selectedVolumes.length
        + selectedCustomers.length
        + selectedCategories.length
        + selectedWarehouses.length;

    const statusOptions = CYLINDER_STATUSES.map(item => ({
        id: item.id,
        label: item.label,
        count: cylinders.filter(c => c.status === item.id).length
    }));

    const volumeOptions = uniqueVolumes.map(item => ({
        id: item,
        label: item,
        count: cylinders.filter(c => c.volume === item).length
    }));

    const customerOptions = uniqueCustomers.map(item => ({
        id: item,
        label: item,
        count: cylinders.filter(c => c.customer_name === item).length
    }));

    const warehouseOptions = uniqueWarehouses.map(item => ({
        id: item,
        label: item,
        count: cylinders.filter(c => c.warehouses?.name === item).length
    }));

    const categoryOptions = CATEGORY_OPTIONS.map(item => ({
        id: item.id,
        label: item.label,
        count: cylinders.filter(c => c.category === item.id).length
    }));

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedVolumes([]);
        setSelectedCustomers([]);
        setSelectedCategories([]);
        setSelectedWarehouses([]);
    };

    const getStatusStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const statusLabel = getStatusLabel(cylinder.status);
            stats[statusLabel] = (stats[statusLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getVolumeStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const volume = cylinder.volume || 'Không xác định';
            stats[volume] = (stats[volume] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const customer = cylinder.customer_name || 'Vỏ bình tại kho';
            stats[customer] = (stats[customer] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCategoryStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const category = cylinder.category || 'Không xác định';
            stats[category] = (stats[category] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'sẵn sàng':
                return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'đang sử dụng':
            case 'đã sử dụng':
            case 'thuộc khách hàng':
                return 'bg-sky-50 text-sky-600 border-sky-100';
            case 'đang vận chuyển':
                return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'chờ nạp':
            case 'bình rỗng':
                return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'hỏng':
                return 'bg-rose-50 text-rose-500 border-rose-100';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col -mt-2 min-h-0 px-3 md:px-6">
            <div className="flex items-center gap-1 mb-4 mt-6">
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
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                            )}
                        >
                            <Filter size={18} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setSelectedCylinder(null);
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
                        ) : filteredCylinders.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredCylinders.map((cylinder, index) => (
                                <div key={cylinder.id} className="rounded-2xl border border-border bg-white shadow-sm p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{index + 1}</p>
                                            <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{cylinder.serial_number}</h3>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusBadgeClass(cylinder.status))}>
                                            {getStatusLabel(cylinder.status)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Loại bình</p>
                                            <p className="text-[12px] text-foreground font-medium">{cylinder.volume || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Phân loại</p>
                                            <p className="text-[12px] text-foreground font-medium">{cylinder.category || '—'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Khách hàng / Vị trí</p>
                                            <p className="text-[12px] text-foreground font-medium">{cylinder.customer_name || 'Vỏ bình tại kho'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <Warehouse size={12} />
                                            <span>{cylinder.warehouses?.name || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewCylinder(cylinder)} className="text-muted-foreground hover:text-primary transition-colors"><Eye size={18} /></button>
                                            <button onClick={() => handleEditCylinder(cylinder)} className="text-muted-foreground hover:text-primary transition-colors"><Edit size={18} /></button>
                                            {(role === 'admin' || role === 'manager') && (
                                                <button onClick={() => handleDeleteCylinder(cylinder.id, cylinder.serial_number)} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
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
                                        setSelectedCylinder(null);
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        activeDropdown === 'status' || selectedStatuses.length > 0
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <Filter size={14} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'status' && (
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'volume' ? null : 'volume')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        activeDropdown === 'volume' || selectedVolumes.length > 0
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <ActivitySquare size={14} />
                                    Thể tích
                                    {selectedVolumes.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                            {selectedVolumes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'volume' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'volume' && (
                                    <FilterDropdown
                                        options={volumeOptions}
                                        selected={selectedVolumes}
                                        setSelected={setSelectedVolumes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        activeDropdown === 'customers' || selectedCustomers.length > 0
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <User size={14} />
                                    Khách hàng
                                    {selectedCustomers.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                            {selectedCustomers.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customers' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'customers' && (
                                    <FilterDropdown
                                        options={customerOptions}
                                        selected={selectedCustomers}
                                        setSelected={setSelectedCustomers}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        activeDropdown === 'warehouses' || selectedWarehouses.length > 0
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <Warehouse size={14} />
                                    Kho
                                    {selectedWarehouses.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'warehouses' && (
                                    <FilterDropdown
                                        options={warehouseOptions}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        activeDropdown === 'categories' || selectedCategories.length > 0
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <ActivitySquare size={14} />
                                    Phân loại
                                    {selectedCategories.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                            {selectedCategories.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'categories' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'categories' && (
                                    <FilterDropdown
                                        options={categoryOptions}
                                        selected={selectedCategories}
                                        setSelected={setSelectedCategories}
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

                    <div className="hidden md:block flex-1 overflow-x-auto border-t border-border">
                        <table className="w-full border-collapse">
                            <thead className="bg-muted/20">
                                <tr>
                                    {visibleTableColumns.map(col => (
                                        <th key={col.key} className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide">
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredCylinders.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy bình nào
                                        </td>
                                    </tr>
                                ) : filteredCylinders.map((cylinder) => (
                                    <tr key={cylinder.id} className="hover:bg-muted/20 transition-colors">
                                        {isColumnVisible('serial_number') && <td className="px-4 py-4 text-sm font-semibold text-foreground font-mono">{cylinder.serial_number}</td>}
                                        {isColumnVisible('volume') && <td className="px-4 py-4 text-sm text-muted-foreground">{cylinder.volume || '—'}</td>}
                                        {isColumnVisible('customer_name') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{cylinder.customer_name || 'Vỏ bình tại kho'}</td>}
                                        {isColumnVisible('warehouse') && <td className="px-4 py-4 text-sm text-muted-foreground">{cylinder.warehouses?.name || '—'}</td>}
                                        {isColumnVisible('status') && (
                                            <td className="px-4 py-4">
                                                <span className={clsx('inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border', getStatusBadgeClass(cylinder.status))}>
                                                    {getStatusLabel(cylinder.status)}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewCylinder(cylinder)} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditCylinder(cylinder)} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button onClick={() => handleDeleteCylinder(cylinder.id, cylinder.serial_number)} className="text-muted-foreground hover:text-red-500 transition-colors p-1" title="Xóa">
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
                            <span>{filteredCylinders.length > 0 ? `1–${filteredCylinders.length}` : '0'}/Tổng {filteredCylinders.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">Sẵn sàng {formatNumber(readyCount)}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">Đang dùng {formatNumber(inUseCount)}</span>
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
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            activeDropdown === 'status' || selectedStatuses.length > 0
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <Filter size={14} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'status' && (
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'volume' ? null : 'volume')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            activeDropdown === 'volume' || selectedVolumes.length > 0
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <ActivitySquare size={14} />
                                        Thể tích
                                        {selectedVolumes.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                                {selectedVolumes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'volume' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'volume' && (
                                        <FilterDropdown
                                            options={volumeOptions}
                                            selected={selectedVolumes}
                                            setSelected={setSelectedVolumes}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            activeDropdown === 'customers' || selectedCustomers.length > 0
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <User size={14} />
                                        Khách hàng
                                        {selectedCustomers.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                                {selectedCustomers.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customers' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'customers' && (
                                        <FilterDropdown
                                            options={customerOptions}
                                            selected={selectedCustomers}
                                            setSelected={setSelectedCustomers}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            activeDropdown === 'warehouses' || selectedWarehouses.length > 0
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <Warehouse size={14} />
                                        Kho
                                        {selectedWarehouses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                                {selectedWarehouses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'warehouses' && (
                                        <FilterDropdown
                                            options={warehouseOptions}
                                            selected={selectedWarehouses}
                                            setSelected={setSelectedWarehouses}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            activeDropdown === 'categories' || selectedCategories.length > 0
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border bg-white text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <ActivitySquare size={14} />
                                        Phân loại
                                        {selectedCategories.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                                                {selectedCategories.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'categories' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'categories' && (
                                        <FilterDropdown
                                            options={categoryOptions}
                                            selected={selectedCategories}
                                            setSelected={setSelectedCategories}
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <ActivitySquare className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng bình</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredCylindersCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Sẵn sàng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(readyCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đang dùng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(inUseCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-amber-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Rỗng/Chờ</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-amber-900 mt-0.5 md:mt-1 leading-none">{formatNumber(emptyCount)}</p>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Thể tích</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getVolumeStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    data: getVolumeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getVolumeStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Phân loại</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCategoryStats().map(item => item.name),
                                                datasets: [{
                                                    label: 'Số bình',
                                                    data: getCategoryStats().map(item => item.value),
                                                    backgroundColor: chartColors[0],
                                                    borderColor: chartColors[0],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: false } },
                                                scales: { y: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Khách hàng</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCustomerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số bình',
                                                    data: getCustomerStats().map(item => item.value),
                                                    backgroundColor: chartColors[1],
                                                    borderColor: chartColors[1],
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
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Filter size={16} />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'volume',
                            label: 'Thể tích',
                            icon: <ActivitySquare size={16} />,
                            options: volumeOptions,
                            selectedValues: pendingVolumes,
                            onSelectionChange: setPendingVolumes,
                        },
                        {
                            id: 'customers',
                            label: 'Khách hàng',
                            icon: <User size={16} />,
                            options: customerOptions,
                            selectedValues: pendingCustomers,
                            onSelectionChange: setPendingCustomers,
                        },
                        {
                            id: 'warehouses',
                            label: 'Kho',
                            icon: <Warehouse size={16} />,
                            options: warehouseOptions,
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses,
                        },
                        {
                            id: 'categories',
                            label: 'Phân loại',
                            icon: <ActivitySquare size={16} />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <CylinderFormModal
                    cylinder={selectedCylinder}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedCylinder && (
                <CylinderDetailsModal
                    cylinder={selectedCylinder}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}

            <CylinderQCDialog
                isOpen={isQCModalOpen}
                onClose={() => setIsQCModalOpen(false)}
                onSuccess={(count) => {
                    setIsQCModalOpen(false);
                    alert(`Đã cập nhật dữ liệu QC cho ${count} vỏ bình thành công!`);
                    fetchCylinders();
                }}
            />
        </div>
    );
};

export default Cylinders;
