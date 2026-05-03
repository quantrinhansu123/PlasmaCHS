import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
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
import { Bar as BarChartJS } from 'react-chartjs-2';
import {
    BarChart2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Eye,
    FileText,
    LayoutGrid,
    List,
    ListFilter,
    Monitor,
    Package,
    Plus,
    Search,
    Table2,
    Trash2,
    TrendingUp,
    Truck,
    User,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, cloneElement, useRef, useMemo } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import { deleteOrdersWithRollback } from '../utils/deleteOrderCascade';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import usePermissions from '../hooks/usePermissions';
import { isAdminRole } from '../utils/accessControl';
import { resolveOrderStatusKey } from '../constants/orderConstants';

const getApprovedQuantityFromRequest = (request) => {
    const directApproved = parseInt(request?.quantityApproved ?? request?.quantity_approved, 10);
    if (!Number.isNaN(directApproved) && directApproved >= 0) return directApproved;
    const note = request?.note || '';
    const match = note.match(/SL phê duyệt:\s*([0-9]+)/i);
    if (match?.[1]) return parseInt(match[1], 10) || 0;
    return parseInt(request?.quantity, 10) || 0;
};

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

const warehouseKeyMatches = (candidateKeys, allowedKeys) => {
    if (!candidateKeys?.length || !allowedKeys?.length) return false;
    return candidateKeys.some((candidate) =>
        allowedKeys.some((allowed) => candidate === allowed || candidate.includes(allowed) || allowed.includes(candidate))
    );
};

const isMachineRequestOrder = (order) => {
    const orderType = String(order?.order_type || '').trim().toUpperCase();
    const orderCode = String(order?.order_code || '').trim().toUpperCase();
    const note = String(order?.note || '');
    if (orderType === 'DNXM') return true;
    if (orderCode.includes('DNXM') || orderCode.includes('TMV')) return true;
    return /Loại máy:|Phụ trách máy:|Mã máy:/i.test(note);
};

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

const BT_PRIMARY = '#00288e';
const BT_PRIMARY_CONTAINER = '#1e40af';
const DNXM_PAGE_HERO_IMAGE =
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&q=80&auto=format&fit=crop';

const DNXM_LIST_DISPLAY_MODE_KEY = 'dnxm_list_display_mode';

/** Trạng thái cần xử lý trên phiếu ĐNXM — đếm nhanh */
const MACHINE_REQ_PIPELINE_STATUSES = new Set(['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY']);

