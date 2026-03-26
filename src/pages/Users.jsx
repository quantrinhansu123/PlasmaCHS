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
    Briefcase,
    Edit,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    Users as UsersIcon,
    ChevronLeft,
    X,
    Phone,
    List,
    BarChart2,
    Filter,
    ChevronDown,
    SlidersHorizontal,
    CheckCircle,
    Package
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import UserFormModal from '../components/Users/UserFormModal';
import { USER_ROLES, USER_STATUSES, TABLE_COLUMNS } from '../constants/userConstants';
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

const Users = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    
    // Multi-select state
    const [selectedIds, setSelectedIds] = useState([]);

    // Column picker state
    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_users_order') || 'null');
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
            const saved = JSON.parse(localStorage.getItem('columns_users') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });

    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);

    const isColumnVisible = (key) => visibleColumns.includes(key);
    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    // Filter states
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    
    // Mobile filter sheet state
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingRoles, setPendingRoles] = useState([]);
    const [pendingStatuses, setPendingStatuses] = useState([]);

    // Dropdown state
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const listDropdownRef = useRef(null);
    const statsDropdownRef = useRef(null);

    useEffect(() => {
        if (location.state?.openCreateModal) {
            handleCreateNew();
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    useEffect(() => {
        localStorage.setItem('columns_users', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_users_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
            setSelectedIds([]);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Chart colors
    const chartColors = [
        '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];

    // Handlers
    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingRoles(selectedRoles);
        setPendingStatuses(selectedStatuses);
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedRoles(pendingRoles);
        setSelectedStatuses(pendingStatuses);
        closeMobileFilter();
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
            
            const isClickInsideList = listDropdownRef.current && listDropdownRef.current.contains(event.target);
            const isClickInsideStats = statsDropdownRef.current && statsDropdownRef.current.contains(event.target);
            
            if (activeDropdown && !isClickInsideList && !isClickInsideStats) {
                setActiveDropdown(null);
                setFilterSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, showColumnPicker]);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredUsers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredUsers.map(u => u.id));
        }
    };

    const renderCell = (key, user) => {
        const statusConfig = getStatusConfig(user.status);
        switch (key) {
            case 'info':
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-[11px] border border-primary/10 group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                            {getInitials(user.name)}
                        </div>
                        <div>
                            <div className="font-bold text-foreground text-[13px] tracking-tight">{user.name}</div>
                            <div className="text-[10px] font-medium text-muted-foreground mt-0.5">@{user.username}</div>
                        </div>
                    </div>
                );
            case 'contact':
                return (
                    <div className="flex items-center gap-2 text-[13px] text-foreground font-medium">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        {user.phone}
                    </div>
                );
            case 'department':
                return <div className="text-[13px] font-medium text-foreground tracking-tight">{user.department || '-'}</div>;
            case 'sales_group':
                return <div className="text-[13px] font-medium text-foreground tracking-tight">{user.sales_group || '-'}</div>;
            case 'role':
                return (
                    <div className="flex items-center gap-2">
                        {user.role === 'Admin' ? <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> : <Briefcase className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="text-[13px] font-medium text-foreground">{user.role}</span>
                    </div>
                );
            case 'approval_level':
                return (
                    <span className="px-2.5 py-1 rounded-lg bg-primary/5 text-primary text-[11px] font-black border border-primary/10 uppercase tracking-tight">
                        {user.approval_level || 'Staff'}
                    </span>
                );
            case 'status':
                return (
                    <span className={getStatusBadgeClass(statusConfig.color)}>
                        <div className={clsx(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            statusConfig.color === 'green' ? "bg-emerald-500" : "bg-rose-500"
                        )} />
                        {user.status}
                    </span>
                );
            default:
                return user[key] || '-';
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân sự "${name}" không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('app_users')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('❌ Có lỗi xảy ra khi xóa nhân sự: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} nhân sự đã chọn không? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('app_users')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchUsers();
            alert(`✅ Đã xóa ${selectedIds.length} nhân sự thành công!`);
        } catch (error) {
            console.error('Error deleting users:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };



    const handleEditUser = (user) => {
        setSelectedUser(user);
        setIsFormModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedUser(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchUsers();
        setIsFormModalOpen(false);
    };

    const getStatusConfig = (statusId) => {
        return USER_STATUSES.find(s => s.id === statusId || s.label === statusId) || USER_STATUSES[0];
    };

    const getStatusBadgeClass = (statusColor) => clsx(
        'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all gap-1.5',
        statusColor === 'green' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        statusColor === 'red' && 'bg-rose-50 text-rose-700 border-rose-200',
        !statusColor && 'bg-muted text-muted-foreground border-border'
    );

    const getFilterButtonClass = (isActive) => {
        return isActive 
            ? "border-primary bg-primary/5 text-primary" 
            : "border-border bg-white text-muted-foreground hover:text-foreground";
    };

    const getFilterIconClass = (isActive, activeColor = "text-primary") => {
        // Return active color if active, else return a subtle version of the same color
        const baseColor = activeColor.includes('/') ? activeColor : `${activeColor}/60`;
        return isActive ? activeColor : baseColor;
    };

    const hasActiveFilters = selectedRoles.length > 0 || selectedStatuses.length > 0;
    const totalActiveFilters = selectedRoles.length + selectedStatuses.length;

    // Filter options
    const roleOptions = USER_ROLES.map(r => ({
        id: r.id,
        label: r.label,
        count: users.filter(u => u.role === r.id).length
    }));

    const statusOptions = USER_STATUSES.map(s => ({
        id: s.id,
        label: s.label,
        count: users.filter(u => u.status === s.id).length
    }));

    const filteredUsers = users.filter(user => {
        const matchesSearch = !searchTerm || (
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone?.includes(searchTerm) ||
            user.role?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(user.role);
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(user.status);

        return matchesSearch && matchesRole && matchesStatus;
    });

    const getRowStyle = (status, isSelected) => {
        let baseStyle = "group border-l-4 ";
        if (isSelected) baseStyle += "bg-blue-50/40 border-l-primary ";
        else {
            if (status === 'Hoạt động') baseStyle += "border-l-emerald-400 hover:bg-blue-50/40 ";
            else if (status === 'Dừng hoạt động') baseStyle += "border-l-rose-400 hover:bg-blue-50/40 ";
            else baseStyle += "border-l-transparent hover:bg-blue-50/40 ";
        }
        return baseStyle;
    };

    // Statistics Calculation
    const getRoleStats = () => {
        const stats = {};
        filteredUsers.forEach(user => {
            const label = user.role || 'Chưa phân loại';
            stats[label] = (stats[label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getStatusStats = () => {
        const stats = {};
        filteredUsers.forEach(user => {
            const label = user.status || 'Chưa xác định';
            stats[label] = (stats[label] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5 font-sans">
            {/* Top Tabs */}
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'list'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <List size={14} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'stats'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <BarChart2 size={14} />
                    Thống kê
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                {activeView === 'list' ? (
                    <>
                        {/* ── DESKTOP TOOLBAR ── */}
                        <div className="hidden md:block p-3 space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 flex-1">
                                    <button
                                        onClick={() => navigate(-1)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                    >
                                        <ChevronLeft size={16} />
                                        Quay lại
                                    </button>
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm tên, username, SĐT..."
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
                                    {selectedIds.length > 0 && (
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 text-[12px] font-bold hover:bg-rose-100 transition-all shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                            Xóa ({selectedIds.length})
                                        </button>
                                    )}
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
                                        onClick={handleCreateNew}
                                        className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                                    >
                                        <Plus size={18} />
                                        Thêm nhân sự
                                    </button>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-2" ref={listDropdownRef}>
                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'role' ? null : 'role')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass(activeDropdown === 'role' || selectedRoles.length > 0)
                                        )}
                                    >
                                        <Briefcase size={14} className={getFilterIconClass(activeDropdown === 'role' || selectedRoles.length > 0, "text-blue-600")} />
                                        Vai trò
                                        {selectedRoles.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                                                {selectedRoles.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'role' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'role' && (
                                        <FilterDropdown
                                            options={roleOptions}
                                            selected={selectedRoles}
                                            setSelected={setSelectedRoles}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass(activeDropdown === 'status' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className={getFilterIconClass(activeDropdown === 'status' || selectedStatuses.length > 0, "text-amber-600")} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'status' && (
                                        <FilterDropdown
                                            options={statusOptions}
                                            selected={selectedStatuses}
                                            setSelected={setSelectedStatuses}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            setSelectedRoles([]);
                                            setSelectedStatuses([]);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── MOBILE TOOLBAR ── */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                            <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                />
                            </div>
                            <button
                                onClick={openMobileFilter}
                                className={clsx(
                                    'relative p-2 rounded-xl border shrink-0 transition-all',
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                                )}
                            >
                                <Filter size={18} className={hasActiveFilters ? "text-amber-600" : "text-amber-600/60"} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                            <button onClick={handleCreateNew} className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20"><Plus size={18} /></button>
                        </div>

                        {/* ── CONTENT ── */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col justify-center items-center py-20 space-y-4">
                                    <div className="w-10 h-10 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Đang tải danh sách...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                                        <UsersIcon className="w-10 h-10 text-slate-200" />
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 mb-1 uppercase tracking-tight">Không tìm thấy kết quả</h3>
                                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Hãy thử đổi từ khóa tìm kiếm</p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table */}
                                    <div className="hidden md:block w-full overflow-x-auto bg-white">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-[#F1F5FF]">
                                                <tr>
                                                    <th className="px-4 py-3.5 w-10">
                                                        <div className="flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                                checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                                                                onChange={toggleSelectAll}
                                                            />
                                                        </div>
                                                    </th>
                                                    {visibleTableColumns.map(col => (
                                                        <th key={col.key} className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide">
                                                            {col.label}
                                                        </th>
                                                    ))}
                                                    <th className="sticky right-0 z-30 bg-[#F1F5FF] px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-primary/10">
                                                {filteredUsers.map((user) => {
                                                    const statusConfig = getStatusConfig(user.status);
                                                    return (
                                                        <tr key={user.id} className={getRowStyle(user.status, selectedIds.includes(user.id))}>
                                                            <td className="px-4 py-4">
                                                                <div className="flex items-center justify-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                                        checked={selectedIds.includes(user.id)}
                                                                        onChange={() => toggleSelect(user.id)}
                                                                    />
                                                                </div>
                                                            </td>
                                                            
                                                            {visibleTableColumns.map(col => (
                                                                <td key={col.key} className="px-4 py-4">
                                                                    {renderCell(col.key, user)}
                                                                </td>
                                                            ))}
                                                            
                                                            <td className="sticky right-0 z-20 bg-white group-hover:bg-slate-50/80 px-4 py-4 shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)] before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-slate-300">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button 
                                                                        onClick={() => handleEditUser(user)} 
                                                                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                                        title="Chỉnh sửa"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteUser(user.id, user.name)} 
                                                                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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

                                    {/* Mobile Card List */}
                                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                                        {filteredUsers.map((user) => {
                                            const statusConfig = getStatusConfig(user.status);
                                            return (
                                                <div key={user.id} className="bg-white border border-primary/15 rounded-2xl p-4 shadow-sm">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                                                                {getInitials(user.name)}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-foreground text-[14px] leading-snug uppercase">{user.name}</div>
                                                                <div className="text-[11px] font-medium text-muted-foreground">@{user.username}</div>
                                                            </div>
                                                        </div>
                                                        <span className={getStatusBadgeClass(statusConfig.color)}>
                                                            <div className={clsx("w-1 h-1 rounded-full animate-pulse", statusConfig.color === 'green' ? "bg-emerald-500" : "bg-rose-500")} />
                                                            {user.status}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-3 mb-3 bg-muted/10 rounded-xl p-3 border border-border/60">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vai trò</p>
                                                            <div className="flex items-center gap-1.5 text-xs text-foreground font-bold uppercase tracking-tight">
                                                                {user.role === 'Admin' ? <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> : <Briefcase className="w-3.5 h-3.5 text-slate-400" />}
                                                                {user.role}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 pl-3 border-l border-border">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cấp duyệt</p>
                                                            <div className="text-xs text-primary font-black uppercase tracking-tight">
                                                                {user.approval_level || 'Staff'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 mb-4 bg-muted/5 rounded-xl p-3 border border-slate-100">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Phòng / Nhóm</p>
                                                            <div className="text-[11px] text-foreground font-semibold leading-tight capitalize">
                                                                {user.department || '-'} / {user.sales_group || '-'}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 pl-3 border-l border-border">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Liên hệ</p>
                                                            <div className="flex items-center gap-1.5 text-xs text-foreground font-bold">
                                                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                                {user.phone}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                                        <button onClick={() => handleEditUser(user)} className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wide border border-blue-100 transition-all hover:bg-blue-100">Sửa</button>
                                                        <button onClick={() => handleDeleteUser(user.id, user.name)} className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold uppercase tracking-wide border border-rose-100 transition-all hover:bg-rose-100">Xóa</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Bar */}
                        {!loading && filteredUsers.length > 0 && (
                            <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-muted/5">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Tổng số: <span className="text-primary text-sm font-black mx-1">{filteredUsers.length}</span> nhân sự
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col flex-1 overflow-auto custom-scrollbar">
                        {/* ── MOBILE HEADER (Stats) ── */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                            <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"><ChevronLeft size={18} /></button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê nhân sự</h2>
                            <button
                                onClick={openMobileFilter}
                                className={clsx(
                                    'relative p-2 rounded-xl border shrink-0 transition-all',
                                    hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                                )}
                            >
                                <Filter size={18} className={hasActiveFilters ? "text-amber-600" : "text-amber-600/60"} />
                                {hasActiveFilters && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                        {totalActiveFilters}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* ── DESKTOP HEADER (Stats) ── */}
                        <div className="hidden md:block p-4 border-b border-border" ref={statsDropdownRef}>
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
                                        onClick={() => setActiveDropdown(activeDropdown === 'role' ? null : 'role')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass(activeDropdown === 'role' || selectedRoles.length > 0)
                                        )}
                                    >
                                        <Briefcase size={14} className={getFilterIconClass(activeDropdown === 'role' || selectedRoles.length > 0, "text-blue-600")} />
                                        Vai trò
                                        {selectedRoles.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                                                {selectedRoles.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'role' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'role' && (
                                        <FilterDropdown
                                            options={roleOptions}
                                            selected={selectedRoles}
                                            setSelected={setSelectedRoles}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                <div className="relative">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className={clsx(
                                            "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                            getFilterButtonClass(activeDropdown === 'status' || selectedStatuses.length > 0)
                                        )}
                                    >
                                        <Filter size={14} className={getFilterIconClass(activeDropdown === 'status' || selectedStatuses.length > 0, "text-amber-600")} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                                                {selectedStatuses.length}
                                            </span>
                                        )}
                                        <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
                                    </button>
                                    {activeDropdown === 'status' && (
                                        <FilterDropdown
                                            options={statusOptions}
                                            selected={selectedStatuses}
                                            setSelected={setSelectedStatuses}
                                            filterSearch={filterSearch}
                                            setFilterSearch={setFilterSearch}
                                        />
                                    )}
                                </div>

                                {hasActiveFilters && (
                                    <button
                                        onClick={() => {
                                            setSelectedRoles([]);
                                            setSelectedStatuses([]);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                    >
                                        <X size={14} />
                                        Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-4">
                                        <div className="w-12 h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                            <UsersIcon className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng nhân sự</p>
                                            <p className="text-3xl font-bold text-foreground mt-1">{filteredUsers.length}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-4">
                                        <div className="w-12 h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Đang hoạt động</p>
                                            <p className="text-3xl font-bold text-foreground mt-1">{filteredUsers.filter(u => u.status === 'Hoạt động').length}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-start gap-4">
                                        <div className="w-12 h-12 bg-rose-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-rose-200/70">
                                            <X className="w-6 h-6 text-rose-600" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Dừng hoạt động</p>
                                            <p className="text-3xl font-bold text-foreground mt-1">{filteredUsers.filter(u => u.status === 'Dừng hoạt động').length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-[14px] font-bold text-foreground mb-6 uppercase tracking-tight flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-primary rounded-full" />
                                        Phân bổ theo Vai trò
                                    </h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getRoleStats().map(item => item.name),
                                                datasets: [{
                                                    data: getRoleStats().map(item => item.value),
                                                    backgroundColor: chartColors.slice(0, getRoleStats().length),
                                                    borderColor: '#fff',
                                                    borderWidth: 2
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' } } }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
                                    <h3 className="text-[14px] font-bold text-foreground mb-6 uppercase tracking-tight flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                        Trạng thái nhân sự
                                    </h3>
                                    <div style={{ height: '300px' }}>
                                        <PieChartJS
                                            data={{
                                                labels: getStatusStats().map(item => item.name),
                                                datasets: [{
                                                    data: getStatusStats().map(item => item.value),
                                                    backgroundColor: ['#10B981', '#EF4444'],
                                                    borderColor: '#fff',
                                                    borderWidth: 2
                                                }]
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' } } }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Filter Sheet */}
            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    isClosing={mobileFilterClosing}
                    title="Bộ lọc nhân sự"
                >
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h4 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Vai trò</h4>
                            <div className="flex flex-wrap gap-2">
                                {USER_ROLES.map(role => (
                                    <button
                                        key={role.id}
                                        onClick={() => setPendingRoles(prev => 
                                            prev.includes(role.id) ? prev.filter(i => i !== role.id) : [...prev, role.id]
                                        )}
                                        className={clsx(
                                            "px-3 py-2 rounded-xl text-[12px] font-bold transition-all border",
                                            pendingRoles.includes(role.id)
                                                ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                                : "bg-white text-muted-foreground border-border"
                                        )}
                                    >
                                        {role.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[13px] font-bold text-foreground uppercase tracking-wider">Trạng thái</h4>
                            <div className="flex flex-wrap gap-2">
                                {USER_STATUSES.map(status => (
                                    <button
                                        key={status.id}
                                        onClick={() => setPendingStatuses(prev => 
                                            prev.includes(status.id) ? prev.filter(i => i !== status.id) : [...prev, status.id]
                                        )}
                                        className={clsx(
                                            "px-3 py-2 rounded-xl text-[12px] font-bold transition-all border",
                                            pendingStatuses.includes(status.id)
                                                ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                                : "bg-white text-muted-foreground border-border"
                                        )}
                                    >
                                        {status.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </MobileFilterSheet>
            )}

            {/* Modal */}
            {isFormModalOpen && (
                <UserFormModal
                    user={selectedUser}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Users;
