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
    Filter,
    Layers,
    PackageOpen,
    Plus,
    Search,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MaterialFormModal from '../components/Materials/MaterialFormModal';
import { MATERIAL_CATEGORIES } from '../constants/materialConstants';
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

const Materials = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(MATERIAL_CATEGORIES[0].id); // Mặc định chọn loại đầu tiên
    const [materials, setMaterials] = useState([]);
    const [allMaterials, setAllMaterials] = useState([]); // Store all materials for statistics
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    
    // Filter states
    const [selectedCategories, setSelectedCategories] = useState([]);

    useEffect(() => {
        fetchMaterials();
    }, [categoryFilter]);

    useEffect(() => {
        // Fetch all materials for statistics
        fetchAllMaterials();
    }, []);

    const fetchMaterials = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .eq('category', categoryFilter)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMaterials(data || []);
        } catch (error) {
            console.error('Error fetching materials:', error);
            alert('Lỗi khi tải dữ liệu từ điển vật tư!');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllMaterials = async () => {
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllMaterials(data || []);
        } catch (error) {
            console.error('Error fetching all materials:', error);
        }
    };

    const handleDeleteMaterial = async (id, name) => {
        if (!window.confirm(`Bạn có chắc muốn xóa vật tư "${name}" không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchMaterials();
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('Lỗi khi xóa vật tư: ' + error.message);
        }
    };

    const handleEditMaterial = (material) => {
        setSelectedMaterial(material);
        setIsFormModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedMaterial(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchMaterials();
        fetchAllMaterials();
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

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    // Helper functions for dynamic data display
    const currentCategoryDef = MATERIAL_CATEGORIES.find(c => c.id === categoryFilter) || MATERIAL_CATEGORIES[0];

    const filteredMaterials = materials.filter(material => {
        const search = searchTerm.toLowerCase();
        return (
            material.name?.toLowerCase().includes(search) ||
            (material.extra_text && material.extra_text.toLowerCase().includes(search)) ||
            (material.extra_number && material.extra_number.toString().includes(search))
        );
    });

    // Calculate totals
    const filteredMaterialsCount = filteredMaterials.length;
    
    // For statistics - filter by selected categories or use all
    const statsMaterials = selectedCategories.length === 0 
        ? allMaterials 
        : allMaterials.filter(m => selectedCategories.includes(m.category));

    // Calculate statistics data for charts
    const getCategoryStats = () => {
        const stats = {};
        statsMaterials.forEach(material => {
            const categoryLabel = MATERIAL_CATEGORIES.find(c => c.id === material.category)?.label || material.category;
            stats[categoryLabel] = (stats[categoryLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTopMaterials = () => {
        return statsMaterials
            .map(m => ({ name: m.name, value: 1 }))
            .sort((a, b) => a.name.localeCompare(b.name))
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
                        <h1 className="text-2xl font-semibold text-[#111827] tracking-tight" style={{ color: '#111827' }}>Danh sách vật tư</h1>
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
                                placeholder="Tìm theo tên, mô tả..."
                                className="w-full pl-12 pr-4 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] placeholder-[#9CA3AF] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Summary Stats */}
                        <div className="flex items-center gap-6 px-6 py-3 bg-[#EFF6FF] border border-[#BFDBFE]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Số lượng vật tư:</span>
                                <span className="text-lg font-semibold text-[#2563EB]" style={{ fontFamily: '"Roboto", sans-serif' }}>{filteredMaterialsCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="mb-6">
                        <div className="relative w-full md:w-64">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] bg-white text-[#111827] text-sm transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                            >
                                {MATERIAL_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
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
                                        <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-left uppercase tracking-wider">{currentCategoryDef.nameLabel || 'Tên vật tư'}</th>
                                        {currentCategoryDef.hasNumberField && (
                                            <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-center uppercase tracking-wider">{currentCategoryDef.numberFieldLabel}</th>
                                        )}
                                        {currentCategoryDef.hasTextField && (
                                            <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-left uppercase tracking-wider">{currentCategoryDef.textFieldLabel}</th>
                                        )}
                                        <th className="px-4 py-3.5 text-xs font-semibold text-[#374151] text-center uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E7EB]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={2 + (currentCategoryDef.hasNumberField ? 1 : 0) + (currentCategoryDef.hasTextField ? 1 : 0) + 1} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
                                                    <p className="text-[#6B7280] text-sm font-medium" style={{ fontFamily: '"Roboto", sans-serif' }}>Đang tải dữ liệu...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredMaterials.length === 0 ? (
                                        <tr>
                                            <td colSpan={2 + (currentCategoryDef.hasNumberField ? 1 : 0) + (currentCategoryDef.hasTextField ? 1 : 0) + 1} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <PackageOpen className="w-12 h-12 text-[#D1D5DB]" />
                                                    <p className="text-sm font-medium text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>Không tìm thấy vật tư nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredMaterials.map((material, index) => (
                                        <tr key={material.id} className="hover:bg-[#F9FAFB] transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <span className="text-sm text-[#6B7280]" style={{ fontFamily: '"Roboto", sans-serif' }}>{index + 1}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div>
                                                    <div className="text-sm font-medium text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{material.name}</div>
                                                    <div className="text-xs text-[#6B7280] mt-1" style={{ fontFamily: '"Roboto", sans-serif' }}>ID: {material.id.substring(0, 8)}</div>
                                                </div>
                                            </td>
                                            {currentCategoryDef.hasNumberField && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-sm font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                        {material.extra_number || '—'}
                                                    </span>
                                                </td>
                                            )}
                                            {currentCategoryDef.hasTextField && (
                                                <td className="px-4 py-4 text-sm text-[#374151] font-normal" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                    {material.extra_text || '—'}
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                    <button
                                                        onClick={() => handleEditMaterial(material)}
                                                        className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors p-1 hover:bg-[#EFF6FF]"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMaterial(material.id, material.name)}
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
                            <div className="text-sm text-[#6B7280] mb-2" style={{ fontFamily: '"Roboto", sans-serif' }}>Tổng số vật tư</div>
                            <div className="text-2xl font-semibold text-[#111827]" style={{ fontFamily: '"Roboto", sans-serif' }}>{statsMaterials.length}</div>
                        </div>
                    </div>

                    {/* Filter Section for Statistics */}
                    <div className="mb-6 flex items-center gap-3 flex-wrap">
                        <FilterDropdown
                            label="Phân loại"
                            selectedCount={selectedCategories.length}
                            totalCount={MATERIAL_CATEGORIES.length}
                            onSelectAll={() => {
                                if (selectedCategories.length === MATERIAL_CATEGORIES.length) {
                                    setSelectedCategories([]);
                                } else {
                                    setSelectedCategories(MATERIAL_CATEGORIES.map(c => c.id));
                                }
                            }}
                        >
                            <div className="space-y-1 p-2">
                                {MATERIAL_CATEGORIES.map(cat => (
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
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Category Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Phân bổ theo Phân loại</h3>
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

                        {/* Top Materials Chart */}
                        <div className="bg-white p-6 border border-[#E5E7EB]">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4" style={{ fontFamily: '"Roboto", sans-serif' }}>Top 10 Vật tư</h3>
                            <div style={{ height: '300px' }}>
                                <BarChartJS
                                    data={{
                                        labels: getTopMaterials().map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name),
                                        datasets: [{
                                            label: 'Số lượng',
                                            data: getTopMaterials().map(item => item.value),
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
                <MaterialFormModal
                    material={selectedMaterial}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Materials;
