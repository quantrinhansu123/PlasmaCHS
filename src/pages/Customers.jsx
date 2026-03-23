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
    Edit,
    Eye,
    Filter,
    List,
    MapPin,
    Phone,
    Plus,
    Search,
    SlidersHorizontal,
    Trash2,
    User,
    Users,
    Download,
    Upload,
    Ticket,
    X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import CustomerDetailsModal from '../components/Customers/CustomerDetailsModal';
import CustomerFormModal from '../components/Customers/CustomerFormModal';
import RepairTicketForm from '../components/Repairs/RepairTicketForm';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
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

const Customers = () => {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedManagedBy, setSelectedManagedBy] = useState([]);
    const [selectedCareBy, setSelectedCareBy] = useState([]);
    const [uniqueManagedBy, setUniqueManagedBy] = useState([]);
    const [uniqueCareBy, setUniqueCareBy] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingCategories, setPendingCategories] = useState([]);
    const [pendingManagedBy, setPendingManagedBy] = useState([]);
    const [pendingCareBy, setPendingCareBy] = useState([]);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

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

    const CUSTOMER_CATEGORIES = [
        { id: 'BV', label: 'Bệnh viện' },
        { id: 'TM', label: 'Thẩm mỹ viện' },
        { id: 'PK', label: 'Phòng khám' },
        { id: 'NG', label: 'Khách ngoại giao' },
        { id: 'SP', label: 'Spa / Khác' },
    ];

    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = TABLE_COLUMNS_DEF.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_customers_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_customers') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS_DEF.find(col => col.key === key))
        .filter(Boolean);
    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        fetchCustomers();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        const managedBy = [...new Set(customers.map(c => c.managed_by).filter(Boolean))];
        const careBy = [...new Set(customers.map(c => c.care_by).filter(Boolean))];
        setUniqueManagedBy(managedBy);
        setUniqueCareBy(careBy);
    }, [customers]);

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
        localStorage.setItem('columns_customers', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_customers_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingCategories(selectedCategories);
        setPendingManagedBy(selectedManagedBy);
        setPendingCareBy(selectedCareBy);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedCategories(pendingCategories);
        setSelectedManagedBy(pendingManagedBy);
        setSelectedCareBy(pendingCareBy);
        closeMobileFilter();
    };

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
            setSelectedIds([]); // Clear selection on refresh
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
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const getLabel = (list, id) => {
        return list.find(item => item.id === id)?.label || id;
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) {
            return 'border-border bg-white text-muted-foreground hover:text-foreground';
        }

        switch (filterKey) {
            case 'categories':
                return 'border-emerald-200 bg-emerald-50 text-emerald-700';
            case 'managedBy':
                return 'border-violet-200 bg-violet-50 text-violet-700';
            case 'careBy':
                return 'border-cyan-200 bg-cyan-50 text-cyan-700';
            default:
                return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'categories':
                return 'bg-emerald-600 text-white';
            case 'managedBy':
                return 'bg-violet-600 text-white';
            case 'careBy':
                return 'bg-cyan-600 text-white';
            default:
                return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'categories':
                return isActive ? 'text-emerald-700' : 'text-emerald-500';
            case 'managedBy':
                return isActive ? 'text-violet-700' : 'text-violet-500';
            case 'careBy':
                return isActive ? 'text-cyan-700' : 'text-cyan-500';
            default:
                return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
        categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        categoryId === 'NG' && 'bg-violet-50 text-violet-700 border-violet-200',
        categoryId === 'SP' && 'bg-amber-50 text-amber-700 border-amber-200',
        !categoryId && 'bg-muted text-muted-foreground border-border'
    );

    const getRowStyle = (categoryId) => {
        switch (categoryId) {
            case 'BV':
                return 'hover:bg-blue-50/60';
            case 'TM':
                return 'hover:bg-pink-50/60';
            case 'PK':
                return 'hover:bg-emerald-50/60';
            case 'NG':
                return 'hover:bg-violet-50/60';
            case 'SP':
                return 'hover:bg-amber-50/60';
            default:
                return 'hover:bg-primary/5';
        }
    };

    const getCodeCellClass = (categoryId) => clsx(
        'px-4 py-4 whitespace-nowrap text-sm font-semibold text-foreground border-r border-primary/20 border-l-4',
        categoryId === 'BV' && 'border-l-blue-400',
        categoryId === 'TM' && 'border-l-pink-400',
        categoryId === 'PK' && 'border-l-emerald-400',
        categoryId === 'NG' && 'border-l-violet-400',
        categoryId === 'SP' && 'border-l-amber-400',
        !categoryId && 'border-l-transparent'
    );

    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (
            (c.code?.toLowerCase().includes(search)) ||
            (c.name?.toLowerCase().includes(search)) ||
            (c.phone?.toLowerCase().includes(search)) ||
            (c.address?.toLowerCase().includes(search))
        );

        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category);
        const matchesManagedBy = selectedManagedBy.length === 0 || selectedManagedBy.includes(c.managed_by);
        const matchesCareBy = selectedCareBy.length === 0 || selectedCareBy.includes(c.care_by);

        return matchesSearch && matchesCategory && matchesManagedBy && matchesCareBy;
    });

    const filteredCustomersCount = filteredCustomers.length;
    const totalCylinders = filteredCustomers.reduce((sum, c) => sum + (c.current_cylinders || 0), 0);
    const totalMachines = filteredCustomers.reduce((sum, c) => sum + (c.current_machines || 0), 0);
    const totalBorrowed = filteredCustomers.reduce((sum, c) => sum + (c.borrowed_cylinders || 0), 0);

    const hasActiveFilters = selectedCategories.length > 0 || selectedManagedBy.length > 0 || selectedCareBy.length > 0;
    const totalActiveFilters = selectedCategories.length + selectedManagedBy.length + selectedCareBy.length;

    const categoryOptions = CUSTOMER_CATEGORIES.map(c => ({
        id: c.id,
        label: c.label,
        count: customers.filter(x => x.category === c.id).length
    }));

    const managedByOptions = uniqueManagedBy.map(name => ({
        id: name,
        label: name,
        count: customers.filter(x => x.managed_by === name).length
    }));

    const careByOptions = uniqueCareBy.map(name => ({
        id: name,
        label: name,
        count: customers.filter(x => x.care_by === name).length
    }));

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

    const handleRepairSubmitSuccess = () => {
        setIsRepairModalOpen(false);
        // Maybe navigate to repair tickets or just show success
        alert('✅ Đã tạo phiếu sửa chữa thành công!');
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCustomers.map(c => c.id));
        }
    };

    const handleBulkDelete = async () => {
        const count = selectedIds.length;
        if (count === 0) return;

        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${count} khách hàng đã chọn? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('customers')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            alert(`✅ Đã xóa thành công ${count} khách hàng.`);
            setSelectedIds([]);
            fetchCustomers();
        } catch (error) {
            console.error('Error bulk deleting customers:', error);
            alert('❌ Lỗi khi xóa hàng loạt: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = [
            'Mã khách hàng',
            'Tên khách hàng',
            'Loại khách hàng (BV/TM/PK/NG/SP)',
            'Số điện thoại',
            'Địa chỉ',
            'Người đại diện',
            'Kho quản lý',
            'KD chăm sóc',
            'Đại lý',
            'NVKD phụ trách',
            'Người liên hệ phụ',
            'Nhóm kinh doanh',
            'Mã số thuế',
            'Tên công ty hoá đơn',
            'Địa chỉ hoá đơn',
        ];

        const exampleData = [
            {
                'Mã khách hàng': 'KH00001',
                'Tên khách hàng': 'Bệnh viện Đa khoa Tỉnh',
                'Loại khách hàng (BV/TM/PK/NG/SP)': 'BV',
                'Số điện thoại': '0912345678',
                'Địa chỉ': '123 Đường ABC, Phường XYZ, TP. Hà Nội',
                'Người đại diện': 'Nguyễn Văn A',
                'Kho quản lý': warehousesList[0]?.name || 'Kho tổng',
                'KD chăm sóc': 'Nguyễn Thị B',
                'Đại lý': 'Đại lý ABC',
                'NVKD phụ trách': 'Trần Văn C',
                'Người liên hệ phụ': 'Lê Văn D - 0987654321',
                'Nhóm kinh doanh': 'Nhóm KD Miền Bắc',
                'Mã số thuế': '0101234567',
                'Tên công ty hoá đơn': 'Công ty TNHH Bệnh viện Đa khoa Tỉnh',
                'Địa chỉ hoá đơn': '123 Đường ABC, Phường XYZ, TP. Hà Nội',
            },
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Import Khách Hàng');
        XLSX.writeFile(wb, 'mau_import_khach_hang.xlsx');
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

                // Map warehouse names to IDs
                const warehouseMap = (warehousesList || []).reduce((acc, w) => {
                    acc[w.name.toLowerCase()] = w.id;
                    return acc;
                }, {});

                // Find if any rows need auto-generated codes
                const rowsNeedingCode = data.filter(row => !row['Mã khách hàng']);
                let nextCodeNum = 1;

                if (rowsNeedingCode.length > 0) {
                    try {
                        const { data: lastCustomer } = await supabase
                            .from('customers')
                            .select('code')
                            .order('created_at', { ascending: false })
                            .limit(1);

                        if (lastCustomer && lastCustomer.length > 0 && lastCustomer[0].code.startsWith('KH')) {
                            const lastCode = lastCustomer[0].code;
                            const numStr = lastCode.replace(/[^0-9]/g, '');
                            nextCodeNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                        }
                    } catch (err) {
                        console.error('Error fetching last code:', err);
                        nextCodeNum = Math.floor(10000 + Math.random() * 90000);
                    }
                }

                const customersToInsert = data.map(row => {
                    let code = row['Mã khách hàng']?.toString();
                    if (!code) {
                        code = `KH${(nextCodeNum++).toString().padStart(5, '0')}`;
                    }

                    return {
                        code: code,
                        name: row['Tên khách hàng']?.toString(),
                        category: row['Loại khách hàng (BV/TM/PK/NG/SP)']?.toString() || 'BV',
                        phone: row['Số điện thoại']?.toString(),
                        address: row['Địa chỉ']?.toString(),
                        legal_rep: row['Người đại diện']?.toString(),
                        warehouse_id: warehouseMap[row['Kho quản lý']?.toString()?.toLowerCase()] || null,
                        care_by: row['KD chăm sóc']?.toString(),
                        agency_name: row['Đại lý']?.toString(),
                        managed_by: row['NVKD phụ trách']?.toString(),
                        contact_info: row['Người liên hệ phụ']?.toString(),
                        business_group: row['Nhóm kinh doanh']?.toString(),
                        tax_code: row['Mã số thuế']?.toString(),
                        invoice_company_name: row['Tên công ty hoá đơn']?.toString(),
                        invoice_address: row['Địa chỉ hoá đơn']?.toString(),
                        updated_at: new Date().toISOString()
                    };
                }).filter(c => c.name);

                if (customersToInsert.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu tên khách hàng)!');
                    setIsLoading(false);
                    return;
                }

                const { error } = await supabase.from('customers').insert(customersToInsert);

                if (error) {
                    if (error.code === '23505') {
                        alert('Lỗi: Một số mã khách hàng đã tồn tại trên hệ thống. Vui lòng kiểm tra lại!');
                    } else {
                        throw error;
                    }
                } else {
                    alert(`🎉 Đã import thành công ${customersToInsert.length} khách hàng!`);
                    fetchCustomers();
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

    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    const clearAllFilters = () => {
        setSelectedCategories([]);
        setSelectedManagedBy([]);
        setSelectedCareBy([]);
    };

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
                                checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
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
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                            )}
                        >
                            <Filter size={18} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={downloadTemplate}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                            title="Tải mẫu"
                        >
                            <Download size={18} />
                        </button>

                        <label className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 cursor-pointer" title="Import Excel">
                            <Upload size={18} />
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportExcel}
                                className="hidden"
                            />
                        </label>

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
                                setSelectedCustomer(null);
                                setIsFormModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredCustomers.map((c) => (
                                <div key={c.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200",
                                    selectedIds.includes(c.id) 
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20" 
                                        : "border-primary/15 bg-white"
                                )}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(c.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelectOne(c.id);
                                                    }}
                                                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{c.code}</p>
                                                <h3 className="text-[15px] font-bold text-foreground leading-tight mt-0.5">{c.name}</h3>
                                            </div>
                                        </div>
                                        <span className={getCategoryBadgeClass(c.category)}>
                                            {getLabel(CUSTOMER_CATEGORIES, c.category)}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 mb-3">
                                        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>{c.phone || '—'}</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-[12px] text-muted-foreground">
                                            <MapPin className="w-3.5 h-3.5 mt-0.5" />
                                            <span className="line-clamp-2">{c.address || '—'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/10 border border-border/60 p-2.5 mb-3">
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số vỏ</p>
                                            <p className="text-[13px] font-bold text-foreground">{formatNumber(c.current_cylinders || 0)}</p>
                                        </div>
                                        <div className="text-center border-x border-border/60">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số máy</p>
                                            <p className="text-[13px] font-bold text-foreground">{formatNumber(c.current_machines || 0)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Bình mượn</p>
                                            <p className="text-[13px] font-bold text-foreground">{formatNumber(c.borrowed_cylinders || 0)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <User size={12} />
                                            <span>{c.managed_by || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => { setSelectedCustomer(c); setIsRepairModalOpen(true); }} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg" title="Báo hỏng"><Ticket size={16} /></button>
                                            <button onClick={() => handleViewCustomer(c)} className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg"><Eye size={16} /></button>
                                            <button onClick={() => handleEditCustomer(c)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"><Edit size={16} /></button>
                                            <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="p-2 text-red-700 bg-red-50 border border-red-100 rounded-lg"><Trash2 size={16} /></button>
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
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
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
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground text-[13px] font-bold transition-all shadow-sm"
                                >
                                    <Download size={16} />
                                    Tải mẫu
                                </button>

                                <label className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-border bg-white text-muted-foreground hover:text-foreground text-[13px] font-bold transition-all shadow-sm cursor-pointer">
                                    <Upload size={16} />
                                    Import Excel
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleImportExcel}
                                        className="hidden"
                                    />
                                </label>

                                <button
                                    onClick={() => {
                                        setSelectedCustomer(null);
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
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'categories' ? null : 'categories')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)
                                    )}
                                >
                                    <Users size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)} />
                                    Loại khách
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

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'managedBy' ? null : 'managedBy')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('managedBy', activeDropdown === 'managedBy' || selectedManagedBy.length > 0)
                                    )}
                                >
                                    <User size={14} className={getFilterIconClass('managedBy', activeDropdown === 'managedBy' || selectedManagedBy.length > 0)} />
                                    NV phụ trách
                                    {selectedManagedBy.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managedBy'))}>
                                            {selectedManagedBy.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managedBy' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'managedBy' && (
                                    <FilterDropdown
                                        options={managedByOptions}
                                        selected={selectedManagedBy}
                                        setSelected={setSelectedManagedBy}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'careBy' ? null : 'careBy')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)
                                    )}
                                >
                                    <User size={14} className={getFilterIconClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)} />
                                    KD chăm sóc
                                    {selectedCareBy.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('careBy'))}>
                                            {selectedCareBy.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'careBy' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'careBy' && (
                                    <FilterDropdown
                                        options={careByOptions}
                                        selected={selectedCareBy}
                                        setSelected={setSelectedCareBy}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                        <table className="w-full border-collapse">
                            <thead className="bg-primary/5">
                                <tr>
                                    <th className="px-4 py-3.5 text-center border-r border-primary/30">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </th>
                                    {visibleTableColumns.map(col => (
                                        <th
                                            key={col.key}
                                            className={clsx(
                                                'px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide',
                                                col.key === 'code' && 'border-l border-r border-primary/30'
                                            )}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground italic">
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={visibleTableColumns.length + 2} className="px-4 py-16 text-center text-muted-foreground italic">
                                            Không tìm thấy kết quả phù hợp
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map((c) => (
                                        <tr 
                                            key={c.id} 
                                        className={clsx(
                                            getRowStyle(c.category),
                                            selectedIds.includes(c.id) && "bg-primary/[0.04] !hover:bg-primary/[0.08]"
                                        )}
                                    >
                                        <td className="px-4 py-4 text-center border-r border-primary/10">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(c.id)}
                                                onChange={() => toggleSelectOne(c.id)}
                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                            />
                                        </td>
                                        {isColumnVisible('code') && <td className={getCodeCellClass(c.category)}>{c.code}</td>}
                                        {isColumnVisible('name') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{c.name}</td>}
                                        {isColumnVisible('phone') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.phone || '—'}</td>}
                                        {isColumnVisible('address') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.address || '—'}</td>}
                                        {isColumnVisible('legal_rep') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.legal_rep || '—'}</td>}
                                        {isColumnVisible('managed_by') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.managed_by || '—'}</td>}
                                        {isColumnVisible('category') && <td className="px-4 py-4 text-sm text-muted-foreground"><span className={getCategoryBadgeClass(c.category)}>{getLabel(CUSTOMER_CATEGORIES, c.category)}</span></td>}
                                        {isColumnVisible('current_cylinders') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{formatNumber(c.current_cylinders || 0)}</td>}
                                        {isColumnVisible('current_machines') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{formatNumber(c.current_machines || 0)}</td>}
                                        {isColumnVisible('borrowed_cylinders') && <td className="px-4 py-4 text-sm font-semibold text-foreground">{formatNumber(c.borrowed_cylinders || 0)}</td>}
                                        {isColumnVisible('machines_in_use') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.machines_in_use || '—'}</td>}
                                        {isColumnVisible('care_by') && <td className="px-4 py-4 text-sm text-muted-foreground">{c.care_by || '—'}</td>}
                                        <td className="px-4 py-4 text-center border-l border-r border-primary/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <button onClick={() => { setSelectedCustomer(c); setIsRepairModalOpen(true); }} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Báo hỏng">
                                                    <Ticket size={16} className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleViewCustomer(c)} className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50" title="Xem chi tiết">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEditCustomer(c)} className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50" title="Chỉnh sửa">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50" title="Xóa">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="hidden md:flex px-4 py-4 border-t border-border items-center justify-between bg-muted/5">
                        <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                            <span>{filteredCustomers.length > 0 ? `1–${filteredCustomers.length}` : '0'}/Tổng {filteredCustomers.length}</span>
                            <div className="flex items-center gap-1 ml-2">
                                <span className="text-[11px] font-bold">│</span>
                                <span className="text-primary font-bold">{formatNumber(totalCylinders)} vỏ</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-primary font-bold">{formatNumber(totalMachines)} máy</span>
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
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                                )}
                            >
                                <Filter size={18} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                        {totalActiveFilters}
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
                                        <Users size={14} className={getFilterIconClass('categories', activeDropdown === 'categories' || selectedCategories.length > 0)} />
                                        Loại khách
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

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'managedBy' ? null : 'managedBy')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('managedBy', activeDropdown === 'managedBy' || selectedManagedBy.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('managedBy', activeDropdown === 'managedBy' || selectedManagedBy.length > 0)} />
                                        NV phụ trách
                                        {selectedManagedBy.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('managedBy'))}>
                                                {selectedManagedBy.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'managedBy' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'managedBy' && (
                                        <FilterDropdown
                                            options={managedByOptions}
                                            selected={selectedManagedBy}
                                            setSelected={setSelectedManagedBy}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'careBy' ? null : 'careBy')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)} />
                                        KD chăm sóc
                                        {selectedCareBy.length > 0 && (
                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('careBy'))}>
                                                {selectedCareBy.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'careBy' ? 'rotate-180' : '')} />
                                    </button>
                                    {activeDropdown === 'careBy' && (
                                        <FilterDropdown
                                            options={careByOptions}
                                            selected={selectedCareBy}
                                            setSelected={setSelectedCareBy}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        onClick={clearAllFilters}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-2xl p-3.5 md:p-5 shadow-sm col-span-2 md:col-span-1">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng khách hàng</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-blue-900 mt-0.5 md:mt-1 leading-none">{formatNumber(filteredCustomersCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">Tổng vỏ bình</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-green-900 mt-0.5 md:mt-1 leading-none">{formatNumber(totalCylinders)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded-2xl p-3.5 md:p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-3 md:gap-4">
                                        <div className="w-12 h-12  bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                            <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Tổng máy</p>
                                            <p className="text-[34px] md:text-3xl font-bold text-orange-900 mt-0.5 md:mt-1 leading-none">{formatNumber(totalMachines)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ theo Loại khách</h3>
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
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Nhân viên phụ trách</h3>
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
                                                plugins: { legend: { display: false } },
                                                scales: { x: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Top 10 KD chăm sóc</h3>
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
                                                plugins: { legend: { display: false } },
                                                scales: { x: { beginAtZero: true } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ Bình</h3>
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
                                                plugins: { legend: { position: 'bottom' } }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
                                    <h3 className="text-lg font-bold text-foreground mb-4">Phân bổ Máy</h3>
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
                                                plugins: { legend: { position: 'bottom' } }
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
                            label: 'Loại khách',
                            icon: <Users size={16} className="text-emerald-600" />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        },
                        {
                            id: 'managedBy',
                            label: 'Nhân viên phụ trách',
                            icon: <User size={16} className="text-violet-600" />,
                            options: managedByOptions,
                            selectedValues: pendingManagedBy,
                            onSelectionChange: setPendingManagedBy,
                        },
                        {
                            id: 'careBy',
                            label: 'KD chăm sóc',
                            icon: <User size={16} className="text-cyan-600" />,
                            options: careByOptions,
                            selectedValues: pendingCareBy,
                            onSelectionChange: setPendingCareBy,
                        },
                    ]}
                />
            )}

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

            {isRepairModalOpen && selectedCustomer && (
                <RepairTicketForm
                    initialCustomer={selectedCustomer}
                    onClose={() => setIsRepairModalOpen(false)}
                    onSuccess={handleRepairSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Customers;
