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
import {
    BarChart2,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Filter,
    LayoutGrid,
    List,
    MoreVertical,
    Package,
    PackageMinus,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    User,
    X,
    Clock
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createPortal } from 'react-dom';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import GoodsIssueFormModal from '../components/GoodsIssues/GoodsIssueFormModal';
import GoodsIssuePrintTemplate from '../components/GoodsIssues/GoodsIssuePrintTemplate';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import { supabase } from '../supabase/config';
import { ISSUE_STATUSES, ISSUE_TABLE_COLUMNS, ISSUE_TYPES } from '../constants/goodsIssueConstants';
import usePermissions from '../hooks/usePermissions';
import { isWarehouseRole } from '../utils/accessControl';

// Register ChartJS components
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

function getKanbanColumnHeadClass(typeId) {
    switch (typeId) {
        case 'TRA_VO':
            return 'bg-indigo-50 text-indigo-900 border-indigo-100';
        case 'TRA_BINH_LOI':
            return 'bg-rose-50 text-rose-900 border-rose-100';
        case 'TRA_MAY':
            return 'bg-slate-100 text-slate-900 border-slate-200';
        default:
            return 'bg-slate-50 text-slate-800 border-slate-200';
    }
}

function getKanbanCardBorderClass(typeId) {
    switch (typeId) {
        case 'TRA_VO':
            return 'border-l-indigo-400';
        case 'TRA_BINH_LOI':
            return 'border-l-rose-400';
        case 'TRA_MAY':
            return 'border-l-slate-800';
        default:
            return 'border-l-slate-400';
    }
}

