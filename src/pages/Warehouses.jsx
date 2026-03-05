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
    ChevronDown,
    Edit,
    Eye,
    Filter,
    Plus,
    Search,
    Trash2,
    Warehouse
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import WarehouseDetailsModal from '../components/Warehouses/WarehouseDetailsModal';
import WarehouseFormModal from '../components/Warehouses/WarehouseFormModal';
import { WAREHOUSE_STATUSES } from '../constants/warehouseConstants';
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
    { key: 'name', label: 'Tên Kho' },
    { key: 'manager_name', label: 'Thủ Kho' },
    { key: 'address', label: 'Địa Chỉ' },
    { key: 'capacity', label: 'Sức Chứa' },
    { key: 'status', label: 'Trạng Thái' }
];

const Warehouses = () => {
    const navigate = useNavigate();
    const { role } = usePermissions();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_warehouses', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));
    
    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedManagers, setSelectedManagers] = useState([]);
    const [uniqueManagers, setUniqueManagers] = useState([]);

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        // Extract unique managers for filters
        const managers = [...new Set(warehouses.map(w => w.manager_name).filter(Boolean))];
        setUniqueManagers(managers);
    }, [warehouses]);

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error && error.code !== '42P01') throw error;
            setWarehouses(data || []);
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteWarehouse = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa kho "${name}" không?`)) {
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

    const handleCreateNew = () => {
        setSelectedWarehouse(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchWarehouses();
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
        filteredWarehouses.forEach(warehouse => {
            stats[warehouse.status] = (stats[warehouse.status] || 0) + 1;
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
            .sort((a, b) => b.value - a.value);
    };

    const getCapacityStats = () => {
        return filteredWarehouses
            .map(w => ({ name: w.name, value: w.capacity || 0 }))
            .sort((a, b) => b.value - a.value);
    };

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Đang hoạt động': return "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-white";
            case 'Tạm ngưng': return "bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-white";
            case 'Đóng cửa': return "bg-rose-50 text-rose-500 border-rose-100 group-hover:bg-white";
            default: return "bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-white";
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const filteredWarehouses = warehouses.filter(w => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (w.name?.toLowerCase().includes(search)) ||
            (w.manager_name?.toLowerCase().includes(search)) ||
            (w.address?.toLowerCase().includes(search))
        );

        // Filter by status
        const matchesStatus = selectedStatuses.length === 0 || 
            selectedStatuses.includes(w.status);
        
        // Filter by manager
        const matchesManager = selectedManagers.length === 0 || 
            selectedManagers.includes(w.manager_name);

        return matchesSearch && matchesStatus && matchesManager;
    });

    // Calculate totals
    const filteredWarehousesCount = filteredWarehouses.length;
    const totalCapacity = filteredWarehouses.reduce((sum, w) => sum + (w.capacity || 0), 0);
    const activeCount = filteredWarehouses.filter(w => w.status === 'Đang hoạt động').length;

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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách kho hàng</h1>
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
                                placeholder="Tìm theo tên kho, thủ kho, địa chỉ..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Số lượng kho:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredWarehousesCount}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng sức chứa:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalCapacity)}</span>
                            </div>
                            <div className="w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang hoạt động:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{activeCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        {/* Trạng thái Dropdown */}
                        <FilterDropdown
                            label="Trạng thái"
                            selectedCount={selectedStatuses.length}
                            totalCount={WAREHOUSE_STATUSES.length}
                            onSelectAll={() => {
                                if (selectedStatuses.length === WAREHOUSE_STATUSES.length) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses(WAREHOUSE_STATUSES.map(s => s.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {WAREHOUSE_STATUSES.map(status => (
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

                        {/* Thủ kho Dropdown */}
                        <FilterDropdown
                            label="Thủ kho"
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
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredWarehouses.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Warehouse className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy kho nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredWarehouses.map((w, idx) => (
                                        <tr key={w.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{idx + 1}</span>
                                            </td>
                                            {isColumnVisible('name') && <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {w.name}
                                                </span>
                                            </td>}
                                            {isColumnVisible('manager_name') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{w.manager_name}</td>}
                                            {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }} title={w.address}>{w.address}</td>}
                                            {isColumnVisible('capacity') && <td className="px-4 py-4">
                                                <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {formatNumber(w.capacity || 0)} <span className="text-xs text-[#6B7280] font-normal">vỏ bình</span>
                                                </span>
                                            </td>}
                                            {isColumnVisible('status') && <td className="px-4 py-4">
                                                <span 
                                                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium border"
                                                    style={(() => {
                                                        const colorMap = {
                                                            'Đang hoạt động': { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
                                                            'Tạm ngưng': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
                                                            'Đóng cửa': { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' }
                                                        };
                                                        const colors = colorMap[w.status] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
                                                        return {
                                                            backgroundColor: colors.bg,
                                                            color: colors.text,
                                                            borderColor: colors.border,
                                                            fontFamily: '"Roboto", sans-serif'
                                                        };
                                                    })()}
                                                >
                                                    {w.status}
                                                </span>
                                            </td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewWarehouse(w)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditWarehouse(w)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteWarehouse(w.id, w.name)}
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
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số kho</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredWarehousesCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng sức chứa</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalCapacity)}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang hoạt động</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{activeCount}</div>
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

                        {/* Manager Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Thủ kho</h3>
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

                        {/* Capacity Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Sức chứa theo Kho</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getCapacityStats().map(item => item.name),
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
                                            legend: {
                                                display: false
                                            },
                                            tooltip: {
                                                callbacks: {
                                                    label: function(context) {
                                                        return formatNumber(context.parsed.y) + ' vỏ bình';
                                                    }
                                                }
                                            }
                                        },
                                        scales: {
                                            y: {
                                                beginAtZero: true,
                                                ticks: {
                                                    callback: function(value) {
                                                        return formatNumber(value);
                                                    }
                                                }
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
