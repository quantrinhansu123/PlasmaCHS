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
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Clock,
    List,
    LayoutGrid,
    BarChart2,
    Search,
    Plus,
    Filter,
    X,
    Edit,
    Edit3,
    SlidersHorizontal,
    Ticket,
    Wrench,
    Settings,
    User,
    MapPin,
    AlertCircle,
    Package,
    Trash2,
    Image as ImageIcon,
    Download,
    Upload,
    MoreVertical,
    MessageSquare,
    Camera,
    Save,
    Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RepairTicketForm from '../components/Repairs/RepairTicketForm';
import { toast } from 'react-toastify';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import { ERROR_LEVELS, getErrorLevelColor } from '../constants/repairConstants';
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

function getLoaiLoiBadgeClass(loai) {
    if (loai === 'Máy') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (loai === 'Nâng cấp') return 'bg-amber-50 text-amber-700 border-amber-100';
    if (loai === 'Bình') return 'bg-purple-50 text-purple-600 border-purple-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
}

const TICKET_COLUMNS = [
    { key: 'stt', label: 'STT' },
    { key: 'created_at', label: 'Ngày báo' },
    { key: 'created_by', label: 'Người báo lỗi' },
    { key: 'customer', label: 'Khách hàng' },
    { key: 'sales', label: 'Kinh doanh' },
    { key: 'machine_serial', label: 'Mã thiết bị' },
    { key: 'machine_name', label: 'Tên thiết bị' },
    { key: 'loai_loi', label: 'Tên lỗi' },
    { key: 'error_type', label: 'Loại lỗi' },
    { key: 'error_level', label: 'Cấp độ lỗi' },
    { key: 'error_details', label: 'Lỗi chi tiết' },
    { key: 'error_images', label: 'Hình ảnh chi tiết' },
    { key: 'technician', label: 'Kỹ thuật' },
    { key: 'cskh', label: 'CSKH' },
    { key: 'technical_feedback', label: 'Phản hồi kỹ thuật' },
    { key: 'technical_images', label: 'hình ảnh kỹ thuật' },
    { key: 'status', label: 'Trạng thái' }
];

const STATUSES = ['Mới', 'Đang xử lý', 'Chờ linh kiện', 'Hoàn thành', 'Đã hủy'];

function getRepairStatusKanbanColumnHeaderClass(status) {
    switch (status) {
        case 'Mới':
            return 'bg-blue-50 text-blue-900 border-blue-100';
        case 'Đang xử lý':
            return 'bg-amber-50 text-amber-900 border-amber-100';
        case 'Chờ linh kiện':
            return 'bg-orange-50 text-orange-900 border-orange-100';
        case 'Hoàn thành':
            return 'bg-emerald-50 text-emerald-900 border-emerald-100';
        case 'Đã hủy':
            return 'bg-slate-100 text-slate-800 border-slate-200';
        default:
            return 'bg-slate-50 text-slate-800 border-slate-200';
    }
}

function getRepairStatusKanbanCardBorder(status) {
    switch (status) {
        case 'Mới':
            return 'border-l-blue-400';
        case 'Đang xử lý':
            return 'border-l-amber-400';
        case 'Chờ linh kiện':
            return 'border-l-orange-400';
        case 'Hoàn thành':
            return 'border-l-emerald-400';
        case 'Đã hủy':
            return 'border-l-slate-400';
        default:
            return 'border-l-slate-400';
    }
}

