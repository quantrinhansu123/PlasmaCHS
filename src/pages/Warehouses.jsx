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
    BarChart2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Eye,
    Filter,
    List,
    MapPin,
    MoreVertical,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    User,
    Warehouse,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import WarehouseDetailsModal from '../components/Warehouses/WarehouseDetailsModal';
import WarehouseFormModal from '../components/Warehouses/WarehouseFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import { WAREHOUSE_STATUSES } from '../constants/warehouseConstants';
import usePermissions from '../hooks/usePermissions';
import { isAdminRole } from '../utils/accessControl';
import { supabase } from '../supabase/config';

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

const TABLE_COLUMNS_DEF = [
    { key: 'name', label: 'Tên kho' },
    { key: 'branch_office', label: 'Chi nhánh / VPĐD' },
    { key: 'manager_name', label: 'Thủ kho' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'capacity', label: 'Sức chứa' },
    { key: 'status', label: 'Trạng thái' }
];

const Warehouses = () => {
    const { role: rawRole } = usePermissions();
    const isAdminOrManager = isAdminRole(rawRole);
    const navigate = useNavigate();
    const location = useLocation();

    const [activeView, setActiveView] = useState('list');
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);
    const [uniqueManagers, setUniqueManagers] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingManagers, setPendingManagers] = useState([]);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const [showMoreActions, setShowMoreActions] = useState(false);
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = TABLE_COLUMNS_DEF.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_warehouses_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_warehouses') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS_DEF.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;
    const warehouseIdFromQuery = new URLSearchParams(location.search).get('warehouseId');

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        const managers = [...new Set(warehouses.map(w => w.manager_name).filter(Boolean))];
        setUniqueManagers(managers);
    }, [warehouses]);

    useEffect(() => {
        if (!warehouseIdFromQuery || warehouses.length === 0) return;

        const matchedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseIdFromQuery);
        if (matchedWarehouse) {
            setSelectedWarehouse(matchedWarehouse);
            setIsDetailsModalOpen(true);
        }

        const searchParams = new URLSearchParams(location.search);
        searchParams.delete('warehouseId');
        const nextSearch = searchParams.toString();
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : ''
            },
            { replace: true }
        );
    }, [warehouseIdFromQuery, warehouses, location.pathname, location.search, navigate]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            if (!event.target.closest('#more-actions-menu-warehouses') && !event.target.closest('#more-actions-btn-warehouses')) {
                setShowMoreActions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        localStorage.setItem('columns_warehouses', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_warehouses_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingManagers(selectedManagers);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedManagers(pendingManagers);
        closeMobileFilter();
    };

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const buildWarehouseAliases = (warehouseInfo) => {
                const rawValues = [
                    warehouseInfo?.id,
                    warehouseInfo?.name,
                    warehouseInfo?.branch_office
                ].filter(Boolean);

                const aliases = new Set();
                rawValues.forEach((value) => {
                    const normalized = String(value).trim();
                    if (!normalized) return;
                    aliases.add(normalized);
                });

                const combinedText = rawValues
                    .map((value) => String(value).toLowerCase())
                    .join(' ');

                if (combinedText.includes('ha noi') || combinedText.includes('hà nội')) aliases.add('HN');
                if (combinedText.includes('thanh hoa') || combinedText.includes('thanh hóa')) aliases.add('TH');
                if (combinedText.includes('da nang') || combinedText.includes('đà nẵng')) aliases.add('DN');
                if (
                    combinedText.includes('hcm')
                    || combinedText.includes('hồ chí minh')
                    || combinedText.includes('ho chi minh')
                    || combinedText.includes('tp.hcm')
                ) {
                    aliases.add('TP.HCM');
                    aliases.add('HCM');
                }

                return Array.from(aliases);
            };

            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;

            const baseWarehouses = data || [];
            if (baseWarehouses.length === 0) {
                setWarehouses([]);
                setSelectedIds([]);
                return;
            }

            // Rebuild machine/cylinder counts from source tables to avoid stale values in UI cards
            const [{ data: machinesData }, { data: cylindersData }] = await Promise.all([
                supabase.from('machines').select('warehouse'),
                supabase.from('cylinders').select('warehouse_id')
            ]);

            const machineCountMap = new Map();
            (machinesData || []).forEach(m => {
                const key = (m.warehouse || '').toString().trim();
                if (!key) return;
                machineCountMap.set(key, (machineCountMap.get(key) || 0) + 1);
            });

            const cylinderCountMap = new Map();
            (cylindersData || []).forEach(c => {
                const key = (c.warehouse_id || '').toString().trim();
                if (!key) return;
                cylinderCountMap.set(key, (cylinderCountMap.get(key) || 0) + 1);
            });

            const warehousesWithCounts = baseWarehouses.map(w => {
                const aliases = buildWarehouseAliases(w);
                const machineCount = aliases.reduce((sum, key) => sum + (machineCountMap.get(key) || 0), 0);
                const cylinderCount = aliases.reduce((sum, key) => sum + (cylinderCountMap.get(key) || 0), 0);
                return {
                    ...w,
                    machine_count: machineCount,
                    cylinder_count: cylinderCount
                };
            });

            setWarehouses(warehousesWithCounts);
            setSelectedIds([]); // Clear selection on refresh
        } catch (error) {
            console.error('Error fetching warehouses:', error);
            alert('❌ Không thể tải danh sách kho hàng: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredWarehouses.length && filteredWarehouses.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredWarehouses.map(w => w.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} kho bãi đã chọn không? Thao tác này không thể hoàn tác.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('warehouses')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            alert(`🎉 Đã xóa thành công ${selectedIds.length} kho bãi!`);
            setSelectedIds([]);
            fetchWarehouses();
        } catch (error) {
            console.error('Error deleting warehouses:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'Tên kho',
            'Chi nhánh / Văn phòng đại diện',
            'Thủ kho',
            'Địa chỉ',
            'Sức chứa',
            'Trạng thái (Đang hoạt động / Tạm ngưng / Đóng cửa)',
        ];

        const exampleData = [
            {
                'Tên kho': 'Kho A - Hà Nội',
                'Chi nhánh / Văn phòng đại diện': 'Văn phòng Hà Nội',
                'Thủ kho': 'Nguyễn Văn Hoàn',
                'Địa chỉ': 'Thanh Xuân, Hà Nội',
                'Sức chứa': 5000,
                'Trạng thái (Đang hoạt động / Tạm ngưng / Đóng cửa)': 'Đang hoạt động',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Kho');
        XLSX.writeFile(wb, 'mau_import_kho_hang.xlsx');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('File Excel không có dữ liệu!');
                    return;
                }

                setIsLoading(true);

                const warehousesToInsert = data.map(row => ({
                    name: row['Tên kho']?.toString(),
                    branch_office: row['Chi nhánh / Văn phòng đại diện']?.toString(),
                    manager_name: row['Thủ kho']?.toString(),
                    address: row['Địa chỉ']?.toString(),
                    capacity: parseInt(row['Sức chứa']) || 0,
                    status: row['Trạng thái (Đang hoạt động / Tạm ngưng / Đóng cửa)']?.toString() || 'Đang hoạt động',
                    updated_at: new Date().toISOString()
                })).filter(w => w.name);

                if (warehousesToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu tên kho)!');
                    setIsLoading(false);
                    return;
                }

                const { error } = await supabase.from('warehouses').insert(warehousesToInsert);

                if (error) {
                    throw error;
                } else {
                    alert(`🎉 Đã import thành công ${warehousesToInsert.length} kho hàng!`);
                    fetchWarehouses();
                }
            } catch (err) {
                console.error('Error importing excel:', err);
                alert('Có lỗi xảy ra khi xử lý file: ' + err.message);
            } finally {
                setIsLoading(false);
                e.target.value = null; // Reset input
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDeleteWarehouse = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa kho "${name}" không? Dữ liệu liên quan có thể bị ảnh hưởng và không thể khôi phục.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('warehouses')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchWarehouses();
        } catch (error) {
            console.error('Error deleting warehouse:', error);
            alert('❌ Có lỗi xảy ra khi xóa kho: ' + error.message);
        }
    };

    const handleEditWarehouse = (warehouse) => {
        setSelectedWarehouse(warehouse);
        setIsFormModalOpen(true);
    };

    const handleViewWarehouse = (warehouse) => {
        setSelectedWarehouse(warehouse);
        setIsDetailsModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchWarehouses();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const filteredWarehouses = warehouses.filter(w => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (w.name?.toLowerCase().includes(search)) ||
            (w.manager_name?.toLowerCase().includes(search)) ||
            (w.address?.toLowerCase().includes(search))
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(w.status);
        const matchesManager = selectedManagers.length === 0 || selectedManagers.includes(w.manager_name);

        return matchesSearch && matchesStatus && matchesManager;
    });

    const filteredWarehousesCount = filteredWarehouses.length;
    const paginatedWarehouses = filteredWarehouses.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalCapacity = filteredWarehouses.reduce((sum, w) => sum + (w.capacity || 0), 0);
    const activeCount = filteredWarehouses.filter(w => w.status === 'Đang hoạt động').length;

    const hasActiveFilters = selectedStatuses.length > 0 || selectedManagers.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedManagers.length;

    const statusOptions = WAREHOUSE_STATUSES.map(status => ({
        id: status.id,
        label: status.label,
        count: warehouses.filter(x => x.status === status.id).length
    }));

    const managerOptions = uniqueManagers.map(name => ({
        id: name,
        label: name,
        count: warehouses.filter(x => x.manager_name === name).length
    }));

    const getStatusStats = () => {
        const stats = {};
        filteredWarehouses.forEach(warehouse => {
            const status = warehouse.status || 'Không xác định';
            stats[status] = (stats[status] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getManagerStats = () => {
        const stats = {};
        filteredWarehouses.forEach(warehouse => {
            const manager = warehouse.manager_name || 'Không xác định';
            stats[manager] = (stats[manager] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCapacityStats = () => {
        return filteredWarehouses
            .map(w => ({ name: w.name || 'Không tên', value: w.capacity || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedManagers([]);
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'statuses':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            case 'managers':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'statuses':
                return 'bg-emerald-600 text-white';
            case 'managers':
                return 'bg-cyan-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'statuses':
                return isActive ? 'text-emerald-700' : 'text-emerald-600';
            case 'managers':
                return isActive ? 'text-cyan-700' : 'text-cyan-600';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Tạm ngưng': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Đóng cửa': return 'bg-rose-50 text-rose-500 border-rose-100';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getRowStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động':
                return 'hover:bg-emerald-50/60';
            case 'Tạm ngưng':
                return 'hover:bg-amber-50/60';
            case 'Đóng cửa':
                return 'hover:bg-rose-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getNameCellClass = (status) => clsx(
        'px-4 py-4 whitespace-nowrap text-sm font-semibold text-foreground border-r border-primary/20 border-l-4',
        status === 'Đang hoạt động' && 'border-l-emerald-400',
        status === 'Tạm ngưng' && 'border-l-amber-400',
        status === 'Đóng cửa' && 'border-l-rose-400',
        !status && 'border-l-primary/50'
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={14} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={14} /> },
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
                                {isAdminOrManager && (
                                    <div className="relative">
                                        <button
                                            id="more-actions-btn-warehouses"
                                            onClick={() => setShowMoreActions(!showMoreActions)}
                                            className={clsx(
                                                "p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                                showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                            )}
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {showMoreActions && (
                                            <div id="more-actions-menu-warehouses" className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                                <div
                                                    role="button"
                                                    onClick={() => { downloadTemplate(); setShowMoreActions(false); }}
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
                                )}

                                {isAdminOrManager && (
                                    <button
                                        onClick={() => {
                                            setSelectedWarehouse(null);
                                            setIsFormModalOpen(true);
                                        }}
                                        className="p-2 rounded-xl bg-primary text-white shadow-md shadow-primary/25 active:scale-95 transition-all shrink-0"
                                    >
                                        <Plus size={20} />
                                    </button>
                                )}
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-bold text-slate-600">
                                            Đã chọn <span className="text-primary">{selectedIds.length}</span> kho
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleBulkDelete} className="text-[12px] font-black text-rose-500 hover:text-rose-600 px-2 py-1 flex items-center gap-1.5 active:scale-95">
                                            <Trash2 size={14} /> Xóa
                                        </button>
                                        <button onClick={toggleSelectAll} className="text-[12px] font-bold text-primary hover:underline px-2 py-1 ml-1 border-l border-slate-200">
                                            Bỏ chọn
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />

                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-4 flex flex-col gap-3 bg-muted/5">
                        {isLoading ? (
                            <div className="py-20 text-center italic text-muted-foreground animate-pulse">Đang tải dữ liệu...</div>
                        ) : paginatedWarehouses.length === 0 ? (
                            <div className="py-20 text-center italic text-muted-foreground flex flex-col items-center gap-2">
                                <Warehouse size={32} className="text-slate-300 opacity-80" />
                                <span>Không tìm thấy kho hàng nào</span>
                            </div>
                        ) : (
                            paginatedWarehouses.map((w, index) => {
                                const globalIndex = (currentPage - 1) * pageSize + index;
                                const machineCount = Number(w.machine_count || 0);
                                const cylinderCount = Number(w.cylinder_count || 0);
                                return (
                                    <div
                                        key={w.id}
                                        className={clsx(
                                            "rounded-xl border bg-white p-3.5 shadow-[0_4px_16px_rgba(25,27,35,0.04)] transition-all",
                                            selectedIds.includes(w.id)
                                                ? "border-primary ring-1 ring-primary/20 bg-primary/[0.03]"
                                                : "border-slate-200"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(w.id)}
                                                    onChange={() => toggleSelectOne(w.id)}
                                                    className="mt-1 w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-primary-container bg-primary/10 px-1.5 py-0.5 rounded text-[9px]">#{globalIndex + 1}</span>
                                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-tight', getStatusStyle(w.status))}>
                                                            {w.status || 'Không xác định'}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-extrabold text-[14px] text-foreground tracking-tight mt-1 leading-tight">{w.name}</h3>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-muted-foreground flex items-start gap-1 mt-0.5 mb-2">
                                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span className="line-clamp-1">{w.address || '—'}</span>
                                        </p>

                                        <div className="bg-slate-50 rounded-lg p-2 mb-2.5 flex items-center justify-between border border-slate-200/70">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1">
                                                    <Warehouse className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="font-bold text-[11px] text-foreground">{formatNumber(machineCount)} Máy</span>
                                                </div>
                                                <div className="flex items-center gap-1 border-l border-slate-300 pl-3">
                                                    <User className="w-3.5 h-3.5 text-orange-500" />
                                                    <span className="font-bold text-[11px] text-foreground">{formatNumber(cylinderCount)} Bình</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-tight">Sức chứa</span>
                                        </div>

                                        <div className="text-[11px] text-slate-600 mb-2.5">
                                            <span className="font-semibold">Thủ kho:</span> <span className="font-bold text-foreground">{w.manager_name || '—'}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleViewWarehouse(w)}
                                                className="flex-1 py-1.5 bg-slate-100 text-primary font-bold text-[11px] rounded-md hover:bg-slate-200 transition-colors active:scale-[0.98]"
                                            >
                                                Chi tiết
                                            </button>
                                            {isAdminOrManager && (
                                                <button
                                                    onClick={() => handleEditWarehouse(w)}
                                                    className="flex-1 py-1.5 bg-primary text-white font-bold text-[11px] rounded-md shadow-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                                                >
                                                    Sửa
                                                </button>
                                            )}
                                            {isAdminOrManager && (
                                                <button
                                                    onClick={() => handleDeleteWarehouse(w.id, w.name)}
                                                    className="px-2.5 py-1.5 rounded-md border border-rose-100 text-rose-500 hover:bg-rose-50 transition-all active:scale-[0.98]"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="block md:hidden border-t border-border mt-auto">
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            totalRecords={filteredWarehouses.length}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                        />
                    </div>

                    <div className="hidden md:block p-4 space-y-4">
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
                                        setSelectedWarehouse(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>

                                <button
                                    onClick={downloadTemplate}
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

                        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'statuses' ? null : 'statuses')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <Filter size={14} className={getFilterIconClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('statuses'))}>
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'statuses' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'statuses' && (
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'managers' ? null : 'managers')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)
                                    )}
                                >
                                    <User size={14} className={getFilterIconClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)} />
                                    Thủ kho
                                    {selectedManagers.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managers'))}>
                                            {selectedManagers.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managers' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'managers' && (
                                    <FilterDropdown
                                        options={managerOptions}
                                        selected={selectedManagers}
                                        setSelected={setSelectedManagers}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto border-t border-primary/20">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    <th className="w-12 px-4 py-3.5 text-center border-r border-primary/30">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredWarehouses.length && filteredWarehouses.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th key={col.key} className={clsx('px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide', col.key === 'name' && 'border-l border-r border-primary/30')}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredWarehouses.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy kho hàng nào
                                        </td>
                                    </tr>
                                ) : paginatedWarehouses.map((w) => (
                                    <tr key={w.id} className={clsx(
                                        getRowStyle(w.status),
                                        selectedIds.includes(w.id) && "bg-primary/[0.04]"
                                    )}>
                                        <td className="w-12 px-4 py-4 text-center border-r border-primary/20">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(w.id)}
                                                onChange={() => toggleSelectOne(w.id)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </td>
                                        {visibleTableColumns.map(col => {
                                            if (col.key === 'name') {
                                                return <td key={col.key} className={getNameCellClass(w.status)}>{w.name}</td>;
                                            }
                                            if (col.key === 'status') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4">
                                                        <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border', getStatusStyle(w.status))}>
                                                            {w.status || 'Không xác định'}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'capacity') {
                                                return <td key={col.key} className="px-4 py-4 text-sm font-semibold text-foreground">{formatNumber(w.capacity || 0)}</td>;
                                            }
                                            return <td key={col.key} className="px-4 py-4 text-sm text-muted-foreground">{w[col.key] || '—'}</td>;
                                        })}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewWarehouse(w)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleEditWarehouse(w)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteWarehouse(w.id, w.name)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5 mt-auto">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>{filteredWarehouses.length > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredWarehouses.length)}` : '0'} / Tổng {filteredWarehouses.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{formatNumber(totalCapacity)} sức chứa</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">{activeCount} hoạt động</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage(1)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage === 1} title="Trang đầu">
                                <ChevronLeft size={16} />
                                <ChevronLeft size={16} className="-ml-2.5" />
                            </button>
                            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage === 1} title="Trang trước">
                                <ChevronLeft size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                                {currentPage}
                            </div>
                            <button onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredWarehouses.length / pageSize), prev + 1))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage >= Math.ceil(filteredWarehouses.length / pageSize)} title="Trang sau">
                                <ChevronRight size={16} />
                            </button>
                            <button onClick={() => setCurrentPage(Math.ceil(filteredWarehouses.length / pageSize))} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20" disabled={currentPage >= Math.ceil(filteredWarehouses.length / pageSize)} title="Trang cuối">
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
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border glass-header sticky top-0 z-30">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 active:scale-95 transition-all shadow-sm"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê</h2>
                            <button
                                onClick={openMobileFilter}
                                className={clsx(
                                    'relative p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm',
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600',
                                )}
                            >
                                <Filter size={18} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-white">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="hidden md:block p-4 border-b border-border" ref={dropdownRef}>
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'statuses' ? null : 'statuses')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className={getFilterIconClass('statuses', activeDropdown === 'statuses' || selectedStatuses.length > 0)} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('statuses'))}>
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'statuses' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'statuses' && (
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'managers' ? null : 'managers')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('managers', activeDropdown === 'managers' || selectedManagers.length > 0)} />
                                        Thủ kho
                                        {selectedManagers.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managers'))}>
                                                {selectedManagers.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managers' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'managers' && (
                                        <FilterDropdown
                                            options={managerOptions}
                                            selected={selectedManagers}
                                            setSelected={setSelectedManagers}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm col-span-2 md:col-span-1">
                                    <div className="flex flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                            <Warehouse name="Warehouse" className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng kho</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(filteredWarehousesCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50/70 border border-green-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12  bg-green-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-green-200/70">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-green-600 uppercase tracking-wider">Tổng sức chứa</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(totalCapacity)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12  bg-orange-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-orange-200/70">
                                            <Filter className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Hoạt động</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(activeCount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Trạng thái</h3>
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
                                                plugins: { legend: { position: 'bottom' } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Thủ kho</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getManagerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số kho',
                                                    data: getManagerStats().map(item => item.value),
                                                    backgroundColor: chartColors[0],
                                                    borderColor: chartColors[0],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                indexAxis: 'y',
                                                plugins: { legend: { display: false } },
                                                scales: { x: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 kho theo Sức chứa</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCapacityStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Sức chứa',
                                                    data: getCapacityStats().map(item => item.value),
                                                    backgroundColor: chartColors[1],
                                                    borderColor: chartColors[1],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { display: false },
                                                    tooltip: {
                                                        callbacks: {
                                                            label: (context) => `${formatNumber(context.parsed.y)} vỏ bình`
                                                        }
                                                    }
                                                },
                                                scales: {
                                                    y: {
                                                        beginAtZero: true,
                                                        ticks: {
                                                            callback: (value) => formatNumber(value)
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

            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    isClosing={mobileFilterClosing}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    sections={[
                        {
                            id: 'statuses',
                            label: 'Trạng thái',
                            icon: <Filter size={16} className="text-emerald-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'managers',
                            label: 'Thủ kho',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: managerOptions,
                            selectedValues: pendingManagers,
                            onSelectionChange: setPendingManagers,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <WarehouseFormModal
                    warehouse={selectedWarehouse}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedWarehouse && (
                <WarehouseDetailsModal
                    warehouse={selectedWarehouse}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Warehouses;