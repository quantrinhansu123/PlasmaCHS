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
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Filter,
    Gift,
    List,
    Plus,
    Search,
    SlidersHorizontal,
    Tag,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import PromotionFormModal from '../components/Promotions/PromotionFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
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
    { key: 'code', label: 'Mã Khuyến mãi' },
    { key: 'content', label: 'Nội dung ưu đãi' },
    { key: 'period', label: 'Thời hạn áp dụng' },
    { key: 'target', label: 'Đối tượng' },
    { key: 'status', label: 'Tình trạng' },
    { key: 'active', label: 'Kích hoạt' },
];

const PROMOTION_STATUSES = ['Đang hoạt động', 'Hết hạn', 'Vô hiệu', 'Chờ kích hoạt'];
const ACTIVE_OPTIONS = [
    { id: 'active', label: 'Đã kích hoạt' },
    { id: 'inactive', label: 'Chưa kích hoạt' }
];

const Promotions = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [promotions, setPromotions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomerTypes, setSelectedCustomerTypes] = useState([]);
    const [selectedActiveStatus, setSelectedActiveStatus] = useState([]);
    const [uniqueCustomerTypes, setUniqueCustomerTypes] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomerTypes, setPendingCustomerTypes] = useState([]);
    const [pendingActiveStatus, setPendingActiveStatus] = useState([]);

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
            const saved = JSON.parse(localStorage.getItem('columns_promotions_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_promotions') || 'null');
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
        fetchPromotions();
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
        localStorage.setItem('columns_promotions', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_promotions_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const fetchPromotions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_promotions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            const list = data || [];
            setPromotions(list);

            const uniqueTypes = [...new Set(list.map(p => p.customer_type).filter(Boolean))];
            setUniqueCustomerTypes(uniqueTypes);
        } catch (error) {
            console.error('Error fetching promotions:', error);
            alert('❌ Không thể tải danh sách khuyến mãi: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const getPromoStatus = (promo) => {
        if (!promo.is_active) return { label: 'Vô hiệu', style: 'bg-slate-50 text-slate-500 border-slate-100' };
        if (promo.end_date < today) return { label: 'Hết hạn', style: 'bg-rose-50 text-rose-500 border-rose-100' };
        if (promo.start_date > today) return { label: 'Chờ kích hoạt', style: 'bg-amber-50 text-amber-600 border-amber-100' };
        return { label: 'Đang hoạt động', style: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '---';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const filteredPromotions = promotions.filter(promo => {
        const search = searchTerm.toLowerCase();
        const matchSearch = (
            promo.code?.toLowerCase().includes(search) ||
            promo.customer_type?.toLowerCase().includes(search) ||
            promo.free_cylinders?.toString().includes(search)
        );

        const status = getPromoStatus(promo);
        const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(status.label);
        const matchCustomerType = selectedCustomerTypes.length === 0 || selectedCustomerTypes.includes(promo.customer_type);
        const matchActive = selectedActiveStatus.length === 0 ||
            (selectedActiveStatus.includes('active') && promo.is_active) ||
            (selectedActiveStatus.includes('inactive') && !promo.is_active);

        return matchSearch && matchStatus && matchCustomerType && matchActive;
    });

    const filteredPromotionsCount = filteredPromotions.length;
    const activeCount = filteredPromotions.filter(p => p.is_active && p.end_date >= today && p.start_date <= today).length;
    const expiredCount = filteredPromotions.filter(p => p.end_date < today || !p.is_active).length;

    const hasActiveFilters = selectedStatuses.length > 0 || selectedCustomerTypes.length > 0 || selectedActiveStatus.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedCustomerTypes.length + selectedActiveStatus.length;

    const statusOptions = PROMOTION_STATUSES.map(status => ({
        id: status,
        label: status,
        count: promotions.filter(promo => getPromoStatus(promo).label === status).length
    }));

    const customerTypeOptions = uniqueCustomerTypes.map(type => ({
        id: type,
        label: type,
        count: promotions.filter(promo => promo.customer_type === type).length
    }));

    const activeOptions = ACTIVE_OPTIONS.map(option => ({
        id: option.id,
        label: option.label,
        count: promotions.filter(promo => option.id === 'active' ? promo.is_active : !promo.is_active).length
    }));

    const handleDeletePromo = async (id, code) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa mã khuyến mãi ${code} không?`)) return;

        try {
            const { error } = await supabase.from('app_promotions').delete().eq('id', id);
            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error deleting promotion:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        }
    };

    const handleToggleActive = async (id, currentActive) => {
        try {
            const { error } = await supabase
                .from('app_promotions')
                .update({ is_active: !currentActive })
                .eq('id', id);
            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error toggling promotion:', error);
        }
    };

    const handleEditPromo = (promo) => {
        setSelectedPromo(promo);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchPromotions();
        setIsFormModalOpen(false);
    };

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingCustomerTypes(selectedCustomerTypes);
        setPendingActiveStatus(selectedActiveStatus);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedCustomerTypes(pendingCustomerTypes);
        setSelectedActiveStatus(pendingActiveStatus);
        closeMobileFilter();
    };

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedCustomerTypes([]);
        setSelectedActiveStatus([]);
    };

    const getStatusStats = () => {
        const stats = {};
        filteredPromotions.forEach(promo => {
            const status = getPromoStatus(promo);
            stats[status.label] = (stats[status.label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerTypeStats = () => {
        const stats = {};
        filteredPromotions.forEach(promo => {
            const type = promo.customer_type || 'Khác';
            stats[type] = (stats[type] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTopPromotions = () => {
        return filteredPromotions
            .map(promo => ({ name: promo.code, value: promo.free_cylinders || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'statuses':
                return 'border-amber-200 bg-amber-50 text-amber-700';
            case 'customerTypes':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            case 'active':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'statuses':
                return 'bg-amber-600 text-white';
            case 'customerTypes':
                return 'bg-violet-600 text-white';
            case 'active':
                return 'bg-cyan-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'statuses':
                return isActive ? 'text-amber-700' : 'text-amber-600';
            case 'customerTypes':
                return isActive ? 'text-violet-700' : 'text-violet-600';
            case 'active':
                return isActive ? 'text-cyan-700' : 'text-cyan-600';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getRowStyle = (statusLabel) => clsx(
        'hover:bg-primary/5',
        statusLabel === 'Đang hoạt động' && 'hover:bg-emerald-50/60',
        statusLabel === 'Hết hạn' && 'hover:bg-rose-50/60',
        statusLabel === 'Vô hiệu' && 'hover:bg-slate-100/70',
        statusLabel === 'Chờ kích hoạt' && 'hover:bg-amber-50/60'
    );

    const getCodeCellClass = (statusLabel) => clsx(
        'px-4 py-4 text-sm font-semibold text-foreground border-r border-primary/20 border-l-4',
        statusLabel === 'Đang hoạt động' && 'border-l-emerald-400',
        statusLabel === 'Hết hạn' && 'border-l-rose-400',
        statusLabel === 'Vô hiệu' && 'border-l-slate-400',
        statusLabel === 'Chờ kích hoạt' && 'border-l-amber-400',
        !statusLabel && 'border-l-transparent'
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
                                setSelectedPromo(null);
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
                        ) : filteredPromotions.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : filteredPromotions.map((promo) => {
                            const status = getPromoStatus(promo);
                            return (
                                <div key={promo.id} className="rounded-2xl border border-primary/20 bg-gradient-to-br from-white to-primary/[0.03] shadow-sm p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mã khuyến mãi</p>
                                            <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{promo.code}</h3>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', status.style)}>
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 mb-3 text-[12px] text-muted-foreground rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                                        <p><span className="font-semibold text-foreground/90">Ưu đãi:</span> + {promo.free_cylinders || 0} bình khí</p>
                                        <p><span className="font-semibold text-foreground/90">Đối tượng:</span> {promo.customer_type || '—'}</p>
                                        <div className="flex items-center gap-1.5">
                                            <CalendarDays className="w-3 h-3" />
                                            <span>{formatDate(promo.start_date)} — {formatDate(promo.end_date)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={() => handleToggleActive(promo.id, promo.is_active)} />
                                            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                            <span className="ml-2 text-[10px] font-medium text-muted-foreground">{promo.is_active ? 'Bật' : 'Tắt'}</span>
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleEditPromo(promo)} className="text-blue-500 hover:text-blue-700 transition-colors"><Edit size={18} /></button>
                                            <button onClick={() => handleDeletePromo(promo.id, promo.code)} className="text-rose-500 hover:text-rose-700 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                                        setSelectedPromo(null);
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'customerTypes' ? null : 'customerTypes')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('customerTypes', activeDropdown === 'customerTypes' || selectedCustomerTypes.length > 0)
                                    )}
                                >
                                    <Gift size={14} className={getFilterIconClass('customerTypes', activeDropdown === 'customerTypes' || selectedCustomerTypes.length > 0)} />
                                    Loại khách hàng
                                    {selectedCustomerTypes.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customerTypes'))}>
                                            {selectedCustomerTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customerTypes' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'customerTypes' && (
                                    <FilterDropdown
                                        options={customerTypeOptions}
                                        selected={selectedCustomerTypes}
                                        setSelected={setSelectedCustomerTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'active' ? null : 'active')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('active', activeDropdown === 'active' || selectedActiveStatus.length > 0)
                                    )}
                                >
                                    <Tag size={14} className={getFilterIconClass('active', activeDropdown === 'active' || selectedActiveStatus.length > 0)} />
                                    Kích hoạt
                                    {selectedActiveStatus.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('active'))}>
                                            {selectedActiveStatus.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'active' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'active' && (
                                    <FilterDropdown
                                        options={activeOptions}
                                        selected={selectedActiveStatus}
                                        setSelected={setSelectedActiveStatus}
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
                                        <th key={col.key} className={clsx('px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide', col.key === 'content' || col.key === 'status' || col.key === 'active' ? 'text-center' : 'text-left', col.key === 'code' && 'border-l border-r border-primary/30')}>
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
                                ) : filteredPromotions.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy khuyến mãi nào
                                        </td>
                                    </tr>
                                ) : filteredPromotions.map((promo) => {
                                    const status = getPromoStatus(promo);
                                    return (
                                        <tr key={promo.id} className={getRowStyle(status.label)}>
                                            {isColumnVisible('code') && <td className={getCodeCellClass(status.label)}>{promo.code}</td>}
                                            {isColumnVisible('content') && <td className="px-4 py-4 text-sm font-semibold text-foreground text-center">+ {promo.free_cylinders || 0} bình khí</td>}
                                            {isColumnVisible('period') && <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(promo.start_date)} — {formatDate(promo.end_date)}</td>}
                                            {isColumnVisible('target') && <td className="px-4 py-4 text-sm text-muted-foreground">{promo.customer_type || '—'}</td>}
                                            {isColumnVisible('status') && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className={clsx('px-2.5 py-1 rounded-full text-[11px] font-bold border', status.style)}>{status.label}</span>
                                                </td>
                                            )}
                                            {isColumnVisible('active') && (
                                                <td className="px-4 py-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" className="sr-only peer" checked={promo.is_active} onChange={() => handleToggleActive(promo.id, promo.is_active)} />
                                                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                    </label>
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button onClick={() => handleEditPromo(promo)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDeletePromo(promo.id, promo.code)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>{filteredPromotions.length > 0 ? `1–${filteredPromotions.length}` : '0'}/Tổng {filteredPromotions.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{activeCount} hoạt động</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">{expiredCount} hết hạn/vô hiệu</span>
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'customerTypes' ? null : 'customerTypes')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('customerTypes', activeDropdown === 'customerTypes' || selectedCustomerTypes.length > 0)
                                        )}
                                    >
                                        <Gift size={14} className={getFilterIconClass('customerTypes', activeDropdown === 'customerTypes' || selectedCustomerTypes.length > 0)} />
                                        Loại khách hàng
                                        {selectedCustomerTypes.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customerTypes'))}>
                                                {selectedCustomerTypes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customerTypes' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'customerTypes' && (
                                        <FilterDropdown
                                            options={customerTypeOptions}
                                            selected={selectedCustomerTypes}
                                            setSelected={setSelectedCustomerTypes}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'active' ? null : 'active')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('active', activeDropdown === 'active' || selectedActiveStatus.length > 0)
                                        )}
                                    >
                                        <Tag size={14} className={getFilterIconClass('active', activeDropdown === 'active' || selectedActiveStatus.length > 0)} />
                                        Kích hoạt
                                        {selectedActiveStatus.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('active'))}>
                                                {selectedActiveStatus.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'active' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'active' && (
                                        <FilterDropdown
                                            options={activeOptions}
                                            selected={selectedActiveStatus}
                                            setSelected={setSelectedActiveStatus}
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
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Gift className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng KM</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredPromotionsCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Hoạt động</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(activeCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <Filter className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Hết hạn / Vô hiệu</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(expiredCount)}</p>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại khách hàng</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getCustomerTypeStats().map(item => item.name),
                                                datasets: [{
                                                    data: getCustomerTypeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getCustomerTypeStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Khuyến mãi (Số bình khí)</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getTopPromotions().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số bình khí',
                                                    data: getTopPromotions().map(item => item.value),
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
                            icon: <Filter size={16} className="text-amber-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'customerTypes',
                            label: 'Loại khách hàng',
                            icon: <Gift size={16} className="text-violet-600" />,
                            options: customerTypeOptions,
                            selectedValues: pendingCustomerTypes,
                            onSelectionChange: setPendingCustomerTypes,
                        },
                        {
                            id: 'active',
                            label: 'Kích hoạt',
                            icon: <Tag size={16} className="text-cyan-600" />,
                            options: activeOptions,
                            selectedValues: pendingActiveStatus,
                            onSelectionChange: setPendingActiveStatus,
                        }
                    ]}
                />
            )}

            {isFormModalOpen && (
                <PromotionFormModal
                    promotion={selectedPromo}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Promotions;