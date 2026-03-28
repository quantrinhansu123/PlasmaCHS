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
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
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
    const handleEdit = (recovery) => {
        setRecoveryToEdit(recovery);
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

    const getFilterIconClass = (id, active) => {
        if (!active) {
            switch (id) {
                case 'status': return "text-blue-500/70";
                case 'customers': return "text-cyan-500/70";
                case 'warehouses': return "text-violet-500/70";
                default: return "text-slate-400";
            }
        }
        switch (id) {
            case 'status': return "text-blue-700";
            case 'customers': return "text-cyan-700";
            case 'warehouses': return "text-violet-700";
            default: return "text-primary";
        }
    };

    const getFilterCountBadgeClass = (id) => {
        switch (id) {
            case 'status': return "bg-blue-600 text-white";
            case 'customers': return "bg-cyan-600 text-white";
            case 'warehouses': return "bg-violet-600 text-white";
            default: return "bg-primary text-white";
        }
    };

    const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num || 0);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            {/* View Switching Tabs */}
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'list'
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-white text-muted-foreground hover:bg-muted/10 border border-border"
                    )}
                >
                    <List size={16} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'stats'
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-white text-muted-foreground hover:bg-muted/10 border border-border"
                    )}
                >
                    <BarChart2 size={16} />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    {/* ── MOBILE TOOLBAR ── */}
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
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
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary shadow-sm shadow-primary/10' : 'border-border bg-white text-muted-foreground',
                            )}
                        >
                            <Filter size={18} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => { setRecoveryToEdit(null); setIsFormModalOpen(true); }}
                            className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* ── MOBILE CARD LIST ── */}
                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic font-medium">Đang tải dữ liệu...</div>
                        ) : filteredRecoveries.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic font-medium font-sans border-2 border-dashed border-border rounded-2xl mx-1 bg-muted/5">
                                <PackageCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                Không tìm thấy kết quả phù hợp
                            </div>
                        ) : (
                            filteredRecoveries.map((recovery) => {
                                const status = RECOVERY_STATUSES.find(s => s.id === recovery.status) || RECOVERY_STATUSES[0];
                                return (
                                    <div key={recovery.id} className="bg-white border border-primary/15 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-all duration-300">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                    checked={selectedIds.includes(recovery.id)}
                                                    onChange={() => toggleSelect(recovery.id)}
                                                />
                                                <span className="text-[13px] font-bold text-foreground">{recovery.recovery_code}</span>
                                            </div>
                                            <span className={clsx(getStatusBadgeClass(status.color), 'text-[10px] uppercase')}>
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
                                                        className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-1 font-bold text-[11px]"
                                                        title="Phân công"
                                                    >
                                                        Phân công
                                                    </button>
                                                )}
                                                {recovery.status === 'DANG_THU_HOI' && (
                                                    <button
                                                        onClick={() => handleEdit(recovery)}
                                                        className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-1 font-bold text-[11px]"
                                                        title="Hoàn thành"
                                                    >
                                                        Hoàn thành
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handlePrintSingle(recovery)}
                                                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-colors bg-slate-50 border border-slate-100"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(recovery)}
                                                    className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-xl"
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

                    {/* ── DESKTOP TOOLBAR ── */}
                    <div className="hidden md:block p-3 space-y-3 bg-muted/5 border-b border-border">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1 max-w-2xl">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-white text-muted-foreground text-[12px] font-bold transition-all bg-muted/10 shadow-sm shrink-0"
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
                                {selectedIds.length > 0 && (
                                    <div className="flex items-center gap-1.5 bg-muted/20 p-1 rounded-xl border border-border shrink-0">
                                        <button
                                            onClick={handleBatchPrint}
                                            className="flex items-center gap-2 px-3 py-1 bg-white border border-border rounded-lg text-slate-700 text-[12px] font-bold hover:bg-slate-50 transition-all"
                                        >
                                            <Printer size={14} /> In ({selectedIds.length})
                                        </button>
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-2 px-3 py-1 bg-white border border-rose-200 rounded-lg text-rose-600 text-[12px] font-bold hover:bg-rose-50 transition-all"
                                        >
                                            <Trash2 size={14} /> Xóa ({selectedIds.length})
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-1.5 border-l border-border pl-2 shrink-0">
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/50 text-indigo-700 text-[12px] font-bold hover:bg-indigo-100/50 transition-all"
                                        title="Tải mẫu Excel"
                                    >
                                        <Download size={15} />
                                        Tải mẫu
                                    </button>
                                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50/50 text-blue-700 text-[12px] font-bold hover:bg-blue-100/50 transition-all cursor-pointer" title="Nhập Excel">
                                        <Upload size={15} />
                                        Nhập file
                                        <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
                                    </label>
                                </div>

                                <div className="relative shrink-0" ref={columnPickerRef}>
                                    <button
                                        onClick={() => setShowColumnPicker(prev => !prev)}
                                        className={clsx(
                                            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-bold transition-all bg-white shadow-sm',
                                            showColumnPicker ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/10'
                                        )}
                                    >
                                        <SlidersHorizontal size={15} />
                                        Cột ({visibleColumns.length})
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
                                    onClick={() => { setRecoveryToEdit(null); setIsFormModalOpen(true); }}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-primary text-white text-[12px] font-black hover:bg-primary/90 shadow-md shadow-primary/20 transition-all shrink-0 uppercase tracking-tight"
                                >
                                    <Plus size={18} />
                                    Tạo phiếu
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
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
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
                                        if (activeDropdown !== 'customers') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
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

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'warehouses') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                        getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <MapPin size={14} className={getFilterIconClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)} />
                                    Kho nhận
                                    {selectedWarehouses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>
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
                                ) : filteredRecoveries.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-20 text-center text-muted-foreground bg-muted/5 font-sans">
                                            <PackageCheck className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-lg font-bold">Không tìm thấy phiếu nào</p>
                                            <p className="text-sm">Hãy kiểm tra lại bộ lọc hoặc tạo phiếu mới</p>
                                        </td>
                                    </tr>
                                ) : filteredRecoveries.map((recovery) => {
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
                                                            onClick={() => handleEdit(recovery)}
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
                            <span>{filteredRecoveries.length > 0 ? `1–${filteredRecoveries.length}` : '0'}/Tổng {filteredRecoveries.length}</span>
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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                    <div className="space-y-0 flex flex-col">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border bg-white">
                            <button
                                onClick={() => setActiveView('list')}
                                className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center font-sans tracking-tight">Thống kê dữ liệu</h2>
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

                        {/* Desktop Header */}
                        <div className="hidden md:block p-4 border-b border-border bg-muted/5" ref={statsDropdownRef}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => setActiveView('list')}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-white text-muted-foreground text-[12px] font-bold transition-all bg-muted/10 shadow-sm shrink-0"
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
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
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
                                            if (activeDropdown !== 'customers') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
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

                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            if (activeDropdown !== 'warehouses') setFilterSearch('');
                                            setActiveDropdown(activeDropdown === 'warehouses' ? null : 'warehouses');
                                        }}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm",
                                            getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                        )}
                                    >
                                        <MapPin size={14} className={getFilterIconClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)} />
                                        Kho nhận
                                        {selectedWarehouses.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>
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
