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
    ChevronDown,
    Edit,
    Filter,
    MapPin,
    Package,
    Phone,
    Plus,
    Printer,
    Search,
    Trash2,
    User
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import MachineHandoverPrintTemplate from '../components/MachineHandoverPrintTemplate';
import OrderPrintTemplate from '../components/OrderPrintTemplate';
import OrderFormModal from '../components/Orders/OrderFormModal';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import {
    CUSTOMER_CATEGORIES,
    ORDER_STATUSES,
    ORDER_TYPES,
    PRODUCT_TYPES,
    TABLE_COLUMNS,
    WAREHOUSES
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

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        // Extract unique customers from orders
        const customers = [...new Set(orders.map(o => o.customer_name).filter(Boolean))];
        setUniqueCustomers(customers);
    }, [orders]);

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
        return list.find(item => item.id === id)?.label || id;
    };

    // Filter Dropdown Component
    const FilterDropdown = ({ label, selectedCount, totalCount, onSelectAll, children }) => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-[#D1D5DB] bg-white text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-all"
                    style={{ fontFamily: '"Roboto", sans-serif' }}
                >
                    <Filter className="w-4 h-4" />
                    <span>{label}</span>
                    {selectedCount > 0 && (
                        <span className="px-2 py-0.5 bg-[#2563EB] text-white text-xs rounded-full">
                            {selectedCount}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        ></div>
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] shadow-lg z-20 min-w-[250px] max-h-80">
                            <div className="p-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
                                <span className="text-sm font-medium text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                    {selectedCount > 0 ? `Đã chọn ${selectedCount}/${totalCount}` : `Chọn ${label.toLowerCase()}`}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectAll();
                                    }}
                                    className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                                    style={{ fontFamily: '"Roboto", sans-serif' }}
                                >
                                    {selectedCount === totalCount ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>
                            <div className="overflow-y-auto max-h-64">
                                {children}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

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
        <div className="p-6 bg-[#F8F9FA] min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mb-8 border-b border-[#E5E7EB]">
                <button
                    onClick={() => setActiveView('list')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${activeView === 'list'
                        ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                        : 'text-[#6B7280] hover:text-[#374151]'
                        }`}
                    style={activeView === 'list' ? { color: '#2563EB', borderBottomColor: '#2563EB' } : { color: '#6B7280' }}
                >
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${activeView === 'stats'
                        ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                        : 'text-[#6B7280] hover:text-[#374151]'
                        }`}
                    style={activeView === 'stats' ? { color: '#2563EB', borderBottomColor: '#2563EB' } : { color: '#6B7280' }}
                >
                    Thống kê
                </button>
            </div>

            {activeView === 'list' ? (
                <>
                    {/* Header with Add Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">Danh sách đơn hàng</h1>
                        <div className="flex items-center gap-2">
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkPrint}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#D1D5DB] text-[#374151] rounded-xl font-bold text-xs sm:text-sm shadow-sm hover:bg-[#F9FAFB]"
                                >
                                    <Printer className="w-4 h-4" />
                                    In {selectedIds.length} phiếu
                                </button>
                            )}
                            <button
                                onClick={() => navigate('/tao-don-hang')}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-xl font-bold text-sm shadow-lg hover:bg-[#1D4ED8] transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Tạo mới</span>
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, mã đơn, SĐT..."
                                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 text-sm font-medium transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center justify-around sm:justify-start gap-4 sm:gap-6 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left">
                                <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">Đơn hàng</span>
                                <span className="text-sm sm:text-lg font-black text-blue-600 leading-none">{filteredOrdersCount}</span>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-blue-200/50"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left border-l border-blue-100 sm:border-none pl-4 sm:pl-0">
                                <span className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">Tổng tiền</span>
                                <span className="text-sm sm:text-lg font-black text-blue-600 leading-none">{formatNumber(totalAmount)} đ</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        {/* Trạng thái Dropdown */}
                        <FilterDropdown
                            label="Trạng thái"
                            selectedCount={selectedStatuses.length}
                            totalCount={ORDER_STATUSES.filter(s => s.id !== 'ALL').length}
                            onSelectAll={() => {
                                const allStatuses = ORDER_STATUSES.filter(s => s.id !== 'ALL').map(s => s.id);
                                if (selectedStatuses.length === allStatuses.length) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses([...allStatuses]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {ORDER_STATUSES.filter(s => s.id !== 'ALL').map(status => (
                                    <label key={status.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedStatuses.includes(status.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStatuses([...selectedStatuses, status.id]);
                                                } else {
                                                    setSelectedStatuses(selectedStatuses.filter(id => id !== status.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] rounded focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{status.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Loại khách Dropdown */}
                        <FilterDropdown
                            label="Loại khách"
                            selectedCount={selectedCustomerCategories.length}
                            totalCount={CUSTOMER_CATEGORIES.length}
                            onSelectAll={() => {
                                if (selectedCustomerCategories.length === CUSTOMER_CATEGORIES.length) {
                                    setSelectedCustomerCategories([]);
                                } else {
                                    setSelectedCustomerCategories(CUSTOMER_CATEGORIES.map(c => c.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {CUSTOMER_CATEGORIES.map(cat => (
                                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomerCategories.includes(cat.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCustomerCategories([...selectedCustomerCategories, cat.id]);
                                                } else {
                                                    setSelectedCustomerCategories(selectedCustomerCategories.filter(id => id !== cat.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] rounded focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{cat.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Loại đơn Dropdown */}
                        <FilterDropdown
                            label="Loại đơn"
                            selectedCount={selectedOrderTypes.length}
                            totalCount={ORDER_TYPES.length}
                            onSelectAll={() => {
                                if (selectedOrderTypes.length === ORDER_TYPES.length) {
                                    setSelectedOrderTypes([]);
                                } else {
                                    setSelectedOrderTypes(ORDER_TYPES.map(t => t.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {ORDER_TYPES.map(type => (
                                    <label key={type.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedOrderTypes.includes(type.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedOrderTypes([...selectedOrderTypes, type.id]);
                                                } else {
                                                    setSelectedOrderTypes(selectedOrderTypes.filter(id => id !== type.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] rounded focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{type.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Hàng hóa Dropdown */}
                        <FilterDropdown
                            label="Hàng hóa"
                            selectedCount={selectedProductTypes.length}
                            totalCount={PRODUCT_TYPES.length}
                            onSelectAll={() => {
                                if (selectedProductTypes.length === PRODUCT_TYPES.length) {
                                    setSelectedProductTypes([]);
                                } else {
                                    setSelectedProductTypes(PRODUCT_TYPES.map(p => p.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {PRODUCT_TYPES.map(product => (
                                    <label key={product.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedProductTypes.includes(product.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedProductTypes([...selectedProductTypes, product.id]);
                                                } else {
                                                    setSelectedProductTypes(selectedProductTypes.filter(id => id !== product.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] rounded focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{product.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Khách hàng Dropdown */}
                        <FilterDropdown
                            label="Khách hàng"
                            selectedCount={selectedCustomers.length}
                            totalCount={uniqueCustomers.length}
                            onSelectAll={() => {
                                if (selectedCustomers.length === uniqueCustomers.length) {
                                    setSelectedCustomers([]);
                                } else {
                                    setSelectedCustomers([...uniqueCustomers]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueCustomers.map(customer => (
                                    <label key={customer} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomers.includes(customer)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCustomers([...selectedCustomers, customer]);
                                                } else {
                                                    setSelectedCustomers(selectedCustomers.filter(c => c !== customer));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] rounded focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={customer}>{customer}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>
                    </div>


                    {/* Main Content Card */}
                    <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-sm overflow-hidden">
                        {/* Mobile Card List (Visible only on mobile) */}
                        <div className="md:hidden divide-y divide-[#E5E7EB]">
                            {isLoading ? (
                                <div className="px-4 py-16 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-[#6B7280] text-sm font-medium">Đang tải dữ liệu...</p>
                                    </div>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="px-4 py-16 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Package className="w-12 h-12 text-[#D1D5DB]" />
                                        <p className="text-sm font-medium text-[#6B7280]">Không tìm thấy đơn hàng nào</p>
                                    </div>
                                </div>
                            ) : (
                                filteredOrders.map((order) => {
                                    const status = getStatusConfig(order.status);
                                    return (
                                        <div key={order.id} className="p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                                                        checked={selectedIds.includes(order.id)}
                                                        onChange={() => toggleSelect(order.id)}
                                                    />
                                                    <span className="text-sm font-bold text-[#111827]">{order.order_code}</span>
                                                </div>
                                                <span
                                                    className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border uppercase"
                                                    style={(() => {
                                                        const colorMap = {
                                                            'blue': { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
                                                            'yellow': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'orange': { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' },
                                                            'indigo': { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
                                                            'purple': { bg: '#F3E8FF', text: '#7C3AED', border: '#E9D5FF' },
                                                            'cyan': { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' },
                                                            'red': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
                                                            'green': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'gray': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
                                                        };
                                                        const colors = colorMap[status.color] || colorMap['gray'];
                                                        return {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            borderColor: colors.border
                                                        };
                                                    })()}
                                                >
                                                    {status.label}
                                                </span>
                                            </div>

                                            <div className="space-y-3 ml-7">
                                                <div>
                                                    <h3 className="text-base font-bold text-[#111827] leading-snug">{order.customer_name}</h3>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabel(CUSTOMER_CATEGORIES, order.customer_category)}</span>
                                                        <span className="text-[11px] font-medium text-slate-400">{order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}</span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                    <div className="space-y-1">
                                                        <p className="text-[#6B7280] font-medium flex items-center gap-1.5">
                                                            <Package className="w-3.5 h-3.5 text-blue-500" />
                                                            {getLabel(PRODUCT_TYPES, order.product_type)}
                                                        </p>
                                                        <p className="text-[#111827] font-bold ml-5">SL: {formatNumber(order.quantity)}</p>
                                                    </div>
                                                    <div className="space-y-1 pl-2 border-l border-slate-100">
                                                        <p className="text-[#6B7280] font-medium flex items-center gap-1.5">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                            Kho: {getLabel(WAREHOUSES, order.warehouse)}
                                                        </p>
                                                        <p className="text-[#6B7280] font-medium flex items-center gap-1.5">
                                                            <Filter className="w-3.5 h-3.5 text-slate-400" />
                                                            Loại: {getLabel(ORDER_TYPES, order.order_type)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {(order.recipient_name || order.recipient_phone) && (
                                                    <div className="bg-slate-50/80 rounded-lg p-2.5 space-y-1 border border-slate-100/50">
                                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Người nhận</p>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="text-xs font-bold text-slate-700">{order.recipient_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                                <Phone className="w-3 h-3" />
                                                                <span className="text-[11px] font-medium">{order.recipient_phone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {order.product_type?.startsWith('MAY') && order.department && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded font-bold uppercase tracking-wider text-[10px]">Mã máy</span>
                                                        <span className="font-bold text-slate-700">{order.department}</span>
                                                    </div>
                                                )}

                                                {order.assigned_cylinders && order.assigned_cylinders.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {order.assigned_cylinders.slice(0, 4).map((serial, idx) => (
                                                            <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-mono font-bold shadow-sm">
                                                                {serial}
                                                            </span>
                                                        ))}
                                                        {order.assigned_cylinders.length > 4 && (
                                                            <span className="text-[10px] font-bold text-blue-600 self-center">+{order.assigned_cylinders.length - 4} nữa</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50 ml-7">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Thành tiền</span>
                                                    <span className="text-base font-black text-[#2563EB]">
                                                        {formatNumber(order.total_amount || (order.quantity || 0) * (order.unit_price || 0))} <small className="text-[10px] font-bold">đ</small>
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => handlePrint(order)}
                                                        className="p-2 text-[#9CA3AF] hover:text-[#2563EB] active:bg-blue-50 rounded-lg transition-colors border border-transparent active:border-blue-100"
                                                    >
                                                        <Printer className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditOrder(order)}
                                                        className="p-2 text-[#9CA3AF] hover:text-[#2563EB] active:bg-blue-50 rounded-lg transition-colors border border-transparent active:border-blue-100"
                                                    >
                                                        <Edit className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteOrder(order.id, order.order_code)}
                                                        className="p-2 text-[#9CA3AF] hover:text-[#DC2626] active:bg-red-50 rounded-lg transition-colors border border-transparent active:border-red-100"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View (Hidden on mobile) */}
                        <div className="hidden md:block w-full overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-[#F9FAFB]">
                                    <tr>
                                        <th className="px-4 py-3.5 w-10">
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                                                    checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                                                    onChange={toggleSelectAll}
                                                />
                                            </div>
                                        </th>
                                        {visibleTableColumns.map(col => (
                                            <th key={col.key} className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-left uppercase tracking-wider">
                                                {col.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-center uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E7EB]">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium">Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Package className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]">Không tìm thấy đơn hàng nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredOrders.map((order) => {
                                        const status = getStatusConfig(order.status);
                                        return (
                                            <tr key={order.id} className="hover:bg-[#F9FAFB] transition-colors">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                                                            checked={selectedIds.includes(order.id)}
                                                            onChange={() => toggleSelect(order.id)}
                                                        />
                                                    </div>
                                                </td>
                                                {isColumnVisible('code') && <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-[#111827]">
                                                        {order.order_code}
                                                    </span>
                                                </td>}
                                                {isColumnVisible('category') && <td className="px-4 py-4 text-sm text-[#374151] font-normal">{getLabel(CUSTOMER_CATEGORIES, order.customer_category)}</td>}
                                                {isColumnVisible('customer') && <td className="px-4 py-4">
                                                    <span className="text-sm font-medium text-[#111827]">{order.customer_name}</span>
                                                </td>}
                                                {isColumnVisible('recipient') && <td className="px-4 py-4">
                                                    <span className="text-sm text-[#374151] font-normal">{order.recipient_name}</span>
                                                </td>}
                                                {isColumnVisible('type') && <td className="px-4 py-4 text-sm text-[#374151] font-normal">{getLabel(ORDER_TYPES, order.order_type)}</td>}
                                                {isColumnVisible('product') && <td className="px-4 py-4 text-sm text-[#374151] font-normal">{getLabel(PRODUCT_TYPES, order.product_type)}</td>}
                                                {isColumnVisible('quantity') && <td className="px-4 py-4">
                                                    <span className="text-sm font-semibold text-[#111827]">{formatNumber(order.quantity)}</span>
                                                </td>}
                                                {isColumnVisible('department') && <td className="px-4 py-4 text-sm text-[#374151] font-normal">{order.department || '—'}</td>}
                                                {isColumnVisible('cylinders') && <td className="px-4 py-4 text-sm">
                                                    {order.assigned_cylinders && order.assigned_cylinders.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                                            {order.assigned_cylinders.slice(0, 3).map((serial, idx) => (
                                                                <span key={idx} className="px-2.5 py-1 bg-[#F3F4F6] text-[#374151] rounded-md text-xs font-medium border border-[#E5E7EB]">
                                                                    {serial}
                                                                </span>
                                                            ))}
                                                            {order.assigned_cylinders.length > 3 && (
                                                                <button
                                                                    onClick={() => setSerialsModalOrder(order)}
                                                                    className="px-2.5 py-1 bg-[#DBEAFE] text-[#2563EB] hover:bg-[#BFDBFE] rounded-md text-xs font-medium transition-colors border border-[#BFDBFE]"
                                                                    title="Bấm để xem danh sách đầy đủ"
                                                                >
                                                                    +{order.assigned_cylinders.length - 3}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[#9CA3AF]">—</span>
                                                    )}
                                                </td>}
                                                {isColumnVisible('status') && <td className="px-4 py-4">
                                                    <span
                                                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border"
                                                        style={(() => {
                                                            const colorMap = {
                                                                'blue': { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
                                                                'yellow': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                                'orange': { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' },
                                                                'indigo': { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
                                                                'purple': { bg: '#F3E8FF', text: '#7C3AED', border: '#E9D5FF' },
                                                                'cyan': { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' },
                                                                'red': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
                                                                'green': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                                'gray': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
                                                            };
                                                            const colors = colorMap[status.color] || colorMap['gray'];
                                                            return {
                                                                backgroundColor: colors.bg,
                                                                color: colors.text,
                                                                borderColor: colors.border
                                                            };
                                                        })()}
                                                    >
                                                        {status.label}
                                                    </span>
                                                </td>}
                                                {isColumnVisible('date') && <td className="px-4 py-4 text-sm text-[#6B7280] font-normal">
                                                    {order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}
                                                </td>}
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => handlePrint(order)}
                                                            className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 rounded hover:bg-[#EFF6FF]"
                                                            title={order.product_type?.startsWith('MAY') ? 'In phiếu xuất kho + biên bản bàn giao máy' : 'In phiếu xuất kho'}
                                                        >
                                                            <Printer className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditOrder(order)}
                                                            className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 rounded hover:bg-[#EFF6FF]"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOrder(order.id, order.order_code)}
                                                            className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors p-1 rounded hover:bg-[#FEF2F2]"
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
                    </div>

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

                    {/* Hidden Print Template */}
                    <div className="print-only-content">
                        {ordersToPrint && <OrderPrintTemplate orders={ordersToPrint} />}
                        {ordersToPrint && handoverToPrint && <div className="page-break" />}
                        {handoverToPrint && <MachineHandoverPrintTemplate orders={handoverToPrint} />}
                    </div>
                </>
            ) : (
                /* Statistics View */
                <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số đơn hàng</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredOrdersCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng tiền</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalAmount)} đ</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Đơn hàng trung bình</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                {filteredOrdersCount > 0 ? formatNumber(Math.round(totalAmount / filteredOrdersCount)) : 0} đ
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Trạng thái</h3>
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

                        {/* Category Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại khách</h3>
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

                        {/* Order Type Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại đơn</h3>
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

                        {/* Product Type Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Hàng hóa</h3>
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

                        {/* Top Customers Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Khách hàng</h3>
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

                        {/* Revenue by Status Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Doanh thu theo Trạng thái</h3>
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
            )}
        </div>
    );
};

export default Orders;
