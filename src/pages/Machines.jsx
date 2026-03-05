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
    ChevronDown,
    Edit,
    Eye,
    Filter,
    Plus,
    Search,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import MachineDetailsModal from '../components/Machines/MachineDetailsModal';
import MachineFormModal from '../components/Machines/MachineFormModal';
import { MACHINE_STATUSES, MACHINE_TYPES } from '../constants/machineConstants';
import { WAREHOUSES } from '../constants/orderConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';

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

// 5 required columns: Mã máy, Loại máy, Tên khách hàng, Trạng thái, Tên đơn vị / KD phụ trách
const TABLE_COLUMNS = [
    { key: 'serial_number', label: 'Mã Máy (Serial)' },
    { key: 'machine_type', label: 'Loại Máy' },
    { key: 'warehouse', label: 'Kho Quản Lý' },
    { key: 'customer_name', label: 'Tên Khách Hàng' },
    { key: 'status', label: 'Trạng Thái' },
    { key: 'department_in_charge', label: 'Bộ Phận Phụ Trách' },
];

// MACHINE_STATUSES removed as it is now imported

const Machines = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [machines, setMachines] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_machines', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedMachineTypes, setSelectedMachineTypes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedDepartments, setSelectedDepartments] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueDepartments, setUniqueDepartments] = useState([]);

    useEffect(() => {
        fetchMachines();
    }, []);

    useEffect(() => {
        // Extract unique values for filters
        const customers = [...new Set(machines.map(m => m.customer_name).filter(Boolean))];
        const departments = [...new Set(machines.map(m => m.department_in_charge).filter(Boolean))];
        setUniqueCustomers(customers);
        setUniqueDepartments(departments);
    }, [machines]);

    const fetchMachines = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .order('created_at', { ascending: false });

            // Ignore table missing error during UI development if not yet created.
            if (error && error.code !== '42P01') throw error;
            setMachines(data || []);
        } catch (error) {
            console.error('Error fetching machines:', error);
            // alert('❌ Lỗi tải thiết bị: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteMachine = async (id, serial_number) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa máy có mã ${serial_number} này không? Chú ý: Hành động này không thể hoàn tác.`)) {
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

    const handleCreateNew = () => {
        setSelectedMachine(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchMachines();
        setIsFormModalOpen(false);
    };

    // Filter Dropdown Component
    const FilterDropdown = ({ label, selectedCount, totalCount, onSelectAll, children }) => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-[#D1D5DB] bg-white text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-all"
                    style={{ fontFamily: '"Roboto", sans-serif' }}
                >
                    <Filter className="w-4 h-4" />
                    <span>{label}</span>
                    {selectedCount > 0 && (
                        <span className="px-2 py-0.5 bg-[#2563EB] text-white text-xs rounded-full">
                            {selectedCount}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        ></div>
                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] shadow-lg z-20 min-w-[250px] max-h-80">
                            <div className="p-3 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
                                <span className="text-sm font-medium text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                    {selectedCount > 0 ? `Đã chọn ${selectedCount}/${totalCount}` : `Chọn ${label.toLowerCase()}`}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectAll();
                                    }}
                                    className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                                    style={{ fontFamily: '"Roboto", sans-serif' }}
                                >
                                    {selectedCount === totalCount ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>
                            <div className="overflow-y-auto max-h-64">
                                {children}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    // Calculate statistics data for charts
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
            const customer = machine.customer_name || 'Sẵn sàng xuất kho';
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

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusStyle = (status) => {
        switch (status) {
            case 'sẵn sàng':
            case 'Dang_su_dung':
            case 'thuộc khách hàng': return "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-white";
            case 'kiểm tra':
            case 'bảo trì': return "bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-white";
            case 'đang sửa':
            case 'Hong': return "bg-rose-50 text-rose-500 border-rose-100 group-hover:bg-white";
            default: return "bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-white";
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const getLabel = (list, id) => {
        return list.find(item => item.id === id)?.label || id;
    };

    const getStatusLabel = (status) => {
        const item = MACHINE_STATUSES.find(s => s.id === status);
        return item ? item.label : status;
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

        // Filter by status
        const matchesStatus = selectedStatuses.length === 0 ||
            selectedStatuses.includes(m.status);

        // Filter by machine type
        const matchesMachineType = selectedMachineTypes.length === 0 ||
            selectedMachineTypes.includes(m.machine_type);

        // Filter by customer
        const matchesCustomer = selectedCustomers.length === 0 ||
            selectedCustomers.includes(m.customer_name);

        // Filter by department
        const matchesDepartment = selectedDepartments.length === 0 ||
            selectedDepartments.includes(m.department_in_charge);

        // Filter by warehouse
        const matchesWarehouse = selectedWarehouses.length === 0 ||
            selectedWarehouses.includes(m.warehouse);

        return matchesSearch && matchesStatus && matchesMachineType &&
            matchesCustomer && matchesDepartment && matchesWarehouse;
    });

    // Calculate totals
    const filteredMachinesCount = filteredMachines.length;
    const readyCount = filteredMachines.filter(m => m.status === 'sẵn sàng').length;
    const inUseCount = filteredMachines.filter(m => m.status === 'thuộc khách hàng').length;
    const maintenanceCount = filteredMachines.filter(m => m.status === 'bảo trì' || m.status === 'kiểm tra' || m.status === 'đang sửa').length;

    return (
        <div className="p-6 bg-[#F8F9FA] min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mb-8 border-b border-[#E5E7EB]">
                <button
                    onClick={() => setActiveView('list')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${activeView === 'list'
                            ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                            : 'text-[#6B7280] hover:text-[#374151]'
                        }`}
                    style={activeView === 'list' ? { color: '#2563EB', borderBottomColor: '#2563EB' } : { color: '#6B7280' }}
                >
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${activeView === 'stats'
                            ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                            : 'text-[#6B7280] hover:text-[#374151]'
                        }`}
                    style={activeView === 'stats' ? { color: '#2563EB', borderBottomColor: '#2563EB' } : { color: '#6B7280' }}
                >
                    Thống kê
                </button>
            </div>

            {activeView === 'list' ? (
                <>
                    {/* Header with Add Button */}
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách máy móc</h1>
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-5 py-2.5 text-white font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-md"
                            style={{ backgroundColor: '#2563EB' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#1D4ED8'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
                        >
                            <Plus className="w-4 h-4" />
                            Thêm
                        </button>
                    </div>

                    {/* Search Bar and Summary Stats - Same Row */}
                    <div className="mb-6 flex items-center gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                            <input
                                type="text"
                                placeholder="Tìm theo mã máy, loại máy, khách hàng..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số máy:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredMachinesCount}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Sẵn sàng:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{readyCount}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang sử dụng:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{inUseCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        {/* Trạng thái Dropdown */}
                        <FilterDropdown
                            label="Trạng thái"
                            selectedCount={selectedStatuses.length}
                            totalCount={MACHINE_STATUSES.length}
                            onSelectAll={() => {
                                if (selectedStatuses.length === MACHINE_STATUSES.length) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses(MACHINE_STATUSES.map(s => s.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {MACHINE_STATUSES.map(status => (
                                    <label key={status.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedStatuses.includes(status.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStatuses([...selectedStatuses, status.id]);
                                                } else {
                                                    setSelectedStatuses(selectedStatuses.filter(id => id !== status.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{status.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Loại máy Dropdown */}
                        <FilterDropdown
                            label="Loại máy"
                            selectedCount={selectedMachineTypes.length}
                            totalCount={MACHINE_TYPES.length}
                            onSelectAll={() => {
                                if (selectedMachineTypes.length === MACHINE_TYPES.length) {
                                    setSelectedMachineTypes([]);
                                } else {
                                    setSelectedMachineTypes(MACHINE_TYPES.map(t => t.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {MACHINE_TYPES.map(type => (
                                    <label key={type.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedMachineTypes.includes(type.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedMachineTypes([...selectedMachineTypes, type.id]);
                                                } else {
                                                    setSelectedMachineTypes(selectedMachineTypes.filter(id => id !== type.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{type.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Khách hàng Dropdown */}
                        <FilterDropdown
                            label="Khách hàng"
                            selectedCount={selectedCustomers.length}
                            totalCount={uniqueCustomers.length}
                            onSelectAll={() => {
                                if (selectedCustomers.length === uniqueCustomers.length) {
                                    setSelectedCustomers([]);
                                } else {
                                    setSelectedCustomers([...uniqueCustomers]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueCustomers.map(customer => (
                                    <label key={customer} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomers.includes(customer)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCustomers([...selectedCustomers, customer]);
                                                } else {
                                                    setSelectedCustomers(selectedCustomers.filter(c => c !== customer));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={customer}>{customer}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Bộ phận phụ trách Dropdown */}
                        <FilterDropdown
                            label="Bộ phận phụ trách"
                            selectedCount={selectedDepartments.length}
                            totalCount={uniqueDepartments.length}
                            onSelectAll={() => {
                                if (selectedDepartments.length === uniqueDepartments.length) {
                                    setSelectedDepartments([]);
                                } else {
                                    setSelectedDepartments([...uniqueDepartments]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueDepartments.map(dept => (
                                    <label key={dept} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedDepartments.includes(dept)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedDepartments([...selectedDepartments, dept]);
                                                } else {
                                                    setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={dept}>{dept}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Kho quản lý Dropdown */}
                        <FilterDropdown
                            label="Kho quản lý"
                            selectedCount={selectedWarehouses.length}
                            totalCount={WAREHOUSES.length}
                            onSelectAll={() => {
                                if (selectedWarehouses.length === WAREHOUSES.length) {
                                    setSelectedWarehouses([]);
                                } else {
                                    setSelectedWarehouses(WAREHOUSES.map(w => w.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {WAREHOUSES.map(wh => (
                                    <label key={wh.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedWarehouses.includes(wh.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedWarehouses([...selectedWarehouses, wh.id]);
                                                } else {
                                                    setSelectedWarehouses(selectedWarehouses.filter(id => id !== wh.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{wh.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>
                    </div>

                    {/* Main Content Card */}
                    <div className="bg-white border border-[#E5E7EB] shadow-sm">
                        {/* Table Section */}
                        <div className="w-full overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-[#F9FAFB]">
                                    <tr>
                                        {visibleTableColumns.map(col => (
                                            <th key={col.key} className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-left uppercase tracking-wider">
                                                {col.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-center uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E7EB]">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredMachines.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Activity className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy máy nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredMachines.map((m) => (
                                        <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            {isColumnVisible('serial_number') && <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {m.serial_number}
                                                </span>
                                            </td>}
                                            {isColumnVisible('machine_type') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{getLabel(MACHINE_TYPES, m.machine_type)}</td>}
                                            {isColumnVisible('warehouse') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{getLabel(WAREHOUSES, m.warehouse) || '—'}</td>}
                                            {isColumnVisible('customer_name') && <td className="px-4 py-4">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {m.customer_name || 'Sẵn sàng xuất kho'}
                                                </span>
                                            </td>}
                                            {isColumnVisible('status') && <td className="px-4 py-4">
                                                <span
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium border"
                                                    style={(() => {
                                                        const colorMap = {
                                                            'sẵn sàng': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'thuộc khách hàng': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'kiểm tra': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'bảo trì': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'đang sửa': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
                                                            'chưa xác định': { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' }
                                                        };
                                                        const colors = colorMap[m.status] || colorMap['chưa xác định'];
                                                        return {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            borderColor: colors.border,
                                                            fontFamily: '"Roboto", sans-serif'
                                                        };
                                                    })()}
                                                >
                                                    {getStatusLabel(m.status)}
                                                </span>
                                            </td>}
                                            {isColumnVisible('department_in_charge') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{m.department_in_charge || '—'}</td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewMachine(m)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditMachine(m)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMachine(m.id, m.serial_number)}
                                                        className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors p-1 hover:bg-[#FEF2F2]"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                /* Statistics View */
                <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số máy</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredMachinesCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Sẵn sàng</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{readyCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang sử dụng</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{inUseCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Bảo trì/Kiểm tra</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{maintenanceCount}</div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Trạng thái</h3>
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
                                        plugins: {
                                            legend: {
                                                position: 'bottom'
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Machine Type Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại máy</h3>
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
                                        plugins: {
                                            legend: {
                                                position: 'bottom'
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Top Customers Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Khách hàng</h3>
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
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            x: {
                                                beginAtZero: true
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Top Departments Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Bộ phận phụ trách</h3>
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
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            x: {
                                                beginAtZero: true
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
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
