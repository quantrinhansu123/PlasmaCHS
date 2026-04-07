import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import MobilePagination from '../components/layout/MobilePagination';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
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
import { Bar as BarChartJS } from 'react-chartjs-2';
import {
    ChevronLeft,
    ChevronRight,
    Edit,
    FileText,
    List,
    Monitor,
    Plus,
    Search,
    Trash2,
    X,
    BarChart2,
    Calendar,
    User,
    Eye,
    CheckCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, cloneElement } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import { ORDER_STATUSES } from '../constants/orderConstants';
import { notificationService } from '../utils/notificationService';

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

export default function MachineRequests() {
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('order_type', 'DNXM')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            toast.error('Lỗi tải dữ liệu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredRequests = requests.filter(r =>
        (r.order_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.ordered_by || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalRecords = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleDelete = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu đề nghị ${code}?`)) return;
        try {
            const { error } = await supabase.from('orders').delete().eq('id', id);
            if (error) throw error;
            toast.success(`Đã xóa phiếu ${code}`);
            fetchData();
        } catch (error) {
            toast.error('Lỗi xóa phiếu: ' + error.message);
        }
    };

    // Đã chuyển logic duyệt sang MachineIssueRequestForm.jsx

    const getChartData = () => {
        const customerData = {};
        requests.forEach(r => {
            const name = r.customer_name || 'Không rõ';
            customerData[name] = (customerData[name] || 0) + (r.quantity || 0);
        });

        const sortedCustomers = Object.entries(customerData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            labels: sortedCustomers.map(c => c[0].length > 15 ? c[0].substring(0, 15) + '...' : c[0]),
            datasets: [{
                label: 'Số lượng máy đề nghị',
                data: sortedCustomers.map(c => c[1]),
                backgroundColor: 'rgba(56, 189, 248, 0.8)',
                borderRadius: 6,
                barThickness: 24
            }]
        };
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'CHO_DUYET': return { label: 'Chờ duyệt', colorCls: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
            case 'CHO_CTY_DUYET': return { label: 'Chờ Công ty duyệt', colorCls: 'bg-orange-50 text-orange-700 border-orange-200' };
            case 'TRUONG_KD_XU_LY': return { label: 'Trưởng kinh doanh xử lý', colorCls: 'bg-blue-50 text-blue-700 border-blue-200' };
            case 'KD_XU_LY': return { label: 'Kinh doanh xử lý', colorCls: 'bg-purple-50 text-purple-700 border-purple-200' };
            case 'KHO_XU_LY': return { label: 'Kho xử lý', colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'TU_CHOI': return { label: 'Từ chối', colorCls: 'bg-rose-50 text-rose-700 border-rose-200' };
            case 'DA_DUYET': return { label: 'Đã duyệt', colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
            case 'CHO_GIAO_HANG': return { label: 'Chờ giao hàng', colorCls: 'bg-amber-50 text-amber-700 border-amber-200' };
            case 'DANG_GIAO_HANG': return { label: 'Đang giao hàng', colorCls: 'bg-sky-50 text-sky-700 border-sky-200' };
            case 'CHO_DOI_SOAT': return { label: 'Chờ đối soát', colorCls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
            case 'HOAN_THANH': return { label: 'Hoàn thành', colorCls: 'bg-green-50 text-green-700 border-green-200' };
            case 'HUY_DON': return { label: 'Hủy đơn', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'TRA_HANG': return { label: 'Đơn hàng trả về', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'DOI_SOAT_THAT_BAI': return { label: 'Đối soát thất bại', colorCls: 'bg-red-50 text-red-700 border-red-200' };
            case 'DIEU_CHINH': return { label: 'Điều chỉnh', colorCls: 'bg-orange-50 text-orange-700 border-orange-200' };
            default:
                return { label: status || 'Không rõ', colorCls: 'bg-slate-50 text-slate-700 border-slate-200' };
        }
    };

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
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-16 md:mb-0">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm đề nghị xuất máy..."
                        actions={
                            <button
                                onClick={() => navigate('/de-nghi-xuat-may/tao')}
                                className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
                            >
                                <Plus size={20} />
                            </button>
                        }
                    />

                    {/* Mobile View */}
                    <div className="md:hidden flex-1 overflow-y-auto p-3 pb-4 flex flex-col gap-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : paginatedRequests.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            paginatedRequests.map((r, index) => (
                                <div key={r.id} className="rounded-2xl border border-primary/15 bg-white shadow-sm p-4 transition-all duration-200">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{((currentPage - 1) * pageSize) + index + 1}</p>
                                                <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5 font-mono text-primary cursor-pointer" onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}>{r.order_code}</h3>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                        <div className="col-span-2">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Khách hàng</p>
                                            <p className="text-[12px] text-foreground font-bold truncate">
                                                {r.customer_name}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Người yêu cầu</p>
                                            <p className="text-[12px] text-foreground font-medium truncate">
                                                {r.ordered_by || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                            <p className="text-[12px] text-foreground text-emerald-600 font-bold">
                                                {r.quantity} máy
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Trạng thái</p>
                                            <div className="flex mt-0.5">
                                                {(() => {
                                                    const sInfo = getStatusInfo(r.status);
                                                    return (
                                                        <span className={clsx("px-2 py-0.5 rounded-full border text-[10px] font-bold", sInfo.colorCls)}>
                                                            {sInfo.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/70">
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                                            <Calendar size={12} />
                                            <span>{new Date(r.created_at).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)} className="p-2 text-slate-400 hover:text-primary bg-slate-50 hover:bg-primary/10 border border-slate-100 rounded-lg"><Eye size={16} /></button>
                                            <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)} className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(r.id, r.order_code)} className="p-2 text-rose-700 bg-rose-50 border border-rose-100 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:flex flex-col flex-1 min-h-0">
                        {/* Desktop Toolbar */}
                        <div className="p-4 border-b border-border/50 shrink-0">
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
                                            placeholder="Tìm kiếm đãi nghị xuất máy . . ."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                        />
                                        {searchTerm && (
                                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => navigate('/de-nghi-xuat-may/tao')} className="flex items-center gap-2 px-6 h-10 rounded-lg bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95">
                                        <Plus size={18} />
                                        Tạo đề nghị
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur shadow-sm">
                                    <tr>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mã phiếu</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Ngày tạo</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Khách hàng</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Người yêu cầu</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Số lượng</th>
                                        <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                                        <th className="px-5 py-3.5 text-center text-[12px] font-bold text-slate-500 uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 bg-white">
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold italic">Đang tải dữ liệu...</td></tr>
                                    ) : paginatedRequests.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold italic">Không tìm thấy phiếu nào</td></tr>
                                    ) : (
                                        paginatedRequests.map(r => (
                                            <tr key={r.id} className="group hover:bg-muted/30 transition-colors">
                                                <td className="px-5 py-3.5"><span className="text-[14px] font-bold text-primary hover:underline cursor-pointer" onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)}>{r.order_code}</span></td>
                                                <td className="px-5 py-3.5 text-[13px] font-semibold text-slate-600">{new Date(r.created_at).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-5 py-3.5"><div className="text-[14px] font-bold text-slate-900 line-clamp-1">{r.customer_name}</div></td>
                                                <td className="px-5 py-3.5 text-[13px] font-medium text-slate-500">{r.ordered_by || '—'}</td>
                                                <td className="px-5 py-3.5"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[12px]">{r.quantity} máy</span></td>
                                                <td className="px-5 py-3.5">
                                                    {(() => {
                                                        const sInfo = getStatusInfo(r.status);
                                                        return (
                                                            <span className={clsx("px-2.5 py-1 rounded-full border text-[11px] font-bold inline-flex items-center", sInfo.colorCls)}>
                                                                {sInfo.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}&viewOnly=true`)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Xem chi tiết"><Eye size={16} /></button>
                                                        <button onClick={() => navigate(`/de-nghi-xuat-may/tao?orderId=${r.id}`)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Chỉnh sửa"><Edit size={16} /></button>
                                                        <button onClick={() => handleDelete(r.id, r.order_code)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Desktop Pagination */}
                        <div className="hidden md:flex items-center justify-between p-3 border-t border-border bg-slate-50/50 mt-auto">
                            <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-medium">
                                <span>
                                    {totalRecords > 0 ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalRecords)}` : '0'} / Tổng {totalRecords}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang đầu"
                                >
                                    <ChevronLeft size={16} />
                                    <ChevronLeft size={16} className="-ml-2.5" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage === 1}
                                    title="Trang trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-[12px] font-bold shadow-md shadow-primary/25">
                                    {currentPage}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalRecords / pageSize), prev + 1))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                    title="Trang sau"
                                >
                                    <ChevronRight size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-20"
                                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                                    title="Trang cuối"
                                >
                                    <ChevronRight size={16} />
                                    <ChevronRight size={16} className="-ml-2.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {!loading && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={totalRecords}
                        />
                    )}
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-16 md:mb-0">
                    <div className="space-y-0">
                        {/* Mobile Header */}
                        <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê</h2>
                            <div className="w-9" />
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden md:block p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                            </div>
                        </div>

                        {/* Stats Content */}
                        <div className="w-full px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5 flex-1 overflow-y-auto bg-slate-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                                <StatCard icon={<FileText />} label="Tổng số phiếu" value={requests.length} color="blue" />
                                <StatCard icon={<Monitor />} label="Máy đề nghị" value={requests.reduce((acc, r) => acc + (r.quantity || 0), 0)} color="emerald" />
                            </div>

                            <div className="mt-6 bg-white border border-border rounded-2xl p-5 md:p-6 shadow-sm">
                                <h3 className="text-[14px] md:text-base font-black text-slate-800 uppercase tracking-tight mb-6">Top 10 Khách hàng <span className="text-muted-foreground text-[12px] font-medium normal-case">(Theo số lượng máy đề nghị)</span></h3>
                                <div style={{ height: '320px' }}>
                                    <BarChartJS 
                                        data={getChartData()}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: {
                                                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 5 } },
                                                x: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
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
    );
}

function StatCard({ icon, label, value, color }) {
    const colorStyles = {
        blue: { bg: 'bg-blue-50/70', border: 'border-blue-100', text: 'text-blue-600', iconBg: 'bg-blue-100/80', ring: 'ring-blue-200/70' },
        emerald: { bg: 'bg-emerald-50/70', border: 'border-emerald-100', text: 'text-emerald-600', iconBg: 'bg-emerald-100/80', ring: 'ring-emerald-200/70' },
        amber: { bg: 'bg-amber-50/70', border: 'border-amber-100', text: 'text-amber-600', iconBg: 'bg-amber-100/80', ring: 'ring-amber-200/70' },
        rose: { bg: 'bg-rose-50/70', border: 'border-rose-100', text: 'text-rose-600', iconBg: 'bg-rose-100/80', ring: 'ring-rose-200/70' },
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
        <div className={clsx("border rounded-2xl p-4 md:p-5 shadow-sm transition-all hover:shadow-md", style.bg, style.border)}>
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start text-center md:text-left gap-3 md:gap-4">
                <div className={clsx("w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ring-1", style.iconBg, style.ring)}>
                    {cloneElement(icon, { className: clsx("w-5 h-5 md:w-6 md:h-6", style.text) })}
                </div>
                <div>
                    <p className={clsx("text-[10px] md:text-[11px] font-semibold uppercase tracking-wider mb-0.5 md:mb-1", style.text)}>{label}</p>
                    <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{value}</p>
                </div>
            </div>
        </div>
    );
}
