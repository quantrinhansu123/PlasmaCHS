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
import { clsx } from 'clsx';
import {
    BarChart2,
    Building2,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Eye,
    List,
    Phone,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    X,
    MoreVertical
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import SupplierDetailsModal from '../components/Suppliers/SupplierDetailsModal';
import SupplierFormModal from '../components/Suppliers/SupplierFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
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

const TABLE_COLUMNS_DEF = [
    { key: 'name', label: 'Tên nhà cung cấp' },
    { key: 'tax_id', label: 'MST' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'address', label: 'Địa chỉ liên hệ' },
];

const Suppliers = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const columnPickerRef = useRef(null);

    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = TABLE_COLUMNS_DEF.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_suppliers_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_suppliers') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS_DEF.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded]);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    useEffect(() => {
        if (location.pathname === '/nha-cung-cap/tao') {
            setSelectedSupplier(null);
            setIsFormModalOpen(true);
            navigate('/nha-cung-cap', { replace: true });
        }
    }, [location.pathname, navigate]);

    useEffect(() => {
        localStorage.setItem('columns_suppliers', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_suppliers_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            if (!event.target.closest('#more-actions-menu') && !event.target.closest('#more-actions-btn')) {
                setShowMoreActions(false);
            }
        };
        if (showColumnPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColumnPicker]);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSuppliers(data || []);
            setSelectedIds([]); // Clear selection on refresh
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            alert('❌ Không thể tải danh sách nhà cung cấp: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredSuppliers.length && filteredSuppliers.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredSuppliers.map(s => s.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} nhà cung cấp đã chọn không? Thao tác này không thể hoàn tác.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            alert(`🎉 Đã xóa thành công ${selectedIds.length} nhà cung cấp!`);
            setSelectedIds([]);
            fetchSuppliers();
        } catch (error) {
            console.error('Error deleting suppliers:', error);
            alert('❌ Có lỗi xảy ra khi xóa: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'Tên nhà cung cấp',
            'MST',
            'Email',
            'Số điện thoại',
            'Địa chỉ',
        ];

        const exampleData = [
            {
                'Tên nhà cung cấp': 'Công ty TNHH Oxy Việt Nam',
                'MST': '0123456789',
                'Email': 'contact@oxyvietnam.vn',
                'Số điện thoại': '02412345678',
                'Địa chỉ': 'KCN Tiên Sơn, Bắc Ninh',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import NCC');
        XLSX.writeFile(wb, 'mau_import_nha_cung_cap.xlsx');
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

                const suppliersToInsert = data.map(row => ({
                    name: row['Tên nhà cung cấp']?.toString(),
                    tax_id: row['MST']?.toString() || row['Mã số thuế']?.toString(),
                    email: row['Email']?.toString(),
                    phone: row['Số điện thoại']?.toString(),
                    address: row['Địa chỉ']?.toString(),
                    updated_at: new Date().toISOString()
                })).filter(s => s.name);

                if (suppliersToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu tên nhà cung cấp)!');
                    setIsLoading(false);
                    return;
                }

                const { error } = await supabase.from('suppliers').insert(suppliersToInsert);

                if (error) {
                    throw error;
                } else {
                    alert(`🎉 Đã import thành công ${suppliersToInsert.length} nhà cung cấp!`);
                    fetchSuppliers();
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

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const filteredSuppliers = suppliers.filter(supplier => {
        const search = searchTerm.toLowerCase();
        return (
            supplier.name?.toLowerCase().includes(search) ||
            supplier.tax_id?.toLowerCase().includes(search) ||
            supplier.email?.toLowerCase().includes(search) ||
            supplier.phone?.includes(search) ||
            supplier.address?.toLowerCase().includes(search)
        );
    });

    const filteredSuppliersCount = filteredSuppliers.length;

    const handleDeleteSupplier = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa đối tác "${name}" không? Dữ liệu liên quan có thể bị ảnh hưởng và không thể khôi phục.`)) {
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

    const handleFormSubmitSuccess = () => {
        fetchSuppliers();
        setIsFormModalOpen(false);
    };

    const getTopSuppliers = () => {
        return filteredSuppliers
            .map(supplier => ({ name: supplier.name, value: 1 }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 10);
    };

    const getSuppliersByFirstLetter = () => {
        const stats = {};
        filteredSuppliers.forEach((supplier) => {
            const firstLetter = supplier.name?.charAt(0).toUpperCase() || 'Khác';
            stats[firstLetter] = (stats[firstLetter] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const getRowStyle = () => 'hover:bg-primary/5';

    const getNameCellClass = () => clsx(
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
                    <div className="md:hidden flex flex-col p-3 border-b border-border bg-white sticky top-0 z-30 shadow-subtle">
                        {/* Row 1: Back, Title, Plus */}
                        <div className="flex items-center justify-between mb-3 gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="p-2.5 rounded-xl border border-border bg-white text-muted-foreground flex items-center justify-center shadow-sm active:scale-95 transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Nhà cung cấp</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedSupplier(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-[13px] font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                >
                                    <Plus size={18} />
                                    <span>Tạo mới</span>
                                </button>
                            </div>
                        </div>

                        {/* Row 2: Selection, Search, More Actions */}
                        <div className="flex items-center gap-2 min-h-[44px]">
                            {!isSearchExpanded ? (
                                <>
                                    <div className="flex items-center gap-2 pr-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredSuppliers.length && filteredSuppliers.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1"></div>
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center shadow-sm active:scale-95 transition-all"
                                    >
                                        <Search size={20} />
                                    </button>
                                </>
                            ) : (
                                <div className="relative flex-1 group animate-in slide-in-from-right-2 duration-200">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" size={16} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Tìm tên, mã, số ĐT..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                        className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-primary/30 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-semibold shadow-sm"
                                    />
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        {searchTerm && (
                                            <button 
                                                onClick={() => setSearchTerm('')} 
                                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setIsSearchExpanded(false)} 
                                            className="px-2 py-1 text-[12px] font-black text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        >
                                            Đóng
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isSearchExpanded && (
                                <div className="relative">
                                    <button
                                        id="more-actions-btn"
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        className={clsx(
                                            "p-2.5 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                            showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                        )}
                                    >
                                        <MoreVertical size={20} />
                                    </button>

                                    {showMoreActions && (
                                        <div id="more-actions-menu" className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                            <button
                                                onClick={() => { downloadTemplate(); setShowMoreActions(false); }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <Download size={18} className="text-slate-400" />
                                                Tải mẫu Excel
                                            </button>

                                            <label className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                                                <Upload size={18} className="text-slate-400" />
                                                Import Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={(e) => { handleImportExcel(e); setShowMoreActions(false); }}
                                                    className="hidden"
                                                    id="excel-import-mobile-sheet"
                                                />
                                            </label>

                                            {selectedIds.length > 0 && (
                                                <button
                                                    onClick={() => { handleBulkDelete(); setShowMoreActions(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                    Xóa ({selectedIds.length})
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredSuppliers.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredSuppliers.map((supplier) => (
                                <div key={supplier.id} className={clsx(
                                    "rounded-2xl border bg-gradient-to-br shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(supplier.id)
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                        : "border-primary/20 from-white to-primary/[0.03]"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(supplier.id)}
                                                    onChange={() => toggleSelectOne(supplier.id)}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nhà cung cấp</p>
                                                <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{supplier.name}</h3>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border border-primary/20 text-primary bg-primary/5">
                                            NCC
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 mb-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span>{supplier.phone || '—'}</span>
                                            </div>
                                            {supplier.tax_id && (
                                                <span className="text-[10px] font-bold text-primary/70 bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                                    MST: {supplier.tax_id}
                                                </span>
                                            )}
                                        </div>
                                        {supplier.email && (
                                            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                                <div className="w-3.5 h-3.5 flex items-center justify-center">
                                                    <div className="w-2.5 h-2.5 border border-muted-foreground/60 rounded-[2px] relative">
                                                        <div className="absolute top-0 left-0 w-full h-[1px] bg-muted-foreground/60 transform rotate-45 origin-top-left"></div>
                                                    </div>
                                                </div>
                                                <span>{supplier.email}</span>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                                            <Building2 className="w-3.5 h-3.5 mt-0.5" />
                                            <span className="line-clamp-2">{supplier.address || '—'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-border/70 mt-1">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 opacity-70">Thao tác</span>
                                            <span className="text-[12px] font-bold text-slate-800 tracking-tight">Quản trị NCC</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleViewSupplier(supplier)} 
                                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-blue-50 border border-blue-100 shadow-sm transition-all"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleEditSupplier(supplier)} 
                                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-amber-50 border border-amber-100 shadow-sm transition-all"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            {(role === 'admin' || role === 'manager') && (
                                                <button 
                                                    onClick={() => handleDeleteSupplier(supplier.id, supplier.name)} 
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-rose-50 border border-rose-100 shadow-sm transition-all"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
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
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
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
                                        setSelectedSupplier(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white text-[13px] font-black tracking-wider hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} />
                                    Thêm NCC
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
                                            checked={selectedIds.length === filteredSuppliers.length && filteredSuppliers.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th key={col.key} className={clsx('px-4 py-4 text-[10px] font-black text-muted-foreground text-left uppercase tracking-widest', col.key === 'name' && 'border-r border-primary/20')}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-30 bg-[#F1F5FF] px-4 py-3.5 text-[10px] font-black text-muted-foreground text-center uppercase tracking-widest shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">Quản trị</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredSuppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground">
                                            Không tìm thấy nhà cung cấp nào
                                        </td>
                                    </tr>
                                ) : filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className={clsx(
                                        "hover:bg-primary/[0.02] transition-colors group",
                                        selectedIds.includes(supplier.id) && "bg-primary/[0.05]"
                                    )}>
                                        <td className="w-12 px-4 py-4 text-center border-r border-primary/10">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(supplier.id)}
                                                onChange={() => toggleSelectOne(supplier.id)}
                                                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </td>
                                        {isColumnVisible('name') && <td className="px-4 py-4 text-[13px] font-black text-slate-800 border-r border-primary/10">{supplier.name || '—'}</td>}
                                        {isColumnVisible('tax_id') && <td className="px-4 py-4 text-[13px] font-bold text-slate-500 whitespace-nowrap">{supplier.tax_id || '—'}</td>}
                                        {isColumnVisible('email') && <td className="px-4 py-4 text-[13px] font-bold text-slate-500">{supplier.email || '—'}</td>}
                                        {isColumnVisible('phone') && <td className="px-4 py-4 text-[13px] font-bold text-slate-500 tabular-nums">{supplier.phone || '—'}</td>}
                                        {isColumnVisible('address') && <td className="px-4 py-4 text-[13px] font-bold text-slate-500">{supplier.address || '—'}</td>}
                                        <td className="sticky right-0 z-20 bg-white group-hover:bg-blue-50/40 px-4 py-4 text-center shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.25)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleViewSupplier(supplier)} 
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-blue-50 border border-blue-100 shadow-sm hover:bg-blue-600 hover:text-white hover:shadow-md transition-all duration-300" 
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-4.5 h-4.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEditSupplier(supplier)} 
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-amber-50 border border-amber-100 shadow-sm hover:bg-amber-500 hover:text-white hover:shadow-md transition-all duration-300" 
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit className="w-4.5 h-4.5" />
                                                </button>
                                                {(role === 'admin' || role === 'manager') && (
                                                    <button 
                                                        onClick={() => handleDeleteSupplier(supplier.id, supplier.name)} 
                                                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-950 bg-rose-50 border border-rose-100 shadow-sm hover:bg-rose-600 hover:text-white hover:shadow-md transition-all duration-300" 
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4.5 h-4.5" />
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
                            <span>{filteredSuppliers.length > 0 ? `1–${filteredSuppliers.length}` : '0'}/Tổng {filteredSuppliers.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{formatNumber(filteredSuppliersCount)} NCC</span>
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
                            <span className="w-9" />
                        </div>

                        <div className="hidden md:block p-4 border-b border-border">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                            >
                                <ChevronLeft size={16} />
                                Quay lại
                            </button>
                        </div>

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-primary/5 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-1 border border-primary/10 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="flex items-center justify-start gap-3 md:gap-4 relative z-10">
                                        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
                                            <Building2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-primary/70 uppercase tracking-wider">Tổng NCC</p>
                                            <p className="text-[34px] md:text-3xl font-black text-slate-800 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredSuppliersCount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Danh sách Nhà cung cấp</h3>
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
                                                plugins: { legend: { display: false } },
                                                scales: { x: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Chữ cái đầu</h3>
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
                                                plugins: { legend: { display: false } },
                                                scales: { y: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isFormModalOpen && (
                <SupplierFormModal
                    supplier={selectedSupplier}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}

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