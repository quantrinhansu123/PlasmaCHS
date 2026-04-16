import {
    BarChart2,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Filter,
    List,
    MapPin,
    Package,
    PackageCheck,
    Phone,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    X,
    Download,
    Upload,
    MoreVertical
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import CylinderRecoveryPrintTemplate from '../components/CylinderRecovery/CylinderRecoveryPrintTemplate';
import CylinderRecoveryFormModal from '../components/CylinderRecovery/CylinderRecoveryFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { RECOVERY_STATUSES, RECOVERY_TABLE_COLUMNS } from '../constants/recoveryConstants';
import usePermissions from '../hooks/usePermissions';
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

const CylinderRecoveries = () => {
    const navigate = useNavigate();
    const { role } = usePermissions();
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
    const [recoveriesToPrint, setRecoveriesToPrint] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);
    const [showMoreActions, setShowMoreActions] = useState(false);

    // Filter State
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);

    const hasActiveFilters = selectedStatuses.length > 0 || selectedCustomers.length > 0 || selectedWarehouses.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedCustomers.length + selectedWarehouses.length;

    // Refs
    const columnPickerRef = useRef(null);
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
            toast.error('Lỗi khi tải danh sách thu hồi: ' + error.message);
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
    const handleEdit = (recovery, forceStatus = null) => {
        setRecoveryToEdit(forceStatus ? { ...recovery, status: forceStatus } : recovery);
        setIsFormModalOpen(true);
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
        fetchRecoveries();
    };

    const handlePrintSingle = (recovery) => {
        setRecoveriesToPrint([recovery]);
    };

    const handleBatchPrint = () => {
        const toPrint = recoveries.filter(r => selectedIds.includes(r.id));
        setRecoveriesToPrint(toPrint);
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

        return matchesSearch && matchesStatus && matchesCustomer && matchesWarehouse;
    });

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
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full relative">
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
                                    onClick={() => { setRecoveryToEdit(null); setIsFormModalOpen(true); }}
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
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 opacity-70">Tài xế</span>
                                                <span className="text-[12px] font-bold text-foreground tracking-tight">{recovery.driver_name || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {recovery.status === 'CHO_PHAN_CONG' && (
                                                    <button
                                                        onClick={() => handleEdit(recovery)}
                                                        className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-1 font-bold text-[11px]"
                                                        title="Phân công"
                                                    >
                                                        Phân công
                                                    </button>
                                                )}
                                                {recovery.status === 'DANG_THU_HOI' && (
                                                    <button
                                                        onClick={() => handleEdit(recovery, 'HOAN_THANH')}
                                                        className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-1 font-bold text-[11px]"
                                                        title="Hoàn thành"
                                                    >
                                                        Hoàn thành
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handlePrintSingle(recovery)}
                                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors bg-slate-50 border border-slate-100"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(recovery)}
                                                    className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button 
                                                        onClick={() => handleDelete(recovery.id, recovery.recovery_code)} 
                                                        className="p-2 text-red-700 bg-red-50 border border-red-100 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
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

                    {/* ── DESKTOP TOOLBAR ── */}
                    <div className="hidden md:block p-4 space-y-4 bg-muted/5 border-b border-border">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-white text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm mã phiếu, khách hàng..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-white border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium placeholder:text-muted-foreground/60 shadow-sm"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                                        Cột ({visibleTableColumns.length}/{RECOVERY_TABLE_COLUMNS.length})
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
                                        setRecoveryToEdit(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>

                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-4 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-bold hover:bg-indigo-100 shadow-sm transition-all active:scale-95"
                                    title="Tải file Excel mẫu"
                                >
                                    <Download size={16} />
                                    Tải mẫu
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
                                        className="flex items-center gap-2 px-4 h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 cursor-pointer shadow-sm transition-all active:scale-95 select-none"
                                        title="Import dữ liệu từ file Excel"
                                    >
                                        <Upload size={16} />
                                        Nhập Excel
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2" ref={listDropdownRef}>
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

                    {/* Table Content Area */}
                    <div className="hidden md:block flex-1 overflow-x-auto bg-white custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead className="bg-[#F1F5FF] sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                <tr>
                                    <th className="px-4 py-3.5 w-10">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                                                checked={selectedIds.length === filteredRecoveries.length && filteredRecoveries.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </div>
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                "px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide",
                                                col.key === 'recovery_code' && 'border-l border-r border-primary/5'
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-30 bg-[#F1F5FF] px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-20 text-center text-muted-foreground bg-muted/5 italic font-medium anim-pulse font-sans">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : paginatedRecoveries.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-20 text-center text-muted-foreground bg-muted/5 font-sans">
                                            <PackageCheck className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-lg font-bold">Không tìm thấy phiếu nào</p>
                                            <p className="text-sm">Hãy kiểm tra lại bộ lọc hoặc tạo phiếu mới</p>
                                        </td>
                                    </tr>
                                ) : paginatedRecoveries.map((recovery) => {
                                    const status = RECOVERY_STATUSES.find(s => s.id === recovery.status) || RECOVERY_STATUSES[0];
                                    return (
                                        <tr key={recovery.id} className={getRowStyle(selectedIds.includes(recovery.id))}>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                                                        checked={selectedIds.includes(recovery.id)}
                                                        onChange={() => toggleSelect(recovery.id)}
                                                    />
                                                </div>
                                            </td>
                                            {visibleTableColumns.map(col => {
                                                switch (col.key) {
                                                    case 'recovery_code':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 whitespace-nowrap border-l border-r border-primary/5">
                                                                <span className="text-[13px] font-bold text-primary hover:underline cursor-pointer tracking-tight" onClick={() => handleEdit(recovery)}>
                                                                    {recovery.recovery_code}
                                                                </span>
                                                            </td>
                                                        );
                                                    case 'recovery_date':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 whitespace-nowrap text-[13px] text-foreground font-medium">
                                                                {recovery.recovery_date ? new Date(recovery.recovery_date).toLocaleDateString('vi-VN') : '—'}
                                                            </td>
                                                        );
                                                    case 'customer_name':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 max-w-[200px] truncate text-[13px] font-bold text-foreground">
                                                                {getCustomerName(recovery.customer_id)}
                                                            </td>
                                                        );
                                                    case 'order_id':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 whitespace-nowrap">
                                                                {recovery.order_id ? (
                                                                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 italic">
                                                                        {getOrderCode(recovery.order_id)}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                        );
                                                    case 'warehouse_id':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 whitespace-nowrap text-[13px] text-muted-foreground">
                                                                {getWarehouseLabel(recovery.warehouse_id)}
                                                            </td>
                                                        );
                                                    case 'driver_name':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 text-[13px] text-muted-foreground font-normal">
                                                                {recovery.driver_name || '—'}
                                                            </td>
                                                        );
                                                    case 'requested_quantity':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4">
                                                                <span className="text-[13px] font-bold text-slate-500 flex items-center gap-1.5">
                                                                    <Package className="w-4 h-4 text-slate-400" />
                                                                    {recovery.requested_quantity || 0}
                                                                </span>
                                                            </td>
                                                        );
                                                    case 'total_items':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4">
                                                                <span className="text-[13px] font-bold text-emerald-600 flex items-center gap-1.5">
                                                                    <PackageCheck className="w-4 h-4 text-emerald-500" />
                                                                    {recovery.total_items || 0}
                                                                </span>
                                                            </td>
                                                        );
                                                    case 'created_by':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4 text-[12px] text-muted-foreground font-medium truncate max-w-[120px]">
                                                                {recovery.created_by || '—'}
                                                            </td>
                                                        );
                                                    case 'status':
                                                        return (
                                                            <td key={col.key} className="px-4 py-4">
                                                                <span className={clsx(getStatusBadgeClass(status.color), "uppercase text-[10px] tracking-wider")}>
                                                                    {status.label}
                                                                </span>
                                                            </td>
                                                        );
                                                    default:
                                                        return <td key={col.key} className="px-4 py-4">—</td>;
                                                }
                                            })}
                                            <td className="sticky right-0 z-20 bg-white group-hover:bg-blue-50/40 px-4 py-4 text-center shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.25)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">
                                                <div className="flex items-center justify-center gap-2">
                                                    {recovery.status === 'CHO_PHAN_CONG' && (
                                                        <button
                                                            onClick={() => handleEdit(recovery)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-all"
                                                        >
                                                            Phân công
                                                        </button>
                                                    )}
                                                    {recovery.status === 'DANG_THU_HOI' && (
                                                        <button
                                                            onClick={() => handleEdit(recovery, 'HOAN_THANH')}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-all"
                                                        >
                                                            Hoàn thành
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handlePrintSingle(recovery)}
                                                        className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-primary/10 bg-slate-50 border border-slate-100"
                                                        title="In phiếu"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(recovery)}
                                                        className="text-amber-600 hover:text-amber-700 transition-colors p-1.5 rounded-lg hover:bg-amber-100 bg-amber-50 border border-amber-100"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(recovery.id, recovery.recovery_code)}
                                                        className="text-red-500 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 bg-red-50/50 border border-red-100"
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

                    {/* Footer / Pagination matching Orders.jsx */}
                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium font-sans">
                            <span>
                                {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / Tổng {totalRecords}
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
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0}
                                title="Trang sau"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(Math.max(1, Math.ceil(totalRecords / pageSize)))}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" 
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize) || totalRecords === 0}
                                title="Trang cuối"
                            >
                                <ChevronRight size={16} />
                                <ChevronRight size={16} className="-ml-2.5" />
                            </button>
                        </div>
                    </div>
                </div>
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
                    onClose={() => setIsFormModalOpen(false)}
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
