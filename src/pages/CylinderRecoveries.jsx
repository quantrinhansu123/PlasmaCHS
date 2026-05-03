import {
    BarChart2,
    Boxes,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Filter,
    Info,
    LayoutGrid,
    List,
    MapPin,
    Package,
    PackageCheck,
    Phone,
    Plus,
    Printer,
    Search,
    Table2,
    Trash2,
    User,
    X,
    Download,
    Upload,
    MoreVertical,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import CylinderRecoveryPrintTemplate from '../components/CylinderRecovery/CylinderRecoveryPrintTemplate';
import CylinderRecoveryFormModal from '../components/CylinderRecovery/CylinderRecoveryFormModal';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { RECOVERY_STATUSES, RECOVERY_TABLE_COLUMNS } from '../constants/recoveryConstants';
import usePermissions from '../hooks/usePermissions';
import { isAdminRole } from '../utils/accessControl';
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
import { supabase } from '../supabase/config';
import { toast } from 'react-toastify';
import { tryQuickCompleteRecovery } from '../utils/cylinderRecoveryCompletion';

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

const RECOVERIES_LIST_DISPLAY_MODE_KEY = 'cylinder_recoveries_list_display_mode';

const CHART_COLORS = [
    'rgba(37, 99, 235, 0.8)',   // blue-600
    'rgba(16, 185, 129, 0.8)',  // emerald-500
    'rgba(245, 158, 11, 0.8)',  // amber-500
    'rgba(139, 92, 246, 0.8)',  // violet-500
    'rgba(244, 63, 94, 0.8)',   // rose-500
    'rgba(6, 182, 212, 0.8)',   // cyan-500
    'rgba(234, 179, 8, 0.8)',   // yellow-500
    'rgba(75, 85, 99, 0.8)',    // gray-600
];

/** Ảnh nền hero (warehouse) — tương tự mockup BottleTrack */
const RECOVERY_HERO_IMAGE =
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80&auto=format&fit=crop';

const isRecoveryProcessingStatus = (status) => status !== 'HOAN_THANH' && status !== 'HUY';

const CylinderRecoveries = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { role } = usePermissions();
    const canDeleteRecoveries = isAdminRole(role);
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [recoveries, setRecoveries] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

    // UI States
    const [selectedIds, setSelectedIds] = useState([]);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [recoveryToEdit, setRecoveryToEdit] = useState(null);
    /** Mở form với trạng thái Hoàn thành sẵn (nhập vỏ + lưu), nhưng recovery prop vẫn là bản ghi DB để xử lý kho đúng */
    const [openRecoveryAsComplete, setOpenRecoveryAsComplete] = useState(false);
    const [recoveriesToPrint, setRecoveriesToPrint] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const [recoveryRowActionsOpenId, setRecoveryRowActionsOpenId] = useState(null);
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);
    const [showMoreActions, setShowMoreActions] = useState(false);
    /** Lọc nhanh như mockup: Tất cả / Đang xử lý / Hoàn thành */
    const [recoveryQuickSegment, setRecoveryQuickSegment] = useState(() => /** @type {'all' | 'processing' | 'completed'} */ ('all'));
    const [shippersList, setShippersList] = useState([]);
    const [listDisplayMode, setListDisplayMode] = useState(() => {
        try {
            const s = localStorage.getItem(RECOVERIES_LIST_DISPLAY_MODE_KEY);
            if (s === 'kanban' || s === 'table') return s;
        } catch {
            /* ignore */
        }
        return 'table';
    });

    // Filter State
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);

    const hasActiveFilters = selectedStatuses.length > 0 || selectedCustomers.length > 0 || selectedWarehouses.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedCustomers.length + selectedWarehouses.length;

    // Refs
    const listDropdownRef = useRef(null);
    const statsDropdownRef = useRef(null);

    // Column Management (Saved in LocalStorage)
    const defaultColOrder = RECOVERY_TABLE_COLUMNS.map(col => col.key);
    const columnDefs = RECOVERY_TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_recoveries_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_recoveries_visible') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });

    useEffect(() => {
        localStorage.setItem('columns_recoveries_visible', JSON.stringify(visibleColumns));
        localStorage.setItem('columns_recoveries_order', JSON.stringify(columnOrder));
    }, [visibleColumns, columnOrder]);

    useEffect(() => {
        try {
            localStorage.setItem(RECOVERIES_LIST_DISPLAY_MODE_KEY, listDisplayMode);
        } catch {
            /* ignore */
        }
    }, [listDisplayMode]);

    const isColumnVisible = (key) => visibleColumns.includes(key);

    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => RECOVERY_TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);

    // Data Fetching
    useEffect(() => {
        fetchRecoveries();
        fetchWarehouses();
        fetchCustomers();
        fetchOrders();
    }, []);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('shippers').select('name, shipping_type');
            setShippersList(data || []);
        })();
    }, []);

    const shippersByNormName = useMemo(() => {
        const m = new Map();
        for (const s of shippersList || []) {
            const k = String(s.name || '').trim().toLowerCase();
            if (k) m.set(k, s);
        }
        return m;
    }, [shippersList]);

    const driverKindForRecovery = (driverName) => {
        const raw = String(driverName || '').trim();
        if (!raw) return null;
        const shipper = shippersByNormName.get(raw.toLowerCase());
        if (!shipper) return 'noi_bo';
        return shipper.shipping_type === 'NHAN_VIEN' ? 'noi_bo' : 'doi_tac';
    };

    // Mở phiếu từ Nhiệm vụ giao hàng: /thu-hoi-vo?recovery=<uuid> [&hoanThanh=1]
    const recoveryQueryId = searchParams.get('recovery');
    const recoveryOpenComplete = searchParams.get('hoanThanh') === '1';
    useEffect(() => {
        if (!recoveryQueryId) return;
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('cylinder_recoveries')
                .select('*')
                .eq('id', recoveryQueryId)
                .maybeSingle();
            if (cancelled) return;
            if (error || !data) {
                toast.error('Không tìm thấy phiếu thu hồi.');
            } else {
                setRecoveryToEdit(data);
                setOpenRecoveryAsComplete(recoveryOpenComplete && data.status !== 'HOAN_THANH');
                setIsFormModalOpen(true);
            }
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('recovery');
                next.delete('hoanThanh');
                return next;
            }, { replace: true });
        })();
        return () => { cancelled = true; };
    }, [recoveryQueryId, recoveryOpenComplete, setSearchParams]);

    const fetchRecoveries = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('cylinder_recoveries')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecoveries(data || []);
        } catch (error) {
            const message = String(error?.message || '');
            const code = String(error?.code || '');
            if (code === '42P01' || message.includes('Could not find the table')) {
                setRecoveries([]);
                toast.error("Thiếu bảng dữ liệu 'cylinder_recoveries'. Vui lòng chạy migration schema_cylinder_recoveries.sql.");
                return;
            }
            toast.error('Lỗi khi tải danh sách thu hồi: ' + message);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data, error } = await supabase.from('warehouses').select('*').order('name');
            if (error) throw error;
            setWarehousesList(data || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase.from('customers').select('id, name, address').order('name');
            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase.from('orders').select('id, order_code');
            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    // Handlers
    const handleEdit = (recovery, forComplete = false) => {
        setRecoveryToEdit(recovery);
        setOpenRecoveryAsComplete(!!forComplete && recovery?.status !== 'HOAN_THANH');
        setIsFormModalOpen(true);
    };

    const handleRecoveryCompleteClick = async (recovery) => {
        const res = await tryQuickCompleteRecovery(supabase, recovery.id, {
            onNeedOpenForm: () => handleEdit(recovery, true),
        });
        if (res?.ok) fetchRecoveries();
    };

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu thu hồi ${code}?`)) return;
        try {
            const { error } = await supabase.from('cylinder_recoveries').delete().eq('id', id);
            if (error) throw error;
            toast.success('Xóa phiếu thu hồi thành công');
            setRecoveries(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        } catch (error) {
            toast.error('Lỗi khi xóa phiếu: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} phiếu đã chọn?`)) return;
        try {
            const { error } = await supabase.from('cylinder_recoveries').delete().in('id', selectedIds);
            if (error) throw error;
            toast.success(`Xóa ${selectedIds.length} phiếu thành công`);
            setRecoveries(prev => prev.filter(r => !selectedIds.includes(r.id)));
            setSelectedIds([]);
        } catch (error) {
            toast.error('Lỗi khi xóa hàng loạt: ' + error.message);
        }
    };

    const handleFormSuccess = () => {
        setIsFormModalOpen(false);
        setOpenRecoveryAsComplete(false);
        fetchRecoveries();
    };

    const handlePrintSingle = (recovery) => {
        setRecoveriesToPrint([recovery]);
    };

    const handleBatchPrint = () => {
        const toPrint = recoveries.filter(r => selectedIds.includes(r.id));
        setRecoveriesToPrint(toPrint);
    };

    const closeRecoveryRowActions = () => setRecoveryRowActionsOpenId(null);

    /** Menu thao tác từng dòng — mở bằng nút ba chấm */
    const renderRecoveryRowActionsMenuPanel = (recovery) => {
        const itemClass =
            'w-full flex items-center gap-3 px-3 py-2 text-left text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors';
        return (
            <>
                {recovery.status === 'CHO_PHAN_CONG' && (
                    <button
                        type="button"
                        role="menuitem"
                        className={clsx(itemClass, 'text-blue-700')}
                        onClick={() => {
                            handleEdit(recovery);
                            closeRecoveryRowActions();
                        }}
                    >
                        <User className="h-4 w-4 shrink-0 text-blue-500" />
                        Phân công
                    </button>
                )}
                {recovery.status === 'DANG_THU_HOI' && (
                    <button
                        type="button"
                        role="menuitem"
                        className={clsx(itemClass, 'text-emerald-700')}
                        onClick={() => {
                            closeRecoveryRowActions();
                            void handleRecoveryCompleteClick(recovery);
                        }}
                    >
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                        Hoàn thành
                    </button>
                )}
                <button
                    type="button"
                    role="menuitem"
                    className={itemClass}
                    onClick={() => {
                        handlePrintSingle(recovery);
                        closeRecoveryRowActions();
                    }}
                >
                    <Printer className="h-4 w-4 shrink-0 text-slate-400" />
                    In phiếu
                </button>
                <button
                    type="button"
                    role="menuitem"
                    className={clsx(itemClass, 'text-amber-800')}
                    onClick={() => {
                        handleEdit(recovery);
                        closeRecoveryRowActions();
                    }}
                >
                    <Edit className="h-4 w-4 shrink-0 text-amber-500" />
                    Chỉnh sửa
                </button>
                {canDeleteRecoveries && (
                    <>
                        <div className="my-0.5 border-t border-slate-100" role="separator" />
                        <button
                            type="button"
                            role="menuitem"
                            className={clsx(itemClass, 'text-rose-600')}
                            onClick={() => {
                                closeRecoveryRowActions();
                                handleDelete(recovery.id, recovery.recovery_code);
                            }}
                        >
                            <Trash2 className="h-4 w-4 shrink-0 text-rose-500" />
                            Xóa phiếu
                        </button>
                    </>
                )}
            </>
        );
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        toast.info('Đang xử lý file Excel...');
        // Mock import logic - actual implementation depends on schema mapping
        setTimeout(() => toast.success('Nhập dữ liệu Excel thành công (Demo)'), 1500);
    };

    const handleDownloadTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([{
            'Mã phiếu': 'TH001',
            'Ngày thu hồi': '2025-03-25',
            'Mã khách hàng': 'KH001',
            'Mã đơn hàng': 'DH001',
            'Ghi chú': 'Mẫu demo'
        }]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
        XLSX.writeFile(workbook, 'Mau_Thu_Hoi_Vo.xlsx');
    };

    // Helpers
    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || '---';
    const getCustomerAddress = (id) => customers.find(c => c.id === id)?.address || '---';
    const getOrderCode = (id) => orders.find(o => o.id === id)?.order_code || '---';
    const getWarehouseLabel = (id) => warehousesList.find(w => w.id === id)?.name || '---';

    const getStatusBadgeClass = (color) => {
        switch (color) {
            case 'blue': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'amber': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'emerald': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'rose': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getRowStyle = (isSelected) => clsx(
        "group transition-all duration-200",
        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50/80"
    );

    // Filter Logic
    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.length === filteredRecoveries.length ? [] : filteredRecoveries.map(r => r.id));
    };

    const filteredRecoveries = recoveries.filter(r => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            (r.recovery_code?.toLowerCase().includes(searchLower)) ||
            (getCustomerName(r.customer_id)?.toLowerCase().includes(searchLower)) ||
            (r.driver_name?.toLowerCase().includes(searchLower));

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(r.customer_id);
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(r.warehouse_id);

        const matchesQuickSegment =
            recoveryQuickSegment === 'all'
                ? true
                : recoveryQuickSegment === 'completed'
                  ? r.status === 'HOAN_THANH'
                  : isRecoveryProcessingStatus(r.status);

        return matchesSearch && matchesStatus && matchesCustomer && matchesWarehouse && matchesQuickSegment;
    });

    const recoveryKanbanColumns = useMemo(() => {
        const byStatus = {};
        filteredRecoveries.forEach((r) => {
            const id = String(r.status ?? 'UNKNOWN');
            if (!byStatus[id]) byStatus[id] = [];
            byStatus[id].push(r);
        });
        const knownIds = new Set(RECOVERY_STATUSES.filter((s) => s.id !== 'ALL').map((s) => s.id));
        const orderedCfgs = RECOVERY_STATUSES.filter((s) => s.id !== 'ALL');
        const col = orderedCfgs.map((cfg) => ({
            cfg,
            items: byStatus[cfg.id] ?? [],
        }));
        Object.keys(byStatus).forEach((id) => {
            if (!knownIds.has(id)) {
                col.push({
                    cfg: { id, label: id, color: 'gray' },
                    items: byStatus[id],
                });
            }
        });
        return col;
    }, [filteredRecoveries]);

    const getRecoveryLaneHeaderClass = (statusColor) =>
        clsx(
            'shrink-0 rounded-t-xl border-b px-3 py-2.5',
            statusColor === 'blue' && 'border-blue-100 bg-blue-50',
            statusColor === 'amber' && 'border-amber-100 bg-amber-50',
            statusColor === 'yellow' && 'border-amber-100 bg-amber-50',
            statusColor === 'green' && 'border-emerald-100 bg-emerald-50',
            statusColor === 'red' && 'border-rose-100 bg-rose-50',
            statusColor === 'gray' && 'border-slate-200 bg-slate-50',
            !statusColor && 'border-slate-200 bg-white',
        );

    const recoveryKanbanActionBtnClass = clsx(
        '!inline-flex !h-7 !w-7 !min-h-0 !shrink-0 !items-center !justify-center !rounded-md !border !border-slate-300 !bg-white !p-0 !text-slate-700 !shadow-sm',
        'transition hover:border-[#00288e]/40 hover:bg-[#00288e]/[0.08] hover:!text-[#00288e] active:scale-[0.96]',
        '[&_svg]:block [&_svg]:shrink-0',
    );

    const totalRecords = filteredRecoveries.length;
    const paginatedRecoveries = filteredRecoveries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Statistics Data
    const getStatusStats = () => {
        return RECOVERY_STATUSES.map(status => ({
            name: status.label,
            value: recoveries.filter(r => r.status === status.id).length,
            color: CHART_COLORS[RECOVERY_STATUSES.indexOf(status) % CHART_COLORS.length]
        })).filter(s => s.value > 0);
    };

    const getTopCustomers = () => {
        const counts = {};
        recoveries.forEach(r => {
            const name = getCustomerName(r.customer_id);
            counts[name] = (counts[name] || 0) + (r.total_items || 0);
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    };

    // Dropdown options
    const statusOptions = RECOVERY_STATUSES.map(s => ({ value: s.id, label: s.label }));
    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
    const warehouseOptions = warehousesList.map(w => ({ value: w.id, label: w.name }));

    // Interaction outside listeners
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (listDropdownRef.current && !listDropdownRef.current.contains(event.target)) {
                // We only close if not clicking within a dropdown
                if (!event.target.closest('.filter-dropdown')) {
                    setActiveDropdown(null);
                }
            }
            if (statsDropdownRef.current && !statsDropdownRef.current.contains(event.target)) {
                if (!event.target.closest('.filter-dropdown')) {
                    setActiveDropdown(null);
                }
            }
            if (!event.target.closest('#more-actions-menu-recoveries') && !event.target.closest('#more-actions-btn-recoveries')) {
                setShowMoreActions(false);
            }
            if (!event.target.closest('[data-recovery-row-actions-root]')) {
                setRecoveryRowActionsOpenId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Mobile Filter Handlers
    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingCustomers(selectedCustomers);
        setPendingWarehouses(selectedWarehouses);
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
        setSelectedStatuses(pendingStatuses);
        setSelectedCustomers(pendingCustomers);
        setSelectedWarehouses(pendingWarehouses);
        closeMobileFilter();
    };

    const getFilterButtonClass = (id, active) => {
        if (!active) return "border-border bg-white text-muted-foreground hover:bg-slate-50 hover:text-slate-600 shadow-sm";
        switch (id) {
            case 'status': return "border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/50";
            case 'customers': return "border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm shadow-cyan-100/50";
            case 'warehouses': return "border-violet-200 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/50";
            default: return "border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10";
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num || 0);

    const dashboardSummary = useMemo(() => {
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        const todayIso = startToday.toISOString();
        const newToday = recoveries.filter((r) => r.created_at && new Date(r.created_at) >= startToday).length;
        const pending = recoveries.filter((r) => isRecoveryProcessingStatus(r.status)).length;
        const totalShells = recoveries.reduce((acc, r) => acc + (Number(r.total_items) || 0), 0);
        return { newToday, pending, totalShells };
    }, [recoveries]);

    const setRecoverySegment = (seg) => {
        setRecoveryQuickSegment(seg);
        setCurrentPage(1);
    };

    const statusPillRecovery = (statusId) => {
        if (statusId === 'HOAN_THANH') {
            return 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100';
        }
        if (statusId === 'HUY') {
            return 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100';
        }
        return 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-100';
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-2 md:px-4 lg:px-8 bg-[#f7f9fb] pb-6">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
                ]}
            />

            {activeView === 'list' && (
                <>
                    {/* ── Desktop: hero + breadcrumb (mockup BottleTrack) ── */}
                    <div className="hidden md:block relative overflow-hidden rounded-xl h-44 lg:h-48 mb-6 shadow-lg shrink-0">
                        <img
                            src={RECOVERY_HERO_IMAGE}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#00288e]/90 via-[#00288e]/75 to-[#3755c3]/35" />
                        <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-10 text-white">
                            <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 mb-2">
                                <span>Hệ thống</span>
                                <ChevronRight size={12} className="opacity-80" aria-hidden />
                                <span>Kho vận</span>
                                <ChevronRight size={12} className="opacity-80" aria-hidden />
                                <span className="text-white">Thu hồi vỏ bình</span>
                            </nav>
                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight drop-shadow-sm">
                                        Thu hồi vỏ bình
                                    </h1>
                                    <p className="mt-1 text-sm text-white/85 max-w-xl">
                                        Quản lý quy trình nhận và kiểm kê vỏ bình từ khách hàng
                                    </p>
                                </div>
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm phiếu thu hồi..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full rounded-lg border-0 bg-white/95 py-2.5 pl-10 pr-10 text-sm text-slate-800 shadow-inner placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                    {searchTerm ? (
                                        <button
                                            type="button"
                                            aria-label="Xóa tìm kiếm"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        >
                                            <X size={16} />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>

                <div
                    className={clsx(
                        'flex flex-col flex-1 min-h-0 w-full relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:shadow-[0_8px_30px_rgb(0,0,0,0.04)]',
                        listDisplayMode === 'kanban' && 'md:min-h-[min(76vh,720px)]',
                    )}
                >
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm mã phiếu, khách hàng..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        actions={
                            <>
                                <div className="relative">
                                    <button
                                        id="more-actions-btn-recoveries"
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        className={clsx(
                                            "p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                            showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                        )}
                                    >
                                        <MoreVertical size={20} />
                                    </button>

                                    {showMoreActions && (
                                        <div id="more-actions-menu-recoveries" className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                            <div
                                                role="button"
                                                onClick={() => { handleDownloadTemplate(); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                                            >
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Download size={18} className="text-slate-400" />
                                                </div>
                                                Tải mẫu Excel
                                            </div>

                                            <label className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left">
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Upload size={18} className="text-slate-400" />
                                                </div>
                                                Import Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={(e) => { handleImportExcel(e); setShowMoreActions(false); }}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => { setRecoveryToEdit(null); setOpenRecoveryAsComplete(false); setIsFormModalOpen(true); }}
                                    className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-lg shadow-primary/30 active:scale-95 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-primary">{selectedIds.length}</span> phiếu
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="text-[12px] font-bold text-primary hover:underline px-2 py-1"
                                        >
                                            Bỏ chọn
                                        </button>
                                        <button
                                            onClick={handleBatchPrint}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[12px] font-bold border border-blue-100"
                                        >
                                            <Printer size={14} /> In phiếu
                                        </button>
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100"
                                        >
                                            <Trash2 size={14} /> Xóa
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />

                    {/* ── MOBILE CARD LIST ── */}
                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-24 flex flex-col gap-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic font-medium">Đang tải dữ liệu...</div>
                        ) : paginatedRecoveries.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic font-medium font-sans border-2 border-dashed border-border rounded-2xl mx-1 bg-muted/5">
                                <PackageCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                Không tìm thấy kết quả phù hợp
                            </div>
                        ) : (
                            paginatedRecoveries.map((recovery, index) => {
                                const status = RECOVERY_STATUSES.find(s => s.id === recovery.status) || RECOVERY_STATUSES[0];
                                return (
                                    <div key={recovery.id} className={clsx(
                                        "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                        selectedIds.includes(recovery.id)
                                            ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                            : "border-primary/15 bg-white"
                                    )}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-3">
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                        checked={selectedIds.includes(recovery.id)}
                                                        onChange={() => toggleSelect(recovery.id)}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{((currentPage - 1) * pageSize) + index + 1}</p>
                                                    <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5">{recovery.recovery_code}</h3>
                                                </div>
                                            </div>
                                            <span className={clsx(getStatusBadgeClass(status.color), 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap')}>
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <h3 className="text-[14px] font-bold text-foreground leading-snug">{getCustomerName(recovery.customer_id)}</h3>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                {recovery.order_id && (
                                                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 italic">
                                                        {getOrderCode(recovery.order_id)}
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-medium text-muted-foreground">{recovery.recovery_date ? new Date(recovery.recovery_date).toLocaleDateString('vi-VN') : '---'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-2 text-xs mb-3 bg-muted/10 rounded-xl p-2.5 border border-border/60">
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                    <Package className="w-3.5 h-3.5 text-blue-600" />
                                                    <span className="text-foreground font-bold leading-none mt-0.5">Yêu cầu: {recovery.requested_quantity || 0}</span>
                                                </p>
                                                <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span className="text-foreground font-bold leading-none mt-0.5">Thực tế: {recovery.total_items || 0}</span>
                                                </p>
                                            </div>
                                            <div className="space-y-1 pl-2 border-l border-border">
                                                <p className="text-muted-foreground font-medium flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                                    <span className="truncate leading-none mt-0.5">Kho: {getWarehouseLabel(recovery.warehouse_id)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 opacity-70">Tài xế</span>
                                                <span className="text-[12px] font-bold text-foreground tracking-tight">{recovery.driver_name || '—'}</span>
                                            </div>
                                            <div
                                                className="relative shrink-0"
                                                data-recovery-row-actions-root
                                            >
                                                <button
                                                    type="button"
                                                    aria-label="Thao tác"
                                                    aria-expanded={recoveryRowActionsOpenId === recovery.id}
                                                    onClick={() =>
                                                        setRecoveryRowActionsOpenId((id) =>
                                                            id === recovery.id ? null : recovery.id,
                                                        )
                                                    }
                                                    className={clsx(
                                                        'p-2 rounded-xl border shadow-sm transition-all active:scale-95',
                                                        recoveryRowActionsOpenId === recovery.id
                                                            ? 'border-slate-300 bg-slate-100 text-slate-800'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                                                    )}
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                {recoveryRowActionsOpenId === recovery.id && (
                                                    <div
                                                        className="absolute right-0 top-full z-[100] mt-1.5 min-w-[13rem] animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl"
                                                        role="menu"
                                                    >
                                                        {renderRecoveryRowActionsMenuPanel(recovery)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Sticky Mobile Pagination */}
                    {!loading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}

                    {/* ── DESKTOP TOOLBAR (mockup BottleTrack) ── */}
                    <div className="hidden md:block p-5 border-b border-slate-100 bg-white space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex shadow-sm rounded-lg overflow-hidden border border-slate-200">
                                    {[
                                        { id: 'all', label: 'Tất cả' },
                                        { id: 'processing', label: 'Đang xử lý' },
                                        { id: 'completed', label: 'Hoàn thành' },
                                    ].map((seg, i, arr) => (
                                        <button
                                            key={seg.id}
                                            type="button"
                                            onClick={() => setRecoverySegment(seg.id)}
                                            className={clsx(
                                                'px-3 py-1.5 text-sm font-semibold border-slate-200 transition-colors',
                                                i > 0 && 'border-l',
                                                recoveryQuickSegment === seg.id
                                                    ? 'bg-blue-50 text-blue-800 border-blue-100'
                                                    : 'bg-white text-slate-500 hover:bg-slate-50',
                                                i === 0 && 'rounded-l-md',
                                                i === arr.length - 1 && 'rounded-r-md',
                                            )}
                                        >
                                            {seg.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="hidden sm:block h-6 w-px bg-slate-200" aria-hidden />
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                    <Info size={18} className="text-slate-400 shrink-0" />
                                    <span>
                                        Tổng số:{' '}
                                        <strong className="text-slate-900">{formatNumber(totalRecords)} phiếu</strong>
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div
                                    className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                                    role="group"
                                    aria-label="Chế độ hiển thị"
                                >
                                    <button
                                        type="button"
                                        title="Bảng"
                                        aria-pressed={listDisplayMode === 'table'}
                                        onClick={() => setListDisplayMode('table')}
                                        className={clsx(
                                            'flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-bold transition-all sm:px-3 sm:text-[13px]',
                                            listDisplayMode === 'table'
                                                ? 'bg-white text-[#00288e] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900',
                                        )}
                                    >
                                        <Table2 size={16} className="shrink-0" aria-hidden />
                                        <span className="hidden sm:inline">Bảng</span>
                                    </button>
                                    <button
                                        type="button"
                                        title="Kanban"
                                        aria-pressed={listDisplayMode === 'kanban'}
                                        onClick={() => setListDisplayMode('kanban')}
                                        className={clsx(
                                            'flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-bold transition-all sm:px-3 sm:text-[13px]',
                                            listDisplayMode === 'kanban'
                                                ? 'bg-white text-[#00288e] shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900',
                                        )}
                                    >
                                        <LayoutGrid size={16} className="shrink-0" aria-hidden />
                                        <span className="hidden sm:inline">Kanban</span>
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-all"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                                >
                                    <Download size={18} />
                                    Xuất Excel
                                </button>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleImportExcel}
                                        className="hidden"
                                        id="excel-import"
                                    />
                                    <label
                                        htmlFor="excel-import"
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                                    >
                                        <Upload size={18} />
                                        Nhập Excel
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRecoveryToEdit(null);
                                        setOpenRecoveryAsComplete(false);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#00288e] text-white text-sm font-bold shadow-md shadow-blue-900/20 hover:bg-[#173bab] transition-all active:scale-[0.98]"
                                >
                                    <Plus size={18} />
                                    Thêm mới
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-dashed border-slate-100" ref={listDropdownRef}>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-full mb-1 sm:w-auto sm:mb-0 sm:mr-2">
                                Bộ lọc chi tiết
                            </span>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                        getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <Filter size={14} className="text-primary" />
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                        getFilterButtonClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)
                                    )}
                                >
                                    <User size={14} className="text-cyan-600" />
                                    Khách hàng
                                    {selectedCustomers.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold">
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

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses')}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                        getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <MapPin size={14} className="text-violet-600" />
                                    Kho nhận
                                    {selectedWarehouses.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses' ? "rotate-180" : "")} />
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

                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSelectedStatuses([]);
                                        setSelectedCustomers([]);
                                        setSelectedWarehouses([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all font-sans"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}

                            {/* Desktop Bulk Actions */}
                            {selectedIds.length > 0 && (
                                <div className="flex items-center gap-2 ml-auto bg-muted/20 p-1 rounded-xl border border-border">
                                    <button
                                        onClick={handleBatchPrint}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-border hover:bg-muted text-muted-foreground text-[11px] font-black transition-all shadow-sm active:scale-95"
                                    >
                                        <Printer size={14} />
                                        In phiếu ({selectedIds.length})
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-black hover:bg-rose-100 transition-all active:scale-95"
                                    >
                                        <Trash2 size={14} />
                                        Xóa ({selectedIds.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop: bảng hoặc Kanban */}
                    {listDisplayMode === 'table' ? (
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="w-12 px-4 py-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-[#00288e] focus:ring-[#00288e]"
                                            checked={
                                                selectedIds.length === filteredRecoveries.length &&
                                                filteredRecoveries.length > 0
                                            }
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    {[
                                        'Mã phiếu',
                                        'Ngày thu hồi',
                                        'Khách hàng',
                                        'Kho nhận',
                                        'NV vận chuyển',
                                        'SL yêu cầu',
                                        'SL thực tế',
                                        'Trạng thái',
                                    ].map((label) => (
                                        <th
                                            key={label}
                                            className={clsx(
                                                'px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap',
                                                (label === 'SL yêu cầu' || label === 'SL thực tế') && 'text-right',
                                            )}
                                        >
                                            {label}
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-center whitespace-nowrap">
                                        Thao tác
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-20 text-center text-slate-500 italic">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : paginatedRecoveries.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-20 text-center text-slate-500">
                                            <PackageCheck className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                            <p className="text-lg font-bold text-slate-800">Không tìm thấy phiếu nào</p>
                                            <p className="text-sm mt-1">Hãy kiểm tra bộ lọc hoặc tạo phiếu mới</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedRecoveries.map((recovery) => {
                                        const status =
                                            RECOVERY_STATUSES.find((s) => s.id === recovery.status) ||
                                            RECOVERY_STATUSES[0];
                                        const cust = getCustomerName(recovery.customer_id);
                                        const dk = driverKindForRecovery(recovery.driver_name);
                                        const req = Number(recovery.requested_quantity) || 0;
                                        const actual = Number(recovery.total_items) || 0;
                                        const qtyOk =
                                            actual > 0 &&
                                            req > 0 &&
                                            actual >= req &&
                                            recovery.status === 'HOAN_THANH';
                                        return (
                                            <tr
                                                key={recovery.id}
                                                className={clsx(
                                                    'hover:bg-slate-50/80 transition-colors group',
                                                    selectedIds.includes(recovery.id) && 'bg-blue-50/40',
                                                )}
                                            >
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-[#00288e]"
                                                        checked={selectedIds.includes(recovery.id)}
                                                        onChange={() => toggleSelect(recovery.id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(recovery)}
                                                        className="font-bold text-[#00288e] hover:underline"
                                                    >
                                                        {recovery.recovery_code}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-slate-600 font-medium">
                                                    {recovery.recovery_date
                                                        ? new Date(recovery.recovery_date).toLocaleDateString('vi-VN')
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-4 max-w-[200px] truncate whitespace-nowrap">
                                                    <span
                                                        className={clsx(
                                                            'font-medium',
                                                            cust === '---'
                                                                ? 'text-slate-400'
                                                                : 'text-slate-800 font-semibold',
                                                        )}
                                                    >
                                                        {cust === '---' ? '—' : cust}
                                                    </span>
                                                    {recovery.order_id ? (
                                                        <span className="ml-1.5 text-[10px] font-bold text-blue-600 align-middle">
                                                            {getOrderCode(recovery.order_id)}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                        <MapPin className="text-slate-400 shrink-0" size={16} />
                                                        <span>{getWarehouseLabel(recovery.warehouse_id)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {!recovery.driver_name?.trim() ? (
                                                        <span className="text-slate-400">—</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            {dk === 'doi_tac' ? (
                                                                <span className="text-[10px] font-bold rounded bg-blue-50 text-blue-600 px-1.5 py-0.5">
                                                                    ĐỐI TÁC
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold rounded bg-slate-100 text-slate-500 px-1.5 py-0.5">
                                                                    NỘI BỘ
                                                                </span>
                                                            )}
                                                            <span className="text-slate-700 font-medium">
                                                                {recovery.driver_name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right font-semibold text-slate-600 whitespace-nowrap">
                                                    {req}
                                                </td>
                                                <td className="px-4 py-4 text-right whitespace-nowrap">
                                                    {qtyOk ? (
                                                        <div className="flex items-center justify-end gap-1 font-bold text-green-600">
                                                            <span>{actual}</span>
                                                            <CheckCircle size={16} className="shrink-0" />
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className={clsx(
                                                                'font-bold',
                                                                actual > 0 ? 'text-green-600' : 'text-slate-400',
                                                            )}
                                                        >
                                                            {actual}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={statusPillRecovery(recovery.status)}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <div
                                                        className="relative inline-flex justify-center"
                                                        data-recovery-row-actions-root
                                                    >
                                                        <button
                                                            type="button"
                                                            aria-label="Thao tác"
                                                            aria-expanded={recoveryRowActionsOpenId === recovery.id}
                                                            onClick={() =>
                                                                setRecoveryRowActionsOpenId((id) =>
                                                                    id === recovery.id ? null : recovery.id,
                                                                )
                                                            }
                                                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                                                        >
                                                            <MoreVertical size={20} />
                                                        </button>
                                                        {recoveryRowActionsOpenId === recovery.id && (
                                                            <div
                                                                className="absolute right-0 top-full z-[110] mt-1 min-w-[13rem] rounded-xl border border-slate-100 bg-white py-1.5 text-left shadow-xl"
                                                                role="menu"
                                                            >
                                                                {renderRecoveryRowActionsMenuPanel(recovery)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    ) : (
                        <div
                            className={clsx(
                                'scrollbar-hide hidden md:flex md:min-h-0 md:flex-1 md:flex-col',
                                !loading && filteredRecoveries.length > 0 && 'min-h-[min(72vh,680px)]',
                            )}
                        >
                            {loading ? (
                                <div className="hidden md:flex flex-1 items-center justify-center py-20 text-slate-500 italic">
                                    Đang tải dữ liệu...
                                </div>
                            ) : filteredRecoveries.length === 0 ? (
                                <div className="hidden md:flex flex-1 flex-col items-center justify-center py-16 text-center px-6">
                                    <PackageCheck className="w-14 h-14 text-slate-200 mx-auto mb-3" />
                                    <p className="text-lg font-bold text-slate-800">Không có phiếu phù hợp</p>
                                    <p className="text-sm text-slate-500 mt-1">Thử đổi bộ lọc hoặc tạo phiếu mới</p>
                                </div>
                            ) : (
                                <div className="hidden md:flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-4 pt-1 custom-scrollbar">
                                    {recoveryKanbanColumns.map(({ cfg, items }) => {
                                        const stMeta = RECOVERY_STATUSES.find((s) => s.id === cfg.id);
                                        const laneLabel = stMeta?.label ?? cfg.label;
                                        const laneColor = stMeta?.color ?? cfg.color ?? 'gray';
                                        return (
                                            <div
                                                key={cfg.id}
                                                className="flex w-[17.5rem] shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/90 shadow-sm ring-1 ring-slate-100/80 min-h-0 max-h-full"
                                            >
                                                <div className={getRecoveryLaneHeaderClass(laneColor)}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-[12px] font-extrabold leading-tight text-slate-800">
                                                            {laneLabel}
                                                        </p>
                                                        <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-black tabular-nums text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                                                            {items.length}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="custom-scrollbar flex min-h-[14rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 pr-1">
                                                    {items.length === 0 ? (
                                                        <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[11px] leading-snug text-slate-400">
                                                            Không có phiếu
                                                        </div>
                                                    ) : (
                                                        items.map((recovery) => {
                                                            const cust = getCustomerName(recovery.customer_id);
                                                            const statusMeta = RECOVERY_STATUSES.find((s) => s.id === recovery.status);
                                                            const statusCardLabel = statusMeta?.label ?? recovery.status ?? '—';
                                                            const req = Number(recovery.requested_quantity) || 0;
                                                            const actual = Number(recovery.total_items) || 0;
                                                            return (
                                                                <div
                                                                    key={recovery.id}
                                                                    className={clsx(
                                                                        'shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm ring-1 ring-slate-100/80 transition hover:border-[#00288e]/30',
                                                                        selectedIds.includes(recovery.id) &&
                                                                            'border-[#00288e]/40 bg-blue-50/50 ring-[#00288e]/15',
                                                                    )}
                                                                >
                                                                    <div className="flex gap-1.5">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border text-[#00288e] focus:ring-[#00288e]/20"
                                                                            checked={selectedIds.includes(recovery.id)}
                                                                            onChange={() => toggleSelect(recovery.id)}
                                                                            aria-label="Chọn phiếu"
                                                                        />
                                                                        <div className="min-w-0 flex-1 space-y-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleEdit(recovery)}
                                                                                className="block w-full min-w-0 text-left"
                                                                            >
                                                                                <span className="block truncate text-[12px] font-bold leading-tight text-[#00288e]">
                                                                                    {recovery.recovery_code}
                                                                                </span>
                                                                                <span className="mt-px block truncate text-[11px] font-semibold leading-snug text-slate-800">
                                                                                    {cust === '---' ? '—' : cust}
                                                                                </span>
                                                                            </button>
                                                                            <span
                                                                                className={clsx(
                                                                                    statusPillRecovery(recovery.status),
                                                                                    '!text-[9px]',
                                                                                )}
                                                                            >
                                                                                {statusCardLabel}
                                                                            </span>
                                                                            <p className="truncate text-[10px] text-slate-500">
                                                                                SL yêu cầu{' '}
                                                                                <strong className="text-slate-700">{req}</strong> · Thực tế{' '}
                                                                                <strong className="text-slate-700">{actual}</strong>
                                                                            </p>
                                                                            <p className="truncate text-[10px] text-slate-500">
                                                                                Kho: {getWarehouseLabel(recovery.warehouse_id)}
                                                                            </p>
                                                                            {recovery.driver_name?.trim() ? (
                                                                                <p className="truncate text-[10px] text-slate-500">
                                                                                    VC:{' '}
                                                                                    <span className="font-semibold text-slate-700">
                                                                                        {recovery.driver_name.trim()}
                                                                                    </span>
                                                                                </p>
                                                                            ) : null}
                                                                            <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-1.5">
                                                                                {recovery.status === 'CHO_PHAN_CONG' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Phân công"
                                                                                        className={clsx(
                                                                                            recoveryKanbanActionBtnClass,
                                                                                            'hover:text-blue-700',
                                                                                        )}
                                                                                        onClick={() => handleEdit(recovery)}
                                                                                    >
                                                                                        <User size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                )}
                                                                                {recovery.status === 'DANG_THU_HOI' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Hoàn thành nhanh"
                                                                                        className={clsx(
                                                                                            recoveryKanbanActionBtnClass,
                                                                                            'text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50',
                                                                                        )}
                                                                                        onClick={() =>
                                                                                            void handleRecoveryCompleteClick(recovery)
                                                                                        }
                                                                                    >
                                                                                        <CheckCircle size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    title="In phiếu"
                                                                                    className={recoveryKanbanActionBtnClass}
                                                                                    onClick={() => handlePrintSingle(recovery)}
                                                                                >
                                                                                    <Printer size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    title="Chỉnh sửa"
                                                                                    className={clsx(
                                                                                        recoveryKanbanActionBtnClass,
                                                                                        'hover:text-amber-800',
                                                                                    )}
                                                                                    onClick={() => handleEdit(recovery)}
                                                                                >
                                                                                    <Edit size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                </button>
                                                                                {canDeleteRecoveries && (
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Xóa phiếu"
                                                                                        className={clsx(
                                                                                            recoveryKanbanActionBtnClass,
                                                                                            'hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600',
                                                                                        )}
                                                                                        onClick={() =>
                                                                                            handleDelete(
                                                                                                recovery.id,
                                                                                                recovery.recovery_code,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <Trash2 size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                )}
                                                                                <div
                                                                                    className="relative ml-auto"
                                                                                    data-recovery-row-actions-root
                                                                                >
                                                                                    <button
                                                                                        type="button"
                                                                                        aria-label="Thao tác khác"
                                                                                        aria-expanded={
                                                                                            recoveryRowActionsOpenId === recovery.id
                                                                                        }
                                                                                        className={recoveryKanbanActionBtnClass}
                                                                                        onClick={() =>
                                                                                            setRecoveryRowActionsOpenId((id) =>
                                                                                                id === recovery.id ? null : recovery.id,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <MoreVertical size={14} strokeWidth={2.35} className="text-inherit" />
                                                                                    </button>
                                                                                    {recoveryRowActionsOpenId === recovery.id && (
                                                                                        <div
                                                                                            className="absolute right-0 top-full z-[120] mt-1 min-w-[13rem] rounded-xl border border-slate-100 bg-white py-1.5 text-left shadow-xl"
                                                                                            role="menu"
                                                                                        >
                                                                                            {renderRecoveryRowActionsMenuPanel(recovery)}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phân trang desktop */}
                    {listDisplayMode === 'table' && (
                    <div className="hidden md:flex px-5 py-5 border-t border-slate-100 items-center justify-between bg-white">
                        <p className="text-sm text-slate-500">
                            Hiển thị{' '}
                            <span className="font-bold text-slate-900">
                                {totalRecords > 0
                                    ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}`
                                    : '0'}
                            </span>{' '}
                            trong <span className="font-bold text-slate-900">{formatNumber(totalRecords)}</span> phiếu
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || totalRecords === 0}
                                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="min-w-[2.25rem] h-9 flex items-center justify-center rounded-lg bg-[#00288e] text-white text-sm font-bold shadow-md">
                                {currentPage}
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setCurrentPage((p) =>
                                        Math.min(Math.max(1, Math.ceil(totalRecords / pageSize)), p + 1),
                                    )
                                }
                                disabled={
                                    currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0
                                }
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                    )}
                </div>

                {/* Thẻ tổng hợp (desktop) — theo mockup */}
                <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 shrink-0">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Package size={24} className="shrink-0" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Phiếu mới hôm nay</p>
                            <h4 className="text-2xl font-bold text-slate-900">
                                {dashboardSummary.newToday}{' '}
                                <span className="text-base font-semibold text-slate-500">Phiếu</span>
                            </h4>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                            <PackageCheck size={24} className="shrink-0" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Đang chờ xử lý</p>
                            <h4 className="text-2xl font-bold text-slate-900">
                                {dashboardSummary.pending}{' '}
                                <span className="text-base font-semibold text-slate-500">Phiếu</span>
                            </h4>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                            <Boxes size={24} className="shrink-0" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                Vỏ bình đã thu (tổng SL thực tế)
                            </p>
                            <h4 className="text-2xl font-bold text-slate-900">
                                {formatNumber(dashboardSummary.totalShells)}{' '}
                                <span className="text-base font-semibold text-slate-500">cái</span>
                            </h4>
                        </div>
                    </div>
                </div>
                </>
            )}

            {activeView === 'stats' && (
                <div className="flex-1 flex flex-col gap-6 min-h-0">
                    <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border bg-white">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center font-sans tracking-tight pr-8">Thống kê dữ liệu</h2>
                            <button
                                onClick={openMobileFilter}
                                className={clsx(
                                    'relative p-2 rounded-xl border shrink-0 transition-all shadow-sm',
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                                )}
                            >
                                <Filter size={18} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Desktop Stats Toolbar */}
                        <div className="hidden md:block p-4 border-b border-border bg-muted/5" ref={statsDropdownRef}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-white text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                            getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className="text-primary" />
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                            getFilterButtonClass('customers', activeDropdown === 'customers' || selectedCustomers.length > 0)
                                        )}
                                    >
                                        <User size={14} className="text-cyan-600" />
                                        Khách hàng
                                        {selectedCustomers.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold">
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

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                            getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                        )}
                                    >
                                        <MapPin size={14} className="text-violet-600" />
                                        Kho nhận
                                        {selectedWarehouses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                                                {selectedWarehouses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouses' ? "rotate-180" : "")} />
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

                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            setSelectedStatuses([]);
                                            setSelectedCustomers([]);
                                            setSelectedWarehouses([]);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all font-sans"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-3 md:px-5 pt-5 pb-10 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            {/* Summary Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center justify-start gap-4">
                                        <div className="w-14 h-14 bg-blue-100/80 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-blue-200/50 shadow-inner">
                                            <PackageCheck className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.1em] opacity-80">Tổng phiếu thu hồi</p>
                                            <p className="text-3xl font-black text-foreground mt-1 tracking-tight">{formatNumber(filteredRecoveries.length)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                    <div className="flex items-center justify-start gap-4">
                                        <div className="w-14 h-14 bg-indigo-100/80 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-indigo-200/50 shadow-inner">
                                            <Package className="w-8 h-8 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.1em] opacity-80">Tổng số vỏ thu hồi</p>
                                            <p className="text-3xl font-black text-foreground mt-1 tracking-tight">
                                                {formatNumber(filteredRecoveries.reduce((sum, r) => sum + (r.total_items || 0), 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm hover:border-primary/20 transition-all">
                                    <h3 className="text-[15px] font-bold text-foreground mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                        Thống kê theo trạng thái
                                    </h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getStatusStats().map(s => s.name),
                                                datasets: [{
                                                    data: getStatusStats().map(s => s.value),
                                                    backgroundColor: getStatusStats().map(s => s.color),
                                                    borderWidth: 0,
                                                }]
                                            }}
                                            options={{
                                                plugins: {
                                                    legend: { position: 'right', labels: { usePointStyle: true, font: { weight: 'bold', size: 11 } } }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white border border-border rounded-2xl p-6 shadow-sm hover:border-primary/20 transition-all">
                                    <h3 className="text-[15px] font-bold text-foreground mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                        Top 5 khách hàng thu hồi nhiều nhất
                                    </h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getTopCustomers().map(c => c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name),
                                                datasets: [{
                                                    label: 'Số lượng vỏ',
                                                    data: getTopCustomers().map(c => c.value),
                                                    backgroundColor: CHART_COLORS,
                                                    borderRadius: 8,
                                                }]
                                            }}
                                            options={{
                                                indexAxis: 'y',
                                                plugins: { legend: { display: false } },
                                                scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal & Portal */}
            {isFormModalOpen && (
                <CylinderRecoveryFormModal
                    recovery={recoveryToEdit}
                    prefillComplete={openRecoveryAsComplete}
                    onClose={() => {
                        setIsFormModalOpen(false);
                        setOpenRecoveryAsComplete(false);
                    }}
                    onSuccess={handleFormSuccess}
                />
            )}

            {recoveriesToPrint && createPortal(
                <div className="print-only-container">
                    {recoveriesToPrint.map((rec, idx) => (
                        <div key={rec.id}>
                            <CylinderRecoveryPrintTemplate
                                recovery={rec}
                                customerName={getCustomerName(rec.customer_id)}
                                customerAddress={getCustomerAddress(rec.customer_id)}
                                warehouseName={getWarehouseLabel(rec.warehouse_id)}
                                onPrinted={idx === recoveriesToPrint.length - 1 ? () => setRecoveriesToPrint(null) : null}
                            />
                            {idx < recoveriesToPrint.length - 1 && <div style={{ pageBreakAfter: 'always' }} />}
                        </div>
                    ))}
                </div>,
                document.body
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
                            id: 'customers',
                            label: 'Khách hàng',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: customerOptions,
                            selectedValues: pendingCustomers,
                            onSelectionChange: setPendingCustomers,
                        },
                        {
                            id: 'warehouses',
                            label: 'Kho nhận',
                            icon: <MapPin size={16} className="text-emerald-600" />,
                            options: warehouseOptions,
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses,
                        },
                    ]}
                />,
                document.body
            )}
        </div>
    );
};

export default CylinderRecoveries;
