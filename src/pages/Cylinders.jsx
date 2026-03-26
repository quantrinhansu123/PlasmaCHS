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
    const { role } = usePermissions();
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

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedVolumes, setSelectedVolumes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueVolumes, setUniqueVolumes] = useState([]);
    const [uniqueWarehouses, setUniqueWarehouses] = useState([]);

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
        fetchCylinders();
    }, []);

    useEffect(() => {
        const customers = [...new Set(cylinders.map(c => c.customers?.name || c.customer_name?.split(' / ')[0]).filter(Boolean))];
        const volumes = [...new Set(cylinders.map(c => c.volume).filter(Boolean))];
        const warehouses = [...new Set(cylinders.map(c => c.warehouses?.name).filter(Boolean))];
        setUniqueCustomers(customers);
        setUniqueVolumes(volumes);
        setUniqueWarehouses(warehouses);
    }, [cylinders]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            const { data, error } = await supabase
                .from('cylinders')
                .select('*, warehouses(name), customers(name)')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;
            setCylinders(data || []);
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
                'Kho quản lý': uniqueWarehouses[0] || 'Kho tổng',
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

    const filteredCylinders = cylinders.filter(cylinder => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (cylinder.serial_number?.toLowerCase().includes(search)) ||
            (cylinder.volume?.toLowerCase().includes(search)) ||
            (cylinder.customer_name?.toLowerCase().includes(search))
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(cylinder.status);
        const matchesVolume = selectedVolumes.length === 0 || selectedVolumes.includes(cylinder.volume);
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(cylinder.customer_name);
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(cylinder.warehouses?.name);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(cylinder.category);

        return matchesSearch && matchesStatus && matchesVolume && matchesCustomer && matchesWarehouse && matchesCategory;
    });

    const filteredCylindersCount = filteredCylinders.length;
    const readyCount = filteredCylinders.filter(c => c.status === 'sẵn sàng').length;
    const inUseCount = filteredCylinders.filter(c => c.status === 'đang sử dụng' || c.status === 'thuộc khách hàng').length;
    const emptyCount = filteredCylinders.filter(c => c.status === 'bình rỗng' || c.status === 'chờ nạp').length;

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
        id: item,
        label: item,
        count: cylinders.filter(c => c.warehouses?.name === item).length
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
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const statusLabel = getStatusLabel(cylinder.status);
            stats[statusLabel] = (stats[statusLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getVolumeStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const volume = cylinder.volume || 'Không xác định';
            stats[volume] = (stats[volume] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const customer = cylinder.customer_name || 'Vỏ bình tại kho';
            stats[customer] = (stats[customer] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCategoryStats = () => {
        const stats = {};
        filteredCylinders.forEach(cylinder => {
            const category = cylinder.category || 'Không xác định';
            stats[category] = (stats[category] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col -mt-2 min-h-0 px-3 md:px-6">
            <div className="flex items-center gap-1 mb-4 mt-6">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all',
                        activeView === 'list'
                            ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <List size={14} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all',
                        activeView === 'stats'
                            ? 'bg-white text-primary shadow-sm ring-1 ring-border'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    <BarChart2 size={14} />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                        <div className="flex items-center gap-2 shrink-0 pr-1">
                            <input
                                type="checkbox"
                                checked={selectedIds.length === filteredCylinders.length && filteredCylinders.length > 0}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
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
                        <div className="flex items-center gap-2 shrink-0 pr-1">
                            <input
                                type="checkbox"
                                checked={selectedIds.length === filteredCylinders.length && filteredCylinders.length > 0}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                            />
                        </div>
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
                        <button
                            onClick={downloadTemplate}
                            className="p-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0 shadow-sm transition-all"
                            title="Tải mẫu Excel"
                        >
                            <Download size={18} />
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportExcel}
                                className="hidden"
                                id="excel-import-mobile-cylinders"
                            />
                            <label
                                htmlFor="excel-import-mobile-cylinders"
                                className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center cursor-pointer shadow-sm transition-all"
                                title="Import Excel"
                            >
                                <Upload size={18} />
                            </label>
                        </div>
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shrink-0 shadow-sm animate-in zoom-in-95 duration-200"
                                title="Xóa các mục đã chọn"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setSelectedCylinder(null);
                                setIsFormModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
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
                                                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                                        <Warehouse size={14} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Vị trí</p>
                                                        <p className="text-[12px] text-foreground font-bold truncate">
                                                            {cylinder.customer_name?.split(' / ')[1] || '—'}
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
                                            'flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm',
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
                                    className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>

                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all animate-in slide-in-from-right-4"
                                    >
                                        <Trash2 size={16} />
                                        Xóa ({selectedIds.length})
                                    </button>
                                )}

                                <button
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-bold hover:bg-indigo-100 shadow-sm transition-all"
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
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 shadow-sm transition-all cursor-pointer"
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
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredCylinders.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
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
                                        {isColumnVisible('serial_number') && <td className={getSerialCellClass(cylinder.status)}>{cylinder.serial_number}</td>}
                                        {isColumnVisible('volume') && <td className="px-4 py-4 text-sm text-muted-foreground">{cylinder.volume || '—'}</td>}
                                        {isColumnVisible('customer_name') && (
                                            <td className="px-4 py-4 text-sm font-semibold text-foreground">
                                                {cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—'}
                                            </td>
                                        )}
                                        {isColumnVisible('department') && (
                                            <td className="px-4 py-4 text-sm font-medium text-muted-foreground">
                                                {cylinder.customer_name?.split(' / ')[1] || '—'}
                                            </td>
                                        )}
                                        {isColumnVisible('warehouse') && <td className="px-4 py-4 text-sm text-muted-foreground">{cylinder.warehouses?.name || '—'}</td>}
                                        {isColumnVisible('status') && (
                                            <td className="px-4 py-4">
                                                <span className={clsx('inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border', getStatusBadgeClass(cylinder.status))}>
                                                    {getStatusLabel(cylinder.status)}
                                                </span>
                                            </td>
                                        )}
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
                            <span>{filteredCylinders.length > 0 ? `1–${filteredCylinders.length}` : '0'}/Tổng {filteredCylinders.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">Sẵn sàng {formatNumber(readyCount)}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">Đang dùng {formatNumber(inUseCount)}</span>
                            </div>
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
