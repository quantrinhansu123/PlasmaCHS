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
    ActivitySquare,
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
import CylinderDetailsModal from '../components/Cylinders/CylinderDetailsModal';
import CylinderFormModal from '../components/Cylinders/CylinderFormModal';
import CylinderQCDialog from '../components/Cylinders/CylinderQCDialog';
import { CYLINDER_STATUSES } from '../constants/machineConstants';
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

const TABLE_COLUMNS = [
    { key: 'serial_number', label: 'Mã RFID (Serial)' },
    { key: 'volume', label: 'Thể tích / Loại bình' },
    { key: 'customer_name', label: 'Tên Khách Hàng / Vị trí' },
    { key: 'status', label: 'Trạng Thái' },
];

const Cylinders = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [cylinders, setCylinders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isQCModalOpen, setIsQCModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCylinder, setSelectedCylinder] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_cylinders', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedVolumes, setSelectedVolumes] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [uniqueCustomers, setUniqueCustomers] = useState([]);
    const [uniqueVolumes, setUniqueVolumes] = useState([]);

    useEffect(() => {
        fetchCylinders();
    }, []);

    useEffect(() => {
        // Extract unique values for filters
        const customers = [...new Set(cylinders.map(c => c.customer_name).filter(Boolean))];
        const volumes = [...new Set(cylinders.map(c => c.volume).filter(Boolean))];
        setUniqueCustomers(customers);
        setUniqueVolumes(volumes);
    }, [cylinders]);

    const fetchCylinders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('cylinders')
                .select('*')
                .order('created_at', { ascending: false });

            // Ignore missing table error during setup
            if (error && error.code !== '42P01') throw error;
            setCylinders(data || []);
        } catch (error) {
            console.error('Error fetching cylinders:', error);
            // alert('❌ Lỗi tải thiết bị: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCylinder = async (id, serial_number) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa bình khí có mã ${serial_number} này không? Chú ý: Hành động này không thể hoàn tác.`)) {
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

    const handleCreateNew = () => {
        setSelectedCylinder(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchCylinders();
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

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusStyle = (status) => {
        switch (status) {
            case 'sẵn sàng': return "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-white";
            case 'đang sử dụng':
            case 'đã sử dụng':
            case 'thuộc khách hàng': return "bg-sky-50 text-sky-600 border-sky-100 group-hover:bg-white";
            case 'đang vận chuyển': return "bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-white";
            case 'chờ nạp':
            case 'bình rỗng': return "bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-white";
            case 'hỏng': return "bg-rose-50 text-rose-500 border-rose-100 group-hover:bg-white";
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
        const item = CYLINDER_STATUSES.find(s => s.id === status);
        return item ? item.label : status;
    };

    const filteredCylinders = cylinders.filter(c => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (c.serial_number?.toLowerCase().includes(search)) ||
            (c.volume?.toLowerCase().includes(search)) ||
            (c.customer_name?.toLowerCase().includes(search))
        );

        // Filter by status
        const matchesStatus = selectedStatuses.length === 0 ||
            selectedStatuses.includes(c.status);

        // Filter by volume
        const matchesVolume = selectedVolumes.length === 0 ||
            selectedVolumes.includes(c.volume);

        // Filter by customer
        const matchesCustomer = selectedCustomers.length === 0 ||
            selectedCustomers.includes(c.customer_name);

        // Filter by category
        const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.includes(c.category);

        return matchesSearch && matchesStatus && matchesVolume &&
            matchesCustomer && matchesCategory;
    });

    // Calculate totals
    const filteredCylindersCount = filteredCylinders.length;
    const readyCount = filteredCylinders.filter(c => c.status === 'sẵn sàng').length;
    const inUseCount = filteredCylinders.filter(c => c.status === 'đang sử dụng' || c.status === 'thuộc khách hàng').length;
    const emptyCount = filteredCylinders.filter(c => c.status === 'bình rỗng' || c.status === 'chờ nạp').length;

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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách bình khí</h1>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCreateNew}
                                className="flex items-center gap-2 px-5 py-2.5 text-white font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-md rounded-md"
                                style={{ backgroundColor: '#2563EB' }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#1D4ED8'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
                            >
                                <Plus className="w-4 h-4" />
                                Thêm
                            </button>
                        </div>
                    </div>

                    {/* Search Bar and Summary Stats - Same Row */}
                    <div className="mb-6 flex items-center gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                            <input
                                type="text"
                                placeholder="Tìm theo mã RFID, loại bình, khách hàng..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số bình:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredCylindersCount}</span>
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
                            totalCount={CYLINDER_STATUSES.length}
                            onSelectAll={() => {
                                if (selectedStatuses.length === CYLINDER_STATUSES.length) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses(CYLINDER_STATUSES.map(s => s.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {CYLINDER_STATUSES.map(status => (
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

                        {/* Thể tích Dropdown */}
                        <FilterDropdown
                            label="Thể tích"
                            selectedCount={selectedVolumes.length}
                            totalCount={uniqueVolumes.length}
                            onSelectAll={() => {
                                if (selectedVolumes.length === uniqueVolumes.length) {
                                    setSelectedVolumes([]);
                                } else {
                                    setSelectedVolumes([...uniqueVolumes]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueVolumes.map(volume => (
                                    <label key={volume} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedVolumes.includes(volume)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedVolumes([...selectedVolumes, volume]);
                                                } else {
                                                    setSelectedVolumes(selectedVolumes.filter(v => v !== volume));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={volume}>{volume}</span>
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

                        {/* Category Dropdown */}
                        <FilterDropdown
                            label="Phân loại"
                            selectedCount={selectedCategories.length}
                            totalCount={2}
                            onSelectAll={() => {
                                if (selectedCategories.length === 2) {
                                    setSelectedCategories([]);
                                } else {
                                    setSelectedCategories(['BV', 'TM']);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {['BV', 'TM'].map(cat => (
                                    <label key={cat} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCategories([...selectedCategories, cat]);
                                                } else {
                                                    setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{cat}</span>
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
                                        <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-center uppercase tracking-wider w-16">STT</th>
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
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredCylinders.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <ActivitySquare className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy bình nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredCylinders.map((c, idx) => (
                                        <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{idx + 1}</span>
                                            </td>
                                            {isColumnVisible('serial_number') && <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        {c.serial_number}
                                                    </span>
                                                    {c.category && <span className="text-xs text-[#6B7280] mt-1" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân loại: {c.category}</span>}
                                                </div>
                                            </td>}
                                            {isColumnVisible('volume') && <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.volume || '—'}</span>
                                                    {c.net_weight && <span className="text-xs text-[#6B7280] mt-1" style={{ fontFamily: '"Roboto", sans-serif' }}>Trọng lượng: {c.net_weight} kg</span>}
                                                </div>
                                            </td>}
                                            {isColumnVisible('customer_name') && <td className="px-4 py-4">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {c.customer_name || 'Vỏ bình tại kho'}
                                                </span>
                                            </td>}
                                            {isColumnVisible('status') && <td className="px-4 py-4">
                                                <span
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium border"
                                                    style={(() => {
                                                        const colorMap = {
                                                            'sẵn sàng': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'đang sử dụng': { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' },
                                                            'thuộc khách hàng': { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' },
                                                            'đang vận chuyển': { bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' },
                                                            'chờ nạp': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'bình rỗng': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'hỏng': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
                                                            'đã sử dụng': { bg: '#CFFAFE', text: '#0E7490', border: '#A5F3FC' }
                                                        };
                                                        const colors = colorMap[c.status] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
                                                        return {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            borderColor: colors.border,
                                                            fontFamily: '"Roboto", sans-serif'
                                                        };
                                                    })()}
                                                >
                                                    {getStatusLabel(c.status)}
                                                </span>
                                            </td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewCylinder(c)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditCylinder(c)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCylinder(c.id, c.serial_number)}
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
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số bình</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredCylindersCount}</div>
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
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Bình rỗng/Chờ nạp</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{emptyCount}</div>
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

                        {/* Volume Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Thể tích</h3>
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
                                        plugins: {
                                            legend: {
                                                position: 'bottom'
                                            }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Category Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Phân loại</h3>
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
                                        plugins: {
                                            legend: {
                                                display: false
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true
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
