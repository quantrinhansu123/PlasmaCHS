import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
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
    ChevronLeft,
    ChevronRight,
    Edit,
    FileText,
    List,
    Monitor,
    Plus,
    Search,
    Trash2,
    X,
    BarChart2,
    Calendar,
    User,
    Eye,
    CheckCircle,
    Package,
    ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, cloneElement, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import { ORDER_STATUSES } from '../constants/orderConstants';
import { notificationService } from '../utils/notificationService';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import usePermissions from '../hooks/usePermissions';
import {
    isAdminRole,
    isLeadSaleRole,
    isSalesRole,
    isShipperRole,
    isWarehouseRole,
    normalizeRole,
} from '../utils/accessControl';

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

export default function MachineRequests() {
    const navigate = useNavigate();
    const { role, department, user, loading: permissionsLoading } = usePermissions();
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
        { id: 'TU_CHOI', label: 'Từ chối' },
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

    const filteredRequests = requests.filter(r => {
        const matchesSearch = (r.order_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.ordered_by || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
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

    const uniqueCustomers = Array.from(new Set(requests.map(r => r.customer_name).filter(Boolean)));
    const customerOptions = uniqueCustomers.map(c => ({
        id: c,
        label: c,
        count: requests.filter(o => o.customer_name === c).length
    }));

    const statusOptions = COMMON_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: requests.filter(o => o.status === s.id).length
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
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu đề nghị ${code}?`)) return;
        try {
            const { error } = await supabase.from('orders').delete().eq('id', id);
            if (error) throw error;
            toast.success(`Đã xóa phiếu ${code}`);
            fetchData();
        } catch (error) {
            toast.error('Lỗi xóa phiếu: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedRequestIds.length) return;
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedRequestIds.length} phiếu đề nghị?`)) return;
        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .in('id', selectedRequestIds);

            if (error) throw error;
            toast.success(`Đã xóa ${selectedRequestIds.length} phiếu`);
            setSelectedRequestIds([]);
            fetchData();
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
        requests.forEach(r => {
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
        switch (status) {
            case 'CHO_DUYET': return { label: 'Chờ Lead duyệt', colorCls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
            case 'CHO_CTY_DUYET': return { label: 'Chờ Công ty duyệt', colorCls: 'bg-orange-50 text-orange-700 border-orange-200' };
            case 'KHO_XU_LY': return { label: 'Chờ Kho duyệt', colorCls: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
            case 'TU_CHOI': return { label: 'Từ chối', colorCls: 'bg-rose-50 text-rose-700 border-rose-200' };
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
                return { label: status || 'Không rõ', colorCls: 'bg-slate-50 text-slate-700 border-slate-200' };
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'kanban', label: 'Kanban', icon: <Calendar size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
                ]}
            />

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-2 md:mb-0">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm đề nghị xuất máy..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        summary={
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1.5 -mx-0.5 px-0.5">
                                <span className="bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm">
                                    Tổng hiển thị: {totalRecords} / {requests.length}
                                </span>
                            </div>
                        }
                        actions={
                            <button
                                onClick={() => navigate('/de-nghi-xuat-may/tao')}
                                className="p-2.5 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
                            >
                                <Plus size={22} />
                            </button>
                        }
                    />

                    {selectedRequestIds.length > 0 && (
                        <div className="mx-3 md:mx-4 mb-2 md:mb-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 flex items-center justify-between gap-3">
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
                    <div className="hidden md:flex flex-col flex-1 min-h-0">
                        {/* Desktop Toolbar */}
                        <div className="p-4 border-b border-border/50 shrink-0">
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
                                            placeholder="Tìm kiếm đãi nghị xuất máy . . ."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <input
                                            type="date"
                                            value={fromDate}
                                            onChange={(e) => setFromDate(e.target.value)}
                                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white shadow-sm font-medium"
                                            title="Từ ngày"
                                        />
                                        <span className="text-slate-400 text-[13px] font-bold">—</span>
                                        <input
                                            type="date"
                                            value={toDate}
                                            onChange={(e) => setToDate(e.target.value)}
                                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white shadow-sm font-medium"
                                            title="Đến ngày"
                                        />
                                    </div>
                                    <div className="relative ml-2">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-bold transition-all ${selectedCustomers.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-muted-foreground border-border hover:text-foreground'}`}
                                        >
                                            <User size={14} />
                                            Khách hàng
                                            {selectedCustomers.length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-600 text-white font-bold">{selectedCustomers.length}</span>
                                            )}
                                            <ChevronDown size={14} className={activeDropdown === 'customers' ? 'rotate-180' : ''} />
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
                                    <div className="relative ml-2">
                                        <button
                                            onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-bold transition-all ${selectedStatuses.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-muted-foreground border-border hover:text-foreground'}`}
                                        >
                                            <List size={14} />
                                            Trạng thái
                                            {selectedStatuses.length > 0 && (
                                                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-bold">{selectedStatuses.length}</span>
                                            )}
                                            <ChevronDown size={14} className={activeDropdown === 'status' ? 'rotate-180' : ''} />
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
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate('/de-nghi-xuat-may/tao')} className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95">
                                        <Plus size={18} />
                                        Tạo đề nghị
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
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

                        {/* Desktop Pagination */}
                        <div className="hidden md:flex items-center justify-between p-3 border-t border-border bg-slate-50/50 mt-auto">
                            <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded font-bold">
                                    Tổng hiển thị: {totalRecords} / {requests.length}
                                </span>
                                <span>
                                    {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / {totalRecords}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang đầu"
                                >
                                    <ChevronLeft size={16} />
                                    <ChevronLeft size={16} className="-ml-2.5" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                                    {currentPage}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                    title="Trang sau"
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                    title="Trang cuối"
                                >
                                    <ChevronRight size={16} />
                                    <ChevronRight size={16} className="-ml-2.5" />
                                </button>
                            </div>
                        </div>
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
            )}

            {activeView === 'kanban' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-2 md:mb-0">
                    <div className="p-3 md:p-4 border-b border-border/60 flex items-center gap-2">
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
                                placeholder="Tìm trong Kanban..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 md:p-4">
                        <div className="grid grid-flow-col auto-cols-[320px] md:auto-cols-[360px] gap-4 min-h-full">
                            {kanbanStatuses.map((status) => {
                                const statusRequests = filteredRequests.filter((r) => r.status === status.id);
                                return (
                                    <div key={status.id} className="rounded-xl border border-border bg-slate-50/60 flex flex-col min-h-0">
                                        <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between">
                                            <span className="text-[12px] font-bold text-slate-700">{status.label}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-white border border-border text-[11px] font-bold text-slate-600">
                                                {statusRequests.length}
                                            </span>
                                        </div>
                                        <div className="p-3 space-y-3 overflow-y-auto min-h-0">
                                            {statusRequests.length === 0 ? (
                                                <div className="text-[12px] text-muted-foreground italic text-center py-6">Trống</div>
                                            ) : (
                                                statusRequests.map((r) => (
                                                    <div
                                                        key={r.id}
                                                        className="w-full rounded-xl border border-border bg-white p-3.5 min-h-[140px] flex flex-col justify-between hover:shadow-md hover:border-primary/30 transition-all"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}
                                                            className="text-left"
                                                        >
                                                            <div className="text-[13px] font-extrabold text-primary">{r.order_code || '—'}</div>
                                                            <div className="text-[14px] font-bold text-foreground mt-1.5 line-clamp-2">{r.customer_name || '—'}</div>
                                                        </button>

                                                        <div className="pt-3">
                                                            <div className="text-[12px] text-muted-foreground">
                                                                Kho: {r.warehouse || extractWarehouseFromNote(r.note) || '—'}
                                                            </div>
                                                            <div className="text-[12px] text-muted-foreground mt-1">
                                                                YC: {r.ordered_by || '—'} • SL: {getApprovedQuantityFromRequest(r)}
                                                            </div>
                                                        </div>

                                                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Xem chi tiết"><Eye size={16} /></button>
                                                            <button onClick={() => handleViewAsOrder(r)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Thao tác Đơn hàng"><Package size={16} /></button>
                                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Chỉnh sửa"><Edit size={16} /></button>
                                                            <button onClick={() => handleDelete(r.id, r.order_code)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa"><Trash2 size={16} /></button>
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
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-2 md:mb-0">
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
                            <div className="w-9" />
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden md:block p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                            </div>
                        </div>

                        {/* Stats Content */}
                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5 flex-1 overflow-y-auto bg-slate-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                <StatCard icon={<FileText />} label="Tổng số phiếu" value={requests.length} color="blue" />
                                <StatCard icon={<Monitor />} label="Máy đề nghị" value={requests.reduce((acc, r) => acc + getApprovedQuantityFromRequest(r), 0)} color="emerald" />
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
