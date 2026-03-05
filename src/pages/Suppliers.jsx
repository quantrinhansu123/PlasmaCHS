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
    Building2,
    ChevronDown,
    Edit,
    Eye,
    Filter,
    Plus,
    Search,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import SupplierDetailsModal from '../components/Suppliers/SupplierDetailsModal';
import SupplierFormModal from '../components/Suppliers/SupplierFormModal';
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
    { key: 'info', label: 'Thông tin đối tác' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'address', label: 'Địa chỉ liên hệ' },
];

const Suppliers = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_suppliers', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSuppliers(data || []);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            alert('Lỗi khi tải dữ liệu nhà cung cấp!');
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const filteredSuppliers = suppliers.filter(supplier => {
        const search = searchTerm.toLowerCase();
        return (
            supplier.name?.toLowerCase().includes(search) ||
            supplier.phone?.includes(search) ||
            supplier.address?.toLowerCase().includes(search)
        );
    });

    // Calculate totals
    const filteredSuppliersCount = filteredSuppliers.length;

    const handleDeleteSupplier = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa đối tác "${name}" không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSuppliers();
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('❌ Có lỗi xảy ra khi xóa nhà cung cấp: ' + error.message);
        }
    };

    const handleEditSupplier = (supplier) => {
        setSelectedSupplier(supplier);
        setIsFormModalOpen(true);
    };

    const handleViewSupplier = (supplier) => {
        setSelectedSupplier(supplier);
        setIsDetailsModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedSupplier(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchSuppliers();
        setIsFormModalOpen(false);
    };

    // Calculate statistics data for charts
    const getTopSuppliers = () => {
        // Since suppliers table is simple, we'll just show all suppliers sorted by name
        return filteredSuppliers
            .map(s => ({ name: s.name, value: 1 }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 10);
    };

    const getSuppliersByFirstLetter = () => {
        const stats = {};
        filteredSuppliers.forEach(supplier => {
            const firstLetter = supplier.name?.charAt(0).toUpperCase() || 'Khác';
            stats[firstLetter] = (stats[firstLetter] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => a.name.localeCompare(b.name));
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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách nhà cung cấp</h1>
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
                                placeholder="Tìm theo tên, SĐT, địa chỉ..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số NCC:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredSuppliersCount}</span>
                            </div>
                        </div>
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
                                    ) : filteredSuppliers.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Building2 className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy nhà cung cấp nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredSuppliers.map((supplier, index) => (
                                        <tr key={supplier.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{index + 1}</span>
                                            </td>
                                            {isColumnVisible('info') && <td className="px-4 py-4">
                                                <div>
                                                    <div className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{supplier.name}</div>
                                                    <div className="text-xs text-[#6B7280] mt-1" style={{ fontFamily: '"Roboto", sans-serif' }}>ID: {supplier.id.substring(0, 8)}</div>
                                                </div>
                                            </td>}
                                            {isColumnVisible('phone') && <td className="px-4 py-4">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{supplier.phone}</span>
                                            </td>}
                                            {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{supplier.address}</td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewSupplier(supplier)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSupplier(supplier)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
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
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số nhà cung cấp</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredSuppliersCount}</div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top Suppliers Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Danh sách Nhà cung cấp</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getTopSuppliers().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số lượng',
                                            data: getTopSuppliers().map(item => item.value),
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

                        {/* Suppliers by First Letter Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Chữ cái đầu</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getSuppliersByFirstLetter().map(item => item.name),
                                        datasets: [{
                                            label: 'Số lượng',
                                            data: getSuppliersByFirstLetter().map(item => item.value),
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
                    </div>
                </div>
            )}

            {/* Form Modal (Create/Edit) */}
            {isFormModalOpen && (
                <SupplierFormModal
                    supplier={selectedSupplier}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

            {/* Details Dashboard Modal (View) */}
            {isDetailsModalOpen && selectedSupplier && (
                <SupplierDetailsModal
                    supplier={selectedSupplier}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Suppliers;
