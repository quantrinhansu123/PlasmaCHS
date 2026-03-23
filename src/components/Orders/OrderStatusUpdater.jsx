import { AlertCircle, AlertTriangle, CheckCircle, Clock, Plus, ScanBarcode, Truck, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
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
                updated_at: new Date().toISOString()
            };

            // Calculate total amount if quantity changed
            if (order.status === 'KHO_XU_LY' && adjustedQuantity !== order.quantity) {
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

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Thao tác đơn hàng</h3>
                        <p className="text-sm font-medium text-gray-500">Mã: #{order.order_code}</p>
                    </div>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* Order Summary */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">Khách hàng:</span><span className="font-bold text-gray-900">{order.customer_name || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">Hàng hóa:</span><span className="font-bold text-gray-900">{PRODUCT_TYPES.find(p => p.id === order.product_type)?.label || order.product_type || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500 font-medium">Số lượng:</span><span className="font-bold text-gray-900">{order.quantity || 0}</span></div>
                        {order.department && (
                            <div className="flex justify-between"><span className="text-gray-500 font-medium">Mã máy:</span><span className="font-bold text-blue-700">{order.department}</span></div>
                        )}
                        {order.warehouse && (
                            <div className="flex justify-between"><span className="text-gray-500 font-medium">Kho xuất:</span><span className="font-bold text-gray-900">{warehouseName || order.warehouse}</span></div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-100 pb-3">
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'actions' ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Thao tác
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Clock className="w-3.5 h-3.5" /> Lịch sử
                        </button>
                    </div>

                    {activeTab === 'history' && (
                        <OrderHistoryTimeline orderId={order.id} />
                    )}

                    {activeTab === 'actions' && (<>
                        {/* Quantity Adjustment + RFID Scanner for Warehouse */}
                        {(order.status === 'KHO_XU_LY') && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">
                                        Số lượng duyệt xuất kho
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                                        value={adjustedQuantity}
                                        onChange={e => setAdjustedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                    {adjustedQuantity !== order.quantity && (
                                        <p className="text-xs text-orange-600 mt-1 font-semibold">* Số lượng đã điều chỉnh. Tổng tiền của đơn sẽ được tính toán lại sau khi lưu.</p>
                                    )}
                                </div>

                                {order.product_type?.startsWith('BINH') && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                                                <ScanBarcode className="w-5 h-5 text-blue-600 shrink-0" />
                                                <span>Quét mã vỏ bình RFID (Đúng <span className="text-blue-600">{adjustedQuantity}</span> bình)</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setIsScannerOpen(true)}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm ml-2 shrink-0"
                                            >
                                                <ScanBarcode className="w-4 h-4" /> Bật Camera quét
                                            </button>
                                        </div>
                                        <textarea
                                            placeholder="Nhập mã hoặc dùng máy quét RFID, mỗi mã một dòng..."
                                            className="w-full px-4 py-3 border border-gray-200 rounded-lg font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 min-h-[100px] shadow-sm transition-all"
                                            value={scannedSerials}
                                            onChange={e => setScannedSerials(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1 font-medium italic">* Có thể bỏ trống nếu để cho Đơn vị vận chuyển tự quét (Không khuyến khích).</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* RFID Scanner for Shipper (Nếu Kho chưa gán) */}
                        {((order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') &&
                            order.product_type?.startsWith('BINH') &&
                            (!order.assigned_cylinders || order.assigned_cylinders.length < order.quantity)) && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="flex items-center gap-1.5 text-sm font-bold text-orange-600">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <span>Kho chưa gán mã. Bạn cần quét đúng {order.quantity} vỏ bình:</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsScannerOpen(true)}
                                            className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-all flex items-center gap-1.5 shadow-sm ml-2 shrink-0"
                                        >
                                            <ScanBarcode className="w-4 h-4" /> Bật Camera quét
                                        </button>
                                    </div>
                                    <textarea
                                        placeholder="Quét mã RFID vào đây..."
                                        className="w-full px-4 py-3 border border-orange-200 rounded-lg font-medium outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 min-h-[100px] shadow-sm transition-all"
                                        value={scannedSerials}
                                        onChange={e => setScannedSerials(e.target.value)}
                                    />
                                </div>
                            )}

                        {/* Only show Shipper field if moving to Delivery or already in it and lacking one. Or show for KHO_XU_LY so warehouse can select early */}
                        {(order.status === 'KHO_XU_LY' || order.status === 'DA_DUYET' || order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Đơn vị Vận Chuyển {order.status === 'KHO_XU_LY' && <span className="text-red-500">*</span>}
                                </label>
                                <div className="relative">
                                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <select
                                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg font-medium outline-none focus:border-blue-500 appearance-none bg-white cursor-pointer"
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

                        {/* Image upload field if Shipper drops it off */}
                        {(order.status === 'DANG_GIAO_HANG' || order.status === 'CHO_DOI_SOAT' || order.status === 'HOAN_THANH') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Ảnh chứng từ (Đối soát với khách)
                                </label>

                                {order.delivery_image_url && !selectedFile ? (
                                    <div className="mt-2 text-sm text-green-600 font-medium break-all border p-2 rounded-lg bg-green-50 mb-4 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 shrink-0" /> Đã có ảnh chứng từ: <a href={order.delivery_image_url} target="_blank" rel="noreferrer" className="underline font-bold text-blue-600">Xem ảnh</a>
                                    </div>
                                ) : null}

                                {order.status === 'DANG_GIAO_HANG' && (
                                    <label className="mt-2 flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                        <div className="text-center">
                                            <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                            <span className="text-sm font-bold text-gray-600">
                                                {selectedFile ? selectedFile.name : 'Chạm để Upload ảnh lên'}
                                            </span>
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

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium whitespace-pre-line">
                                {errorMsg}
                            </div>
                        )}

                        {availableActions.length === 0 ? (
                            <div className="p-4 bg-gray-50 rounded-xl text-center text-sm font-medium text-gray-500 border border-gray-200">
                                Tài khoản của bạn ({userRole}) không có quyền thay đổi trạng thái hiện tại hoặc không có hành động nào tiếp theo.
                            </div>
                        ) : (
                            <div className="space-y-2 pt-2">
                                {availableActions.map(action => {
                                    let styleClass = "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200";
                                    let Icon = CheckCircle;

                                    if (action.nextStatus === 'DA_DUYET' || action.nextStatus === 'HOAN_THANH') {
                                        styleClass = "bg-green-50 text-green-700 hover:bg-green-100 border-green-200 shadow-sm shadow-green-100/50";
                                    } else if (action.nextStatus === 'DIEU_CHINH') {
                                        styleClass = "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200 shadow-sm shadow-orange-100/50";
                                        Icon = AlertTriangle;
                                    } else if (action.nextStatus === 'HUY_DON' || action.nextStatus === 'DOI_SOAT_THAT_BAI') {
                                        styleClass = "bg-red-50 text-red-600 hover:bg-red-100 border-red-200 shadow-sm shadow-red-100/50";
                                        Icon = Plus; // cross
                                    } else {
                                        styleClass = "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 shadow-sm shadow-blue-100/50";
                                    }

                                    return (
                                        <button
                                            key={action.nextStatus}
                                            onClick={() => handleUpdateStatus(action)}
                                            disabled={isLoading}
                                            className={`w-full p-4 flex items-center justify-center gap-3 font-bold rounded-xl transition-all border ${styleClass} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isLoading ? (
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Icon className={`w-5 h-5 ${action.nextStatus === 'HUY_DON' || action.nextStatus === 'DOI_SOAT_THAT_BAI' ? 'rotate-45' : ''}`} />
                                            )}
                                            {action.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </>)}
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto shrink-0 space-y-2">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full py-3 text-gray-500 font-bold text-sm bg-white hover:bg-gray-50 transition-colors rounded-lg border border-gray-200 shadow-sm"
                    >
                        Trở quay lại bảng
                    </button>
                </div>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title={`Quét mã RFID (${order.status === 'KHO_XU_LY' ? 'Xuất kho' : 'Giao hàng'})`}
                allowDuplicateScans={false}
                currentCount={scannedSerials.split(/[\n, ]+/).map(s => s.trim()).filter(Boolean).length}
                totalCount={order.status === 'KHO_XU_LY' ? adjustedQuantity : order.quantity}
            />
        </div>
    );
}
