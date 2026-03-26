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
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    ClipboardCheck,
    Edit,
    Filter,
    List,
    BarChart2,
    MapPin,
    Package,
    Phone,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    X
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import MachineHandoverPrintTemplate from '../components/MachineHandoverPrintTemplate';
import OrderPrintTemplate from '../components/OrderPrintTemplate';
import OrderFormModal from '../components/Orders/OrderFormModal';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import {
    CUSTOMER_CATEGORIES,
    ORDER_STATUSES,
    ORDER_TYPES,
    PRODUCT_TYPES,
    TABLE_COLUMNS
} from '../constants/orderConstants';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';
import useReports from '../hooks/useReports';

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

const Orders = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [ordersToPrint, setOrdersToPrint] = useState(null);
    const [handoverToPrint, setHandoverToPrint] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState(null);
    const [serialsModalOrder, setSerialsModalOrder] = useState(null);
    const [warehousesList, setWarehousesList] = useState([]);
    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_orders_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_orders') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);

    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter states
    const [selectedCustomerCategories, setSelectedCustomerCategories] = useState([]);
    const [selectedOrderTypes, setSelectedOrderTypes] = useState([]);
    const [selectedProductTypes, setSelectedProductTypes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);

    // Mobile filter sheet state
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomerCategories, setPendingCustomerCategories] = useState([]);
    const [pendingOrderTypes, setPendingOrderTypes] = useState([]);
    const [pendingProductTypes, setPendingProductTypes] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);

    // Dropdown state
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null); // Keep this for backward compatibility if used elsewhere, but we'll use specific refs
    const listDropdownRef = useRef(null);
    const statsDropdownRef = useRef(null);
    const { fetchCustomerCylinderDebt } = useReports();
    const [allCustomerDebts, setAllCustomerDebts] = useState({}); // customer_id -> debt array

    useEffect(() => {
        fetchOrders();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        // Extract unique customers from orders
        const customers = [...new Set(orders.map(o => o.customer_name).filter(Boolean))];
        setUniqueCustomers(customers);
        
        // Fetch debts for all customers in the orders list
        if (orders.length > 0) {
            fetchAllDebts(orders);
        }
    }, [orders]);

    const fetchAllDebts = async (currentOrders) => {
        const uniqueCustomerIds = [...new Set(currentOrders.map(o => o.customer_id).filter(Boolean))];
        const debtMap = {};
        
        // Fetch in parallel for better performance
        await Promise.all(uniqueCustomerIds.map(async (cid) => {
            const debt = await fetchCustomerCylinderDebt(cid);
            debtMap[cid] = debt;
        }));
        
        setAllCustomerDebts(debtMap);
    };

    useEffect(() => {
        localStorage.setItem('columns_orders', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_orders_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
        };
        if (showColumnPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColumnPicker]);

    // Mobile filter handlers
    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingCustomerCategories(selectedCustomerCategories);
        setPendingOrderTypes(selectedOrderTypes);
        setPendingProductTypes(selectedProductTypes);
        setPendingCustomers(selectedCustomers);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedCustomerCategories(pendingCustomerCategories);
        setSelectedOrderTypes(pendingOrderTypes);
        setSelectedProductTypes(pendingProductTypes);
        setSelectedCustomers(pendingCustomers);
        closeMobileFilter();
    };

    // Dropdown handlers
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
    }, []);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
            alert('❌ Không thể tải danh sách đơn hàng: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const filteredOrders = orders.filter(order => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (order.order_code?.toLowerCase().includes(search)) ||
            (order.customer_name?.toLowerCase().includes(search)) ||
            (order.recipient_name?.toLowerCase().includes(search)) ||
            (order.recipient_phone?.toLowerCase().includes(search))
        );

        // Filter by status
        const matchesStatus = selectedStatuses.length === 0 ||
            selectedStatuses.includes(order.status);

        // Filter by customer category
        const matchesCategory = selectedCustomerCategories.length === 0 ||
            selectedCustomerCategories.includes(order.customer_category);

        // Filter by order type
        const matchesOrderType = selectedOrderTypes.length === 0 ||
            selectedOrderTypes.includes(order.order_type);

        // Filter by product type
        const matchesProductType = selectedProductTypes.length === 0 ||
            selectedProductTypes.includes(order.product_type);

        // Filter by customer name
        const matchesCustomer = selectedCustomers.length === 0 ||
            selectedCustomers.includes(order.customer_name);

        return matchesSearch && matchesStatus && matchesCategory &&
            matchesOrderType && matchesProductType && matchesCustomer;
    });

    // Calculate totals
    const filteredOrdersCount = filteredOrders.length;
    const totalAmount = filteredOrders.reduce((sum, order) => {
        return sum + (order.total_amount || (order.quantity || 0) * (order.unit_price || 0));
    }, 0);

    const getStatusConfig = (statusId) => {
        return ORDER_STATUSES.find(s => s.id === statusId) || ORDER_STATUSES[0];
    };

    const getStatusBadgeClass = (statusColor) => clsx(
        'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold',
        statusColor === 'blue' && 'bg-blue-100 text-blue-700',
        statusColor === 'yellow' && 'bg-amber-100 text-amber-700',
        statusColor === 'orange' && 'bg-orange-100 text-orange-700',
        statusColor === 'green' && 'bg-emerald-100 text-emerald-700',
        statusColor === 'red' && 'bg-red-100 text-red-700',
        statusColor === 'gray' && 'bg-muted text-muted-foreground',
        !statusColor && 'bg-muted text-muted-foreground'
    );

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'status':
                return 'border-blue-200 bg-blue-50 text-blue-700';
            case 'categories':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            case 'orderTypes':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            case 'productTypes':
                return 'border-amber-200 bg-amber-50 text-amber-700';
            case 'customers':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'status':
                return 'bg-blue-600 text-white';
            case 'categories':
                return 'bg-emerald-600 text-white';
            case 'orderTypes':
                return 'bg-violet-600 text-white';
            case 'productTypes':
                return 'bg-amber-600 text-white';
            case 'customers':
                return 'bg-cyan-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'status':
                return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'categories':
                return isActive ? 'text-emerald-700' : 'text-emerald-500';
            case 'orderTypes':
                return isActive ? 'text-violet-700' : 'text-violet-500';
            case 'productTypes':
                return isActive ? 'text-amber-700' : 'text-amber-500';
            case 'customers':
                return isActive ? 'text-cyan-700' : 'text-cyan-500';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
        categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        categoryId === 'NG' && 'bg-violet-50 text-violet-700 border-violet-200',
        categoryId === 'SP' && 'bg-amber-50 text-amber-700 border-amber-200',
        !categoryId && 'bg-muted text-muted-foreground border-border'
    );

    const getOrderTypeBadgeClass = (orderTypeId) => clsx(
        'inline-flex items-center text-[11px] font-semibold',
        orderTypeId && 'text-foreground',
        !orderTypeId && 'text-muted-foreground'
    );

    const getProductTypeBadgeClass = (productTypeId) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
        productTypeId?.startsWith('MAY') && 'bg-amber-50 text-amber-700 border-amber-200',
        (!productTypeId || !productTypeId.startsWith('MAY')) && 'bg-blue-50 text-blue-700 border-blue-200'
    );

    const getLabel = (list, id) => {
        const matched = list.find(item => item.id === id);
        return matched?.label || matched?.name || id;
    };

    const hasActiveFilters = selectedStatuses.length > 0 || selectedCustomerCategories.length > 0 || 
        selectedOrderTypes.length > 0 || selectedProductTypes.length > 0 || selectedCustomers.length > 0;

    const totalActiveFilters = selectedStatuses.length + selectedCustomerCategories.length + 
        selectedOrderTypes.length + selectedProductTypes.length + selectedCustomers.length;

    // Filter options for the modern FilterDropdown
    const statusOptions = ORDER_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: orders.filter(o => o.status === s.id).length
    }));

    const categoryOptions = CUSTOMER_CATEGORIES.map(c => ({
        id: c.id,
        label: c.label,
        count: orders.filter(o => o.customer_category === c.id).length
    }));

    const orderTypeOptions = ORDER_TYPES.map(t => ({
        id: t.id,
        label: t.label,
        count: orders.filter(o => o.order_type === t.id).length
    }));

    const productTypeOptions = PRODUCT_TYPES.map(p => ({
        id: p.id,
        label: p.label,
        count: orders.filter(o => o.product_type === p.id).length
    }));

    const customerOptions = uniqueCustomers.map(c => ({
        id: c,
        label: c,
        count: orders.filter(o => o.customer_name === c).length
    }));

    const handlePrint = (order) => {
        const orderWithDebt = {
            ...order,
            customer_debt: allCustomerDebts[order.customer_id] || []
        };
        setOrdersToPrint(orderWithDebt);
        setHandoverToPrint(null);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handleHandoverPrint = (order) => {
        setOrdersToPrint(null);
        setHandoverToPrint(order);
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handleBulkPrint = () => {
        if (selectedIds.length === 0) {
            alert('⚠️ Vui lòng chọn ít nhất một đơn hàng để in!');
            return;
        }

        const selectedOrders = orders
            .filter(o => selectedIds.includes(o.id))
            .map(o => ({
                ...o,
                customer_debt: allCustomerDebts[o.customer_id] || []
            }));
            
        setOrdersToPrint(selectedOrders);

        setTimeout(() => {
            window.print();
        }, 150);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredOrders.map(o => o.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleAction = (order) => {
        setSelectedOrder(order);
        setIsActionModalOpen(true);
    };

    const handleDeleteOrder = async (id, orderCode) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${orderCode} không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('❌ Có lỗi xảy ra khi xóa đơn hàng: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} đơn hàng đã chọn không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchOrders();
            alert('✅ Đã xóa các đơn hàng thành công!');
        } catch (error) {
            console.error('Error deleting orders:', error);
            alert('❌ Có lỗi xảy ra khi xóa danh sách đơn hàng: ' + error.message);
        }
    };

    const handleEditOrder = (order) => {
        setOrderToEdit(order);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchOrders();
        setIsFormModalOpen(false);
    };

    const getRowStyle = (category, isSelected) => {
        let baseStyle = "group border-l-4 ";
        if (isSelected) baseStyle += "bg-blue-50/40 border-l-blue-500 ";
        else {
            switch (category) {
                case 'BV': baseStyle += "border-l-blue-400 hover:bg-blue-50/60 "; break;
                case 'TM': baseStyle += "border-l-pink-400 hover:bg-pink-50/60 "; break;
                case 'PK': baseStyle += "border-l-emerald-400 hover:bg-emerald-50/60 "; break;
                case 'NG': baseStyle += "border-l-violet-400 hover:bg-violet-50/60 "; break;
                case 'SP': baseStyle += "border-l-amber-400 hover:bg-amber-50/60 "; break;
                default: baseStyle += "border-l-transparent hover:bg-blue-50/60 ";
            }
        }
        return baseStyle;
    };

    // Calculate statistics data for charts
    const getStatusStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const statusLabel = getStatusConfig(order.status).label;
            stats[statusLabel] = (stats[statusLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCategoryStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const categoryLabel = getLabel(CUSTOMER_CATEGORIES, order.customer_category);
            stats[categoryLabel] = (stats[categoryLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getOrderTypeStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const typeLabel = getLabel(ORDER_TYPES, order.order_type);
            stats[typeLabel] = (stats[typeLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getProductTypeStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const productLabel = getLabel(PRODUCT_TYPES, order.product_type);
            stats[productLabel] = (stats[productLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerStats = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const customer = order.customer_name || 'Không xác định';
            stats[customer] = (stats[customer] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10
    };

    const getRevenueByStatus = () => {
        const stats = {};
        filteredOrders.forEach(order => {
            const statusLabel = getStatusConfig(order.status).label;
            const amount = order.total_amount || (order.quantity || 0) * (order.unit_price || 0);
            stats[statusLabel] = (stats[statusLabel] || 0) + amount;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const renderCell = (key, order) => {
        const status = getStatusConfig(order.status);
        switch (key) {
            case 'code':
                return (
                    <span className="text-[13px] font-medium text-foreground">
                        {order.order_code}
                    </span>
                );
            case 'category':
                return (
                    <span className={getCategoryBadgeClass(order.customer_category)}>
                        {getLabel(CUSTOMER_CATEGORIES, order.customer_category)}
                    </span>
                );
            case 'customer':
                return <span className="text-[13px] font-medium text-foreground">{order.customer_name}</span>;
            case 'recipient':
                return <span className="text-[13px] text-muted-foreground font-normal">{order.recipient_name}</span>;
            case 'type':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold">
                        {getLabel(ORDER_TYPES, order.order_type)}
                    </span>
                );
            case 'product':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                        {getLabel(PRODUCT_TYPES, order.product_type)}
                    </span>
                );
            case 'quantity':
                return <span className="text-[13px] font-semibold text-foreground">{formatNumber(order.quantity)}</span>;
            case 'department':
                return <span className="text-[13px] text-muted-foreground font-normal">{order.department || '—'}</span>;
            case 'cylinders':
                return (
                    order.assigned_cylinders && order.assigned_cylinders.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                            {order.assigned_cylinders.slice(0, 3).map((serial, idx) => (
                                <span key={idx} className="px-2.5 py-1 bg-muted/30 text-muted-foreground rounded-md text-xs font-medium border border-border">
                                    {serial}
                                </span>
                            ))}
                            {order.assigned_cylinders.length > 3 && (
                                <button
                                    onClick={() => setSerialsModalOrder(order)}
                                    type="button"
                                    className="!h-auto !px-2.5 !py-1 !rounded-full !text-xs !font-semibold inline-flex items-center justify-center min-w-[40px] bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                                    title="Bấm để xem danh sách đầy đủ"
                                >
                                    +{order.assigned_cylinders.length - 3}
                                </button>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    )
                );
            case 'cylinder_debt':
                return (
                    <div className="flex flex-col gap-0.5">
                        {(allCustomerDebts[order.customer_id] || []).length > 0 ? (
                            allCustomerDebts[order.customer_id].map((debt, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2 whitespace-nowrap">
                                    <span className="text-slate-500 font-medium">{debt.cylinder_type}:</span>
                                    <span className="text-rose-600 font-bold">{debt.balance}</span>
                                </div>
                            ))
                        ) : (
                            <span className="text-slate-400 italic">Hết nợ</span>
                        )}
                    </div>
                );
            case 'status':
                return (
                    <span className={getStatusBadgeClass(status.color)}>
                        {status.label}
                    </span>
                );
            case 'date':
                return order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---';
            default:
                return order[key] || '—';
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            {/* Top Sidebar Style Tabs */}
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'list'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <List size={14} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'stats'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <BarChart2 size={14} />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                        {/* ── MOBILE TOOLBAR ── */}
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

                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="relative p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 shrink-0 transition-all shadow-sm"
                            title="Xóa các đơn hàng đã chọn"
                        >
                            <Trash2 size={18} />
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                                {selectedIds.length}
                            </span>
                        </button>
                    )}

                    <button
                        onClick={() => {
                            setOrderToEdit(null);
                            setIsFormModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                    >
                        <Plus size={18} />
                    </button>
                    <button
                        onClick={() => {
                            setOrderToEdit(null);
                            navigate('/de-nghi-xuat-may/tao');
                        }}
                        className="p-2 px-3 flex items-center gap-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-md shadow-emerald-600/20 text-[13px] font-bold"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Đề nghị xuất máy</span>
                    </button>
                </div>

                {/* ── MOBILE CARD LIST ── */}
                <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                    {isLoading ? (
                        <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                    ) : (
                        filteredOrders.map((order) => {
                            const status = getStatusConfig(order.status);
                            const isSelected = selectedIds.includes(order.id);
                            return (
                                <div key={order.id} className={clsx(
                                    "border rounded-2xl p-4 shadow-sm transition-all duration-200",
                                    isSelected 
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20" 
                                        : "border-primary/15 bg-white"
                                )}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                checked={selectedIds.includes(order.id)}
                                                onChange={() => toggleSelect(order.id)}
                                            />
                                            <span className="text-[13px] font-bold text-foreground">{order.order_code}</span>
                                        </div>
                                        <span className={clsx(getStatusBadgeClass(status.color), 'text-[10px] uppercase')}>
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="text-[14px] font-bold text-foreground leading-snug">{order.customer_name}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                            <span className={getCategoryBadgeClass(order.customer_category)}>{getLabel(CUSTOMER_CATEGORIES, order.customer_category)}</span>
                                            <span className="text-[11px] font-medium text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-2 text-xs mb-3 bg-muted/10 rounded-xl p-2.5 border border-border/60">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                                <span className={getProductTypeBadgeClass(order.product_type)}>{getLabel(PRODUCT_TYPES, order.product_type)}</span>
                                            </p>
                                            <p className="text-foreground font-bold ml-5">SL: {formatNumber(order.quantity)}</p>
                                        </div>
                                        <div className="space-y-1 pl-2 border-l border-border">
                                            <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                                Kho: {getLabel(warehousesList, order.warehouse)}
                                            </p>
                                            <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="flex items-center gap-1">
                                                    <span className="text-muted-foreground">Loại:</span>
                                                    <span className={getOrderTypeBadgeClass(order.order_type)}>{getLabel(ORDER_TYPES, order.order_type)}</span>
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {(order.recipient_name || order.recipient_phone) && (
                                        <div className="bg-cyan-50/30 rounded-lg p-2.5 space-y-1 border border-cyan-100 mb-3">
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase leading-none mb-1">Người nhận</p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-xs font-bold text-foreground">{order.recipient_name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Phone className="w-3 h-3" />
                                                    <span className="text-[11px] font-medium">{order.recipient_phone}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-amber-50/40 rounded-lg p-2.5 border border-amber-100/50 mb-3">
                                        <p className="text-[10px] font-bold text-amber-700 uppercase leading-none mb-2">Thông tin nợ vỏ (Thu hồi)</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(allCustomerDebts[order.customer_id] || []).length > 0 ? (
                                                allCustomerDebts[order.customer_id].map((debt, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white/60 p-1.5 rounded-md border border-amber-200/30">
                                                        <span className="text-[10px] text-slate-500 font-medium">{debt.cylinder_type}</span>
                                                        <span className="text-xs text-rose-600 font-black">{debt.balance}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-2 text-[10px] text-slate-400 italic">Không có nợ vỏ</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-border">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Thành tiền</span>
                                            <span className="text-[14px] font-bold text-primary">
                                                {formatNumber(order.total_amount || (order.quantity || 0) * (order.unit_price || 0))} <small className="text-[10px]">đ</small>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => { setSelectedOrder(order); setIsActionModalOpen(true); }}
                                                className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg"
                                                title="Thao tác đơn hàng"
                                            >
                                                <Package className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handlePrint(order)}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            {order.product_type?.startsWith('MAY') && (
                                                <button
                                                    onClick={() => handleHandoverPrint(order)}
                                                    className="p-2 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title="In biên bản bàn giao (BBBG)"
                                                >
                                                    <ClipboardCheck className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEditOrder(order)}
                                                className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <button
                        onClick={handleBulkPrint}
                        className="md:hidden fixed right-4 bottom-4 z-[95] flex items-center gap-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/20"
                    >
                        <Printer size={16} />
                        In {selectedIds.length} phiếu
                    </button>
                )}

                {/* Mobile pagination */}
                <div className="md:hidden px-4 py-3 border-t border-border flex items-center justify-between bg-muted/5">
                    <span className="text-[12px] text-muted-foreground font-medium">
                        {filteredOrders.length > 0 ? `1–${filteredOrders.length}` : '0'}/Tổng {filteredOrders.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <select className="bg-white border border-border rounded-lg px-2 py-1 focus:outline-none text-[11px] font-bold shadow-sm">
                            <option>20 / trang</option>
                            <option>50 / trang</option>
                        </select>
                        <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-20" disabled><ChevronLeft size={15} /></button>
                        <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center text-[11px] font-bold">1</div>
                        <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-20" disabled><ChevronRight size={15} /></button>
                    </div>
                </div>

                {/* ── DESKTOP TOOLBAR ── */}
                <div className="hidden md:block p-3 space-y-3">
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
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                                    <button
                                        onClick={handleBulkPrint}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-border bg-white text-muted-foreground text-[13px] font-bold hover:bg-muted/20 shadow-sm transition-all"
                                    >
                                        <Printer size={16} />
                                        In {selectedIds.length} phiếu
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all"
                                    >
                                        <Trash2 size={16} />
                                        Xóa ({selectedIds.length})
                                    </button>
                                </div>
                            )}
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
                                    setOrderToEdit(null);
                                    setIsFormModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                            >
                                <Plus size={18} />
                                Thêm
                            </button>
                            <button
                                onClick={() => {
                                    setOrderToEdit(null);
                                    navigate('/de-nghi-xuat-may/tao');
                                }}
                                className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all"
                            >
                                <Plus size={18} />
                                Đề nghị xuất máy
                            </button>
                        </div>
                    </div>

                    {/* Secondary Filters */}
                    <div className="flex flex-wrap items-center gap-2" ref={listDropdownRef}>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (activeDropdown !== 'status') setFilterSearch('');
                                    setActiveDropdown(activeDropdown === 'status' ? null : 'status');
                                }}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                )}
                            >
                                <Filter size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                Trạng thái
                                {selectedStatuses.length > 0 && (
                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('status'))}>
                                        {selectedStatuses.length}
                                    </span>
                                )}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
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
                                onClick={() => {
                                    if (activeDropdown !== 'categories') setFilterSearch('');
                                    setActiveDropdown(activeDropdown === 'categories' ? null : 'categories');
                                }}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCustomerCategories.length > 0)
                                )}
                            >
                                <User size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCustomerCategories.length > 0)} />
                                Loại khách
                                {selectedCustomerCategories.length > 0 && (
                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('categories'))}>
                                        {selectedCustomerCategories.length}
                                    </span>
                                )}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'categories' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'categories' && (
                                <FilterDropdown
                                    options={categoryOptions}
                                    selected={selectedCustomerCategories}
                                    setSelected={setSelectedCustomerCategories}
                                    filterSearch={filterSearch}
                                    setFilterSearch={setFilterSearch}
                                />
                            )}
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (activeDropdown !== 'orderTypes') setFilterSearch('');
                                    setActiveDropdown(activeDropdown === 'orderTypes' ? null : 'orderTypes');
                                }}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    getFilterButtonClass('orderTypes', activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0)
                                )}
                            >
                                <Package size={14} className={getFilterIconClass('orderTypes', activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0)} />
                                Loại đơn
                                {selectedOrderTypes.length > 0 && (
                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('orderTypes'))}>
                                        {selectedOrderTypes.length}
                                    </span>
                                )}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'orderTypes' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'orderTypes' && (
                                <FilterDropdown
                                    options={orderTypeOptions}
                                    selected={selectedOrderTypes}
                                    setSelected={setSelectedOrderTypes}
                                    filterSearch={filterSearch}
                                    setFilterSearch={setFilterSearch}
                                />
                            )}
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (activeDropdown !== 'productTypes') setFilterSearch('');
                                    setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes');
                                }}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    getFilterButtonClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)
                                )}
                            >
                                <Package size={14} className={getFilterIconClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)} />
                                Hàng hóa
                                {selectedProductTypes.length > 0 && (
                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('productTypes'))}>
                                        {selectedProductTypes.length}
                                    </span>
                                )}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'productTypes' ? "rotate-180" : "")} />
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
                                onClick={() => {
                                    if (activeDropdown !== 'customers') setFilterSearch('');
                                    setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
                                }}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
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
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'customers' ? "rotate-180" : "")} />
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
                                onClick={() => {
                                    setSelectedStatuses([]);
                                    setSelectedCustomerCategories([]);
                                    setSelectedOrderTypes([]);
                                    setSelectedProductTypes([]);
                                    setSelectedCustomers([]);
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                            >
                                <X size={14} />
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </div>

                {/* Table Content Area */}
                <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                    <table className="w-full border-collapse">
                        <thead className="bg-[#F1F5FF]">
                            <tr>
                                <th className="px-4 py-3.5 w-10">
                                    <div className="flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                            checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </div>
                                </th>
                                {visibleTableColumns.map(col => (
                                    <th
                                        key={col.key}
                                        className={clsx(
                                            "px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide",
                                            col.key === 'code' && 'border-l border-r border-primary/10'
                                        )}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th className="sticky right-0 z-30 bg-[#F1F5FF] px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-primary/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                        Không tìm thấy đơn hàng nào
                                    </td>
                                </tr>
                            ) : filteredOrders.map((order) => {
                                const status = getStatusConfig(order.status);
                                return (
                                    <tr key={order.id} className={getRowStyle(order.customer_category, selectedIds.includes(order.id))}>
                                        <td className="px-4 py-4 uppercase">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                    checked={selectedIds.includes(order.id)}
                                                    onChange={() => toggleSelect(order.id)}
                                                />
                                            </div>
                                        </td>
                                        {visibleTableColumns.map(col => (
                                            <td 
                                                key={col.key} 
                                                className={clsx(
                                                    "px-4 py-4",
                                                    col.key === 'code' && 'border-l border-r border-primary/10'
                                                )}
                                            >
                                                {renderCell(col.key, order)}
                                            </td>
                                        ))}
                                        <td className="sticky right-0 z-20 bg-white px-4 py-4 text-center shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.25)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setIsActionModalOpen(true); }}
                                                    className="text-emerald-600/80 hover:text-emerald-700 transition-colors p-1 rounded hover:bg-emerald-50"
                                                    title="Thao tác đơn hàng"
                                                >
                                                    <Package className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(order)}
                                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-primary/10"
                                                    title={order.product_type?.startsWith('MAY') ? 'In phiếu xuất kho + biên bản bàn giao máy' : 'In phiếu xuất kho'}
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                {order.product_type?.startsWith('MAY') && (
                                                    <button
                                                        onClick={() => handleHandoverPrint(order)}
                                                        className="text-muted-foreground hover:text-green-600 transition-colors p-1 rounded hover:bg-green-50"
                                                        title="In biên bản bàn giao (BBBG)"
                                                    >
                                                        <ClipboardCheck className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditOrder(order)}
                                                    className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id, order.order_code)}
                                                    className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                                                    title="Xóa"
                                                >
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

                {/* Footer / Pagination */}
                <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                        <span>{filteredOrders.length > 0 ? `1–${filteredOrders.length}` : '0'}/Tổng {filteredOrders.length}</span>
                        <div className="flex items-center gap-1 ml-2">
                            <span className="text-[11px] font-bold">│</span>
                            <span className="text-primary font-bold">{formatNumber(totalAmount)} đ</span>
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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
                    <div className="space-y-0">
                        {/* Mobile Header */}
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

                        {/* Desktop Header */}
                        <div className="hidden md:block p-4 border-b border-border" ref={statsDropdownRef}>
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
                                        onClick={() => {
                                            if (activeDropdown !== 'status') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'status' ? null : 'status');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('status'))}>
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
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
                                        onClick={() => {
                                            if (activeDropdown !== 'categories') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'categories' ? null : 'categories');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCustomerCategories.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCustomerCategories.length > 0)} />
                                        Loại khách
                                        {selectedCustomerCategories.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('categories'))}>
                                                {selectedCustomerCategories.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'categories' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'categories' && (
                                        <FilterDropdown
                                            options={categoryOptions}
                                            selected={selectedCustomerCategories}
                                            setSelected={setSelectedCustomerCategories}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            if (activeDropdown !== 'orderTypes') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'orderTypes' ? null : 'orderTypes');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass('orderTypes', activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0)
                                        )}
                                    >
                                        <Package size={14} className={getFilterIconClass('orderTypes', activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0)} />
                                        Loại đơn
                                        {selectedOrderTypes.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('orderTypes'))}>
                                                {selectedOrderTypes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'orderTypes' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'orderTypes' && (
                                        <FilterDropdown
                                            options={orderTypeOptions}
                                            selected={selectedOrderTypes}
                                            setSelected={setSelectedOrderTypes}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            if (activeDropdown !== 'productTypes') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)
                                        )}
                                    >
                                        <Package size={14} className={getFilterIconClass('productTypes', activeDropdown === 'productTypes' || selectedProductTypes.length > 0)} />
                                        Hàng hóa
                                        {selectedProductTypes.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('productTypes'))}>
                                                {selectedProductTypes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'productTypes' ? "rotate-180" : "")} />
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
                                        onClick={() => {
                                            if (activeDropdown !== 'customers') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
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
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'customers' ? "rotate-180" : "")} />
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
                                        onClick={() => {
                                            setSelectedStatuses([]);
                                            setSelectedCustomerCategories([]);
                                            setSelectedOrderTypes([]);
                                            setSelectedProductTypes([]);
                                            setSelectedCustomers([]);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <Package className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng số đơn hàng</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(filteredOrdersCount)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Tổng tiền</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">
                                            {formatNumber(filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0))}đ
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                                        <BarChart2 className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Đơn hàng trung bình</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">
                                            {formatNumber(filteredOrdersCount > 0 ? Math.round(filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / filteredOrdersCount) : 0)}đ
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Thống kê theo trạng thái</h3>
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
                                            plugins: {
                                                legend: {
                                                    position: 'bottom'
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
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
                                            plugins: {
                                                legend: {
                                                    position: 'bottom'
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại đơn</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getOrderTypeStats().map(item => item.name),
                                            datasets: [{
                                                label: 'Số lượng',
                                                data: getOrderTypeStats().map(item => item.value),
                                                backgroundColor: chartColors[0],
                                                borderColor: chartColors[0],
                                                borderWidth: 1
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    display: false
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Hàng hóa</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getProductTypeStats().map(item => item.name),
                                            datasets: [{
                                                label: 'Số lượng',
                                                data: getProductTypeStats().map(item => item.value),
                                                backgroundColor: chartColors[1],
                                                borderColor: chartColors[1],
                                                borderWidth: 1
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    display: false
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true
                                                }
                                            }
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
                                                label: 'Số đơn',
                                                data: getCustomerStats().map(item => item.value),
                                                backgroundColor: chartColors[2],
                                                borderColor: chartColors[2],
                                                borderWidth: 1
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            indexAxis: 'y',
                                            plugins: {
                                                legend: {
                                                    display: false
                                                }
                                            },
                                            scales: {
                                                x: {
                                                    beginAtZero: true
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Doanh thu theo Trạng thái</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getRevenueByStatus().map(item => item.name),
                                            datasets: [{
                                                label: 'Doanh thu (VNĐ)',
                                                data: getRevenueByStatus().map(item => item.value),
                                                backgroundColor: chartColors[3],
                                                borderColor: chartColors[3],
                                                borderWidth: 1
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    display: false
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: function (context) {
                                                            return formatNumber(context.parsed.y) + ' đ';
                                                        }
                                                    }
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    ticks: {
                                                        callback: function (value) {
                                                            return formatNumber(value);
                                                        }
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

            {/* ── MOBILE FILTER BOTTOM SHEET ── */}
            {showMobileFilter && createPortal(
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    isClosing={mobileFilterClosing}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    sections={[
                        {
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Filter size={16} className="text-blue-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'categories',
                            label: 'Loại khách',
                            icon: <User size={16} className="text-emerald-600" />,
                            options: categoryOptions,
                            selectedValues: pendingCustomerCategories,
                            onSelectionChange: setPendingCustomerCategories,
                        },
                        {
                            id: 'orderTypes',
                            label: 'Loại đơn',
                            icon: <Package size={16} className="text-violet-600" />,
                            options: orderTypeOptions,
                            selectedValues: pendingOrderTypes,
                            onSelectionChange: setPendingOrderTypes,
                        },
                        {
                            id: 'productTypes',
                            label: 'Hàng hóa',
                            icon: <Package size={16} className="text-amber-600" />,
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
                        },
                    ]}
                />,
                document.body
            )}

            {/* ACTION MODAL */}
            {isActionModalOpen && createPortal(
                <OrderStatusUpdater
                    order={selectedOrder}
                    warehouseName={getLabel(warehousesList, selectedOrder?.warehouse)}
                    userRole={role}
                    onClose={() => setIsActionModalOpen(false)}
                    onUpdateSuccess={() => {
                        fetchOrders();
                        setIsActionModalOpen(false);
                    }}
                />,
                document.body
            )}

            {/* SERIALS VIEW MODAL */}
            {serialsModalOrder && createPortal(
                <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[100002] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh] border border-border">
                        <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-white">
                            <div>
                                <h3 className="text-lg font-black text-foreground">Mã Serial Vỏ Bình</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Đơn {serialsModalOrder.order_code}</p>
                            </div>
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                                <Package className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto bg-white">
                            <div className="grid grid-cols-2 gap-3">
                                {serialsModalOrder.assigned_cylinders.map((serial, idx) => (
                                    <div key={idx} className="bg-white border border-border shadow-sm rounded-xl px-3 py-2 text-center text-sm font-bold text-foreground font-mono">
                                        {serial}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 bg-white border-t border-border mt-auto shrink-0">
                            <button
                                onClick={() => setSerialsModalOrder(null)}
                                className="w-full py-3 text-foreground font-bold text-sm bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl border border-border shadow-sm"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Form Modal */}
            {isFormModalOpen && createPortal(
                <OrderFormModal
                    order={orderToEdit}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />,
                document.body
            )}

            {/* Hidden Print Template — rendered via Portal directly under <body> to bypass #root hiding */}
            {createPortal(
                <div className="print-only-content">
                    {ordersToPrint && <OrderPrintTemplate orders={ordersToPrint} warehousesList={warehousesList} />}
                    {ordersToPrint && handoverToPrint && <div className="page-break" />}
                    {handoverToPrint && <MachineHandoverPrintTemplate orders={handoverToPrint} />}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Orders;
