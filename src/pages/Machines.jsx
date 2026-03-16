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
    Activity,
    BarChart2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit,
    Eye,
    Filter,
    List,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    Warehouse,
    Download,
    Upload,
    Wrench,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import MachineDetailsModal from '../components/Machines/MachineDetailsModal';
import MachineFormModal from '../components/Machines/MachineFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { MACHINE_STATUSES, MACHINE_TYPES } from '../constants/machineConstants';
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
    { key: 'serial_number', label: 'Mã Máy (Serial)' },
    { key: 'machine_type', label: 'Loại Máy' },
    { key: 'warehouse', label: 'Kho Quản Lý' },
    { key: 'customer_name', label: 'Khách hàng đang sử dụng máy' },
    { key: 'status', label: 'Trạng Thái' },
    { key: 'department_in_charge', label: 'Bộ Phận Phụ Trách' },
];

const Machines = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [machines, setMachines] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);

    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedMachineTypes, setSelectedMachineTypes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueDepartments, setUniqueDepartments] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingMachineTypes, setPendingMachineTypes] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingDepartments, setPendingDepartments] = useState([]);
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
            const saved = JSON.parse(localStorage.getItem('columns_machines_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_machines') || 'null');
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
        fetchMachines();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        const customers = [...new Set(machines.map(m => m.customer_name).filter(Boolean))];
        const departments = [...new Set(machines.map(m => m.department_in_charge).filter(Boolean))];
        setUniqueCustomers(customers);
        setUniqueDepartments(departments);
    }, [machines]);

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
        localStorage.setItem('columns_machines', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_machines_order', JSON.stringify(columnOrder));
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
        setPendingMachineTypes(selectedMachineTypes);
        setPendingCustomers(selectedCustomers);
        setPendingDepartments(selectedDepartments);
        setPendingWarehouses(selectedWarehouses);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedMachineTypes(pendingMachineTypes);
        setSelectedCustomers(pendingCustomers);
        setSelectedDepartments(pendingDepartments);
        setSelectedWarehouses(pendingWarehouses);
        closeMobileFilter();
    };

    const fetchMachines = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;
            setMachines(data || []);
        } catch (error) {
            console.error('Error fetching machines:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const handleDeleteMachine = async (id, serialNumber) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa máy có mã ${serialNumber} này không? Chú ý: Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('machines')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchMachines();
        } catch (error) {
            console.error('Error deleting machine:', error);
            alert('❌ Có lỗi xảy ra khi xóa máy: ' + error.message);
        }
    };

    const handleEditMachine = (machine) => {
        setSelectedMachine(machine);
        setIsFormModalOpen(true);
    };

    const handleViewMachine = (machine) => {
        setSelectedMachine(machine);
        setIsDetailsModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchMachines();
        setIsFormModalOpen(false);
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const downloadTemplate = () => {
        const headers = [
            'Mã máy (Serial)',
            'Loại máy (BV/TM/FM/IOT)',
            'Tài khoản máy',
            'Bluetooth MAC',
            'Phiên bản',
            'Thể tích bình',
            'Loại khí',
            'Loại van',
            'Loại đầu phát',
            'Bộ phận phụ trách',
            'Kho quản lý',
        ];

        const exampleData = [
            {
                'Mã máy (Serial)': 'PLT-25D1-50-TM',
                'Loại máy (BV/TM/FM/IOT)': 'TM',
                'Tài khoản máy': 'ACC-001',
                'Bluetooth MAC': '00:1A:2B:3C:4D:5E',
                'Phiên bản': 'V1.0',
                'Thể tích bình': 'Bình 4L/ CGA870',
                'Loại khí': 'ArgonMed',
                'Loại van': 'Van Messer',
                'Loại đầu phát': 'Tia thường',
                'Bộ phận phụ trách': 'Kỹ thuật',
                'Kho quản lý': warehousesList[0]?.name || 'Kho tổng',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Máy');
        XLSX.writeFile(wb, 'mau_import_may_moc.xlsx');
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
                
                // Map warehouse names to IDs
                const warehouseMap = (warehousesList || []).reduce((acc, w) => {
                    acc[w.name.toLowerCase()] = w.id;
                    return acc;
                }, {});

                const machinesToInsert = data.map(row => ({
                    serial_number: row['Mã máy (Serial)']?.toString(),
                    machine_type: row['Loại máy (BV/TM/FM/IOT)']?.toString() || 'TM',
                    machine_account: row['Tài khoản máy']?.toString(),
                    bluetooth_mac: row['Bluetooth MAC']?.toString(),
                    version: row['Phiên bản']?.toString(),
                    cylinder_volume: row['Thể tích bình']?.toString(),
                    gas_type: row['Loại khí']?.toString(),
                    valve_type: row['Loại van']?.toString(),
                    emission_head_type: row['Loại đầu phát']?.toString(),
                    department_in_charge: row['Bộ phận phụ trách']?.toString(),
                    warehouse: warehouseMap[row['Kho quản lý']?.toString()?.toLowerCase()] || null,
                    status: 'sẵn sàng'
                })).filter(m => m.serial_number);

                if (machinesToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu mã máy)!');
                    setIsLoading(false);
                    return;
                }

                const { error } = await supabase.from('machines').insert(machinesToInsert);

                if (error) {
                    if (error.code === '23505') {
                        alert('Lỗi: Một số mã máy (Serial) đã tồn tại trên hệ thống. Vui lòng kiểm tra lại!');
                    } else {
                        throw error;
                    }
                } else {
                    alert(`🎉 Đã import thành công ${machinesToInsert.length} máy móc!`);
                    fetchMachines();
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

    const getLabel = (list, id) => {
        return list.find(item => item.id === id)?.label || id;
    };

    const getStatusLabel = (status) => {
        const item = MACHINE_STATUSES.find(s => s.id === status);
        return item ? item.label : status;
    };

    const getWarehouseLabel = (warehouseId) => {
        if (!warehouseId) return '—';
        return warehousesList.find(item => item.id === warehouseId)?.name || warehouseId;
    };

    const filteredMachines = machines.filter(m => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (m.serial_number?.toLowerCase().includes(search)) ||
            (m.machine_type?.toLowerCase().includes(search)) ||
            (m.warehouse?.toLowerCase().includes(search)) ||
            (m.customer_name?.toLowerCase().includes(search)) ||
            (m.department_in_charge?.toLowerCase().includes(search))
        );

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(m.status);
        const matchesMachineType = selectedMachineTypes.length === 0 || selectedMachineTypes.includes(m.machine_type);
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(m.customer_name);
        const matchesDepartment = selectedDepartments.length === 0 || selectedDepartments.includes(m.department_in_charge);
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(m.warehouse);

        return matchesSearch && matchesStatus && matchesMachineType && matchesCustomer && matchesDepartment && matchesWarehouse;
    });

    const filteredMachinesCount = filteredMachines.length;
    const readyCount = filteredMachines.filter(m => m.status === 'sẵn sàng').length;
    const inUseCount = filteredMachines.filter(m => m.status === 'thuộc khách hàng').length;
    const maintenanceCount = filteredMachines.filter(m => m.status === 'bảo trì' || m.status === 'kiểm tra' || m.status === 'đang sửa').length;

    const hasActiveFilters = selectedStatuses.length > 0
        || selectedMachineTypes.length > 0
        || selectedCustomers.length > 0
        || selectedDepartments.length > 0
        || selectedWarehouses.length > 0;

    const totalActiveFilters = selectedStatuses.length
        + selectedMachineTypes.length
        + selectedCustomers.length
        + selectedDepartments.length
        + selectedWarehouses.length;

    const statusOptions = MACHINE_STATUSES.map(item => ({
        id: item.id,
        label: item.label,
        count: machines.filter(m => m.status === item.id).length
    }));

    const machineTypeOptions = MACHINE_TYPES.map(item => ({
        id: item.id,
        label: item.label,
        count: machines.filter(m => m.machine_type === item.id).length
    }));

    const customerOptions = uniqueCustomers.map(item => ({
        id: item,
        label: item,
        count: machines.filter(m => m.customer_name === item).length
    }));

    const departmentOptions = uniqueDepartments.map(item => ({
        id: item,
        label: item,
        count: machines.filter(m => m.department_in_charge === item).length
    }));

    const warehouseOptions = warehousesList.map(item => ({
        id: item.id,
        label: item.name,
        count: machines.filter(m => m.warehouse === item.id).length
    }));

    const clearAllFilters = () => {
        setSelectedStatuses([]);
        setSelectedMachineTypes([]);
        setSelectedCustomers([]);
        setSelectedDepartments([]);
        setSelectedWarehouses([]);
    };

    const getStatusStats = () => {
        const stats = {};
        filteredMachines.forEach(machine => {
            const statusLabel = getStatusLabel(machine.status);
            stats[statusLabel] = (stats[statusLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getMachineTypeStats = () => {
        const stats = {};
        filteredMachines.forEach(machine => {
            const typeLabel = getLabel(MACHINE_TYPES, machine.machine_type);
            stats[typeLabel] = (stats[typeLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerStats = () => {
        const stats = {};
        filteredMachines.forEach(machine => {
            const customer = machine.customer_name || '—';
            stats[customer] = (stats[customer] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getDepartmentStats = () => {
        const stats = {};
        filteredMachines.forEach(machine => {
            const dept = machine.department_in_charge || 'Không xác định';
            stats[dept] = (stats[dept] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'sẵn sàng':
                return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'thuộc khách hàng':
                return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'kiểm tra':
            case 'bảo trì':
                return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'đang sửa':
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
            case 'machineType':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            case 'customers':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            case 'departments':
                return 'border-amber-200 bg-amber-50 text-amber-700';
            case 'warehouses':
                return 'border-indigo-200 bg-indigo-50 text-indigo-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'status':
                return 'bg-blue-600 text-white';
            case 'machineType':
                return 'bg-violet-600 text-white';
            case 'customers':
                return 'bg-cyan-600 text-white';
            case 'departments':
                return 'bg-amber-600 text-white';
            case 'warehouses':
                return 'bg-indigo-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'status':
                return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'machineType':
                return isActive ? 'text-violet-700' : 'text-violet-500';
            case 'customers':
                return isActive ? 'text-cyan-700' : 'text-cyan-500';
            case 'departments':
                return isActive ? 'text-amber-700' : 'text-amber-500';
            case 'warehouses':
                return isActive ? 'text-indigo-700' : 'text-indigo-500';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getMachineTypeBadgeClass = (machineTypeId) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
        machineTypeId && 'bg-violet-50 text-violet-700 border-violet-200',
        !machineTypeId && 'bg-muted text-muted-foreground border-border'
    );

    const getRowStyle = (status) => {
        switch (status) {
            case 'sẵn sàng':
                return 'hover:bg-emerald-50/60';
            case 'thuộc khách hàng':
                return 'hover:bg-blue-50/60';
            case 'kiểm tra':
            case 'bảo trì':
                return 'hover:bg-amber-50/60';
            case 'đang sửa':
                return 'hover:bg-rose-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getSerialCellClass = (status) => clsx(
        'px-4 py-4 text-sm font-semibold text-foreground font-mono border-r border-primary/20 border-l-4',
        status === 'sẵn sàng' && 'border-l-emerald-400',
        status === 'thuộc khách hàng' && 'border-l-blue-400',
        (status === 'kiểm tra' || status === 'bảo trì') && 'border-l-amber-400',
        status === 'đang sửa' && 'border-l-rose-400',
        !status && 'border-l-transparent'
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <div className="flex items-center gap-1 mb-3 mt-1">
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
                            onClick={() => {
                                setSelectedMachine(null);
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
                        ) : filteredMachines.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredMachines.map((machine) => (
                                <div key={machine.id} className="rounded-2xl border border-primary/15 bg-white shadow-sm p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mã máy</p>
                                            <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono">{machine.serial_number}</h3>
                                        </div>
                                        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', getStatusBadgeClass(machine.status))}>
                                            {getStatusLabel(machine.status)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Loại máy</p>
                                            <p className="text-[12px] text-foreground font-medium">
                                                <span className={getMachineTypeBadgeClass(machine.machine_type)}>{getLabel(MACHINE_TYPES, machine.machine_type)}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Bộ phận</p>
                                            <p className="text-[12px] text-foreground font-medium">{machine.department_in_charge || '—'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Khách hàng</p>
                                            <p className="text-[12px] text-foreground font-medium">{machine.customer_name || '—'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <Warehouse size={12} />
                                            <span>{getWarehouseLabel(machine.warehouse)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleViewMachine(machine)} className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg"><Eye size={16} /></button>
                                            <button onClick={() => handleEditMachine(machine)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"><Edit size={16} /></button>
                                            {(role === 'admin' || role === 'manager') && (
                                                <button onClick={() => handleDeleteMachine(machine.id, machine.serial_number)} className="p-2 text-red-700 bg-red-50 border border-red-100 rounded-lg"><Trash2 size={16} /></button>
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
                                        setSelectedMachine(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} />
                                    Thêm
                                </button>

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
                                        id="machine-excel-import"
                                    />
                                    <label
                                        htmlFor="machine-excel-import"
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'machineType' ? null : 'machineType')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('machineType', activeDropdown === 'machineType' || selectedMachineTypes.length > 0)
                                    )}
                                >
                                    <Wrench size={14} className={getFilterIconClass('machineType', activeDropdown === 'machineType' || selectedMachineTypes.length > 0)} />
                                    Loại máy
                                    {selectedMachineTypes.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('machineType'))}>
                                            {selectedMachineTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'machineType' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'machineType' && (
                                    <FilterDropdown
                                        options={machineTypeOptions}
                                        selected={selectedMachineTypes}
                                        setSelected={setSelectedMachineTypes}
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'departments' ? null : 'departments')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('departments', activeDropdown === 'departments' || selectedDepartments.length > 0)
                                    )}
                                >
                                    <Activity size={14} className={getFilterIconClass('departments', activeDropdown === 'departments' || selectedDepartments.length > 0)} />
                                    Bộ phận
                                    {selectedDepartments.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('departments'))}>
                                            {selectedDepartments.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'departments' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'departments' && (
                                    <FilterDropdown
                                        options={departmentOptions}
                                        selected={selectedDepartments}
                                        setSelected={setSelectedDepartments}
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
                                ) : filteredMachines.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy máy nào
                                        </td>
                                    </tr>
                                ) : filteredMachines.map((machine) => (
                                    <tr key={machine.id} className={getRowStyle(machine.status)}>
                                        {isColumnVisible('serial_number') && <td className={getSerialCellClass(machine.status)}>{machine.serial_number}</td>}
                                        {isColumnVisible('machine_type') && <td className="px-4 py-4 text-sm text-muted-foreground">{getLabel(MACHINE_TYPES, machine.machine_type)}</td>}
                                        {isColumnVisible('warehouse') && <td className="px-4 py-4 text-sm text-muted-foreground">{getWarehouseLabel(machine.warehouse)}</td>}
                                        {isColumnVisible('customer_name') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{machine.customer_name || '—'}</td>}
                                        {isColumnVisible('status') && (
                                            <td className="px-4 py-4">
                                                <span className={clsx('inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border', getStatusBadgeClass(machine.status))}>
                                                    {getStatusLabel(machine.status)}
                                                </span>
                                            </td>
                                        )}
                                        {isColumnVisible('department_in_charge') && <td className="px-4 py-4 text-sm text-muted-foreground">{machine.department_in_charge || '—'}</td>}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleViewMachine(machine)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditMachine(machine)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button onClick={() => handleDeleteMachine(machine.id, machine.serial_number)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
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
                            <span>{filteredMachines.length > 0 ? `1–${filteredMachines.length}` : '0'}/Tổng {filteredMachines.length}</span>
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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'machineType' ? null : 'machineType')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('machineType', activeDropdown === 'machineType' || selectedMachineTypes.length > 0)
                                        )}
                                    >
                                        <Wrench size={14} className={getFilterIconClass('machineType', activeDropdown === 'machineType' || selectedMachineTypes.length > 0)} />
                                        Loại máy
                                        {selectedMachineTypes.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('machineType'))}>
                                                {selectedMachineTypes.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'machineType' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'machineType' && (
                                        <FilterDropdown
                                            options={machineTypeOptions}
                                            selected={selectedMachineTypes}
                                            setSelected={setSelectedMachineTypes}
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'departments' ? null : 'departments')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('departments', activeDropdown === 'departments' || selectedDepartments.length > 0)
                                        )}
                                    >
                                        <Activity size={14} className={getFilterIconClass('departments', activeDropdown === 'departments' || selectedDepartments.length > 0)} />
                                        Bộ phận
                                        {selectedDepartments.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('departments'))}>
                                                {selectedDepartments.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'departments' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'departments' && (
                                        <FilterDropdown
                                            options={departmentOptions}
                                            selected={selectedDepartments}
                                            setSelected={setSelectedDepartments}
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

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng máy</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredMachinesCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Sẵn sàng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(readyCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Đang dùng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(inUseCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-rose-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                                            <Wrench className="w-5 h-5 md:w-6 md:h-6 text-rose-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Bảo trì</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-rose-900 mt-0.5 md:mt-1 leading-none">{formatNumber(maintenanceCount)}</p>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại máy</h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getMachineTypeStats().map(item => item.name),
                                                datasets: [{
                                                    data: getMachineTypeStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getMachineTypeStats().length),
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Khách hàng</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getCustomerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số máy',
                                                    data: getCustomerStats().map(item => item.value),
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

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Bộ phận phụ trách</h3>
                                    <div style={{ height: '300px' }}>
                                        <BarChartJS
                                            data={{
                                                labels: getDepartmentStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                                datasets: [{
                                                    label: 'Số máy',
                                                    data: getDepartmentStats().map(item => item.value),
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
                            id: 'machineType',
                            label: 'Loại máy',
                            icon: <Wrench size={16} className="text-violet-600" />,
                            options: machineTypeOptions,
                            selectedValues: pendingMachineTypes,
                            onSelectionChange: setPendingMachineTypes,
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
                            id: 'departments',
                            label: 'Bộ phận',
                            icon: <Activity size={16} className="text-amber-600" />,
                            options: departmentOptions,
                            selectedValues: pendingDepartments,
                            onSelectionChange: setPendingDepartments,
                        },
                        {
                            id: 'warehouses',
                            label: 'Kho',
                            icon: <Warehouse size={16} className="text-indigo-600" />,
                            options: warehouseOptions,
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses,
                        },
                    ]}
                />
            )}

            {isFormModalOpen && (
                <MachineFormModal
                    machine={selectedMachine}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedMachine && (
                <MachineDetailsModal
                    machine={selectedMachine}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Machines;
