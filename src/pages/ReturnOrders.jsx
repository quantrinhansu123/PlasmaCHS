import React, { useState, useEffect } from 'react';
import { 
  PackageMinus, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  FileText,
  Truck,
  User,
  MapPin,
  Calendar,
  Package,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { supabase } from '../supabase/config';
import { toast } from 'react-toastify';
import { ORDER_STATUSES, PRODUCT_TYPES, CUSTOMER_CATEGORIES } from '../constants/orderConstants';
import ColumnPicker from '../components/ui/ColumnPicker';

const ReturnOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    
    useEffect(() => {
        console.log('📦 ReturnOrders Component Mounted');
        fetchReturnOrders();
    }, []);

    const fetchReturnOrders = async () => {
        setIsLoading(true);
        try {
            // Fetch only orders with TRA_HANG status
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'TRA_HANG')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching return orders:', error);
            toast.error('❌ Không thể tải danh sách đơn hàng trả về');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = orders.filter(order => {
        const search = searchTerm.toLowerCase();
        return (
            (order.order_code?.toLowerCase().includes(search)) ||
            (order.customer_name?.toLowerCase().includes(search)) ||
            (order.recipient_name?.toLowerCase().includes(search))
        );
    });

    const getStatusLabel = (statusId) => {
        return ORDER_STATUSES.find(s => s.id === statusId)?.label || statusId;
    };

    const getProductLabel = (productId) => {
        return PRODUCT_TYPES.find(p => p.id === productId)?.label || productId;
    };

    const getCategoryBadgeClass = (categoryId) => clsx(
        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
        categoryId === 'BV' && 'bg-blue-50 text-blue-700 border-blue-200',
        categoryId === 'TM' && 'bg-pink-50 text-pink-700 border-pink-200',
        categoryId === 'PK' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        !categoryId && 'bg-slate-50 text-slate-700 border-slate-200'
    );

    const handleCreateRecovery = (order) => {
        // Navigate based on product type
        if (order.product_type?.startsWith('MAY')) {
            navigate('/thu-hoi-may', { state: { orderId: order.id, orderCode: order.order_code, customerName: order.customer_name } });
        } else {
            navigate('/thu-hoi-vo', { state: { orderId: order.id, orderCode: order.order_code, customerName: order.customer_name } });
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-4 md:p-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shadow-sm">
                            <PackageMinus size={24} />
                        </div>
                        Đơn hàng trả về
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1 ml-14">
                        Theo dõi {orders.length} đơn hàng bị khách trả lại và cần xử lý thu hồi
                    </p>
                </div>

                <div className="flex items-center gap-3 ml-14 md:ml-0">
                    <button 
                        onClick={() => navigate('/thu-hoi')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <ChevronLeft size={18} />
                        Quay lại module
                    </button>
                    <button 
                        onClick={fetchReturnOrders}
                        disabled={isLoading}
                        className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* List and Statistics View would go here similar to Orders.jsx */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center gap-4 bg-slate-50/50">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rose-500 transition-colors" size={18} />
                        <input 
                            type="text"
                            placeholder="Tìm kiếm mã đơn, khách hàng..."
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Column Picker or other filters can go here */}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Đơn hàng</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Khách hàng</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Hàng hóa</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Số lượng</th>
                                <th className="px-6 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Ngày cập nhật</th>
                                <th className="px-6 py-4 text-center text-[11px] font-black text-slate-500 uppercase tracking-widest">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse border-b border-slate-50">
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-48"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-10"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : filteredOrders.length > 0 ? (
                                filteredOrders.map((order) => (
                                    <tr key={order.id} className="group hover:bg-slate-50/80 transition-all border-b border-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="font-black text-slate-900">{order.order_code}</div>
                                            <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{order.order_type}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={getCategoryBadgeClass(order.customer_category)}>
                                                    {order.customer_category}
                                                </span>
                                                <div className="font-bold text-slate-700">{order.customer_name}</div>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                                                <User size={10} /> {order.recipient_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                            <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                                                {getProductLabel(order.product_type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-black inline-block">
                                                {order.quantity}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                            {new Date(order.updated_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => handleCreateRecovery(order)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-rose-600/20 active:scale-95"
                                            >
                                                <RefreshCw size={14} />
                                                Tạo phiếu thu hồi
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Package size={48} className="mb-4 opacity-20" />
                                            <p className="font-bold text-slate-500">Không tìm thấy đơn hàng trả về nào</p>
                                            <p className="text-sm mt-1">Danh sách này chỉ hiển thị các đơn hàng có trạng thái "Trả hàng"</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-bold italic">
                        * Gợi ý: Hãy gán trạng thái "Trả hàng" cho đơn hàng gốc trước khi thực hiện thu hồi tại trang này.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReturnOrders;
