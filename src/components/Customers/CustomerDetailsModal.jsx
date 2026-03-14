import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    CreditCard,
    DollarSign,
    FileText,
    History,
    ImageIcon,
    MapPin,
    Package,
    Phone,
    Upload,
    UserCircle,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

export default function CustomerDetailsModal({ customer, onClose }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, orders, transactions
    const [loading, setLoading] = useState(true);

    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);

    // States for Payment Form
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('CHUYEN_KHOAN');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [billImageFile, setBillImageFile] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const [stats, setStats] = useState({
        totalOrderValue: 0,
        totalPaid: 0,
        currentDebt: 0
    });

    useEffect(() => {
        if (!customer) return;
        fetchCustomerData();
    }, [customer]);

    const fetchCustomerData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Orders (Exclude HUY_DON)
            const { data: ordersData, error: err1 } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_name', customer.name)
                .order('created_at', { ascending: false });

            if (err1) throw err1;

            // 2. Fetch Transactions (THU/CHI)
            const { data: txData, error: err2 } = await supabase
                .from('customer_transactions')
                .select('*')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });

            if (err2) throw err2;

            setOrders(ordersData || []);
            setTransactions(txData || []);

            // 3. Calculate Debt
            // Consider order as debt if it's not canceled or in initial draft states
            const validOrders = (ordersData || []).filter(o =>
                !['HUY_DON'].includes(o.status)
            );
            const totalOrder = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            let totalPaid = 0;
            let totalRefund = 0; // Công ty hoàn tiền cho khách

            (txData || []).forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.transaction_type === 'THU') totalPaid += amt; // Khách trả nợ -> THU
                else if (tx.transaction_type === 'CHI') totalRefund += amt; // Cty hoàn lại -> CHI
            });

            // Công nợ = (Tổng tiền hàng KH mua) - (Tổng tiền KH đã trả - Công ty hoàn lại)
            // Nếu > 0: Khách hàng đang nợ Công ty.
            const debt = totalOrder - (totalPaid - totalRefund);

            setStats({
                totalOrderValue: totalOrder,
                totalPaid: totalPaid,
                currentDebt: debt > 0 ? debt : 0
            });

        } catch (error) {
            console.error('Error fetching customer details:', error);
            alert('Lỗi tải dữ liệu chi tiết Khách hàng!');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const amountNum = parseFloat(paymentAmount.replace(/\./g, ''));
        if (!amountNum || amountNum <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ!');
            return;
        }

        setIsSubmittingPayment(true);
        try {
            // Generate next PT code (Phiếu Thu)
            const { data: latestTx } = await supabase
                .from('customer_transactions')
                .select('transaction_code')
                .order('created_at', { ascending: false })
                .limit(1);

            let nextCode = 'PT00001';
            if (latestTx && latestTx.length > 0 && latestTx[0].transaction_code?.startsWith('PT')) {
                const numStr = latestTx[0].transaction_code.replace(/[^0-9]/g, '');
                const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                nextCode = `PT${nextNum.toString().padStart(5, '0')}`;
            }

            const payload = {
                transaction_code: nextCode,
                customer_id: customer.id,
                customer_name: customer.name,
                amount: amountNum,
                transaction_type: 'THU',
                transaction_date: paymentDate,
                payment_method: paymentMethod,
                note: paymentNote,
                created_by: 'Kế toán'
            };

            // Upload bill image if provided
            if (billImageFile) {
                const fileName = `bill_${nextCode}_${Date.now()}.${billImageFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage
                    .from('bill-images')
                    .upload(fileName, billImageFile);
                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('bill-images').getPublicUrl(fileName);
                    payload.bill_image_url = urlData.publicUrl;
                }
            }

            const { error } = await supabase.from('customer_transactions').insert([payload]);
            if (error) throw error;

            alert('✅ Đã lập Phiếu Thu tiền thành công!');
            setShowPaymentForm(false);
            setPaymentAmount('');
            setPaymentNote('');
            setBillImageFile(null);
            fetchCustomerData(); // refresh data
        } catch (error) {
            console.error('Lỗi khi lập phiếu thu:', error);
            alert('❌ Có lỗi lập phiếu thu: ' + error.message);
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' ₫';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-200">
            <div className="bg-slate-50 rounded-t-[1.5rem] md:rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[100dvh] md:h-[80vh] mt-0 md:mt-12">

                {/* Header Profile */}
                <div className="bg-white px-4 md:px-8 py-4 md:py-6 border-b border-slate-200 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-violet-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                    <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-start md:items-center gap-3 md:gap-5 min-w-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-violet-200 shrink-0">
                                <UserCircle className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1 tracking-tight truncate">{customer.name}</h2>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {customer.phone || '—'}</span>
                                    <span className="flex items-center gap-1.5 min-w-0"><MapPin className="w-4 h-4 text-slate-400 shrink-0" /> <span className="max-w-[220px] md:max-w-[300px] truncate" title={customer.address}>{customer.address || '—'}</span></span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors shrink-0">
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="grid grid-cols-3 md:flex md:items-center md:gap-6 mt-5 md:mt-8 border-b border-slate-200 relative z-10 overflow-hidden">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pt-1.5 pb-2.5 md:pb-4 px-1 md:px-2 text-[11px] md:text-sm font-black tracking-normal md:tracking-wider transition-all duration-300 border-b-2 min-w-0 ${activeTab === 'overview' ? 'text-violet-600 border-violet-600' : 'text-slate-400 border-transparent hover:text-slate-700'}`}
                        >
                            <div className="flex items-center justify-center gap-1 md:gap-2 min-w-0">
                                <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="text-center leading-tight">Tổng quan</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`pt-1.5 pb-2.5 md:pb-4 px-1 md:px-2 text-[11px] md:text-sm font-black tracking-normal md:tracking-wider transition-all duration-300 border-b-2 min-w-0 ${activeTab === 'orders' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-700'}`}
                        >
                            <div className="relative flex items-center justify-center gap-1 md:gap-2 min-w-0">
                                <Package className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="text-center leading-tight">Đơn hàng</span>
                                <span className="hidden md:inline-flex bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-[10px] leading-none shrink-0">{orders.length}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`pt-1.5 pb-2.5 md:pb-4 px-1 md:px-2 text-[11px] md:text-sm font-black tracking-normal md:tracking-wider transition-all duration-300 border-b-2 min-w-0 ${activeTab === 'transactions' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-700'}`}
                        >
                            <div className="relative flex items-center justify-center gap-1 md:gap-2 min-w-0">
                                <History className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                                <span className="text-center leading-tight">Thu / Chi</span>
                                <span className="hidden md:inline-flex bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-[10px] leading-none shrink-0">{transactions.length}</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Body Details */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-4">
                            <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-600 rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">Đang tải dữ liệu Khách hàng...</p>
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">

                            {/* TAB: OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="space-y-6 md:space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                        {/* Card CÔNG NỢ */}
                                        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-4 md:p-6 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                            <div className="absolute -right-4 -bottom-4 bg-rose-200/50 w-24 h-24 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                                                    <DollarSign className="w-6 h-6" />
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-black text-rose-400 uppercase tracking-widest relative z-10">Công Nợ Khách Gửi</p>
                                            <h3 className="text-2xl md:text-3xl font-black text-rose-700 mt-1 relative z-10 break-words">{formatCurrency(stats.currentDebt)}</h3>
                                        </div>

                                        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-4 md:p-6 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                            <div className="absolute -right-4 -bottom-4 bg-slate-100 w-24 h-24 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                                    <ArrowUpRight className="w-6 h-6" />
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest relative z-10">Tổng Tiền Hàng</p>
                                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mt-1 relative z-10 break-words">{formatCurrency(stats.totalOrderValue)}</h3>
                                        </div>

                                        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-4 md:p-6 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                            <div className="absolute -right-4 -bottom-4 bg-slate-100 w-24 h-24 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                                    <ArrowDownRight className="w-6 h-6" />
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest relative z-10">Tổng Tiền Khách Trả</p>
                                            <h3 className="text-2xl md:text-3xl font-black text-slate-800 mt-1 relative z-10 break-words">{formatCurrency(stats.totalPaid)}</h3>
                                        </div>
                                    </div>

                                    {/* Action Shortcuts */}
                                    <div className="flex flex-col items-stretch gap-4 pt-4 border-t border-slate-100">
                                        {!showPaymentForm ? (
                                            <button
                                                onClick={() => setShowPaymentForm(true)}
                                                className="w-full md:w-auto px-6 py-3.5 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <CreditCard className="w-4 h-4" /> Nhận Tiền Khách Trả Nợ (Phiếu Thu)
                                            </button>
                                        ) : (
                                            <div className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-4 md:p-6 animate-in slide-in-from-top-4 duration-300">
                                                <div className="flex items-start md:items-center justify-between gap-3 mb-5 md:mb-6">
                                                    <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-600" /> TẠO PHIẾU THU TIỀN</h3>
                                                    <button onClick={() => setShowPaymentForm(false)} className="text-slate-400 hover:text-rose-500 font-bold text-sm">Hủy bỏ</button>
                                                </div>
                                                <form onSubmit={handlePaymentSubmit} className="space-y-5">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Số tiền thu (VNĐ) *</label>
                                                            <input
                                                                type="text"
                                                                required
                                                                value={paymentAmount ? Number(paymentAmount.replace(/\./g, '')).toLocaleString('vi-VN') : ''}
                                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                                placeholder="Nhập số tiền..."
                                                                className="w-full px-4 md:px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-black text-violet-700 text-base md:text-lg outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition-all placeholder:font-medium placeholder:text-slate-300"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Hình thức *</label>
                                                            <select
                                                                value={paymentMethod}
                                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                                className="w-full px-4 md:px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition-all"
                                                            >
                                                                <option value="CHUYEN_KHOAN">💳 Chuyển khoản (Ngân hàng)</option>
                                                                <option value="TIEN_MAT">💵 Tiền mặt</option>
                                                                <option value="KHAC">🔄 Phương thức khác</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày lập phiếu *</label>
                                                            <input
                                                                type="date"
                                                                required
                                                                value={paymentDate}
                                                                onChange={(e) => setPaymentDate(e.target.value)}
                                                                className="w-full px-4 md:px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition-all"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nội dung nộp tiền</label>
                                                            <input
                                                                type="text"
                                                                value={paymentNote}
                                                                onChange={(e) => setPaymentNote(e.target.value)}
                                                                placeholder="Khách hàng thanh toán tiền hàng..."
                                                                className="w-full px-4 md:px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-400 transition-all placeholder:font-medium placeholder:text-slate-300"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ảnh Bill / Hóa đơn</label>
                                                        <label className="flex items-center gap-3 px-4 md:px-5 py-3.5 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 transition-all">
                                                            <Upload className="w-5 h-5 text-slate-400" />
                                                            <span className="font-bold text-sm text-slate-500 truncate">
                                                                {billImageFile ? billImageFile.name : 'Chọn ảnh bill...'}
                                                            </span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => setBillImageFile(e.target.files[0] || null)}
                                                            />
                                                        </label>
                                                    </div>
                                                    <div className="flex justify-end pt-2">
                                                        <button
                                                            type="submit"
                                                            disabled={isSubmittingPayment}
                                                            className="w-full md:w-auto px-6 md:px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-sm shadow-xl shadow-violet-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                        >
                                                            {isSubmittingPayment ? 'Đang lưu Phiếu thu...' : 'Xác nhận Đã Nhận Tiền'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: ORDERS */}
                            {activeTab === 'orders' && (
                                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                    {orders.length === 0 ? (
                                        <div className="p-8 md:p-16 text-center flex flex-col items-center">
                                            <Package className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mb-4" />
                                            <p className="text-slate-400 font-bold text-base md:text-lg">Khách hàng chưa có đơn mua hàng nào</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="md:hidden divide-y divide-slate-100">
                                                {orders.map(o => (
                                                    <div key={o.id} className="p-4 space-y-3">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-black text-sm text-slate-800 truncate">{o.order_code}</p>
                                                            <span className={`px-2.5 py-1 text-[10px] font-black tracking-wider uppercase rounded-lg border shrink-0 ${o.status === 'DA_DUYET' || o.status === 'HOAN_THANH' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                                                                }`}>
                                                                {o.status}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày tạo</p>
                                                                <p className="font-bold text-slate-600 mt-1">{formatDate(o.created_at)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số lượng</p>
                                                                <p className="font-black text-slate-800 mt-1">{o.quantity}</p>
                                                            </div>
                                                        </div>
                                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng giá trị</p>
                                                            <p className="text-sm font-black text-emerald-600">{formatCurrency(o.total_amount)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <table className="hidden md:table w-full text-left">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mã đơn</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày tạo</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Số lượng</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Tổng giá trị</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Trạng thái</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {orders.map(o => (
                                                        <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-black text-sm text-slate-700">{o.order_code}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{formatDate(o.created_at)}</td>
                                                            <td className="px-6 py-4 text-sm font-black text-slate-700 text-center">{o.quantity}</td>
                                                            <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(o.total_amount)}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-lg border ${o.status === 'DA_DUYET' || o.status === 'HOAN_THANH' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                                                                    }`}>
                                                                    {o.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* TAB: TRANSACTIONS */}
                            {activeTab === 'transactions' && (
                                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                    {transactions.length === 0 ? (
                                        <div className="p-8 md:p-16 text-center flex flex-col items-center">
                                            <FileText className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mb-4" />
                                            <p className="text-slate-400 font-bold text-base md:text-lg mb-6">Chưa có giao dịch thu/chi nào</p>
                                            <button
                                                onClick={() => {
                                                    setActiveTab('overview');
                                                    setShowPaymentForm(true);
                                                }}
                                                className="w-full sm:w-auto px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-sm shadow-xl shadow-violet-200 transition-all flex items-center justify-center gap-2"
                                            >
                                                <CreditCard className="w-4 h-4" /> Lập Phiếu Thu tiền Khách nợ ngay
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="md:hidden divide-y divide-slate-100">
                                                {transactions.map(tx => (
                                                    <div key={tx.id} className="p-4 space-y-3">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="font-black text-sm text-slate-800 truncate">{tx.transaction_code}</p>
                                                            {tx.transaction_type === 'THU' ? (
                                                                <span className="text-emerald-600 flex items-center gap-1 text-xs font-black"><ArrowDownRight className="w-3.5 h-3.5" /> THU TIỀN</span>
                                                            ) : (
                                                                <span className="text-amber-600 flex items-center gap-1 text-xs font-black"><ArrowUpRight className="w-3.5 h-3.5" /> HOÀN TIỀN</span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày GD</p>
                                                                <p className="font-bold text-slate-600 mt-1">{formatDate(tx.transaction_date)}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hình thức</p>
                                                                <p className="font-bold text-slate-700 mt-1 break-words">{tx.payment_method}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Người lập</p>
                                                                <p className="font-bold text-slate-600 mt-1">{tx.created_by || '—'}</p>
                                                            </div>
                                                            <p className="text-sm font-black text-slate-900">{formatCurrency(tx.amount)}</p>
                                                        </div>
                                                        <div className="pt-1">
                                                            {tx.bill_image_url ? (
                                                                <button
                                                                    onClick={() => setPreviewImage(tx.bill_image_url)}
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors text-xs font-bold"
                                                                >
                                                                    <ImageIcon className="w-3.5 h-3.5" /> Xem bill
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 text-xs">Không có bill</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <table className="hidden md:table w-full text-left">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mã GD</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày GD</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loại</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hình thức</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Số tiền</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Người lập</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Bill</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {transactions.map(tx => (
                                                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4 font-black text-sm text-slate-700">{tx.transaction_code}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{formatDate(tx.transaction_date)}</td>
                                                            <td className="px-6 py-4 text-sm font-black">
                                                                {tx.transaction_type === 'THU' ? (
                                                                    <span className="text-emerald-600 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5" /> THU TIỀN</span>
                                                                ) : (
                                                                    <span className="text-amber-600 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5" /> HOÀN TIỀN</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-600">{tx.payment_method}</td>
                                                            <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">{formatCurrency(tx.amount)}</td>
                                                            <td className="px-6 py-4 text-sm font-bold text-slate-500">{tx.created_by || '—'}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                {tx.bill_image_url ? (
                                                                    <button
                                                                        onClick={() => setPreviewImage(tx.bill_image_url)}
                                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-100 transition-colors text-xs font-bold"
                                                                    >
                                                                        <ImageIcon className="w-3.5 h-3.5" /> Xem
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-slate-300 text-xs">—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Image Lightbox */}
                {previewImage && (
                    <div
                        onClick={() => setPreviewImage(null)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-3 md:p-8 cursor-pointer"
                    >
                        <div className="relative max-w-3xl max-h-[85vh] w-full">
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute top-2 right-2 md:-top-3 md:-right-3 p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors z-10"
                            >
                                <X className="w-5 h-5 text-slate-600" />
                            </button>
                            <img
                                src={previewImage}
                                alt="Bill"
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
