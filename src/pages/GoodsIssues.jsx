import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Edit,
    Filter,
    LayoutGrid,
    List,
    Package,
    PackageMinus,
    Plus,
    Printer,
    Search,
    Settings2,
    SlidersHorizontal,
    Trash2,
    Upload,
    User,
    X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { createPortal } from 'react-dom';
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Title,
    Tooltip,
    ArcElement
} from 'chart.js';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import clsx from 'clsx';

import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import GoodsIssueFormModal from '../components/GoodsIssues/GoodsIssueFormModal';
import GoodsIssuePrintTemplate from '../components/GoodsIssues/GoodsIssuePrintTemplate';
import { supabase } from '../supabase/config';
import { ISSUE_STATUSES, ISSUE_TABLE_COLUMNS, ISSUE_TYPES } from '../constants/goodsIssueConstants';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const GoodsIssues = () => {
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState('list'); // 'list' | 'stats'
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

    // Column visibility and order
    const [visibleColumns, setVisibleColumns] = useState(
        ISSUE_TABLE_COLUMNS.map(col => col.key)
    );
    const [columnOrder, setColumnOrder] = useState(
        ISSUE_TABLE_COLUMNS.map(col => col.key)
    );
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);

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

    // Printing state
    const [isPrinting, setIsPrinting] = useState(false);
    const [printData, setPrintData] = useState({ issue: null, items: [], warehouse: '', supplier: '' });
    const printRef = useRef(null);

    useEffect(() => {
        fetchData();
        fetchMasters();

        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            if (activeDropdown && !event.target.closest('.filter-dropdown-container')) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, showColumnPicker]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('goods_issues')
                .select('*')
                .order('created_at', { ascending: false });

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
            const matchSearch =
                issue.issue_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                issue.notes?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(issue.status);
            const matchType = selectedTypes.length === 0 || selectedTypes.includes(issue.issue_type);
            const matchWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(issue.warehouse_id);
            const matchSupplier = selectedSuppliers.length === 0 || selectedSuppliers.includes(issue.supplier_id);

            return matchSearch && matchStatus && matchType && matchWarehouse && matchSupplier;
        });
    }, [issues, searchTerm, selectedStatuses, selectedTypes, selectedWarehouses, selectedSuppliers]);

    // Helpers
    const getStatusConfig = (statusId) => {
        return ISSUE_STATUSES.find(s => s.id === statusId) || { label: statusId, color: 'gray' };
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
            stats[i.status] = (stats[i.status] || 0) + 1;
        });
        return Object.entries(stats).map(([key, value]) => ({
            name: getStatusConfig(key).label,
            value
        }));
    };

    const getTypeStats = () => {
        const stats = {};
        issues.forEach(i => {
            stats[i.issue_type] = (stats[i.issue_type] || 0) + 1;
        });
        return Object.entries(stats).map(([key, value]) => ({
            name: getTypeLabel(key),
            value
        }));
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
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#71717a'
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
                toast.dismiss();
                toast.success('Import thành công (giả lập)');
                fetchData();
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

    const handlePrint = async (issue) => {
        try {
            toast.loading(`Đang chuẩn bị dữ liệu in cho phiếu ${issue.issue_code}...`);
            
            const [itemsRes, warehouseRes, supplierRes] = await Promise.all([
                supabase.from('goods_issue_items').select('*').eq('issue_id', issue.id),
                supabase.from('warehouses').select('name').eq('id', issue.warehouse_id).single(),
                supabase.from('suppliers').select('name').eq('id', issue.supplier_id).single()
            ]);

            setPrintData({
                issue,
                items: itemsRes.data || [],
                warehouse: warehouseRes.data?.name || 'N/A',
                supplier: supplierRes.data?.name || 'N/A'
            });

            toast.dismiss();
            // Printing is now handled internally by the template via useEffect

        } catch (error) {
            console.error('Lỗi khi in phiếu:', error);
            toast.error('Không thể tải dữ liệu in');
        }
    };

    // Filter UI components
    const FilterDropdownGroup = ({ label, icon, options, selected, setSelected, dropdownId, activeColor = 'primary' }) => {
        const isOpen = activeDropdown === dropdownId;
        const count = selected.length;

        return (
            <div className="relative">
                <button
                    onClick={() => setActiveDropdown(isOpen ? null : dropdownId)}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-bold transition-all",
                        count > 0 ? `border-${activeColor}-500 bg-${activeColor}-50 text-${activeColor}-700` : "border-border bg-white text-muted-foreground hover:bg-muted"
                    )}
                >
                    {icon}
                    {label}
                    {count > 0 && <span className={clsx("ml-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black", `bg-${activeColor}-200 text-${activeColor}-800`)}>{count}</span>}
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 z-[50]">
                        <FilterDropdown
                            options={options}
                            selected={selected}
                            setSelected={setSelected}
                            onClose={() => setActiveDropdown(null)}
                            searchPlaceholder={`Tìm ${label.toLowerCase()}...`}
                        />
                    </div>
                )}
            </div>
        );
    };

    // Desktop Visibility Helper
    const visibleTableColumns = useMemo(() => {
        return columnOrder
            .map(key => ISSUE_TABLE_COLUMNS.find(c => c.key === key))
            .filter(col => col && visibleColumns.includes(col.key));
    }, [visibleColumns, columnOrder]);

    // Handle Selection
    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredIssues.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredIssues.map(i => i.id));
        }
    };

    const getStatusBadgeClass = (color) => {
        switch (color) {
            case 'yellow': return 'px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-bold';
            case 'blue': return 'px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-bold';
            case 'green': return 'px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold';
            case 'red': return 'px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold';
            default: return 'px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 font-bold';
        }
    };

    const getTypeBadgeClass = (type) => {
        if (type === 'TRA_VO') return 'px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black uppercase';
        if (type === 'TRA_MAY') return 'px-2 py-0.5 rounded-lg bg-slate-800 text-white text-[10px] font-black uppercase';
        return 'px-2 py-0.5 rounded-lg bg-muted text-muted-foreground text-[10px] font-black uppercase';
    };

    const getRowStyle = (type, isSelected) => {
        const base = "transition-all duration-200 hover:bg-slate-50/80";
        if (isSelected) return `${base} bg-primary/5 ring-1 ring-inset ring-primary/20`;
        if (type === 'TRA_VO') return `${base} border-l-4 border-l-indigo-500`;
        if (type === 'TRA_MAY') return `${base} border-l-4 border-l-slate-800`;
        return base;
    };

    // Mobile Filters
    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingTypes(selectedTypes);
        setPendingWarehouses(selectedWarehouses);
        setPendingSuppliers(selectedSuppliers);
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
    const statusOptions = ISSUE_STATUSES.filter(s => s.id !== 'ALL').map(s => ({ value: s.id, label: s.label }));
    const typeOptions = ISSUE_TYPES.map(t => ({ value: t.id, label: t.label }));
    const warehouseOptions = warehouses.map(w => ({ value: w.id, label: w.name }));
    const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {/* ── HEADER ── */}
            <div className="flex-none bg-white border-b border-border px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shadow-sm relative z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <PackageMinus size={22} />
                    </div>
                    <div>
                        <h1 className="text-[15px] md:text-[18px] font-black text-foreground tracking-tight leading-none uppercase">Quản lý Xuất Kho</h1>
                        <p className="text-[10px] md:text-[12px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">Tài sản & Thành phẩm</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-muted/50 p-1 rounded-2xl flex items-center">
                        <button
                            onClick={() => setActiveView('list')}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-bold transition-all",
                                activeView === 'list' ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <List size={16} />
                            <span className="hidden md:inline">Danh sách</span>
                        </button>
                        <button
                            onClick={() => setActiveView('stats')}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-1.5 rounded-xl text-[12px] font-bold transition-all",
                                activeView === 'stats' ? "bg-white text-secondary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid size={16} />
                            <span className="hidden md:inline">Thống kê</span>
                        </button>
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={openMobileFilter}
                            className={clsx(
                                "p-2 rounded-xl border relative transition-all active:scale-95",
                                hasActiveFilters ? "border-primary bg-primary/5 text-primary" : "border-border bg-white text-muted-foreground"
                            )}
                        >
                            <Filter size={20} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/50 relative">
                {activeView === 'list' && (
                    <div className="bg-white rounded-3xl border border-border shadow-sm flex flex-col h-full overflow-hidden">
                        {/* Desktop Toolbar */}
                        <div className="hidden md:flex flex-col p-4 border-b border-border bg-white/50 gap-4 relative">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="flex items-center gap-2 px-4 py-2.5 border border-border bg-white text-muted-foreground hover:text-primary hover:border-primary/50 rounded-2xl transition-all shrink-0 text-[13px] font-bold shadow-sm active:scale-95"
                                    >
                                        <ChevronLeft size={18} />
                                        Quay lại
                                    </button>
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm mã phiếu, ghi chú..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-muted/40 border border-border/80 rounded-2xl text-[14px] focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    {selectedIds.length > 0 && (
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl font-bold text-[13px] transition-all"
                                        >
                                            <Trash2 size={16} />
                                            Xóa ({selectedIds.length})
                                        </button>
                                    )}
                                    <button
                                        onClick={handleDownloadTemplate}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl font-bold text-[13px] transition-all"
                                        title="Tải mẫu Excel"
                                    >
                                        <Download size={16} />
                                        Mẫu Import
                                    </button>
                                    <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-bold text-[13px] transition-all cursor-pointer" title="Nhập Excel">
                                        <Upload size={16} />
                                        Import Excel
                                        <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
                                    </label>

                                    <div className="relative" ref={columnPickerRef}>
                                        <button
                                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                                            className={clsx(
                                                "flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[13px] font-bold transition-all",
                                                showColumnPicker ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-white text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Settings2 size={16} />
                                            Cột hiển thị
                                            <span className="ml-1 px-1.5 py-0.5 rounded-lg bg-muted text-[10px] font-black">{visibleColumns.length}/{ISSUE_TABLE_COLUMNS.length}</span>
                                        </button>
                                        {showColumnPicker && (
                                            <div className="absolute right-0 top-full mt-2 z-[100]">
                                                <ColumnPicker
                                                    columns={ISSUE_TABLE_COLUMNS}
                                                    visibleColumns={visibleColumns}
                                                    setVisibleColumns={setVisibleColumns}
                                                    columnOrder={columnOrder}
                                                    setColumnOrder={setColumnOrder}
                                                    onClose={() => setShowColumnPicker(false)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => openFormModal(null, 'TRA_VO')}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-secondary text-white rounded-2xl text-[13px] font-black transition-all shadow-lg shadow-primary/20 active:scale-95"
                                    >
                                        <Plus size={18} />
                                        Trả vỏ
                                    </button>
                                    <button
                                        onClick={() => openFormModal(null, 'TRA_MAY')}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-[13px] font-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                                    >
                                        <Plus size={18} />
                                        Trả máy
                                    </button>
                                </div>
                            </div>

                            <div className="relative z-[30] flex flex-wrap items-center gap-2.5 pb-1">
                                <div className="flex items-center gap-2.5">
                                    <FilterDropdownGroup
                                        label="Trạng thái"
                                        icon={<Clock size={14} className="text-blue-500" />}
                                        options={statusOptions}
                                        selected={selectedStatuses}
                                        setSelected={setSelectedStatuses}
                                        dropdownId="status"
                                    />
                                    <FilterDropdownGroup
                                        label="Loại xuất"
                                        icon={<SlidersHorizontal size={14} className="text-blue-500" />}
                                        options={typeOptions}
                                        selected={selectedTypes}
                                        setSelected={setSelectedTypes}
                                        dropdownId="type"
                                    />
                                    <FilterDropdownGroup
                                        label="Kho"
                                        icon={<Package size={14} className="text-amber-500" />}
                                        options={warehouseOptions}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        dropdownId="warehouse"
                                    />
                                    <FilterDropdownGroup
                                        label="Nhà cung cấp"
                                        icon={<User size={14} className="text-primary" />}
                                        options={supplierOptions}
                                        selected={selectedSuppliers}
                                        setSelected={setSelectedSuppliers}
                                        dropdownId="supplier"
                                        activeColor="indigo"
                                    />

                                    {hasActiveFilters && (
                                        <button
                                            onClick={handleResetFilters}
                                            className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-dashed border-rose-300 text-rose-600 text-[12px] font-bold hover:bg-rose-50 transition-all ml-2 active:scale-95"
                                        >
                                            <X size={15} />
                                            Xóa bộ lọc
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block flex-1 overflow-auto">
                            <table className="w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-border">
                                    <tr>
                                        <th className="pl-4 pr-3 py-3 w-10">
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
                                                    "px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-left border-b border-border",
                                                    (col.key === 'total_items' || col.key === 'status') && "text-center"
                                                )}
                                            >
                                                {col.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right border-b border-border">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="py-20 text-center text-muted-foreground italic">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    ) : filteredIssues.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="py-20 text-center text-muted-foreground italic">
                                                Không tìm thấy kết quả
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredIssues.map((issue) => {
                                            const isSelected = selectedIds.includes(issue.id);
                                            return (
                                                <tr key={issue.id} className={getRowStyle(issue.issue_type, isSelected)}>
                                                    <td className="pl-4 pr-3 py-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelect(issue.id)}
                                                        />
                                                    </td>
                                                    {visibleTableColumns.map((col) => (
                                                        <td key={col.key} className="px-3 py-3.5">
                                                            {col.key === 'issue_code' && <div className="font-bold text-foreground">{issue.issue_code}</div>}
                                                            {col.key === 'issue_date' && <div className="text-[13px] font-medium text-slate-600">{issue.issue_date || '---'}</div>}
                                                            {col.key === 'issue_type' && <span className={getTypeBadgeClass(issue.issue_type)}>{getTypeLabel(issue.issue_type)}</span>}
                                                            {col.key === 'supplier_id' && <div className="font-bold text-primary">{getSupplierName(issue.supplier_id)}</div>}
                                                            {col.key === 'warehouse_id' && <div className="text-[13px] font-medium text-slate-700">{getWarehouseLabel(issue.warehouse_id)}</div>}
                                                            {col.key === 'total_items' && <div className="text-center font-black text-foreground">{formatNumber(issue.total_items)}</div>}
                                                            {col.key === 'notes' && <div className="text-[13px] text-muted-foreground italic max-w-xs truncate">{issue.notes || '---'}</div>}
                                                            {col.key === 'status' && (
                                                                <div className="flex justify-center">
                                                                    <span className={getStatusBadgeClass(getStatusConfig(issue.status).color)}>{getStatusConfig(issue.status).label}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => handlePrint(issue)} 
                                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                                title="In phiếu"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            <button onClick={() => openFormModal(issue)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"><Edit size={16} /></button>
                                                            <button onClick={() => handleDeleteIssue(issue.id, issue.issue_code)} className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="md:hidden flex-1 overflow-auto p-3 space-y-3">
                            {filteredIssues.map((issue) => (
                                <div key={issue.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                                    <div className="flex justify-between mb-3">
                                        <span className="text-[14px] font-bold text-foreground">{issue.issue_code}</span>
                                        <span className={getStatusBadgeClass(getStatusConfig(issue.status).color)}>{getStatusConfig(issue.status).label}</span>
                                    </div>
                                    <div className="space-y-1 mb-4">
                                        <div className="text-[14px] font-bold text-foreground uppercase">{getSupplierName(issue.supplier_id)}</div>
                                        <div className="flex gap-2">
                                            <span className={getTypeBadgeClass(issue.issue_type)}>{getTypeLabel(issue.issue_type)}</span>
                                            <span className="text-[12px] text-muted-foreground">{issue.issue_date}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-border">
                                        <div className="text-[13px] font-medium">SL: <span className="font-black text-primary">{issue.total_items}</span></div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePrint(issue)} className="p-2 border border-border rounded-xl text-indigo-600"><Printer size={18} /></button>
                                            <button onClick={() => openFormModal(issue)} className="p-2 border border-border rounded-xl text-primary"><Edit size={18} /></button>
                                            <button onClick={() => handleDeleteIssue(issue.id, issue.issue_code)} className="p-2 border border-border rounded-xl text-red-500"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="flex-none p-3 border-t border-border flex items-center justify-between bg-white">
                            <p className="text-[12px] text-muted-foreground font-medium">
                                Đang hiển thị <span className="text-foreground font-black">{filteredIssues.length}</span> phiếu xuất
                            </p>
                            <div className="flex items-center gap-2">
                                <button className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed"><ChevronLeft size={16} /></button>
                                <span className="text-[12px] font-bold px-3 py-1 bg-primary/10 text-primary rounded-lg">1</span>
                                <button className="p-1.5 rounded-lg border border-border opacity-50 cursor-not-allowed"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'stats' && (
                    <div className="space-y-6 pb-20 overflow-auto h-full pr-1">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><List size={22} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-muted-foreground uppercase">Tổng phiếu</p>
                                    <p className="text-2xl font-black text-foreground">{issues.length}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center"><Plus size={22} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-muted-foreground uppercase">Hoàn thành</p>
                                    <p className="text-2xl font-black text-foreground">{issues.filter(i => i.status === 'HOAN_THANH').length}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Package size={22} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-muted-foreground uppercase">Số lượng</p>
                                    <p className="text-2xl font-black text-foreground">{formatNumber(issues.reduce((sum, i) => sum + (i.total_items || 0), 0))}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-border shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center"><Clock size={22} /></div>
                                <div>
                                    <p className="text-[11px] font-black text-muted-foreground uppercase">Chờ xử lý</p>
                                    <p className="text-2xl font-black text-foreground">{issues.filter(i => i.status === 'CHO_DUYET').length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                                <h3 className="text-[14px] font-black text-foreground uppercase mb-6">Trạng thái phiếu</h3>
                                <div className="h-[300px]"><PieChartJS data={{ labels: getStatusStats().map(s => s.name), datasets: [{ data: getStatusStats().map(s => s.value), backgroundColor: chartColors, borderWidth: 0 }] }} options={{ maintainAspectRatio: false }} /></div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-border shadow-sm">
                                <h3 className="text-[14px] font-black text-foreground uppercase mb-6">Hình thức xuất</h3>
                                <div className="h-[300px]"><PieChartJS data={{ labels: getTypeStats().map(t => t.name), datasets: [{ data: getTypeStats().map(t => t.value), backgroundColor: chartColors.slice(2), borderWidth: 0 }] }} options={{ maintainAspectRatio: false }} /></div>
                            </div>
                            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-border shadow-sm">
                                <h3 className="text-[14px] font-black text-foreground uppercase mb-6">Top Nhà Cung Cấp</h3>
                                <div className="h-[350px]"><BarChartJS data={{ labels: getSupplierStats().map(s => s.name), datasets: [{ label: 'Số phiếu', data: getSupplierStats().map(s => s.value), backgroundColor: '#3b82f6', borderRadius: 12 }] }} options={{ maintainAspectRatio: false, indexAxis: 'y' }} /></div>
                            </div> */}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals & Sheets */}
            <MobileFilterSheet
                isOpen={showMobileFilter}
                onClose={closeMobileFilter}
                isClosing={mobileFilterClosing}
                onApply={applyMobileFilter}
                sections={[
                    { id: 'status', label: 'Trạng thái', options: statusOptions, selectedValues: pendingStatuses, onSelectionChange: setPendingStatuses },
                    { id: 'type', label: 'Loại hình', options: typeOptions, selectedValues: pendingTypes, onSelectionChange: setPendingTypes },
                    { id: 'warehouse', label: 'Kho', options: warehouseOptions, selectedValues: pendingWarehouses, onSelectionChange: setPendingWarehouses },
                    { id: 'supplier', label: 'Nhà cung cấp', options: supplierOptions, selectedValues: pendingSuppliers, onSelectionChange: setPendingSuppliers }
                ]}
            />

            {isFormModalOpen && (
                <GoodsIssueFormModal
                    issue={selectedIssue}
                    forcedType={initialForcedType}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSuccess}
                />
            )}

            {/* Hidden Print Container via Portal */}
            {printData.issue && createPortal(
                <div className="pvn-goods-issue-print-portal">
                    <GoodsIssuePrintTemplate 
                        ref={printRef}
                        issue={printData.issue}
                        items={printData.items}
                        warehouseName={printData.warehouse}
                        supplierName={printData.supplier}
                        onPrinted={() => setPrintData({ issue: null, items: [], warehouse: '', supplier: '' })}
                    />
                </div>,
                document.body
            )}
        </div>
    );
};

export default GoodsIssues;
