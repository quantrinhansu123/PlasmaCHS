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
    ChevronDown,
    Edit,
    Eye,
    Filter,
    MapPin,
    Phone,
    Plus,
    Search,
    Trash2,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import CustomerDetailsModal from '../components/Customers/CustomerDetailsModal';
import CustomerFormModal from '../components/Customers/CustomerFormModal';
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

const Customers = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Filter states
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedManagedBy, setSelectedManagedBy] = useState([]);
    const [selectedCareBy, setSelectedCareBy] = useState([]);
    const [uniqueManagedBy, setUniqueManagedBy] = useState([]);
    const [uniqueCareBy, setUniqueCareBy] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

    const TABLE_COLUMNS_DEF = [
        { key: 'code', label: 'Mã khách hàng' },
        { key: 'name', label: 'Tên khách hàng' },
        { key: 'phone', label: 'Số điện thoại' },
        { key: 'address', label: 'Địa chỉ' },
        { key: 'legal_rep', label: 'Người đại diện pháp luật' },
        { key: 'managed_by', label: 'Nhân viên phụ trách' },
        { key: 'category', label: 'Loại khách hàng' },
        { key: 'current_cylinders', label: 'Số vỏ' },
        { key: 'current_machines', label: 'Số máy hiện có' },
        { key: 'borrowed_cylinders', label: 'Vỏ bình đang mượn' },
        { key: 'machines_in_use', label: 'Mã máy đang sử dụng' },
        { key: 'care_by', label: 'KD chăm sóc' },
    ];
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_customers', TABLE_COLUMNS_DEF);

    const CUSTOMER_CATEGORIES = [
        { id: 'BV', label: 'Bệnh viện' },
        { id: 'TM', label: 'Thẩm mỹ viện' },
        { id: 'PK', label: 'Phòng khám' },
        { id: 'NG', label: 'Khách ngoại giao' },
        { id: 'SP', label: 'Spa / Khác' },
    ];

    const visibleTableColumns = TABLE_COLUMNS_DEF.filter(col => isColumnVisible(col.key));

    useEffect(() => {
        fetchCustomers();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        // Extract unique values for filters
        const managedBy = [...new Set(customers.map(c => c.managed_by).filter(Boolean))];
        const careBy = [...new Set(customers.map(c => c.care_by).filter(Boolean))];
        setUniqueManagedBy(managedBy);
        setUniqueCareBy(careBy);
    }, [customers]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
            alert('❌ Không thể tải danh sách khách hàng: ' + error.message);
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

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const getLabel = (list, id) => {
        return list.find(item => item.id === id)?.label || id;
    };

    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (c.code?.toLowerCase().includes(search)) ||
            (c.name?.toLowerCase().includes(search)) ||
            (c.phone?.toLowerCase().includes(search)) ||
            (c.address?.toLowerCase().includes(search))
        );

        // Filter by category
        const matchesCategory = selectedCategories.length === 0 ||
            selectedCategories.includes(c.category);

        // Filter by managed_by
        const matchesManagedBy = selectedManagedBy.length === 0 ||
            selectedManagedBy.includes(c.managed_by);

        // Filter by care_by
        const matchesCareBy = selectedCareBy.length === 0 ||
            selectedCareBy.includes(c.care_by);

        return matchesSearch && matchesCategory && matchesManagedBy && matchesCareBy;
    });

    // Calculate totals
    const filteredCustomersCount = filteredCustomers.length;
    const totalCylinders = filteredCustomers.reduce((sum, c) => sum + (c.current_cylinders || 0), 0);
    const totalMachines = filteredCustomers.reduce((sum, c) => sum + (c.current_machines || 0), 0);
    const totalBorrowed = filteredCustomers.reduce((sum, c) => sum + (c.borrowed_cylinders || 0), 0);

    const handleEditCustomer = (customer) => {
        setSelectedCustomer(customer);
        setIsFormModalOpen(true);
    };

    const handleViewCustomer = (customer) => {
        setSelectedCustomer(customer);
        setIsDetailsModalOpen(true);
    };

    const handleDeleteCustomer = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa hệ thống khách hàng "${name}" không? Toàn bộ dữ liệu liên quan sẽ bị xóa và không thể khôi phục.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchCustomers();
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('❌ Có lỗi xảy ra khi xóa khách hàng: ' + error.message);
        }
    };

    const handleFormSubmitSuccess = () => {
        fetchCustomers();
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
    const getCategoryStats = () => {
        const stats = {};
        filteredCustomers.forEach(customer => {
            const categoryLabel = getLabel(CUSTOMER_CATEGORIES, customer.category);
            stats[categoryLabel] = (stats[categoryLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getManagedByStats = () => {
        const stats = {};
        filteredCustomers.forEach(customer => {
            const managedBy = customer.managed_by || 'Không xác định';
            stats[managedBy] = (stats[managedBy] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCareByStats = () => {
        const stats = {};
        filteredCustomers.forEach(customer => {
            const careBy = customer.care_by || 'Không xác định';
            stats[careBy] = (stats[careBy] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    };

    const getCylindersStats = () => {
        const stats = {
            'Có bình': 0,
            'Không có bình': 0
        };
        filteredCustomers.forEach(customer => {
            if ((customer.current_cylinders || 0) > 0) {
                stats['Có bình']++;
            } else {
                stats['Không có bình']++;
            }
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getMachinesStats = () => {
        const stats = {
            'Có máy': 0,
            'Không có máy': 0
        };
        filteredCustomers.forEach(customer => {
            if ((customer.current_machines || 0) > 0) {
                stats['Có máy']++;
            } else {
                stats['Không có máy']++;
            }
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    return (
        <div className="p-4 sm:p-6 bg-[#F8F9FA] min-h-screen" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mb-6 sm:mb-8 border-b border-[#E5E7EB] overflow-x-auto no-scrollbar">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight">Danh sách khách hàng</h1>
                        <button
                            onClick={() => setIsFormModalOpen(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-white font-medium text-sm transition-all duration-200 shadow-sm hover:shadow-md"
                            style={{ backgroundColor: '#2563EB' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#1D4ED8'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#2563EB'}
                        >
                            <Plus className="w-4 h-4" />
                            Thêm mới
                        </button>
                    </div>

                    {/* Search Bar and Summary Stats - Same Row */}
                    <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, email, SĐT..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center justify-around sm:justify-start gap-4 sm:gap-6 px-4 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left">
                                <span className="text-[10px] sm:text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Khách hàng:</span>
                                <span className="text-sm sm:text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredCustomersCount}</span>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left border-l border-[#BFDBFE] sm:border-none pl-4 sm:pl-0">
                                <span className="text-[10px] sm:text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng bình:</span>
                                <span className="text-sm sm:text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalCylinders)}</span>
                            </div>
                            <div className="hidden sm:block w-px h-8 bg-[#BFDBFE]"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-center sm:text-left border-l border-[#BFDBFE] sm:border-none pl-4 sm:pl-0">
                                <span className="text-[10px] sm:text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng máy:</span>
                                <span className="text-sm sm:text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalMachines)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        {/* Loại khách Dropdown */}
                        <FilterDropdown
                            label="Loại khách"
                            selectedCount={selectedCategories.length}
                            totalCount={CUSTOMER_CATEGORIES.length}
                            onSelectAll={() => {
                                if (selectedCategories.length === CUSTOMER_CATEGORIES.length) {
                                    setSelectedCategories([]);
                                } else {
                                    setSelectedCategories(CUSTOMER_CATEGORIES.map(c => c.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {CUSTOMER_CATEGORIES.map(cat => (
                                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCategories([...selectedCategories, cat.id]);
                                                } else {
                                                    setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151]" style={{ fontFamily: '"Roboto", sans-serif' }}>{cat.label}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* Nhân viên phụ trách Dropdown */}
                        <FilterDropdown
                            label="Nhân viên phụ trách"
                            selectedCount={selectedManagedBy.length}
                            totalCount={uniqueManagedBy.length}
                            onSelectAll={() => {
                                if (selectedManagedBy.length === uniqueManagedBy.length) {
                                    setSelectedManagedBy([]);
                                } else {
                                    setSelectedManagedBy([...uniqueManagedBy]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueManagedBy.map(managedBy => (
                                    <label key={managedBy} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedManagedBy.includes(managedBy)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedManagedBy([...selectedManagedBy, managedBy]);
                                                } else {
                                                    setSelectedManagedBy(selectedManagedBy.filter(m => m !== managedBy));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={managedBy}>{managedBy}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>

                        {/* KD chăm sóc Dropdown */}
                        <FilterDropdown
                            label="KD chăm sóc"
                            selectedCount={selectedCareBy.length}
                            totalCount={uniqueCareBy.length}
                            onSelectAll={() => {
                                if (selectedCareBy.length === uniqueCareBy.length) {
                                    setSelectedCareBy([]);
                                } else {
                                    setSelectedCareBy([...uniqueCareBy]);
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {uniqueCareBy.map(careBy => (
                                    <label key={careBy} className="flex items-center gap-2 cursor-pointer hover:bg-[#F3F4F6] p-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedCareBy.includes(careBy)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCareBy([...selectedCareBy, careBy]);
                                                } else {
                                                    setSelectedCareBy(selectedCareBy.filter(c => c !== careBy));
                                                }
                                            }}
                                            className="w-4 h-4 text-[#2563EB] border-[#D1D5DB] focus:ring-[#2563EB]"
                                        />
                                        <span className="text-sm text-[#374151] truncate" style={{ fontFamily: '"Roboto", sans-serif' }} title={careBy}>{careBy}</span>
                                    </label>
                                ))}
                            </div>
                        </FilterDropdown>
                    </div>

                    {/* Main Content Card */}
                    <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-sm overflow-hidden">
                        {/* Mobile Card List (Visible only on mobile) */}
                        <div className="md:hidden divide-y divide-[#E5E7EB]">
                            {isLoading ? (
                                <div className="px-4 py-16 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-[#6B7280] text-sm font-medium">Đang tải dữ liệu...</p>
                                    </div>
                                </div>
                            ) : filteredCustomers.length === 0 ? (
                                <div className="px-4 py-16 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Users className="w-12 h-12 text-[#D1D5DB]" />
                                        <p className="text-sm font-medium text-[#6B7280]">Không tìm thấy khách hàng nào</p>
                                    </div>
                                </div>
                            ) : (
                                filteredCustomers.map((c) => (
                                    <div key={c.id} className="p-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.code}</span>
                                                <h3 className="text-base font-bold text-[#111827] leading-tight mt-0.5">{c.name}</h3>
                                            </div>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]">
                                                {getLabel(CUSTOMER_CATEGORIES, c.category)}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {c.phone && (
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{c.phone}</span>
                                                </div>
                                            )}
                                            {c.address && (
                                                <div className="flex items-start gap-2 text-sm text-slate-600">
                                                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                                                    <span className="line-clamp-2">{c.address}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl mb-4">
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Số vỏ</p>
                                                <p className="text-sm font-black text-blue-600">{formatNumber(c.current_cylinders || 0)}</p>
                                            </div>
                                            <div className="text-center border-x border-slate-200">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Số máy</p>
                                                <p className="text-sm font-black text-blue-600">{formatNumber(c.current_machines || 0)}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Bình mượn</p>
                                                <p className="text-sm font-black text-blue-600">{formatNumber(c.borrowed_cylinders || 0)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Phụ trách:</span>
                                                <span className="text-[11px] font-medium text-slate-700">{c.managed_by || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleViewCustomer(c)}
                                                    className="p-2 text-[#9CA3AF] hover:text-[#2563EB] active:bg-blue-50 rounded-lg transition-colors border border-transparent active:border-blue-100"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditCustomer(c)}
                                                    className="p-2 text-[#9CA3AF] hover:text-[#2563EB] active:bg-blue-50 rounded-lg transition-colors border border-transparent active:border-blue-100"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomer(c.id, c.name)}
                                                    className="p-2 text-[#9CA3AF] hover:text-[#DC2626] active:bg-red-50 rounded-lg transition-colors border border-transparent active:border-red-100"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Desktop Table View (Hidden on mobile) */}
                        <div className="hidden md:block w-full overflow-x-auto">
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
                                    ) : filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <Users className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy khách hàng nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredCustomers.map((c) => (
                                        <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            {isColumnVisible('code') && <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {c.code}
                                                </span>
                                            </td>}
                                            {isColumnVisible('name') && <td className="px-4 py-4">
                                                <span className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.name}</span>
                                            </td>}
                                            {isColumnVisible('phone') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.phone || '—'}</td>}
                                            {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.address || '—'}</td>}
                                            {isColumnVisible('legal_rep') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.legal_rep || '—'}</td>}
                                            {isColumnVisible('managed_by') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.managed_by || '—'}</td>}
                                            {isColumnVisible('category') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{getLabel(CUSTOMER_CATEGORIES, c.category)}</td>}
                                            {isColumnVisible('current_cylinders') && <td className="px-4 py-4">
                                                <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(c.current_cylinders || 0)}</span>
                                            </td>}
                                            {isColumnVisible('current_machines') && <td className="px-4 py-4">
                                                <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(c.current_machines || 0)}</span>
                                            </td>}
                                            {isColumnVisible('borrowed_cylinders') && <td className="px-4 py-4">
                                                <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(c.borrowed_cylinders || 0)}</span>
                                            </td>}
                                            {isColumnVisible('machines_in_use') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.machines_in_use || '—'}</td>}
                                            {isColumnVisible('care_by') && <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>{c.care_by || '—'}</td>}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleViewCustomer(c)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditCustomer(c)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCustomer(c.id, c.name)}
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 sm:p-6 border border-[#E5E7EB]">
                            <div className="text-[10px] sm:text-sm text-[#6B7280] mb-2 uppercase tracking-wider font-bold" style={{ fontFamily: '"Roboto", sans-serif' }}>Khách hàng</div>
                            <div className="text-lg sm:text-2xl font-black text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredCustomersCount}</div>
                        </div>
                        <div className="bg-white p-4 sm:p-6 border border-[#E5E7EB]">
                            <div className="text-[10px] sm:text-sm text-[#6B7280] mb-2 uppercase tracking-wider font-bold" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng bình</div>
                            <div className="text-lg sm:text-2xl font-black text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalCylinders)}</div>
                        </div>
                        <div className="bg-white p-4 sm:p-6 border border-[#E5E7EB]">
                            <div className="text-[10px] sm:text-sm text-[#6B7280] mb-2 uppercase tracking-wider font-bold" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng máy</div>
                            <div className="text-lg sm:text-2xl font-black text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalMachines)}</div>
                        </div>
                        <div className="bg-white p-4 sm:p-6 border border-[#E5E7EB]">
                            <div className="text-[10px] sm:text-sm text-[#6B7280] mb-2 uppercase tracking-wider font-bold" style={{ fontFamily: '"Roboto", sans-serif' }}>Bình mượn</div>
                            <div className="text-lg sm:text-2xl font-black text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{formatNumber(totalBorrowed)}</div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Category Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Loại khách</h3>
                            <div style={{ height: '300px' }}>
                                <PieChartJS
                                    data={{
                                        labels: getCategoryStats().map(item => item.name),
                                        datasets: [{
                                            data: getCategoryStats().map(item => item.value),
                                            backgroundColor: chartColors.slice(0, getCategoryStats().length),
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

                        {/* Managed By Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Nhân viên phụ trách</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getManagedByStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số khách hàng',
                                            data: getManagedByStats().map(item => item.value),
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

                        {/* Care By Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 KD chăm sóc</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getCareByStats().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số khách hàng',
                                            data: getCareByStats().map(item => item.value),
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

                        {/* Cylinders Stats Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ Bình</h3>
                            <div style={{ height: '300px' }}>
                                <PieChartJS
                                    data={{
                                        labels: getCylindersStats().map(item => item.name),
                                        datasets: [{
                                            data: getCylindersStats().map(item => item.value),
                                            backgroundColor: chartColors.slice(0, getCylindersStats().length),
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

                        {/* Machines Stats Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ Máy</h3>
                            <div style={{ height: '300px' }}>
                                <PieChartJS
                                    data={{
                                        labels: getMachinesStats().map(item => item.name),
                                        datasets: [{
                                            data: getMachinesStats().map(item => item.value),
                                            backgroundColor: chartColors.slice(0, getMachinesStats().length),
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
                    </div>
                </div>
            )}

            {/* Modals */}

            {/* Modals */}
            {isFormModalOpen && (
                <CustomerFormModal
                    customer={selectedCustomer}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                    categories={CUSTOMER_CATEGORIES}
                    warehouses={warehousesList}
                />
            )}

            {isDetailsModalOpen && selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    onClose={() => setIsDetailsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Customers;
