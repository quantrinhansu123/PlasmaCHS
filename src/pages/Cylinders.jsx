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
    ActivitySquare,
    BarChart2,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Eye,
    Filter,
    LayoutGrid,
    List,
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import CylinderDetailsModal from '../components/Cylinders/CylinderDetailsModal';
import CylinderFormModal from '../components/Cylinders/CylinderFormModal';
import CylinderQCDialog from '../components/Cylinders/CylinderQCDialog';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { CYLINDER_STATUSES, CYLINDER_VOLUMES } from '../constants/machineConstants';
import usePermissions from '../hooks/usePermissions';
import { isAdminRole, isThuKhoRole, isWarehouseRole } from '../utils/accessControl';
import {
    buildCylinderWarehouseScopeKeys,
    canViewAllWarehouses,
    cylinderMatchesManagingWarehouseFilter,
    expandCylinderWarehouseSelectionKeys,
    filterWarehousesForCurrentUser,
    getCylinderManagingWarehouseDisplayName,
    resolveWarehouseRecordsFromSelection,
} from '../utils/orderWarehouseScope';
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

function locationLabelHash(label) {
    const s = String(label || '');
    let h = 0;
    for (let i = 0; i < s.length; i += 1) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function getLocationKanbanColumnHeaderClass(label) {
    if (!label || label === '—') return 'bg-slate-100 text-slate-800 border-slate-200';
    const palettes = [
        'bg-indigo-50 text-indigo-900 border-indigo-100',
        'bg-emerald-50 text-emerald-900 border-emerald-100',
        'bg-violet-50 text-violet-900 border-violet-100',
        'bg-amber-50 text-amber-900 border-amber-100',
        'bg-sky-50 text-sky-900 border-sky-100',
        'bg-rose-50 text-rose-900 border-rose-100',
    ];
    return palettes[locationLabelHash(label) % palettes.length];
}

function getLocationKanbanCardAccentClass(label) {
    if (!label || label === '—') return 'border-l-slate-400';
    const accents = [
        'border-l-indigo-400',
        'border-l-emerald-400',
        'border-l-violet-400',
        'border-l-amber-400',
        'border-l-sky-400',
        'border-l-rose-400',
    ];
    return accents[locationLabelHash(label) % accents.length];
}

function getStatusKanbanColumnHeaderClass(statusId) {
    switch (statusId) {
        case 'sẵn sàng':
            return 'bg-emerald-50 text-emerald-900 border-emerald-100';
        case 'đang sử dụng':
        case 'đã sử dụng':
        case 'thuộc khách hàng':
            return 'bg-sky-50 text-sky-900 border-sky-100';
        case 'đang vận chuyển':
            return 'bg-indigo-50 text-indigo-900 border-indigo-100';
        case 'chờ nạp':
        case 'bình rỗng':
            return 'bg-amber-50 text-amber-900 border-amber-100';
        case 'hỏng':
            return 'bg-rose-50 text-rose-900 border-rose-100';
        case 'đã trả ncc':
            return 'bg-orange-50 text-orange-900 border-orange-100';
        default:
            return 'bg-slate-50 text-slate-800 border-slate-200';
    }
}

function getStatusKanbanCardAccentClass(statusId) {
    switch (statusId) {
        case 'sẵn sàng':
            return 'border-l-emerald-400';
        case 'đang sử dụng':
        case 'đã sử dụng':
        case 'thuộc khách hàng':
            return 'border-l-sky-400';
        case 'đang vận chuyển':
            return 'border-l-indigo-400';
        case 'chờ nạp':
        case 'bình rỗng':
            return 'border-l-amber-400';
        case 'hỏng':
            return 'border-l-rose-400';
        case 'đã trả ncc':
            return 'border-l-orange-400';
        default:
            return 'border-l-slate-400';
    }
}

const TABLE_COLUMNS = [
    { key: 'serial_number', label: 'Mã RFID (Serial)' },
    { key: 'cylinder_code', label: 'Mã bình khắc' },
    { key: 'volume', label: 'Thể tích / Loại bình' },
    { key: 'customer_name', label: 'Khách hàng' },
    { key: 'department', label: 'Vị trí' },
    { key: 'warehouse', label: 'Kho Quản Lý' },
    { key: 'supplier_ncc', label: 'NCC nhận vỏ' },
    { key: 'status', label: 'Trạng Thái' },
    { key: 'expiry_date', label: 'Hạn kiểm định' },
];

const CATEGORY_OPTIONS = [
    { id: 'BV', label: 'BV' },
    { id: 'TM', label: 'TM' },
];

const Cylinders = () => {
    const { role, user, department, loading: permissionsLoading } = usePermissions();
    const canManageCylinders = isAdminRole(role);
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    /** Kanban: nhóm cột theo vị trí (cột «Vị trí») hoặc theo trạng thái — chọn bằng sổ xuống trên view Kanban */
    const [kanbanGroupBy, setKanbanGroupBy] = useState('location');
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cylinders, setCylinders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQCModalOpen, setIsQCModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCylinder, setSelectedCylinder] = useState(null);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [bulkAssignWarehouseId, setBulkAssignWarehouseId] = useState('');
    const [bulkAssignVolume, setBulkAssignVolume] = useState('');

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedVolumes, setSelectedVolumes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueVolumes, setUniqueVolumes] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    /** id → name: dùng khi join suppliers trên cylinders trả null (RLS/legacy) */
    const [supplierIdToName, setSupplierIdToName] = useState({});

    const NO_MANAGING_WAREHOUSE_MATCH = '__NO_MANAGING_WAREHOUSE__';

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRecords, setTotalRecords] = useState(0);
    const [stats, setStats] = useState({
        ready: 0,
        inUse: 0,
        empty: 0,
        total: 0
    });
    const [allMetadata, setAllMetadata] = useState([]); // For stats and charts

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingVolumes, setPendingVolumes] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingCategories, setPendingCategories] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const filterAnchorRef = useRef(null);
    const columnPickerRef = useRef(null);

    const toggleFilterDropdown = (key, event) => {
        filterAnchorRef.current = event.currentTarget;
        setActiveDropdown((current) => (current === key ? null : key));
    };

    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_cylinders_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_cylinders') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    /** NVK / Thủ kho: chỉ xem bình có Kho Quản Lý trùng tên kho mình quản lý. */
    const shouldScopeByManagingWarehouse = useMemo(
        () => Boolean(role) && !canViewAllWarehouses(role) && (isThuKhoRole(role) || isWarehouseRole(role)),
        [role],
    );

    const managedWarehouses = useMemo(() => {
        if (!shouldScopeByManagingWarehouse) return warehousesList;
        return filterWarehousesForCurrentUser(warehousesList, { role, user, department });
    }, [warehousesList, role, user, department, shouldScopeByManagingWarehouse]);

    const warehouseAssignOptions = useMemo(() => {
        const catalog = (shouldScopeByManagingWarehouse && managedWarehouses.length > 0)
            ? managedWarehouses
            : warehousesList;
        return (catalog || [])
            .filter((warehouse) => String(warehouse?.name || '').trim())
            .map((warehouse) => ({ id: warehouse.id, name: warehouse.name }));
    }, [shouldScopeByManagingWarehouse, managedWarehouses, warehousesList]);

    const volumeAssignOptions = useMemo(() => {
        const fromCatalog = CYLINDER_VOLUMES.map((item) => ({ id: item.id, label: item.label }));
        const knownIds = new Set(fromCatalog.map((item) => item.id));
        const extras = (uniqueVolumes || [])
            .filter((value) => value && !knownIds.has(value))
            .map((value) => ({ id: value, label: value }));
        return [...fromCatalog, ...extras];
    }, [uniqueVolumes]);

    const managingWarehouseKeys = useMemo(() => {
        if (!shouldScopeByManagingWarehouse) return [];
        if (!managedWarehouses.length) return [NO_MANAGING_WAREHOUSE_MATCH];
        return buildCylinderWarehouseScopeKeys(managedWarehouses);
    }, [managedWarehouses, shouldScopeByManagingWarehouse]);

    const activeManagingWarehouseIds = useMemo(() => {
        const warehouseCatalog = shouldScopeByManagingWarehouse ? managedWarehouses : warehousesList;
        if (selectedWarehouses.length > 0) {
            return expandCylinderWarehouseSelectionKeys(selectedWarehouses, warehouseCatalog);
        }
        if (shouldScopeByManagingWarehouse) {
            return managingWarehouseKeys;
        }
        return [];
    }, [
        selectedWarehouses,
        shouldScopeByManagingWarehouse,
        managedWarehouses,
        warehousesList,
        managingWarehouseKeys,
    ]);

    const activeManagingWarehouseRecords = useMemo(() => {
        const warehouseCatalog = shouldScopeByManagingWarehouse ? managedWarehouses : warehousesList;
        if (selectedWarehouses.length > 0) {
            return resolveWarehouseRecordsFromSelection(selectedWarehouses, warehouseCatalog);
        }
        if (shouldScopeByManagingWarehouse) {
            return managedWarehouses;
        }
        return [];
    }, [
        selectedWarehouses,
        shouldScopeByManagingWarehouse,
        managedWarehouses,
        warehousesList,
    ]);

    const applyWarehouseFiltersToQuery = (query) => {
        if (activeManagingWarehouseIds.length > 0) {
            return query.in('warehouse_id', activeManagingWarehouseIds);
        }
        return query;
    };

    const applyCylinderListFiltersToQuery = (query) => {
        if (searchTerm) {
            query = query.or(`serial_number.ilike.%${searchTerm}%,volume.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
        }
        if (selectedStatuses.length > 0) {
            query = query.in('status', selectedStatuses);
        }
        if (selectedVolumes.length > 0) {
            query = query.in('volume', selectedVolumes);
        }
        if (selectedCustomers.length > 0) {
            query = query.in('customer_name', selectedCustomers);
        }
        if (selectedCategories.length > 0) {
            query = query.in('category', selectedCategories);
        }
        return applyWarehouseFiltersToQuery(query);
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [activeManagingWarehouseIds.join('|')]);

    useEffect(() => {
        fetchFilterOptions();
    }, [role, user, department]);

    useEffect(() => {
        if (permissionsLoading) return;
        if (shouldScopeByManagingWarehouse && warehousesList.length === 0) return;
        fetchCylinders();
        fetchGlobalStats();
        fetchMetadataForCharts();
    }, [
        currentPage,
        searchTerm,
        selectedStatuses,
        selectedVolumes,
        selectedCustomers,
        selectedCategories,
        selectedWarehouses,
        activeManagingWarehouseIds,
        managedWarehouses,
        shouldScopeByManagingWarehouse,
        warehousesList,
        permissionsLoading,
        role,
        user,
        department,
    ]);

    const fetchMetadataForCharts = async () => {
        try {
            let query = supabase
                .from('cylinders')
                .select('status, volume, customer_name, category, warehouse_id');

            if (searchTerm) {
                query = query.or(`serial_number.ilike.%${searchTerm}%,volume.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
            }
            if (selectedStatuses.length > 0) query = query.in('status', selectedStatuses);
            if (selectedVolumes.length > 0) query = query.in('volume', selectedVolumes);
            if (selectedCustomers.length > 0) query = query.in('customer_name', selectedCustomers);
            if (selectedCategories.length > 0) query = query.in('category', selectedCategories);

            query = applyWarehouseFiltersToQuery(query);

            const { data } = await query;
            if (data) setAllMetadata(data);
        } catch (err) {
            console.error('Error fetching metadata for charts:', err);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            // Lấy danh sách volume (thể tích) trực tiếp không qua RPC để tránh báo lỗi đỏ trong console
            const { data: volData } = await supabase.from('cylinders').select('volume').not('volume', 'is', null);
            if (volData) setUniqueVolumes([...new Set(volData.map(d => d.volume))]);

            // Fetch unique customers
            const { data: custData } = await supabase.from('customers').select('name').order('name');
            if (custData) {
                setUniqueCustomers(custData.map((c) => c.name).filter(Boolean));
            }

            const { data: whData } = await supabase
                .from('warehouses')
                .select('id, name, code, branch_office, manager_name')
                .order('name');
            if (whData) setWarehousesList(whData);

            const { data: supRows } = await supabase.from('suppliers').select('id, name');
            if (supRows?.length) {
                const map = {};
                supRows.forEach((s) => {
                    map[s.id] = s.name;
                });
                setSupplierIdToName(map);
            }
        } catch (err) {
            console.error('Error fetching filter options:', err);
        }
    };

    const fetchGlobalStats = async () => {
        try {
            let queries = {
                total: supabase.from('cylinders').select('*', { count: 'exact', head: true }),
                ready: supabase.from('cylinders').select('*', { count: 'exact', head: true }).eq('status', 'sẵn sàng'),
                inUse: supabase.from('cylinders').select('*', { count: 'exact', head: true }).in('status', ['đang sử dụng', 'thuộc khách hàng']),
                empty: supabase.from('cylinders').select('*', { count: 'exact', head: true }).in('status', ['bình rỗng', 'chờ nạp'])
            };

            Object.keys(queries).forEach(key => {
                if (searchTerm) {
                    queries[key] = queries[key].or(`serial_number.ilike.%${searchTerm}%,volume.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
                }
                if (key === 'total') {
                    if (selectedStatuses.length > 0) queries[key] = queries[key].in('status', selectedStatuses);
                }
                if (selectedVolumes.length > 0) queries[key] = queries[key].in('volume', selectedVolumes);
                if (selectedCustomers.length > 0) queries[key] = queries[key].in('customer_name', selectedCustomers);
                if (selectedCategories.length > 0) queries[key] = queries[key].in('category', selectedCategories);
                queries[key] = applyWarehouseFiltersToQuery(queries[key]);
            });

            const [totalRes, readyRes, inUseRes, emptyRes] = await Promise.all([
                queries.total,
                queries.ready,
                queries.inUse,
                queries.empty
            ]);

            setStats({
                total: totalRes.count || 0,
                ready: readyRes.count || 0,
                inUse: inUseRes.count || 0,
                empty: emptyRes.count || 0
            });
        } catch (err) {
            console.error('Error fetching global stats:', err);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest('[data-cylinder-filter-root]')) {
                return;
            }
            setActiveDropdown(null);
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            // Close more actions menu on mobile
            if (showMoreActions) {
                const moreActionsMenu = document.getElementById('more-actions-menu-cylinders');
                const moreActionsButton = document.getElementById('more-actions-button-cylinders');
                if (moreActionsMenu && !moreActionsMenu.contains(event.target) && 
                    moreActionsButton && !moreActionsButton.contains(event.target)) {
                    setShowMoreActions(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, showColumnPicker]);

    useEffect(() => {
        localStorage.setItem('columns_cylinders', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_cylinders_order', JSON.stringify(columnOrder));
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
        setPendingVolumes(selectedVolumes);
        setPendingCustomers(selectedCustomers);
        setPendingCategories(selectedCategories);
        setPendingWarehouses(selectedWarehouses);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedVolumes(pendingVolumes);
        setSelectedCustomers(pendingCustomers);
        setSelectedCategories(pendingCategories);
        setSelectedWarehouses(pendingWarehouses);
        closeMobileFilter();
    };

    const fetchCylinders = async () => {
        setIsLoading(true);
        try {
            if (shouldScopeByManagingWarehouse && warehousesList.length > 0 && managedWarehouses.length === 0) {
                setCylinders([]);
                setTotalRecords(0);
                setSelectedIds([]);
                return;
            }

            let query = supabase
                .from('cylinders')
                .select('*, warehouses(id, name), customers(name), suppliers(id, name)', { count: 'exact' });

            query = applyCylinderListFiltersToQuery(query);

            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error && error.code !== '42P01') throw error;
            setCylinders(data || []);
            setTotalRecords(count ?? data?.length ?? 0);
            setSelectedIds([]); // Clear selection on refresh
        } catch (error) {
            console.error('Error fetching cylinders:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCylinders.length && filteredCylinders.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCylinders.map(c => c.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} bình khí đã chọn không? Thao tác này không thể hoàn tác.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('cylinders')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            alert(`🎉 Đã xóa thành công ${selectedIds.length} bình khí!`);
            setSelectedIds([]);
            fetchCylinders();
            fetchGlobalStats();
            fetchMetadataForCharts();
        } catch (error) {
            console.error('Error deleting cylinders:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAllFilteredCylinders = async () => {
        if (!canManageCylinders) return;
        if (totalRecords === 0) {
            alert('Không có bình nào để xóa.');
            return;
        }

        const scopeLabel = hasActiveFilters ? 'theo bộ lọc hiện tại' : 'trong danh sách';
        if (!window.confirm(
            `Bạn có chắc muốn XÓA HẾT ${totalRecords} bình ${scopeLabel}?\n\nThao tác này không thể hoàn tác.`,
        )) {
            return;
        }
        if (!window.confirm('Xác nhận lần cuối: Xóa toàn bộ danh sách bình này?')) {
            return;
        }

        try {
            setIsLoading(true);

            let selectQuery = supabase.from('cylinders').select('id');
            selectQuery = applyCylinderListFiltersToQuery(selectQuery);
            const { data: rows, error: fetchError } = await selectQuery;
            if (fetchError) throw fetchError;

            const ids = (rows || []).map((row) => row.id).filter(Boolean);
            if (!ids.length) {
                alert('Không có bình nào để xóa.');
                return;
            }

            const BATCH_SIZE = 200;
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const batch = ids.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('cylinders').delete().in('id', batch);
                if (error) throw error;
            }

            alert(`Đã xóa ${ids.length} bình khí.`);
            setSelectedIds([]);
            setCurrentPage(1);
            fetchCylinders();
            fetchGlobalStats();
            fetchMetadataForCharts();
        } catch (error) {
            console.error('Error deleting all cylinders:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkAssignWarehouse = async () => {
        if (!canManageCylinders) return;
        if (!bulkAssignWarehouseId) {
            alert('Vui lòng chọn kho trong danh sách.');
            return;
        }
        if (totalRecords === 0) {
            alert('Không có bình nào để gán kho.');
            return;
        }

        const warehouse = warehousesList.find((item) => String(item.id) === String(bulkAssignWarehouseId));
        const warehouseName = warehouse?.name || 'kho đã chọn';
        const scopeLabel = hasActiveFilters ? 'theo bộ lọc hiện tại' : 'trong danh sách';

        if (!window.confirm(
            `Gán kho "${warehouseName}" cho tất cả bình ${scopeLabel}?\n\n(Bỏ qua bình đã trả NCC)`,
        )) {
            return;
        }

        try {
            setIsLoading(true);

            let selectQuery = supabase
                .from('cylinders')
                .select('id')
                .neq('status', 'đã trả ncc');
            selectQuery = applyCylinderListFiltersToQuery(selectQuery);
            const { data: rows, error: fetchError } = await selectQuery;
            if (fetchError) throw fetchError;

            const ids = (rows || []).map((row) => row.id).filter(Boolean);
            if (!ids.length) {
                alert('Không có bình phù hợp để gán kho.');
                return;
            }

            const updatedAt = new Date().toISOString();
            const BATCH_SIZE = 200;
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const batch = ids.slice(i, i + BATCH_SIZE);
                const { error } = await supabase
                    .from('cylinders')
                    .update({ warehouse_id: bulkAssignWarehouseId, updated_at: updatedAt })
                    .in('id', batch);
                if (error) throw error;
            }

            alert(`Đã gán kho "${warehouseName}" cho ${ids.length} bình.`);
            fetchCylinders();
            fetchGlobalStats();
            fetchMetadataForCharts();
        } catch (error) {
            console.error('Error bulk assigning warehouse:', error);
            alert('❌ Có lỗi xảy ra khi gán kho: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkAssignVolume = async () => {
        if (!canManageCylinders) return;
        if (!bulkAssignVolume) {
            alert('Vui lòng chọn loại bình.');
            return;
        }
        if (totalRecords === 0) {
            alert('Không có bình nào để điền loại bình.');
            return;
        }

        const volumeLabel = volumeAssignOptions.find((item) => item.id === bulkAssignVolume)?.label
            || bulkAssignVolume;
        const scopeLabel = hasActiveFilters ? 'theo bộ lọc hiện tại' : 'trong danh sách';

        if (!window.confirm(
            `Điền loại bình "${volumeLabel}" cho tất cả bình ${scopeLabel}?\n\n(Bỏ qua bình đã trả NCC)`,
        )) {
            return;
        }

        try {
            setIsLoading(true);

            let selectQuery = supabase
                .from('cylinders')
                .select('id')
                .neq('status', 'đã trả ncc');
            selectQuery = applyCylinderListFiltersToQuery(selectQuery);
            const { data: rows, error: fetchError } = await selectQuery;
            if (fetchError) throw fetchError;

            const ids = (rows || []).map((row) => row.id).filter(Boolean);
            if (!ids.length) {
                alert('Không có bình phù hợp để điền loại bình.');
                return;
            }

            const updatedAt = new Date().toISOString();
            const BATCH_SIZE = 200;
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const batch = ids.slice(i, i + BATCH_SIZE);
                const { error } = await supabase
                    .from('cylinders')
                    .update({ volume: bulkAssignVolume, updated_at: updatedAt })
                    .in('id', batch);
                if (error) throw error;
            }

            alert(`Đã điền loại bình "${volumeLabel}" cho ${ids.length} bình.`);
            fetchCylinders();
            fetchGlobalStats();
            fetchMetadataForCharts();
        } catch (error) {
            console.error('Error bulk assigning volume:', error);
            alert('❌ Có lỗi xảy ra khi điền loại bình: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCylinder = async (id, serialNumber) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa bình khí có mã ${serialNumber} này không? Chú ý: Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('cylinders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCylinders();
        } catch (error) {
            console.error('Error deleting cylinder:', error);
            alert('❌ Có lỗi xảy ra khi xóa bình khí: ' + error.message);
        }
    };

    const handleEditCylinder = (cylinder) => {
        setSelectedCylinder(cylinder);
        setIsFormModalOpen(true);
    };

    const handleViewCylinder = (cylinder) => {
        setSelectedCylinder(cylinder);
        setIsDetailsModalOpen(true);
    };

    const handleViewWarehouse = (cylinder) => {
        const warehouseId = cylinder?.warehouse_id || cylinder?.warehouses?.id;
        if (!warehouseId) {
            alert('Bình này chưa có kho quản lý để xem chi tiết.');
            return;
        }
        navigate(`/kho/danh-sach?warehouseId=${warehouseId}`);
    };

    const handleFormSubmitSuccess = () => {
        fetchCylinders();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const downloadTemplate = () => {
        const headers = [
            'Mã RFID (Serial)',
            'Mã bình khắc',
            'Thể tích',
            'Loại khí',
            'Loại van',
            'Loại quai',
            'Phân loại (BV/TM)',
            'Khối lượng tịnh (kg)',
            'Kho quản lý',
            'Trạng thái',
            'Hạn kiểm định',
            'Khách hàng',
        ];

        const exampleData = [
            {
                'Mã RFID (Serial)': 'RFID0001',
                'Mã bình khắc': 'P0001',
                'Thể tích': 'bình 4L/ CGA870',
                'Loại khí': 'O2',
                'Loại van': 'Van Messer/Phi 6/ CB Trắng',
                'Loại quai': 'Có quai',
                'Phân loại (BV/TM)': 'BV',
                'Khối lượng tịnh (kg)': '8',
                'Kho quản lý': managedWarehouses[0]?.name || warehousesList[0]?.name || 'Kho tổng',
                'Trạng thái': 'sẵn sàng',
                'Hạn kiểm định': '2026-12-31',
                'Khách hàng': 'Phòng khám đa khoa VH',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Bình');
        XLSX.writeFile(wb, 'mau_import_binh_khi.xlsx');
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

                // Fetch all warehouses to map names for Kho Quản Lý
                const { data: warehouses } = await supabase.from('warehouses').select('id, name');
                const warehouseMap = (warehouses || []).reduce((acc, w) => {
                    if (w?.name) acc[w.name.toLowerCase()] = w.name;
                    return acc;
                }, {});

                // Fetch all customers to map names to IDs
                const { data: customers } = await supabase.from('customers').select('id, name');
                const customerMap = (customers || []).reduce((acc, c) => {
                    acc[c.name.toLowerCase()] = c.id;
                    return acc;
                }, {});

                const cylindersToInsert = data.map(row => {
                    // Try to find status value regardless of header case
                    const statusKey = Object.keys(row).find(k => k.toLowerCase() === 'trạng thái');
                    const statusVal = statusKey ? row[statusKey]?.toString().trim() : null;

                    let cylinderStatus = 'sẵn sàng';

                    if (statusVal) {
                        const foundStatus = CYLINDER_STATUSES.find(s =>
                            s.label.toLowerCase() === statusVal.toLowerCase() ||
                            s.id.toLowerCase() === statusVal.toLowerCase()
                        );
                        cylinderStatus = foundStatus ? foundStatus.id : statusVal.toLowerCase();
                    }

                    const custName = row['Khách hàng']?.toString();
                    const custId = customerMap[custName?.toLowerCase()] || null;

                    return {
                        serial_number: row['Mã RFID (Serial)']?.toString(),
                        cylinder_code: row['Mã bình khắc']?.toString() || null,
                        volume: row['Thể tích']?.toString(),
                        gas_type: row['Loại khí']?.toString() || 'AirMAC',
                        valve_type: row['Loại van']?.toString() || 'Van Messer/Phi 6/ CB Trắng',
                        handle_type: row['Loại quai']?.toString() || 'Có quai',
                        category: row['Phân loại (BV/TM)']?.toString() || 'BV',
                        net_weight: row['Khối lượng tịnh (kg)']?.toString() || '8',
                        status: cylinderStatus,
                        warehouse_id: warehouseMap[row['Kho quản lý']?.toString()?.toLowerCase()] || null,
                        customer_id: custId,
                        customer_name: custName || null,
                        expiry_date: row['Hạn kiểm định']?.toString() || null
                    };
                }).filter(c => c.serial_number);

                if (cylindersToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu mã RFID)!');
                    setIsLoading(false);
                    return;
                }

                // Use upsert to handle duplicates and updates
                const { error } = await supabase
                    .from('cylinders')
                    .upsert(cylindersToInsert, {
                        onConflict: 'serial_number',
                        ignoreDuplicates: false
                    });

                if (error) {
                    throw error;
                } else {
                    alert(`🎉 Đã xử lý thành công ${cylindersToInsert.length} vỏ bình (Thêm mới/Cập nhật)!`);
                    fetchCylinders();
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

    const getStatusLabel = (status) => {
        const item = CYLINDER_STATUSES.find(s => s.id === status);
        return item ? item.label : status;
    };

    const resolveCylinderNccSupplierName = (cylinder) => {
        const fromJoin = cylinder?.suppliers?.name;
        if (fromJoin) return fromJoin;
        const sid = cylinder?.supplier_id;
        if (sid && supplierIdToName[sid]) return supplierIdToName[sid];
        return null;
    };

    const getCurrentLocation = (cylinder) => {
        const warehouseName = cylinder?.warehouses?.name;
        const customerName = cylinder?.customers?.name || cylinder?.customer_name?.split(' / ')[0];
        const customerDepartment = cylinder?.customer_name?.split(' / ')[1];

        if (cylinder?.status === 'đã trả ncc') {
            return resolveCylinderNccSupplierName(cylinder) || '—';
        }

        if (cylinder?.status === 'sẵn sàng' && warehouseName) {
            return `Kho: ${warehouseName}`;
        }

        if (customerName) {
            return customerDepartment ? `${customerName} / ${customerDepartment}` : customerName;
        }

        if (warehouseName) {
            return `Kho: ${warehouseName}`;
        }

        return '—';
    };

    const filteredCylinders = useMemo(() => {
        if (!activeManagingWarehouseRecords.length) return cylinders;
        return cylinders.filter((cylinder) =>
            cylinderMatchesManagingWarehouseFilter(cylinder, activeManagingWarehouseRecords),
        );
    }, [cylinders, activeManagingWarehouseRecords]);

    const filteredCylindersCount = totalRecords;
    const readyCount = stats.ready;
    const inUseCount = stats.inUse;
    const emptyCount = stats.empty;

    const hasActiveFilters = selectedStatuses.length > 0
        || selectedVolumes.length > 0
        || selectedCustomers.length > 0
        || selectedCategories.length > 0
        || selectedWarehouses.length > 0;

    const totalActiveFilters = selectedStatuses.length
        + selectedVolumes.length
        + selectedCustomers.length
        + selectedCategories.length
        + selectedWarehouses.length;

    const getCylinderManagingWarehouseLabel = (cylinder) =>
        getCylinderManagingWarehouseDisplayName(cylinder, warehousesList);

    const statusOptions = CYLINDER_STATUSES.map(item => ({
        id: item.id,
        label: item.label,
        count: cylinders.filter(c => c.status === item.id).length
    }));

    const volumeOptions = uniqueVolumes.map(item => ({
        id: item,
        label: item,
        count: cylinders.filter(c => c.volume === item).length
    }));

    const customerOptions = uniqueCustomers.map(item => ({
        id: item,
        label: item,
        count: cylinders.filter(c => c.customer_name === item).length
    }));

    const warehouseFilterCatalog = (shouldScopeByManagingWarehouse && managedWarehouses.length > 0)
        ? managedWarehouses
        : warehousesList;

    const warehouseOptions = warehouseFilterCatalog
        .filter((item) => String(item?.name || '').trim())
        .map((item) => ({
            id: item.id,
            label: item.name,
            count: allMetadata.filter((c) =>
                cylinderMatchesManagingWarehouseFilter(c, [item]),
            ).length,
        }));

    const categoryOptions = CATEGORY_OPTIONS.map(item => ({
        id: item.id,
        label: item.label,
        count: cylinders.filter(c => c.category === item.id).length
    }));

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedVolumes([]);
        setSelectedCustomers([]);
        setSelectedCategories([]);
        setSelectedWarehouses([]);
    };

    const getStatusStats = () => {
        const statsLocal = {};
        allMetadata.forEach(cylinder => {
            const statusLabel = getStatusLabel(cylinder.status);
            statsLocal[statusLabel] = (statsLocal[statusLabel] || 0) + 1;
        });
        return Object.entries(statsLocal).map(([name, value]) => ({ name, value }));
    };

    const getVolumeStats = () => {
        const statsLocal = {};
        allMetadata.forEach(cylinder => {
            const volume = cylinder.volume || 'Không xác định';
            statsLocal[volume] = (statsLocal[volume] || 0) + 1;
        });
        return Object.entries(statsLocal).map(([name, value]) => ({ name, value }));
    };

    const getCustomerStats = () => {
        const statsLocal = {};
        allMetadata.forEach(cylinder => {
            const customer = cylinder.customer_name || 'Vỏ bình tại kho';
            statsLocal[customer] = (statsLocal[customer] || 0) + 1;
        });
        return Object.entries(statsLocal)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCategoryStats = () => {
        const statsLocal = {};
        allMetadata.forEach(cylinder => {
            const category = cylinder.category || 'Không xác định';
            statsLocal[category] = (statsLocal[category] || 0) + 1;
        });
        return Object.entries(statsLocal).map(([name, value]) => ({ name, value }));
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'sẵn sàng':
                return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'đang sử dụng':
            case 'đã sử dụng':
            case 'thuộc khách hàng':
                return 'bg-sky-50 text-sky-600 border-sky-100';
            case 'đang vận chuyển':
                return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'chờ nạp':
            case 'bình rỗng':
                return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'hỏng':
                return 'bg-rose-50 text-rose-500 border-rose-100';
            case 'đã trả ncc':
                return 'bg-orange-50 text-orange-600 border-orange-100';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'status':
                return 'border-blue-200 bg-blue-50 text-blue-700';
            case 'volume':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            case 'customers':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            case 'warehouses':
                return 'border-indigo-200 bg-indigo-50 text-indigo-700';
            case 'categories':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'status':
                return 'bg-blue-600 text-white';
            case 'volume':
                return 'bg-violet-600 text-white';
            case 'customers':
                return 'bg-cyan-600 text-white';
            case 'warehouses':
                return 'bg-indigo-600 text-white';
            case 'categories':
                return 'bg-emerald-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'status':
                return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'volume':
                return isActive ? 'text-violet-700' : 'text-violet-500';
            case 'customers':
                return isActive ? 'text-cyan-700' : 'text-cyan-500';
            case 'warehouses':
                return isActive ? 'text-indigo-700' : 'text-indigo-500';
            case 'categories':
                return isActive ? 'text-emerald-700' : 'text-emerald-500';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
        !categoryId && 'bg-muted text-muted-foreground border-border'
    );

    const getVolumeBadgeClass = (volume) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
        volume && 'bg-violet-50 text-violet-700 border-violet-200',
        !volume && 'bg-muted text-muted-foreground border-border'
    );

    const getRowStyle = (status) => {
        switch (status) {
            case 'sẵn sàng':
                return 'hover:bg-emerald-50/60';
            case 'đang sử dụng':
            case 'đã sử dụng':
            case 'thuộc khách hàng':
                return 'hover:bg-sky-50/60';
            case 'đang vận chuyển':
                return 'hover:bg-indigo-50/60';
            case 'chờ nạp':
            case 'bình rỗng':
                return 'hover:bg-amber-50/60';
            case 'hỏng':
                return 'hover:bg-rose-50/60';
            case 'đã trả ncc':
                return 'hover:bg-orange-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getSerialCellClass = (status) => clsx(
        'px-4 py-4 text-sm font-semibold text-foreground font-mono border-r border-primary/20 border-l-4',
        status === 'sẵn sàng' && 'border-l-emerald-400',
        (status === 'đang sử dụng' || status === 'đã sử dụng' || status === 'thuộc khách hàng') && 'border-l-sky-400',
        status === 'đang vận chuyển' && 'border-l-indigo-400',
        (status === 'chờ nạp' || status === 'bình rỗng') && 'border-l-amber-400',
        status === 'hỏng' && 'border-l-rose-400',
        status === 'đã trả ncc' && 'border-l-orange-400',
        !status && 'border-l-transparent'
    );

    const getLocationDisplay = (cylinder) => {
        const status = cylinder.status;
        
        // 1. Customer Holding Logic: 'thuộc khách hàng', 'đang sử dụng', 'đã sử dụng'
        if (['thuộc khách hàng', 'đang sử dụng', 'đã sử dụng'].includes(status)) {
            return cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—';
        }
        
        // 2. Shipping Logic: 'đang vận chuyển' should be hidden/cleared
        if (status === 'đang vận chuyển') {
            return '—';
        }
        
        // 3. Warehouse / Ready / Empty / Repair Logic: Show Warehouse Name
        if (['sẵn sàng', 'bình rỗng', 'chờ nạp', 'hỏng'].includes(status) || !status) {
            return cylinder.warehouses?.name || '—';
        }

        if (status === 'đã trả ncc') {
            return resolveCylinderNccSupplierName(cylinder) || '—';
        }

        // Fallback
        return cylinder.customer_name?.split(' / ')[1] || cylinder.warehouses?.name || '—';
    };

    const cylinderKanbanColumns = useMemo(() => {
        if (kanbanGroupBy === 'status') {
            const byStatus = new Map();
            filteredCylinders.forEach((c) => {
                const sid = c.status || '__unknown__';
                if (!byStatus.has(sid)) byStatus.set(sid, []);
                byStatus.get(sid).push(c);
            });
            const order = CYLINDER_STATUSES.map((s) => s.id);
            const entries = [...byStatus.entries()];
            entries.sort((a, b) => {
                const [ak] = a;
                const [bk] = b;
                const ia = order.indexOf(ak);
                const ib = order.indexOf(bk);
                if (ia === -1 && ib === -1) return String(ak).localeCompare(String(bk), 'vi', { sensitivity: 'base' });
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
            return entries.map(([statusId, items]) => ({
                id: statusId,
                label: getStatusLabel(statusId),
                items,
                groupBy: 'status',
            }));
        }

        const byLabel = new Map();
        filteredCylinders.forEach((c) => {
            const label = getLocationDisplay(c);
            if (!byLabel.has(label)) byLabel.set(label, []);
            byLabel.get(label).push(c);
        });
        const cols = [...byLabel.entries()]
            .sort((a, b) => {
                const [ak] = a;
                const [bk] = b;
                if (ak === '—' && bk !== '—') return 1;
                if (bk === '—' && ak !== '—') return -1;
                return ak.localeCompare(bk, 'vi', { sensitivity: 'base' });
            })
            .map(([label, items]) => ({ id: label, label, items, groupBy: 'location' }));
        return cols;
    }, [filteredCylinders, supplierIdToName, kanbanGroupBy]);

    const renderCylinderBoardFilters = () => (
        <>
            <div className="relative" data-cylinder-filter-root>
                <button
                    type="button"
                    onClick={(event) => toggleFilterDropdown('status', event)}
                    className={clsx(
                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
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
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' ? 'rotate-180' : '')} />
                </button>
                {activeDropdown === 'status' && (
                    <FilterDropdown
                        usePortal
                        anchorRef={filterAnchorRef}
                        options={statusOptions}
                        selected={selectedStatuses}
                        setSelected={setSelectedStatuses}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative" data-cylinder-filter-root>
                <button
                    type="button"
                    onClick={(event) => toggleFilterDropdown('volume', event)}
                    className={clsx(
                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                        getFilterButtonClass('volume', activeDropdown === 'volume' || selectedVolumes.length > 0)
                    )}
                >
                    <ActivitySquare size={14} className={getFilterIconClass('volume', activeDropdown === 'volume' || selectedVolumes.length > 0)} />
                    Thể tích
                    {selectedVolumes.length > 0 && (
                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('volume'))}>
                            {selectedVolumes.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'volume' ? 'rotate-180' : '')} />
                </button>
                {activeDropdown === 'volume' && (
                    <FilterDropdown
                        usePortal
                        anchorRef={filterAnchorRef}
                        options={volumeOptions}
                        selected={selectedVolumes}
                        setSelected={setSelectedVolumes}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative" data-cylinder-filter-root>
                <button
                    type="button"
                    onClick={(event) => toggleFilterDropdown('customers', event)}
                    className={clsx(
                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
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
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customers' ? 'rotate-180' : '')} />
                </button>
                {activeDropdown === 'customers' && (
                    <FilterDropdown
                        usePortal
                        anchorRef={filterAnchorRef}
                        options={customerOptions}
                        selected={selectedCustomers}
                        setSelected={setSelectedCustomers}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative" data-cylinder-filter-root>
                <button
                    type="button"
                    onClick={(event) => toggleFilterDropdown('warehouses', event)}
                    className={clsx(
                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                        getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                    )}
                >
                    <Warehouse size={14} className={getFilterIconClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)} />
                    Kho Quản Lý
                    {selectedWarehouses.length > 0 && (
                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>
                            {selectedWarehouses.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
                </button>
                {activeDropdown === 'warehouses' && (
                    <FilterDropdown
                        usePortal
                        anchorRef={filterAnchorRef}
                        options={warehouseOptions}
                        selected={selectedWarehouses}
                        setSelected={setSelectedWarehouses}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            <div className="relative" data-cylinder-filter-root>
                <button
                    type="button"
                    onClick={(event) => toggleFilterDropdown('categories', event)}
                    className={clsx(
                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                        getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)
                    )}
                >
                    <ActivitySquare size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)} />
                    Phân loại
                    {selectedCategories.length > 0 && (
                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('categories'))}>
                            {selectedCategories.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'categories' ? 'rotate-180' : '')} />
                </button>
                {activeDropdown === 'categories' && (
                    <FilterDropdown
                        usePortal
                        anchorRef={filterAnchorRef}
                        options={categoryOptions}
                        selected={selectedCategories}
                        setSelected={setSelectedCategories}
                        filterSearch={filterSearch}
                        setFilterSearch={setFilterSearch}
                    />
                )}
            </div>

            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={clearAllFilters}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                >
                    <X size={14} />
                    Xóa bộ lọc
                </button>
            )}
        </>
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
                                        id="more-actions-button-cylinders"
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        className={clsx(
                                            "p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                            showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                        )}
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                    {showMoreActions && (
                                        <div id="more-actions-menu-cylinders" className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
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
                                            {canManageCylinders && totalRecords > 0 && warehouseAssignOptions.length > 0 && (
                                                <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Gán kho hết</p>
                                                    <select
                                                        value={bulkAssignWarehouseId}
                                                        onChange={(e) => setBulkAssignWarehouseId(e.target.value)}
                                                        className="w-full h-9 px-3 rounded-lg border border-border bg-white text-[13px] font-semibold text-foreground"
                                                    >
                                                        <option value="">-- Chọn kho --</option>
                                                        {warehouseAssignOptions.map((warehouse) => (
                                                            <option key={warehouse.id} value={warehouse.id}>
                                                                {warehouse.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleBulkAssignWarehouse(); setShowMoreActions(false); }}
                                                        disabled={!bulkAssignWarehouseId || isLoading}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal-50 text-teal-800 text-[13px] font-bold border border-teal-100 disabled:opacity-50"
                                                    >
                                                        <Warehouse size={16} />
                                                        Gán kho ({totalRecords})
                                                    </button>
                                                </div>
                                            )}
                                            {canManageCylinders && totalRecords > 0 && volumeAssignOptions.length > 0 && (
                                                <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Điền loại bình</p>
                                                    <select
                                                        value={bulkAssignVolume}
                                                        onChange={(e) => setBulkAssignVolume(e.target.value)}
                                                        className="w-full h-9 px-3 rounded-lg border border-border bg-white text-[13px] font-semibold text-foreground"
                                                    >
                                                        <option value="">-- Loại bình --</option>
                                                        {volumeAssignOptions.map((item) => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => { handleBulkAssignVolume(); setShowMoreActions(false); }}
                                                        disabled={!bulkAssignVolume || isLoading}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-violet-50 text-violet-800 text-[13px] font-bold border border-violet-100 disabled:opacity-50"
                                                    >
                                                        <ActivitySquare size={16} />
                                                        Điền loại bình ({totalRecords})
                                                    </button>
                                                </div>
                                            )}
                                            {canManageCylinders && totalRecords > 0 && (
                                                <div
                                                    role="button"
                                                    onClick={() => { handleDeleteAllFilteredCylinders(); setShowMoreActions(false); }}
                                                    className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer border-t border-slate-100 mt-1"
                                                >
                                                    <div className="w-5 flex justify-center flex-shrink-0">
                                                        <Trash2 size={18} />
                                                    </div>
                                                    Xóa hết ({totalRecords})
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setSelectedCylinder(null); setIsFormModalOpen(true); }}
                                    className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
                                >
                                    <Plus size={20} />
                                </button>
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-primary">{selectedIds.length}</span> bình khí
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
                                            <Trash2 size={14} /> Xóa đã chọn
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />


                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-24 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredCylinders.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredCylinders.map((cylinder, index) => (
                                <div key={cylinder.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(cylinder.id)
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                        : "border-primary/15 bg-white"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(cylinder.id)}
                                                    onChange={() => toggleSelectOne(cylinder.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{index + 1}</p>
                                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{cylinder.serial_number}</h3>
                                            </div>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusBadgeClass(cylinder.status))}>
                                            {getStatusLabel(cylinder.status)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Loại bình</p>
                                            <p className="text-[12px] text-foreground font-medium">
                                                <span className={getVolumeBadgeClass(cylinder.volume)}>{cylinder.volume || '—'}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Phân loại</p>
                                            <p className="text-[12px] text-foreground font-medium">
                                                <span className={getCategoryBadgeClass(cylinder.category)}>{cylinder.category || '—'}</span>
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                                        <User size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Khách hàng</p>
                                                        <p className="text-[12px] text-foreground font-bold truncate">
                                                            {cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                                        <Warehouse size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Kho quản lý</p>
                                                        <p className="text-[12px] text-foreground font-bold truncate">
                                                            {getCylinderManagingWarehouseLabel(cylinder)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {cylinder.status === 'đã trả ncc' && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                                                            <Building2 size={14} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">NCC nhận vỏ</p>
                                                            <p className="text-[12px] text-orange-800 font-bold truncate">
                                                                {resolveCylinderNccSupplierName(cylinder) || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                                        <ActivitySquare size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Vị trí</p>
                                                        <p className="text-[12px] text-foreground font-bold truncate">
                                                            {getLocationDisplay(cylinder)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <Warehouse size={12} />
                                            <span>{getCylinderManagingWarehouseLabel(cylinder)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewWarehouse(cylinder)} className="px-2 py-1 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-bold">Xem kho</button>
                                            <button onClick={() => handleViewCylinder(cylinder)} className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg"><Eye size={16} /></button>
                                            <button onClick={() => handleEditCylinder(cylinder)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"><Edit size={16} /></button>
                                            {canManageCylinders && (
                                                <button onClick={() => handleDeleteCylinder(cylinder.id, cylinder.serial_number)} className="p-2 text-red-700 bg-red-50 border border-red-100 rounded-lg"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                    </div>

                    {/* Sticky Mobile Pagination */}
                    {!isLoading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}

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
                                        setSelectedCylinder(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>

                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-4 h-10 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all active:scale-95 animate-in slide-in-from-right-4"
                                    >
                                        <Trash2 size={16} />
                                        Xóa ({selectedIds.length})
                                    </button>
                                )}

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
                                        className="flex items-center gap-2 px-4 h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 shadow-sm transition-all cursor-pointer active:scale-95 select-none"
                                        title="Nhập dữ liệu từ Excel"
                                    >
                                        <Upload size={16} />
                                        Import Excel
                                    </label>
                                </div>

                                {canManageCylinders && totalRecords > 0 && warehouseAssignOptions.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={bulkAssignWarehouseId}
                                            onChange={(e) => setBulkAssignWarehouseId(e.target.value)}
                                            className="h-10 min-w-[150px] max-w-[220px] px-3 rounded-lg border border-border bg-white text-[13px] font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                            title="Chọn kho quản lý"
                                        >
                                            <option value="">-- Chọn kho --</option>
                                            {warehouseAssignOptions.map((warehouse) => (
                                                <option key={warehouse.id} value={warehouse.id}>
                                                    {warehouse.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleBulkAssignWarehouse}
                                            disabled={!bulkAssignWarehouseId || isLoading}
                                            className="flex items-center gap-2 px-4 h-10 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 text-[13px] font-bold hover:bg-teal-100 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Gán kho quản lý cho toàn bộ bình trong danh sách hiện tại"
                                        >
                                            <Warehouse size={16} />
                                            Gán kho hết
                                        </button>
                                    </div>
                                )}

                                {canManageCylinders && totalRecords > 0 && volumeAssignOptions.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={bulkAssignVolume}
                                            onChange={(e) => setBulkAssignVolume(e.target.value)}
                                            className="h-10 min-w-[150px] max-w-[240px] px-3 rounded-lg border border-border bg-white text-[13px] font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                            title="Chọn loại bình / thể tích"
                                        >
                                            <option value="">-- Loại bình --</option>
                                            {volumeAssignOptions.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleBulkAssignVolume}
                                            disabled={!bulkAssignVolume || isLoading}
                                            className="flex items-center gap-2 px-4 h-10 rounded-lg border border-violet-200 bg-violet-50 text-violet-800 text-[13px] font-bold hover:bg-violet-100 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Điền loại bình cho toàn bộ bình trong danh sách hiện tại"
                                        >
                                            <ActivitySquare size={16} />
                                            Điền loại bình
                                        </button>
                                    </div>
                                )}

                                {canManageCylinders && totalRecords > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAllFilteredCylinders}
                                        className="flex items-center gap-2 px-4 h-10 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all active:scale-95"
                                        title="Xóa toàn bộ bình trong danh sách hiện tại"
                                    >
                                        <Trash2 size={16} />
                                        Xóa hết ({totalRecords})
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {renderCylinderBoardFilters()}
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    <th className="w-12 px-4 py-3.5 text-center border-r border-primary/30">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredCylinders.length && filteredCylinders.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                'px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide',
                                                col.key === 'serial_number' && 'border-l border-r border-primary/30'
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredCylinders.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy bình nào
                                        </td>
                                    </tr>
                                ) : filteredCylinders.map((cylinder) => (
                                    <tr key={cylinder.id} className={clsx(
                                        getRowStyle(cylinder.status),
                                        selectedIds.includes(cylinder.id) && "bg-primary/[0.04]"
                                    )}>
                                        <td className="w-12 px-4 py-4 text-center border-r border-primary/20">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(cylinder.id)}
                                                onChange={() => toggleSelectOne(cylinder.id)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </td>
                                        {visibleTableColumns.map((col) => {
                                            if (col.key === 'serial_number') {
                                                return <td key={col.key} className={getSerialCellClass(cylinder.status)}>{cylinder.serial_number}</td>;
                                            }
                                            if (col.key === 'cylinder_code') {
                                                return <td key={col.key} className="px-4 py-4 text-sm font-medium text-slate-700">{cylinder.cylinder_code || '—'}</td>;
                                            }
                                            if (col.key === 'volume') {
                                                return <td key={col.key} className="px-4 py-4 text-sm text-muted-foreground">{cylinder.volume || '—'}</td>;
                                            }
                                            if (col.key === 'customer_name') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-sm font-semibold text-foreground">
                                                        {cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—'}
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'department') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-sm font-medium text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                        {getLocationDisplay(cylinder)}
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'warehouse') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-sm text-muted-foreground font-bold">
                                                        {getCylinderManagingWarehouseLabel(cylinder)}
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'supplier_ncc') {
                                                const nccName = resolveCylinderNccSupplierName(cylinder);
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-sm font-semibold text-orange-800">
                                                        {cylinder.status === 'đã trả ncc' ? (nccName || '—') : '—'}
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'status') {
                                                return (
                                                    <td key={col.key} className="px-4 py-4 text-[13px] font-bold">
                                                        <span className={clsx('inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border', getStatusBadgeClass(cylinder.status))}>
                                                            {getStatusLabel(cylinder.status)}
                                                        </span>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'expiry_date') {
                                                return <td key={col.key} className="px-4 py-4 text-sm text-muted-foreground">{cylinder.expiry_date || '—'}</td>;
                                            }
                                            return <td key={col.key} className="px-4 py-4 text-sm">—</td>;
                                        })}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewCylinder(cylinder)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditCylinder(cylinder)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {canManageCylinders && (
                                                    <button onClick={() => handleDeleteCylinder(cylinder.id, cylinder.serial_number)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>
                                {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / Tổng {totalRecords}
                            </span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-emerald-600 font-bold">Sẵn sàng {formatNumber(readyCount)}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-sky-600 font-bold">Đang dùng {formatNumber(inUseCount)}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-amber-600 font-bold">Rỗng/Chờ {formatNumber(emptyCount)}</span>
                            </div>
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
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} />
                            <input
                                type="text"
                                placeholder="Tìm RFID, thể tích..."
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
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground'
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

                    <div className="md:hidden px-3 py-2 border-b border-border bg-white">
                        <label htmlFor="kanban-group-by-mobile" className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1.5">
                            Nhóm cột Kanban
                        </label>
                        <select
                            id="kanban-group-by-mobile"
                            value={kanbanGroupBy}
                            onChange={(e) => setKanbanGroupBy(e.target.value)}
                            className="w-full h-10 rounded-xl border border-border bg-muted/25 px-3 text-[13px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value="location">Theo vị trí (cột Vị trí)</option>
                            <option value="status">Theo trạng thái</option>
                        </select>
                    </div>

                    <div className="hidden md:flex flex-col p-4 border-b border-border gap-3 shrink-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1 min-w-[200px] max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                                    <input
                                        type="text"
                                        placeholder="Tìm RFID, thể tích, khách..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-9 py-2 bg-muted/30 border border-border/80 rounded-xl text-[13px] font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
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
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCylinder(null);
                                    setIsFormModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 h-10 rounded-xl bg-primary text-white text-[13px] font-black shadow-lg shadow-primary/20 shrink-0"
                            >
                                <Plus size={18} />
                                Thêm
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider shrink-0">
                                Nhóm cột
                            </span>
                            <select
                                value={kanbanGroupBy}
                                onChange={(e) => setKanbanGroupBy(e.target.value)}
                                className="h-10 min-w-[220px] rounded-xl border border-border bg-white px-3 text-[13px] font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                                aria-label="Chọn nhóm cột Kanban: vị trí hoặc trạng thái"
                            >
                                <option value="location">Theo vị trí (cột Vị trí)</option>
                                <option value="status">Theo trạng thái</option>
                            </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {renderCylinderBoardFilters()}
                        </div>
                    </div>

                    <div className="flex-1 min-h-[min(480px,calc(100vh-280px))] overflow-x-auto overflow-y-hidden p-2 md:p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 h-full">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                <p className="text-[13px] font-medium text-muted-foreground">Đang tải bình…</p>
                            </div>
                        ) : filteredCylinders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6 text-muted-foreground">
                                <ActivitySquare size={48} className="opacity-35 mb-3" />
                                <p className="text-[14px] font-bold">Không có bình trên trang này</p>
                                <p className="text-[12px] mt-1">Thử đổi tìm kiếm, bộ lọc hoặc trang.</p>
                            </div>
                        ) : (
                            <div className="flex gap-4 h-full min-h-[min(440px,calc(100vh-300px))] pb-2">
                                {cylinderKanbanColumns.map((col) => (
                                    <div
                                        key={col.id}
                                        className="flex flex-col w-[min(92vw,280px)] sm:w-[min(260px,calc((100vw-4rem)/4))] shrink-0 rounded-2xl border border-border bg-muted/40 overflow-hidden"
                                    >
                                        <div
                                            className={clsx(
                                                'px-3 py-2.5 border-b font-black text-[11px] uppercase tracking-wide flex items-start justify-between gap-2',
                                                col.groupBy === 'status'
                                                    ? getStatusKanbanColumnHeaderClass(col.id)
                                                    : getLocationKanbanColumnHeaderClass(col.label)
                                            )}
                                        >
                                            <span className="break-words leading-snug" title={col.label}>{col.label}</span>
                                            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-white/70 text-[11px] font-black tabular-nums border border-black/5">
                                                {col.items.length}
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0 custom-scrollbar bg-white/60">
                                            {col.items.length === 0 ? (
                                                <p className="text-[11px] font-semibold text-muted-foreground text-center py-8 px-2">Trống</p>
                                            ) : (
                                                col.items.map((cylinder) => (
                                                    <div
                                                        key={cylinder.id}
                                                        className={clsx(
                                                            'rounded-xl border border-border bg-white p-3 shadow-sm border-l-4 space-y-2',
                                                            col.groupBy === 'status'
                                                                ? getStatusKanbanCardAccentClass(col.id)
                                                                : getLocationKanbanCardAccentClass(col.label)
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-[13px] font-black font-mono text-foreground truncate">{cylinder.serial_number}</p>
                                                            {kanbanGroupBy === 'location' && (
                                                                <span className={clsx('shrink-0 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border', getStatusBadgeClass(cylinder.status))}>
                                                                    {getStatusLabel(cylinder.status)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] font-bold text-muted-foreground truncate">{cylinder.volume || '—'} · {cylinder.category || '—'}</p>
                                                        {kanbanGroupBy === 'status' ? (
                                                            <p className="text-[11px] font-bold text-primary leading-snug line-clamp-2" title={getLocationDisplay(cylinder)}>
                                                                Vị trí: {getLocationDisplay(cylinder)}
                                                            </p>
                                                        ) : (
                                                            <p className="text-[11px] font-semibold text-foreground truncate" title={getCylinderManagingWarehouseLabel(cylinder)}>
                                                                Kho Quản Lý: {getCylinderManagingWarehouseLabel(cylinder)}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/50">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewCylinder(cylinder)}
                                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Chi tiết"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditCylinder(cylinder)}
                                                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                                title="Sửa"
                                                            >
                                                                <Edit size={15} />
                                                            </button>
                                                            {canManageCylinders && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCylinder(cylinder.id, cylinder.serial_number)}
                                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Xóa"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            )}
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

                    {!isLoading && (
                        <div className="md:hidden border-t border-border shrink-0">
                            <MobilePagination
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                pageSize={pageSize}
                                setPageSize={setPageSize}
                                totalRecords={totalRecords}
                            />
                        </div>
                    )}

                    <div className="hidden md:flex px-4 py-3 border-t border-border items-center justify-between bg-muted/5 text-[12px] text-muted-foreground">
                        <span>
                            Kanban theo{' '}
                            <span className="font-black text-foreground">
                                {kanbanGroupBy === 'status' ? 'trạng thái' : 'vị trí'}
                            </span>
                            {' · '}
                            Trang {currentPage}
                            {totalRecords > 0 ? ` (${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)} / ${totalRecords})` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(1)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                disabled={currentPage === 1}
                                title="Trang đầu"
                            >
                                <ChevronLeft size={16} />
                                <ChevronLeft size={16} className="-ml-2.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-black">{currentPage}</span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalRecords / pageSize) || 1, p + 1))}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize) || 1)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                            >
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

                        <div className="hidden md:block p-4 border-b border-border">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                {renderCylinderBoardFilters()}
                            </div>
                        </div>

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                            <ActivitySquare className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng bình</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(filteredCylindersCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50/70 border border-green-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12  bg-green-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-green-200/70">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-green-600 uppercase tracking-wider">Sẵn sàng</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(readyCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12  bg-orange-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-orange-200/70">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đang dùng</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(inUseCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12  bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Rỗng/Chờ</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(emptyCount)}</p>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Thể tích</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getVolumeStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    data: getVolumeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getVolumeStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Phân loại</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCategoryStats().map(item => item.name),
                                                datasets: [{
                                                    label: 'Số bình',
                                                    data: getCategoryStats().map(item => item.value),
                                                    backgroundColor: chartColors[0],
                                                    borderColor: chartColors[0],
                                                    borderWidth: 1
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { display: false } },
                                                scales: { y: { beginAtZero: true } }
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
                                                    label: 'Số bình',
                                                    data: getCustomerStats().map(item => item.value),
                                                    backgroundColor: chartColors[1],
                                                    borderColor: chartColors[1],
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
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Filter size={16} className="text-blue-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'volume',
                            label: 'Thể tích',
                            icon: <ActivitySquare size={16} className="text-violet-600" />,
                            options: volumeOptions,
                            selectedValues: pendingVolumes,
                            onSelectionChange: setPendingVolumes,
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
                            label: 'Kho Quản Lý',
                            icon: <Warehouse size={16} className="text-indigo-600" />,
                            options: warehouseOptions,
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses,
                        },
                        {
                            id: 'categories',
                            label: 'Phân loại',
                            icon: <ActivitySquare size={16} className="text-emerald-600" />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <CylinderFormModal
                    cylinder={selectedCylinder}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedCylinder && (
                <CylinderDetailsModal
                    cylinder={selectedCylinder}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}

            <CylinderQCDialog
                isOpen={isQCModalOpen}
                onClose={() => setIsQCModalOpen(false)}
                onSuccess={(count) => {
                    setIsQCModalOpen(false);
                    alert(`Đã cập nhật dữ liệu QC cho ${count} vỏ bình thành công!`);
                    fetchCylinders();
                }}
            />
        </div>
    );
};

export default Cylinders;
