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
    Calendar,
    ClipboardCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit,
    Eye,
    FilePlus,
    Filter,
    List,
    Mail,
    MapPin,
    MoreVertical,
    Phone,
    Plus,
    Search,
    SlidersHorizontal,
    ToggleLeft,
    ToggleRight,
    Trash2,
    Upload,
    User,
    Users,
    X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { exportCustomerList } from '../utils/exportExcel';
import CustomerDetailsModal from '../components/Customers/CustomerDetailsModal';
import CustomerFormModal from '../components/Customers/CustomerFormModal';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';
import { notificationService } from '../utils/notificationService';

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

/** Bộ lọc lead trên Supabase (khớp phân trang + đếm tổng). */
function appendLeadCustomerFilters(query, {
    searchTrimmed,
    leadCreatedFrom,
    leadCreatedTo,
    selectedCareBy,
    selectedManagedBy,
    selectedCategories,
    selectedStatuses,
    categoryDefinitions,
}) {
    let q = query;
    const t = (searchTrimmed || '').trim();
    if (t) {
        const esc = t.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '');
        const p = `%${esc}%`;
        q = q.or(`code.ilike.${p},name.ilike.${p},phone.ilike.${p},address.ilike.${p}`);
    }
    if (leadCreatedFrom) {
        q = q.gte('created_at', new Date(`${leadCreatedFrom}T00:00:00`).toISOString());
    }
    if (leadCreatedTo) {
        q = q.lte('created_at', new Date(`${leadCreatedTo}T23:59:59.999`).toISOString());
    }
    if (selectedCareBy?.length) q = q.in('care_by', selectedCareBy);
    if (selectedManagedBy?.length) q = q.in('managed_by', selectedManagedBy);
    if (selectedCategories?.length) {
        const vals = new Set();
        for (const catId of selectedCategories) {
            vals.add(catId);
            const def = categoryDefinitions.find((d) => d.id === catId);
            if (def?.label) vals.add(def.label);
        }
        q = q.in('category', [...vals]);
    }
    if (selectedStatuses?.length === 1) {
        if (selectedStatuses[0] === 'Thành công') q = q.eq('status', 'Thành công');
        else if (selectedStatuses[0] === 'Chưa thành công') {
            q = q.or('status.eq.Chưa thành công,status.is.null');
        }
    }
    return q;
}

