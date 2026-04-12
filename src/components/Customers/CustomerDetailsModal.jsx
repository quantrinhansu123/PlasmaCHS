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
    X,
    Receipt,
    Mail,
    Building,
    Download,
    Edit,
    Trash2,
    MoreVertical
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';
import * as XLSX from 'xlsx';

export default function CustomerDetailsModal({ customer, onClose }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, orders, transactions
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cylinders, setCylinders] = useState([]);
    const [careHistory, setCareHistory] = useState([]);

    // States for Payment Form
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('CHUYEN_KHOAN');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [billImageFile, setBillImageFile] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Edit Transaction States
    const [editingTxId, setEditingTxId] = useState(null);
    const [editingTxCode, setEditingTxCode] = useState('');

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
            const { data: ordersData, error: err1 } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_name', customer.name)
                .order('created_at', { ascending: false });

            if (err1) throw err1;

            const { data: txData, error: err2 } = await supabase
                .from('customer_transactions')
                .select('*')
                .eq('customer_id', customer.id)
                .order('created_at', { ascending: false });

            if (err2) throw err2;

            const { data: cylData, error: err3 } = await supabase
                .from('cylinders')
                .select('*')
                .eq('customer_id', customer.id);

            if (err3) throw err3;

            // Fetch care history by phone
            let histData = [];
            if (customer.phone && customer.phone.trim() !== '') {
                const { data: phoneLeads, error: err4 } = await supabase
                    .from('customers')
                    .select('id, name, status, care_by, created_at')
                    .eq('phone', customer.phone)
                    .order('created_at', { ascending: false });

                if (err4) {
                    console.error('Error fetching leads by phone:', err4);
                } else {
                    histData = phoneLeads;
                }
            } else {
                // Fallback nếu không có phone
                histData = [{
                    id: customer.id,
                    status: customer.status,
                    care_by: customer.care_by,
                    created_at: customer.created_at
                }];
            }

            setOrders(ordersData || []);
            setTransactions(txData || []);
            setCylinders(cylData || []);
            setCareHistory(histData || []);

            const validOrders = (ordersData || []).filter(o =>
                !['HUY_DON'].includes(o.status)
            );
            const totalOrder = validOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

            let totalPaid = 0;
            let totalRefund = 0;

            (txData || []).forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.transaction_type === 'THU') totalPaid += amt;
                else if (tx.transaction_type === 'CHI') totalRefund += amt;
            });

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
            let nextCode = editingTxCode;

            if (!editingTxId) {
                const { data: latestTx } = await supabase
                    .from('customer_transactions')
                    .select('transaction_code')
                    .order('created_at', { ascending: false })
                    .limit(1);

                nextCode = 'PT00001';
                if (latestTx && latestTx.length > 0 && latestTx[0].transaction_code?.startsWith('PT')) {
                    const numStr = latestTx[0].transaction_code.replace(/[^0-9]/g, '');
                    const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                    nextCode = `PT${nextNum.toString().padStart(5, '0')}`;
                }
            }

            const payload = {
                customer_id: customer.id,
                customer_name: customer.name,
                amount: amountNum,
                transaction_date: paymentDate,
                payment_method: paymentMethod,
                note: paymentNote,
            };

            if (!editingTxId) {
                payload.transaction_code = nextCode;
                payload.transaction_type = 'THU';
                payload.created_by = 'Kế toán';
            }

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

            if (editingTxId) {
                const { error } = await supabase.from('customer_transactions').update(payload).eq('id', editingTxId);
                if (error) throw error;
                alert('✅ Đã cập nhật giao dịch thành công!');
            } else {
                const { error } = await supabase.from('customer_transactions').insert([payload]);
                if (error) throw error;
                alert('✅ Đã lập Phiếu Thu tiền thành công!');
            }

            resetPaymentForm();
            fetchCustomerData();
        } catch (error) {
            console.error('Lỗi khi lập phiếu thu:', error);
            alert('❌ Có lỗi lập phiếu thu: ' + error.message);
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const resetPaymentForm = () => {
        setShowPaymentForm(false);
        setEditingTxId(null);
        setEditingTxCode('');
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('CHUYEN_KHOAN');
        setPaymentNote('');
        setBillImageFile(null);
    };

    const handleEditTransaction = (tx) => {
        setEditingTxId(tx.id);
        setEditingTxCode(tx.transaction_code);
        setPaymentAmount(Math.round(tx.amount).toString());
        setPaymentDate(tx.transaction_date || new Date().toISOString().split('T')[0]);
        setPaymentMethod(tx.payment_method || 'CHUYEN_KHOAN');
        setPaymentNote(tx.note || '');
        setBillImageFile(null);
        
        setShowPaymentForm(true);
        setActiveTab('overview');
    };

    const handleDeleteTransaction = async (id, code) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa giao dịch ${code} không?`)) return;
        try {
            const { error } = await supabase.from('customer_transactions').delete().eq('id', id);
            if (error) throw error;
            alert('✅ Đã xóa giao dịch thành công!');
            fetchCustomerData();
        } catch (error) {
            console.error('Lỗi khi xóa giao dịch:', error);
            alert('❌ Có lỗi xảy ra khi xóa giao dịch: ' + error.message);
        }
    };

    const handleExportTransactions = () => {
        if (!transactions || transactions.length === 0) {
            alert('Không có giao dịch nào để xuất!');
            return;
        }

        const exportData = transactions.map(tx => ({
            'Mã Giao Dịch': tx.transaction_code,
            'Ngày Giao Dịch': new Date(tx.transaction_date).toLocaleDateString('vi-VN'),
            'Loại Giao Dịch': tx.transaction_type === 'THU' ? 'Thu' : 'Chi',
            'Số Tiền': tx.amount,
            'Hình Thức': tx.payment_method,
            'Nội Dung': tx.note || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");
        XLSX.writeFile(wb, `GiaoDich_${customer.name}.xlsx`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' ₫';
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            <div
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            <div
                className={clsx(
                    "relative bg-slate-50 shadow-2xl w-full max-w-3xl overflow-hidden h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary text-white shadow-lg">
                                <UserCircle className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                                <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {customer.phone || '—'}</span>
                                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {customer.address || '—'}</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-xl transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6 mt-5 border-b border-slate-200 overflow-x-auto scrollbar-hide scroll-smooth">
                        <button onClick={() => setActiveTab('overview')} className={clsx("pb-4 text-sm font-black transition-all border-b-2 whitespace-nowrap shrink-0", activeTab === 'overview' ? 'text-primary border-primary' : 'text-slate-400 border-transparent')}>Tổng quan</button>
                        {customer.status !== 'Thành công' && (
                            <button onClick={() => setActiveTab('care_history')} className={clsx("pb-4 text-sm font-black transition-all border-b-2 whitespace-nowrap shrink-0", activeTab === 'care_history' ? 'text-primary border-primary' : 'text-slate-400 border-transparent')}>Lịch sử chăm sóc ({careHistory.length})</button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 font-bold text-slate-400">Đang tải...</div>
                    ) : (
                        <div className="space-y-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {customer.status === 'Thành công' && (
                                        <div className="grid grid-cols-3 gap-6 text-center">
                                            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Công Nợ</p>
                                                <h3 className="text-xl font-black text-rose-700">{formatCurrency(stats.currentDebt)}</h3>
                                            </div>
                                            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Tổng Tiền Hàng</p>
                                                <h3 className="text-xl font-black text-emerald-700">{formatCurrency(stats.totalOrderValue)}</h3>
                                            </div>
                                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Đã Thanh Toán</p>
                                                <h3 className="text-xl font-black text-indigo-700">{formatCurrency(stats.totalPaid)}</h3>
                                            </div>
                                        </div>
                                    )}

                                    {/* Care Info section */}
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Trạng thái chăm sóc (60 ngày)
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-600">Thời hạn chăm sóc:</span>
                                                {(() => {
                                                    if (!customer.care_expiry_date) return <span className="text-sm font-bold text-slate-400">Chưa có dữ liệu</span>;
                                                    const diff = Math.ceil((new Date(customer.care_expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                                    if (diff <= 0) return <span className="text-sm font-black text-rose-600 uppercase">Quá hạn</span>;
                                                    if (diff <= 10) return <span className="text-sm font-black text-amber-500 animate-pulse uppercase">Cảnh báo (Còn {diff} ngày)</span>;
                                                    return <span className="text-sm font-black text-emerald-600 uppercase">Đang chăm sóc (Còn {diff} ngày)</span>;
                                                })()}
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">Ngày đăng ký:</span>
                                                <span className="font-bold text-slate-600">{formatDate(customer.care_assigned_at || customer.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-400">Ngày hết hạn:</span>
                                                <span className="font-bold text-slate-600">{formatDate(customer.care_expiry_date)}</span>
                                            </div>
                                            {customer.status === 'Thành công' && (
                                                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/80">
                                                    <span className="text-slate-400">Ngày thành công:</span>
                                                    <span className="font-bold text-emerald-700">
                                                        {customer.success_at
                                                            ? formatDate(customer.success_at)
                                                            : '—'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                                        <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest border-b pb-3">
                                            <Receipt className="w-4 h-4" /> Thông tin xuất hóa đơn
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã số thuế</p>
                                                <p className="font-bold text-slate-700">{customer.tax_code || '—'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email hóa đơn</p>
                                                <p className="font-bold text-primary">{customer.invoice_email || '—'}</p>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên đơn vị</p>
                                                <p className="font-bold text-slate-800">{customer.invoice_company_name || '—'}</p>
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa chỉ xuất hóa đơn</p>
                                                <p className="font-bold text-slate-600">{customer.invoice_address || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {!showPaymentForm ? (
                                        <button onClick={() => setShowPaymentForm(true)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                                            <CreditCard className="w-4 h-4" /> Nhận Tiền Khách Trả Nợ
                                        </button>
                                    ) : (
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Lập phiếu thu tiền</h3>
                                                <button onClick={resetPaymentForm} className="text-xs font-black text-slate-400 hover:text-rose-500 uppercase">Thoát</button>
                                            </div>
                                            <form onSubmit={handlePaymentSubmit} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Số tiền thu *</label>
                                                        <input type="text" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-black text-primary outline-none focus:border-primary/40" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hình thức *</label>
                                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40">
                                                            <option value="CHUYEN_KHOAN">Chuyển khoản</option>
                                                            <option value="TIEN_MAT">Tiền mặt</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày lập phiếu *</label>
                                                        <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nội dung</label>
                                                        <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Nội dung nộp tiền..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-primary/40" />
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={isSubmittingPayment} className="w-full py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all">Xác nhận Đã Nhận Tiền</button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'care_history' && (
                                <div className="space-y-4">
                                    {careHistory.length === 0 ? (
                                        <div className="py-12 text-center font-bold text-slate-300 italic">Chưa có lịch sử chăm sóc</div>
                                    ) : (
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Danh sách đơn (Cùng SĐT: {customer.phone || 'Không có'})
                                                </h5>
                                            </div>
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Trạng thái</th>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">Ngày tạo</th>
                                                        <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-[10px]">KD chăm sóc</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {careHistory.map((item) => (
                                                        <tr key={item.id} className={clsx("hover:bg-slate-50/50 transition-colors", item.id === customer.id && "bg-blue-50/30")}>
                                                            <td className="px-4 py-3">
                                                                <span className={clsx(
                                                                    "px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider",
                                                                    item.status === 'Thành công' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                                                )}>
                                                                    {item.status || 'Chưa thành công'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-500 italic">
                                                                {item.created_at ? new Date(item.created_at).toLocaleString('vi-VN', {
                                                                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                }) : '—'}
                                                            </td>
                                                            <td className="px-4 py-3 font-bold text-slate-700">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={clsx("w-2 h-2 rounded-full", item.id === customer.id ? "bg-primary" : "bg-slate-300")} />
                                                                    <span>{item.care_by || '—'}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
