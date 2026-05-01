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
import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import {
    BarChart2,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Edit,
    Eye,
    Filter,
    List,
    MapPin,
    MoreVertical,
    Package,
    Phone,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    Warehouse,
    X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import MachineHandoverPrintTemplate from '../components/MachineHandoverPrintTemplate';
import OrderPrintTemplate from '../components/OrderPrintTemplate';
import OrderFormModal from '../components/Orders/OrderFormModal';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import PrintOptionsModal from '../components/Orders/PrintOptionsModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import {
    CUSTOMER_CATEGORIES,
    ORDER_STATUSES,
    ORDER_TYPES,
    PRODUCT_TYPES,
    STATUS_PRIORITY,
    TABLE_COLUMNS
} from '../constants/orderConstants';
import usePermissions from '../hooks/usePermissions';
import useReports from '../hooks/useReports';
import { supabase } from '../supabase/config';
import {
    isAdminRole,
    isLeadSaleRole,
    isShipperRole as isShipperRoleHelper,
    isWarehouseRole as isWarehouseRoleHelper,
    normalizeRole as normalizeRoleKey,
} from '../utils/accessControl';

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

/** Trạng thái cần xử lý (duyệt / KD / điều chỉnh / kho) — dùng cho bộ đếm nhanh */
const PIPELINE_ATTENTION_STATUSES = new Set([
    'CHO_DUYET',
    'CHO_CTY_DUYET',
    'TRUONG_KD_XU_LY',
    'KD_XU_LY',
    'DIEU_CHINH',
    'KHO_XU_LY'
]);

const normalizeText = (value) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const extractWarehouseFromNote = (note) => {
    const text = String(note || '');
    if (!text) return '';
    const match = text.match(/Kho:\s*([^\n\r.]+)/i);
    return (match?.[1] || '').trim();
};

const getWarehouseAliases = (warehouse) => {
    const rawName = String(warehouse?.name || '').trim();
    const rawCode = String(warehouse?.code || '').trim();
    const rawId = String(warehouse?.id || '').trim();
    const shortFromName = rawName.includes('-') ? rawName.split('-')[0].trim() : '';
    const compactName = rawName.replace(/\s+/g, '');

    return [rawId, rawName, rawCode, shortFromName, compactName]
        .map(normalizeText)
        .filter(Boolean);
};

const getWarehouseKeyVariants = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return [];

    const shortByDash = normalized.includes('-') ? normalized.split('-')[0].trim() : '';
    const compact = normalized.replace(/\s+/g, '');
    const alnumOnly = normalized.replace(/[^a-z0-9]/g, '');

    return [...new Set([normalized, shortByDash, compact, alnumOnly].filter(Boolean))];
};

const HIDDEN_ORDER_COLUMNS = new Set(['department']);

const isMachineProductType = (productType) => {
    const upper = String(productType || '').toUpperCase();
    return /^(MAY|MÁY)/i.test(String(productType || '')) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED', 'MAY_MED_NEW'].includes(upper);
};

const extractMachineCodesFromOrder = (order) => {
    const fromDepartment = String(order?.department || '')
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    const fromItems = (order?.order_items || [])
        .filter((it) => isMachineProductType(it?.product_type))
        .map((it) => String(it?.serial_number || '').trim())
        .filter(Boolean);
    const fromNote = String(order?.note || '')
        .split('\n')
        .map((line) => {
            const match = line.match(/Mã:\s*(.+)$/i);
            return (match?.[1] || '').trim();
        })
        .filter(Boolean);
    return [...new Set([...fromDepartment, ...fromItems, ...fromNote])];
};

