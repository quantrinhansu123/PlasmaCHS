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
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Eye,
    Filter,
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
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import CylinderDetailsModal from '../components/Cylinders/CylinderDetailsModal';
import CylinderFormModal from '../components/Cylinders/CylinderFormModal';
import CylinderQCDialog from '../components/Cylinders/CylinderQCDialog';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { CYLINDER_STATUSES } from '../constants/machineConstants';
import usePermissions from '../hooks/usePermissions';
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

const TABLE_COLUMNS = [
    { key: 'serial_number', label: 'Mã RFID (Serial)' },
    { key: 'cylinder_code', label: 'Mã bình khắc' },
    { key: 'volume', label: 'Thể tích / Loại bình' },
    { key: 'customer_name', label: 'Khách hàng' },
    { key: 'department', label: 'Vị trí' },
    { key: 'warehouse', label: 'Kho Quản Lý' },
    { key: 'status', label: 'Trạng Thái' },
    { key: 'expiry_date', label: 'Hạn kiểm định' },
];

const CATEGORY_OPTIONS = [
    { id: 'BV', label: 'BV' },
    { id: 'TM', label: 'TM' },
];

const Cylinders = () => {
    const { role, department } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [cylinders, setCylinders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQCModalOpen, setIsQCModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCylinder, setSelectedCylinder] = useState(null);
    const [showMoreActions, setShowMoreActions] = useState(false);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedVolumes, setSelectedVolumes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueVolumes, setUniqueVolumes] = useState([]);
    const [uniqueWarehouses, setUniqueWarehouses] = useState([]);

    const EMPTY_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000000';

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
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

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

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        fetchCylinders();
        fetchGlobalStats();
        fetchMetadataForCharts();
    }, [currentPage, searchTerm, selectedStatuses, selectedVolumes, selectedCustomers, selectedCategories, selectedWarehouses]);

    const fetchMetadataForCharts = async () => {
        try {
            let query = supabase
                .from('cylinders')
                .select('status, volume, customer_name, category');

            if (searchTerm) {
                query = query.or(`serial_number.ilike.%${searchTerm}%,volume.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
            }
            if (selectedStatuses.length > 0) query = query.in('status', selectedStatuses);
            if (selectedVolumes.length > 0) query = query.in('volume', selectedVolumes);
            if (selectedCustomers.length > 0) query = query.in('customer_name', selectedCustomers);
            if (selectedCategories.length > 0) query = query.in('category', selectedCategories);
            if (selectedWarehouses.length > 0) query = query.in('warehouse_id', selectedWarehouses);

            // Apply warehouse filter for warehouse managers/staff (Non-Admin)
            if (role !== 'Admin' && department) {
                const userBranch = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                const { data: matchedWarehouses } = await supabase
                    .from('warehouses')
                    .select('id')
                    .ilike('name', `%${userBranch}%`);
                
                if (matchedWarehouses && matchedWarehouses.length > 0) {
                    const matchedWhIds = matchedWarehouses.map(w => w.id);
                    if (selectedWarehouses.length > 0) {
                        const scopedWhIds = selectedWarehouses.filter(id => matchedWhIds.includes(id));
                        query = scopedWhIds.length > 0
                            ? query.in('warehouse_id', scopedWhIds)
                            : query.eq('warehouse_id', EMPTY_WAREHOUSE_ID);
                    } else {
                        query = query.in('warehouse_id', matchedWhIds);
                    }
                } else {
                    query = query.eq('warehouse_id', EMPTY_WAREHOUSE_ID);
                }
            }

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
            if (custData) setUniqueCustomers(custData.map(c => c.name));

            // Fetch unique warehouses
            const { data: whData } = await supabase.from('warehouses').select('id, name').order('name');
            if (whData) setUniqueWarehouses(whData);
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

            // Apply same filters to stat queries
            let matchedWhIds = [];
            if (role !== 'Admin' && department) {
                const userBranch = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                const { data: whs } = await supabase.from('warehouses').select('id').ilike('name', `%${userBranch}%`);
                if (whs) matchedWhIds = whs.map(w => w.id);
            }

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
                if (selectedWarehouses.length > 0) queries[key] = queries[key].in('warehouse_id', selectedWarehouses);
                
                if (role !== 'Admin' && department) {
                    if (matchedWhIds.length > 0) {
                        if (selectedWarehouses.length > 0) {
                            const scopedWhIds = selectedWarehouses.filter(id => matchedWhIds.includes(id));
                            queries[key] = scopedWhIds.length > 0
                                ? queries[key].in('warehouse_id', scopedWhIds)
                                : queries[key].eq('warehouse_id', EMPTY_WAREHOUSE_ID);
                        } else {
                            queries[key] = queries[key].in('warehouse_id', matchedWhIds);
                        }
                    } else {
                        queries[key] = queries[key].eq('warehouse_id', EMPTY_WAREHOUSE_ID);
                    }
                }
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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
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
            let query = supabase
                .from('cylinders')
                .select('*, warehouses(name), customers(name)', { count: 'exact' });

            // Apply Filters (Server-side)
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
            if (selectedWarehouses.length > 0) {
                query = query.in('warehouse_id', selectedWarehouses);
            }

            // Apply warehouse filter for warehouse managers/staff (Non-Admin)
            if (role !== 'Admin' && department) {
                const userBranch = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                
                // Get matching warehouse IDs for this branch
                const { data: matchedWarehouses } = await supabase
                    .from('warehouses')
                    .select('id')
                    .ilike('name', `%${userBranch}%`);
                
                if (matchedWarehouses && matchedWarehouses.length > 0) {
                    const matchedWhIds = matchedWarehouses.map(w => w.id);
                    if (selectedWarehouses.length > 0) {
                        const scopedWhIds = selectedWarehouses.filter(id => matchedWhIds.includes(id));
                        query = scopedWhIds.length > 0
                            ? query.in('warehouse_id', scopedWhIds)
                            : query.eq('warehouse_id', EMPTY_WAREHOUSE_ID);
                    } else {
                        query = query.in('warehouse_id', matchedWhIds);
                    }
                } else {
                    // Fallback to strict match if ilike fails or no results
                    query = query.eq('warehouse_id', EMPTY_WAREHOUSE_ID); // No results
                }
            }

            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error && error.code !== '42P01') throw error;
            setCylinders(data || []);
            setTotalRecords(count || 0);
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
        } catch (error) {
            console.error('Error deleting cylinders:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
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
                'Kho quản lý': uniqueWarehouses[0]?.name || 'Kho tổng',
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

                // Fetch all warehouses to map names to IDs
                const { data: warehouses } = await supabase.from('warehouses').select('id, name');
                const warehouseMap = (warehouses || []).reduce((acc, w) => {
                    acc[w.name.toLowerCase()] = w.id;
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

    const filteredCylinders = cylinders;

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

    const warehouseOptions = uniqueWarehouses.map(item => ({
        id: item.id,
        label: item.name,
        count: cylinders.filter(c => c.warehouse_id === item.id).length
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

        // Fallback
        return cylinder.customer_name?.split(' / ')[1] || cylinder.warehouses?.name || '—';
    };

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
                                            <Trash2 size={14} /> Xóa tất cả
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
                                                            {cylinder.warehouses?.name || '—'}
                                                        </p>
                                                    </div>
                                                </div>
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
                                            <span>{cylinder.warehouses?.name || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewCylinder(cylinder)} className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg"><Eye size={16} /></button>
                                            <button onClick={() => handleEditCylinder(cylinder)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"><Edit size={16} /></button>
                                            {(role === 'admin' || role === 'manager') && (
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
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'volume' ? null : 'volume')}
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
                                        options={volumeOptions}
                                        selected={selectedVolumes}
                                        setSelected={setSelectedVolumes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
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
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <Warehouse size={14} className={getFilterIconClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)} />
                                    Kho
                                    {selectedWarehouses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
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

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
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
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
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
                                                        {cylinder.warehouses?.name || '—'}
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
                                                {(role === 'admin' || role === 'manager') && (
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'volume' ? null : 'volume')}
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
                                            options={volumeOptions}
                                            selected={selectedVolumes}
                                            setSelected={setSelectedVolumes}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'customers' ? null : 'customers')}
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
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)
                                        )}
                                    >
                                        <Warehouse size={14} className={getFilterIconClass('warehouses', activeDropdown === 'warehouses' || selectedWarehouses.length > 0)} />
                                        Kho
                                        {selectedWarehouses.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouses'))}>
                                                {selectedWarehouses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'warehouses' ? 'rotate-180' : '')} />
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

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
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
                            label: 'Kho',
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
