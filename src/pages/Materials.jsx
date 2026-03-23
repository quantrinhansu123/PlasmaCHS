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
    BarChart2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Filter,
    List,
    PackageOpen,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import MaterialFormModal from '../components/Materials/MaterialFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { MATERIAL_CATEGORIES } from '../constants/materialConstants';
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

const Materials = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(MATERIAL_CATEGORIES[0].id);
    const [materials, setMaterials] = useState([]);
    const [allMaterials, setAllMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [pendingCategories, setPendingCategories] = useState([]);
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    const baseMaterialColOrder = ['name', 'extra_number', 'extra_text'];
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_materials_order') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                const valid = saved.filter(key => baseMaterialColOrder.includes(key));
                const missing = baseMaterialColOrder.filter(key => !valid.includes(key));
                return [...valid, ...missing];
            }
        } catch { }
        return baseMaterialColOrder;
    });
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_materials') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => baseMaterialColOrder.includes(key));
            }
        } catch { }
        return baseMaterialColOrder;
    });

    useEffect(() => {
        fetchMaterials();
    }, [categoryFilter]);

    useEffect(() => {
        fetchAllMaterials();
    }, []);

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
        localStorage.setItem('columns_materials', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_materials_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const fetchMaterials = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .eq('category', categoryFilter)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMaterials(data || []);
            setSelectedIds([]); // Clear selection on refresh
        } catch (error) {
            console.error('Error fetching materials:', error);
            alert('❌ Không thể tải danh sách vật tư: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredMaterials.length && filteredMaterials.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredMaterials.map(m => m.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} vật tư đã chọn không? Thao tác này không thể hoàn tác.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('materials')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            alert(`🎉 Đã xóa thành công ${selectedIds.length} vật tư!`);
            setSelectedIds([]);
            fetchMaterials();
        } catch (error) {
            console.error('Error deleting materials:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'Tên vật tư',
            'Phân loại (Vật tư / Phụ kiện / Linh kiện / Thiết bị)',
            currentCategoryDef.numberFieldLabel || 'Thông số số',
            currentCategoryDef.textFieldLabel || 'Thông số chữ',
        ];

        const exampleData = [
            {
                'Tên vật tư': 'Ốc vít 4x10',
                'Phân loại (Vật tư / Phụ kiện / Linh kiện / Thiết bị)': currentCategoryDef.label,
                [currentCategoryDef.numberFieldLabel || 'Thông số số']: 100,
                [currentCategoryDef.textFieldLabel || 'Thông số chữ']: 'Thép không gỉ',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Vật tư');
        XLSX.writeFile(wb, `mau_import_vat_tu_${categoryFilter}.xlsx`);
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

                const materialsToInsert = data.map(row => {
                    const categoryName = row['Phân loại (Vật tư / Phụ kiện / Linh kiện / Thiết bị)']?.toString();
                    const category = MATERIAL_CATEGORIES.find(c => c.label === categoryName)?.id || categoryFilter;

                    return {
                        name: row['Tên vật tư']?.toString(),
                        category: category,
                        extra_number: parseFloat(row[currentCategoryDef.numberFieldLabel || 'Thông số số']) || 0,
                        extra_text: row[currentCategoryDef.textFieldLabel || 'Thông số chữ']?.toString(),
                        updated_at: new Date().toISOString()
                    };
                }).filter(m => m.name);

                if (materialsToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu tên vật tư)!');
                    setIsLoading(false);
                    return;
                }

                const { error } = await supabase.from('materials').insert(materialsToInsert);

                if (error) {
                    throw error;
                } else {
                    alert(`🎉 Đã import thành công ${materialsToInsert.length} vật tư!`);
                    fetchMaterials();
                    fetchAllMaterials();
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
        if (!window.confirm(`Bạn có chắc chắn muốn xóa vật tư "${name}" không? Dữ liệu sẽ không thể khôi phục.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchMaterials();
            fetchAllMaterials();
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('❌ Có lỗi xảy ra khi xóa vật tư: ' + error.message);
        }
    };

    const handleEditMaterial = (material) => {
        setSelectedMaterial(material);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchMaterials();
        fetchAllMaterials();
        setIsFormModalOpen(false);
    };

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingCategories(selectedCategories);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedCategories(pendingCategories);
        closeMobileFilter();
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const currentCategoryDef = MATERIAL_CATEGORIES.find(category => category.id === categoryFilter) || MATERIAL_CATEGORIES[0];
    const tableColumnsDef = [
        { key: 'name', label: currentCategoryDef.nameLabel || 'Tên vật tư' },
        ...(currentCategoryDef.hasNumberField ? [{ key: 'extra_number', label: currentCategoryDef.numberFieldLabel }] : []),
        ...(currentCategoryDef.hasTextField ? [{ key: 'extra_text', label: currentCategoryDef.textFieldLabel }] : []),
    ];
    const availableColumnKeys = tableColumnsDef.map(col => col.key);
    const columnDefs = tableColumnsDef.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const visibleTableColumns = columnOrder
        .filter(key => availableColumnKeys.includes(key) && visibleColumns.includes(key))
        .map(key => tableColumnsDef.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => availableColumnKeys.includes(key) && visibleColumns.includes(key);

    useEffect(() => {
        setColumnOrder(prev => {
            const valid = prev.filter(key => availableColumnKeys.includes(key));
            const missing = availableColumnKeys.filter(key => !valid.includes(key));
            const next = [...valid, ...missing];
            if (next.length === prev.length && next.every((key, idx) => key === prev[idx])) {
                return prev;
            }
            return next;
        });

        setVisibleColumns(prev => {
            const valid = prev.filter(key => availableColumnKeys.includes(key));
            const next = valid.length > 0 ? valid : availableColumnKeys;
            if (next.length === prev.length && next.every((key, idx) => key === prev[idx])) {
                return prev;
            }
            return next;
        });
    }, [categoryFilter]);

    const visibleCount = visibleTableColumns.length;
    const totalCount = tableColumnsDef.length;

    const filteredMaterials = materials.filter(material => {
        const search = searchTerm.toLowerCase();
        return (
            material.name?.toLowerCase().includes(search) ||
            (material.extra_text && material.extra_text.toLowerCase().includes(search)) ||
            (material.extra_number && material.extra_number.toString().includes(search))
        );
    });

    const filteredMaterialsCount = filteredMaterials.length;

    const statsMaterials = selectedCategories.length === 0
        ? allMaterials
        : allMaterials.filter(material => selectedCategories.includes(material.category));

    const getCategoryStats = () => {
        const stats = {};
        statsMaterials.forEach(material => {
            const categoryLabel = MATERIAL_CATEGORIES.find(category => category.id === material.category)?.label || material.category;
            stats[categoryLabel] = (stats[categoryLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getTopMaterials = () => {
        return statsMaterials
            .map(material => ({ name: material.name, value: 1 }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 10);
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const categoryOptions = MATERIAL_CATEGORIES.map(category => ({
        id: category.id,
        label: category.label,
        count: allMaterials.filter(material => material.category === category.id).length
    }));

    const hasActiveFilters = selectedCategories.length > 0;

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) return 'border-border bg-white text-muted-foreground hover:text-foreground';

        switch (filterKey) {
            case 'categories':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            default:
                return 'border-primary/30 bg-primary/10 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'categories':
                return 'bg-violet-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'categories':
                return isActive ? 'text-violet-700' : 'text-violet-600';
            default:
                return isActive ? 'text-primary' : 'text-muted-foreground';
        }
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'VT' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        categoryId === 'LK' && 'bg-amber-50 text-amber-700 border-amber-200',
        categoryId === 'TB' && 'bg-violet-50 text-violet-700 border-violet-200',
        !['VT', 'PK', 'LK', 'TB'].includes(categoryId) && 'bg-primary/5 text-primary border-primary/20'
    );

    const getRowStyle = (categoryId) => clsx(
        'hover:bg-primary/5',
        categoryId === 'VT' && 'hover:bg-blue-50/60',
        categoryId === 'PK' && 'hover:bg-emerald-50/60',
        categoryId === 'LK' && 'hover:bg-amber-50/60',
        categoryId === 'TB' && 'hover:bg-violet-50/60'
    );

    const getNameCellClass = (categoryId) => clsx(
        'px-4 py-4 text-sm font-semibold text-foreground border-r border-primary/20'
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
                        <div className="flex items-center gap-2 shrink-0 pr-1">
                            <input
                                type="checkbox"
                                checked={selectedIds.length === filteredMaterials.length && filteredMaterials.length > 0}
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
                        <button
                            onClick={downloadTemplate}
                            className="p-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0"
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
                                id="material-import-mobile"
                            />
                            <label
                                htmlFor="material-import-mobile"
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
                                setSelectedMaterial(null);
                                setIsFormModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="p-3 border-b border-border md:hidden">
                        <div className="relative w-full md:w-72">
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 md:py-2 bg-white border border-border rounded-xl text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
                            >
                                {MATERIAL_CATEGORIES.map(category => (
                                    <option key={category.id} value={category.id}>{category.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredMaterials.map((material) => (
                                <div key={material.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(material.id) 
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20" 
                                        : "border-primary/20 bg-gradient-to-br from-white to-primary/[0.03]"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(material.id)}
                                                    onChange={() => toggleSelectOne(material.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vật tư</p>
                                                <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{material.name}</h3>
                                            </div>
                                        </div>
                                        <span className={getCategoryBadgeClass(material.category || categoryFilter)}>{currentCategoryDef.label}</span>
                                    </div>

                                    <div className="space-y-1.5 mb-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                                        {currentCategoryDef.hasNumberField && (
                                            <div className="text-[12px] text-muted-foreground">
                                                <span className="font-semibold text-foreground/90">{currentCategoryDef.numberFieldLabel}:</span> {material.extra_number || '—'}
                                            </div>
                                        )}
                                        {currentCategoryDef.hasTextField && (
                                            <div className="text-[12px] text-muted-foreground line-clamp-2">
                                                <span className="font-semibold text-foreground/90">{currentCategoryDef.textFieldLabel}:</span> {material.extra_text || '—'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleEditMaterial(material)} className="text-blue-500 hover:text-blue-700 transition-colors"><Edit size={18} /></button>
                                            <button onClick={() => handleDeleteMaterial(material.id, material.name)} className="text-rose-500 hover:text-rose-700 transition-colors"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="hidden md:block p-4 border-b border-border">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2.5">
                                <div className="flex items-center gap-2">
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
                                <div className="relative w-72">
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2 bg-white border border-border rounded-xl text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
                                    >
                                        {MATERIAL_CATEGORIES.map(category => (
                                            <option key={category.id} value={category.id}>{category.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
                                            visibleColumns={availableColumnKeys.filter(key => visibleColumns.includes(key))}
                                            setVisibleColumns={(next) => {
                                                if (typeof next === 'function') {
                                                    setVisibleColumns(prev => {
                                                        const current = availableColumnKeys.filter(key => prev.includes(key));
                                                        const updated = next(current);
                                                        return baseMaterialColOrder.filter(key => updated.includes(key) || (!availableColumnKeys.includes(key) && prev.includes(key)));
                                                    });
                                                    return;
                                                }
                                                setVisibleColumns(prev => baseMaterialColOrder.filter(key => next.includes(key) || (!availableColumnKeys.includes(key) && prev.includes(key))));
                                            }}
                                            defaultColOrder={availableColumnKeys}
                                            columnDefs={columnDefs}
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedMaterial(null);
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
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 cursor-pointer shadow-sm transition-all"
                                        title="Import dữ liệu từ file Excel"
                                    >
                                        <Upload size={16} />
                                        Nhập Excel
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto border-t border-primary/20">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    <th className="w-12 px-4 py-3.5 text-center border-r border-primary/30">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredMaterials.length && filteredMaterials.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                'px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide',
                                                col.key === 'extra_number' ? 'text-center' : 'text-left'
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-primary/20">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredMaterials.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy vật tư nào
                                        </td>
                                    </tr>
                                ) : filteredMaterials.map((material) => (
                                    <tr key={material.id} className={clsx(
                                        getRowStyle(material.category || categoryFilter),
                                        selectedIds.includes(material.id) && "bg-primary/[0.04]"
                                    )}>
                                        <td className="w-12 px-4 py-4 text-center border-r border-primary/20">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(material.id)}
                                                onChange={() => toggleSelectOne(material.id)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </td>
                                        {isColumnVisible('name') && <td className={getNameCellClass(material.category || categoryFilter)}>{material.name || '—'}</td>}
                                        {isColumnVisible('extra_number') && (
                                            <td className="px-4 py-4 text-sm font-semibold text-foreground text-center">{material.extra_number || '—'}</td>
                                        )}
                                        {isColumnVisible('extra_text') && (
                                            <td className="px-4 py-4 text-sm text-muted-foreground">{material.extra_text || '—'}</td>
                                        )}
                                        <td className="px-4 py-4 text-center border-l border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => handleEditMaterial(material)} className="text-blue-500 hover:text-blue-700 transition-colors p-1" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteMaterial(material.id, material.name)} className="text-rose-500 hover:text-rose-700 transition-colors p-1" title="Xóa">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>{filteredMaterials.length > 0 ? `1–${filteredMaterials.length}` : '0'}/Tổng {filteredMaterials.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{formatNumber(filteredMaterialsCount)} vật tư</span>
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
                                    hasActiveFilters ? getFilterButtonClass('categories', true) : getFilterButtonClass('categories', false),
                                )}
                            >
                                <Filter size={18} className={getFilterIconClass('categories', hasActiveFilters)} />
                                {hasActiveFilters && (
                                    <span className={clsx(
                                        'absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                                        getFilterCountBadgeClass('categories')
                                    )}>
                                        {selectedCategories.length}
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)
                                        )}
                                    >
                                        <PackageOpen
                                            size={14}
                                            className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)}
                                        />
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
                                        onClick={() => setSelectedCategories([])}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <PackageOpen className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng vật tư</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(statsMaterials.length)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Phân loại</h3>
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
                                                plugins: { legend: { position: 'bottom' } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Vật tư</h3>
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
                            id: 'categories',
                            label: 'Phân loại',
                            icon: <PackageOpen size={16} className="text-violet-600" />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        }
                    ]}
                />
            )}

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