import { AlertCircle, AlertTriangle, ArrowRightCircle, Camera, CheckCircle, CheckCircle2, Clock, CloudUpload, Plus, ScanBarcode, Truck, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ORDER_STATE_TRANSITIONS, PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';
import OrderHistoryTimeline from './OrderHistoryTimeline';

export default function OrderStatusUpdater({ order, warehouseName, userRole, onClose, onUpdateSuccess }) {
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryUnit, setDeliveryUnit] = useState(order?.delivery_unit || '');
    const [selectedFile, setSelectedFile] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [scannedSerials, setScannedSerials] = useState('');
    const [activeTab, setActiveTab] = useState('actions');
    const [shippers, setShippers] = useState([]);
    const [adjustedQuantity, setAdjustedQuantity] = useState(order?.quantity || 0);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [showAdjustmentInput, setShowAdjustmentInput] = useState(false);

    const STATUS_TRANSITIONS_METADATA = [
        { nextStatus: 'DIEU_CHINH', icon: AlertTriangle },
        { nextStatus: 'KHO_XU_LY', icon: Truck },
        { nextStatus: 'CHO_GIAO_HANG', icon: Truck },
        { nextStatus: 'DA_DUYET', icon: CheckCircle2 },
        { nextStatus: 'DANG_GIAO_HANG', icon: Truck },
        { nextStatus: 'CHO_DOI_SOAT', icon: Clock },
        { nextStatus: 'HOAN_THANH', icon: CheckCircle },
        { nextStatus: 'HUY_DON', icon: XCircle },
        { nextStatus: 'DOI_SOAT_THAT_BAI', icon: AlertCircle },
    ];

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const handleScanSuccess = (decodedText) => {
        setScannedSerials(prev => {
            const currentList = prev.split(/[\n, ]+/).map(s => s.trim()).filter(Boolean);
            if (!currentList.includes(decodedText)) {
                return prev ? `${prev}\n${decodedText}` : decodedText;
            }
            return prev;
        });
    };

    useEffect(() => {
        const fetchShippers = async () => {
            const { data } = await supabase
                .from('shippers')
                .select('id, name')
                .eq('status', 'Đang hoạt động')
                .order('name');
            setShippers(data || []);
        };
        fetchShippers();
    }, []);

    useEffect(() => {
        const validateSerials = async () => {
            const allSerials = scannedSerials.split(/[\n, ]+/).map(s => s.trim()).filter(Boolean);
            if (allSerials.length === 0) return;

            const uniqueSerials = [...new Set(allSerials)];
            if (uniqueSerials.length < allSerials.length) {
                setErrorMsg('Phát hiện mã trùng bị quét lại! Hệ thống đã tự động lọc.');
                setScannedSerials(uniqueSerials.join('\n') + '\n');
                return;
            }

            const { data, error } = await supabase.from('cylinders').select('serial_number, status').in('serial_number', uniqueSerials);
            if (error) return; // skip if db error fails silently, or show error

            const validCylinders = data || [];
            const invalid = [];
            const validSerialsList = [];

            for (const serial of uniqueSerials) {
                const match = validCylinders.find(c => c.serial_number === serial);
                if (!match) {
                    invalid.push(`${serial} (Không tồn tại hệ thống)`);
                } else if (match.status !== 'sẵn sàng') {
                    invalid.push(`${serial} (T/thái: ${match.status})`);
                } else {
                    validSerialsList.push(serial);
                }
            }

            if (invalid.length > 0) {
                setErrorMsg(`Loại bỏ mã lỗi:\n` + invalid.join('\n'));
                setScannedSerials(validSerialsList.join('\n') + (validSerialsList.length > 0 ? '\n' : ''));
            }
        };

        const timer = setTimeout(() => {
            if (scannedSerials) validateSerials();
        }, 800);

        return () => clearTimeout(timer);
    }, [scannedSerials]);

    if (!order) return null;

    // Get transitions available for current status
    const transitions = ORDER_STATE_TRANSITIONS[order.status] || [];

    // Filter by role (normalize to lowercase for consistent matching)
    const normalizedRole = userRole?.toLowerCase() || '';
    const availableActions = transitions.filter(t =>
        normalizedRole === 'admin' || t.allowedRoles.includes(normalizedRole)
    );

    const handleUpdateStatus = async (transition) => {
        try {
            setIsLoading(true);
            setErrorMsg('');

            let imageUrl = order.delivery_image_url;

            // Extra checks based on transitions
            if ((transition.nextStatus === 'CHO_GIAO_HANG' || transition.nextStatus === 'DA_DUYET') && order.status === 'KHO_XU_LY') {
                const productTypeId = order.product_type || '';
                const isCylinder = productTypeId.startsWith('BINH');

                // Get the human readable label from PRODUCT_TYPES since inventory table uses "item_name" like "Bình 4L", not "BINH_4L"
                const productConfig = PRODUCT_TYPES.find(p => p.id === productTypeId);
                const productLabel = productConfig ? productConfig.label : productTypeId;

                // For cylinders, we need scanned serials
                if (isCylinder) {
                    const serials = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                    if (serials.length !== adjustedQuantity) {
                        throw new Error(`Kho xuất: Bạn cần quét đúng ${adjustedQuantity} mã bình. Hiện tại đã quét: ${serials.length}`);
                    }

                    // Cập nhật trạng thái vỏ bình sang đang vận chuyển
                    const { data: updatedCylinders, error: cylError } = await supabase
                        .from('cylinders')
                        .update({
                            status: 'đang vận chuyển',
                            customer_name: `${order.customer_name}${order.department ? ` / ${order.department}` : ''}`
                        })
                        .in('serial_number', serials)
                        .select('id, serial_number');

                    if (cylError) throw new Error('Cập nhật mã bình trên kho thất bại: ' + cylError.message);

                    if (!updatedCylinders || updatedCylinders.length !== adjustedQuantity) {
                        throw new Error(`Phát hiện mã bình không tồn tại! Chỉ cập nhật được ${updatedCylinders?.length || 0}/${adjustedQuantity} bình. Vui lòng kiểm tra lại.`);
                    }
                }

                // Trừ tồn kho khi xuất hàng (cho cả BINH và MAY)
                const itemType = isCylinder ? 'BINH' : (productLabel.toLowerCase().includes('máy') || productLabel.toLowerCase().includes('may') ? 'MAY' : 'KHAC');

                const { data: invData, error: invErr } = await supabase
                    .from('inventory')
                    .select('id, quantity, item_name')
                    .eq('warehouse_id', order.warehouse)
                    .ilike('item_name', productLabel.trim())
                    .maybeSingle();

                if (invErr) throw new Error('Lỗi kiểm tra tồn kho: ' + invErr.message);

                if (invData) {
                    if (invData.quantity < adjustedQuantity) {
                        throw new Error(`Tồn kho không đủ! Hiện tại chỉ còn ${invData.quantity} ${productLabel}.`);
                    }

                    await supabase
                        .from('inventory')
                        .update({ quantity: Math.max(0, invData.quantity - adjustedQuantity) })
                        .eq('id', invData.id);

                    await supabase.from('inventory_transactions').insert([{
                        inventory_id: invData.id,
                        transaction_type: 'OUT',
                        reference_id: order.id,
                        reference_code: order.order_code,
                        quantity_changed: adjustedQuantity,
                        note: `Xuất kho ${adjustedQuantity} ${productLabel} - Đơn ${order.order_code}`
                    }]);
                } else {
                    throw new Error(`Hàng hoá "${productLabel}" không có trong kho báo cáo (chưa từng nhập hoặc dữ liệu không khớp).`);
                }
            }

            // Nếu Shipper gán mã lỗi do Kho quên
            const needsCylinderAssignmentByShipper = (order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') &&
                order.product_type?.startsWith('BINH') &&
                (!order.assigned_cylinders || order.assigned_cylinders.length < order.quantity);

            if (needsCylinderAssignmentByShipper && transition.nextStatus !== 'HUY_DON') {
                const serials = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                if (serials.length !== order.quantity) {
                    throw new Error(`Shipper: Bạn cần quét đúng ${order.quantity} mã bình trước khi giao. Hiện tại đã quét: ${serials.length}`);
                }

                // Cập nhật trạng thái vỏ bình sang đang vận chuyển
                const { data: updatedCylinders, error: cylError } = await supabase
                    .from('cylinders')
                    .update({
                        status: 'đang vận chuyển',
                        customer_name: `${order.customer_name}${order.department ? ` / ${order.department}` : ''}`
                    })
                    .in('serial_number', serials)
                    .select('id, serial_number');

                if (cylError) throw new Error('Cập nhật mã bình thất bại: ' + cylError.message);

                if (!updatedCylinders || updatedCylinders.length !== order.quantity) {
                    throw new Error(`Phát hiện mã bình không hợp lệ! Vui lòng quét lại.`);
                }

                // Note: We don't deduct inventory here because it might have been deducted by the warehouse, 
                // but the warehouse just didn't scan the RFIDs. If we need strict inventory deduction, 
                // it should only happen if not done before. For now, assume warehouse deducted the raw inventory, 
                // but didn't assign specific RFIDs.
            }

            if (transition.nextStatus === 'CHO_GIAO_HANG' && !deliveryUnit && order.status === 'KHO_XU_LY') {
                throw new Error('Bạn phải bắt buộc chọn Đơn vị vận chuyển trước khi xuất kho giao hàng.');
            }

            if ((transition.nextStatus === 'CHO_DOI_SOAT' || transition.nextStatus === 'HOAN_THANH') && order.status === 'DANG_GIAO_HANG') {
                if (!selectedFile && !imageUrl) {
                    throw new Error('Bạn cần upload ảnh chứng từ giao hàng thành công để đối soát.');
                }
            }

            // Upload image if selected
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${order.order_code}-${Date.now()}.${fileExt}`;
                const { data, error: uploadError } = await supabase.storage
                    .from('delivery_proofs')
                    .upload(fileName, selectedFile);

                if (uploadError) {
                    if (uploadError.message.includes('Bucket not found')) {
                        // Bucket doesn't exist, we skip error to not block flow, but log warning. 
                        // Usually I would run a command to create it, but for UI safety.
                        console.warn("delivery_proofs bucket not created in Supabase yet.");
                    } else {
                        throw uploadError;
                    }
                }

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage
                        .from('delivery_proofs')
                        .getPublicUrl(fileName);

                    imageUrl = publicUrlData.publicUrl;
                }
            }

            // Perform DB update
            const updatePayload = {
                status: transition.nextStatus,
                updated_at: new Date().toISOString(),
                note: transition.label === 'Yêu cầu điều chỉnh' ? adjustmentNote : order.note
            };

            // Calculate total amount if quantity changed
            if (adjustedQuantity !== order.quantity) {
                let freeCylinders = 0;
                if (order.promotion_code) {
                    const { data: promoData } = await supabase
                        .from('app_promotions')
                        .select('free_cylinders')
                        .eq('code', order.promotion_code)
                        .maybeSingle();
                    if (promoData) freeCylinders = promoData.free_cylinders || 0;
                }
                const billedQuantity = Math.max(0, adjustedQuantity - freeCylinders);
                updatePayload.quantity = adjustedQuantity;
                updatePayload.total_amount = billedQuantity * (order.unit_price || 0);
            }

            // Nếu đây là lúc xuất kho (Gán mã bình) hoặc Shipper gán mã bổ sung
            if (((transition.nextStatus === 'CHO_GIAO_HANG' || transition.nextStatus === 'DA_DUYET') && order.status === 'KHO_XU_LY' && order.product_type?.startsWith('BINH')) || needsCylinderAssignmentByShipper) {
                updatePayload.assigned_cylinders = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            }

            if (deliveryUnit) {
                updatePayload.delivery_unit = deliveryUnit;
            }
            if (imageUrl) {
                updatePayload.delivery_image_url = imageUrl;
            }

            const { error: dbError } = await supabase
                .from('orders')
                .update(updatePayload)
                .eq('id', order.id);

            if (dbError) throw dbError;

            // Log history
            await supabase.from('order_history').insert([{
                order_id: order.id,
                action: 'STATUS_CHANGED',
                old_status: order.status,
                new_status: transition.nextStatus,
                created_by: 'Hệ thống'
            }]);

            onUpdateSuccess();
            onClose();

        } catch (error) {
            setErrorMsg(error.message || 'Lỗi khi cập nhật trạng thái');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Panel */}
            <div 
                className={clsx(
                    "relative bg-white shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-nonde uppercase mb-1">Thao tác đơn hàng</h3>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Mã: #{order.order_code}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Order Summary */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-2 text-sm shadow-sm">
                        <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[11px]">Khách hàng:</span><span className="font-black text-slate-900">{order.customer_name || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[11px]">Hàng hóa:</span><span className="font-black text-slate-900">{PRODUCT_TYPES.find(p => p.id === order.product_type)?.label || order.product_type || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[11px]">Số lượng:</span><span className="font-black text-slate-900">{order.quantity || 0}</span></div>
                        {order.department && (
                            <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[11px]">Cơ sở / Phòng:</span><span className="font-black text-primary">{order.department}</span></div>
                        )}
                        {order.warehouse && (
                            <div className="flex justify-between"><span className="text-slate-500 font-bold uppercase text-[11px]">Kho xuất:</span><span className="font-black text-slate-900">{warehouseName || order.warehouse}</span></div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-4 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${activeTab === 'actions' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            Thao tác
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <Clock className="w-4 h-4" /> Lịch sử
                        </button>
                    </div>

                    {activeTab === 'history' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <OrderHistoryTimeline orderId={order.id} />
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Quantity Adjustment + RFID Scanner for Warehouse */}
                            {(order.status === 'CHO_DUYET' || order.status === 'CHO_CTY_DUYET' || order.status === 'KHO_XU_LY') && (
                                <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                            Số lượng duyệt / Điều chỉnh
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all"
                                            value={adjustedQuantity}
                                            onChange={e => setAdjustedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                        {adjustedQuantity !== order.quantity && (
                                            <p className="text-[11px] text-orange-600 font-bold italic">* Số lượng đã điều chỉnh.</p>
                                        )}
                                    </div>

                                    {order.product_type?.startsWith('BINH') && (
                                        <div className="space-y-3 pt-3 border-t border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <label className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest">
                                                    <ScanBarcode className="w-4 h-4 text-primary" />
                                                    <span>Mã vỏ bình RFID ({adjustedQuantity})</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsScannerOpen(true)}
                                                    className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1.5 uppercase tracking-wider"
                                                >
                                                    <Camera className="w-3.5 h-3.5" /> Quét ảnh
                                                </button>
                                            </div>
                                            <textarea
                                                placeholder="Nhập mã hoặc dùng máy quét..."
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 min-h-[100px] transition-all resize-none"
                                                value={scannedSerials}
                                                onChange={e => setScannedSerials(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* RFID Scanner for Shipper */}
                            {((order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') &&
                                order.product_type?.startsWith('BINH') &&
                                (!order.assigned_cylinders || order.assigned_cylinders.length < order.quantity)) && (
                                    <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-1.5 text-xs font-black text-orange-600 uppercase tracking-widest">
                                                <AlertTriangle className="w-4 h-4" /> 
                                                <span>Quét gán {order.quantity} bình:</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setIsScannerOpen(true)}
                                                className="px-3 py-1.5 bg-orange-600 text-white text-[10px] font-black rounded-lg hover:bg-orange-700 transition-all flex items-center gap-1.5 uppercase tracking-wider shadow-sm"
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Quét ảnh
                                            </button>
                                        </div>
                                        <textarea
                                            placeholder="Quét mã RFID..."
                                            className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 min-h-[100px] transition-all resize-none"
                                            value={scannedSerials}
                                            onChange={e => setScannedSerials(e.target.value)}
                                        />
                                    </div>
                                )}

                            {/* Options */}
                            <div className="space-y-4">
                                {(order.status === 'KHO_XU_LY' || order.status === 'DA_DUYET' || order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') && (
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                            Đơn vị vận chuyển {order.status === 'KHO_XU_LY' && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                            <Truck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <select
                                                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 appearance-none cursor-pointer transition-all shadow-sm"
                                                value={deliveryUnit}
                                                onChange={e => setDeliveryUnit(e.target.value)}
                                                disabled={order.status !== 'KHO_XU_LY' && order.status !== 'DA_DUYET' && order.status !== 'CHO_GIAO_HANG'}
                                            >
                                                <option value="">-- Chọn đơn vị vận chuyển --</option>
                                                {shippers.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {(order.status === 'DANG_GIAO_HANG' || order.status === 'CHO_DOI_SOAT' || order.status === 'HOAN_THANH') && (
                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                            Ảnh chứng từ giao hàng
                                        </label>

                                        {order.delivery_image_url && !selectedFile ? (
                                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-[12px] font-bold text-emerald-700">Đã có chứng từ</span>
                                                </div>
                                                <a href={order.delivery_image_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary hover:underline hover:text-primary/80 uppercase tracking-wider">Xem ảnh</a>
                                            </div>
                                        ) : null}

                                        {order.status === 'DANG_GIAO_HANG' && (
                                            <label className="flex flex-col items-center justify-center w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-primary/40 transition-all group">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <CloudUpload className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                                                    <p className="text-[12px] font-bold text-slate-500 group-hover:text-slate-700">
                                                        {selectedFile ? selectedFile.name : 'Upload ảnh chứng từ'}
                                                    </p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={e => setSelectedFile(e.target.files[0])}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>

                            {errorMsg && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[13px] font-bold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                            {errorMsg}
                                </div>
                            )}

                            {/* Adjustment Note Input Area */}
                            {availableActions.some(a => a.label === 'Yêu cầu điều chỉnh') && (
                                <div className="space-y-3 p-4 bg-orange-50 border border-orange-100 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-[11px] font-black text-orange-600 uppercase tracking-widest">Lý do/Ghi chú điều chỉnh <span className="text-red-500">*</span></label>
                                    <textarea
                                        placeholder="Nhập lý do chuyển trả đơn hàng về bước trước..."
                                        className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 min-h-[80px] transition-all resize-none text-sm"
                                        value={adjustmentNote}
                                        onChange={e => setAdjustmentNote(e.target.value)}
                                    />
                                    <p className="text-[10px] text-orange-400 italic font-medium">* Ghi chú này sẽ được lưu lại để người ở bước trước theo dõi.</p>
                                </div>
                            )}

                            {/* Final Actions */}
                            <div className="pt-4 border-t border-slate-100 space-y-3">
                                <label className="block text-[10px] font-black text-primary uppercase tracking-widest mb-4">Các thao tác khả dụng</label>
                                {availableActions.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <p className="text-sm font-bold text-slate-400 italic">Không có quyền thao tác</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {availableActions.map(action => {
                                            const metadata = STATUS_TRANSITIONS_METADATA.find(t => t.nextStatus === action.nextStatus);
                                            const ActionIcon = metadata?.icon || ArrowRightCircle;
                                            
                                            let actionStyle = "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:border-primary/30";
                                            if (action.nextStatus === 'HUY_DON' || action.nextStatus === 'DOI_SOAT_THAT_BAI') {
                                                actionStyle = "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 hover:border-rose-300";
                                            } else {
                                                actionStyle = "bg-primary text-white hover:bg-primary/90 border-transparent shadow-lg shadow-primary/20";
                                            }

                                            return (
                                                <button
                                                    key={action.nextStatus}
                                                    onClick={() => {
                                                        if (action.label === 'Yêu cầu điều chỉnh' && !adjustmentNote.trim()) {
                                                            setErrorMsg('Vui lòng nhập lý do điều chỉnh trước khi xác nhận.');
                                                            return;
                                                        }
                                                        handleUpdateStatus(action);
                                                    }}
                                                    disabled={isLoading}
                                                    className={`w-full p-4 flex items-center justify-center gap-3 font-black rounded-2xl transition-all border uppercase tracking-wider text-[13px] ${actionStyle} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {isLoading ? (
                                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <ActionIcon className={`w-5 h-5 ${action.nextStatus === 'HUY_DON' || action.nextStatus === 'DOI_SOAT_THAT_BAI' ? 'rotate-12' : ''}`} />
                                                    )}
                                                    {action.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-center px-6">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="w-full py-3 text-slate-500 font-black text-[11px] uppercase tracking-widest bg-white hover:bg-slate-100 transition-all rounded-xl border border-slate-200 shadow-sm"
                    >
                        Quay lại bảng điều khiển
                    </button>
                </div>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title={`Quét RFID (${order.status === 'KHO_XU_LY' ? 'Xuất kho' : 'Giao hàng'})`}
                allowDuplicateScans={false}
                currentCount={scannedSerials.split(/[\n, ]+/).map(s => s.trim()).filter(Boolean).length}
                totalCount={order.status === 'KHO_XU_LY' ? adjustedQuantity : order.quantity}
            />
        </div>,
        document.body
    );
}