/** Mã vỏ hiển thị trên danh sách đơn: header + từng dòng order_items + checklist giao/thu hồi */
const collectCylinderSerialsFromOrder = (order) => {
    const out = [];
    const pushScalar = (s) => {
        const v = String(s || '').trim();
        if (v) out.push(v);
    };
    const pushArr = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((entry) => {
            if (typeof entry === 'string') pushScalar(entry);
            else if (entry && typeof entry === 'object') pushScalar(entry.serial ?? entry.rfid ?? entry.code);
        });
    };

    pushArr(order?.assigned_cylinders);

    (order?.order_items || []).forEach((it) => {
        pushArr(it?.assigned_cylinders);
        const pt = String(it?.product_type || '').toUpperCase();
        if (pt.includes('BINH') || pt === 'BINH' || pt === 'BINH_4L' || pt === 'BINH_8L') {
            pushScalar(it?.serial_number);
        }
    });

    const dc = order?.delivery_checklist;
    if (dc && typeof dc === 'object' && !Array.isArray(dc)) {
        for (const [key] of Object.entries(dc)) {
            const k = String(key).trim();
            if (/^BINH:/i.test(k)) {
                pushScalar(k.replace(/^BINH:/i, '').trim());
            } else if (/^BINH\s+/i.test(k)) {
                pushScalar(k.replace(/^BINH\s+/i, '').trim());
            }
        }
    }

    return [...new Set(out)];
};