const formatNumberBt = (num) => {
    if (num == null || Number.isNaN(Number(num))) return '0';
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function MachineRequests() {
    const navigate = useNavigate();
    const { role } = usePermissions();
    const isAdmin = isAdminRole(role);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    
    // Filters States
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);

    // Bulk selection (xóa nhiều phiếu)
    const [selectedRequestIds, setSelectedRequestIds] = useState([]);

    // Mobile filter sheet state
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingDateRange, setPendingDateRange] = useState({ start_date: '', end_date: '' });

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const listDropdownRef = useRef(null);

    const [listDisplayMode, setListDisplayMode] = useState(() => {
        try {
            const saved = localStorage.getItem(DNXM_LIST_DISPLAY_MODE_KEY);
            if (saved === 'kanban' || saved === 'table') return saved;
        } catch { /* ignore */ }
        return 'table';
    });

    useEffect(() => {
        try {
            localStorage.setItem(DNXM_LIST_DISPLAY_MODE_KEY, listDisplayMode);
        } catch { /* ignore */ }
    }, [listDisplayMode]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (listDropdownRef.current && !listDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // States for View Order Modal
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [orderToView, setOrderToView] = useState(null);

    const COMMON_STATUSES = [
        { id: 'ALL', label: 'Tất cả' },
        { id: 'CHO_DUYET', label: 'Chờ Lead duyệt' },
        { id: 'CHO_CTY_DUYET', label: 'Chờ Cty duyệt' },
        { id: 'KHO_XU_LY', label: 'Chờ Kho duyệt' },
        { id: 'DA_DUYET', label: 'Đã duyệt' },
        { id: 'HOAN_THANH', label: 'Hoàn thành' },
        { id: 'HUY_DON', label: 'Hủy đơn' },
    ];

    useEffect(() => {
        fetchData();
    }, []);

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
        setPendingCustomers(selectedCustomers);
        setPendingDateRange({ start_date: fromDate, end_date: toDate });
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedCustomers(pendingCustomers);
        setFromDate(pendingDateRange.start_date);
        setToDate(pendingDateRange.end_date);
        closeMobileFilter();
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('orders')
                .select('*');

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;

            setRequests(data || []);
        } catch (error) {
            toast.error('Lỗi tải dữ liệu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const dnxmOrders = useMemo(() => requests.filter(isMachineRequestOrder), [requests]);

    const filteredRequests = dnxmOrders.filter((r) => {
        const matchesSearch = (r.order_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.ordered_by || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus =
            selectedStatuses.length === 0 ||
            selectedStatuses.some(
                (sel) => resolveOrderStatusKey(sel) === resolveOrderStatusKey(r.status)
            );
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(r.customer_name);

        const rDate = new Date(r.created_at).getTime();
        let matchesDate = true;
        if (fromDate) {
            matchesDate = matchesDate && rDate >= new Date(fromDate).getTime();
        }
        if (toDate) {
             const toTime = new Date(toDate).getTime() + 86399999;
             matchesDate = matchesDate && rDate <= toTime;
        }

        return matchesSearch && matchesStatus && matchesCustomer && matchesDate;
    });

    const dnxmMonthStats = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const startThis = new Date(y, m, 1).getTime();
        const endThis = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
        const startPrev = new Date(y, m - 1, 1).getTime();
        const endPrev = new Date(y, m, 0, 23, 59, 59, 999).getTime();
        let thisMonth = 0;
        let prevMonth = 0;
        dnxmOrders.forEach((r) => {
            const t = new Date(r.created_at).getTime();
            if (t >= startThis && t <= endThis) thisMonth += 1;
            else if (t >= startPrev && t <= endPrev) prevMonth += 1;
        });
        const pct =
            prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : null;
        return { thisMonth, prevMonth, pct };
    }, [dnxmOrders]);

    const pipelineAttentionCount = useMemo(
        () => dnxmOrders.filter((r) => MACHINE_REQ_PIPELINE_STATUSES.has(r.status)).length,
        [dnxmOrders]
    );

    const uniqueCustomers = Array.from(new Set(dnxmOrders.map((r) => r.customer_name).filter(Boolean)));
    const customerOptions = uniqueCustomers.map(c => ({
        id: c,
        label: c,
        count: dnxmOrders.filter(o => o.customer_name === c).length
    }));

    const statusOptions = COMMON_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: dnxmOrders.filter((o) => resolveOrderStatusKey(o.status) === s.id).length
    }));
    const kanbanStatuses = COMMON_STATUSES.filter((s) => s.id !== 'ALL');

    const totalRecords = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const hasActiveFilters = selectedStatuses.length > 0 || selectedCustomers.length > 0 || fromDate || toDate;
    const totalActiveFilters = selectedStatuses.length + selectedCustomers.length + (fromDate ? 1 : 0) + (toDate ? 1 : 0);

    useEffect(() => {
        // Tránh tình trạng user chọn trước rồi lọc/phân trang làm lệch danh sách xóa
        setSelectedRequestIds([]);
    }, [searchTerm, selectedStatuses, selectedCustomers, fromDate, toDate, currentPage, pageSize]);

    const toggleSelectOne = (id) => {
        setSelectedRequestIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleDelete = async (id, code) => {
        if (
            !window.confirm(
                `Xóa phiếu ${code}?\nTồn kho và bình/máy gán theo đơn (nếu có) sẽ được hoàn tác trước khi xóa.`,
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
                toast.info('Phiếu không còn trên hệ thống.');
                fetchData();
                return;
            }
            toast.success(`Đã xóa phiếu ${code}`);
            fetchData();
        } catch (error) {
            toast.error('Lỗi xóa phiếu: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedRequestIds.length) return;
        if (
            !window.confirm(
                `Xóa ${selectedRequestIds.length} phiếu?\nHoàn tác tồn kho và tài sản gán cho từng đơn trước khi xóa.`,
            )
        ) {
            return;
        }
        const ids = [...selectedRequestIds];
        try {
            const { deleted, failed } = await deleteOrdersWithRollback(supabase, ids);
            const failedSet = new Set(failed.map((f) => f.orderId));
            const succeededIds = ids.filter((oid) => !failedSet.has(oid));
            setSelectedRequestIds((prev) => prev.filter((x) => !succeededIds.includes(x)));
            fetchData();
            if (failed.length === 0) {
                toast.success(`Đã xóa ${deleted} phiếu (đã hoàn tác dữ liệu liên quan).`);
                return;
            }
            toast.warning(
                `Xóa được ${deleted}/${ids.length} phiếu. ${failed.length} lỗi — xem console.`,
                { autoClose: 8000 },
            );
            console.warn('[ĐNXM bulk delete]', failed);
        } catch (error) {
            toast.error('Lỗi xóa phiếu: ' + error.message);
        }
    };

    const handleViewAsOrder = (order) => {
        setOrderToView(order);
        setIsOrderModalOpen(true);
    };

    // Đã chuyển logic duyệt sang MachineIssueRequestForm.jsx

    const getChartData = () => {
        const customerData = {};
        dnxmOrders.forEach((r) => {
            const name = r.customer_name || 'Không rõ';
            customerData[name] = (customerData[name] || 0) + getApprovedQuantityFromRequest(r);
        });

        const sortedCustomers = Object.entries(customerData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            labels: sortedCustomers.map(c => c[0].length > 15 ? c[0].substring(0, 15) + '...' : c[0]),
            datasets: [{
                label: 'Số lượng máy đề nghị',
                data: sortedCustomers.map(c => c[1]),
                backgroundColor: 'rgba(56, 189, 248, 0.8)',
                borderRadius: 6,
                barThickness: 24
            }]
        };
    };

    const getStatusInfo = (status) => {
        const key = resolveOrderStatusKey(status);
        switch (key) {
            case 'CHO_DUYET': return { label: 'Chờ Lead duyệt', colorCls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
            case 'CHO_CTY_DUYET': return { label: 'Chờ Công ty duyệt', colorCls: 'bg-orange-50 text-orange-700 border-orange-200' };
            case 'KHO_XU_LY': return { label: 'Chờ Kho duyệt', colorCls: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
            case 'DA_DUYET': return { label: 'Đã duyệt', colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'CHO_GIAO_HANG': return { label: 'Chờ giao hàng', colorCls: 'bg-amber-50 text-amber-700 border-amber-200' };
            case 'DANG_GIAO_HANG': return { label: 'Đang giao hàng', colorCls: 'bg-sky-50 text-sky-700 border-sky-200' };
            case 'CHO_DOI_SOAT': return { label: 'Chờ đối soát', colorCls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
            case 'HOAN_THANH': return { label: 'Hoàn thành', colorCls: 'bg-green-50 text-green-700 border-green-200' };
            case 'HUY_DON': return { label: 'Hủy đơn', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'TRA_HANG': return { label: 'Đơn hàng trả về', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'DOI_SOAT_THAT_BAI': return { label: 'Đối soát thất bại', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'DIEU_CHINH': return { label: 'Điều chỉnh', colorCls: 'bg-orange-50 text-orange-700 border-orange-200' };
            default:
                return { label: key || status || 'Không rõ', colorCls: 'bg-slate-50 text-slate-700 border-slate-200' };
        }
    };

    return (
        <div
            className={clsx(
                'animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 pb-20',
                activeView === 'list' ? 'md:bg-[#f7f9fb] md:px-6 md:pb-8' : 'md:px-1.5 md:pb-0'
            )}
        >
            <div className="mb-2 flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:hidden">
                <button
                    type="button"
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition-all',
                        activeView === 'list' ? 'bg-[#00288e] text-white shadow-sm' : 'text-slate-600'
                    )}
                >
                    <List size={15} aria-hidden />
                    Danh sách
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-bold transition-all',
                        activeView === 'stats' ? 'bg-[#00288e] text-white shadow-sm' : 'text-slate-600'
                    )}
                >
                    <BarChart2 size={15} aria-hidden />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <>
                    <div className="hidden shrink-0 font-[family-name:Manrope,system-ui,sans-serif] md:-mt-1 md:mb-4 md:block">
                        <div className="sticky top-0 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex min-h-14 flex-nowrap items-center gap-3 overflow-x-auto px-5 py-3 sm:gap-4 sm:px-6 scrollbar-hide">
                                <h2 className="shrink-0 text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                                    Quản lý đề nghị xuất máy
                                </h2>
                                <div className="relative min-w-0 max-w-xl flex-1 md:max-w-md lg:max-w-lg">
                                    <Search
                                        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
                                        aria-hidden
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tìm mã phiếu, khách hàng, người yêu cầu..."
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
                                            onClick={() => setListDisplayMode('kanban')}
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
                                </div>
                            </div>
                            {selectedRequestIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-2.5 sm:px-6">
                                    <span className="mr-auto text-[12px] font-bold text-slate-600">
                                        Đã chọn{' '}
                                        <span className="text-[#00288e]">{selectedRequestIds.length}</span> phiếu
                                    </span>
                                    {isAdmin ? (
                                        <button
                                            type="button"
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-bold text-rose-600 shadow-sm hover:bg-rose-100"
                                        >
                                            <Trash2 size={16} />
                                            Xóa ({selectedRequestIds.length})
                                        </button>
                                    ) : (
                                        <span className="text-[12px] font-bold text-slate-500">
                                            Chỉ Admin được xóa hàng loạt
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRequestIds([])}
                                        className="text-[12px] font-bold text-slate-500 hover:text-slate-800"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="machine-dnxm-bt-page hidden pb-6 pt-2 font-[family-name:Manrope,system-ui,sans-serif] md:block">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                                <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                                    <button
                                        type="button"
                                        className="transition-colors hover:text-[#00288e]"
                                        onClick={() => navigate('/')}
                                    >
                                        Trang chủ
                                    </button>
                                    <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
                                    <span className="font-semibold text-[#00288e]">Kho &amp; Máy</span>
                                    <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />
                                    <span className="font-bold text-slate-900">Đề nghị xuất máy</span>
                                </nav>
                                <h1 className="text-[1.875rem] font-bold leading-snug tracking-[-0.02em] text-[#191c1e]">
                                    Đề nghị xuất máy
                                </h1>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('stats')}
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                    Thống kê
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/de-nghi-xuat-may/tao')}
                                    className="flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
                                    style={{ backgroundColor: BT_PRIMARY }}
                                >
                                    <Plus size={18} aria-hidden />
                                    Tạo đề nghị
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="group relative col-span-1 h-48 overflow-hidden rounded-xl shadow-sm md:col-span-2">
                                <img
                                    src={DNXM_PAGE_HERO_IMAGE}
                                    alt=""
                                    className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-r from-[#00288e]/80 via-[#00288e]/50 to-transparent p-6">
                                    <p className="text-[13px] font-semibold uppercase tracking-wider text-white/80">
                                        Xuất máy &amp; bàn giao
                                    </p>
                                    <h3 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                                        Theo dõi phiếu ĐNXM và luồng duyệt
                                    </h3>
                                </div>
                            </div>

                            <div
                                className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#00288e]/20 p-6 shadow-sm"
                                style={{ backgroundColor: BT_PRIMARY_CONTAINER, borderColor: `${BT_PRIMARY}33` }}
                            >
                                <div className="relative z-[1]">
                                    <p className="text-[13px] font-bold uppercase tracking-widest text-[#a8b8ff]/90">
                                        Phiếu mới tháng này
                                    </p>
                                    <p className="mt-2 text-4xl font-extrabold tabular-nums text-[#dde1ff]">
                                        {formatNumberBt(dnxmMonthStats.thisMonth)}
                                    </p>
                                    <p className="mt-2 text-[11px] font-medium text-white/65">
                                        Tổng phiếu ĐNXM: {formatNumberBt(dnxmOrders.length)}
                                    </p>
                                </div>
                                <div className="relative z-[1] mt-4 flex flex-wrap items-center gap-2 text-[13px] font-bold">
                                    {dnxmMonthStats.pct != null ? (
                                        <>
                                            <TrendingUp
                                                size={18}
                                                className={
                                                    dnxmMonthStats.pct >= 0 ? 'text-green-400' : 'text-rose-400'
                                                }
                                                aria-hidden
                                            />
                                            <span
                                                className={
                                                    dnxmMonthStats.pct >= 0 ? 'text-[#ccfbf1]' : 'text-rose-200'
                                                }
                                            >
                                                {dnxmMonthStats.pct >= 0 ? '+' : ''}
                                                {dnxmMonthStats.pct}% so với tháng trước
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-[#dde1ff]/80">Không có dữ liệu so sánh</span>
                                    )}
                                </div>
                                <div className="pointer-events-none absolute -bottom-10 -right-8 opacity-[0.10]" aria-hidden>
                                    <Monitor className="size-[160px] text-[#dde1ff]" strokeWidth={1.25} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex min-h-0 w-full flex-1 flex-col rounded-2xl border border-border bg-white shadow-sm md:overflow-hidden md:rounded-xl md:border-slate-200 md:shadow-md">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm đề nghị xuất máy..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        summary={
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1.5 -mx-0.5 px-0.5">
                                <span className="rounded-xl bg-emerald-100 px-3.5 py-2 text-xs font-bold whitespace-nowrap text-emerald-700 shadow-sm">
                                    Tổng hiển thị: {totalRecords} / {dnxmOrders.length}
                                </span>
                                <span className="rounded-xl bg-amber-100 px-3 py-1.5 text-[11px] font-bold whitespace-nowrap text-amber-900 shadow-sm ring-1 ring-amber-200/70">
                                    Chờ xử lý {pipelineAttentionCount}
                                </span>
                            </div>
                        }
                        actions={
                            <button
                                onClick={() => navigate('/de-nghi-xuat-may/tao')}
                                className="rounded-xl bg-primary p-2.5 text-white shadow-lg shadow-primary/30 transition-all active:scale-95"
                            >
                                <Plus size={22} />
                            </button>
                        }
                    />

                    {selectedRequestIds.length > 0 && (
                        <div className="mx-3 mb-2 mt-1 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 md:hidden">
                            <div className="text-[12px] text-slate-700 font-bold">
                                Đã chọn <span className="text-primary">{selectedRequestIds.length}</span> phiếu
                            </div>
                            {isAdmin ? (
                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[12px] font-bold border border-rose-100 hover:bg-rose-100 transition-all"
                                >
                                    <Trash2 size={14} /> Xóa hàng loạt
                                </button>
                            ) : (
                                <div className="text-[12px] text-muted-foreground font-bold">
                                    Chỉ Admin được xóa hàng loạt
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mobile View */}
                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-24 flex flex-col gap-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : paginatedRequests.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            paginatedRequests.map((r, index) => {
                                const sInfo = getStatusInfo(r.status);
                                return (
                                    <div key={r.id} className="rounded-2xl border border-primary/15 bg-white shadow-sm p-4 transition-all duration-200">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="flex gap-3">
                                                            <div className="pt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRequestIds.includes(r.id)}
                                                                    disabled={!isAdmin}
                                                                    onChange={() => toggleSelectOne(r.id)}
                                                                    className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer shadow-sm"
                                                                />
                                                            </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{((currentPage - 1) * pageSize) + index + 1}</p>
                                                    <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 cursor-pointer" onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}>{r.order_code}</h3>
                                                </div>
                                            </div>
                                            <span className={clsx("text-[10px] font-bold uppercase px-3 py-1.5 rounded-full", sInfo.colorCls)}>
                                                {sInfo.label}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <h3 className="text-[14px] font-black text-foreground leading-snug">{r.customer_name}</h3>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                <span className="text-[11px] font-medium text-muted-foreground">{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                    <User className="w-3 h-3 text-blue-600" /> Người yêu cầu
                                                </p>
                                                <p className="text-[12px] text-foreground font-bold mt-0.5 truncate">
                                                    {r.ordered_by || '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                                <div className="text-[14px] text-foreground font-black mt-0.5">
                                                    {getApprovedQuantityFromRequest(r)} máy
                                                </div>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Kho</p>
                                                <p className="text-[12px] text-foreground font-bold mt-0.5">
                                                    {r.warehouse || extractWarehouseFromNote(r.note) || '—'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)} className="p-2 text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg active:scale-90 transition-all"><Eye size={18} /></button>
                                            <button onClick={() => handleViewAsOrder(r)} className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg active:scale-90 transition-all" title="Thao tác Đơn hàng"><Package size={18} /></button>
                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg active:scale-90 transition-all"><Edit size={18} /></button>
                                            <button onClick={() => handleDelete(r.id, r.order_code)} className="p-2 text-rose-700 bg-rose-50 border border-rose-100 rounded-lg active:scale-90 transition-all"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden min-h-0 flex-1 flex-col font-[family-name:Manrope,system-ui,sans-serif] md:flex">
                        <div className="shrink-0 border-b border-slate-200 p-6 pb-8">
                            <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-100">
                                <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-800">
                                    <span className="text-slate-500">Đang hiển thị:</span>{' '}
                                    <strong className="tabular-nums text-[#00288e]">{totalRecords}</strong>
                                    <span>/</span>
                                    <strong className="tabular-nums text-slate-600">{dnxmOrders.length}</strong>
                                    <span className="font-medium text-slate-500">phiếu</span>
                                </span>
                                <span className="rounded-md bg-amber-50 px-2.5 py-1 font-bold text-amber-900 ring-1 ring-amber-100">
                                    Chờ xử lý {pipelineAttentionCount}
                                </span>
                            </div>

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
                                            (activeDropdown === 'status' || selectedStatuses.length > 0) &&
                                                'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                        )}
                                    >
                                        <span className="truncate">
                                            {selectedStatuses.length === 0
                                                ? 'Tất cả trạng thái'
                                                : `${selectedStatuses.length} đã chọn`}
                                        </span>
                                        <ChevronDown
                                            size={18}
                                            className={clsx('shrink-0 opacity-70', activeDropdown === 'status' && 'rotate-180')}
                                        />
                                    </button>
                                    {activeDropdown === 'status' && (
                                        <FilterDropdown
                                            options={statusOptions}
                                            selected={selectedStatuses}
                                            setSelected={setSelectedStatuses}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                            showSearch={false}
                                        />
                                    )}
                                </div>

                                <div className="relative min-w-[160px] flex-1 lg:min-w-[180px]">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Khách hàng
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeDropdown !== 'customers') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
                                        }}
                                        className={clsx(
                                            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-medium shadow-sm hover:bg-white',
                                            (activeDropdown === 'customers' || selectedCustomers.length > 0) &&
                                                'border-[#00288e]/40 ring-2 ring-[#00288e]/15'
                                        )}
                                    >
                                        <span className="truncate">
                                            {selectedCustomers.length === 0
                                                ? 'Tất cả khách hàng'
                                                : `${selectedCustomers.length} đã chọn`}
                                        </span>
                                        <ChevronDown
                                            size={18}
                                            className={clsx('shrink-0 opacity-70', activeDropdown === 'customers' && 'rotate-180')}
                                        />
                                    </button>
                                    {activeDropdown === 'customers' && (
                                        <FilterDropdown
                                            options={customerOptions}
                                            selected={selectedCustomers}
                                            setSelected={setSelectedCustomers}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                            showSearch={true}
                                        />
                                    )}
                                </div>

                                <div className="relative min-w-[140px]">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Từ ngày
                                    </label>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm shadow-sm outline-none focus:border-[#00288e]/40 focus:bg-white focus:ring-2 focus:ring-[#00288e]/15"
                                    />
                                </div>
                                <div className="relative min-w-[140px]">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Đến ngày
                                    </label>
                                    <input
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm shadow-sm outline-none focus:border-[#00288e]/40 focus:bg-white focus:ring-2 focus:ring-[#00288e]/15"
                                    />
                                </div>

                                <div className="flex min-h-[3.625rem] items-end">
                                    <button
                                        type="button"
                                        onClick={openMobileFilter}
                                        title="Bộ lọc đầy đủ"
                                        className="flex h-10 min-w-[2.75rem] items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
                                    >
                                        <ListFilter size={22} aria-hidden />
                                    </button>
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedStatuses([]);
                                            setSelectedCustomers([]);
                                            setFromDate('');
                                            setToDate('');
                                        }}
                                        className="flex items-center gap-2 rounded-xl border border-dashed border-red-300 px-3 py-2 text-[12px] font-bold text-red-500 transition-all hover:bg-red-50"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        {listDisplayMode === 'table' ? (
                            <>
                        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
                            <table className="w-full border-collapse text-left">
                                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider w-10">
                                            <input
                                                type="checkbox"
                                                disabled={!isAdmin || paginatedRequests.length === 0}
                                                checked={
                                                    paginatedRequests.length > 0 &&
                                                    paginatedRequests.every((r) => selectedRequestIds.includes(r.id))
                                                }
                                                onChange={() => {
                                                    const idsOnPage = paginatedRequests.map((r) => r.id);
                                                    setSelectedRequestIds((prev) => {
                                                        const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => prev.includes(id));
                                                        if (allSelected) {
                                                            return prev.filter((id) => !idsOnPage.includes(id));
                                                        }
                                                        return Array.from(new Set([...prev, ...idsOnPage]));
                                                    });
                                                }}
                                                className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer shadow-sm"
                                            />
                                        </th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mã phiếu</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Ngày tạo</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Khách hàng</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Người yêu cầu</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Kho</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Số lượng</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                                        <th className="px-5 py-3.5 text-center text-[12px] font-bold text-slate-500 uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 bg-white">
                                    {loading ? (
                                        <tr><td colSpan={9} className="px-6 py-20 text-center text-slate-400 font-bold italic">Đang tải dữ liệu...</td></tr>
                                    ) : paginatedRequests.length === 0 ? (
                                        <tr><td colSpan={9} className="px-6 py-20 text-center text-slate-400 font-bold italic">Không tìm thấy phiếu nào</td></tr>
                                    ) : (
                                        paginatedRequests.map(r => (
                                            <tr key={r.id} className="group hover:bg-muted/30 transition-colors">
                                                <td className="px-5 py-3.5 w-10">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!isAdmin}
                                                        checked={selectedRequestIds.includes(r.id)}
                                                        onChange={() => toggleSelectOne(r.id)}
                                                        className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer shadow-sm"
                                                    />
                                                </td>
                                                <td className="px-5 py-3.5"><span className="text-[14px] font-bold text-primary hover:underline cursor-pointer" onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}>{r.order_code}</span></td>
                                                <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-600">{new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-5 py-3.5"><div className="text-[14px] font-bold text-slate-900 line-clamp-1">{r.customer_name}</div></td>
                                                <td className="px-5 py-3.5 text-[13px] font-medium text-slate-500">{r.ordered_by || '—'}</td>
                                                <td className="px-5 py-3.5 text-[13px] font-medium text-slate-600">{r.warehouse || extractWarehouseFromNote(r.note) || '—'}</td>
                                                <td className="px-5 py-3.5"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[12px]">{getApprovedQuantityFromRequest(r)} máy</span></td>
                                                <td className="px-5 py-3.5">
                                                    {(() => {
                                                        const sInfo = getStatusInfo(r.status);
                                                        return (
                                                            <span className={clsx("px-2.5 py-1 rounded-full border text-[11px] font-bold inline-flex items-center", sInfo.colorCls)}>
                                                                {sInfo.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Xem chi tiết"><Eye size={16} /></button>
                                                        <button onClick={() => handleViewAsOrder(r)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Thao tác Đơn hàng"><Package size={16} /></button>
                                                        <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Chỉnh sửa"><Edit size={16} /></button>
                                                        <button onClick={() => handleDelete(r.id, r.order_code)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-auto flex items-center justify-between border-t border-border bg-slate-50/50 p-3">
                            <div className="flex items-center gap-3 text-[12px] font-medium text-muted-foreground">
                                <span className="rounded bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
                                    Tổng hiển thị: {totalRecords} / {dnxmOrders.length}
                                </span>
                                <span>
                                    {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / {totalRecords}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(1)}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang đầu"
                                >
                                    <ChevronLeft size={16} />
                                    <ChevronLeft size={16} className="-ml-2.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[12px] font-bold text-white shadow-md shadow-primary/25">
                                    {currentPage}
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCurrentPage((prev) => Math.min(Math.ceil(totalRecords / pageSize || 1), prev + 1))
                                    }
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize || 1)}
                                    title="Trang sau"
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize || 1))}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize || 1)}
                                    title="Trang cuối"
                                >
                                    <ChevronRight size={16} />
                                    <ChevronRight size={16} className="-ml-2.5" />
                                </button>
                            </div>
                        </div>
                            </>
                        ) : (
                            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
                                <div className="grid min-h-[420px] grid-flow-col gap-4 auto-cols-[320px] lg:auto-cols-[360px]">
                                    {kanbanStatuses.map((status) => {
                                        const statusRequests = filteredRequests.filter((r) => r.status === status.id);
                                        return (
                                            <div key={status.id} className="flex min-h-0 flex-col rounded-xl border border-border bg-slate-50/60">
                                                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                                                    <span className="text-[12px] font-bold text-slate-700">{status.label}</span>
                                                    <span className="rounded-full border border-border bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                                        {statusRequests.length}
                                                    </span>
                                                </div>
                                                <div className="min-h-0 space-y-3 overflow-y-auto p-3">
                                                    {statusRequests.length === 0 ? (
                                                        <div className="py-6 text-center text-[12px] italic text-muted-foreground">
                                                            Trống
                                                        </div>
                                                    ) : (
                                                        statusRequests.map((r) => (
                                                            <div
                                                                key={r.id}
                                                                className="flex min-h-[140px] w-full flex-col justify-between rounded-xl border border-border bg-white p-3.5 transition-all hover:border-primary/30 hover:shadow-md"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}
                                                                    className="text-left"
                                                                >
                                                                    <div className="text-[13px] font-extrabold text-primary">
                                                                        {r.order_code || '—'}
                                                                    </div>
                                                                    <div className="mt-1.5 line-clamp-2 text-[14px] font-bold text-foreground">
                                                                        {r.customer_name || '—'}
                                                                    </div>
                                                                </button>

                                                                <div className="pt-3">
                                                                    <div className="text-[12px] text-muted-foreground">
                                                                        Kho: {r.warehouse || extractWarehouseFromNote(r.note) || '—'}
                                                                    </div>
                                                                    <div className="mt-1 text-[12px] text-muted-foreground">
                                                                        YC: {r.ordered_by || '—'} • SL:{' '}
                                                                        {getApprovedQuantityFromRequest(r)}
                                                                    </div>
                                                                </div>

                                                                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)
                                                                        }
                                                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-primary/10 hover:text-primary"
                                                                        title="Xem chi tiết"
                                                                    >
                                                                        <Eye size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleViewAsOrder(r)}
                                                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-500"
                                                                        title="Thao tác Đơn hàng"
                                                                    >
                                                                        <Package size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)
                                                                        }
                                                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-500"
                                                                        title="Chỉnh sửa"
                                                                    >
                                                                        <Edit size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(r.id, r.order_code)}
                                                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-500"
                                                                        title="Xóa"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {!loading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}
                    </div>
                </>
            )}

            {activeView === 'stats' && (
                <div className="flex min-h-0 w-full flex-1 flex-col rounded-2xl border border-border bg-white shadow-sm mb-2 md:mb-0 md:rounded-xl md:border-slate-200 md:shadow-md">
                    <div className="space-y-0">
                        {/* Mobile Header */}
                        <div className="flex items-center gap-2 border-b border-border p-3 md:hidden">
                            <button
                                type="button"
                                onClick={() => setActiveView('list')}
                                className="shrink-0 rounded-xl border border-border bg-white p-2 text-muted-foreground"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê</h2>
                            <div className="w-9" />
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden border-b border-border p-4 md:block">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('list')}
                                    className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-bold text-muted-foreground shadow-sm transition-all hover:bg-muted"
                                >
                                    <ChevronLeft size={16} />
                                    Danh sách phiếu
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/de-nghi-xuat-may/tao')}
                                    className="flex items-center gap-2 rounded-lg px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: BT_PRIMARY }}
                                >
                                    <Plus size={17} aria-hidden />
                                    Tạo đề nghị
                                </button>
                            </div>
                        </div>

                        {/* Stats Content */}
                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5 flex-1 overflow-y-auto bg-slate-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                <StatCard icon={<FileText />} label="Tổng số phiếu" value={dnxmOrders.length} color="blue" />
                                <StatCard icon={<Monitor />} label="Máy đề nghị" value={dnxmOrders.reduce((acc, r) => acc + getApprovedQuantityFromRequest(r), 0)} color="emerald" />
                            </div>

                            <div className="mt-6 bg-white border border-border rounded-2xl p-5 md:p-6 shadow-sm">
                                <h3 className="text-[14px] md:text-base font-black text-slate-800 uppercase tracking-tight mb-6">Top 10 Khách hàng <span className="text-muted-foreground text-[12px] font-medium normal-case">(Theo số lượng máy đề nghị)</span></h3>
                                <div style={{ height: '320px' }}>
                                    <BarChartJS 
                                        data={getChartData()}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 5 } },
                                                x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isOrderModalOpen && orderToView && (
                <OrderStatusUpdater
                    order={orderToView}
                    userRole={role}
                    onClose={() => {
                        setIsOrderModalOpen(false);
                        setTimeout(() => setOrderToView(null), 300);
                    }}
                    onUpdateSuccess={() => {
                        fetchData();
                        setIsOrderModalOpen(false);
                    }}
                />
            )}

            <MobileFilterSheet
                isOpen={showMobileFilter}
                isClosing={mobileFilterClosing}
                onClose={closeMobileFilter}
                onApply={applyMobileFilter}
                title="Bộ lọc đề nghị xuất máy"
                sections={[
                    {
                        id: 'dateRange',
                        label: 'Khoảng thời gian',
                        type: 'dateRange',
                        value: pendingDateRange,
                        onValueChange: setPendingDateRange,
                    },
                    {
                        id: 'status',
                        label: 'Trạng thái',
                        icon: <List size={16} />,
                        options: statusOptions,
                        selectedValues: pendingStatuses,
                        onSelectionChange: setPendingStatuses,
                        searchable: false,
                    },
                    {
                        id: 'customers',
                        label: 'Khách hàng',
                        icon: <User size={16} />,
                        options: customerOptions,
                        selectedValues: pendingCustomers,
                        onSelectionChange: setPendingCustomers,
                        searchable: true,
                    },
                ]}
            />
        </div>
    );
}

function StatCard({ icon, label, value, color }) {
    const colorStyles = {
        blue: { bg: 'bg-blue-50/70', border: 'border-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-100/80', ring: 'ring-blue-200/70' },
        emerald: { bg: 'bg-emerald-50/70', border: 'border-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-100/80', ring: 'ring-emerald-200/70' },
        amber: { bg: 'bg-amber-50/70', border: 'border-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100/80', ring: 'ring-amber-200/70' },
        rose: { bg: 'bg-rose-50/70', border: 'border-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100/80', ring: 'ring-rose-200/70' },
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div className={clsx("border rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:shadow-md", style.bg, style.border)}>
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                <div className={clsx("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ring-1", style.iconBg, style.ring)}>
                    {cloneElement(icon, { className: clsx("w-5 h-5 md:w-6 md:h-6", style.text) })}
                </div>
                <div>
                    <p className={clsx("text-[10px] md:text-[11px] font-semibold uppercase tracking-wider mb-0.5 md:mb-1", style.text)}>{label}</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{value}</p>
                </div>
            </div>
        </div>
    );
}
