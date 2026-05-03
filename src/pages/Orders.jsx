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
import {
    BarChart2,
    CheckCircle,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ClipboardCheck,
    Edit,
    Eye,
    FileText,
    Filter,
    LayoutGrid,
    ListFilter,
    MapPin,
    MoreVertical,
    Package,
    Phone,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Table2,
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
    TABLE_COLUMNS,
    getOrderStatusMeta,
    resolveOrderStatusKey
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
import { deleteOrdersWithRollback } from '../utils/deleteOrderCascade';
import { stripDeliveryMediaFromNote } from '../utils/orderNoteSanitize';

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

/** Kanban: bỏ cột trạng thái nguồn — gộp thẻ sang cột đích (một bước) */
const KANBAN_LANE_MERGE_FROM_TO = Object.freeze({
    TRUONG_KD_XU_LY: 'CHO_CTY_DUYET',
    KD_XU_LY: 'CHO_CTY_DUYET',
    KHO_XU_LY: 'DA_DUYET',
});
const KANBAN_HIDDEN_LANE_IDS = new Set(Object.keys(KANBAN_LANE_MERGE_FROM_TO));

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

/** BottleTrack ERP — không dùng `primary` app (#3b82f6) để không lệch mock */
const BT_PRIMARY = '#00288e';
/** Cột desktop theo mock bảng (vẫn tôn trọng cột được bật trong Column picker) */
const BOTTLETRACK_DESKTOP_TABLE_KEYS = [
    'code',
    'category',
    'customer',
    'recipient',
    'type',
    'product',
    'quantity',
    'cylinders',
    'cylinder_debt',
    'status',
    'note',
    'date',
    'sales'
];

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

const ORDERS_LIST_DISPLAY_MODE_KEY = 'orders_list_display_mode';

const Orders = () => {
    const { role, department, user, loading: permissionsLoading } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    /** Ô « Khách hàng » trong khối lọc (như HTML mock — bổ sung cho ô tìm trên toolbar) */
    const [customerFilterHint, setCustomerFilterHint] = useState('');
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
    const [listDisplayMode, setListDisplayMode] = useState(() => {
        try {
            const saved = localStorage.getItem(ORDERS_LIST_DISPLAY_MODE_KEY);
            if (saved === 'kanban' || saved === 'table') return saved;
        } catch { /* ignore */ }
        return 'table';
    });

    useEffect(() => {
        try {
            localStorage.setItem(ORDERS_LIST_DISPLAY_MODE_KEY, listDisplayMode);
        } catch { /* ignore */ }
    }, [listDisplayMode]);

    useEffect(() => {
        setVisibleColumns((prev) => prev.filter((key) => !HIDDEN_ORDER_COLUMNS.has(key)));
        setColumnOrder((prev) => prev.filter((key) => !HIDDEN_ORDER_COLUMNS.has(key)));
    }, []);

    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    /** Desktop BottleTrack: thứ tự cột giống mock, chỉ gồm cột đang bật */
    const desktopTableColumns = useMemo(
        () =>
            BOTTLETRACK_DESKTOP_TABLE_KEYS.map((key) =>
                TABLE_COLUMNS.find((col) => col.key === key)
            ).filter((col) => col && visibleColumns.includes(col.key)),
        [visibleColumns]
    );
    /** Tránh bảng trống nếu người dùng tắt hết các cột BottleTrack */
    const desktopColsForTable =
        desktopTableColumns.length > 0 ? desktopTableColumns : visibleTableColumns;
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

            // Kho (không phải thủ kho): lọc theo mã kho suy ra từ department.
            // Thủ kho không dùng .eq ở đây — họ xem theo danh sách kho phụ trách (warehouses.manager_name) ở bước lọc client bên dưới; .eq sai format warehouse sẽ làm mất hết đơn.
            if (!isAdmin && isWarehouseRole && department && !isThuKhoRole) {
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

        // Filter by status (TU_CHOI legacy → Hủy đơn)
        const matchesStatus =
            selectedStatuses.length === 0 ||
            selectedStatuses.some(
                (sel) => resolveOrderStatusKey(sel) === resolveOrderStatusKey(order.status)
            );

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

        const hint = normalizeText(customerFilterHint);
        const matchesCustomerField =
            !hint ||
            normalizeText(order.customer_name).includes(hint) ||
            normalizeText(order.order_code).includes(hint);

        return matchesSearch && matchesStatus && matchesCategory &&
            matchesOrderType && matchesProductType && matchesCustomer &&
            matchesCustomerField;
    });

    const sortedOrders = [...filteredOrders].sort((a, b) => {
        const priorityA = STATUS_PRIORITY[resolveOrderStatusKey(a.status)] || 99;
        const priorityB = STATUS_PRIORITY[resolveOrderStatusKey(b.status)] || 99;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        // Secondary sort: Newest first within same status
        return new Date(b.created_at) - new Date(a.created_at);
    });

    /** Cột Kanban: đầy đủ mọi trạng thái trong ORDER_STATUSES (+ cột phụ cho mã không có trong danh mục) */
    const kanbanColumns = useMemo(() => {
        const byStatus = {};
        sortedOrders.forEach((o) => {
            let id = resolveOrderStatusKey(String(o.status ?? 'UNKNOWN'));
            const mergeTo = KANBAN_LANE_MERGE_FROM_TO[id];
            if (mergeTo) id = mergeTo;
            if (!byStatus[id]) byStatus[id] = [];
            byStatus[id].push(o);
        });

        const knownIds = new Set(
            ORDER_STATUSES.filter((s) => s.id !== 'ALL').map((s) => s.id)
        );

        const orderedCfgs = ORDER_STATUSES.filter(
            (s) => s.id !== 'ALL' && !KANBAN_HIDDEN_LANE_IDS.has(s.id)
        ).sort(
            (a, b) => (STATUS_PRIORITY[a.id] ?? 99) - (STATUS_PRIORITY[b.id] ?? 99)
        );

        const col = orderedCfgs.map((cfg) => ({
            cfg,
            orders: byStatus[cfg.id] ?? [],
        }));

        Object.keys(byStatus).forEach((id) => {
            if (!knownIds.has(id)) {
                const fallback = ORDER_STATUSES.find((s) => s.id === id);
                col.push({
                    cfg: fallback || { id, label: id, color: 'gray' },
                    orders: byStatus[id],
                });
            }
        });

        col.sort((a, b) => (STATUS_PRIORITY[a.cfg.id] ?? 99) - (STATUS_PRIORITY[b.cfg.id] ?? 99));

        return col;
    }, [sortedOrders]);

    const getOrderQuickQty = (order) =>
        Array.isArray(order.order_items) && order.order_items.length > 0
            ? order.order_items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
            : Number(order.quantity) || 0;

    /** Đơn trong hàng giao — hiện nút lối tắt giống trang Nhiệm vụ giao hàng. */
    const isDeliveryQueueStatus = (orderStatus) =>
        orderStatus === 'CHO_GIAO_HANG' || orderStatus === 'DANG_GIAO_HANG';

    // Calculate totals
    const filteredOrdersCount = filteredOrders.length;
    const totalAmount = filteredOrders.reduce((sum, order) => {
        return sum + (order.total_amount || (order.quantity || 0) * (order.unit_price || 0));
    }, 0);

    const filteredPipelineCount = useMemo(
        () => filteredOrders.filter(o => PIPELINE_ATTENTION_STATUSES.has(o.status)).length,
        [filteredOrders]
    );

    const getStatusConfig = (statusId) => getOrderStatusMeta(statusId);

    /** Pill trạng thái như BottleTrack HTML mock (rounded-full border) */
    const getStatusBadgeClass = (statusColor) => clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap border',
        statusColor === 'blue' && 'border-blue-200 bg-blue-100 text-blue-800',
        statusColor === 'yellow' && 'border-amber-200 bg-amber-100 text-amber-800',
        statusColor === 'orange' && 'border-orange-200 bg-orange-100 text-orange-800',
        statusColor === 'green' && 'border-emerald-200 bg-emerald-100 text-emerald-800',
        statusColor === 'red' && 'border-red-200 bg-red-100 text-red-800',
        statusColor === 'gray' && 'border-slate-200 bg-slate-100 text-slate-700',
        !statusColor && 'border-border bg-muted text-muted-foreground'
    );

    const getKanbanLaneHeaderClass = (statusColor) =>
        clsx(
            'shrink-0 rounded-t-xl border-b px-3 py-2.5',
            statusColor === 'blue' && 'border-blue-100 bg-blue-50',
            statusColor === 'yellow' && 'border-amber-100 bg-amber-50',
            statusColor === 'orange' && 'border-orange-100 bg-orange-50',
            statusColor === 'green' && 'border-emerald-100 bg-emerald-50',
            statusColor === 'red' && 'border-rose-100 bg-rose-50',
            statusColor === 'gray' && 'border-slate-200 bg-slate-50',
            statusColor === 'indigo' && 'border-indigo-100 bg-indigo-50',
            statusColor === 'purple' && 'border-violet-100 bg-violet-50',
            statusColor === 'cyan' && 'border-cyan-100 bg-cyan-50',
            !statusColor && 'border-slate-200 bg-white'
        );

    /** Global `button` (index.css) dùng padding 20px + height 40px — ô w-7 sẽ “nuốt” icon; bắt buộc ghi đè. */
    const kanbanCardActionBtnClass = clsx(
        '!flex !h-7 !w-7 !min-h-0 !shrink-0 !items-center !justify-center !p-0 !rounded-md',
        '!border !border-slate-300 !bg-white !text-slate-700 !shadow-sm',
        'transition hover:border-[#00288e]/40 hover:bg-[#00288e]/[0.08] hover:!text-[#00288e] active:scale-[0.96]',
        '[&_svg]:block [&_svg]:shrink-0'
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

    const hasActiveFilters =
        selectedStatuses.length > 0 ||
        selectedCustomerCategories.length > 0 ||
        selectedOrderTypes.length > 0 ||
        selectedProductTypes.length > 0 ||
        selectedCustomers.length > 0 ||
        !!customerFilterHint.trim();

    const totalActiveFilters =
        selectedStatuses.length +
        selectedCustomerCategories.length +
        selectedOrderTypes.length +
        selectedProductTypes.length +
        selectedCustomers.length +
        (customerFilterHint.trim() ? 1 : 0);

    // Filter options for the modern FilterDropdown
    const statusOptions = ORDER_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: orders.filter((o) => resolveOrderStatusKey(o.status) === s.id).length
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
        if (
            !window.confirm(
                `Bạn có chắc muốn xóa đơn ${orderCode}?\n\nHệ thống sẽ hoàn tác tồn kho (xuất/nhập ghi theo đơn), trả bình/máy đã gán về trạng thái trước khi có đơn, rồi xóa dòng đơn và chi tiết.`,
            )
        ) {
            return;
        }

        try {
            const { deleted, failed } = await deleteOrdersWithRollback(supabase, [id]);
            if (failed.length > 0) {
                throw new Error(failed[0].message);
            }
            if (deleted === 0) {
                alert('Không tìm thấy đơn để xóa (có thể đã bị xóa trước đó).');
                fetchOrders();
                return;
            }
            setSelectedIds((prev) => prev.filter((i) => i !== id));
            fetchOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('❌ Có lỗi xảy ra khi xóa đơn hàng: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        if (
            !window.confirm(
                `Bạn có chắc muốn xóa ${selectedIds.length} đơn đã chọn?\n\nMỗi đơn sẽ được hoàn tác tồn kho, bình/máy gán, rồi xóa dữ liệu đơn.`,
            )
        ) {
            return;
        }

        const idsToDelete = [...selectedIds];

        try {
            const { deleted, failed } = await deleteOrdersWithRollback(supabase, idsToDelete);

            const failedSet = new Set(failed.map((f) => f.orderId));
            const succeededIds = idsToDelete.filter((oid) => !failedSet.has(oid));
            setSelectedIds((prev) => prev.filter((i) => !succeededIds.includes(i)));

            fetchOrders();

            if (failed.length === 0) {
                alert(`✅ Đã xóa ${deleted} đơn hàng (đã hoàn tác dữ liệu liên quan).`);
                return;
            }

            const detail = failed.map((f) => `• ${f.orderId}: ${f.message}`).join('\n');
            alert(
                `Đã xóa thành công ${deleted}/${idsToDelete.length} đơn.\n` +
                    `${failed.length} đơn gặp lỗi:\n${detail}`,
            );
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
                    <span className="text-[13px] md:text-sm font-semibold md:font-bold text-foreground md:text-blue-700">
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
                return (
                    <span className="text-[13px] md:text-sm font-medium md:font-semibold text-foreground">
                        {order.customer_name}
                    </span>
                );
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
            case 'cylinder_debt': {
                const debts = allCustomerDebts[order.customer_id] || [];
                const total = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
                const tooltip = debts
                    .map((d) => `${d.cylinder_type || '?'}:${d.balance}`)
                    .join('; ');
                if (debts.length === 0) {
                    return <span className="text-slate-400 italic whitespace-nowrap">0</span>;
                }
                return (
                    <span
                        className={clsx(
                            'inline-block whitespace-nowrap text-right font-semibold tabular-nums md:text-[13px]',
                            total > 0 ? 'text-rose-600' : 'text-foreground'
                        )}
                        title={tooltip || undefined}
                    >
                        {formatNumber(total)}
                    </span>
                );
            }
            case 'status':
                return (
                    <span className={getStatusBadgeClass(status.color)}>
                        {status.label}
                    </span>
                );
            case 'date':
                return order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '---';
            case 'note': {
                const cleaned = stripDeliveryMediaFromNote(order.note);
                return (
                    <span className="text-[13px] text-muted-foreground font-normal line-clamp-3 whitespace-pre-wrap" title={cleaned || undefined}>
                        {cleaned || '—'}
                    </span>
                );
            }
            default:
                return order[key] || '—';
        }
    };

    const openCreateOrderForm = () => {
        setOrderToEdit(null);
        setIsFormModalOpen(true);
    };

    return (
        <div
            className={clsx(
                'animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 pb-20',
                activeView === 'list' ? 'md:bg-[#f7f9fb] md:px-6 md:pb-8' : 'md:px-1.5 md:pb-0'
            )}
        >
            {activeView === 'list' && (
                <>
                {/* Desktop: thanh điều khiển đầu trang — một hàng */}
                <div className="hidden shrink-0 font-[family-name:Manrope,system-ui,sans-serif] md:-mt-1 md:mb-4 md:block">
                    <div className="sticky top-0 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex min-h-14 flex-nowrap items-center gap-3 overflow-x-auto px-5 py-3 sm:gap-4 sm:px-6 scrollbar-hide">
                            <h2 className="shrink-0 text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                                Quản lý đơn hàng
                            </h2>
                            <div className="relative min-w-0 max-w-xl flex-1 md:max-w-md lg:max-w-lg">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
                                    aria-hidden
                                />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm đơn hàng, khách hàng..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full rounded-lg border-0 bg-slate-100 py-2 pl-10 pr-8 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00288e]/25"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <div
                                className="ml-auto flex shrink-0 items-center gap-2"
                                role="group"
                                aria-label="Chế độ hiển thị"
                            >
                                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                                    <button
                                        type="button"
                                        title="Bảng"
                                        aria-pressed={listDisplayMode === 'table'}
                                        onClick={() => setListDisplayMode('table')}
                                        className={clsx(
                                            'flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-bold transition-all sm:px-3 sm:text-[13px]',
                                            listDisplayMode === 'table'
                                                ? 'bg-white text-[#00288e] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        <Table2 size={16} className="shrink-0" aria-hidden />
                                        <span className="hidden sm:inline">Bảng</span>
                                    </button>
                                    <button
                                        type="button"
                                        title="Kanban"
                                        aria-pressed={listDisplayMode === 'kanban'}
                                        onClick={() => {
                                            setListDisplayMode('kanban');
                                            setShowColumnPicker(false);
                                        }}
                                        className={clsx(
                                            'flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-bold transition-all sm:px-3 sm:text-[13px]',
                                            listDisplayMode === 'kanban'
                                                ? 'bg-white text-[#00288e] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        <LayoutGrid size={16} className="shrink-0" aria-hidden />
                                        <span className="hidden sm:inline">Kanban</span>
                                    </button>
                                </div>
                                {listDisplayMode === 'table' && (
                                    <div className="relative" ref={columnPickerRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowColumnPicker((prev) => !prev)}
                                            className={clsx(
                                                'flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-[13px] font-bold shadow-sm transition-colors',
                                                showColumnPicker
                                                    ? 'border-[#00288e]/40 bg-[#00288e]/5 text-[#00288e]'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                                )}
                                <button
                                    type="button"
                                    onClick={openCreateOrderForm}
                                    className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                                    style={{ backgroundColor: BT_PRIMARY }}
                                >
                                    <Plus size={17} aria-hidden />
                                    Thêm
                                </button>
                            </div>
                        </div>
                        {selectedIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-2.5 sm:px-6">
                                <span className="mr-auto text-[12px] font-bold text-slate-600">
                                    Đã chọn <span className="text-[#00288e]">{selectedIds.length}</span> đơn
                                </span>
                                <button
                                    onClick={handleBulkPrint}
                                    type="button"
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    <Printer size={16} />
                                    In {selectedIds.length} phiếu
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    type="button"
                                    className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-600 shadow-sm hover:bg-rose-100"
                                >
                                    <Trash2 size={16} />
                                    Xóa ({selectedIds.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedIds([])}
                                    className="text-[12px] font-bold text-slate-500 hover:text-slate-800"
                                >
                                    Bỏ chọn
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col flex-1 min-h-0 w-full rounded-2xl border border-border bg-white shadow-sm md:overflow-hidden md:rounded-xl md:border-slate-200 md:shadow-md">
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

                                        {isDeliveryQueueStatus(order.status) && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                <button
                                                    type="button"
                                                    title="Mở xác nhận giao hàng"
                                                    onClick={() => navigate(`/nhiem-vu-giao-hang?focusOrderId=${order.id}`)}
                                                    className="flex-1 min-w-[120px] px-2 py-2 rounded-lg bg-primary text-white text-[11px] font-bold shadow-sm inline-flex items-center justify-center gap-1"
                                                >
                                                    <CheckCircle2 size={14} />
                                                    Giao hàng
                                                </button>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.recipient_address || '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600"
                                                    title="Bản đồ"
                                                >
                                                    <MapPin size={16} />
                                                </a>
                                            </div>
                                        )}

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

                    {/* ── DESKTOP TOOLBAR — BottleTrack ── */}
                    <div className="hidden md:block border-b border-slate-200 p-6 pb-8">
                        <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-100">
                            <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-800">
                                <span className="text-slate-500">Đang hiển thị:</span>{' '}
                                <strong className="tabular-nums text-[#00288e]">{filteredOrders.length}</strong>
                                <span>/</span>
                                <strong className="tabular-nums text-slate-600">{orders.length}</strong>
                                <span className="text-slate-500 font-medium">đơn</span>
                            </span>
                            <span className="rounded-md bg-[#00288e]/7 px-2.5 py-1 font-bold text-[#00288e] ring-1 ring-[#00288e]/10">
                                Giá trị lọc {formatNumber(totalAmount)}đ
                            </span>
                            <span className="rounded-md bg-amber-50 px-2.5 py-1 font-bold text-amber-900 ring-1 ring-amber-100">
                                Chờ xử lý {filteredPipelineCount}
                            </span>
                        </div>

                        {/* Bộ lọc — nhãn mock + trigger dạng select */}
                        <div
                            ref={listDropdownRef}
                            className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                        >
                            <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Trạng thái
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeDropdown !== 'status') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'status' ? null : 'status');
                                    }}
                                    className={clsx(
                                        'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium shadow-sm hover:bg-white',
                                        (activeDropdown === 'status' || selectedStatuses.length > 0) && 'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                    )}
                                >
                                    <span className="truncate">
                                        {selectedStatuses.length === 0
                                            ? 'Tất cả trạng thái'
                                            : `${selectedStatuses.length} đã chọn`}
                                    </span>
                                    <ChevronDown size={18} className={clsx('shrink-0 opacity-70', activeDropdown === 'status' && 'rotate-180')} />
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

                            <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Loại khách
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeDropdown !== 'categories') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'categories' ? null : 'categories');
                                    }}
                                    className={clsx(
                                        'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium shadow-sm hover:bg-white',
                                        (activeDropdown === 'categories' || selectedCustomerCategories.length > 0) &&
                                            'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                    )}
                                >
                                    <span className="truncate">
                                        {selectedCustomerCategories.length === 0
                                            ? 'Tất cả loại khách'
                                            : `${selectedCustomerCategories.length} đã chọn`}
                                    </span>
                                    <ChevronDown size={18} className={clsx('shrink-0 opacity-70', activeDropdown === 'categories' && 'rotate-180')} />
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

                            <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Loại đơn
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeDropdown !== 'orderTypes') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'orderTypes' ? null : 'orderTypes');
                                    }}
                                    className={clsx(
                                        'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium shadow-sm hover:bg-white',
                                        (activeDropdown === 'orderTypes' || selectedOrderTypes.length > 0) &&
                                            'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                    )}
                                >
                                    <span className="truncate">
                                        {selectedOrderTypes.length === 0
                                            ? 'Tất cả loại đơn'
                                            : `${selectedOrderTypes.length} đã chọn`}
                                    </span>
                                    <ChevronDown size={18} className={clsx('shrink-0 opacity-70', activeDropdown === 'orderTypes' && 'rotate-180')} />
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

                            <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Hàng hóa
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeDropdown !== 'productTypes') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'productTypes' ? null : 'productTypes');
                                    }}
                                    className={clsx(
                                        'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium shadow-sm hover:bg-white',
                                        (activeDropdown === 'productTypes' || selectedProductTypes.length > 0) &&
                                            'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                    )}
                                >
                                    <span className="truncate">
                                        {selectedProductTypes.length === 0
                                            ? 'Tất cả sản phẩm'
                                            : `${selectedProductTypes.length} đã chọn`}
                                    </span>
                                    <ChevronDown size={18} className={clsx('shrink-0 opacity-70', activeDropdown === 'productTypes' && 'rotate-180')} />
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

                            <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Khách hàng
                                </label>
                                <input
                                    type="text"
                                    value={customerFilterHint}
                                    onChange={(e) => setCustomerFilterHint(e.target.value)}
                                    placeholder="Tên KH hoặc Mã ĐH"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-[#00288e]/40 focus:bg-white focus:ring-2 focus:ring-[#00288e]/15"
                                />
                                {selectedCustomers.length > 0 && (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        Đã chọn {selectedCustomers.length} khách từ bộ lọc đầy đủ ·{' '}
                                        <button
                                            type="button"
                                            className="font-semibold text-[#00288e] hover:underline"
                                            onClick={openMobileFilter}
                                        >
                                            mở bộ lọc
                                        </button>
                                    </p>
                                )}
                            </div>

                            <div className="flex min-h-[3.625rem] items-end">
                                <button
                                    type="button"
                                    onClick={openMobileFilter}
                                    title="Bộ lọc đầy đủ (loại máy chủ, khách danh mục...)"
                                    className="flex h-10 min-w-[2.75rem] items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
                                >
                                    <ListFilter size={22} aria-hidden />
                                </button>
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSelectedStatuses([]);
                                        setSelectedCustomerCategories([]);
                                        setSelectedOrderTypes([]);
                                        setSelectedProductTypes([]);
                                        setSelectedCustomers([]);
                                        setCustomerFilterHint('');
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop: bảng hoặc Kanban */}
                    <div
                        className={clsx(
                            'scrollbar-hide hidden min-h-0 flex-1 md:block',
                            listDisplayMode === 'kanban' && 'md:flex md:min-h-0 md:flex-col'
                        )}
                    >
                        {listDisplayMode === 'table' ? (
                            <div className="overflow-x-auto bg-white">
                                <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="px-4 py-4 w-10 whitespace-nowrap">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                                                checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </div>
                                    </th>
                                    {desktopColsForTable.map((col) => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                'px-4 py-4 text-[12px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap',
                                                (col.key === 'quantity' || col.key === 'cylinder_debt') && 'text-right'
                                            )}
                                        >
                                            {col.key === 'sales' ? 'Nhân viên KD' : col.label}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-4 shadow-[-4px_0_4px_rgba(0,0,0,0.02)]" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={desktopColsForTable.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : sortedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={desktopColsForTable.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy đơn hàng nào
                                        </td>
                                    </tr>
                                ) : sortedOrders.map((order) => {
                                    const status = getStatusConfig(order.status);
                                    return (
                                        <tr
                                            key={order.id}
                                            className={clsx(
                                                'transition-colors hover:bg-slate-50 group',
                                                selectedIds.includes(order.id) && 'bg-blue-50/50'
                                            )}
                                        >
                                            <td className="px-4 py-4 uppercase whitespace-nowrap">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                                                        checked={selectedIds.includes(order.id)}
                                                        onChange={() => toggleSelect(order.id)}
                                                    />
                                                </div>
                                            </td>
                                            {desktopColsForTable.map((col) => (
                                                <td
                                                    key={col.key}
                                                    className={clsx(
                                                        'px-4 py-4 text-sm whitespace-nowrap',
                                                        col.key === 'note' && 'max-w-[12rem]',
                                                        col.key === 'quantity' && 'text-right font-bold tabular-nums',
                                                        col.key === 'cylinder_debt' && 'text-right',
                                                        (col.key === 'sales' || col.key === 'recipient') && 'font-normal text-slate-900'
                                                    )}
                                                >
                                                    {renderCell(col.key, order)}
                                                </td>
                                            ))}
                                            <td className="sticky right-0 z-20 whitespace-nowrap bg-white px-4 py-4 shadow-[-4px_0_4px_rgba(0,0,0,0.02)] group-hover:bg-slate-50">
                                                <div className="flex justify-end">
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

                                                                {isDeliveryQueueStatus(order.status) && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                navigate(`/nhiem-vu-giao-hang?focusOrderId=${order.id}`);
                                                                                setActiveRowMenu(null);
                                                                            }}
                                                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-primary/5"
                                                                        >
                                                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                                            Giao hàng
                                                                        </button>
                                                                        <a
                                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.recipient_address || '')}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={() => setActiveRowMenu(null)}
                                                                            className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                                                        >
                                                                            <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                                                                            Mở bản đồ
                                                                        </a>
                                                                        <div className="mx-2 my-1 h-px bg-slate-100" />
                                                                    </>
                                                                )}

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
                        ) : (
                            <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 bg-slate-50/60 px-2 py-3 md:min-h-[calc(100vh-13.75rem)] sm:px-4">
                                {isLoading ? (
                                    <div className="flex h-40 items-center justify-center text-[13px] text-slate-500">
                                        Đang tải dữ liệu...
                                    </div>
                                ) : sortedOrders.length === 0 ? (
                                    <div className="flex h-40 items-center justify-center text-[13px] text-slate-500">
                                        Không tìm thấy đơn hàng nào
                                    </div>
                                ) : (
                                    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2 sm:gap-4">
                                        {kanbanColumns.map(({ cfg, orders: laneOrders }) => (
                                            <div
                                                key={cfg.id}
                                                className="flex w-[17.5rem] shrink-0 flex-col self-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:w-72"
                                            >
                                                <div className={getKanbanLaneHeaderClass(cfg.color)}>
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        {cfg.label}
                                                    </p>
                                                    <p className="text-lg font-extrabold leading-tight text-slate-900 tabular-nums">
                                                        {laneOrders.length}
                                                    </p>
                                                </div>
                                                <div className="custom-scrollbar flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 pr-1">
                                                    {laneOrders.length === 0 ? (
                                                        <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[12px] leading-snug text-slate-400">
                                                            Không có đơn
                                                        </div>
                                                    ) : (
                                                        laneOrders.map((order) => (
                                                            <div
                                                                key={order.id}
                                                                className={clsx(
                                                                    'shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm ring-1 ring-slate-100/80 transition hover:border-[#00288e]/35 hover:ring-[#00288e]/12',
                                                                    selectedIds.includes(order.id) &&
                                                                        'border-[#00288e]/40 bg-blue-50/50 ring-[#00288e]/18'
                                                                )}
                                                            >
                                                                <div className="flex gap-1.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-border text-primary focus:ring-primary/20"
                                                                        checked={selectedIds.includes(order.id)}
                                                                        onChange={() => toggleSelect(order.id)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        aria-label="Chọn đơn"
                                                                    />
                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleViewOrder(order)}
                                                                            className="block w-full min-w-0 text-left"
                                                                        >
                                                                            <span className="block truncate text-[12px] font-bold leading-tight text-[#00288e]">
                                                                                {order.order_code}
                                                                            </span>
                                                                            <span className="mt-px block truncate text-[11px] font-medium leading-snug text-slate-800">
                                                                                {order.customer_name || '—'}
                                                                            </span>
                                                                        </button>
                                                                        <div className="flex min-w-0 items-center gap-1 truncate text-[10px] leading-none text-slate-500">
                                                                            <span className="shrink-0 font-semibold tabular-nums text-slate-600">
                                                                                SL {formatNumber(getOrderQuickQty(order))}
                                                                            </span>
                                                                            <span className="shrink-0 text-slate-300">·</span>
                                                                            <span className="min-w-0 truncate">
                                                                                {getLabel(ORDER_TYPES, order.order_type)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-1.5">
                                                                            <button
                                                                                type="button"
                                                                                title="Xem đơn"
                                                                                className={kanbanCardActionBtnClass}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleViewOrder(order);
                                                                                }}
                                                                            >
                                                                                <Eye size={14} strokeWidth={2.35} className="text-inherit" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                title="Sửa đơn"
                                                                                className={clsx(
                                                                                    kanbanCardActionBtnClass,
                                                                                    'hover:text-amber-700'
                                                                                )}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleEditOrder(order);
                                                                                }}
                                                                            >
                                                                                <Edit size={14} strokeWidth={2.35} className="text-inherit" />
                                                                            </button>
                                                                            {isDeliveryQueueStatus(order.status) && (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Giao hàng"
                                                                                        className={clsx(
                                                                                            kanbanCardActionBtnClass,
                                                                                            'text-primary hover:border-primary/30 hover:bg-primary/5'
                                                                                        )}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            navigate(`/nhiem-vu-giao-hang?focusOrderId=${order.id}`);
                                                                                        }}
                                                                                    >
                                                                                        <CheckCircle2 size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                    <a
                                                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.recipient_address || '')}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        title="Bản đồ"
                                                                                        className={kanbanCardActionBtnClass}
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        <MapPin size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </a>
                                                                                </>
                                                                            )}
                                                                            {order.order_type === 'DNXM' && (
                                                                                <>
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Xem phiếu ĐNXM"
                                                                                        className={clsx(
                                                                                            kanbanCardActionBtnClass,
                                                                                            'text-blue-600 hover:text-blue-700'
                                                                                        )}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}&viewOnly=true`);
                                                                                        }}
                                                                                    >
                                                                                        <FileText size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Sửa phiếu ĐNXM"
                                                                                        className={clsx(
                                                                                            kanbanCardActionBtnClass,
                                                                                            'text-orange-600 hover:text-orange-700'
                                                                                        )}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${order.id}`);
                                                                                        }}
                                                                                    >
                                                                                        <Edit size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                title="Thao tác đơn hàng"
                                                                                className={clsx(
                                                                                    kanbanCardActionBtnClass,
                                                                                    'text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'
                                                                                )}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedOrder(order);
                                                                                    setIsActionModalOpen(true);
                                                                                }}
                                                                            >
                                                                                <Package size={14} strokeWidth={2.35} className="text-inherit" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                title="In phiếu xuất kho"
                                                                                className={kanbanCardActionBtnClass}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePrint(order);
                                                                                }}
                                                                            >
                                                                                <Printer size={14} strokeWidth={2.35} className="text-inherit" />
                                                                            </button>
                                                                            {(isMachineProductType(order.product_type) ||
                                                                                isMachineProductType(order.product_type_2)) && (
                                                                                <button
                                                                                    type="button"
                                                                                    title="In biên bản bàn giao"
                                                                                    className={clsx(
                                                                                        kanbanCardActionBtnClass,
                                                                                        'text-green-700 hover:border-green-300 hover:bg-green-50'
                                                                                    )}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleHandoverPrint(order);
                                                                                    }}
                                                                                >
                                                                                    <ClipboardCheck size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                title="Xóa đơn"
                                                                                className={clsx(
                                                                                    kanbanCardActionBtnClass,
                                                                                    'hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                                                                                )}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteOrder(order.id, order.order_code);
                                                                                }}
                                                                            >
                                                                                <Trash2 size={14} strokeWidth={2.35} className="text-inherit" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                </>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
                    <div className="space-y-0">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                            <button
                                type="button"
                                onClick={() => setActiveView('list')}
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
                                    type="button"
                                    onClick={() => setActiveView('list')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Danh sách đơn
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
                                            setCustomerFilterHint('');
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
