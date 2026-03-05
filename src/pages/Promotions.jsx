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
    CalendarDays,
    ChevronDown,
    Edit,
    Filter,
    Gift,
    Plus,
    Search,
    Tag,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import PromotionFormModal from '../components/Promotions/PromotionFormModal';
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
    { key: 'code', label: 'Mã Khuyến mãi' },
    { key: 'content', label: 'Nội dung ưu đãi' },
    { key: 'period', label: 'Thời hạn áp dụng' },
    { key: 'target', label: 'Đối tượng' },
    { key: 'status', label: 'Tình trạng' },
    { key: 'active', label: 'Kích hoạt' },
];

const Promotions = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'expired'
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_promotions', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));
    
    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomerTypes, setSelectedCustomerTypes] = useState([]);
    const [selectedActiveStatus, setSelectedActiveStatus] = useState([]);
    const [uniqueCustomerTypes, setUniqueCustomerTypes] = useState([]);

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_promotions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPromotions(data || []);
            
            // Extract unique customer types
            const uniqueTypes = [...new Set((data || []).map(p => p.customer_type).filter(Boolean))];
            setUniqueCustomerTypes(uniqueTypes);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    const getPromoStatus = (promo) => {
        if (!promo.is_active) return { label: 'Vô hiệu', color: 'text-gray-500 bg-gray-100 border-gray-200' };
        if (promo.end_date < today) return { label: 'Hết hạn', color: 'text-red-600 bg-red-50 border-red-100' };
        if (promo.start_date > today) return { label: 'Chờ kích hoạt', color: 'text-amber-600 bg-amber-50 border-amber-100' };
        return { label: 'Đang hoạt động', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const filteredPromotions = promotions.filter(promo => {
        const search = searchTerm.toLowerCase();
        const matchSearch = (
            promo.code?.toLowerCase().includes(search) ||
            promo.customer_type?.toLowerCase().includes(search) ||
            promo.free_cylinders?.toString().includes(search)
        );

        // Status filter
        const status = getPromoStatus(promo);
        const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(status.label);
        
        // Customer type filter
        const matchCustomerType = selectedCustomerTypes.length === 0 || selectedCustomerTypes.includes(promo.customer_type);
        
        // Active status filter
        const matchActive = selectedActiveStatus.length === 0 || 
            (selectedActiveStatus.includes('active') && promo.is_active) ||
            (selectedActiveStatus.includes('inactive') && !promo.is_active);

        // Legacy filterStatus (for backward compatibility)
        let matchLegacyFilter = true;
        if (filterStatus === 'active') {
            matchLegacyFilter = promo.is_active && promo.end_date >= today && promo.start_date <= today;
        } else if (filterStatus === 'expired') {
            matchLegacyFilter = promo.end_date < today || !promo.is_active;
        }

        return matchSearch && matchStatus && matchCustomerType && matchActive && matchLegacyFilter;
    });

    // Calculate totals
    const filteredPromotionsCount = filteredPromotions.length;
    const activeCount = filteredPromotions.filter(p => p.is_active && p.end_date >= today && p.start_date <= today).length;
    const expiredCount = filteredPromotions.filter(p => p.end_date < today || !p.is_active).length;

    const handleDeletePromo = async (id, code) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa mã khuyến mãi ${code} không?`)) return;
        try {
            const { error } = await supabase.from('app_promotions').delete().eq('id', id);
            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error deleting promotion:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        }
    };

    const handleToggleActive = async (id, currentActive) => {
        try {
            const { error } = await supabase
                .from('app_promotions')
                .update({ is_active: !currentActive })
                .eq('id', id);
            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error toggling promotion:', error);
        }
    };

    const handleEditPromo = (promo) => {
        setSelectedPromo(promo);
        setIsFormModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedPromo(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchPromotions();
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
        filteredPromotions.forEach(promo => {
            const status = getPromoStatus(promo);
            stats[status.label] = (stats[status.label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getCustomerTypeStats = () => {
        const stats = {};
        filteredPromotions.forEach(promo => {
            const type = promo.customer_type || 'Khác';
            stats[type] = (stats[type] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTopPromotions = () => {
        return filteredPromotions
            .map(p => ({ name: p.code, value: p.free_cylinders || 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách khuyến mãi</h1>
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
                                placeholder="Tìm theo mã KM, loại khách hàng..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredPromotionsCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        <FilterDropdown
                            label="Trạng thái"
                            selectedCount={selectedStatuses.length}
                            totalCount={4}
                            onSelectAll={() => {
                                if (selectedStatuses.length === 4) {
                                    setSelectedStatuses([]);
                                } else {
                                    setSelectedStatuses(['Đang hoạt động', 'Hết hạn', 'Vô hiệu', 'Chờ kích hoạt']);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {['Đang hoạt động', 'Hết hạn', 'Vô hiệu', 'Chờ kích hoạt'].map(status => (
                                    <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedStatuses.includes(status)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStatuses([...selectedStatuses, status]);
                                                } else {
                                                    setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{status}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        <FilterDropdown
                            label="Loại khách hàng"
                            selectedCount={selectedCustomerTypes.length}
                            totalCount={uniqueCustomerTypes.length}
                            onSelectAll={() => {
                                if (selectedCustomerTypes.length === uniqueCustomerTypes.length) {
                                    setSelectedCustomerTypes([]);
                                } else {
                                    setSelectedCustomerTypes([...uniqueCustomerTypes]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueCustomerTypes.map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomerTypes.includes(type)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCustomerTypes([...selectedCustomerTypes, type]);
                                                } else {
                                                    setSelectedCustomerTypes(selectedCustomerTypes.filter(t => t !== type));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{type}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        <FilterDropdown
                            label="Kích hoạt"
                            selectedCount={selectedActiveStatus.length}
                            totalCount={2}
                            onSelectAll={() => {
                                if (selectedActiveStatus.length === 2) {
                                    setSelectedActiveStatus([]);
                                } else {
                                    setSelectedActiveStatus(['active', 'inactive']);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {[
                                    { value: 'active', label: 'Đã kích hoạt' },
                                    { value: 'inactive', label: 'Chưa kích hoạt' }
                                ].map(item => (
                                    <label key={item.value} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedActiveStatus.includes(item.value)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedActiveStatus([...selectedActiveStatus, item.value]);
                                                } else {
                                                    setSelectedActiveStatus(selectedActiveStatus.filter(s => s !== item.value));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{item.label}</span>
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
                                            <th key={col.key} className={`px-4 py-3.5 text-xs font-semibold text-[#374151] ${col.key === 'content' || col.key === 'status' || col.key === 'active' ? 'text-center' : 'text-left'} uppercase tracking-wider`}>
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
                                    ) : filteredPromotions.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Gift className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy khuyến mãi nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredPromotions.map((promo, index) => {
                                        const status = getPromoStatus(promo);
                                        return (
                                            <tr key={promo.id} className="hover:bg-[#F9FAFB] transition-colors">
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{index + 1}</span>
                                                </td>
                                                {isColumnVisible('code') && <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Tag className="w-4 h-4 text-[#2563EB]" />
                                                        <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{promo.code}</span>
                                                    </div>
                                                </td>}
                                                {isColumnVisible('content') && <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        + {promo.free_cylinders || 0} bình khí
                                                    </span>
                                                </td>}
                                                {isColumnVisible('period') && <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2 text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        <CalendarDays className="w-4 h-4 text-[#9CA3AF]" />
                                                        <span>{formatDate(promo.start_date)} — {formatDate(promo.end_date)}</span>
                                                    </div>
                                                </td>}
                                                {isColumnVisible('target') && <td className="px-4 py-4">
                                                    <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{promo.customer_type}</span>
                                                </td>}
                                                {isColumnVisible('status') && <td className="px-4 py-4 text-center">
                                                    <span className={`px-3 py-1 text-xs font-medium border ${
                                                        status.label === 'Đang hoạt động' ? 'text-[#10B981] bg-[#D1FAE5] border-[#A7F3D0]' :
                                                        status.label === 'Hết hạn' ? 'text-[#EF4444] bg-[#FEE2E2] border-[#FECACA]' :
                                                        status.label === 'Vô hiệu' ? 'text-[#6B7280] bg-[#F3F4F6] border-[#E5E7EB]' :
                                                        'text-[#F59E0B] bg-[#FEF3C7] border-[#FDE68A]'
                                                    }`} style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        {status.label}
                                                    </span>
                                                </td>}
                                                {isColumnVisible('active') && <td className="px-4 py-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={promo.is_active}
                                                            onChange={() => handleToggleActive(promo.id, promo.is_active)}
                                                        />
                                                        <div className="w-11 h-6 bg-[#D1D5DB] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#2563EB] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-[#E5E7EB] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563EB]"></div>
                                                    </label>
                                                </td>}
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => handleEditPromo(promo)}
                                                            className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePromo(promo.id, promo.code)}
                                                            className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors p-1 hover:bg-[#FEF2F2]"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số khuyến mãi</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredPromotionsCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang hoạt động</div>
                            <div className="text-2xl font-semibold text-[#10B981]" style={{ fontFamily: '"Roboto", sans-serif' }}>{activeCount}</div>
                        </div>
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Hết hạn / Vô hiệu</div>
                            <div className="text-2xl font-semibold text-[#EF4444]" style={{ fontFamily: '"Roboto", sans-serif' }}>{expiredCount}</div>
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

                        {/* Customer Type Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại khách hàng</h3>
                            <div style={{ height: '300px' }}>
                                <PieChartJS
                                    data={{
                                        labels: getCustomerTypeStats().map(item => item.name),
                                        datasets: [{
                                            data: getCustomerTypeStats().map(item => item.value),
                                            backgroundColor: chartColors.slice(0, getCustomerTypeStats().length),
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

                        {/* Top Promotions Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB] md:col-span-2">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Khuyến mãi (Số bình khí)</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getTopPromotions().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số bình khí',
                                            data: getTopPromotions().map(item => item.value),
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

            {/* Modal */}
            {isFormModalOpen && (
                <PromotionFormModal
                    promotion={selectedPromo}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Promotions;
