import React, { useState, useEffect } from 'react';
import { 
    Truck, 
    CheckCircle2, 
    Camera, 
    X, 
    ChevronLeft, 
    Search, 
    MapPin, 
    Phone, 
    User,
    Package,
    Clock,
    AlertCircle,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    LayoutGrid,
    List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';

const ShippingTasks = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);
    const [notes, setNotes] = useState('');
    const [deliveryStatus, setDeliveryStatus] = useState('HOAN_THANH');
    const [activeView, setActiveView] = useState('list');

    useEffect(() => {
        fetchShippingOrders();
    }, []);

    const fetchShippingOrders = async () => {
        setIsLoading(true);
        try {
            // Fetch orders that are in CHO_GIAO_HANG or DANG_GIAO_HANG
            // In a real scenario, we'd also filter by the current shipper's assigned ID
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .in('status', ['CHO_GIAO_HANG', 'DANG_GIAO_HANG'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching delivery tasks:', error);
            toast.error('❌ Không thể tải danh sách nhiệm vụ: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadImages = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        const newImages = [...uploadedImages];

        try {
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `delivery_proofs/${selectedOrder.order_code}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('delivery_proofs')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('delivery_proofs')
                    .getPublicUrl(filePath);

                newImages.push(publicUrl);
            }
            setUploadedImages(newImages);
            toast.success('🎉 Đã tải lên ' + files.length + ' ảnh!');
        } catch (error) {
            console.error('Error uploading images:', error);
            toast.error('❌ Lỗi tải ảnh: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    const confirmDelivery = async () => {
        if (!selectedOrder) return;
        
        if (deliveryStatus === 'TRA_HANG' && !notes.trim()) {
            toast.error('Vui lòng nhập lý do giao hàng chưa thành công!');
            return;
        }

        setIsLoading(true);
        try {
            const finalStatus = deliveryStatus; // HOAN_THANH or TRA_HANG
            const notePrefix = finalStatus === 'TRA_HANG' ? '[Lý do Giao Không Thành Công]: ' : '[Ghi chú Shipper]: ';
            const newNoteText = notes ? `\n${notePrefix}${notes}` : '';
            const uploadedProofText = finalStatus === 'HOAN_THANH' && uploadedImages.length > 0
                ? `\n[Ảnh giao hàng]: ${uploadedImages.join(', ')}`
                : '';
            const deliveryImageUrl = finalStatus === 'HOAN_THANH'
                ? (uploadedImages[0] || selectedOrder.delivery_image_url || null)
                : selectedOrder.delivery_image_url;

            const { error } = await supabase
                .from('orders')
                .update({
                    status: finalStatus,
                    delivery_image_url: deliveryImageUrl,
                    note: (selectedOrder.note || '') + newNoteText + uploadedProofText,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedOrder.id);

            if (error) throw error;

            toast.success(finalStatus === 'HOAN_THANH' ? '✅ Xác nhận giao hàng thành công!' : '⚠️ Đã báo cáo giao thất bại!');
            setIsConfirmModalOpen(false);
            setSelectedOrder(null);
            setUploadedImages([]);
            setNotes('');
            setDeliveryStatus('HOAN_THANH');
            fetchShippingOrders();
        } catch (error) {
            console.error('Error confirming delivery:', error);
            toast.error('❌ Lỗi xác nhận: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredOrders = orders.filter(order => 
        order.order_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.recipient_phone?.includes(searchTerm)
    );

    const kanbanByShipper = filteredOrders.reduce((acc, order) => {
        const shipperName = (order.delivery_unit || '').trim() || 'Chưa phân công';
        if (!acc[shipperName]) acc[shipperName] = [];
        acc[shipperName].push(order);
        return acc;
    }, {});

    const shipperColumns = Object.entries(kanbanByShipper).sort(([a], [b]) => a.localeCompare(b, 'vi'));

    const getStatusBadge = (status) => {
        switch (status) {
            case 'CHO_GIAO_HANG': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'DANG_GIAO_HANG': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'CHO_GIAO_HANG': return 'Chờ giao';
            case 'DANG_GIAO_HANG': return 'Đang giao';
            default: return status;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">Nhiệm vụ giao hàng</h1>
                </div>

                <div className="mb-3">
                    <PageViewSwitcher
                        activeView={activeView}
                        setActiveView={setActiveView}
                        views={[
                            { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                            { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={16} /> },
                        ]}
                    />
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Tìm mã đơn, khách hàng, SĐT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                {isLoading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <p className="text-slate-500 font-medium">Đang tải danh sách nhiệm vụ...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Truck size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Không có nhiệm vụ nào</h3>
                        <p className="text-slate-500 text-sm mt-1">Hiện tại không có đơn hàng nào cần giao cho bạn.</p>
                        <button 
                            onClick={fetchShippingOrders}
                            className="mt-6 text-primary font-bold text-sm bg-primary/10 px-6 py-2 rounded-full"
                        >
                            Tải lại trang
                        </button>
                    </div>
                ) : activeView === 'list' ? (
                    filteredOrders.map((order) => (
                        <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden active:scale-[0.98] transition-transform duration-200">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">#{order.order_code}</span>
                                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase', getStatusBadge(order.status))}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                    </div>
                                    <h3 className="text-[17px] font-extrabold text-slate-900 leading-tight">{order.recipient_name}</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-[15px] font-bold text-primary">
                                        {order.total_amount?.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-slate-400 mt-0.5" />
                                    <p className="text-sm text-slate-600 font-medium line-clamp-2">{order.recipient_address}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone size={16} className="text-slate-400" />
                                    <a href={`tel:${order.recipient_phone}`} className="text-sm text-primary font-bold">{order.recipient_phone}</a>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Package size={16} className="text-slate-400" />
                                    <p className="text-sm text-slate-600 font-medium">{order.product_type} - SL: {order.quantity}</p>
                                </div>
                                {order.note && (
                                    <div className="flex items-start gap-3 p-2 bg-amber-50 rounded-lg border border-amber-100">
                                        <AlertCircle size={14} className="text-amber-500 mt-0.5" />
                                        <p className="text-[12px] text-amber-700 italic">{order.note}</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                                <button 
                                    onClick={() => navigate('/thu-hoi-vo')}
                                    className="flex-1 bg-white border border-teal-200 text-teal-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:bg-teal-50"
                                >
                                    <RefreshCw size={18} />
                                    Thu hồi vỏ
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedOrder(order);
                                        setDeliveryStatus('HOAN_THANH');
                                        setNotes('');
                                        setUploadedImages([]);
                                        setIsConfirmModalOpen(true);
                                    }}
                                    className="flex-[1.5] bg-primary text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:bg-primary/90"
                                >
                                    <CheckCircle2 size={18} />
                                    Giao hàng
                                </button>
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.recipient_address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-10.5 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shadow-sm active:bg-slate-100"
                                >
                                    <MapPin size={20} />
                                </a>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="overflow-x-auto overflow-y-hidden">
                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                            {shipperColumns.map(([shipperName, shipperOrders]) => (
                                <div key={shipperName} className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0">
                                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                        <p className="text-[12px] font-bold text-slate-700 truncate pr-2">{shipperName}</p>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                                            {shipperOrders.length}
                                        </span>
                                    </div>
                                    <div className="p-2.5 space-y-2 overflow-y-auto min-h-0">
                                        {shipperOrders.map((order) => (
                                            <div
                                                key={order.id}
                                                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:bg-white hover:shadow-sm transition-all"
                                                onClick={() => {
                                                    setSelectedOrder(order);
                                                    setDeliveryStatus('HOAN_THANH');
                                                    setNotes('');
                                                    setUploadedImages([]);
                                                    setIsConfirmModalOpen(true);
                                                }}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-[12px] font-bold text-primary">#{order.order_code}</p>
                                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase', getStatusBadge(order.status))}>
                                                        {getStatusLabel(order.status)}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">{order.recipient_name || order.customer_name}</p>
                                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{order.recipient_phone || '—'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Xác nhận */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-500">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                            <h2 className="text-xl font-bold text-slate-900">Xác nhận giao hàng</h2>
                            <button onClick={() => setIsConfirmModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-5 overflow-y-auto space-y-6">
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Đơn hàng</p>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                    <p className="font-bold text-slate-800">#{selectedOrder.order_code} - {selectedOrder.recipient_name}</p>
                                    <p className="text-[12px] text-slate-500 mt-0.5">{selectedOrder.recipient_address}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Kết quả giao hàng</p>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setDeliveryStatus('HOAN_THANH')}
                                        className={clsx(
                                            "flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all text-sm",
                                            deliveryStatus === 'HOAN_THANH' ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <CheckCircle2 size={18} className={deliveryStatus === 'HOAN_THANH' ? "text-emerald-500" : ""} />
                                        Thành công
                                    </button>
                                    <button 
                                        onClick={() => setDeliveryStatus('TRA_HANG')}
                                        className={clsx(
                                            "flex-1 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all text-sm",
                                            deliveryStatus === 'TRA_HANG' ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <X size={18} className={deliveryStatus === 'TRA_HANG' ? "text-rose-500" : ""} />
                                        Chưa thành công
                                    </button>
                                </div>
                            </div>

                            {deliveryStatus === 'HOAN_THANH' && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Hình ảnh bằng chứng (Tùy chọn nhưng khuyến nghị)</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {uploadedImages.map((url, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-xl border border-slate-200 overflow-hidden bg-slate-100 group">
                                                <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="relative aspect-square">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                capture="environment" 
                                                multiple
                                                onChange={handleUploadImages}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="w-full h-full border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1.5 text-slate-400 group-hover:border-primary group-hover:text-primary transition-all bg-slate-50">
                                                {uploading ? <Loader2 size={20} className="animate-spin text-primary" /> : <Camera size={24} />}
                                                <span className="text-[10px] font-bold text-center leading-tight">Chụp ảnh<br/>giao hàng</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    {deliveryStatus === 'HOAN_THANH' ? 'Ghi chú (Tùy chọn)' : 'Lý do chưa thành công (Bắt buộc)'}
                                </p>
                                <textarea 
                                    rows={3} 
                                    placeholder={deliveryStatus === 'HOAN_THANH' ? 'Ghi thêm thông tin nếu cần...' : 'Vui lòng ghi rõ lý do không giao được hàng...'}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className={clsx(
                                        "w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all font-medium",
                                        deliveryStatus === 'TRA_HANG' && !notes.trim() ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-primary/20"
                                    )}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                            <button 
                                onClick={confirmDelivery}
                                disabled={isLoading || uploading}
                                className={clsx(
                                    "w-full text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 transition-all text-lg",
                                    deliveryStatus === 'HOAN_THANH' ? "bg-emerald-600 shadow-emerald-600/20 active:bg-emerald-700" : "bg-rose-600 shadow-rose-600/20 active:bg-rose-700"
                                )}
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={24} /> : (deliveryStatus === 'HOAN_THANH' ? <CheckCircle2 size={24} /> : <X size={24} />)}
                                {deliveryStatus === 'HOAN_THANH' ? 'Xác nhận Đã Giao Hàng' : 'Báo cáo Chưa Thành Công'}
                            </button>
                            <p className="text-center text-[11px] text-slate-400 mt-3 italic">
                                {deliveryStatus === 'HOAN_THANH' ? 'Trạng thái đơn hàng sẽ chuyển thành Hoàn thành.' : 'Đơn hàng sẽ được trả về kho (Trạng thái: Đơn hàng trả về).'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShippingTasks;