const GoodsIssues = () => {
    const { role, department } = usePermissions();
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState('list'); // 'list' | 'kanban' | 'stats'
    const [selectedIds, setSelectedIds] = useState([]);

    // Filters state
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [selectedSuppliers, setSelectedSuppliers] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');

    // Masters for filters
    const [warehouses, setWarehouses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    // Column visibility and order (with localStorage persistence)
    const defaultColOrder = ISSUE_TABLE_COLUMNS.map(col => col.key);

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_goods_issues_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_goods_issues_visible') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });

    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Mobile filter sheet
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingTypes, setPendingTypes] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);
    const [pendingSuppliers, setPendingSuppliers] = useState([]);

    // Modal state
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [initialForcedType, setInitialForcedType] = useState(null);

    const [showMoreActions, setShowMoreActions] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Printing state
    const [printData, setPrintData] = useState({ issue: null, items: [], warehouse: '', supplier: '' });

    useEffect(() => {
        fetchData();
        fetchMasters();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            
            const moreActionsMenu = document.getElementById('more-actions-menu-goods');
            const moreActionsButton = document.getElementById('more-actions-button-goods');
            if (moreActionsMenu && !moreActionsMenu.contains(event.target) &&
                moreActionsButton && !moreActionsButton.contains(event.target)) {
                setShowMoreActions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        localStorage.setItem('columns_goods_issues_visible', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_goods_issues_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('goods_issues')
                .select('*');

            // Apply warehouse filter for warehouse managers/staff (Non-Admin)
            if (isWarehouseRole(role) && department) {
                const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                query = query.eq('warehouse_id', userWhCode);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setIssues(data || []);
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu phiếu xuất:', error);
            toast.error('Không thể tải dữ liệu phiếu xuất');
        } finally {
            setLoading(false);
        }
    };

    const fetchMasters = async () => {
        try {
            const [warehousesRes, suppliersRes] = await Promise.all([
                supabase.from('warehouses').select('id, name').order('name'),
                supabase.from('suppliers').select('id, name').order('name')
            ]);

            if (warehousesRes.data) setWarehouses(warehousesRes.data);
            if (suppliersRes.data) setSuppliers(suppliersRes.data);
        } catch (error) {
            console.error('Lỗi khi tải danh mục:', error);
        }
    };

    // Filter Logic
    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            const search = searchTerm.toLowerCase();
            const matchSearch =
                issue.issue_code?.toLowerCase().includes(search) ||
                issue.notes?.toLowerCase().includes(search);

            const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(issue.status);
            const matchType = selectedTypes.length === 0 || selectedTypes.includes(issue.issue_type);
            const matchWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(issue.warehouse_id);
            const matchSupplier = selectedSuppliers.length === 0 || selectedSuppliers.includes(issue.supplier_id);

            return matchSearch && matchStatus && matchType && matchWarehouse && matchSupplier;
        });
    }, [issues, searchTerm, selectedStatuses, selectedTypes, selectedWarehouses, selectedSuppliers]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedStatuses, selectedTypes, selectedWarehouses, selectedSuppliers, issues]);

    const paginatedIssues = useMemo(() => {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize;
        return filteredIssues.slice(from, to);
    }, [filteredIssues, currentPage, pageSize]);

    const issueKanbanColumns = useMemo(() => {
        const byType = {};
        ISSUE_TYPES.forEach((t) => { byType[t.id] = []; });
        const unknown = [];
        filteredIssues.forEach((issue) => {
            if (ISSUE_TYPES.some((t) => t.id === issue.issue_type)) {
                byType[issue.issue_type].push(issue);
            } else {
                unknown.push(issue);
            }
        });
        const cols = ISSUE_TYPES.map((t) => ({
            id: t.id,
            label: t.label,
            items: byType[t.id] || [],
        }));
        if (unknown.length > 0) {
            cols.push({ id: '__other', label: 'Loại khác', items: unknown });
        }
        return cols;
    }, [filteredIssues]);

    // Helpers
    const getStatusConfig = (statusId) => {
        return ISSUE_STATUSES.find(s => s.id === statusId) || { id: statusId, label: statusId, color: 'gray' };
    };

    const getTypeLabel = (typeId) => {
        return ISSUE_TYPES.find(t => t.id === typeId)?.label || typeId;
    };

    const getWarehouseLabel = (id) => {
        return warehouses.find(w => w.id === id)?.name || id;
    };

    const getSupplierName = (id) => {
        if (!id) return '---';
        return suppliers.find(s => s.id === id)?.name || 'N/A';
    };

    const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num || 0);

    // Stats Logic
    const getStatusStats = () => {
        const stats = {};
        issues.forEach(i => {
            const label = getStatusConfig(i.status).label;
            stats[label] = (stats[label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTypeStats = () => {
        const stats = {};
        issues.forEach(i => {
            const label = getTypeLabel(i.issue_type);
            stats[label] = (stats[label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getSupplierStats = () => {
        const stats = {};
        issues.forEach(i => {
            if (i.supplier_id) {
                const name = getSupplierName(i.supplier_id);
                stats[name] = (stats[name] || 0) + 1;
            }
        });
        return Object.entries(stats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, value]) => ({ name, value }));
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    // Actions
    const handleBulkDelete = async () => {
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} phiếu xuất đã chọn?`)) return;

        try {
            const { error } = await supabase
                .from('goods_issues')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            toast.success('Xóa thành công!');
            setSelectedIds([]);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Có lỗi xảy ra khi xóa');
        }
    };

    const handleDeleteIssue = async (id, code) => {
        if (!window.confirm(`Xóa phiếu xuất ${code}?`)) return;

        try {
            const { error } = await supabase
                .from('goods_issues')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Xóa thành công!');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi xóa phiếu');
        }
    };

    const handleImportExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const wb = XLSX.read(event.target.result, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

                if (data.length === 0) {
                    toast.error('File Excel không có dữ liệu');
                    return;
                }

                toast.loading('Đang xử lý import...');
                // Import logic here (simplified)
                setTimeout(() => {
                    toast.dismiss();
                    toast.success('Import thành công (giả lập)');
                    fetchData();
                }, 1000);
            } catch (err) {
                toast.error('Lỗi định dạng file Excel');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { 'Ngày': '2024-03-20', 'Loại': 'TRA_VO', 'Kho': 'KHO_MAIN', 'NCC': 'Supplier ID', 'Ghi chú': 'Test import' }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Phieu_Xuat.xlsx");
    };

    const openFormModal = (issue = null, forcedType = null) => {
        setSelectedIssue(issue);
        setInitialForcedType(forcedType);
        setIsFormModalOpen(true);
    };

    const handleFormSuccess = () => {
        setIsFormModalOpen(false);
        fetchData();
    };

    const uuidOrNull = (v) => {
        if (v == null) return null;
        const s = String(v).trim();
        return s || null;
    };

    const handlePrint = async (issue) => {
        try {
            toast.loading(`Đang chuẩn bị dữ liệu in cho phiếu ${issue.issue_code}...`);

            const whId = uuidOrNull(issue.warehouse_id);
            const supId = uuidOrNull(issue.supplier_id);

            const [itemsRes, warehouseRes, supplierRes] = await Promise.all([
                supabase.from('goods_issue_items').select('*').eq('issue_id', issue.id),
                whId
                    ? supabase.from('warehouses').select('name').eq('id', whId).single()
                    : Promise.resolve({ data: null }),
                supId
                    ? supabase.from('suppliers').select('name').eq('id', supId).single()
                    : Promise.resolve({ data: null }),
            ]);

            setPrintData({
                issue,
                items: itemsRes.data || [],
                warehouse: warehouseRes.data?.name || 'N/A',
                supplier: supplierRes.data?.name || 'N/A'
            });

            toast.dismiss();
            // The template handles window.print via useEffect when printData changes
        } catch (error) {
            console.error('Lỗi khi in phiếu:', error);
            toast.dismiss();
            toast.error('Không thể tải dữ liệu in');
        }
    };

    // UI Helpers
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

    const getRowStyle = (type, isSelected) => {
        let baseStyle = "group border-l-4 transition-all duration-200 ";
        if (isSelected) baseStyle += "bg-blue-50/40 border-l-blue-500 ";
        else {
            switch (type) {
                case 'TRA_VO': baseStyle += "border-l-indigo-400 hover:bg-indigo-50/40 "; break;
                case 'TRA_MAY': baseStyle += "border-l-slate-800 hover:bg-slate-100/60 "; break;
                case 'TRA_BINH_LOI': baseStyle += "border-l-rose-400 hover:bg-rose-50/40 "; break;
                default: baseStyle += "border-l-transparent hover:bg-blue-50/60 ";
            }
        }
        return baseStyle;
    };

    const getTypeBadgeClass = (type) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border',
        type === 'TRA_VO' && 'bg-indigo-50 text-indigo-600 border-indigo-100',
        type === 'TRA_MAY' && 'bg-slate-800 text-white border-slate-700',
        type === 'TRA_BINH_LOI' && 'bg-rose-50 text-rose-600 border-rose-100'
    );

    const getFilterButtonClass = (isActive, colorType) => clsx(
        "filter-trigger-btn flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold transition-all",
        !isActive && "border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground",
        isActive && colorType === 'blue' && "border-blue-200 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100",
        isActive && colorType === 'amber' && "border-amber-200 bg-amber-50 text-amber-700 shadow-sm shadow-amber-100",
        isActive && colorType === 'indigo' && "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100",
        isActive && colorType === 'rose' && "border-rose-200 bg-rose-50 text-rose-700 shadow-sm shadow-rose-100",
        isActive && colorType === 'violet' && "border-violet-200 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100"
    );

    const getFilterCountBadgeClass = (colorType) => clsx(
        "ml-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black text-white",
        colorType === 'blue' && "bg-blue-600",
        colorType === 'amber' && "bg-amber-600",
        colorType === 'indigo' && "bg-indigo-600",
        colorType === 'rose' && "bg-rose-600",
        colorType === 'violet' && "bg-violet-600"
    );

    const getFilterIconClass = (key, isActive) => {
        switch (key) {
            case 'status': return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'type': return isActive ? 'text-indigo-700' : 'text-indigo-500';
            case 'warehouse': return isActive ? 'text-amber-700' : 'text-amber-500';
            case 'supplier': return isActive ? 'text-rose-700' : 'text-rose-500';
            default: return isActive ? 'text-primary' : 'text-primary/70';
        }
    };

    // Mobile Filter Handlers
    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 300);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingTypes(selectedTypes);
        setPendingWarehouses(selectedWarehouses);
        setPendingSuppliers(selectedSuppliers);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedTypes(pendingTypes);
        setSelectedWarehouses(pendingWarehouses);
        setSelectedSuppliers(pendingSuppliers);
        closeMobileFilter();
    };

    const handleResetFilters = () => {
        setSelectedStatuses([]);
        setSelectedTypes([]);
        setSelectedWarehouses([]);
        setSelectedSuppliers([]);
        setSearchTerm('');
    };

    const hasActiveFilters = selectedStatuses.length > 0 || selectedTypes.length > 0 || selectedWarehouses.length > 0 || selectedSuppliers.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedTypes.length + selectedWarehouses.length + selectedSuppliers.length;

    // Filter Options
    const statusOptions = ISSUE_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: issues.filter(i => i.status === s.id).length
    }));

    const typeOptions = ISSUE_TYPES.map(t => ({
        id: t.id,
        label: t.label,
        count: issues.filter(i => i.issue_type === t.id).length
    }));

    const warehouseOptions = warehouses.map(w => ({
        id: w.id,
        label: w.name,
        count: issues.filter(i => i.warehouse_id === w.id).length
    }));

    const supplierOptions = suppliers.map(s => ({
        id: s.id,
        label: s.name,
        count: issues.filter(i => i.supplier_id === s.id).length
    }));

    // Column visibility helper
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => ISSUE_TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredIssues.length && filteredIssues.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredIssues.map(i => i.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const renderCell = (key, issue) => {
        switch (key) {
            case 'issue_code':
                return <span className="text-[13px] font-bold text-foreground">{issue.issue_code}</span>;
            case 'issue_date':
                return <span className="text-[13px] font-medium text-slate-600">{issue.issue_date || '---'}</span>;
            case 'issue_type':
                return <span className={getTypeBadgeClass(issue.issue_type)}>{getTypeLabel(issue.issue_type)}</span>;
            case 'supplier_id':
                return <span className="text-[13px] font-bold text-primary">{getSupplierName(issue.supplier_id)}</span>;
            case 'warehouse_id':
                return <span className="text-[13px] font-medium text-slate-700">{getWarehouseLabel(issue.warehouse_id)}</span>;
            case 'total_items':
                return <span className="text-[13px] font-black text-foreground">{formatNumber(issue.total_items)}</span>;
            case 'notes':
                return <span className="text-[13px] text-muted-foreground italic max-w-xs truncate">{issue.notes || '---'}</span>;
            case 'status':
                const status = getStatusConfig(issue.status);
                return (
                    <span className={getStatusBadgeClass(status.color)}>
                        {status.label}
                    </span>
                );
            case 'created_by':
                return <span className="text-[12px] text-muted-foreground font-medium uppercase">{issue.created_by?.split('@')[0] || '---'}</span>;
            default:
                return issue[key] || '---';
        }
    };

    const renderDesktopIssueFilters = () => (
        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                    className={getFilterButtonClass(selectedStatuses.length > 0, 'blue')}
                >
                    <Clock size={16} className={getFilterIconClass('status', selectedStatuses.length > 0)} />
                    Trạng thái
                    {selectedStatuses.length > 0 && <span className={getFilterCountBadgeClass('blue')}>{selectedStatuses.length}</span>}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' && 'rotate-180')} />
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
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
                    className={getFilterButtonClass(selectedTypes.length > 0, 'indigo')}
                >
                    <SlidersHorizontal size={16} className={getFilterIconClass('type', selectedTypes.length > 0)} />
                    Loại xuất
                    {selectedTypes.length > 0 && <span className={getFilterCountBadgeClass('indigo')}>{selectedTypes.length}</span>}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'type' && 'rotate-180')} />
                </button>
                {activeDropdown === 'type' && (
                    <FilterDropdown
                        options={typeOptions}
                        selected={selectedTypes}
                        setSelected={setSelectedTypes}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse')}
                    className={getFilterButtonClass(selectedWarehouses.length > 0, 'amber')}
                >
                    <Package size={16} className={getFilterIconClass('warehouse', selectedWarehouses.length > 0)} />
                    Kho xuất
                    {selectedWarehouses.length > 0 && <span className={getFilterCountBadgeClass('amber')}>{selectedWarehouses.length}</span>}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouse' && 'rotate-180')} />
                </button>
                {activeDropdown === 'warehouse' && (
                    <FilterDropdown
                        options={warehouseOptions}
                        selected={selectedWarehouses}
                        setSelected={setSelectedWarehouses}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'supplier' ? null : 'supplier')}
                    className={getFilterButtonClass(selectedSuppliers.length > 0, 'rose')}
                >
                    <User size={16} className={getFilterIconClass('supplier', selectedSuppliers.length > 0)} />
                    Nhà nhận
                    {selectedSuppliers.length > 0 && <span className={getFilterCountBadgeClass('rose')}>{selectedSuppliers.length}</span>}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'supplier' && 'rotate-180')} />
                </button>
                {activeDropdown === 'supplier' && (
                    <FilterDropdown
                        options={supplierOptions}
                        selected={selectedSuppliers}
                        setSelected={setSelectedSuppliers}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-rose-300 text-rose-500 text-[12px] font-bold hover:bg-rose-50 transition-all"
                >
                    <X size={14} />
                    Xóa bộ lọc
                </button>
            )}
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={16} /> },
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
                        actions={
                            <>
                                <div className="relative">
                                    <button
                                        id="more-actions-button-goods"
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        className={clsx(
                                            "p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                            showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                        )}
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                    {showMoreActions && (
                                        <div id="more-actions-menu-goods" className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                            <div
                                                role="button"
                                                onClick={() => { handleDownloadTemplate(); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                            >
                                                <Download size={18} className="text-slate-400" />
                                                Tải mẫu Excel
                                            </div>
                                            <label className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                                                <Upload size={18} className="text-slate-400" />
                                                Import Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={(e) => { handleImportExcel(e); setShowMoreActions(false); }}
                                                    className="hidden"
                                                />
                                            </label>
                                            
                                            <div className="my-1 border-t border-slate-100"></div>
                                            
                                            <div
                                                role="button"
                                                onClick={() => { openFormModal(null, 'TRA_VO'); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-[14px] font-bold text-primary hover:bg-slate-50 transition-colors cursor-pointer"
                                            >
                                                <Package size={18} className="text-primary" />
                                                Thêm phiếu Trả vỏ
                                            </div>
                                            <div
                                                role="button"
                                                onClick={() => { openFormModal(null, 'TRA_MAY'); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                                            >
                                                <CheckCircle size={18} className="text-slate-800" />
                                                Thêm phiếu Trả máy
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100"
                                        >
                                            <Trash2 size={14} /> Xóa tất cả
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />

                    {/* ── DESKTOP TOOLBAR ── */}
                    <div className="hidden md:flex flex-col p-4 border-b border-border gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-4 py-2 h-10 border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all shrink-0 text-[13px] font-bold shadow-sm active:scale-95"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Tìm mã phiếu, ghi chú..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-10 py-2.5 bg-muted/30 border border-border/80 rounded-2xl text-[13px] focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl font-bold text-[13px] transition-all shadow-sm"
                                    >
                                        <Trash2 size={16} />
                                        Xóa ({selectedIds.length})
                                    </button>
                                )}

                                <div
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-4 py-2 h-10 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all text-[13px] font-bold shadow-sm cursor-pointer select-none"
                                    title="Tải mẫu Excel"
                                >
                                    <Download size={16} className="shrink-0" />
                                    <span>Tải mẫu</span>
                                </div>

                                <label className="flex items-center gap-2 px-4 py-2 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all text-[13px] font-bold shadow-sm cursor-pointer select-none">
                                    <Upload size={16} className="shrink-0" />
                                    <span>Nhập Excel</span>
                                    <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
                                </label>

                                <div className="relative" ref={columnPickerRef}>
                                    <button
                                        onClick={() => setShowColumnPicker(!showColumnPicker)}
                                        className={clsx(
                                            "flex items-center gap-2 px-4 py-2 h-10 rounded-xl border text-[13px] font-bold transition-all",
                                            showColumnPicker ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-white text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <SlidersHorizontal size={16} />
                                        Cột
                                        <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-muted text-[10px] font-black">{visibleColumns.length}/{ISSUE_TABLE_COLUMNS.length}</span>
                                    </button>
                                    {showColumnPicker && (
                                        <ColumnPicker
                                            columnOrder={columnOrder}
                                            setColumnOrder={setColumnOrder}
                                            visibleColumns={visibleColumns}
                                            setVisibleColumns={setVisibleColumns}
                                            defaultColOrder={defaultColOrder}
                                            columnDefs={ISSUE_TABLE_COLUMNS.reduce((acc, col) => {
                                                acc[col.key] = { label: col.label };
                                                return acc;
                                            }, {})}
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={() => openFormModal(null, 'TRA_VO')}
                                    className="flex items-center gap-2 px-5 py-2.5 h-10 bg-primary hover:bg-secondary text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-primary/20 active:scale-95"
                                >
                                    <Plus size={18} />
                                    Trả vỏ
                                </button>

                                <button
                                    onClick={() => openFormModal(null, 'TRA_MAY')}
                                    className="flex items-center gap-2 px-5 py-2.5 h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                                >
                                    <Plus size={18} />
                                    Trả máy
                                </button>
                            </div>
                        </div>

                        {renderDesktopIssueFilters()}
                    </div>

                    {/* ── TABLE ── */}
                    <div className="hidden md:block flex-1 overflow-auto min-h-0">
                        <table className="w-full border-separate border-spacing-0">
                            <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md border-b border-border">
                                <tr>
                                    <th className="pl-4 pr-2 py-3.5 w-10 border-b border-slate-200">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                            checked={selectedIds.length === filteredIssues.length && filteredIssues.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    {visibleTableColumns.map((col) => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                "px-3 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left border-b border-slate-200",
                                                (col.key === 'total_items' || col.key === 'status') && "text-center"
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right border-b border-slate-200">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {loading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="py-20">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                                <p className="text-[13px] font-medium text-muted-foreground">Đang tải dữ liệu...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredIssues.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-40">
                                                <PackageMinus size={48} />
                                                <p className="text-[14px] font-bold">Không tìm thấy dữ liệu phiếu xuất</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedIssues.map((issue) => {
                                        const isSelected = selectedIds.includes(issue.id);
                                        return (
                                            <tr key={issue.id} className={getRowStyle(issue.issue_type, isSelected)}>
                                                <td className="pl-4 pr-2 py-3">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(issue.id)}
                                                    />
                                                </td>
                                                {visibleTableColumns.map((col) => (
                                                    <td key={col.key} className="px-3 py-3.5 whitespace-nowrap">
                                                        {renderCell(col.key, issue)}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePrint(issue); }}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                            title="In phiếu"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openFormModal(issue); }}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue.id, issue.issue_code); }}
                                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── MOBILE LIST ── */}
                    <div className="md:hidden flex-1 overflow-auto p-3 flex flex-col gap-3 bg-slate-50/50">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-[12px] font-medium text-muted-foreground">Đang tải . . .</p>
                            </div>
                        ) : filteredIssues.length === 0 ? (
                            <div className="text-center py-10 opacity-40">
                                <PackageMinus size={40} className="mx-auto mb-2" />
                                <p className="text-[13px] font-bold">Không có dữ liệu</p>
                            </div>
                        ) : (
                            paginatedIssues.map((issue) => (
                                <div key={issue.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(issue.id)
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                        : "border-primary/15 bg-white"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(issue.id)}
                                                    onChange={() => toggleSelect(issue.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{issue.issue_code}</h3>
                                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{issue.issue_date}</p>
                                            </div>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusBadgeClass(getStatusConfig(issue.status).color))}>
                                            {getStatusConfig(issue.status).label}
                                        </span>
                                    </div>
                                    <div className="mb-4 pl-8">
                                        <div className="text-[13px] font-bold text-primary truncate mb-2">{getSupplierName(issue.supplier_id)}</div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={getTypeBadgeClass(issue.issue_type)}>{getTypeLabel(issue.issue_type)}</span>
                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600">
                                                <Package size={12} />
                                                {getWarehouseLabel(issue.warehouse_id)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-border/60 pl-8">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Số lượng</span>
                                            <span className="text-[15px] font-black text-foreground">{formatNumber(issue.total_items)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handlePrint(issue); }} className="p-2 border border-border rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100"><Printer size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); openFormModal(issue); }} className="p-2 border border-border rounded-xl text-primary bg-primary/5 hover:bg-primary/10"><Edit size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue.id, issue.issue_code); }} className="p-2 border border-border rounded-xl text-rose-500 bg-rose-50 hover:bg-rose-100"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Sticky Mobile Pagination */}
                    {!loading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={filteredIssues.length}
                        />
                    )}

                    {/* Footer */}
                    <div className="hidden md:flex flex-none p-4 border-t border-border items-center justify-between bg-white rounded-b-2xl">
                        <p className="text-[12px] text-muted-foreground font-medium">
                            Hiển thị <span className="text-foreground font-black">{totalActiveFilters > 0 ? filteredIssues.length : paginatedIssues.length}</span> / {filteredIssues.length} phiếu
                        </p>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-1 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} className="-mr-2" />
                                <ChevronLeft size={16} />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-[12px] font-bold px-3 py-1 bg-primary text-white rounded-lg">Trang {currentPage}</span>
                            <button 
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                disabled={currentPage >= Math.ceil(filteredIssues.length / pageSize)}
                                className="p-1 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button 
                                onClick={() => setCurrentPage(Math.ceil(filteredIssues.length / pageSize) || 1)}
                                disabled={currentPage >= Math.ceil(filteredIssues.length / pageSize)}
                                className="p-1 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                                <ChevronRight size={16} className="-ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'kanban' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border sticky top-0 bg-white/95 backdrop-blur-md z-[40]">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} />
                            <input
                                type="text"
                                placeholder="Tìm mã phiếu, ghi chú..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2.5 bg-muted/30 border border-border/80 rounded-xl text-[13px] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                totalActiveFilters > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground'
                            )}
                        >
                            <Filter size={18} />
                            {totalActiveFilters > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="hidden md:flex flex-col p-4 border-b border-border gap-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-4 py-2 h-10 border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all shrink-0 text-[13px] font-bold shadow-sm active:scale-95"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Tìm mã phiếu, ghi chú..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-10 py-2.5 bg-muted/30 border border-border/80 rounded-2xl text-[13px] focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-semibold"
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => openFormModal(null, 'TRA_VO')}
                                    className="flex items-center gap-2 px-5 py-2.5 h-10 bg-primary hover:bg-secondary text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap"
                                >
                                    <Plus size={18} />
                                    Trả vỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openFormModal(null, 'TRA_MAY')}
                                    className="flex items-center gap-2 px-5 py-2.5 h-10 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-slate-200 active:scale-95 whitespace-nowrap"
                                >
                                    <Plus size={18} />
                                    Trả máy
                                </button>
                            </div>
                        </div>
                        {renderDesktopIssueFilters()}
                    </div>

                    <div className="flex-1 min-h-[min(520px,calc(100vh-260px))] overflow-x-auto overflow-y-hidden p-2 md:p-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 h-full">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-[13px] font-medium text-muted-foreground">Đang tải phiếu xuất…</p>
                            </div>
                        ) : filteredIssues.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6 text-muted-foreground">
                                <PackageMinus size={48} className="opacity-35 mb-3" />
                                <p className="text-[14px] font-bold">Không có phiếu phù hợp bộ lọc</p>
                                <p className="text-[12px] mt-1">Thử đổi tìm kiếm hoặc xóa bộ lọc.</p>
                            </div>
                        ) : (
                            <div className="flex gap-4 h-full min-h-[min(480px,calc(100vh-280px))] pb-2">
                                {issueKanbanColumns.map((col) => (
                                    <div
                                        key={col.id}
                                        className="flex flex-col w-[min(92vw,300px)] sm:w-[min(280px,calc((100vw-4rem)/3))] shrink-0 rounded-2xl border border-border bg-muted/40 overflow-hidden"
                                    >
                                        <div
                                            className={clsx(
                                                'px-3 py-2.5 border-b font-black text-[11px] uppercase tracking-wide flex items-center justify-between gap-2',
                                                getKanbanColumnHeadClass(col.id)
                                            )}
                                        >
                                            <span className="truncate">{col.label}</span>
                                            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-white/70 text-[11px] font-black tabular-nums border border-black/5">
                                                {col.items.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0 custom-scrollbar bg-white/60">
                                            {col.items.length === 0 ? (
                                                <p className="text-[11px] font-semibold text-muted-foreground text-center py-8 px-2">Trống</p>
                                            ) : (
                                                col.items.map((issue) => {
                                                    const st = getStatusConfig(issue.status);
                                                    return (
                                                        <div
                                                            key={issue.id}
                                                            className={clsx(
                                                                'rounded-xl border border-border bg-white p-3 shadow-sm border-l-4 space-y-2',
                                                                getKanbanCardBorderClass(col.id === '__other' ? issue.issue_type : col.id)
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <p className="text-[13px] font-black font-mono text-foreground truncate">{issue.issue_code}</p>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{issue.issue_date || '—'}</p>
                                                                </div>
                                                                <span className={clsx('shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border', getStatusBadgeClass(st.color))}>
                                                                    {st.label}
                                                                </span>
                                                            </div>
                                                            <p className="text-[12px] font-bold text-primary truncate" title={getSupplierName(issue.supplier_id)}>
                                                                {getSupplierName(issue.supplier_id)}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded-md">
                                                                    <Package size={11} />
                                                                    {getWarehouseLabel(issue.warehouse_id)}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                                                                    SL {formatNumber(issue.total_items)}
                                                                </span>
                                                            </div>
                                                            {issue.notes && (
                                                                <p className="text-[10px] font-medium text-slate-500 line-clamp-2 italic">{issue.notes}</p>
                                                            )}
                                                            <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/50">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePrint(issue)}
                                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                    title="In"
                                                                >
                                                                    <Printer size={15} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openFormModal(issue)}
                                                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                                    title="Sửa"
                                                                >
                                                                    <Edit size={15} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteIssue(issue.id, issue.issue_code)}
                                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Xóa"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    {/* Mobile Stats Toggle/Filter */}
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border sticky top-0 bg-white/80 backdrop-blur-md z-[40]">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="flex-1 text-[13px] font-black text-foreground uppercase tracking-tight text-center">Thống kê dữ liệu</h2>
                        <button
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                totalActiveFilters > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                            )}
                        >
                            <Filter size={18} />
                            {totalActiveFilters > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Desktop Filter Row */}
                    <div className="hidden md:block p-4 border-b border-border" ref={dropdownRef}>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-4 py-2 h-10 border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all shrink-0 text-[13px] font-bold shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={16} />
                                Quay lại
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className={getFilterButtonClass(selectedStatuses.length > 0, 'blue')}
                                >
                                    <Clock size={16} className={getFilterIconClass('status', selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && <span className={getFilterCountBadgeClass('blue')}>{selectedStatuses.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' && "rotate-180")} />
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
                                    className={getFilterButtonClass(selectedTypes.length > 0, 'indigo')}
                                >
                                    <SlidersHorizontal size={16} className={getFilterIconClass('type', selectedTypes.length > 0)} />
                                    Loại xuất
                                    {selectedTypes.length > 0 && <span className={getFilterCountBadgeClass('indigo')}>{selectedTypes.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'type' && "rotate-180")} />
                                </button>
                                {activeDropdown === 'type' && (
                                    <FilterDropdown
                                        options={typeOptions}
                                        selected={selectedTypes}
                                        setSelected={setSelectedTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse')}
                                    className={getFilterButtonClass(selectedWarehouses.length > 0, 'amber')}
                                >
                                    <Package size={16} className={getFilterIconClass('warehouse', selectedWarehouses.length > 0)} />
                                    Kho xuất
                                    {selectedWarehouses.length > 0 && <span className={getFilterCountBadgeClass('amber')}>{selectedWarehouses.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouse' && "rotate-180")} />
                                </button>
                                {activeDropdown === 'warehouse' && (
                                    <FilterDropdown
                                        options={warehouseOptions}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'supplier' ? null : 'supplier')}
                                    className={getFilterButtonClass(selectedSuppliers.length > 0, 'rose')}
                                >
                                    <User size={16} className={getFilterIconClass('supplier', selectedSuppliers.length > 0)} />
                                    Nhà nhận
                                    {selectedSuppliers.length > 0 && <span className={getFilterCountBadgeClass('rose')}>{selectedSuppliers.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'supplier' && "rotate-180")} />
                                </button>
                                {activeDropdown === 'supplier' && (
                                    <FilterDropdown
                                        options={supplierOptions}
                                        selected={selectedSuppliers}
                                        setSelected={setSelectedSuppliers}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {totalActiveFilters > 0 && (
                                <button
                                    onClick={handleResetFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-rose-300 text-rose-500 text-[12px] font-bold hover:bg-rose-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                        {/* Summary Cards Row */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm col-span-2 md:col-span-1">
                                <div className="flex flex-row items-center justify-center md:justify-start text-center md:text-left gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <List className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng số phiếu</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 leading-none">{formatNumber(filteredIssues.length)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50/70 border border-green-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-green-200/70">
                                        <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-green-600 uppercase tracking-wider">Hoàn thành</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 leading-none">{formatNumber(filteredIssues.filter(i => i.status === 'HOAN_THANH').length)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-orange-200/70">
                                        <Clock className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đang chờ</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 leading-none">{formatNumber(filteredIssues.filter(i => i.status === 'CHO_DUYET').length)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                    <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
                                    Phân loại theo loại
                                </h3>
                                <div style={{ height: '350px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getTypeStats().map(item => item.name),
                                            datasets: [{
                                                label: 'Số lượng phiếu',
                                                data: getTypeStats().map(item => item.value),
                                                backgroundColor: chartColors[0],
                                                borderRadius: 8
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { 
                                                legend: { display: false },
                                                tooltip: { callbacks: { label: (c) => `${c.parsed.y} phiếu` } }
                                            },
                                            scales: { 
                                                y: { beginAtZero: true, grid: { display: false } },
                                                x: { grid: { display: false } }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-rose-500" />
                                    Top 10 Nhà nhận hàng
                                </h3>
                                <div style={{ height: '350px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getSupplierStats().map(item => item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name),
                                            datasets: [{
                                                label: 'Số lượng phiếu',
                                                data: getSupplierStats().map(item => item.value),
                                                backgroundColor: chartColors[2],
                                                borderRadius: 8
                                            }]
                                        }}
                                        options={{
                                            indexAxis: 'y',
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { 
                                                legend: { display: false },
                                                tooltip: { callbacks: { label: (c) => `${c.parsed.x} phiếu xuất` } }
                                            },
                                            scales: { 
                                                x: { beginAtZero: true, grid: { display: false } },
                                                y: { grid: { display: false } }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals & Portals */}
            {isFormModalOpen && (
                <GoodsIssueFormModal
                    isOpen={isFormModalOpen}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSuccess}
                    issue={selectedIssue}
                    forcedType={initialForcedType}
                    warehouses={warehouses}
                    suppliers={suppliers}
                />
            )}

            {printData.issue && createPortal(
                <div className="pvn-goods-issue-print-portal">
                    <GoodsIssuePrintTemplate
                        issue={printData.issue}
                        items={printData.items}
                        warehouseName={printData.warehouse}
                        supplierName={printData.supplier}
                        onPrinted={() => setPrintData({ issue: null, items: [], warehouse: '', supplier: '' })}
                    />
                </div>,
                document.body
            )}

            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    isClosing={mobileFilterClosing}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    title="Lọc Phiếu Xuất Kho"
                    sections={[
                        {
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Clock size={18} className="text-blue-500" />,
                            options: statusOptions.map(opt => ({ id: opt.id, label: opt.label, count: opt.count })),
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses
                        },
                        {
                            id: 'type',
                            label: 'Loại xuất',
                            icon: <SlidersHorizontal size={18} className="text-indigo-500" />,
                            options: typeOptions.map(opt => ({ id: opt.id, label: opt.label, count: opt.count })),
                            selectedValues: pendingTypes,
                            onSelectionChange: setPendingTypes
                        },
                        {
                            id: 'warehouse',
                            label: 'Kho xuất',
                            icon: <Package size={18} className="text-amber-500" />,
                            options: warehouseOptions.map(opt => ({ id: opt.id, label: opt.label, count: opt.count })),
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses
                        },
                        {
                            id: 'supplier',
                            label: 'Nhà nhận',
                            icon: <User size={18} className="text-rose-500" />,
                            options: supplierOptions.map(opt => ({ id: opt.id, label: opt.label, count: opt.count })),
                            selectedValues: pendingSuppliers,
                            onSelectionChange: setPendingSuppliers,
                            searchable: true
                        }
                    ]}
                />
            )}
        </div>
    );
};

export default GoodsIssues;