export default function RepairTickets() {
    const { role } = usePermissions();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Core states
    const [tickets, setTickets] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [errorTypes, setErrorTypes] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // View states
    const [activeView, setActiveView] = useState('list'); // 'list' | 'kanban' | 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    
    // Filter states
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [selectedErrorTypes, setSelectedErrorTypes] = useState([]);
    const [selectedTechnicians, setSelectedTechnicians] = useState([]);
    const [selectedCskhStaff, setSelectedCskhStaff] = useState([]);
    const [selectedErrorLevels, setSelectedErrorLevels] = useState([]);

    const [selectedIds, setSelectedIds] = useState([]);

    // Dropdown / Modal targets
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [ticketToEdit, setTicketToEdit] = useState(null);
    const [technicalFeedbackTicket, setTechnicalFeedbackTicket] = useState(null);
    const [techFeedbackDraft, setTechFeedbackDraft] = useState(null);
    const [techModalNewFiles, setTechModalNewFiles] = useState([]);
    const [techModalSaving, setTechModalSaving] = useState(false);
    const [ticketDetailView, setTicketDetailView] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Mobile specific
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const mobileMenuRef = useRef(null);
    
    // Pending filters for MobileFilterSheet
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingCustomers, setPendingCustomers] = useState([]);
    const [pendingErrorTypes, setPendingErrorTypes] = useState([]);
    const [pendingTechnicians, setPendingTechnicians] = useState([]);
    const [pendingCskhStaff, setPendingCskhStaff] = useState([]);
    const [pendingErrorLevels, setPendingErrorLevels] = useState([]);

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedCustomers(pendingCustomers);
        setSelectedErrorTypes(pendingErrorTypes);
        setSelectedTechnicians(pendingTechnicians);
        setSelectedCskhStaff(pendingCskhStaff);
        setSelectedErrorLevels(pendingErrorLevels);
        closeMobileFilter();
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingCustomers(selectedCustomers);
        setPendingErrorTypes(selectedErrorTypes);
        setPendingTechnicians(selectedTechnicians);
        setPendingCskhStaff(selectedCskhStaff);
        setPendingErrorLevels(selectedErrorLevels);
        setShowMobileFilter(true);
    };
    
    // Columns config
    const defaultColOrder = TICKET_COLUMNS.map(c => c.key);
    const columnDefs = TICKET_COLUMNS.reduce((acc, col) => { acc[col.key] = { label: col.label }; return acc; }, {});
    
    const [columnOrder, setColumnOrder] = useState(() => {
        try { 
            const s = JSON.parse(localStorage.getItem('columns_repair_tickets_order')); 
            if (Array.isArray(s) && s.length) {
                const filtered = s.filter(k => defaultColOrder.includes(k));
                const missing = defaultColOrder.filter(k => !filtered.includes(k));
                
                let result = [...filtered];
                missing.forEach(m => {
                    const defaultIdx = defaultColOrder.indexOf(m);
                    // Find the best place to insert: after the nearest preceding column that's already in result
                    let insertIdx = 0;
                    for (let i = defaultIdx - 1; i >= 0; i--) {
                        const prevKey = defaultColOrder[i];
                        const idxInResult = result.indexOf(prevKey);
                        if (idxInResult !== -1) {
                            insertIdx = idxInResult + 1;
                            break;
                        }
                    }
                    result.splice(insertIdx, 0, m);
                });
                return result;
            }
            return defaultColOrder;
        } catch { return defaultColOrder; }
    });

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try { 
            const s = JSON.parse(localStorage.getItem('columns_repair_tickets')); 
            if (Array.isArray(s) && s.length) {
                const filtered = s.filter(k => defaultColOrder.includes(k));
                const missing = defaultColOrder.filter(k => !filtered.includes(k));
                return [...filtered, ...missing]; 
            }
            return defaultColOrder; 
        } catch { return defaultColOrder; }
    });
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const columnPickerRef = useRef(null);

    const isColumnVisible = (key) => visibleColumns.includes(key);

    useEffect(() => {
        // Force migration for error_level position if it's already in localStorage but misplaced
        const levelIdx = columnOrder.indexOf('error_level');
        const typeIdx = columnOrder.indexOf('error_type');
        if (levelIdx !== -1 && typeIdx !== -1 && levelIdx !== typeIdx + 1) {
            setColumnOrder(prev => {
                const filtered = prev.filter(k => k !== 'error_level');
                const newTypeIdx = filtered.indexOf('error_type');
                const result = [...filtered];
                result.splice(newTypeIdx + 1, 0, 'error_level');
                return result;
            });
            setVisibleColumns(prev => prev.includes('error_level') ? prev : [...prev, 'error_level']);
        }
    }, [columnOrder.length]); // Run when length changes or on mount

    useEffect(() => { localStorage.setItem('columns_repair_tickets', JSON.stringify(visibleColumns)); }, [visibleColumns]);
    useEffect(() => { localStorage.setItem('columns_repair_tickets_order', JSON.stringify(columnOrder)); }, [columnOrder]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) setActiveDropdown(null);
            if (showColumnPicker && columnPickerRef.current && !columnPickerRef.current.contains(event.target)) setShowColumnPicker(false);
            if (showMobileMenu && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) setShowMobileMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown, showColumnPicker, showMobileMenu]);

    useEffect(() => { fetchData(); }, []);

    // Setup Real-time subscription for repair_tickets
    useEffect(() => {
        const channel = supabase
            .channel('public:repair_tickets_changes')
            .on('postgres_changes', {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'repair_tickets'
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedStatuses, selectedCustomers, selectedErrorTypes, selectedTechnicians, selectedCskhStaff, selectedErrorLevels]);
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: ticketsData, error } = await supabase.from('repair_tickets').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setTickets(ticketsData || []);
            setSelectedIds([]);

            const [custRes, errRes, userRes] = await Promise.all([
                supabase.from('customers').select('id, name').order('name'),
                supabase.from('repair_error_types').select('id, name').order('name'),
                supabase.from('app_users').select('id, name, role').order('name')
            ]);
            if (custRes.data) setCustomers(custRes.data);
            if (errRes.data) setErrorTypes(errRes.data);
            if (userRes.data) setUsers(userRes.data);
        } catch (error) {
            console.error('Error fetching tickets:', error);
            alert('❌ Lỗi tải dữ liệu: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Derived unique filter lists
    const ticketCustomerIds = [...new Set(tickets.map(t => t.customer_id).filter(Boolean))];
    const ticketCustomerFilters = customers.filter(c => ticketCustomerIds.includes(c.id));
    const techUsers = users.filter(u => u.role === 'Nhân viên kỹ thuật' || u.role === 'admin');
    const cskhUsers = users.filter(u => u.role === 'Nhân viên CSKH');

    const techSelectOptionsForModal = useMemo(() => {
        const tid = techFeedbackDraft?.technician_id;
        if (!tid) return techUsers;
        if (techUsers.some((u) => u.id === tid)) return techUsers;
        const extra = users.find((u) => u.id === tid);
        return extra ? [...techUsers, extra] : techUsers;
    }, [techUsers, users, techFeedbackDraft?.technician_id]);

    const getCustomerName = (id) => customers.find(c => c.id === id)?.name || 'Chưa rõ';
    const getErrorTypeName = (id) => errorTypes.find(e => e.id === id)?.name || 'Chưa xác định';
    const getUserName = (id) => users.find(u => u.id === id)?.name || 'Chưa rõ';

    // Filtering logic
    const filteredTickets = tickets.filter(ticket => {
        const search = searchTerm.toLowerCase();
        const cName = getCustomerName(ticket.customer_id).toLowerCase();
        const mSerial = (ticket.machine_serial || '').toLowerCase();
        const mName = (ticket.machine_name || '').toLowerCase();
        const codeMatch = ticket.stt?.toString().includes(search);
        
        const matchesSearch = cName.includes(search) || mSerial.includes(search) || mName.includes(search) || codeMatch;
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(ticket.status);
        const matchesCustomer = selectedCustomers.length === 0 || selectedCustomers.includes(ticket.customer_id);
        const matchesErrorType = selectedErrorTypes.length === 0 || selectedErrorTypes.includes(ticket.error_type_id);
        const matchesTech = selectedTechnicians.length === 0 || selectedTechnicians.includes(ticket.technician_id);
        const matchesCskh = selectedCskhStaff.length === 0 || selectedCskhStaff.includes(ticket.cskh_id);
        const matchesErrorLevel = selectedErrorLevels.length === 0 || selectedErrorLevels.includes(ticket.error_level);

        return matchesSearch && matchesStatus && matchesCustomer && matchesErrorType && matchesTech && matchesCskh && matchesErrorLevel;
    });

    const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalRecords = filteredTickets.length;

    const getStatusBadge = (status) => {
        const classes = {
            'Mới': 'bg-blue-100 text-blue-700 border-blue-200',
            'Đang xử lý': 'bg-amber-100 text-amber-700 border-amber-200',
            'Chờ linh kiện': 'bg-orange-100 text-orange-700 border-orange-200',
            'Hoàn thành': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Đã hủy': 'bg-slate-100 text-slate-700 border-slate-200'
        }[status] || 'bg-slate-100 text-slate-700 border-slate-200';
        return <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-bold border", classes)}>{status}</span>;
    };

    const handleDropdownChange = (name) => {
        if (activeDropdown !== name) setFilterSearch('');
        setActiveDropdown(activeDropdown === name ? null : name);
    };

    const handleEdit = (ticket) => {
        setTicketToEdit(ticket);
        setIsFormModalOpen(true);
    };

    const openTicketErrorDetailView = (ticket) => {
        setTicketDetailView(ticket);
    };

    const closeTicketErrorDetailView = () => {
        setTicketDetailView(null);
    };

    const openTechnicalFeedback = (ticket) => {
        setTechnicalFeedbackTicket(ticket);
        setTechFeedbackDraft({
            technician_id: ticket.technician_id || '',
            technical_feedback: ticket.technical_feedback || '',
            technical_images: Array.isArray(ticket.technical_images) ? [...ticket.technical_images] : [],
            status: ticket.status && STATUSES.includes(ticket.status) ? ticket.status : 'Mới',
        });
        setTechModalNewFiles([]);
    };

    const closeTechnicalFeedbackModal = () => {
        setTechnicalFeedbackTicket(null);
        setTechFeedbackDraft(null);
        setTechModalNewFiles([]);
        setTechModalSaving(false);
    };

    const uploadTechFeedbackImages = async (files) => {
        const urls = [];
        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${Date.now()}_${fileName}`;
            const { error } = await supabase.storage.from('repair-tickets').upload(filePath, file);
            if (error) {
                console.error('Lỗi upload ảnh kỹ thuật:', error);
                continue;
            }
            const { data: publicUrlData } = supabase.storage.from('repair-tickets').getPublicUrl(filePath);
            urls.push(publicUrlData.publicUrl);
        }
        return urls;
    };

    const saveTechnicalFeedback = async () => {
        if (!technicalFeedbackTicket || !techFeedbackDraft) return;
        setTechModalSaving(true);
        try {
            let technical_images = [...techFeedbackDraft.technical_images];
            if (techModalNewFiles.length > 0) {
                const uploaded = await uploadTechFeedbackImages(techModalNewFiles);
                technical_images = [...technical_images, ...uploaded];
            }
            const { error } = await supabase
                .from('repair_tickets')
                .update({
                    technician_id: techFeedbackDraft.technician_id || null,
                    technical_feedback: techFeedbackDraft.technical_feedback,
                    technical_images,
                    status: techFeedbackDraft.status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', technicalFeedbackTicket.id);
            if (error) throw error;
            toast.success('Đã lưu phản hồi kỹ thuật');
            closeTechnicalFeedbackModal();
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error(err.message || 'Lỗi khi lưu');
        } finally {
            setTechModalSaving(false);
        }
    };

    const handleDeleteTicket = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu sửa chữa này không?')) return;
        
        try {
            const { error } = await supabase.from('repair_tickets').delete().eq('id', id);
            if (error) throw error;
            toast.success('Xóa phiếu thành công');
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchData();
        } catch (error) {
            console.error('Error deleting ticket:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phiếu sửa chữa đã chọn không?`)) return;

        try {
            const { error } = await supabase.from('repair_tickets').delete().in('id', selectedIds);
            if (error) throw error;
            
            toast.success(`Đã xóa ${selectedIds.length} phiếu thành công`);
            setSelectedIds([]);
            fetchData();
        } catch (error) {
            console.error('Error deleting tickets:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredTickets.length && filteredTickets.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTickets.map(t => t.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'Ngày (YYYY-MM-DD)',
            'Khách hàng',
            'Mã thiết bị / Serial',
            'Tên thiết bị',
            'Tên lỗi (Máy/Bình/Tình trạng chung)',
            'Loại lỗi chi tiết',
            'Chi tiết thêm',
            'Kinh doanh phụ trách',
            'Kỹ thuật phụ trách',
            'Cấp độ lỗi (Thấp/Trung bình/Cao/Nghiêm trọng)',
            'Trạng thái (Mới/Đang xử lý/Chờ linh kiện/Hoàn thành/Đã hủy)'
        ];

        const exampleData = [
            {
                'Ngày (YYYY-MM-DD)': '2023-11-20',
                'Khách hàng': 'Bệnh viện Đa khoa Tâm Anh',
                'Mã thiết bị / Serial': 'OXY-40L-001',
                'Tên thiết bị': 'Bình Oxy 40L',
                'Tên lỗi (Máy/Bình/Tình trạng chung)': 'Lỗi Bình',
                'Loại lỗi chi tiết': 'Van hỏng',
                'Chi tiết thêm': 'Xì khí',
                'Kinh doanh phụ trách': 'Nguyễn Văn Kinh Doanh',
                'Kỹ thuật phụ trách': 'Trần Văn Kỹ Thuật',
                'Cấp độ lỗi (Thấp/Trung bình/Cao/Nghiêm trọng)': 'Trung bình',
                'Trạng thái (Mới/Đang xử lý/Chờ linh kiện/Hoàn thành/Đã hủy)': 'Mới'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Sua Chua');
        XLSX.writeFile(wb, 'mau_import_phieu_sua_chua.xlsx');
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

                const customerMap = customers.reduce((acc, c) => {
                    acc[c.name.toLowerCase().trim()] = c.id;
                    return acc;
                }, {});

                const errorTypeMap = errorTypes.reduce((acc, err) => {
                    acc[err.name.toLowerCase().trim()] = err.id;
                    return acc;
                }, {});

                const userMap = users.reduce((acc, u) => {
                    acc[u.name.toLowerCase().trim()] = u.id;
                    return acc;
                }, {});

                const validStatuses = ['Mới', 'Đang xử lý', 'Chờ linh kiện', 'Hoàn thành', 'Đã hủy'];

                const mappedData = data.map((row) => {
                    const cName = row['Khách hàng']?.toString().toLowerCase().trim();
                    const eName = row['Loại lỗi chi tiết']?.toString().toLowerCase().trim();
                    const sName = row['Kinh doanh phụ trách']?.toString().toLowerCase().trim();
                    const tName = row['Kỹ thuật phụ trách']?.toString().toLowerCase().trim();
                    const statusVal = row['Trạng thái (Mới/Đang xử lý/Chờ linh kiện/Hoàn thành/Đã hủy)']?.toString().trim() || 'Mới';

                    return {
                        date: row['Ngày (YYYY-MM-DD)']?.toString() || new Date().toISOString().split('T')[0],
                        customer_id: cName ? customerMap[cName] || null : null,
                        machine_serial: row['Mã thiết bị / Serial']?.toString() || '',
                        machine_name: row['Tên thiết bị']?.toString() || '',
                        loai_loi: row['Tên lỗi (Máy/Bình/Tình trạng chung)']?.toString() || '',
                        error_type_id: eName ? errorTypeMap[eName] || null : null,
                        error_details: row['Chi tiết thêm']?.toString() || '',
                        sales_id: sName ? userMap[sName] || null : null,
                        technician_id: tName ? userMap[tName] || null : null,
                        error_level: row['Cấp độ lỗi (Thấp/Trung bình/Cao/Nghiêm trọng)']?.toString().trim() || 'Trung bình',
                        status: validStatuses.includes(statusVal) ? statusVal : 'Mới',
                        error_images: [],
                        technical_images: [],
                    };
                }).filter(i => i.machine_serial || i.machine_name);

                if (mappedData.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu Tên/Mã thiết bị)!');
                    setIsLoading(false);
                    return;
                }

                const { error: insertError } = await supabase
                    .from('repair_tickets')
                    .insert(mappedData);

                if (insertError) {
                    console.error('Error inserting tickets:', insertError);
                    alert('Lỗi khi import: ' + insertError.message);
                } else {
                    alert(`🎉 Đã import thành công ${mappedData.length} phiếu sửa chữa!`);
                    fetchData();
                }

            } catch (err) {
                console.error('Error importing excel:', err);
                alert('Có lỗi xảy ra khi xử lý file: ' + err.message);
            } finally {
                setIsLoading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    const formatNumber = (num) => new Intl.NumberFormat('vi-VN').format(num);

    const repairKanbanColumns = useMemo(() => {
        const from = (currentPage - 1) * pageSize;
        const pageTickets = filteredTickets.slice(from, from + pageSize);
        const normalizeStatus = (t) => {
            const s = t.status;
            return s && STATUSES.includes(s) ? s : 'Mới';
        };
        return STATUSES.map((label) => ({
            id: label,
            label,
            items: pageTickets.filter((t) => normalizeStatus(t) === label),
        }));
    }, [filteredTickets, currentPage, pageSize]);

    const getStatusStats = () => {
        const counts = {};
        filteredTickets.forEach(t => {
            const s = t.status || 'Khác';
            counts[s] = (counts[s] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    };

    const getErrorTypeStats = () => {
        const counts = {};
        filteredTickets.forEach(t => {
            const type = getErrorTypeName(t.error_type_id);
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
    };

    const getCustomerStats = () => {
        const counts = {};
        filteredTickets.forEach(t => {
            const cust = getCustomerName(t.customer_id);
            counts[cust] = (counts[cust] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
    };

    const getErrorLevelStats = () => {
        const counts = {};
        filteredTickets.forEach(t => {
            const level = t.error_level || 'Chưa rõ';
            counts[level] = (counts[level] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    };

    const chartColors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
        '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308',
        '#64748B', '#F97316'
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
                ]}
            />

            {activeView === 'list' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 w-full relative">
                
                {/* TOOLBAR */}
                <div className="flex flex-col gap-0 md:gap-2 p-0 md:p-2 border-b-0 md:border-b border-slate-100 bg-transparent md:bg-slate-50/50 rounded-t-2xl z-20">
                    <div className="hidden md:flex items-center gap-2">
                        <button onClick={() => navigate(-1)} className="p-2 sm:px-3 sm:py-2 rounded-xl text-[13px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0 h-[38px]">
                            <ChevronLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
                        </button>
                        
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text" placeholder="Tìm tên KH, mã máy, phiếu..."
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 h-[38px] bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all shadow-sm"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="relative" ref={columnPickerRef}>
                            <button
                                onClick={() => setShowColumnPicker(!showColumnPicker)}
                                className={clsx(
                                    'flex items-center gap-2 px-4 h-10 rounded-lg border text-[13px] font-bold transition-all bg-white shadow-sm shrink-0',
                                    showColumnPicker
                                        ? 'border-blue-500 bg-blue-50/50 text-blue-700'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                )}
                            >
                                <SlidersHorizontal size={16} className={showColumnPicker ? "text-blue-600" : "text-slate-500"} />
                                <span className="hidden sm:inline">
                                    Cột ({visibleColumns.length}/{defaultColOrder.length})
                                </span>
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

                        <button onClick={() => { setTicketToEdit(null); setIsFormModalOpen(true); }} className="hidden md:flex items-center gap-2 px-6 h-10 rounded-lg bg-blue-600 text-white text-[13px] font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-95 shrink-0">
                            <Plus size={18} />
                            Thêm
                        </button>

                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="hidden md:flex items-center gap-2 px-4 h-10 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all active:scale-95 animate-in slide-in-from-right-4 shrink-0"
                            >
                                <Trash2 size={16} />
                                Xóa ({selectedIds.length})
                            </button>
                        )}
                        <button
                            onClick={handleDownloadTemplate}
                            className="hidden md:flex items-center gap-2 px-4 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-bold hover:bg-indigo-100 shadow-sm transition-all active:scale-95 shrink-0"
                            title="Tải mẫu Excel"
                        >
                            <Download size={16} />
                            Tải mẫu
                        </button>
                        <div className="hidden md:block relative shrink-0">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportExcel}
                                className="hidden"
                                id="excel-import-desktop"
                            />
                            <label
                                htmlFor="excel-import-desktop"
                                className="flex items-center gap-2 px-4 h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 shadow-sm transition-all cursor-pointer active:scale-95 select-none"
                                title="Nhập Excel"
                            >
                                <Upload size={16} />
                                Import Excel
                            </label>
                        </div>
                    </div>

                    {/* DESKTOP FILTERS */}
                    <div className="hidden md:flex flex-wrap items-center gap-2 pb-1 z-[60]" ref={dropdownRef}>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('status')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedStatuses.length > 0 || activeDropdown === 'status' ? "border-blue-500 bg-blue-50/40 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <Filter size={14} className={selectedStatuses.length > 0 || activeDropdown === 'status' ? "text-blue-500" : "text-slate-500"} /> Trạng thái
                                {selectedStatuses.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">{selectedStatuses.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'status' && <FilterDropdown options={STATUSES.map(s => ({ id: s, label: s }))} selected={selectedStatuses} setSelected={setSelectedStatuses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('customers')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedCustomers.length > 0 || activeDropdown === 'customers' ? "border-cyan-500 bg-cyan-50/40 text-cyan-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <User size={14} className={selectedCustomers.length > 0 || activeDropdown === 'customers' ? "text-cyan-500" : "text-slate-500"} /> Khách hàng
                                {selectedCustomers.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-white">{selectedCustomers.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'customers' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'customers' && <FilterDropdown options={ticketCustomerFilters.map(c => ({id: c.id, label: c.name}))} selected={selectedCustomers} setSelected={setSelectedCustomers} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('errorTypes')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedErrorTypes.length > 0 || activeDropdown === 'errorTypes' ? "border-rose-500 bg-rose-50/40 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <AlertCircle size={14} className={selectedErrorTypes.length > 0 || activeDropdown === 'errorTypes' ? "text-rose-500" : "text-slate-500"} /> Loại lỗi
                                {selectedErrorTypes.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{selectedErrorTypes.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'errorTypes' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'errorTypes' && <FilterDropdown options={errorTypes.map(e => ({id: e.id, label: e.name}))} selected={selectedErrorTypes} setSelected={setSelectedErrorTypes} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('techs')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedTechnicians.length > 0 || activeDropdown === 'techs' ? "border-amber-500 bg-amber-50/40 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <Wrench size={14} className={selectedTechnicians.length > 0 || activeDropdown === 'techs' ? "text-amber-500" : "text-slate-500"} /> Kỹ thuật
                                {selectedTechnicians.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{selectedTechnicians.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'techs' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'techs' && <FilterDropdown options={techUsers.map(u => ({id: u.id, label: u.name}))} selected={selectedTechnicians} setSelected={setSelectedTechnicians} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('cskh')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedCskhStaff.length > 0 || activeDropdown === 'cskh' ? "border-indigo-500 bg-indigo-50/40 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <User size={14} className={selectedCskhStaff.length > 0 || activeDropdown === 'cskh' ? "text-indigo-500" : "text-slate-500"} /> CSKH
                                {selectedCskhStaff.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white">{selectedCskhStaff.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'cskh' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'cskh' && <FilterDropdown options={cskhUsers.map(u => ({id: u.id, label: u.name}))} selected={selectedCskhStaff} setSelected={setSelectedCskhStaff} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                        <div className="relative">
                            <button onClick={() => handleDropdownChange('errorLevel')} className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", selectedErrorLevels.length > 0 || activeDropdown === 'errorLevel' ? "border-rose-500 bg-rose-50/40 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                                <AlertCircle size={14} className={selectedErrorLevels.length > 0 || activeDropdown === 'errorLevel' ? "text-rose-500" : "text-slate-500"} /> Cấp độ lỗi
                                {selectedErrorLevels.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{selectedErrorLevels.length}</span>}
                                <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'errorLevel' ? "rotate-180" : "")} />
                            </button>
                            {activeDropdown === 'errorLevel' && <FilterDropdown options={ERROR_LEVELS.map(l => ({id: l.id, label: l.label}))} selected={selectedErrorLevels} setSelected={setSelectedErrorLevels} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                        </div>
                    </div>

                    {/* MOBILE FILTER TRIGGER & ACTIONS */}
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm..."
                        hasActiveFilters={(selectedStatuses.length + selectedCustomers.length + selectedErrorTypes.length + selectedTechnicians.length + selectedCskhStaff.length + selectedErrorLevels.length) > 0}
                        totalActiveFilters={selectedStatuses.length + selectedCustomers.length + selectedErrorTypes.length + selectedTechnicians.length + selectedCskhStaff.length + selectedErrorLevels.length}
                        onFilterClick={openMobileFilter}
                        actions={
                            <>
                                <div className="relative" ref={mobileMenuRef}>
                                    <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-xl bg-white text-slate-600 border border-slate-200 shadow-sm active:scale-95 transition-all">
                                        <MoreVertical size={20} />
                                    </button>
                                    {showMobileMenu && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                            <div
                                                role="button"
                                                onClick={() => { setShowMobileMenu(false); handleDownloadTemplate(); }}
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
                                                Nhập file Excel
                                                <input type="file" accept=".xlsx, .xls" onChange={(e) => { setShowMobileMenu(false); handleImportExcel(e); }} className="hidden" />
                                            </label>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { setTicketToEdit(null); setIsFormModalOpen(true); }} className="p-2 rounded-xl bg-blue-500 text-white shrink-0 shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                                    <Plus size={20} />
                                </button>
                            </>
                        }
                        selectionBar={
                            selectedIds.length > 0 ? (
                                <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                    <span className="text-[13px] font-bold text-slate-600">
                                        Đã chọn <span className="text-blue-500">{selectedIds.length}</span> phiếu
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={toggleSelectAll} className="text-[12px] font-bold text-blue-500 hover:underline px-2 py-1">Bỏ chọn</button>
                                        <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100">
                                            <Trash2 size={14} /> <span className="hidden sm:inline">Xóa tất cả</span><span className="sm:hidden">Xóa</span>
                                        </button>
                                    </div>
                                </div>
                            ) : null
                        }
                    />
                </div>

                {/* TABLE DATA */}
                <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-30">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="mt-3 text-sm font-semibold text-slate-600">Đang tải biểu mẫu...</span>
                            </div>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                         <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Package className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-[14px] text-slate-500 font-semibold mb-1">Không tìm thấy phiếu nào</p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto w-full">
                                <div className="min-w-fit">
                                    <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                                        <th className="py-3 px-4 font-bold text-slate-800 tracking-wide text-[12px] whitespace-nowrap bg-slate-50 w-12 text-center border-r border-slate-200">
                                            <input 
                                                type="checkbox" 
                                                className="rounded-md border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer" 
                                                checked={selectedIds.length === filteredTickets.length && filteredTickets.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        {columnOrder.filter(isColumnVisible).map((key) => {
                                            const col = columnDefs[key];
                                            return (
                                                <th key={key} className="py-3 px-4 font-bold text-slate-800 tracking-wide text-[12px] whitespace-nowrap bg-slate-50 border-l border-white">
                                                    {col.label}
                                                </th>
                                            );
                                        })}
                                        <th className="py-3 px-3 font-bold text-slate-800 tracking-wide text-[12px] whitespace-nowrap bg-slate-50 sticky right-0 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] border-l border-white text-center min-w-[10.5rem]">
                                            Thao tác
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {paginatedTickets.map((ticket, index) => (
                                        <tr key={ticket.id} className={clsx("border-b border-slate-100 hover:bg-amber-50/30 transition-colors group", selectedIds.includes(ticket.id) && "bg-blue-50/40")}>
                                            <td className="py-2.5 px-4 whitespace-nowrap text-center border-r border-slate-50">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded-md border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer" 
                                                    checked={selectedIds.includes(ticket.id)}
                                                    onChange={() => toggleSelect(ticket.id)}
                                                />
                                            </td>
                                            
                                            {columnOrder.filter(isColumnVisible).map((key) => {
                                                let content;
                                                let cellClasses = "py-2.5 px-4 text-[13px] border-r border-slate-50 font-medium ";
                                                
                                                switch(key) {
                                                    case 'stt':
                                                        content = <span className="font-bold text-slate-800">#{ticket.stt}</span>; break;
                                                    case 'created_at':
                                                        content = <div className="flex flex-col"><span className="text-slate-700 font-bold">{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</span><span className="text-slate-400 text-[11px]">{new Date(ticket.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span></div>; break;
                                                    case 'created_by':
                                                        content = <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100/50">{ticket.created_by ? getUserName(ticket.created_by) : 'Hệ thống'}</span>; break;
                                                    case 'customer':
                                                        content = <div className="font-bold text-slate-700 max-w-[200px] truncate" title={getCustomerName(ticket.customer_id)}>{getCustomerName(ticket.customer_id)}</div>; break;
                                                    case 'machine_serial':
                                                        content = <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">{ticket.machine_serial}</span>; break;
                                                    case 'machine_name':
                                                        content = <span className="text-slate-600 max-w-[200px] truncate block" title={ticket.machine_name}>{ticket.machine_name}</span>; break;
                                                    case 'loai_loi':
                                                        content = <span className={clsx(
                                                            "px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                                                            getLoaiLoiBadgeClass(ticket.loai_loi)
                                                        )}>{ticket.loai_loi || '---'}</span>; break;
                                                    case 'error_type':
                                                        content = <span className="font-bold text-rose-600">{getErrorTypeName(ticket.error_type_id)}</span>; break;
                                                    case 'error_level':
                                                        content = <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-bold border", getErrorLevelColor(ticket.error_level))}>{ticket.error_level || 'Trung bình'}</span>; break;
                                                    case 'error_details':
                                                        content = <div className="max-w-[250px] truncate text-slate-500 italic" title={ticket.error_details}>{ticket.error_details || '---'}</div>; break;
                                                    case 'error_images':
                                                        content = ticket.error_images?.length > 0 ? (
                                                            <div className="flex items-center gap-1 text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                                                <ImageIcon size={12} /> {ticket.error_images.length} ảnh
                                                            </div>
                                                        ) : <span className="text-slate-300">---</span>; break;
                                                    case 'sales':
                                                        content = <span className="text-primary font-black bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 shadow-sm">{getUserName(ticket.sales_id)}</span>; break;
                                                    case 'technician':
                                                        content = <span className="text-slate-600 font-semibold">{getUserName(ticket.technician_id)}</span>; break;
                                                    case 'cskh':
                                                        content = <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100/50">{getUserName(ticket.cskh_id)}</span>; break;
                                                    case 'technical_feedback':
                                                        content = <div className="max-w-[250px] truncate text-blue-500 italic" title={ticket.technical_feedback}>{ticket.technical_feedback || '---'}</div>; break;
                                                    case 'technical_images':
                                                        content = ticket.technical_images?.length > 0 ? (
                                                            <div className="flex items-center gap-1 text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                                                                <ImageIcon size={12} /> {ticket.technical_images.length} ảnh
                                                            </div>
                                                        ) : <span className="text-slate-300">---</span>; break;
                                                    case 'status':
                                                        content = (
                                                            <div className="flex flex-col items-center gap-1">
                                                                {getStatusBadge(ticket.status)}
                                                                {ticket.expected_completion_date && (
                                                                    <div className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 shadow-sm">
                                                                        <Clock size={10} />
                                                                        {new Date(ticket.expected_completion_date).toLocaleDateString('vi-VN')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ); break;
                                                    default: content = null;
                                                }
                                                return <td key={key} className={cellClasses}>{content}</td>;
                                            })}

                                            <td className="py-2 px-3 whitespace-nowrap sticky right-0 bg-white group-hover:bg-amber-50/50 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] border-l border-slate-50 flex items-center justify-center h-full min-w-[10.5rem]">
                                                <div className="flex items-center gap-1 justify-center h-full">
                                                    <button type="button" onClick={() => openTicketErrorDetailView(ticket)} className="w-8 h-8 flex items-center justify-center !p-0 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors" title="Xem thông tin thẻ lỗi">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => openTechnicalFeedback(ticket)} className="w-8 h-8 flex items-center justify-center !p-0 text-violet-600 hover:text-violet-800 hover:bg-violet-100 rounded-lg transition-colors" title="Phản hồi (kỹ thuật)">
                                                        <MessageSquare className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleEdit(ticket)} className="w-8 h-8 flex items-center justify-center !p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors" title="Chỉnh sửa">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteTicket(ticket.id)} className="w-8 h-8 flex items-center justify-center !p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors" title="Xóa">
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
                            
                            {/* Mobile Card List */}
                            <div className="md:hidden flex-1 overflow-y-auto p-2 flex flex-col gap-2.5 relative custom-scrollbar bg-slate-50/40">
                                {paginatedTickets.map((ticket, index) => (
                                    <div key={ticket.id} className={clsx(
                                        "rounded-2xl border shadow-sm p-3 transition-all duration-200",
                                        selectedIds.includes(ticket.id)
                                            ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-500/20"
                                            : "border-slate-200 bg-white"
                                    )}>
                                        {/* Header: checkbox + tên máy + serial + status */}
                                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(ticket.id)}
                                                    onChange={() => toggleSelect(ticket.id)}
                                                    className="w-3.5 h-3.5 shrink-0 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 transition-all cursor-pointer"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">#{ticket.stt}</p>
                                                        {ticket.machine_serial && (
                                                            <span className="px-1.5 py-0 bg-slate-100 text-slate-600 font-mono text-[9px] font-bold rounded">
                                                                {ticket.machine_serial}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-[12px] font-black text-slate-800 leading-tight truncate">
                                                        {ticket.machine_name || 'Thiết bị không tên'}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1">
                                                {getStatusBadge(ticket.status)}
                                                {ticket.expected_completion_date && (
                                                    <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 whitespace-nowrap">
                                                        <Clock size={9} />
                                                        {new Date(ticket.expected_completion_date).toLocaleDateString('vi-VN')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Info card: khách hàng + lỗi */}
                                        <div className="rounded-xl border border-slate-200 bg-white mb-1 overflow-hidden divide-y divide-slate-100">
                                            {/* Khách hàng */}
                                            <div className="flex items-center justify-between px-2 py-1 gap-2">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Khách hàng</span>
                                                <span className="text-[11px] font-bold text-slate-800 text-right truncate">{getCustomerName(ticket.customer_id)}</span>
                                            </div>
                                            {/* Tên lỗi */}
                                            <div className="flex items-center justify-between px-2 py-1 gap-2">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Tên lỗi</span>
                                                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                                    <span className={clsx(
                                                        "px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0",
                                                        getLoaiLoiBadgeClass(ticket.loai_loi)
                                                    )}>{ticket.loai_loi || '---'}</span>
                                                    <span className="text-[11px] font-bold text-rose-600 text-right">{getErrorTypeName(ticket.error_type_id)}</span>
                                                </div>
                                            </div>
                                            {/* Cấp độ lỗi */}
                                            <div className="flex items-center justify-between px-2 py-1 gap-2">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Cấp độ lỗi</span>
                                                <span className={clsx("px-1.5 py-0.5 rounded-full text-[9px] font-bold border", getErrorLevelColor(ticket.error_level))}>
                                                    {ticket.error_level || 'Trung bình'}
                                                </span>
                                            </div>
                                            {/* Mô tả (chỉ hiện nếu có) */}
                                            {ticket.error_details && (
                                                <div className="px-2 py-1.5 bg-slate-50/60">
                                                    <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-snug">{ticket.error_details}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Người báo + Phụ trách — KHÔNG CHỈNH */}
                                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50/50 border border-slate-100 px-2.5 py-2 mb-2">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Người báo</span>
                                                <span className="text-[12px] text-slate-800 font-semibold truncate">{ticket.created_by ? getUserName(ticket.created_by) : 'Hệ thống'}</span>
                                                <span className="text-[10px] text-slate-500 mt-0.5">{new Date(ticket.created_at).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="flex flex-col items-end text-right">
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Phụ trách</span>
                                                <span className="text-[12px] text-slate-800 font-semibold truncate">{getUserName(ticket.technician_id)} (KT)</span>
                                                <span className="text-[10px] text-slate-500 mt-0.5">{getUserName(ticket.sales_id)} (KD)</span>
                                            </div>
                                        </div>

                                        {/* Bottom row: badges + actions — ultra compact */}
                                        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-1.5">
                                            <div className="flex items-center gap-1">
                                                {ticket.error_images?.length > 0 && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                                        <ImageIcon size={9} /> {ticket.error_images.length}
                                                    </span>
                                                )}
                                                {ticket.technical_images?.length > 0 && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                        <ImageIcon size={9} /> {ticket.technical_images.length}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openTicketErrorDetailView(ticket)}
                                                    className="p-1.5 btn-compact text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg active:scale-90 transition-all"
                                                    title="Xem thông tin thẻ lỗi"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openTechnicalFeedback(ticket)}
                                                    className="p-1.5 btn-compact text-violet-700 bg-violet-50 border border-violet-100 rounded-lg active:scale-90 transition-all"
                                                    title="Phản hồi (kỹ thuật)"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(ticket)}
                                                    className="p-1.5 btn-compact text-blue-700 bg-blue-50 border border-blue-100 rounded-lg active:scale-90 transition-all"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTicket(ticket.id)}
                                                    className="p-1.5 btn-compact text-rose-700 bg-rose-50 border border-rose-100 rounded-lg active:scale-90 transition-all"
                                                    title="Xóa phiếu"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Sticky Mobile Pagination */}
                {!isLoading && filteredTickets.length > 0 && (
                    <div className="md:hidden">
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    </div>
                )}

                {/* Footer status / pagination info (Desktop) */}
                <div className="hidden md:flex px-4 py-3 border-t border-slate-200 items-center justify-between bg-slate-50 rounded-b-2xl shrink-0">
                    <span className="text-[12px] text-slate-500 font-semibold z-10">
                        Hiển thị <span className="font-bold text-slate-800">{totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'}</span> / Tổng <span className="font-bold text-slate-800">{totalRecords}</span> phiếu
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(1)} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage === 1} title="Trang đầu"><ChevronLeft size={16} /><ChevronLeft size={16} className="-ml-2.5" /></button>
                        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage === 1} title="Trang trước"><ChevronLeft size={16} /></button>
                        <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-blue-500/20">{currentPage}</div>
                        <button onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage >= Math.ceil(totalRecords / pageSize)} title="Trang sau"><ChevronRight size={16} /></button>
                        <button onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage >= Math.ceil(totalRecords / pageSize)} title="Trang cuối"><ChevronRight size={16} /><ChevronRight size={16} className="-ml-2.5" /></button>
                    </div>
                </div>
            </div>
            )}

            {activeView === 'kanban' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    <div className="md:hidden shrink-0 z-[40]">
                        <MobilePageHeader
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            searchPlaceholder="Tìm kiếm..."
                            hasActiveFilters={(selectedStatuses.length + selectedCustomers.length + selectedErrorTypes.length + selectedTechnicians.length + selectedCskhStaff.length + selectedErrorLevels.length) > 0}
                            totalActiveFilters={selectedStatuses.length + selectedCustomers.length + selectedErrorTypes.length + selectedTechnicians.length + selectedCskhStaff.length + selectedErrorLevels.length}
                            onFilterClick={openMobileFilter}
                            summary={<p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Kanban theo trạng thái</p>}
                            actions={
                                <>
                                    <div className="relative" ref={mobileMenuRef}>
                                        <button type="button" onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-xl bg-white text-slate-600 border border-slate-200 shadow-sm active:scale-95 transition-all">
                                            <MoreVertical size={20} />
                                        </button>
                                        {showMobileMenu && (
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                                <div
                                                    role="button"
                                                    onClick={() => { setShowMobileMenu(false); handleDownloadTemplate(); }}
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
                                                    Nhập file Excel
                                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => { setShowMobileMenu(false); handleImportExcel(e); }} className="hidden" />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => { setTicketToEdit(null); setIsFormModalOpen(true); }} className="p-2 rounded-xl bg-blue-500 text-white shrink-0 shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                                        <Plus size={20} />
                                    </button>
                                </>
                            }
                            selectionBar={
                                selectedIds.length > 0 ? (
                                    <div className="flex items-center justify-between px-1 mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                        <span className="text-[13px] font-bold text-slate-600">
                                            Đã chọn <span className="text-blue-500">{selectedIds.length}</span> phiếu
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={toggleSelectAll} className="text-[12px] font-bold text-blue-500 hover:underline px-2 py-1">Bỏ chọn</button>
                                            <button type="button" onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[12px] font-bold border border-rose-100">
                                                <Trash2 size={14} /> <span className="hidden sm:inline">Xóa tất cả</span><span className="sm:hidden">Xóa</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : null
                            }
                        />
                    </div>

                    <div className="hidden md:flex flex-col p-4 border-b border-border gap-3 shrink-0" ref={dropdownRef}>
                        <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => navigate(-1)} className="p-2 sm:px-3 sm:py-2 rounded-xl text-[13px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center gap-2 shrink-0 h-[38px]">
                                <ChevronLeft size={16} /> <span className="hidden sm:inline">Quay lại</span>
                            </button>
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Tìm tên KH, mã máy, phiếu..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-8 h-[38px] bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all shadow-sm"
                                />
                                {searchTerm && (
                                    <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button type="button" onClick={() => { setTicketToEdit(null); setIsFormModalOpen(true); }} className="flex items-center gap-2 px-6 h-10 rounded-lg bg-blue-600 text-white text-[13px] font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-95 shrink-0">
                                <Plus size={18} /> Thêm
                            </button>
                            {selectedIds.length > 0 && (
                                <button type="button" onClick={handleBulkDelete} className="flex items-center gap-2 px-4 h-10 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 text-[13px] font-bold hover:bg-rose-100 shadow-sm transition-all active:scale-95 shrink-0">
                                    <Trash2 size={16} /> Xóa ({selectedIds.length})
                                </button>
                            )}
                            <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 h-10 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-bold hover:bg-indigo-100 shadow-sm transition-all active:scale-95 shrink-0" title="Tải mẫu Excel">
                                <Download size={16} /> Tải mẫu
                            </button>
                            <div className="relative shrink-0">
                                <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" id="excel-import-kanban-desktop" />
                                <label htmlFor="excel-import-kanban-desktop" className="flex items-center gap-2 px-4 h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-100 shadow-sm transition-all cursor-pointer active:scale-95 select-none" title="Nhập Excel">
                                    <Upload size={16} /> Import Excel
                                </label>
                            </div>
                        </div>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kanban theo trạng thái (trang hiện tại)</p>
                        <div className="flex flex-wrap items-center gap-2 pb-1 z-[60]">
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('status')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedStatuses.length > 0 || activeDropdown === 'status' ? 'border-blue-500 bg-blue-50/40 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <Filter size={14} className={selectedStatuses.length > 0 || activeDropdown === 'status' ? 'text-blue-500' : 'text-slate-500'} /> Trạng thái
                                    {selectedStatuses.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">{selectedStatuses.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'status' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'status' && <FilterDropdown options={STATUSES.map(s => ({ id: s, label: s }))} selected={selectedStatuses} setSelected={setSelectedStatuses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('customers')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedCustomers.length > 0 || activeDropdown === 'customers' ? 'border-cyan-500 bg-cyan-50/40 text-cyan-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <User size={14} className={selectedCustomers.length > 0 || activeDropdown === 'customers' ? 'text-cyan-500' : 'text-slate-500'} /> Khách hàng
                                    {selectedCustomers.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-white">{selectedCustomers.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'customers' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'customers' && <FilterDropdown options={ticketCustomerFilters.map(c => ({ id: c.id, label: c.name }))} selected={selectedCustomers} setSelected={setSelectedCustomers} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('errorTypes')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedErrorTypes.length > 0 || activeDropdown === 'errorTypes' ? 'border-rose-500 bg-rose-50/40 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <AlertCircle size={14} className={selectedErrorTypes.length > 0 || activeDropdown === 'errorTypes' ? 'text-rose-500' : 'text-slate-500'} /> Loại lỗi
                                    {selectedErrorTypes.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{selectedErrorTypes.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'errorTypes' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'errorTypes' && <FilterDropdown options={errorTypes.map(e => ({ id: e.id, label: e.name }))} selected={selectedErrorTypes} setSelected={setSelectedErrorTypes} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('techs')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedTechnicians.length > 0 || activeDropdown === 'techs' ? 'border-amber-500 bg-amber-50/40 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <Wrench size={14} className={selectedTechnicians.length > 0 || activeDropdown === 'techs' ? 'text-amber-500' : 'text-slate-500'} /> Kỹ thuật
                                    {selectedTechnicians.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">{selectedTechnicians.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'techs' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'techs' && <FilterDropdown options={techUsers.map(u => ({ id: u.id, label: u.name }))} selected={selectedTechnicians} setSelected={setSelectedTechnicians} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('cskh')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedCskhStaff.length > 0 || activeDropdown === 'cskh' ? 'border-indigo-500 bg-indigo-50/40 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <User size={14} className={selectedCskhStaff.length > 0 || activeDropdown === 'cskh' ? 'text-indigo-500' : 'text-slate-500'} /> CSKH
                                    {selectedCskhStaff.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white">{selectedCskhStaff.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'cskh' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'cskh' && <FilterDropdown options={cskhUsers.map(u => ({ id: u.id, label: u.name }))} selected={selectedCskhStaff} setSelected={setSelectedCskhStaff} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                            <div className="relative">
                                <button type="button" onClick={() => handleDropdownChange('errorLevel')} className={clsx('flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all', selectedErrorLevels.length > 0 || activeDropdown === 'errorLevel' ? 'border-rose-500 bg-rose-50/40 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                    <AlertCircle size={14} className={selectedErrorLevels.length > 0 || activeDropdown === 'errorLevel' ? 'text-rose-500' : 'text-slate-500'} /> Cấp độ lỗi
                                    {selectedErrorLevels.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">{selectedErrorLevels.length}</span>}
                                    <ChevronDown size={14} className={clsx('transition-transform', activeDropdown === 'errorLevel' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'errorLevel' && <FilterDropdown options={ERROR_LEVELS.map(l => ({ id: l.id, label: l.label }))} selected={selectedErrorLevels} setSelected={setSelectedErrorLevels} filterSearch={filterSearch} setFilterSearch={setFilterSearch} />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[min(480px,calc(100vh-280px))] overflow-x-auto overflow-y-hidden p-2 md:p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3 h-full">
                                <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                <p className="text-[13px] font-medium text-slate-600">Đang tải phiếu sửa chữa…</p>
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-6 text-slate-500">
                                <Package size={48} className="opacity-35 mb-3 text-slate-400" />
                                <p className="text-[14px] font-bold">Không có phiếu phù hợp bộ lọc</p>
                                <p className="text-[12px] mt-1">Thử đổi tìm kiếm hoặc xóa bộ lọc.</p>
                            </div>
                        ) : (
                            <div className="flex gap-3 md:gap-4 h-full min-h-[min(440px,calc(100vh-300px))] pb-2">
                                {repairKanbanColumns.map((col) => (
                                    <div key={col.id} className="flex flex-col w-[min(88vw,260px)] sm:w-[min(240px,calc((100vw-3rem)/5))] shrink-0 rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden">
                                        <div className={clsx('px-3 py-2.5 border-b font-black text-[11px] uppercase tracking-wide flex items-start justify-between gap-2', getRepairStatusKanbanColumnHeaderClass(col.id))}>
                                            <span className="break-words leading-snug" title={col.label}>{col.label}</span>
                                            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-white/70 text-[11px] font-black tabular-nums border border-black/5">{col.items.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2.5 min-h-0 custom-scrollbar bg-white/70">
                                            {col.items.length === 0 ? (
                                                <p className="text-[11px] font-semibold text-slate-500 text-center py-8 px-2">Trống</p>
                                            ) : (
                                                col.items.map((ticket) => (
                                                    <div key={ticket.id} className={clsx('rounded-xl border border-slate-200 bg-white p-3 shadow-sm border-l-4 space-y-2', getRepairStatusKanbanCardBorder(col.id))}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">#{ticket.stt}</p>
                                                                <p className="text-[13px] font-black font-mono text-slate-800 truncate">{ticket.machine_serial || '—'}</p>
                                                                <p className="text-[11px] font-bold text-slate-600 truncate" title={getCustomerName(ticket.customer_id)}>{getCustomerName(ticket.customer_id)}</p>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                className="rounded-md border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer shrink-0 mt-0.5"
                                                                checked={selectedIds.includes(ticket.id)}
                                                                onChange={() => toggleSelect(ticket.id)}
                                                                title="Chọn phiếu"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {ticket.loai_loi && (
                                                                <span className={clsx('px-2 py-0.5 rounded-lg text-[10px] font-bold border', getLoaiLoiBadgeClass(ticket.loai_loi))}>{ticket.loai_loi}</span>
                                                            )}
                                                            <span className="text-[11px] font-bold text-rose-600 truncate" title={getErrorTypeName(ticket.error_type_id)}>{getErrorTypeName(ticket.error_type_id)}</span>
                                                        </div>
                                                        {ticket.expected_completion_date && (
                                                            <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1 w-fit">
                                                                <Clock size={10} />
                                                                {new Date(ticket.expected_completion_date).toLocaleDateString('vi-VN')}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-end gap-0.5 pt-1 border-t border-slate-100">
                                                            <button type="button" onClick={() => openTicketErrorDetailView(ticket)} className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all" title="Xem thông tin thẻ lỗi">
                                                                <Eye size={15} />
                                                            </button>
                                                            <button type="button" onClick={() => openTechnicalFeedback(ticket)} className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-all" title="Phản hồi (kỹ thuật)">
                                                                <MessageSquare size={15} />
                                                            </button>
                                                            <button type="button" onClick={() => handleEdit(ticket)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa">
                                                                <Edit size={15} />
                                                            </button>
                                                            <button type="button" onClick={() => handleDeleteTicket(ticket.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isLoading && filteredTickets.length > 0 && (
                        <div className="md:hidden border-t border-slate-200 shrink-0">
                            <MobilePagination currentPage={currentPage} setCurrentPage={setCurrentPage} pageSize={pageSize} setPageSize={setPageSize} totalRecords={totalRecords} />
                        </div>
                    )}

                    <div className="hidden md:flex px-4 py-3 border-t border-slate-200 items-center justify-between bg-slate-50 rounded-b-2xl shrink-0 text-[12px] text-slate-500 font-semibold">
                        <span>
                            Kanban theo <span className="font-bold text-slate-800">trạng thái</span>
                            {' · '}
                            Hiển thị <span className="font-bold text-slate-800">{totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'}</span> / Tổng <span className="font-bold text-slate-800">{totalRecords}</span> phiếu
                        </span>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setCurrentPage(1)} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage === 1} title="Trang đầu"><ChevronLeft size={16} /><ChevronLeft size={16} className="-ml-2.5" /></button>
                            <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage === 1} title="Trang trước"><ChevronLeft size={16} /></button>
                            <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-blue-500/20">{currentPage}</div>
                            <button type="button" onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalRecords / pageSize) || 1, p + 1))} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage >= Math.ceil(totalRecords / pageSize)} title="Trang sau"><ChevronRight size={16} /></button>
                            <button type="button" onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize) || 1)} className="w-8 h-8 flex items-center justify-center !p-0 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors disabled:opacity-30" disabled={currentPage >= Math.ceil(totalRecords / pageSize)} title="Trang cuối"><ChevronRight size={16} /><ChevronRight size={16} className="-ml-2.5" /></button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <Ticket className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng phiếu</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">{formatNumber(filteredTickets.length)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-orange-200/70">
                                        <Clock className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-orange-600 uppercase tracking-wider">Chờ/Đang XL</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">
                                            {formatNumber(filteredTickets.filter(t => ['Mới', 'Đang xử lý', 'Chờ linh kiện'].includes(t.status)).length)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-emerald-200/70">
                                        <Package className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Hoàn thành</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">
                                            {formatNumber(filteredTickets.filter(t => t.status === 'Hoàn thành').length)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-3 md:gap-4">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-rose-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-rose-200/70">
                                        <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-rose-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] md:text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Nghiêm trọng</p>
                                        <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1 leading-none">
                                            {formatNumber(filteredTickets.filter(t => t.error_level === 'Nghiêm trọng').length)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Trạng thái phiếu</h3>
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
                                            plugins: { legend: { position: 'bottom' } }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Cấp độ lỗi</h3>
                                <div style={{ height: '300px' }}>
                                    <PieChartJS
                                        data={{
                                            labels: getErrorLevelStats().map(item => item.name),
                                            datasets: [{
                                                data: getErrorLevelStats().map(item => item.value),
                                                backgroundColor: ['#10B981', '#F59E0B', '#EF4444', '#7F1D1D'],
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
                                <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Loại lỗi</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getErrorTypeStats().map(item => item.name.length > 20 ? item.name.substring(0,20)+'...' : item.name),
                                            datasets: [{
                                                label: 'Số phiếu',
                                                data: getErrorTypeStats().map(item => item.value),
                                                backgroundColor: chartColors[3],
                                                borderColor: chartColors[3],
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
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Khách hàng</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getCustomerStats().map(item => item.name.length > 20 ? item.name.substring(0,20)+'...' : item.name),
                                            datasets: [{
                                                label: 'Số phiếu',
                                                data: getCustomerStats().map(item => item.value),
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
            )}

            {/* Modals & Overlays */}
            {isFormModalOpen && (
                <RepairTicketForm 
                    ticket={ticketToEdit}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={() => { setIsFormModalOpen(false); fetchData(); }}
                />
            )}

            {ticketDetailView && (
                <div className="fixed inset-0 z-[100009] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        aria-label="Đóng"
                        onClick={closeTicketErrorDetailView}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ticket-error-detail-title"
                        className="relative w-full sm:max-w-lg max-h-[90vh] sm:max-h-[88vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-emerald-50/60 shrink-0">
                            <div className="min-w-0">
                                <h2 id="ticket-error-detail-title" className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-emerald-700 shrink-0" />
                                    Thông tin thẻ lỗi
                                </h2>
                                <p className="text-[12px] font-semibold text-slate-600 mt-0.5 truncate">
                                    Phiếu #{ticketDetailView.stt}
                                    {ticketDetailView.machine_serial ? ` · ${ticketDetailView.machine_serial}` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeTicketErrorDetailView}
                                className="p-2 rounded-xl text-slate-500 hover:bg-white/80 transition-colors shrink-0"
                                title="Đóng"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 space-y-0 divide-y divide-slate-100">
                                <div className="flex flex-col gap-0.5 pb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái</span>
                                    <div>{getStatusBadge(ticketDetailView.status)}</div>
                                </div>
                                <div className="flex flex-col gap-0.5 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách hàng</span>
                                    <span className="text-[14px] font-bold text-slate-800">{getCustomerName(ticketDetailView.customer_id)}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ngày báo</span>
                                    <span className="text-[13px] font-semibold text-slate-800">
                                        {new Date(ticketDetailView.created_at).toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[12px] text-slate-500">Người báo: {ticketDetailView.created_by ? getUserName(ticketDetailView.created_by) : 'Hệ thống'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Thiết bị</span>
                                    <span className="text-[13px] font-mono font-bold text-blue-800">{ticketDetailView.machine_serial || '—'}</span>
                                    <span className="text-[13px] font-semibold text-slate-700">{ticketDetailView.machine_name || '—'}</span>
                                </div>
                                <div className="flex flex-col gap-1 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nội dung lỗi</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {ticketDetailView.loai_loi && (
                                            <span className={clsx('px-2 py-0.5 rounded-lg text-[11px] font-bold border', getLoaiLoiBadgeClass(ticketDetailView.loai_loi))}>
                                                {ticketDetailView.loai_loi}
                                            </span>
                                        )}
                                        <span className="text-[13px] font-bold text-rose-600">{getErrorTypeName(ticketDetailView.error_type_id)}</span>
                                        <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-bold border', getErrorLevelColor(ticketDetailView.error_level))}>
                                            {ticketDetailView.error_level || 'Trung bình'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 pt-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mô tả chi tiết</span>
                                    {ticketDetailView.error_details?.trim() ? (
                                        <p className="text-[13px] font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{ticketDetailView.error_details}</p>
                                    ) : (
                                        <p className="text-[13px] text-slate-400 italic">Chưa có mô tả</p>
                                    )}
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <ImageIcon size={12} className="text-rose-500" />
                                    Hình ảnh chi tiết lỗi
                                </span>
                                {Array.isArray(ticketDetailView.error_images) && ticketDetailView.error_images.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {ticketDetailView.error_images.map((url, idx) => (
                                            <a
                                                key={`err-img-${idx}`}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-emerald-300 transition-all"
                                            >
                                                <img src={url} alt={`Chi tiết ${idx + 1}`} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-slate-400 italic">Chưa có ảnh</p>
                                )}
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Kinh doanh</span>
                                    <span className="font-bold text-slate-800">{getUserName(ticketDetailView.sales_id)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">CSKH</span>
                                    <span className="font-bold text-indigo-800">{getUserName(ticketDetailView.cskh_id)}</span>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Kỹ thuật phụ trách</span>
                                    <span className="font-bold text-slate-800">{getUserName(ticketDetailView.technician_id)}</span>
                                </div>
                                {ticketDetailView.expected_completion_date && (
                                    <div className="sm:col-span-2 flex items-center gap-2 text-emerald-800 font-bold text-[12px]">
                                        <Clock size={14} />
                                        Dự kiến hoàn thành: {new Date(ticketDetailView.expected_completion_date).toLocaleDateString('vi-VN')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-wrap gap-2 justify-end">
                            <button
                                type="button"
                                onClick={closeTicketErrorDetailView}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-[13px] font-bold hover:bg-slate-900 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const t = ticketDetailView;
                                    closeTicketErrorDetailView();
                                    handleEdit(t);
                                }}
                                className="px-5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-[13px] font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
                            >
                                <Edit size={16} />
                                Chỉnh sửa phiếu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {technicalFeedbackTicket && techFeedbackDraft && (
                <div className="fixed inset-0 z-[100010] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        aria-label="Đóng"
                        onClick={() => !techModalSaving && closeTechnicalFeedbackModal()}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="technical-feedback-title"
                        className="relative w-full sm:max-w-lg max-h-[88vh] sm:max-h-[85vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0">
                            <div className="min-w-0">
                                <h2 id="technical-feedback-title" className="text-[15px] font-black text-slate-900 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-violet-600 shrink-0" />
                                    Phản hồi kỹ thuật
                                </h2>
                                <p className="text-[12px] font-semibold text-slate-500 mt-0.5 truncate">
                                    Phiếu #{technicalFeedbackTicket.stt}
                                    {technicalFeedbackTicket.machine_serial ? ` · ${technicalFeedbackTicket.machine_serial}` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={techModalSaving}
                                onClick={closeTechnicalFeedbackModal}
                                className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 transition-colors shrink-0 disabled:opacity-50"
                                title="Đóng"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Wrench size={12} className="text-amber-600" />
                                    Kỹ thuật phụ trách
                                </label>
                                <div className="relative">
                                    <select
                                        value={techFeedbackDraft.technician_id}
                                        onChange={(e) => setTechFeedbackDraft((d) => ({ ...d, technician_id: e.target.value }))}
                                        className="w-full h-11 pl-3 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                    >
                                        <option value="">— Chưa gán —</option>
                                        {techSelectOptionsForModal.map((u) => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Ticket size={12} className="text-blue-600" />
                                    Trạng thái phiếu
                                </label>
                                <div className="relative">
                                    <select
                                        value={techFeedbackDraft.status}
                                        onChange={(e) => setTechFeedbackDraft((d) => ({ ...d, status: e.target.value }))}
                                        className="w-full h-11 pl-3 pr-9 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                                    >
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="tech-feedback-text" className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <MessageSquare size={12} className="text-violet-600" />
                                    Phản hồi từ kỹ thuật
                                </label>
                                <textarea
                                    id="tech-feedback-text"
                                    rows={4}
                                    value={techFeedbackDraft.technical_feedback}
                                    onChange={(e) => setTechFeedbackDraft((d) => ({ ...d, technical_feedback: e.target.value }))}
                                    placeholder="Ghi chú kiểm tra, phương án xử lý, linh kiện…"
                                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-y min-h-[96px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <ImageIcon size={12} className="text-blue-600" />
                                    Hình ảnh xử lý kỹ thuật
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {techFeedbackDraft.technical_images.map((url, idx) => (
                                        <div key={`${url}-${idx}`} className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            </a>
                                            <button
                                                type="button"
                                                disabled={techModalSaving}
                                                onClick={() =>
                                                    setTechFeedbackDraft((d) => ({
                                                        ...d,
                                                        technical_images: d.technical_images.filter((_, i) => i !== idx),
                                                    }))
                                                }
                                                className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow hover:bg-rose-700 disabled:opacity-50"
                                                title="Xóa ảnh"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {techModalNewFiles.map((file, idx) => (
                                        <div key={`new-${idx}`} className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-violet-200 bg-slate-50 shrink-0">
                                            <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                disabled={techModalSaving}
                                                onClick={() => setTechModalNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow hover:bg-rose-700 disabled:opacity-50"
                                                title="Bỏ ảnh chưa lưu"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <label className="w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center border-2 border-dashed border-violet-200 rounded-xl bg-violet-50/50 text-violet-600 hover:border-violet-400 cursor-pointer shrink-0 transition-colors">
                                        <Camera size={20} />
                                        <span className="text-[9px] font-black mt-1 uppercase">Thêm</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            disabled={techModalSaving}
                                            onChange={(e) => {
                                                if (e.target.files?.length) {
                                                    setTechModalNewFiles((prev) => [...prev, ...Array.from(e.target.files)]);
                                                }
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                                {techFeedbackDraft.technical_images.length === 0 && techModalNewFiles.length === 0 && (
                                    <p className="text-[12px] text-slate-400 italic">Chưa có ảnh — chọn &quot;Thêm&quot; để tải lên</p>
                                )}
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                disabled={techModalSaving}
                                onClick={closeTechnicalFeedbackModal}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-600 text-[13px] font-bold hover:bg-slate-50 disabled:opacity-50"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                disabled={techModalSaving}
                                onClick={saveTechnicalFeedback}
                                className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-[13px] font-bold hover:bg-violet-700 shadow-md shadow-violet-500/25 disabled:opacity-50 flex items-center gap-2"
                            >
                                {techModalSaving ? (
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                                ) : (
                                    <Save size={16} />
                                )}
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    isClosing={mobileFilterClosing}
                    title="Bộ lọc Phiếu sửa chữa"
                    sections={[
                        {
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Filter size={16} />,
                            options: STATUSES.map(s => ({ id: s, label: s, count: tickets.filter(t => t.status === s).length })),
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses,
                        },
                        {
                            id: 'customers',
                            label: 'Khách hàng',
                            icon: <User size={16} />,
                            options: ticketCustomerFilters.map(c => ({ id: c.id, label: c.name, count: tickets.filter(t => t.customer_id === c.id).length })),
                            selectedValues: pendingCustomers,
                            onSelectionChange: setPendingCustomers,
                        },
                        {
                            id: 'errorTypes',
                            label: 'Loại lỗi',
                            icon: <AlertCircle size={16} />,
                            options: errorTypes.map(e => ({ id: e.id, label: e.name, count: tickets.filter(t => t.error_type_id === e.id).length })),
                            selectedValues: pendingErrorTypes,
                            onSelectionChange: setPendingErrorTypes,
                        },
                        {
                            id: 'techs',
                            label: 'Kỹ thuật',
                            icon: <Wrench size={16} />,
                            options: techUsers.map(u => ({ id: u.id, label: u.name, count: tickets.filter(t => t.technician_id === u.id).length })),
                            selectedValues: pendingTechnicians,
                            onSelectionChange: setPendingTechnicians,
                        },
                        {
                            id: 'cskh',
                            label: 'CSKH',
                            icon: <User size={16} />,
                            options: cskhUsers.map(u => ({ id: u.id, label: u.name, count: tickets.filter(t => t.cskh_id === u.id).length })),
                            selectedValues: pendingCskhStaff,
                            onSelectionChange: setPendingCskhStaff,
                        },
                        {
                            id: 'errorLevel',
                            label: 'Cấp độ lỗi',
                            icon: <AlertCircle size={16} />,
                            options: ERROR_LEVELS.map(l => ({ id: l.id, label: l.label, count: tickets.filter(t => t.error_level === l.id).length })),
                            selectedValues: pendingErrorLevels,
                            onSelectionChange: setPendingErrorLevels,
                        }
                    ]}
                />
            )}
        </div>
    );
}
