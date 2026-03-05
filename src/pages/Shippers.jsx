import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend as ChartLegend
} from 'chart.js';
import { Bar as BarChartJS, Pie as PieChartJS, Line as LineChartJS } from 'react-chartjs-2';
import {
    ActivitySquare,
    CheckCircle2,
    ChevronDown,
    Edit,
    Eye,
    Filter,
    Package,
    Plus,
    Search,
    Trash2,
    Truck,
    XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import ShipperDetailsModal from '../components/Shippers/ShipperDetailsModal';
import ShipperFormModal from '../components/Shippers/ShipperFormModal';
import { SHIPPING_TYPES, SHIPPER_STATUSES } from '../constants/shipperConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
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
    { key: 'name', label: 'Đơn vị vận chuyển' },
    { key: 'type', label: 'Loại hình' },
    { key: 'manager', label: 'Người quản lý' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'address', label: 'Địa chỉ' },
    { key: 'status', label: 'Trạng thái' },
];

const Shippers = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [shippers, setShippers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedShipper, setSelectedShipper] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_shippers', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));
    
    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);
    const [uniqueManagers, setUniqueManagers] = useState([]);

    useEffect(() => {
        fetchShippers();
    }, []);

    useEffect(() => {
        // Extract unique managers for filters
        const managers = [...new Set(shippers.map(s => s.manager_name).filter(Boolean))];
        setUniqueManagers(managers);
    }, [shippers]);

    const fetchShippers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shippers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setShippers(data || []);
        } catch (error) {
            console.error('Error fetching shippers:', error);
            alert('Lỗi khi tải dữ liệu đơn vị vận chuyển!');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteShipper = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa hệ thống đối tác "${name}" không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('shippers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchShippers();
        } catch (error) {
            console.error('Error deleting shipper:', error);
            alert('❌ Có lỗi xảy ra khi xóa đơn vị vận chuyển: ' + error.message);
        }
    };

    const handleEditShipper = (shipper) => {
        setSelectedShipper(shipper);
        setIsFormModalOpen(true);
    };

    const handleViewShipper = (shipper) => {
        setSelectedShipper(shipper);
        setIsDetailsModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedShipper(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchShippers();
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
        filteredShippers.forEach(shipper => {
            stats[shipper.status] = (stats[shipper.status] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTypeStats = () => {
        const stats = {};
        filteredShippers.forEach(shipper => {
            const typeLabel = getLabel(SHIPPING_TYPES, shipper.shipping_type);
            stats[typeLabel] = (stats[typeLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getManagerStats = () => {
        const stats = {};
        filteredShippers.forEach(shipper => {
            const manager = shipper.manager_name || 'Không xác định';
            stats[manager] = (stats[manager] || 0) + 1;
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
            case 'Đang hoạt động':
                return 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-white';
            case 'Tạm ngưng':
                return 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-white';
            case 'Ngừng hợp tác':
                return 'bg-rose-50 text-rose-500 border-rose-100 group-hover:bg-white';
            default:
                return 'bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-white';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Đang hoạt động':
                return <CheckCircle2 className="w-3.5 h-3.5 mr-2" />;
            case 'Tạm ngưng':
                return <ActivitySquare className="w-3.5 h-3.5 mr-2" />;
            case 'Ngừng hợp tác':
                return <XCircle className="w-3.5 h-3.5 mr-2" />;
            default:
                return null;
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const getLabel = (list, id) => {
        return list.find(item => item.id === id)?.label || id;
    };

    const filteredShippers = shippers.filter(shipper => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            shipper.name?.toLowerCase().includes(search) ||
            shipper.manager_name?.toLowerCase().includes(search) ||
            shipper.phone?.includes(search) ||
            shipper.address?.toLowerCase().includes(search)
        );

        // Filter by status
        const matchesStatus = selectedStatuses.length === 0 || 
            selectedStatuses.includes(shipper.status);
        
        // Filter by type
        const matchesType = selectedTypes.length === 0 || 
            selectedTypes.includes(shipper.shipping_type);
        
        // Filter by manager
        const matchesManager = selectedManagers.length === 0 || 
            selectedManagers.includes(shipper.manager_name);

        return matchesSearch && matchesStatus && matchesType && matchesManager;
    });

    // Calculate totals
    const filteredShippersCount = filteredShippers.length;
    const activeCount = filteredShippers.filter(s => s.status === 'Đang hoạt động').length;
    const suspendedCount = filteredShippers.filter(s => s.status === 'Tạm ngưng').length;

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="p-6 bg-[#F8F9FA] min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mb-8 border-b border-[#E5E7EB]">
                <button
                    onClick={() => setActiveView('list')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${
                        activeView === 'list' 
                            ? 'text-[#2563EB] border-b-2 border-[#2563EB]' 
                            : 'text-[#6B7280] hover:text-[#374151]'
                    }`}
                    style={activeView === 'list' ? { color: '#2563EB', borderBottomColor: '#2563EB' } : { color: '#6B7280' }}
                >
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={`px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${
                        activeView === 'stats' 
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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách đơn vị vận chuyển</h1>
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
                                placeholder="Tìm theo tên, người quản lý, SĐT, địa chỉ..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Số lượng DVVC:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredShippersCount}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang hoạt động:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{activeCount}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tạm ngưng:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{suspendedCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        {/* Trạng thái Dropdown */}
                        <FilterDropdown
                            label="Trạng thái"
                            selectedCount={selectedStatuses.length}
                            totalCount={SHIPPER_STATUSES.length}
                            onSelectAll={() => {
                                if (selectedStatuses.length === SHIPPER_STATUSES.length) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses(SHIPPER_STATUSES.map(s => s.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {SHIPPER_STATUSES.map(status => (
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

                        {/* Loại hình Dropdown */}
                        <FilterDropdown
                            label="Loại hình"
                            selectedCount={selectedTypes.length}
                            totalCount={SHIPPING_TYPES.length}
                            onSelectAll={() => {
                                if (selectedTypes.length === SHIPPING_TYPES.length) {
                                    setSelectedTypes([]);
                                } else {
                                    setSelectedTypes(SHIPPING_TYPES.map(t => t.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {SHIPPING_TYPES.map(type => (
                                    <label key={type.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedTypes.includes(type.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedTypes([...selectedTypes, type.id]);
                                                } else {
                                                    setSelectedTypes(selectedTypes.filter(id => id !== type.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{type.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Người quản lý Dropdown */}
                        <FilterDropdown
                            label="Người quản lý"
                            selectedCount={selectedManagers.length}
                            totalCount={uniqueManagers.length}
                            onSelectAll={() => {
                                if (selectedManagers.length === uniqueManagers.length) {
                                    setSelectedManagers([]);
                                } else {
                                    setSelectedManagers([...uniqueManagers]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueManagers.map(manager => (
                                    <label key={manager} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedManagers.includes(manager)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedManagers([...selectedManagers, manager]);
                                                } else {
                                                    setSelectedManagers(selectedManagers.filter(m => m !== manager));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={manager}>{manager}</span>
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
                                    {loading ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredShippers.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Truck className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy đơn vị vận chuyển nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredShippers.map((shipper, index) => (
                                        <tr key={shipper.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{index + 1}</span>
                                            </td>
                                            {isColumnVisible('name') && <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gradient-to-tr from-[#374151] to-[#111827] text-white text-xs font-semibold flex items-center justify-center" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        {getInitials(shipper.name)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{shipper.name}</div>
                                                        <div className="text-xs text-[#6B7280] mt-0.5" style={{ fontFamily: '"Roboto", sans-serif' }}>ID: {shipper.id.substring(0, 8)}</div>
                                                    </div>
                                                </div>
                                            </td>}
                                            {isColumnVisible('type') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                {getLabel(SHIPPING_TYPES, shipper.shipping_type)}
                                            </td>}
                                            {isColumnVisible('manager') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{shipper.manager_name}</td>}
                                            {isColumnVisible('phone') && <td className="px-4 py-4">
                                                <span className="text-sm font-medium text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{shipper.phone}</span>
                                            </td>}
                                            {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }} title={shipper.address}>{shipper.address}</td>}
                                            {isColumnVisible('status') && <td className="px-4 py-4">
                                                <span 
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium border"
                                                    style={(() => {
                                                        const colorMap = {
                                                            'Đang hoạt động': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'Tạm ngưng': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'Ngừng hợp tác': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' }
                                                        };
                                                        const colors = colorMap[shipper.status] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
                                                        return {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            borderColor: colors.border,
                                                            fontFamily: '"Roboto", sans-serif'
                                                        };
                                                    })()}
                                                >
                                                    {getStatusIcon(shipper.status)}
                                                    {shipper.status}
                                                </span>
                                            </td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewShipper(shipper)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditShipper(shipper)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteShipper(shipper.id, shipper.name)}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số DVVC</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredShippersCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang hoạt động</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{activeCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tạm ngưng</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{suspendedCount}</div>
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

                        {/* Type Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại hình</h3>
                            <div style={{ height: '300px' }}>
                                <PieChartJS
                                    data={{
                                        labels: getTypeStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            data: getTypeStats().map(item => item.value),
                                            backgroundColor: chartColors.slice(0, getTypeStats().length),
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

                        {/* Manager Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Người quản lý</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getManagerStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số DVVC',
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
                <ShipperFormModal
                    shipper={selectedShipper}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {isDetailsModalOpen && selectedShipper && (
                <ShipperDetailsModal
                    shipper={selectedShipper}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};


export default Shippers;
