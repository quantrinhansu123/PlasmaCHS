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
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import {
    CUSTOMER_CATEGORIES,
    ORDER_STATUSES,
    ORDER_TYPES,
    PRODUCT_TYPES,
    TABLE_COLUMNS
} from '../constants/orderConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';

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
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_orders', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

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
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchOrders();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        // Extract unique customers from orders
        const customers = [...new Set(orders.map(o => o.customer_name).filter(Boolean))];
        setUniqueCustomers(customers);
    }, [orders]);

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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
        setOrdersToPrint(order);
        // Auto-include machine handover for MAY orders
        if (order.product_type?.startsWith('MAY')) {
            setHandoverToPrint(order);
        } else {
            setHandoverToPrint(null);
        }
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handleBulkPrint = () => {
        if (selectedIds.length === 0) {
            alert('⚠️ Vui lòng chọn ít nhất một đơn hàng để in!');
            return;
        }

        const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
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
            fetchOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('❌ Có lỗi xảy ra khi xóa đơn hàng: ' + error.message);
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
        let baseStyle = "group hover-lift transition-all duration-300 border-l-4 ";
        if (isSelected) baseStyle += "bg-blue-50/40 border-l-blue-600 ";
        else {
            switch (category) {
                case 'KH_SI': baseStyle += "border-l-indigo-500 hover:bg-indigo-50/10 "; break;
                case 'KH_LE': baseStyle += "border-l-emerald-500 hover:bg-emerald-50/10 "; break;
                default: baseStyle += "border-l-transparent hover:bg-blue-50/5 ";
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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col -mt-2 min-h-0 px-3 md:px-6">
            {/* Top Sidebar Style Tabs */}
            <div className="flex items-center gap-1 mb-4 mt-6">
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
                    <button
                        onClick={() => navigate('/tao-don-hang')}
                        className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                    >
                        <Plus size={18} />
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
                            return (
                                <div key={order.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
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
                                        <span
                                            className={clsx(
                                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                                                status.color === 'blue' && "bg-blue-100 text-blue-700",
                                                status.color === 'yellow' && "bg-yellow-100 text-yellow-700",
                                                status.color === 'orange' && "bg-orange-100 text-orange-700",
                                                status.color === 'green' && "bg-green-100 text-green-700",
                                                status.color === 'red' && "bg-red-100 text-red-700",
                                                status.color === 'gray' && "bg-gray-100 text-gray-700",
                                                !status.color && "bg-gray-100 text-gray-700"
                                            )}
                                        >
                                            {status.label}
                                        </span>
                                    </div>

                                    <div className="mb-3">
                                        <h3 className="text-[14px] font-bold text-foreground leading-snug">{order.customer_name}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                            <span className="text-[11px] font-bold text-muted-foreground uppercase">{getLabel(CUSTOMER_CATEGORIES, order.customer_category)}</span>
                                            <span className="text-[11px] font-medium text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-2 text-xs mb-3">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 text-primary" />
                                                {getLabel(PRODUCT_TYPES, order.product_type)}
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
                                                Loại: {getLabel(ORDER_TYPES, order.order_type)}
                                            </p>
                                        </div>
                                    </div>

                                    {(order.recipient_name || order.recipient_phone) && (
                                        <div className="bg-muted/20 rounded-lg p-2.5 space-y-1 border border-border mb-3">
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
                                                className="p-2 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
                                            <button
                                                onClick={() => handleEditOrder(order)}
                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
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
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkPrint}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-border bg-white text-muted-foreground text-[13px] font-bold hover:bg-muted/20 shadow-sm transition-all"
                                >
                                    <Printer size={16} />
                                    In {selectedIds.length} phiếu
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/tao-don-hang')}
                                className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                            >
                                <Plus size={18} />
                                Thêm
                            </button>
                        </div>
                    </div>

                    {/* Secondary Filters */}
                    <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                        <div className="relative">
                            <button
                                onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    activeDropdown === 'status' || selectedStatuses.length > 0
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Filter size={14} />
                                Trạng thái
                                {selectedStatuses.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    activeDropdown === 'categories' || selectedCustomerCategories.length > 0
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <User size={14} />
                                Loại khách
                                {selectedCustomerCategories.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                onClick={() => setActiveDropdown(activeDropdown === 'orderTypes' ? null : 'orderTypes')}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Package size={14} />
                                Loại đơn
                                {selectedOrderTypes.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                onClick={() => setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes')}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    activeDropdown === 'productTypes' || selectedProductTypes.length > 0
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Package size={14} />
                                Hàng hóa
                                {selectedProductTypes.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                className={clsx(
                                    "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                    activeDropdown === 'customers' || selectedCustomers.length > 0
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-border bg-white text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <User size={14} />
                                Khách hàng
                                {selectedCustomers.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                <div className="hidden md:block flex-1 overflow-x-auto border-t border-border">
                    <table className="w-full border-collapse">
                        <thead className="bg-muted/20">
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
                                    <tr key={order.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                    checked={selectedIds.includes(order.id)}
                                                    onChange={() => toggleSelect(order.id)}
                                                />
                                            </div>
                                        </td>
                                        {isColumnVisible('code') && <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="text-[13px] font-medium text-foreground">
                                                {order.order_code}
                                            </span>
                                        </td>}
                                        {isColumnVisible('category') && <td className="px-4 py-4 text-[13px] text-muted-foreground font-normal">{getLabel(CUSTOMER_CATEGORIES, order.customer_category)}</td>}
                                        {isColumnVisible('customer') && <td className="px-4 py-4">
                                            <span className="text-[13px] font-medium text-foreground">{order.customer_name}</span>
                                        </td>}
                                        {isColumnVisible('recipient') && <td className="px-4 py-4">
                                            <span className="text-[13px] text-muted-foreground font-normal">{order.recipient_name}</span>
                                        </td>}
                                        {isColumnVisible('type') && <td className="px-4 py-4 text-[13px] text-muted-foreground font-normal">{getLabel(ORDER_TYPES, order.order_type)}</td>}
                                        {isColumnVisible('product') && <td className="px-4 py-4 text-[13px] text-muted-foreground font-normal">{getLabel(PRODUCT_TYPES, order.product_type)}</td>}
                                        {isColumnVisible('quantity') && <td className="px-4 py-4">
                                            <span className="text-[13px] font-semibold text-foreground">{formatNumber(order.quantity)}</span>
                                        </td>}
                                        {isColumnVisible('department') && <td className="px-4 py-4 text-[13px] text-muted-foreground font-normal">{order.department || '—'}</td>}
                                        {isColumnVisible('cylinders') && <td className="px-4 py-4 text-[13px]">
                                            {order.assigned_cylinders && order.assigned_cylinders.length > 0 ? (
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
                                            )}
                                        </td>}
                                        {isColumnVisible('status') && <td className="px-4 py-4">
                                            <span
                                                className={clsx(
                                                    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium",
                                                    status.color === 'blue' && "bg-blue-100 text-blue-700",
                                                    status.color === 'yellow' && "bg-yellow-100 text-yellow-700",
                                                    status.color === 'orange' && "bg-orange-100 text-orange-700",
                                                    status.color === 'green' && "bg-green-100 text-green-700",
                                                    status.color === 'red' && "bg-red-100 text-red-700",
                                                    status.color === 'gray' && "bg-gray-100 text-gray-700",
                                                    !status.color && "bg-gray-100 text-gray-700"
                                                )}
                                            >
                                                {status.label}
                                            </span>
                                        </td>}
                                        {isColumnVisible('date') && <td className="px-4 py-4 text-[13px] text-muted-foreground font-normal">
                                            {order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}
                                        </td>}
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setIsActionModalOpen(true); }}
                                                    className="text-muted-foreground hover:text-green-600 transition-colors p-1 rounded hover:bg-green-50"
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
                                                <button
                                                    onClick={() => handleEditOrder(order)}
                                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-primary/10"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id, order.order_code)}
                                                    className="text-muted-foreground hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
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
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            activeDropdown === 'status' || selectedStatuses.length > 0
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Filter size={14} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            activeDropdown === 'categories' || selectedCustomerCategories.length > 0
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <User size={14} />
                                        Loại khách
                                        {selectedCustomerCategories.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'orderTypes' ? null : 'orderTypes')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Package size={14} />
                                        Loại đơn
                                        {selectedOrderTypes.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            activeDropdown === 'productTypes' || selectedProductTypes.length > 0
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Package size={14} />
                                        Hàng hóa
                                        {selectedProductTypes.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            activeDropdown === 'customers' || selectedCustomers.length > 0
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <User size={14} />
                                        Khách hàng
                                        {selectedCustomers.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
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

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-blue-50 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                        <Package className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng số đơn hàng</p>
                                        <p className="text-3xl font-bold text-blue-900 mt-1">{formatNumber(filteredOrdersCount)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Tổng tiền</p>
                                        <p className="text-3xl font-bold text-green-900 mt-1">
                                            {formatNumber(filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0))}đ
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-orange-50 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                        <BarChart2 className="w-6 h-6 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đơn hàng trung bình</p>
                                        <p className="text-3xl font-bold text-orange-900 mt-1">
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
                            id: 'categories',
                            label: 'Loại khách',
                            icon: <User size={16} />,
                            options: categoryOptions,
                            selectedValues: pendingCustomerCategories,
                            onSelectionChange: setPendingCustomerCategories,
                        },
                        {
                            id: 'orderTypes',
                            label: 'Loại đơn',
                            icon: <Package size={16} />,
                            options: orderTypeOptions,
                            selectedValues: pendingOrderTypes,
                            onSelectionChange: setPendingOrderTypes,
                        },
                        {
                            id: 'productTypes',
                            label: 'Hàng hóa',
                            icon: <Package size={16} />,
                            options: productTypeOptions,
                            selectedValues: pendingProductTypes,
                            onSelectionChange: setPendingProductTypes,
                        },
                        {
                            id: 'customers',
                            label: 'Khách hàng',
                            icon: <User size={16} />,
                            options: customerOptions,
                            selectedValues: pendingCustomers,
                            onSelectionChange: setPendingCustomers,
                        },
                    ]}
                />
            )}

            {/* ACTION MODAL */}
            {isActionModalOpen && (
                <OrderStatusUpdater
                    order={selectedOrder}
                    userRole={role}
                    onClose={() => setIsActionModalOpen(false)}
                    onUpdateSuccess={() => {
                        fetchOrders();
                        setIsActionModalOpen(false);
                    }}
                />
            )}

            {/* SERIALS VIEW MODAL */}
            {serialsModalOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Mã Serial Vỏ Bình</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Đơn {serialsModalOrder.order_code}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                <Package className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                {serialsModalOrder.assigned_cylinders.map((serial, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 shadow-sm rounded-xl px-3 py-2 text-center text-sm font-bold text-slate-700 font-mono">
                                        {serial}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto shrink-0">
                            <button
                                onClick={() => setSerialsModalOrder(null)}
                                className="w-full py-3 text-slate-600 font-bold text-sm bg-white hover:bg-slate-100 transition-colors rounded-xl border border-slate-200 shadow-sm"
                            >
                                Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {isFormModalOpen && (
                <OrderFormModal
                    order={orderToEdit}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {/* Hidden Print Template — rendered via Portal directly under <body> to bypass #root hiding */}
            {ordersToPrint && createPortal(
                <div className="print-only-content">
                    <OrderPrintTemplate orders={ordersToPrint} warehousesList={warehousesList} />
                    {handoverToPrint && <div className="page-break" />}
                    {handoverToPrint && <MachineHandoverPrintTemplate orders={handoverToPrint} />}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Orders;