const Customers = () => {
    const { role } = usePermissions();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedManagedBy, setSelectedManagedBy] = useState([]);
    const [selectedCareBy, setSelectedCareBy] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [uniqueManagedBy, setUniqueManagedBy] = useState([]);
    const [uniqueCareBy, setUniqueCareBy] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalRecords, setTotalRecords] = useState(0);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingCategories, setPendingCategories] = useState([]);
    const [pendingManagedBy, setPendingManagedBy] = useState([]);
    const [pendingCareBy, setPendingCareBy] = useState([]);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [leadCreatedFrom, setLeadCreatedFrom] = useState('');
    const [leadCreatedTo, setLeadCreatedTo] = useState('');
    const [pendingLeadCreatedFrom, setPendingLeadCreatedFrom] = useState('');
    const [pendingLeadCreatedTo, setPendingLeadCreatedTo] = useState('');
    const [leadDistinctCareBy, setLeadDistinctCareBy] = useState([]);
    const [leadDistinctManagedBy, setLeadDistinctManagedBy] = useState([]);
    const [debouncedLeadSearch, setDebouncedLeadSearch] = useState('');
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef(null);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const dropdownRef = useRef(null);
    const columnPickerRef = useRef(null);

    const searchParams = new URLSearchParams(location.search);
    const filterType = searchParams.get('filter') || (location.pathname === '/khach-hang-lead' ? 'lead' : null);

    /** Lead / khách hàng: đã lọc trên server — không lọc lại client (tránh tải trang rồi vứt bớt dòng) */
    const leadFilterRef = useRef(null);

    const TABLE_COLUMNS_DEF = [
        { key: 'code', label: 'Mã khách hàng' },
        { key: 'name', label: 'Tên khách hàng / Tên cơ sở' },
        { key: 'phone', label: 'Số điện thoại' },
        { key: 'address', label: 'Địa chỉ' },
        { key: 'legal_rep', label: 'Người đại diện pháp luật' },
        { key: 'managed_by', label: 'Nhân viên phụ trách' },
        { key: 'category', label: 'Loại khách hàng' },
        { key: 'care_assigned_at', label: 'Ngày đăng ký' },
        { key: 'care_expiry_date', label: 'Ngày hết hạn' },
        { key: 'days_left', label: 'Ngày còn lại' },
        { key: 'care_status', label: 'Trạng thái CS' },
        { key: 'status', label: 'Trạng thái' },
        { key: 'success_at', label: 'Ngày thành công' },
        { key: 'invoice_email', label: 'Email hóa đơn' },
        { key: 'current_cylinders', label: 'Vỏ bình' },
        { key: 'current_machines', label: 'Máy móc' },
        { key: 'borrowed_cylinders', label: 'Vỏ mượn' },
        { key: 'care_by', label: 'KD chăm sóc' },
    ];

    /** Trang đăng ký lead: không hiển thị các cột tồn vỏ/máy (chưa phải khách thành công). */
    const LEAD_HIDDEN_COLUMN_KEYS = ['current_cylinders', 'current_machines', 'borrowed_cylinders'];

    const CUSTOMER_CATEGORIES = [
        { id: 'BV', label: 'Bệnh viện' },
        { id: 'TM', label: 'Thẩm mỹ viện' },
        { id: 'PK', label: 'Phòng khám' },
        { id: 'NG', label: 'Khách ngoại giao' },
        { id: 'GD', label: 'Gia đình' },
        { id: 'SP', label: 'Spa / Khác' },
    ];

    const defaultColOrder = TABLE_COLUMNS_DEF.map(col => col.key);
    const columnDefs = useMemo(
        () =>
            TABLE_COLUMNS_DEF.reduce((acc, col) => {
                acc[col.key] = {
                    label: col.key === 'code' && filterType === 'lead' ? 'STT' : col.label,
                };
                return acc;
            }, {}),
        [filterType]
    );
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
        .filter(key => filterType !== 'lead' || !LEAD_HIDDEN_COLUMN_KEYS.includes(key))
        .map(key => TABLE_COLUMNS_DEF.find(col => col.key === key))
        .filter(Boolean);
    const pickerDisplayKeys =
        filterType === 'lead'
            ? defaultColOrder.filter((k) => !LEAD_HIDDEN_COLUMN_KEYS.includes(k))
            : defaultColOrder;
    const visibleCount = visibleColumns.filter((k) => pickerDisplayKeys.includes(k)).length;
    const totalCount = pickerDisplayKeys.length;

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (filterType !== 'lead') {
            setDebouncedLeadSearch('');
            return;
        }
        const t = setTimeout(() => setDebouncedLeadSearch(searchTerm), 320);
        return () => clearTimeout(t);
    }, [searchTerm, filterType]);

    useEffect(() => {
        if (filterType !== 'lead') return;
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase.from('customers').select('care_by,managed_by').limit(10000);
            if (cancelled || error) return;
            const rows = data || [];
            const care = [...new Set(rows.map((r) => r.care_by).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
            const man = [...new Set(rows.map((r) => r.managed_by).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
            setLeadDistinctCareBy(care);
            setLeadDistinctManagedBy(man);
        })();
        return () => {
            cancelled = true;
        };
    }, [filterType]);

    useEffect(() => {
        if (filterType !== 'lead') return;
        setCurrentPage(1);
    }, [
        filterType,
        leadCreatedFrom,
        leadCreatedTo,
        selectedCareBy,
        selectedManagedBy,
        selectedCategories,
        selectedStatuses,
        debouncedLeadSearch,
    ]);

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true);
        try {
            const switched = leadFilterRef.current !== null && leadFilterRef.current !== filterType;
            leadFilterRef.current = filterType;
            const page = switched ? 1 : currentPage;
            if (switched) {
                setCurrentPage(1);
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('customers')
                .select('*', { count: 'exact' });

            if (filterType === 'lead') {
                query = appendLeadCustomerFilters(query, {
                    searchTrimmed: debouncedLeadSearch,
                    leadCreatedFrom,
                    leadCreatedTo,
                    selectedCareBy,
                    selectedManagedBy,
                    selectedCategories,
                    selectedStatuses,
                    categoryDefinitions: CUSTOMER_CATEGORIES,
                });
                query = query
                    .order('status', { ascending: true, nullsFirst: true })
                    .order('created_at', { ascending: false });
            } else {
                query = query
                    .eq('status', 'Thành công')
                    .order('created_at', { ascending: false });
            }

            const { data, count, error } = await query.range(from, to);

            if (error) throw error;
            setCustomers(data || []);
            setTotalRecords(count ?? 0);
            setSelectedIds([]);
        } catch (error) {
            console.error('Error fetching customers:', error);
            alert('❌ Không thể tải danh sách khách hàng: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [
        currentPage,
        pageSize,
        filterType,
        debouncedLeadSearch,
        leadCreatedFrom,
        leadCreatedTo,
        selectedCareBy,
        selectedManagedBy,
        selectedCategories,
        selectedStatuses,
    ]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    useEffect(() => {
        if (location.pathname === '/khach-hang/tao') {
            setSelectedCustomer(null);
            setIsFormModalOpen(true);
            navigate('/khach-hang', { replace: true });
        }
    }, [location.pathname, navigate]);

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded]);

    useEffect(() => {
        if (filterType === 'lead') return;
        const managedBy = [...new Set(customers.map((c) => c.managed_by).filter(Boolean))];
        const careBy = [...new Set(customers.map((c) => c.care_by).filter(Boolean))];
        setUniqueManagedBy(managedBy);
        setUniqueCareBy(careBy);
    }, [customers, filterType]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            if (!event.target.closest('#more-actions-menu') && !event.target.closest('#more-actions-btn')) {
                setShowMoreActions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, showColumnPicker, showMoreActions]);

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
        setPendingStatuses(selectedStatuses);
        setPendingLeadCreatedFrom(leadCreatedFrom);
        setPendingLeadCreatedTo(leadCreatedTo);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedCategories(pendingCategories);
        setSelectedManagedBy(pendingManagedBy);
        setSelectedCareBy(pendingCareBy);
        setSelectedStatuses(pendingStatuses);
        setLeadCreatedFrom(pendingLeadCreatedFrom);
        setLeadCreatedTo(pendingLeadCreatedTo);
        closeMobileFilter();
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name, manager_name, branch_office').eq('status', 'Đang hoạt động').order('name');
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
        categoryId === 'PK' && 'bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-md shadow-primary/10',
        categoryId === 'NG' && 'bg-violet-50 text-violet-700 border-violet-200',
        categoryId === 'GD' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
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


    const filteredCustomers =
        filterType === 'lead'
            ? customers
            : customers.filter((c) => {
                  const search = searchTerm.toLowerCase();
                  const matchesSearch =
                      (c.code?.toLowerCase().includes(search)) ||
                      (c.name?.toLowerCase().includes(search)) ||
                      (c.phone?.toLowerCase().includes(search)) ||
                      (c.address?.toLowerCase().includes(search));

                  const matchesCategory =
                      selectedCategories.length === 0 ||
                      selectedCategories.some((catId) => {
                          const catDef = CUSTOMER_CATEGORIES.find((def) => def.id === catId);
                          return c.category === catId || (catDef && c.category === catDef.label);
                      });
                  const matchesManagedBy =
                      selectedManagedBy.length === 0 || selectedManagedBy.includes(c.managed_by);
                  const matchesCareBy = selectedCareBy.length === 0 || selectedCareBy.includes(c.care_by);
                  const matchesStatus =
                      selectedStatuses.length === 0 ||
                      selectedStatuses.some((s) => {
                          if (s === 'Chưa thành công') {
                              if (c.status === 'Chưa thành công') return true;
                              if (filterType === 'lead' && (c.status == null || c.status === '')) return true;
                              return false;
                          }
                          return c.status === s;
                      });

                  return matchesSearch && matchesCategory && matchesManagedBy && matchesCareBy && matchesStatus;
              });

    const filteredCustomersCount = filteredCustomers.length;
    const totalCylinders = filteredCustomers.reduce((sum, c) => sum + (c.current_cylinders || 0), 0);
    const totalMachines = filteredCustomers.reduce((sum, c) => sum + (c.current_machines || 0), 0);
    const totalBorrowed = filteredCustomers.reduce((sum, c) => sum + (c.borrowed_cylinders || 0), 0);

    const hasActiveFilters =
        selectedCategories.length > 0 ||
        selectedManagedBy.length > 0 ||
        selectedCareBy.length > 0 ||
        selectedStatuses.length > 0 ||
        (filterType === 'lead' && (!!leadCreatedFrom || !!leadCreatedTo));
    const totalActiveFilters =
        selectedCategories.length +
        selectedManagedBy.length +
        selectedCareBy.length +
        selectedStatuses.length +
        (filterType === 'lead' && (leadCreatedFrom || leadCreatedTo) ? 1 : 0);

    const managedByNames = filterType === 'lead' ? leadDistinctManagedBy : uniqueManagedBy;
    const careByNames = filterType === 'lead' ? leadDistinctCareBy : uniqueCareBy;

    const categoryOptions = CUSTOMER_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        count: filterType === 'lead' ? '—' : customers.filter((x) => x.category === c.id || x.category === c.label).length,
    }));

    const managedByOptions = managedByNames.map((name) => ({
        id: name,
        label: name,
        count: filterType === 'lead' ? '—' : customers.filter((x) => x.managed_by === name).length,
    }));

    const careByOptions = careByNames.map((name) => ({
        id: name,
        label: name,
        count: filterType === 'lead' ? '—' : customers.filter((x) => x.care_by === name).length,
    }));

    const statusOptions = useMemo(() => {
        if (filterType === 'lead') {
            return [
                { id: 'Chưa thành công', label: 'Chưa thành công', count: '—' },
                { id: 'Thành công', label: 'Thành công', count: '—' },
            ];
        }
        return [
            { id: 'Thành công', label: 'Thành công', count: customers.filter((x) => x.status === 'Thành công').length },
            { id: 'Chưa thành công', label: 'Chưa thành công', count: customers.filter((x) => x.status === 'Chưa thành công').length },
        ];
    }, [filterType, customers]);

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

    const handleFormSubmitSuccess = async () => {
        const keepDetailId = selectedCustomer?.id;
        await fetchCustomers();
        setIsFormModalOpen(false);
        if (keepDetailId) {
            const { data, error } = await supabase.from('customers').select('*').eq('id', keepDetailId).single();
            if (!error && data) setSelectedCustomer(data);
        }
    };

    const isLikelyNetworkFailure = (err) => {
        if (!err) return false;
        const msg = String(err.message ?? err);
        const name = err.name ?? '';
        return (
            msg.includes('Failed to fetch') ||
            msg.includes('NetworkError') ||
            msg.includes('Load failed') ||
            msg.includes('network') ||
            name === 'TypeError'
        );
    };

    const handleStatusChange = async (id, newStatus) => {
        if (id == null || newStatus == null || newStatus === '') {
            alert('❌ Không cập nhật được: thiếu mã khách hoặc trạng thái.');
            return;
        }

        const patch = {
            status: newStatus,
            success_at: newStatus === 'Thành công' ? new Date().toISOString() : null,
        };

        const runUpdate = () => supabase.from('customers').update(patch).eq('id', id);

        const attemptOnce = async () => {
            try {
                const { error } = await runUpdate();
                return { error };
            } catch (e) {
                return { error: e };
            }
        };

        try {
            let { error } = await attemptOnce();

            if (error && isLikelyNetworkFailure(error)) {
                await new Promise((r) => setTimeout(r, 500));
                ({ error } = await attemptOnce());
            }

            if (error) throw error instanceof Error ? error : new Error(String(error?.message ?? error));

            if (newStatus === 'Thành công') {
                const updatedCustomer = customers.find(c => c.id === id);
                if (updatedCustomer && updatedCustomer.status !== 'Thành công') {
                    notificationService.add({
                        title: `🎉 Khách hàng chốt Thành công: ${updatedCustomer.name}`,
                        description: `NV Kinh doanh (${updatedCustomer.care_by || 'Không rõ'}) vừa chuyển trạng thái khách hàng này sang Thành công.`,
                        type: 'success',
                        link: '/khach-hang'
                    });
                }
            }

            setCustomers((prev) =>
                prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
            );
        } catch (error) {
            console.error('Error updating status:', error);
            const raw = error?.message ?? String(error);
            const networkHint =
                raw.includes('Failed to fetch') || error?.name === 'TypeError'
                    ? '\n\n— Kiểm tra: mạng/VPN; tường lửa (một số môi trường chặn PATCH); extension chặn request; dự án Supabase còn hoạt động; biến VITE_SUPABASE_URL trong .env đúng.'
                    : '';
            alert('❌ Không thể cập nhật trạng thái: ' + raw + networkHint);
        }
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

    /** Số ngày còn lại đến hạn chăm sóc (null nếu không có ngày hết hạn) */
    const getCareExpiryDiffDays = (c) => {
        if (!c.care_expiry_date) return null;
        return Math.ceil((new Date(c.care_expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    };

    /**
     * Lead: STT theo thứ tự tạo toàn danh sách (1 = tạo sớm nhất, N = mới nhất).
     * API sort created_at DESC; offset trong trang = from + chỉ số dòng trong `customers`.
     */
    const getLeadCreationStt = useCallback(
        (customerId) => {
            if (filterType !== 'lead' || !totalRecords) return null;
            const idxInPage = customers.findIndex((x) => x.id === customerId);
            if (idxInPage < 0) return null;
            const from = (currentPage - 1) * pageSize;
            return totalRecords - (from + idxInPage);
        },
        [filterType, totalRecords, customers, currentPage, pageSize]
    );

    /** Một ô <td> — thứ tự khớp thead (visibleTableColumns) */
    const renderCustomerTableCell = (c, colKey) => {
        const diff = getCareExpiryDiffDays(c);
        switch (colKey) {
            case 'code':
                if (filterType === 'lead') {
                    const stt = getLeadCreationStt(c.id);
                    return (
                        <td
                            key={colKey}
                            className="px-4 py-4 text-center text-sm font-bold text-slate-600 tabular-nums border-l border-r border-primary/20"
                        >
                            {stt != null ? stt : '—'}
                        </td>
                    );
                }
                return <td key={colKey} className={getCodeCellClass(c.category)}>{c.code}</td>;
            case 'name':
                return <td key={colKey} className="px-4 py-4 text-sm font-semibold text-foreground">{c.name}</td>;
            case 'phone':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.phone || '—'}</td>;
            case 'address':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.address || '—'}</td>;
            case 'legal_rep':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.legal_rep || '—'}</td>;
            case 'managed_by':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.managed_by || '—'}</td>;
            case 'category':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">
                        <span className={getCategoryBadgeClass(c.category)}>{getLabel(CUSTOMER_CATEGORIES, c.category)}</span>
                    </td>
                );
            case 'care_assigned_at':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {c.care_assigned_at
                            ? new Date(c.care_assigned_at).toLocaleString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                              })
                            : '—'}
                    </td>
                );
            case 'days_left':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm whitespace-nowrap">
                        {diff == null ? (
                            '—'
                        ) : diff <= 0 ? (
                            <span className="font-bold text-rose-600">0</span>
                        ) : (
                            <span className="font-bold text-slate-700">{diff}</span>
                        )}
                    </td>
                );
            case 'care_status':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm whitespace-nowrap">
                        {diff == null ? (
                            '—'
                        ) : diff <= 0 ? (
                            <span className="text-[11px] font-bold text-rose-600 uppercase">Hết hạn</span>
                        ) : diff <= 10 ? (
                            <span className="text-[11px] font-bold text-amber-600 uppercase">Sắp hết hạn</span>
                        ) : (
                            <span className="text-[11px] font-bold text-emerald-600 uppercase">Trong hạn</span>
                        )}
                    </td>
                );
            case 'status': {
                const statusValue =
                    c.status === 'Thành công' ? 'Thành công' : 'Chưa thành công';
                return (
                    <td key={colKey} className="px-4 py-4 text-sm relative z-10">
                        <select
                            value={statusValue}
                            onChange={(e) => handleStatusChange(c.id, e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={clsx(
                                'customer-status-select max-w-full min-w-[10.5rem] min-h-9 px-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border border-slate-200/80 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-all appearance-auto',
                                c.status === 'Thành công'
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            )}
                        >
                            <option value="Chưa thành công">Chưa thành công</option>
                            <option value="Thành công">Thành công</option>
                        </select>
                    </td>
                );
            }
            case 'success_at':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {c.success_at
                            ? new Date(c.success_at).toLocaleString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })
                            : '—'}
                    </td>
                );
            case 'care_expiry_date':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {c.care_expiry_date
                            ? new Date(c.care_expiry_date).toLocaleDateString('vi-VN')
                            : '—'}
                    </td>
                );
            case 'current_cylinders':
            case 'current_machines':
            case 'borrowed_cylinders':
                return (
                    <td key={colKey} className="px-4 py-4 text-sm font-semibold text-foreground">
                        {formatNumber(c[colKey] || 0)}
                    </td>
                );
            case 'care_by':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.care_by || '—'}</td>;
            case 'invoice_email':
                return <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">{c.invoice_email || '—'}</td>;
            default:
                return (
                    <td key={colKey} className="px-4 py-4 text-sm text-muted-foreground">
                        —
                    </td>
                );
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

    const handleExportTransactionsBulk = async () => {
        const targetIds = selectedIds.length > 0 ? selectedIds : filteredCustomers.map(c => c.id);

        if (targetIds.length === 0) {
            alert('Không có khách hàng nào để xuất giao dịch!');
            return;
        }

        const confirmMsg = selectedIds.length > 0
            ? `Bạn muốn sao lưu lịch sử giao dịch cho ${selectedIds.length} khách hàng đã chọn?`
            : `Bạn muốn sao lưu toàn bộ lịch sử giao dịch cho ${filteredCustomers.length} khách hàng đang hiển thị?`;

        if (!window.confirm(confirmMsg)) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customer_transactions')
                .select('*')
                .in('customer_id', targetIds)
                .order('transaction_date', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                alert('Không tìm thấy giao dịch nào để sao lưu!');
                setIsLoading(false);
                return;
            }

            const exportData = data.map(tx => ({
                'Tên Khách Hàng': tx.customer_name,
                'Mã Giao Dịch': tx.transaction_code,
                'Ngày': tx.transaction_date,
                'Loại': tx.transaction_type === 'THU' ? 'Thu (Khách trả)' : 'Chi (Hoàn tiền)',
                'Số Tiền': tx.amount,
                'Hình Thức': tx.payment_method === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản',
                'Ghi Chú': tx.note,
                'Người Lập': tx.created_by
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử Thu Chi');
            XLSX.writeFile(wb, `SaoLuu_GD_KhachHang_${new Date().toISOString().split('T')[0]}.xlsx`);

            alert(`✅ Đã sao lưu thành công ${data.length} giao dịch.`);
            setShowMoreActions(false);
        } catch (error) {
            console.error('Error exporting transactions:', error);
            alert('❌ Lỗi khi sao lưu giao dịch: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCustomers = () => {
        if (filteredCustomers.length === 0) {
            alert('Không có khách hàng nào để xuất!');
            return;
        }
        exportCustomerList(filteredCustomers);
    };

    const downloadTemplate = () => {
        const headers = [
            'Mã khách hàng',
            'Tên khách hàng',
            'Loại khách hàng (BV/TM/PK/NG/GD/SP)',
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
            'Email hoá đơn',
            'Tên công ty hoá đơn',
            'Địa chỉ hoá đơn',
        ];

        const exampleData = [
            {
                'Mã khách hàng': 'KH00001',
                'Tên khách hàng': 'Bệnh viện Đa khoa Tỉnh',
                'Loại khách hàng (BV/TM/PK/NG/GD/SP)': 'BV',
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
                        category: row['Loại khách hàng (BV/TM/PK/NG/GD/SP)']?.toString() || 'BV',
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
                        invoice_email: row['Email hoá đơn']?.toString(),
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
        setSelectedStatuses([]);
        setLeadCreatedFrom('');
        setLeadCreatedTo('');
    };

    const leadSummarySlot =
        filterType === 'lead' ? (
            <div className="rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.12] to-primary/[0.04] px-4 py-3.5 shadow-sm">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Tổng đơn (theo bộ lọc)</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tight mt-0.5">
                    {isLoading ? '…' : formatNumber(totalRecords)}
                </p>
            </div>
        ) : null;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
                ]}
            />

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        summary={leadSummarySlot}
                        actions={
                            <>
                                <div className="relative">
                                    <button
                                        id="more-actions-btn"
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        className={clsx(
                                            "p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                            showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                        )}
                                    >
                                        <MoreVertical size={20} />
                                    </button>

                                    {showMoreActions && (
                                        <div id="more-actions-menu" className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                            <div
                                                role="button"
                                                onClick={() => { downloadTemplate(); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                                            >
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Download size={18} className="text-slate-400" />
                                                </div>
                                                Tải mẫu Excel
                                            </div>

                                            <label className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left">
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Upload size={18} className="text-slate-400" />
                                                </div>
                                                Import Excel
                                                <input
                                                    type="file"
                                                    accept=".xlsx, .xls"
                                                    onChange={(e) => { handleImportExcel(e); setShowMoreActions(false); }}
                                                    className="hidden"
                                                />
                                            </label>

                                            <div
                                                role="button"
                                                onClick={() => { handleExportTransactionsBulk(); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-slate-50 mt-1 pt-2 cursor-pointer"
                                            >
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Download size={18} className="text-emerald-500" />
                                                </div>
                                                Sao lưu Giao dịch
                                            </div>

                                            <div
                                                role="button"
                                                onClick={() => { handleExportCustomers(); setShowMoreActions(false); }}
                                                className="w-full flex items-center justify-start gap-4 px-4 py-2.5 text-[14px] font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-slate-50 mt-1 pt-2 cursor-pointer"
                                            >
                                                <div className="w-5 flex justify-center flex-shrink-0">
                                                    <Download size={18} className="text-emerald-500" />
                                                </div>
                                                Xuất Excel Khách
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedCustomer(null);
                                        setIsFormModalOpen(true);
                                    }}
                                    className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/25 active:scale-95 transition-all shrink-0"
                                    title="Thêm khách hàng"
                                >
                                    <Plus size={20} />
                                </button>
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-primary">{selectedIds.length}</span> khách hàng
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="text-[12px] font-bold text-primary hover:underline px-2 py-1"
                                        >
                                            Bỏ chọn
                                        </button>
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100"
                                        >
                                            <Trash2 size={14} /> Xóa tất cả
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />


                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {isLoading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            filteredCustomers.map((c) => {
                                const leadStt = filterType === 'lead' ? getLeadCreationStt(c.id) : null;
                                return (
                                <div key={c.id} className={clsx(
                                    "rounded-2xl border shadow-sm p-4 transition-all duration-200 relative overflow-hidden",
                                    selectedIds.includes(c.id)
                                        ? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
                                        : "border-primary/15 bg-white",
                                    filterType === 'lead' && c.status === 'Thành công' && "!bg-slate-50/80 !border-emerald-200 opacity-70"
                                )}>
                                    {filterType === 'lead' && c.status === 'Thành công' && (
                                        <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                                            <ClipboardCheck size={10} /> ĐÃ THÀNH CÔNG
                                        </div>
                                    )}
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
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider tabular-nums">
                                                    {filterType === 'lead'
                                                        ? (leadStt != null ? `#${leadStt}` : '—')
                                                        : c.code}
                                                </p>
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
                                        {c.invoice_email && (
                                            <div className="flex items-center gap-2 text-[12px] text-primary/80 font-medium">
                                                <Mail size={13} />
                                                <span className="truncate">{c.invoice_email}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <User size={12} />
                                            <span>{c.managed_by || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {c.status === 'Thành công' && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/de-nghi-xuat-may/tao?phone=${c.phone || ''}`)}
                                                    className="p-2 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg shrink-0"
                                                    title="Mẫu đề nghị máy"
                                                >
                                                    <FilePlus size={16} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(
                                                        c.id,
                                                        c.status === 'Thành công' ? 'Chưa thành công' : 'Thành công'
                                                    )
                                                }
                                                className={clsx(
                                                    'p-2 rounded-lg transition-all border',
                                                    c.status === 'Thành công'
                                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                        : 'bg-slate-50 border-slate-200 text-slate-400'
                                                )}
                                                title={
                                                    c.status === 'Thành công'
                                                        ? 'Đánh dấu là chưa thành công'
                                                        : 'Đánh dấu là thành công'
                                                }
                                            >
                                                {c.status === 'Thành công' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                            </button>
                                            {filterType === 'lead' && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleStatusChange(
                                                            c.id,
                                                            c.status === 'Thành công' ? 'Chưa thành công' : 'Thành công'
                                                        )
                                                    }
                                                    className={clsx(
                                                        'p-2 rounded-lg transition-all border',
                                                        c.status === 'Thành công'
                                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                                            : 'bg-teal-50 border-teal-100 text-teal-700'
                                                    )}
                                                    title="Check trạng thái — chuyển Thành công / Chưa thành công"
                                                >
                                                    <ClipboardCheck size={16} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleViewCustomer(c)}
                                                className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg shrink-0"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleEditCustomer(c)}
                                                className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg shrink-0"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCustomer(c.id, c.name)}
                                                className="p-2 text-red-700 bg-red-50 border border-red-100 rounded-lg shrink-0"
                                                title="Xóa"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>

                    {/* Sticky Mobile Pagination */}
                    {!isLoading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}

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

                                <div
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 px-4 py-2 h-10 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-all text-[13px] font-bold shadow-sm cursor-pointer select-none"
                                    title="Tải mẫu Excel"
                                >
                                    <Download size={16} className="shrink-0" />
                                    <span>Tải mẫu</span>
                                </div>

                                <label className="flex items-center gap-2 px-4 py-2 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all text-[13px] font-bold shadow-sm cursor-pointer select-none">
                                    <Upload size={16} className="shrink-0" />
                                    <span>Import Excel</span>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleImportExcel}
                                        className="hidden"
                                    />
                                </label>

                                <button
                                    onClick={handleExportCustomers}
                                    className="flex items-center gap-2 px-4 py-2 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all text-[13px] font-bold shadow-sm"
                                >
                                    <Download size={16} className="shrink-0" />
                                    <span>Xuất Excel</span>
                                </button>

                                <button
                                    onClick={handleExportTransactionsBulk}
                                    className="flex items-center gap-2 px-4 py-2 h-10 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all text-[13px] font-bold shadow-sm"
                                >
                                    <Download size={16} className="shrink-0" />
                                    <span>Sao lưu GD</span>
                                </button>

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

                        {filterType === 'lead' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                                <div className="lg:col-span-4 xl:col-span-3">
                                    <div className="rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.12] to-primary/[0.04] px-5 py-4 shadow-sm h-full flex flex-col justify-center min-h-[5.5rem]">
                                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Tổng đơn (theo bộ lọc)</p>
                                        <p className="text-4xl font-black text-foreground tabular-nums tracking-tight mt-1 leading-none">
                                            {isLoading ? '…' : formatNumber(totalRecords)}
                                        </p>
                                    </div>
                                </div>
                                <div className="lg:col-span-8 xl:col-span-9 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-muted/10 px-4 py-3">
                                    <Calendar size={18} className="text-primary shrink-0 mb-2 opacity-80" aria-hidden />
                                    <div className="flex flex-col gap-1 min-w-[155px] flex-1 sm:flex-none">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Ngày tạo — Từ ngày</span>
                                        <input
                                            type="date"
                                            value={leadCreatedFrom}
                                            onChange={(e) => setLeadCreatedFrom(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/15"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[155px] flex-1 sm:flex-none">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Đến ngày</span>
                                        <input
                                            type="date"
                                            value={leadCreatedTo}
                                            onChange={(e) => setLeadCreatedTo(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-border bg-white text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/15"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

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

                            {filterType === 'lead' && (
                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'careBy' ? null : 'careBy')}
                                        className={clsx(
                                            'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                            getFilterButtonClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)
                                        )}
                                    >
                                        <User size={14} className={getFilterIconClass('careBy', activeDropdown === 'careBy' || selectedCareBy.length > 0)} />
                                        NV kinh doanh
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
                            )}

                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className={clsx(
                                        'flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all',
                                        getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <List size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('status'))}>
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'status' && (
                                    <FilterDropdown
                                        options={statusOptions}
                                        selected={selectedStatuses}
                                        setSelected={setSelectedStatuses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                        showSearch={false}
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
                        <table className="customers-data-table w-full border-collapse">
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
                                                'px-4 py-3.5 text-[12px] font-bold text-muted-foreground uppercase tracking-wide',
                                                col.key === 'code' && filterType === 'lead'
                                                    ? 'text-center'
                                                    : 'text-left',
                                                col.key === 'code' && 'border-l border-r border-primary/30'
                                            )}
                                        >
                                            {col.key === 'code' && filterType === 'lead' ? 'STT' : col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide border-l border-r border-primary/30 min-w-[120px]">
                                        Thao tác
                                    </th>
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
                                                selectedIds.includes(c.id) && "bg-primary/[0.04] !hover:bg-primary/[0.08]",
                                                filterType === 'lead' && c.status === 'Thành công' && "!bg-slate-50/80 !border-l-[4px] !border-l-emerald-500 opacity-70 grayscale-[20%]"
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
                                            {visibleTableColumns.map((col) => renderCustomerTableCell(c, col.key))}
                                            <td className="px-4 py-4 text-center border-l border-r border-primary/20 relative z-10">
                                                <div className="flex items-center justify-center gap-3 flex-nowrap customer-row-actions">
                                                    {c.status === 'Thành công' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/de-nghi-xuat-may/tao?phone=${c.phone || ''}`)}
                                                            className="text-indigo-600/80 hover:text-indigo-700 transition-colors p-1 rounded hover:bg-indigo-50 shrink-0"
                                                            title="Mẫu đề nghị máy"
                                                        >
                                                            <FilePlus size={16} className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                   {filterType === 'lead' && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleStatusChange(
                                                                    c.id,
                                                                    c.status === 'Thành công' ? 'Chưa thành công' : 'Thành công'
                                                                )
                                                            }
                                                            className={clsx(
                                                                'transition-colors p-1 rounded shrink-0 min-w-9 min-h-9 inline-flex items-center justify-center',
                                                                c.status === 'Thành công'
                                                                    ? 'text-emerald-600/90 hover:text-emerald-700 hover:bg-emerald-50'
                                                                    : 'text-teal-600/90 hover:text-teal-700 hover:bg-teal-50'
                                                            )}
                                                            title="Check trạng thái — nhấn để chuyển Thành công / Chưa thành công"
                                                        >
                                                            <ClipboardCheck size={16} className="w-4 h-4 pointer-events-none" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewCustomer(c)}
                                                        className="text-blue-600/80 hover:text-blue-700 transition-colors p-1 rounded hover:bg-blue-50 shrink-0 min-w-9 min-h-9 inline-flex items-center justify-center"
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4 pointer-events-none" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditCustomer(c)}
                                                        className="text-amber-600/80 hover:text-amber-700 transition-colors p-1 rounded hover:bg-amber-50 shrink-0 min-w-9 min-h-9 inline-flex items-center justify-center"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit className="w-4 h-4 pointer-events-none" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCustomer(c.id, c.name)}
                                                        className="text-red-600/80 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50 shrink-0 min-w-9 min-h-9 inline-flex items-center justify-center"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4 pointer-events-none" />
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
                            <span>{totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'}/Tổng {totalRecords}</span>
                            {filterType !== 'lead' && (
                                <div className="flex items-center gap-1 ml-2">
                                    <span className="text-[11px] font-bold">│</span>
                                    <span className="text-primary font-bold">{formatNumber(totalCylinders)} vỏ</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-primary font-bold">{formatNumber(totalMachines)} máy</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                            >
                                <ChevronLeft size={16} />
                                <ChevronLeft size={16} className="-ml-2.5" />
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">{currentPage}</div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                                disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                            >
                                <ChevronRight size={16} />
                                <ChevronRight size={16} className="-ml-2.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full">
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

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            <div className={clsx('grid gap-3', filterType === 'lead' ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2 md:grid-cols-3')}>
                                <div
                                    className={clsx(
                                        'bg-blue-50/70 border border-blue-100 rounded-2xl p-4 md:p-5 shadow-sm',
                                        filterType !== 'lead' && 'col-span-2 md:col-span-1'
                                    )}
                                >
                                    <div className="flex flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng khách hàng</p>
                                            <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(filteredCustomersCount)}</p>
                                        </div>
                                    </div>
                                </div>

                                {filterType !== 'lead' && (
                                    <>
                                        <div className="bg-green-50/70 border border-green-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                            <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12  bg-green-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-green-200/70">
                                                    <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] md:text-[11px] font-semibold text-green-600 uppercase tracking-wider">Tổng vỏ bình</p>
                                                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(totalCylinders)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 md:p-5 shadow-sm">
                                            <div className="flex flex-col md:flex-row items-center md:items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12  bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                                                    <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] md:text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Tổng máy</p>
                                                    <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(totalMachines)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
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
                    hasActiveFilters={hasActiveFilters}
                    totalActiveFilters={totalActiveFilters}
                    sections={[
                        ...(filterType === 'lead'
                            ? [
                                  {
                                      id: 'leadDates',
                                      label: 'Ngày tạo',
                                      type: 'dateRange',
                                      icon: <Calendar size={16} className="text-primary" />,
                                      value: {
                                          start_date: pendingLeadCreatedFrom,
                                          end_date: pendingLeadCreatedTo,
                                      },
                                      onValueChange: (v) => {
                                          setPendingLeadCreatedFrom(v?.start_date || '');
                                          setPendingLeadCreatedTo(v?.end_date || '');
                                      },
                                      selectedValues: [],
                                      onSelectionChange: () => {},
                                  },
                              ]
                            : []),
                        {
                            id: 'categories',
                            label: 'Loại khách',
                            icon: <Users size={16} className="text-primary" />,
                            options: categoryOptions,
                            selectedValues: pendingCategories,
                            onSelectionChange: setPendingCategories,
                        },
                        {
                            id: 'managedBy',
                            label: 'Nhân viên phụ trách',
                            icon: <User size={16} className="text-primary" />,
                            options: managedByOptions,
                            selectedValues: pendingManagedBy,
                            onSelectionChange: setPendingManagedBy,
                        },
                        {
                            id: 'careBy',
                            label: filterType === 'lead' ? 'Nhân viên kinh doanh' : 'KD chăm sóc',
                            icon: <User size={16} className="text-primary" />,
                            options: careByOptions,
                            selectedValues: pendingCareBy,
                            onSelectionChange: setPendingCareBy,
                        },
                        {
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <List size={16} className="text-primary" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                            searchable: false,
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
                    hideCommerceTabs={location.pathname === '/khach-hang-lead'}
                />
            )}
        </div>
    );
};

export default Customers;