const Orders = () => {
    const { role, department, user, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [ordersToPrint, setOrdersToPrint] = useState(null);
    const [handoverToPrint, setHandoverToPrint] = useState(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printContext, setPrintContext] = useState(null); // { type: 'single' | 'bulk' | 'handover', data: any }
    const [printOptions, setPrintOptions] = useState({ copies: 1, paperSize: 'A4' });
    const [selectedIds, setSelectedIds] = useState([]);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [orderToEdit, setOrderToEdit] = useState(null);
    const [viewOnly, setViewOnly] = useState(false);
    const [activeRowMenu, setActiveRowMenu] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const rowMenuRef = useRef(null);
    const [serialsModalOrder, setSerialsModalOrder] = useState(null);
    const [warehousesList, setWarehousesList] = useState([]);
    const defaultColOrder = TABLE_COLUMNS
        .map(col => col.key)
        .filter((key) => !HIDDEN_ORDER_COLUMNS.has(key));
    const columnDefs = TABLE_COLUMNS
        .filter((col) => !HIDDEN_ORDER_COLUMNS.has(col.key))
        .reduce((acc, col) => {
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
                const valid = saved.filter(key => defaultColOrder.includes(key));
                const missing = defaultColOrder.filter(key => !valid.includes(key));
                return [...valid, ...missing];
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);

    useEffect(() => {
        setVisibleColumns((prev) => prev.filter((key) => !HIDDEN_ORDER_COLUMNS.has(key)));
        setColumnOrder((prev) => prev.filter((key) => !HIDDEN_ORDER_COLUMNS.has(key)));
    }, []);

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

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const listDropdownRef = useRef(null);

    // Close logic for row action menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (rowMenuRef.current && !rowMenuRef.current.contains(event.target)) {
                setActiveRowMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const statsDropdownRef = useRef(null);
    const { fetchCustomerCylinderDebt } = useReports();
    const [allCustomerDebts, setAllCustomerDebts] = useState({}); // customer_id -> debt array

    useEffect(() => {
        if (permissionsLoading) return;
        fetchOrders();
        fetchWarehouses();
    }, [permissionsLoading, role, department, user?.name, user?.username, user?.chi_nhanh, user?.nguoi_quan_ly]);

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
    }, [activeDropdown]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const normalizedRole = normalizeRoleKey(role);
            const isAdmin = isAdminRole(role);
            const isLeader = isLeadSaleRole(role);
            const isThuKhoRole = normalizedRole.includes('thukho');
            const isShipperRole = isShipperRoleHelper(role);
            const isWarehouseRole = isWarehouseRoleHelper(role);
            const storageUserName =
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                '';
            const managedNames = (user?.nguoi_quan_ly || '')
                .split(',')
                .map(name => name.trim())
                .filter(Boolean);
            const visibleSalesNames = [
                ...new Set(
                    [
                        user?.name,
                        user?.username,
                        storageUserName,
                        ...managedNames
                    ]
                        .map(v => (v || '').trim())
                        .filter(Boolean)
                )
            ];

            let query = supabase
                .from('orders')
                .select('*, order_items(*)');

            // Thủ kho cần nhìn thấy cả DNXM để xử lý luồng kho.
            if (!isThuKhoRole) {
                query = query.neq('order_type', 'DNXM');
            }

            // Thủ kho: hiển thị đầy đủ đơn, không giới hạn cứng theo 1 trạng thái.

            // Shipper chỉ nhìn thấy đơn được giao cho mình
            if (isShipperRole && !isAdmin) {
                query = query.eq('delivery_unit', storageUserName);
            }

            // Apply warehouse filter only for warehouse roles
            if (!isAdmin && isWarehouseRole && department) {
                // Logic: Extract warehouse code from department (e.g., "OCP1-CHS" -> "OCP1")
                // We'll take the first part before the hyphen if it exists, otherwise use full string
                const warehouseCode = department.includes('-') 
                    ? department.split('-')[0].trim() 
                    : department.trim();
                
                query = query.eq('warehouse', warehouseCode);
            }

            // Role-based visibility filtering
            // Kho phải thấy đầy đủ đơn theo phạm vi kho, không bó theo ordered_by như NVKD.
            if (!isAdmin && !isThuKhoRole && !isShipperRole && !isWarehouseRole) {
                // Leaders see their own + managed staff's orders
                if (isLeader) {
                    if (visibleSalesNames.length > 0) {
                        query = query.in('ordered_by', visibleSalesNames);
                    }
                } 
                // Regular NVKD (Sales) only see their own orders
                else {
                    const myNames = [user?.name, user?.username, storageUserName].filter(Boolean);
                    if (myNames.length > 0) {
                        query = query.in('ordered_by', myNames);
                    }
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            let scopedOrders = data || [];

            // Kho/Thủ kho: phạm vi dữ liệu theo kho phụ trách trong danh sách kho
            // (match theo Tên kho, đồng thời hỗ trợ code/id và note để tương thích dữ liệu cũ).
            if (!isAdmin && (isThuKhoRole || isWarehouseRole)) {
                const managerCandidates = [user?.name, user?.username, storageUserName]
                    .map((v) => normalizeText(v))
                    .filter(Boolean);

                const { data: warehousesData } = await supabase
                    .from('warehouses')
                    .select('id, name, code, manager_name');

                const myWarehouses = (warehousesData || []).filter((w) => {
                    const managerNormalized = normalizeText(w.manager_name);
                    if (!managerNormalized) return false;
                    return managerCandidates.some((candidate) =>
                        managerNormalized.includes(candidate) || candidate.includes(managerNormalized)
                    );
                });

                let scopedWarehouses = myWarehouses;
                if (scopedWarehouses.length === 0) {
                    const branchTokens = [department, user?.chi_nhanh]
                        .map((v) => normalizeText(v))
                        .filter(Boolean);
                    if (branchTokens.length > 0) {
                        scopedWarehouses = (warehousesData || []).filter((w) => {
                            const keys = getWarehouseAliases(w);
                            return branchTokens.some((token) =>
                                keys.some((key) => key.includes(token) || token.includes(key))
                            );
                        });
                    }
                }

                if (scopedWarehouses.length > 0) {
                    const allowedWarehouseValues = new Set(
                        scopedWarehouses.flatMap((w) => getWarehouseAliases(w))
                    );
                    const allowedKeys = new Set(
                        Array.from(allowedWarehouseValues).flatMap((key) => getWarehouseKeyVariants(key))
                    );

                    scopedOrders = scopedOrders.filter((order) => {
                        const candidates = [
                            order.warehouse,
                            extractWarehouseFromNote(order.note),
                        ].flatMap((candidate) => getWarehouseKeyVariants(candidate));
                        return candidates.some((candidateKey) => allowedKeys.has(candidateKey));
                    });
                } else if (department) {
                    const fallbackWarehouseCode = department.includes('-')
                        ? department.split('-')[0].trim()
                        : department.trim();
                    const fallbackKeys = new Set(getWarehouseKeyVariants(fallbackWarehouseCode));
                    if (isThuKhoRole) {
                        // Thủ kho không bị bó cứng theo department text vì dữ liệu kho có thể lưu dạng code/id/name khác nhau.
                        scopedOrders = scopedOrders;
                    } else {
                        scopedOrders = scopedOrders.filter((order) =>
                            getWarehouseKeyVariants(order.warehouse).some((candidateKey) => fallbackKeys.has(candidateKey))
                        );
                    }
                } else {
                    // Fallback an toàn cho Thủ kho: nếu thiếu mapping kho trên hồ sơ user
                    // thì không ẩn toàn bộ dữ liệu đơn hàng.
                    scopedOrders = isThuKhoRole ? scopedOrders : [];
                }
            }

            setOrders(scopedOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            alert('❌ Không thể tải danh sách đơn hàng: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name, code, branch_office').order('name');
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
            selectedProductTypes.includes(order.product_type) ||
            (order.product_type_2 && selectedProductTypes.includes(order.product_type_2));

        // Filter by customer name
        const matchesCustomer = selectedCustomers.length === 0 ||
            selectedCustomers.includes(order.customer_name);

        return matchesSearch && matchesStatus && matchesCategory &&
            matchesOrderType && matchesProductType && matchesCustomer;
    });

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] || 99;
        const priorityB = STATUS_PRIORITY[b.status] || 99;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // Secondary sort: Newest first within same status
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Calculate totals
    const filteredOrdersCount = filteredOrders.length;
    const totalAmount = filteredOrders.reduce((sum, order) => {
        return sum + (order.total_amount || (order.quantity || 0) * (order.unit_price || 0));
    }, 0);

    const filteredStatusCounts = useMemo(() => {
        const map = {};
        filteredOrders.forEach(o => {
            map[o.status] = (map[o.status] || 0) + 1;
        });
        return map;
    }, [filteredOrders]);

    const filteredPipelineCount = useMemo(
        () => filteredOrders.filter(o => PIPELINE_ATTENTION_STATUSES.has(o.status)).length,
        [filteredOrders]
    );

    const statusChipsForStrip = useMemo(() => {
        const known = ORDER_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
            id: s.id,
            label: s.label,
            color: s.color,
            count: filteredStatusCounts[s.id] || 0
        }));
        const knownIds = new Set(known.map(s => s.id));
        const extra = Object.entries(filteredStatusCounts)
            .filter(([id]) => !knownIds.has(id))
            .map(([id, count]) => ({
                id,
                label: id,
                color: 'gray',
                count
            }));
        return [...known, ...extra]
            .filter(s => s.count > 0)
            .sort((a, b) => (STATUS_PRIORITY[a.id] || 99) - (STATUS_PRIORITY[b.id] || 99));
    }, [filteredStatusCounts]);

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
        if (!id) return '—';
        const matched = list.find(item => item.id === id);
        if (matched) return matched.label || matched.name;
        // Tránh nhả UUID thẳng ra màn hình
        if (typeof id === 'string' && /^[0-9a-fA-F]{8}-/.test(id)) {
            return '—';
        }
        return id;
    };

    const getWarehouseLabel = (warehouseValue) => {
        if (!warehouseValue) return '—';
        const lookupKey = normalizeText(warehouseValue);
        const matchedWarehouse = warehousesList.find((warehouse) =>
            getWarehouseAliases(warehouse).includes(lookupKey)
        );

        if (matchedWarehouse?.name) return matchedWarehouse.name;

        if (typeof warehouseValue === 'string' && /^[0-9a-fA-F]{8}-/.test(warehouseValue)) {
            return '—';
        }
        return warehouseValue;
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
        setPrintContext({ type: 'single', data: orderWithDebt });
        setIsPrintModalOpen(true);
    };

    const handleHandoverPrint = (order) => {
        setPrintContext({ type: 'handover', data: order });
        setIsPrintModalOpen(true);
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

        setPrintContext({ type: 'bulk', data: selectedOrders });
        setIsPrintModalOpen(true);
    };

    const executePrint = (options) => {
        setPrintOptions(options);
        const { type, data } = printContext;

        if (type === 'single') {
            setOrdersToPrint(data);
            setHandoverToPrint(null);
        } else if (type === 'handover') {
            setOrdersToPrint(null);
            setHandoverToPrint(data);
        } else if (type === 'bulk') {
            setOrdersToPrint(data);
            setHandoverToPrint(null);
        }

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
        setViewOnly(false);
        setIsFormModalOpen(true);
        setActiveRowMenu(null);
    };

    const handleViewOrder = (order) => {
        setOrderToEdit(order);
        setViewOnly(true);
        setIsFormModalOpen(true);
        setActiveRowMenu(null);
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
            case 'sales':
                return <span className="text-[13px] text-muted-foreground font-medium">{order.ordered_by || '—'}</span>;
            case 'recipient':
                return <span className="text-[13px] text-muted-foreground font-normal">{order.recipient_name}</span>;
            case 'type':
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-semibold">
                        {getLabel(ORDER_TYPES, order.order_type)}
                    </span>
                );
            case 'product':
                const items = order.order_items || [];
                if (items.length > 1) {
                    return (
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {items.map((it, idx) => (
                                <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-semibold">
                                    {getLabel(PRODUCT_TYPES, it.product_type)} x {it.quantity}
                                </span>
                            ))}
                        </div>
                    );
                }
                return (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                        {getLabel(PRODUCT_TYPES, items[0]?.product_type || order.product_type)}
                    </span>
                );
            case 'quantity':
                const qItems = order.order_items || [];
                if (qItems.length > 0) {
                    const totalQty = qItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
                    return <span className="text-[13px] font-semibold text-foreground">{formatNumber(totalQty)}</span>;
                }
                return <span className="text-[13px] font-semibold text-foreground">{formatNumber(order.quantity)}</span>;
            case 'department':
                return (
                    <span className="text-[13px] text-muted-foreground font-normal">
                        —
                    </span>
                );
            case 'cylinders': {
                const cylinderSerials = collectCylinderSerialsFromOrder(order);
                return (
                    cylinderSerials.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                            {cylinderSerials.slice(0, 3).map((serial, idx) => (
                                <span key={idx} className="px-2.5 py-1 bg-muted/30 text-muted-foreground rounded-md text-xs font-medium border border-border">
                                    {serial}
                                </span>
                            ))}
                            {cylinderSerials.length > 3 && (
                                <button
                                    onClick={() => setSerialsModalOrder(order)}
                                    type="button"
                                    className="!h-auto !px-2.5 !py-1 !rounded-full !text-xs !font-semibold inline-flex items-center justify-center min-w-[40px] bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
                                    title="Bấm để xem danh sách đầy đủ"
                                >
                                    +{cylinderSerials.length - 3}
                                </button>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    )
                );
            }
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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5 pb-20 md:pb-0">
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
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        summary={
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5 -mx-0.5 px-0.5">
                                <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-emerald-200/60">
                                    Hiển thị{' '}
                                    <span className="tabular-nums">{filteredOrders.length}</span>
                                    <span className="text-emerald-600/80 font-semibold"> / </span>
                                    <span className="tabular-nums">{orders.length}</span> đơn
                                </span>
                                <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-primary/15">
                                    Giá trị{' '}
                                    <span className="tabular-nums">{formatNumber(totalAmount)}</span> đ
                                </span>
                                <span className="bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-amber-200/70">
                                    Chờ xử lý{' '}
                                    <span className="tabular-nums">{filteredPipelineCount}</span>
                                </span>
                            </div>
                        }
                        actions={
                            <button
                                onClick={() => {
                                    setOrderToEdit(null);
                                    setIsFormModalOpen(true);
                                }}
                                className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
                            >
                                <Plus size={20} />
                            </button>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-primary">{selectedIds.length}</span> đơn hàng
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedIds([])}
                                            className="text-[12px] font-bold text-primary hover:underline px-2 py-1"
                                        >
                                            Bỏ chọn
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleBulkPrint}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[12px] font-bold border border-blue-100"
                                            >
                                                <Printer size={14} /> In {selectedIds.length}
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100"
                                            >
                                                <Trash2 size={14} /> Xóa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null
                        }
                    />

                    {/* ── MOBILE CARD LIST ── */}
                    <div className="md:hidden flex-1 flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2.5">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredOrders.map((order, index) => {
                                const status = getStatusConfig(order.status);
                                const isSelected = selectedIds.includes(order.id);
                                return (
                                    <div key={order.id} className={clsx(
                                        "rounded-xl border shadow-sm p-3 transition-all duration-200",
                                        isSelected
                                            ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                            : "border-primary/15 bg-white"
                                    )}>
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <div className="flex gap-3">
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                        checked={selectedIds.includes(order.id)}
                                                        onChange={() => toggleSelect(order.id)}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{index + 1}</p>
                                                    <h3 className="text-[13px] font-bold text-foreground leading-tight mt-0.5">{order.order_code}</h3>
                                                </div>
                                            </div>
                                            <span className={clsx(getStatusBadgeClass(status.color), 'text-[10px] font-bold uppercase')}>
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <h3 className="text-[13px] font-black text-foreground leading-snug">{order.customer_name}</h3>
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-1.5">
                                                <span className={clsx(getCategoryBadgeClass(order.customer_category), 'text-[9px] px-2 py-0.5 tracking-wide')}>
                                                    {getLabel(CUSTOMER_CATEGORIES, order.customer_category)}
                                                </span>
                                                <span className="text-[10px] font-medium text-muted-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-2.5 rounded-xl bg-muted/10 border border-border/60 p-2">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                    <Package className="w-3 h-3 text-blue-600" /> Hàng hóa
                                                </p>
                                                <div className="text-[11px] text-foreground font-bold mt-0.5">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {order.order_items && order.order_items.length > 0 ? (
                                                            order.order_items.map((it, idx) => (
                                                                <span key={idx} className={getProductTypeBadgeClass(it.product_type)}>
                                                                    {getLabel(PRODUCT_TYPES, it.product_type)} ({it.quantity || 0})
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <>
                                                                <span className={getProductTypeBadgeClass(order.product_type)}>
                                                                    {getLabel(PRODUCT_TYPES, order.product_type)} ({order.quantity || 0})
                                                                </span>
                                                                {order.product_type_2 && order.quantity_2 > 0 && (
                                                                    <span className={getProductTypeBadgeClass(order.product_type_2)}>
                                                                        {getLabel(PRODUCT_TYPES, order.product_type_2)} ({order.quantity_2})
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                                <div className="text-[13px] text-foreground font-black mt-0.5">
                                                    {order.order_items && order.order_items.length > 0 
                                                        ? formatNumber(order.order_items.reduce((sum, it) => sum + (it.quantity || 0), 0))
                                                        : formatNumber(order.quantity)}
                                                </div>
                                            </div>
                                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                                        <User size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Người nhận</p>
                                                        <p className="text-[11px] text-foreground font-bold truncate">
                                                            {order.recipient_name || '---'} {order.recipient_phone && `(${order.recipient_phone})`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                                        <Warehouse size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Kho / Vị trí</p>
                                                        <p className="text-[11px] text-foreground font-bold truncate">
                                                            {getWarehouseLabel(order.warehouse)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50/40 rounded-xl p-2 border border-amber-100/50 mb-2.5 shadow-inner">
                                            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-amber-400 rounded-full"></div>
                                                Nợ vỏ tại khách
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(allCustomerDebts[order.customer_id] || []).length > 0 ? (
                                                    allCustomerDebts[order.customer_id].map((debt, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white/70 p-2 rounded-lg border border-amber-200/40 shadow-sm">
                                                            <span className="text-[10px] text-slate-500 font-bold">{debt.cylinder_type}</span>
                                                            <span className="text-xs text-rose-600 font-black">{debt.balance}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-2 text-[10px] text-slate-400 italic py-1">Không có nợ vỏ</div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2.5 border-t border-border/70">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Thành tiền</span>
                                                <span className="text-[14px] font-black text-primary">
                                                    {formatNumber(order.total_amount || (order.quantity || 0) * (order.unit_price || 0))} <small className="text-[10px] font-medium opacity-70">đ</small>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setIsActionModalOpen(true); }}
                                                    className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg active:scale-90 transition-all"
                                                    title="Thao tác"
                                                >
                                                    <Package size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(order)}
                                                    className="p-2 text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg active:scale-90 transition-all"
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                {(isMachineProductType(order.product_type) || isMachineProductType(order.product_type_2)) && (
                                                    <button
                                                        onClick={() => handleHandoverPrint(order)}
                                                        className="p-2 text-green-700 bg-green-50 border border-green-100 rounded-lg active:scale-90 transition-all font-bold"
                                                        title="BBBG"
                                                    >
                                                        <ClipboardCheck size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditOrder(order)}
                                                    className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg active:scale-90 transition-all"
                                                    title="Sửa đơn hàng"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                {order.order_type === 'DNXM' && (
                                                    <>
                                                        <button
                                                            onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}&viewOnly=true`)}
                                                            className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg active:scale-90 transition-all"
                                                            title="Xem Phiếu ĐNXM"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}`)}
                                                            className="p-2 text-orange-700 bg-orange-50 border border-orange-100 rounded-lg active:scale-90 transition-all"
                                                            title="Sửa Phiếu ĐNXM"
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                    </>
                                                )}
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
                                className="md:hidden fixed right-4 bottom-16 z-[95] flex items-center gap-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 border border-primary/20"
                            >
                                <Printer size={16} />
                                In {selectedIds.length} phiếu
                            </button>
                        )}

                        {/* Mobile pagination — outside overflow-y-auto so sticky works */}
                        {!isLoading && (
                            <MobilePagination
                                currentPage={1}
                                setCurrentPage={() => { }}
                                pageSize={50}
                                setPageSize={() => { }}
                                totalRecords={filteredOrders.length}
                            />
                        )}
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
                            </div>
                        </div>

                        <div className="rounded-lg border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-2 py-1.5 shadow-sm">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 custom-scrollbar whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-800 border border-slate-200 shadow-sm">
                                    Hiển thị{' '}
                                    <span className="text-primary tabular-nums">{filteredOrders.length}</span>
                                    <span className="text-slate-400 font-semibold">/</span>
                                    <span className="tabular-nums text-slate-600">{orders.length}</span>
                                    <span className="text-slate-500 font-semibold">đơn</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary border border-primary/20">
                                    Giá trị lọc{' '}
                                    <span className="tabular-nums">{formatNumber(totalAmount)}</span> đ
                                </span>
                                <span
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 border border-amber-200/80"
                                    title="Chờ duyệt, điều chỉnh, kho hoặc KD xử lý"
                                >
                                    Chờ xử lý{' '}
                                    <span className="tabular-nums">{filteredPipelineCount}</span>
                                </span>
                                {statusChipsForStrip.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground italic px-1 py-0.5">
                                        Không có đơn sau bộ lọc
                                    </span>
                                ) : (
                                    statusChipsForStrip.map(s => (
                                        <span
                                            key={s.id}
                                            title={`${s.label}: ${s.count} đơn`}
                                            className={clsx(
                                                getStatusBadgeClass(s.color),
                                                'shrink-0 text-[9px] px-2 py-0.5 gap-1 border border-black/5'
                                            )}
                                        >
                                            <span className="max-w-[min(10rem,28vw)] truncate">{s.label}</span>
                                            <span className="tabular-nums font-black opacity-90">{s.count}</span>
                                        </span>
                                    ))
                                )}
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
                                ) : sortedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy đơn hàng nào
                                        </td>
                                    </tr>
                                ) : sortedOrders.map((order) => {
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
                                            <td className="sticky right-0 z-20 bg-white px-2 py-4 text-center shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.25)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Dropdown for All Actions */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (activeRowMenu === order.id) {
                                                                    setActiveRowMenu(null);
                                                                } else {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    setMenuPosition({ 
                                                                        top: rect.bottom + window.scrollY, 
                                                                        left: rect.left + window.scrollX - 200 // Offset to the left
                                                                    });
                                                                    setActiveRowMenu(order.id);
                                                                }
                                                            }}
                                                            className={clsx(
                                                                "p-2 rounded-xl transition-all",
                                                                activeRowMenu === order.id ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                            )}
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        {activeRowMenu === order.id && createPortal(
                                                            <div 
                                                                ref={rowMenuRef}
                                                                style={{ 
                                                                    position: 'absolute', 
                                                                    top: `${menuPosition.top + 8}px`, 
                                                                    left: `${menuPosition.left}px`,
                                                                    width: '220px'
                                                                }}
                                                                className="bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[999999] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <button
                                                                    onClick={() => {
                                                                        handleViewOrder(order);
                                                                        setActiveRowMenu(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-indigo-600 hover:bg-indigo-50 transition-colors text-[13px] font-bold"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    Xem đơn hàng
                                                                </button>

                                                                {order.order_type === 'DNXM' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}&viewOnly=true`);
                                                                            setActiveRowMenu(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-blue-600 hover:bg-blue-50 transition-colors text-[13px] font-bold"
                                                                    >
                                                                        <Eye className="w-4 h-4" />
                                                                        Xem phiếu Đề nghị xuất máy
                                                                    </button>
                                                                )}

                                                                <button
                                                                    onClick={() => {
                                                                        handleEditOrder(order);
                                                                        setActiveRowMenu(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-amber-600 hover:bg-amber-50 transition-colors text-[13px] font-bold"
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                    Sửa đơn hàng
                                                                </button>

                                                                {order.order_type === 'DNXM' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}`);
                                                                            setActiveRowMenu(null);
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-orange-600 hover:bg-orange-50 transition-colors text-[13px] font-bold"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                        Sửa phiếu Đề nghị xuất máy
                                                                    </button>
                                                                )}

                                                                <div className="h-px bg-slate-100 my-1 mx-2" />

                                                                <button
                                                                    onClick={() => { setSelectedOrder(order); setIsActionModalOpen(true); setActiveRowMenu(null); }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-emerald-600 hover:bg-emerald-50 transition-colors text-[13px] font-bold"
                                                                >
                                                                    <Package className="w-4 h-4" />
                                                                    Thao tác đơn hàng
                                                                </button>

                                                                <div className="h-px bg-slate-100 my-1 mx-2" />

                                                                <button
                                                                    onClick={() => { handlePrint(order); setActiveRowMenu(null); }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors text-[13px] font-bold"
                                                                >
                                                                    <Printer className="w-4 h-4 text-slate-400" />
                                                                    In phiếu xuất kho
                                                                </button>

                                                                {(isMachineProductType(order.product_type) || isMachineProductType(order.product_type_2)) && (
                                                                    <button
                                                                        onClick={() => { handleHandoverPrint(order); setActiveRowMenu(null); }}
                                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors text-[13px] font-bold"
                                                                    >
                                                                        <ClipboardCheck className="w-4 h-4 text-slate-400" />
                                                                        In biên bản bàn giao
                                                                    </button>
                                                                )}

                                                                <div className="h-px bg-slate-100 my-1 mx-2" />

                                                                <button
                                                                    onClick={() => { handleDeleteOrder(order.id, order.order_code); setActiveRowMenu(null); }}
                                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-600 hover:bg-rose-50 transition-colors text-[13px] font-bold"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Xóa đơn hàng
                                                                </button>
                                                            </div>,
                                                            document.body
                                                        )}
                                                    </div>
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
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium flex-wrap">
                            <span>
                                {filteredOrders.length > 0 ? `1–${filteredOrders.length}` : '0'} trong{' '}
                                <span className="font-bold text-foreground tabular-nums">{filteredOrders.length}</span>
                                <span className="text-slate-400"> / </span>
                                <span className="font-bold text-foreground tabular-nums">{orders.length}</span> đơn
                            </span>
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-300">│</span>
                                <span className="text-primary font-bold tabular-nums">{formatNumber(totalAmount)} đ</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-300">│</span>
                                <span className="text-amber-700 font-bold">
                                    Chờ xử lý: <span className="tabular-nums">{filteredPipelineCount}</span>
                                </span>
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
                    warehouseName={getWarehouseLabel(selectedOrder?.warehouse)}
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
                                {collectCylinderSerialsFromOrder(serialsModalOrder).map((serial, idx) => (
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
                    initialMode={viewOnly ? 'view' : 'edit'}
                />,
                document.body
            )}

            {isPrintModalOpen && createPortal(
                <PrintOptionsModal 
                    onClose={() => setIsPrintModalOpen(false)}
                    onConfirm={executePrint}
                    title={printContext?.type === 'bulk' ? `In hàng loạt (${printContext.data.length} đơn)` : "Tùy chọn in phiếu"}
                />,
                document.body
            )}

            {/* Hidden Print Template — rendered via Portal directly under <body> to bypass #root hiding */}
            {createPortal(
                <div className="print-only-content">
                    {ordersToPrint && (
                        <OrderPrintTemplate 
                            orders={ordersToPrint} 
                            warehousesList={warehousesList} 
                            options={printOptions}
                        />
                    )}
                    {ordersToPrint && handoverToPrint && <div className="page-break" />}
                    {handoverToPrint && <MachineHandoverPrintTemplate orders={handoverToPrint} />}
                </div>,
                document.body
            )}
        </div>
    );
};

export default Orders;
