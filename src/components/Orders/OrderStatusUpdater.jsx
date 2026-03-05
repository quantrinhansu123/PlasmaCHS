import { AlertCircle, AlertTriangle, CheckCircle, Clock, Plus, Truck, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { ORDER_STATE_TRANSITIONS, PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import OrderHistoryTimeline from './OrderHistoryTimeline';

export default function OrderStatusUpdater({ order, userRole, onClose, onUpdateSuccess }) {
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryUnit, setDeliveryUnit] = useState(order?.delivery_unit || '');
    const [selectedFile, setSelectedFile] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [scannedSerials, setScannedSerials] = useState('');
    const [activeTab, setActiveTab] = useState('actions');

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
            if (transition.nextStatus === 'DA_DUYET' && order.status === 'KHO_XU_LY' && order.product_type?.startsWith('BINH')) {
                const serials = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                if (serials.length !== order.quantity) {
                    throw new Error(`Bạn cần quét đúng ${order.quantity} mã bình. Hiện tại đã quét: ${serials.length}`);
                }

                // Cập nhật trạng thái vỏ bình sang đang vận chuyển
                const { data: updatedCylinders, error: cylError } = await supabase
                    .from('cylinders')
                    .update({ status: 'đang vận chuyển', customer_name: order.customer_name })
                    .in('serial_number', serials)
                    .select('id, serial_number');

                if (cylError) throw new Error('Cập nhật mã bình trên kho thất bại: ' + cylError.message);

                if (!updatedCylinders || updatedCylinders.length !== order.quantity) {
                    throw new Error(`Phát hiện mã bình không tồn tại! Chỉ cập nhật được ${updatedCylinders?.length || 0}/${order.quantity} bình. Vui lòng kiểm tra lại.`);
                }
            }

            if (transition.nextStatus === 'CHO_GIAO_HANG' && !deliveryUnit) {
                throw new Error('Vui lòng nhập tên Đơn vị vận chuyển.');
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

            // Nếu đây là lúc xuất kho (Gán mã bình)
            if (transition.nextStatus === 'DA_DUYET' && order.status === 'KHO_XU_LY' && order.product_type?.startsWith('BINH')) {
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
                            <div className="flex justify-between"><span className="text-gray-500 font-medium">Kho xuất:</span><span className="font-bold text-gray-900">{order.warehouse}</span></div>
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
                        {/* RFID Scanner for Warehouse */}
                        {(order.status === 'KHO_XU_LY') && order.product_type?.startsWith('BINH') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Quét mã vỏ bình RFID (Phải đúng <span className="text-blue-600">{order.quantity}</span> vỏ bình)
                                </label>
                                <textarea
                                    placeholder="Nhập mã hoặc dùng máy quét RFID, mỗi mã một dòng hoặc cách nhau dấu phẩy..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 min-h-[100px] shadow-sm transition-all"
                                    value={scannedSerials}
                                    onChange={e => setScannedSerials(e.target.value)}
                                />
                                <p className="text-xs text-gray-500 mt-1 font-medium italic">* Serials hợp lệ sẽ đổi ngay trạng thái sang <span className="font-bold">Đang vận chuyển</span></p>
                            </div>
                        )}

                        {/* Only show Shipper field if moving to Delivery or already in it and lacking one */}
                        {(order.status === 'DA_DUYET' || order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">
                                    Đơn vị Vận Chuyển
                                </label>
                                <div className="relative">
                                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Ví dụ: Giao Hàng Tiết Kiệm, Viettel Post"
                                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg font-medium outline-none focus:border-blue-500"
                                        value={deliveryUnit}
                                        onChange={e => setDeliveryUnit(e.target.value)}
                                        disabled={order.status !== 'DA_DUYET' && order.status !== 'CHO_GIAO_HANG'}
                                    />
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
        </div>
    );
}
