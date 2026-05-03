import React, { useState, useEffect, useRef } from 'react';
import { 
  PackageMinus, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  FileText,
  Truck,
  User,
  MapPin,
  Calendar,
  Package,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  X,
  List,
  BarChart2,
  ChevronDown,
  SlidersHorizontal,
  ActivitySquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { supabase } from '../supabase/config';
import { toast } from 'react-toastify';
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
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';

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

import {
    CUSTOMER_CATEGORIES,
    PRODUCT_TYPES,
    getOrderStatusMeta,
} from '../constants/orderConstants';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';

const TABLE_COLUMNS = [
    { key: 'order_code', label: 'Đơn hàng' },
    { key: 'customer_name', label: 'Khách hàng' },
    { key: 'product_type', label: 'Hàng hóa' },
    { key: 'quantity', label: 'Số lượng' },
    { key: 'updated_at', label: 'Ngày cập nhật' },
];

const ReturnOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [activeView, setActiveView] = useState('list');
    
    // Filters State
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedProductTypes, setSelectedProductTypes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);

    const [pendingCategories, setPendingCategories] = useState([]);
    const [pendingProductTypes, setPendingProductTypes] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    
    // Column Picker
    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_return_orders_order') || 'null');
            if (Array.isArray(saved) && saved.length > 0) return saved;
        } catch {}
        return defaultColOrder;
    });
    
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_return_orders') || 'null');
            if (Array.isArray(saved) && saved.length > 0) return saved;
        } catch {}
        return defaultColOrder;
    });
    const columnPickerRef = useRef(null);
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
        
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        console.log('📦 ReturnOrders Component Mounted');
        fetchReturnOrders();
    }, []);
    
    useEffect(() => {
        localStorage.setItem('columns_return_orders', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_return_orders_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColumnPicker]);

    const fetchReturnOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'TRA_HANG')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
            setSelectedIds([]);
        } catch (error) {
            console.error('Error fetching return orders:', error);
            toast.error('❌ Không thể tải danh sách đơn hàng trả về');
        } finally {
            setIsLoading(false);
        }
    };

    const dropdownRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
                setFilterSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const categoryOptions = React.useMemo(() => {
        const uniqueCategories = [...new Set(orders.map(o => o.customer_category || 'Khác'))];
        return uniqueCategories.map(cat => ({ 
            id: cat, 
            label: CUSTOMER_CATEGORIES.find(c => c.id === cat)?.label || cat 
        }));
    }, [orders]);

    const productTypeOptions = React.useMemo(() => {
        const uniqueTypes = [...new Set(orders.map(o => o.product_type))].filter(Boolean);
        return uniqueTypes.map(t => ({ 
            id: t, 
            label: PRODUCT_TYPES.find(p => p.id === t)?.label || t 
        }));
    }, [orders]);

    const customerOptions = React.useMemo(() => {
        const uniqueCustomers = [...new Set(orders.map(o => o.customer_name || 'Khách vãng lai'))].filter(Boolean);
        return uniqueCustomers.map(c => ({ id: c, label: c }));
    }, [orders]);

    const getFilterButtonClass = (filterType, isActive) => {
        return isActive ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/20';
    };

    const getFilterIconClass = (filterType, isActive) => {
        if (isActive) return 'text-primary';
        switch (filterType) {
            case 'categories': return 'text-blue-600';
            case 'productTypes': return 'text-violet-600';
            case 'customers': return 'text-cyan-600';
            default: return 'text-muted-foreground';
        }
    };

    const getFilterCountBadgeClass = (filterType) => {
        switch (filterType) {
            case 'categories': return 'bg-blue-500 text-white';
            case 'productTypes': return 'bg-violet-500 text-white';
            case 'customers': return 'bg-cyan-500 text-white';
            default: return 'bg-primary text-white';
        }
    };

    const hasActiveFilters = selectedCategories.length > 0 || selectedProductTypes.length > 0 || selectedCustomers.length > 0;
    const totalActiveFilters = selectedCategories.length + selectedProductTypes.length + selectedCustomers.length;

    const clearAllFilters = () => {
        setSelectedCategories([]);
        setSelectedProductTypes([]);
        setSelectedCustomers([]);
    };

    const openMobileFilter = () => {
        setPendingCategories([...selectedCategories]);
        setPendingProductTypes([...selectedProductTypes]);
        setPendingCustomers([...selectedCustomers]);
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
        setSelectedCategories(pendingCategories);
        setSelectedProductTypes(pendingProductTypes);
        setSelectedCustomers(pendingCustomers);
        closeMobileFilter();
    };

    const filteredOrders = orders.filter(order => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (order.order_code?.toLowerCase().includes(search)) ||
            (order.customer_name?.toLowerCase().includes(search)) ||
            (order.recipient_name?.toLowerCase().includes(search))
        );
        
        const cat = order.customer_category || 'Khác';
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(cat);
        const matchesProductType = selectedProductTypes.length === 0 || selectedProductTypes.includes(order.product_type);
        const cust = order.customer_name || 'Khách vãng lai';
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(cust);

        return matchesSearch && matchesCategory && matchesProductType && matchesCustomer;
    });

    const totalRecords = filteredOrders.length;
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const getStatusLabel = (statusId) => getOrderStatusMeta(statusId).label;

    const getProductLabel = (productId) => {
        return PRODUCT_TYPES.find(p => p.id === productId)?.label || productId;
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
        categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        !categoryId && 'bg-slate-50 text-slate-700 border-slate-200'
    );

    const handleCreateRecovery = (order) => {
        if (order.product_type?.startsWith('MAY')) {
            navigate('/thu-hoi-may', { state: { orderId: order.id, orderCode: order.order_code, customerName: order.customer_name } });
        } else {
            navigate('/thu-hoi-vo', { state: { orderId: order.id, orderCode: order.order_code, customerName: order.customer_name } });
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === paginatedOrders.length && paginatedOrders.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedOrders.map(o => o.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getCustomerCategoryStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const cat = order.customer_category || 'Khác';
            stats[cat] = (stats[cat] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getProductTypeStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const pLabel = getProductLabel(order.product_type);
            stats[pLabel] = (stats[pLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTopCustomersStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const customer = order.customer_name || 'Khách vãng lai';
            stats[customer] = (stats[customer] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const totalQuantity = filteredOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);

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
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm..."
                        actions={
                            <>
                                <button
                                    onClick={openMobileFilter}
                                    className={clsx(
                                        'relative p-2 rounded-xl border shrink-0 transition-all font-medium',
                                        hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 hover:bg-muted text-muted-foreground bg-white'
                                    )}
                                >
                                    <Filter size={18} />
                                    {hasActiveFilters && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                                            {totalActiveFilters}
                                        </span>
                                    )}
                                </button>
                                <button 
                                    onClick={fetchReturnOrders}
                                    disabled={isLoading}
                                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                                </button>
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-primary">{selectedIds.length}</span> đơn hàng
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

                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-4 flex flex-col gap-3 bg-slate-50/30">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : paginatedOrders.length === 0 ? (
                            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p className="font-bold text-slate-500 text-[13px]">Không tìm thấy đơn hàng</p>
                            </div>
                        ) : (
                            paginatedOrders.map((order, index) => (
                                <div key={order.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(order.id)
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                        : "border-primary/15 bg-white"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2 border-b border-slate-100 pb-3">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(order.id)}
                                                    onChange={() => toggleSelectOne(order.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{(currentPage - 1) * pageSize + index + 1}</p>
                                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{order.order_code}</h3>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700">
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>

                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100/50">
                                                <User size={14} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={getCategoryBadgeClass(order.customer_category)}>
                                                        {order.customer_category}
                                                    </span>
                                                    <p className="text-[13px] text-foreground font-bold truncate">
                                                        {order.customer_name}
                                                    </p>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate uppercase tracking-wide">
                                                    {order.recipient_name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 border border-amber-100/50">
                                                <Package size={14} />
                                            </div>
                                            <div className="min-w-0 flex-1 flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">Hàng hóa</p>
                                                    <p className="text-[12px] text-slate-700 font-bold truncate leading-none">
                                                        {getProductLabel(order.product_type)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold mb-0.5">SL</p>
                                                    <p className="text-[14px] text-rose-600 font-black leading-none">
                                                        {order.quantity}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                            <Calendar size={12} className="text-slate-400" />
                                            {new Date(order.updated_at).toLocaleDateString('vi-VN')}
                                        </div>
                                        <button 
                                            onClick={() => handleCreateRecovery(order)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-black transition-all shadow-md shadow-rose-600/20 active:scale-95"
                                        >
                                            <RefreshCw size={12} />
                                            Tạo phiếu
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {!isLoading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}

                    <div className="hidden md:flex flex-col p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => navigate('/thu-hoi')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0 h-10"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm . . ."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium h-10"
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
                                            'flex items-center gap-2 px-4 h-10 rounded-lg border text-[13px] font-bold transition-all bg-white shadow-sm',
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
                                    onClick={fetchReturnOrders}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 h-10 rounded-lg border border-border text-[13px] font-bold transition-all bg-white shadow-sm hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw size={16} className={clsx(isLoading && "animate-spin")} />
                                    Làm mới
                                </button>
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-2" ref={dropdownRef}>
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                            className={clsx(
                                                'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                                getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)
                                            )}
                                        >
                                            <Filter size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)} />
                                            Phân loại
                                            {selectedCategories.length > 0 && (
                                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('categories'))}>
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
                                    
                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes')}
                                            className={clsx(
                                                'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                                getFilterButtonClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)
                                            )}
                                        >
                                            <ActivitySquare size={14} className={getFilterIconClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)} />
                                            Hàng hóa
                                            {selectedProductTypes.length > 0 && (
                                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('productTypes'))}>
                                                    {selectedProductTypes.length}
                                                </span>
                                            )}
                                            <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'productTypes' ? 'rotate-180' : '')} />
                                        </button>
                                        {activeDropdown === 'productTypes' && (
                                            <FilterDropdown
                                                options={productTypeOptions}
                                                selected={selectedProductTypes}
                                                setSelected={setSelectedProductTypes}
                                                filterSearch={filterSearch}
                                                setFilterSearch={setFilterSearch}
                                            />
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                            className={clsx(
                                                'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                                getFilterButtonClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)
                                            )}
                                        >
                                            <User size={14} className={getFilterIconClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)} />
                                            Khách hàng
                                            {selectedCustomers.length > 0 && (
                                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customers'))}>
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

                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearAllFilters}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all ml-1 h-10 shrink-0"
                                        >
                                            <X size={14} />
                                            Xóa bộ lọc
                                        </button>
                                    )}
                                </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    <th className="w-10 min-w-[44px] max-w-[44px] px-2 py-3.5 text-center border-r border-primary/30">
                                        <div className="flex justify-center w-full">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length === paginatedOrders.length && paginatedOrders.length > 0}
                                                onChange={toggleSelectAll}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </div>
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                'px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide',
                                                col.key === 'order_code' && 'border-l border-r border-primary/30'
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : paginatedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            <div className="flex items-center justify-center gap-3 w-full">
                                                <Package size={24} className="opacity-30" />
                                                <span>Không có đơn hàng trả về nào</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginatedOrders.map((order) => (
                                    <tr key={order.id} className={clsx(
                                        "hover:bg-primary/5 transition-colors",
                                        selectedIds.includes(order.id) && "bg-primary/[0.04]"
                                    )}>
                                        <td className="w-10 min-w-[44px] max-w-[44px] px-2 py-4 text-center border-r border-primary/20">
                                            <div className="flex justify-center w-full">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(order.id)}
                                                    onChange={() => toggleSelectOne(order.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                        </td>
                                        {visibleTableColumns.map((col) => {
                                            if (col.key === 'order_code') {
                                                return <td key={col.key} className="px-4 py-4 text-sm font-semibold text-foreground font-mono border-l border-r border-primary/20 border-l-4 border-l-rose-400">{order.order_code}</td>;
                                            }
                                            if (col.key === 'customer_name') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className={getCategoryBadgeClass(order.customer_category)}>
                                                                {order.customer_category}
                                                            </span>
                                                            <span className="font-bold text-slate-700">{order.customer_name}</span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                                                            <User size={10} /> {order.recipient_name}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'product_type') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-xs font-bold shadow-sm">
                                                            {getProductLabel(order.product_type)}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'quantity') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        <div className="px-3 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 text-sm font-black inline-block min-w-[2.5rem] text-center shadow-sm">
                                                            {order.quantity}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'updated_at') {
                                                return <td key={col.key} className="px-4 py-4 text-sm font-medium text-slate-500">{new Date(order.updated_at).toLocaleDateString('vi-VN')}</td>;
                                            }
                                            return <td key={col.key} className="px-4 py-4 text-sm">—</td>;
                                        })}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <button 
                                                onClick={() => handleCreateRecovery(order)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/20 active:scale-95"
                                            >
                                                <RefreshCw size={14} />
                                                Tạo phiếu
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5 rounded-b-2xl">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>
                                {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / Tổng {totalRecords}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setCurrentPage(1)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20 shadow-sm" 
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                                <ChevronLeft size={16} className="-ml-2.5" />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20 shadow-sm" 
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                                {currentPage}
                            </div>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20 shadow-sm" 
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0}
                            >
                                <ChevronLeft size={16} className="rotate-180" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
                    <div className="space-y-0">
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê trả hàng</h2>
                            <button
                                onClick={openMobileFilter}
                                className={clsx(
                                    'relative p-2 rounded-xl border shrink-0 transition-all font-medium',
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 hover:bg-muted text-muted-foreground bg-white'
                                )}
                            >
                                <Filter size={18} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="hidden md:flex p-4 border-b border-border items-center gap-2" ref={dropdownRef}>
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0 h-10"
                            >
                                <ChevronLeft size={16} />
                                Quay lại
                            </button>
                            
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                        getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)
                                    )}
                                >
                                    <Filter size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)} />
                                    Phân loại
                                    {selectedCategories.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('categories'))}>
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
                            
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                        getFilterButtonClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)
                                    )}
                                >
                                    <ActivitySquare size={14} className={getFilterIconClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)} />
                                    Hàng hóa
                                    {selectedProductTypes.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('productTypes'))}>
                                            {selectedProductTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'productTypes' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'productTypes' && (
                                    <FilterDropdown
                                        options={productTypeOptions}
                                        selected={selectedProductTypes}
                                        setSelected={setSelectedProductTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all h-10 bg-white shadow-sm',
                                        getFilterButtonClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)
                                    )}
                                >
                                    <User size={14} className={getFilterIconClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)} />
                                    Khách hàng
                                    {selectedCustomers.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('customers'))}>
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

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all ml-1 h-10 shrink-0"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-2 gap-3 md:gap-4">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                            <PackageMinus className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng đơn</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{totalRecords}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-rose-200/70">
                                            <Package className="w-5 h-5 md:w-6 md:h-6 text-rose-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Tổng số lượng</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{totalQuantity}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Hàng hóa</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getProductTypeStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    data: getProductTypeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getProductTypeStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Phân loại KH</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getCustomerCategoryStats().map(item => item.name),
                                                datasets: [{
                                                    data: getCustomerCategoryStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getCustomerCategoryStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top khách hàng trả hàng</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getTopCustomersStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số đơn',
                                                    data: getTopCustomersStats().map(item => item.value),
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
                            id: 'categories',
                            label: 'Phân loại KH',
                            icon: <Filter size={16} className="text-blue-600" />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        },
                        {
                            id: 'productTypes',
                            label: 'Hàng hóa',
                            icon: <ActivitySquare size={16} className="text-violet-600" />,
                            options: productTypeOptions,
                            selectedValues: pendingProductTypes,
                            onSelectionChange: setPendingProductTypes,
                        },
                        {
                            id: 'customers',
                            label: 'Khách hàng',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: customerOptions,
                            selectedValues: pendingCustomers,
                            onSelectionChange: setPendingCustomers,
                        }
                    ]}
                    clearAll={() => {
                        setPendingCategories([]);
                        setPendingProductTypes([]);
                        setPendingCustomers([]);
                    }}
                    hasActiveFilters={pendingCategories.length > 0 || pendingProductTypes.length > 0 || pendingCustomers.length > 0}
                />
            )}
        </div>
    );
};

export default ReturnOrders;

