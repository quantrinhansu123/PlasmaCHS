import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Building2,
    CreditCard,
    DollarSign,
    FileText,
    History,
    MapPin,
    Package,
    Phone,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';

export default function SupplierDetailsModal({ supplier, onClose }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, receipts, transactions
    const [loading, setLoading] = useState(true);
    const [isClosing, setIsClosing] = useState(false);

    const [receipts, setReceipts] = useState([]);
    const [issues, setIssues] = useState([]);
    const [transactions, setTransactions] = useState([]);

    // Thêm các state cho form Payment
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('CHUYEN_KHOAN');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    const [stats, setStats] = useState({
        totalImportValue: 0,
        totalPaid: 0,
        currentDebt: 0
    });

    useEffect(() => {
        if (!supplier) return;
        fetchSupplierData();
    }, [supplier]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const fetchSupplierData = async () => {
        setLoading(true);
        try {
            const supplierName = (supplier?.name || '').trim();

            // 1. Lấy lịch sử nhập hàng theo tên NCC (chấp nhận lệch hoa/thường)
            const { data: receiptsData, error: err1 } = await supabase
                .from('goods_receipts')
                .select('*')
                .ilike('supplier_name', supplierName)
                .order('created_at', { ascending: false });

            if (err1) throw err1;

            // 2. Lấy lịch sử xuất trả NCC theo supplier_id
            const { data: issuesData, error: errIssues } = await supabase
                .from('goods_issues')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('created_at', { ascending: false });

            if (errIssues) throw errIssues;

            // 3. Lấy Lịch sử Giao dịch (Thu/Chi)
            const { data: txData, error: err2 } = await supabase
                .from('supplier_transactions')
                .select('*')
                .eq('supplier_name', supplier.name)
                .order('created_at', { ascending: false });

            if (err2) throw err2;

            setReceipts(receiptsData || []);
            setIssues(issuesData || []);
            setTransactions(txData || []);

            // 4. Tính toán công nợ
            const validReceipts = (receiptsData || []).filter(r => r.status === 'DA_NHAP' || r.status === 'HOAN_THANH');
            const totalImport = validReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

            let totalPaid = 0;
            let totalRefund = 0; // Tương lai nếu NCC hoàn tiền

            (txData || []).forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.transaction_type === 'CHI') totalPaid += amt;
                else if (tx.transaction_type === 'THU') totalRefund += amt;
            });

            // Công nợ = Tổng đã nhập - (Tổng đã trả - TổngNCC hoàn lại)
            const debt = totalImport - (totalPaid - totalRefund);

            setStats({
                totalImportValue: totalImport,
                totalPaid: totalPaid,
                currentDebt: debt > 0 ? debt : 0
            });

        } catch (error) {
            console.error('Error fetching supplier details:', error);
            alert('Lỗi tải dữ liệu chi tiết Nhà cung cấp!');
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
            // Generate next PC code
            const { data: latestTx } = await supabase
                .from('supplier_transactions')
                .select('transaction_code')
                .order('created_at', { ascending: false })
                .limit(1);

            let nextCode = 'PC00001';
            if (latestTx && latestTx.length > 0 && latestTx[0].transaction_code?.startsWith('PC')) {
                const numStr = latestTx[0].transaction_code.replace(/[^0-9]/g, '');
                const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                nextCode = `PC${nextNum.toString().padStart(5, '0')}`;
            }

            const payload = {
                transaction_code: nextCode,
                supplier_name: supplier.name,
                amount: amountNum,
                transaction_type: 'CHI',
                transaction_date: paymentDate,
                payment_method: paymentMethod,
                note: paymentNote,
                created_by: 'Kế toán'
            };

            const { error } = await supabase.from('supplier_transactions').insert([payload]);
            if (error) throw error;

            alert('✅ Đã tạo phiếu chi trả nợ thành công!');
            setShowPaymentForm(false);
            setPaymentAmount('');
            setPaymentNote('');
            fetchSupplierData(); // refresh data
        } catch (error) {
            console.error('Lỗi khi lập phiếu chi:', error);
            alert('❌ Có lỗi lập phiếu chi: ' + error.message);
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

    const drawerContent = (
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end",
            isClosing ? "pointer-events-none" : ""
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Drawer Panel */}
            <div className={clsx(
                "relative h-full w-full max-w-[850px] bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500",
                isClosing && "animate-out slide-out-to-right duration-300"
            )}>

                {/* Header Profile */}
                <div className="bg-white px-6 md:px-8 py-6 border-b border-slate-200 shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                    <div className="flex items-start justify-between gap-4 relative z-10">
                        <div className="flex items-center gap-5 min-w-0">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0 border border-primary/20">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black text-slate-900 mb-1.5 tracking-tight truncate">{supplier.name}</h2>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                                    <span className="flex items-center gap-2" title="Số điện thoại"><Phone className="w-4 h-4 text-primary/60" /> {supplier.phone}</span>
                                    {supplier.tax_id && (
                                        <span className="flex items-center gap-2" title="Mã số thuế"><Building2 className="w-4 h-4 text-primary/60" /> MST: {supplier.tax_id}</span>
                                    )}
                                    {supplier.email && (
                                        <span className="flex items-center gap-2 lowercase" title="Email liên hệ"><X className="w-4 h-4 text-primary/60 rotate-45 shrink-0" /> {supplier.email}</span>
                                    )}
                                    <span className="flex items-center gap-2 min-w-0">
                                        <MapPin className="w-4 h-4 text-primary/60 shrink-0" /> 
                                        <span className="truncate max-w-[300px]" title={supplier.address}>{supplier.address}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={handleClose} 
                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-white hover:border-primary/20 rounded-xl border border-transparent transition-all shadow-sm shrink-0"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-8 mt-8 border-b border-slate-200 relative z-10">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`pb-4 px-2 text-[13px] font-black tracking-wider transition-all duration-300 border-b-2 ${activeTab === 'overview' ? 'text-primary border-primary' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                TỔNG QUAN
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('receipts')}
                            className={`pb-4 px-2 text-[13px] font-black tracking-wider transition-all duration-300 border-b-2 ${activeTab === 'receipts' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                XUẤT / NHẬP
                                <span className="bg-emerald-50 text-emerald-600 py-0.5 px-2 rounded-full text-[10px] leading-none shrink-0 border border-emerald-100">{receipts.length + issues.length}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`pb-4 px-2 text-[13px] font-black tracking-wider transition-all duration-300 border-b-2 ${activeTab === 'transactions' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4" />
                                THU / CHI
                                <span className="bg-indigo-50 text-indigo-600 py-0.5 px-2 rounded-full text-[10px] leading-none shrink-0 border border-indigo-100">{transactions.length}</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Body Details */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-[3px] border-primary/10 border-t-primary rounded-full animate-spin"></div>
                            <p className="text-[13px] font-black text-slate-400 animate-pulse uppercase tracking-[0.2em]">Đang truy xuất dữ liệu...</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* TAB: OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-rose-50 border border-rose-100/50 rounded-3xl p-6 shadow-sm group hover:-translate-y-1 transition-all duration-300">
                                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4 border border-rose-200">
                                                <DollarSign className="w-6 h-6" />
                                            </div>
                                            <p className="text-[11px] font-black text-rose-400 uppercase tracking-[0.2em] mb-1.5">Công Nợ Hiện Tại</p>
                                            <h3 className="text-2xl font-black text-rose-700">{formatCurrency(stats.currentDebt)}</h3>
                                        </div>

                                        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm group hover:-translate-y-1 transition-all duration-300">
                                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100">
                                                <ArrowDownRight className="w-6 h-6" />
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Tổng Đã Nhập</p>
                                            <h3 className="text-2xl font-black text-slate-800">{formatCurrency(stats.totalImportValue)}</h3>
                                        </div>

                                        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm group hover:-translate-y-1 transition-all duration-300">
                                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                                                <ArrowUpRight className="w-6 h-6" />
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Tổng Đã Trả</p>
                                            <h3 className="text-2xl font-black text-slate-800">{formatCurrency(stats.totalPaid)}</h3>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200/60">
                                        {!showPaymentForm ? (
                                            <button
                                                onClick={() => setShowPaymentForm(true)}
                                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-primary transition-all flex items-center gap-3"
                                            >
                                                <CreditCard className="w-4 h-4" /> Lập phiếu chi trả nợ
                                            </button>
                                        ) : (
                                            <div className="bg-white border border-primary/20 rounded-[2.5rem] p-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
                                                <div className="flex items-center justify-between mb-8">
                                                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                                                            <CreditCard className="w-5 h-5" />
                                                        </div>
                                                        TẠO PHIẾU CHI MỚI
                                                    </h3>
                                                    <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 bg-slate-50 text-slate-400 hover:text-rose-500 font-black text-[11px] uppercase tracking-wider rounded-lg transition-colors">Hủy bỏ</button>
                                                </div>
                                                <form onSubmit={handlePaymentSubmit} className="space-y-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="space-y-2.5">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Số tiền thanh toán *</label>
                                                            <input
                                                                type="text"
                                                                required
                                                                value={paymentAmount ? Number(paymentAmount.replace(/\./g, '')).toLocaleString('vi-VN') : ''}
                                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                                placeholder="VNĐ"
                                                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-black text-primary text-xl focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white transition-all shadow-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Hình thức thanh toán *</label>
                                                            <select
                                                                value={paymentMethod}
                                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white transition-all shadow-sm"
                                                            >
                                                                <option value="CHUYEN_KHOAN">💳 Chuyển khoản ngân hàng</option>
                                                                <option value="TIEN_MAT">💵 Thanh toán tiền mặt</option>
                                                                <option value="KHAC">🔄 Hình thức khác</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ngày lập phiếu *</label>
                                                            <input
                                                                type="date"
                                                                required
                                                                value={paymentDate}
                                                                onChange={(e) => setPaymentDate(e.target.value)}
                                                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white transition-all shadow-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2.5">
                                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Ghi chú giao dịch</label>
                                                            <input
                                                                type="text"
                                                                value={paymentNote}
                                                                onChange={(e) => setPaymentNote(e.target.value)}
                                                                placeholder="VD: Thanh toán đợt 1 phiếu nhập tháng 10..."
                                                                className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white transition-all shadow-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end pt-4">
                                                        <button
                                                            type="submit"
                                                            disabled={isSubmittingPayment}
                                                            className="w-full md:w-auto px-10 py-4 bg-primary text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                                        >
                                                            {isSubmittingPayment ? 'Đang khởi tạo phiếu chi...' : 'Xác nhận thanh toán'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: RECEIPTS & TRANSACTIONS TABLE STYLING */}
                            {(activeTab === 'receipts' || activeTab === 'transactions') && (
                                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                                    {(activeTab === 'receipts' && receipts.length === 0 && issues.length === 0) || (activeTab === 'transactions' && transactions.length === 0) ? (
                                        <div className="flex flex-col items-center justify-center py-32 opacity-30 grayscale">
                                            <FileText size={64} className="mb-4" />
                                            <p className="font-black tracking-widest uppercase text-sm">Trống dữ liệu</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                                {activeTab === 'receipts' ? (
                                                    <tr>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại phiếu</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã phiếu</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Số lượng</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tổng giá trị</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                                                    </tr>
                                                ) : (
                                                    <tr>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã GD</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày TT</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại GD</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phương thức</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Số tiền</th>
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {activeTab === 'receipts'
                                                    ? [
                                                        ...(receipts || []).map(r => ({
                                                            rowType: 'NHAP',
                                                            id: `r-${r.id}`,
                                                            code: r.receipt_code,
                                                            date: r.receipt_date,
                                                            qty: r.total_items,
                                                            amount: r.total_amount,
                                                            status: r.status
                                                        })),
                                                        ...(issues || []).map(i => ({
                                                            rowType: 'XUAT',
                                                            id: `i-${i.id}`,
                                                            code: i.issue_code,
                                                            date: i.issue_date,
                                                            qty: i.total_items,
                                                            amount: null,
                                                            status: i.status
                                                        }))
                                                    ]
                                                        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                                                        .map(row => (
                                                            <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <td className="px-8 py-5">
                                                                    <span className={clsx(
                                                                        "px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-lg border",
                                                                        row.rowType === 'NHAP'
                                                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                                            : "bg-amber-50 text-amber-700 border-amber-100"
                                                                    )}>
                                                                        {row.rowType === 'NHAP' ? 'NHẬP' : 'XUẤT'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-5 font-black text-[13px] text-slate-800 tracking-tight">{row.code || '—'}</td>
                                                                <td className="px-8 py-5 text-[13px] font-bold text-slate-500">{formatDate(row.date)}</td>
                                                                <td className="px-8 py-5 text-[13px] font-black text-slate-700 text-center">{row.qty || 0} item</td>
                                                                <td className="px-8 py-5 text-[13px] font-black text-right">
                                                                    {row.rowType === 'NHAP'
                                                                        ? <span className="text-emerald-600">{formatCurrency(row.amount)}</span>
                                                                        : <span className="text-slate-400">—</span>}
                                                                </td>
                                                                <td className="px-8 py-5 text-center">
                                                                    <span className={clsx(
                                                                        "px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-lg border",
                                                                        (row.status === 'DA_NHAP' || row.status === 'HOAN_THANH' || row.status === 'DA_XUAT')
                                                                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                                            : "bg-amber-50 text-amber-600 border-amber-100"
                                                                    )}>
                                                                        {row.status || '—'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    : transactions.map(tx => (
                                                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-8 py-5 font-black text-[13px] text-slate-800 tracking-tight">{tx.transaction_code}</td>
                                                        <td className="px-8 py-5 text-[13px] font-bold text-slate-500">{formatDate(tx.transaction_date)}</td>
                                                        <td className="px-8 py-5">
                                                            {tx.transaction_type === 'CHI' ? (
                                                                <span className="text-indigo-600 flex items-center gap-1.5 text-[11px] font-black"><ArrowUpRight className="w-4 h-4" /> PHIẾU CHI</span>
                                                            ) : (
                                                                <span className="text-emerald-600 flex items-center gap-1.5 text-[11px] font-black"><ArrowDownRight className="w-4 h-4" /> HOÀN TIỀN</span>
                                                            )}
                                                        </td>
                                                        <td className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-tight">{tx.payment_method?.replace(/_/g, ' ')}</td>
                                                        <td className="px-8 py-5 text-[13px] font-black text-slate-900 text-right">{formatCurrency(tx.amount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-8 py-4 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] font-black text-slate-400 tracking-widest uppercase shrink-0">
                    <div className="flex items-center gap-3">
                        <Activity size={14} className="text-primary/40" />
                        TRẠNG THÁI HỒ SƠ: <span className="text-primary tracking-normal font-black">ACTIVE</span>
                    </div>
                    <div>
                        {activeTab === 'receipts' ? receipts.length + issues.length : transactions.length} BẢN GHI ĐƯỢC TÌM THẤY
                    </div>
                </div>

            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
