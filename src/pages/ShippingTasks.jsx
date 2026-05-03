import React, { useState, useEffect, useCallback } from 'react';
import {
    Truck,
    CheckCircle2,
    Camera,
    X,
    ChevronLeft,
    Search,
    PackageCheck,
    Loader2,
    LayoutGrid,
    List,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import usePermissions from '../hooks/usePermissions';
import { isShipperRole, isAdminRole } from '../utils/accessControl';
import {
    collectMachineSerialsForOrder,
    resolvedOrderCustomerAssetName,
} from '../utils/orderMachineSerials';
/** Chỉ các đơn này còn được mở modal «Xác nhận giao hàng». */
const ORDER_STATUSES_NEED_DELIVERY_CONFIRM = ['CHO_GIAO_HANG', 'DANG_GIAO_HANG'];

/** Luồng giao/trả/đối soát đang và đã qua tay giao — chưa bao gồm HOAN_THANH (đơn có gán đơn vị giao mới vào được). */
const ORDER_STATUSES_PIPELINE_NO_SUCCESS_PREFIX = ['CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'CHO_DOI_SOAT', 'DOI_SOAT_THAT_BAI', 'TRA_HANG'];

const giaoHangActionBtnCls =
    'shrink-0 rounded-lg border border-primary bg-primary px-3 py-2 text-[11px] font-bold text-white shadow-sm hover:opacity-95 !h-auto !min-h-0';

/** Chỉ đơn giao hàng (`orders`) — không gộp phiếu thu hồi vỏ. */
const ShippingTasks = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const focusOrderId = searchParams.get('focusOrderId');
    const { role } = usePermissions();
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
    const [machineChecklist, setMachineChecklist] = useState({});
    /** Dòng order_items của đơn đang mở modal giao — cần để gom mã máy giống OrderStatusUpdater */
    const [shippingOrderItems, setShippingOrderItems] = useState([]);
    useEffect(() => {
        fetchShippingTasks();
    }, [role]);

    const fetchShippingTasks = async () => {
        setIsLoading(true);
        try {
            const storageUserName =
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                '';
            const shipperOnly = isShipperRole(role) && !isAdminRole(role);

            const shipperKey = String(storageUserName || '').trim();
            const pipelineCsv = ORDER_STATUSES_PIPELINE_NO_SUCCESS_PREFIX.join(',');
            /** Admin/giám sát: không tải mọi đơn HOAN_THANH toàn DB — chỉ đơn từng gán đơn vị giao. Shipper luôn lọc theo delivery_unit (kể cả đã HOAN_THANH). */
            let orderQuery = supabase.from('orders').select('*');
            if (shipperOnly) {
                orderQuery = orderQuery
                    .in('status', [...ORDER_STATUSES_PIPELINE_NO_SUCCESS_PREFIX, 'HOAN_THANH'])
                    .eq('delivery_unit', shipperKey || '__NO_SHIPPER_NAME__');
            } else {
                orderQuery = orderQuery.or(
                    `status.in.(${pipelineCsv}),and(status.eq.HOAN_THANH,delivery_unit.not.is.null)`,
                );
            }
            orderQuery = orderQuery.order('created_at', { ascending: false });
            const { data: orderData, error: orderError } = await orderQuery;
            if (orderError) throw orderError;

            setOrders(orderData || []);
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
        const fileToDataUrl = (file) =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

        try {
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `delivery_proofs/${selectedOrder.order_code}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('delivery_proofs')
                    .upload(filePath, file);

                if (uploadError) {
                    if (String(uploadError.message || '').includes('Bucket not found')) {
                        const dataUrl = await fileToDataUrl(file);
                        if (dataUrl) {
                            newImages.push(dataUrl);
                            continue;
                        }
                    }
                    throw uploadError;
                }

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

    const toUuidOrNull = (value) => {
        const raw = String(value || '').trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
    };

    /** Checklist MAY: trên đơn (web đơn) + order_items đã tải */
    const resolveMachineSerialsForShippingConfirm = (order, items) => {
        const rawCl =
            order?.delivery_checklist && typeof order.delivery_checklist === 'object'
                ? order.delivery_checklist
                : {};
        return collectMachineSerialsForOrder(order, items, rawCl);
    };

    const openDeliveryConfirmModal = useCallback(async (order) => {
        try {
            const { data, error } = await supabase
                .from('order_items')
                .select('order_id, product_type, serial_number')
                .eq('order_id', order.id);
            if (error) throw error;
            const items = data || [];
            setShippingOrderItems(items);
            setSelectedOrder(order);
            setDeliveryStatus('HOAN_THANH');
            setNotes('');
            setUploadedImages([]);
            const serials = resolveMachineSerialsForShippingConfirm(order, items);
            const initialChecklist = {};
            serials.forEach((serial) => {
                initialChecklist[serial] = false;
            });
            setMachineChecklist(initialChecklist);
            setIsConfirmModalOpen(true);
        } catch (e) {
            console.error(e);
            toast.error('❌ Không tải được chi tiết đơn để xác nhận mã máy: ' + (e?.message || ''));
        }
    }, []);

    /** Mở modal giao từ URL (?focusOrderId=) khi bấm «Giao hàng» trên trang Đơn hàng. */
    useEffect(() => {
        if (!focusOrderId || isLoading) return;
        const order = orders.find((o) => String(o.id) === String(focusOrderId));
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('focusOrderId');
                return next;
            },
            { replace: true },
        );
        if (order) {
            setActiveView('list');
            if (ORDER_STATUSES_NEED_DELIVERY_CONFIRM.includes(order.status)) {
                void openDeliveryConfirmModal(order);
            } else {
                toast.info(
                    'Đơn đã không còn ở bước xác nhận giao; vẫn hiển thị trong danh sách để tra cứu.',
                );
            }
        } else if (orders.length > 0) {
            toast.info('Đơn không nằm trong danh sách nhiệm vụ giao (trạng thái hoặc phân quyền tài xế).');
        }
    }, [focusOrderId, isLoading, orders, setSearchParams, openDeliveryConfirmModal]);

    const parseCylinderSerialsFromOrder = (order) => {
        const fromAssigned = Array.isArray(order?.assigned_cylinders)
            ? order.assigned_cylinders.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
            : [];

        const checklist = order?.delivery_checklist && typeof order.delivery_checklist === 'object'
            ? Object.keys(order.delivery_checklist)
            : [];
        const fromChecklist = checklist
            .filter((key) => String(key || '').startsWith('BINH:'))
            .map((key) => String(key).split(':')[1] || '')
            .map((serial) => serial.trim().toUpperCase())
            .filter(Boolean);

        return [...new Set([...fromAssigned, ...fromChecklist])];
    };

    const confirmDelivery = async () => {
        if (!selectedOrder) return;
        const machineSerialsForConfirm = resolveMachineSerialsForShippingConfirm(
            selectedOrder,
            shippingOrderItems,
        );
        
        if (deliveryStatus === 'TRA_HANG' && !notes.trim()) {
            toast.error('Vui lòng nhập lý do giao hàng chưa thành công!');
            return;
        }
        if (deliveryStatus === 'HOAN_THANH' && machineSerialsForConfirm.length > 0) {
            const uncheckedMachines = machineSerialsForConfirm.filter((serial) => !machineChecklist[serial]);
            if (uncheckedMachines.length > 0) {
                toast.error(`Vui lòng tích xác nhận đủ mã máy trước khi hoàn tất (${uncheckedMachines.length} mã chưa tích).`);
                return;
            }
        }

        setIsLoading(true);
        try {
            /**
             * Giao thành công: luôn chốt HOAN_THANH (kể cả khi đang CHO_GIAO_HANG).
             * Chuỗi “Cho giao → Đang giao” một bước khiến finalStatus không bao giờ là HOAN_THANH,
             * nên không chạy cập nhật máy/bình — shipper có ảnh + đã tick mã là xác nhận giao xong.
             */
            const finalStatus =
                deliveryStatus !== 'HOAN_THANH' ? 'TRA_HANG' : 'HOAN_THANH';
            const notePrefix = finalStatus === 'TRA_HANG' ? '[Lý do Giao Không Thành Công]: ' : '[Ghi chú Shipper]: ';
            const newNoteText = notes ? `\n${notePrefix}${notes}` : '';
            const uploadedProofText = finalStatus === 'HOAN_THANH' && uploadedImages.length > 0
                ? `\n[Ảnh giao hàng]: ${uploadedImages.join(', ')}`
                : '';
            const deliveryImageUrl = finalStatus === 'HOAN_THANH'
                ? (uploadedImages[0] || selectedOrder.delivery_image_url || null)
                : selectedOrder.delivery_image_url;
            const deliveryProofBase64 = finalStatus === 'HOAN_THANH' && String(uploadedImages[0] || '').startsWith('data:image')
                ? uploadedImages[0]
                : (selectedOrder.delivery_proof_base64 || null);

            /** Gộp tick máy shipper vào JSON (đồng bộ với OrderStatusUpdater / parseCylinderSerialsFromOrder). */
            let nextDeliveryChecklist =
                selectedOrder.delivery_checklist && typeof selectedOrder.delivery_checklist === 'object'
                    ? { ...selectedOrder.delivery_checklist }
                    : {};
            if (finalStatus === 'HOAN_THANH' && machineSerialsForConfirm.length > 0) {
                machineSerialsForConfirm.forEach((sn) => {
                    if (machineChecklist[sn]) {
                        nextDeliveryChecklist[`MAY:${sn}`] = true;
                    }
                });
            }

            const orderUpdatePayload = {
                status: finalStatus,
                delivery_image_url: deliveryImageUrl,
                delivery_proof_base64: deliveryProofBase64,
                note: (selectedOrder.note || '') + newNoteText + uploadedProofText,
                updated_at: new Date().toISOString(),
                ...(finalStatus === 'HOAN_THANH' && Object.keys(nextDeliveryChecklist).length > 0
                    ? { delivery_checklist: nextDeliveryChecklist }
                    : {}),
            };

            const { data: updatedRows, error } = await supabase
                .from('orders')
                .update(orderUpdatePayload)
                .eq('id', selectedOrder.id)
                .select('id, status, order_code');

            if (error) throw error;

            const saved = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
            if (!saved || saved.status !== finalStatus) {
                throw new Error(
                    saved
                        ? `Đơn không chuyển đúng trạng thái (mong: ${finalStatus}, lưu: ${saved.status}). Kiểm tra quyền DB/RLS.`
                        : 'Không cập nhật được đơn (không có bản ghi trả về sau khi lưu). Kiểm tra quyền hoặc RLS trên bảng orders.',
                );
            }

            if (finalStatus === 'HOAN_THANH') {
                const cylinderSerials = parseCylinderSerialsFromOrder(selectedOrder);
                const machineSerials = resolveMachineSerialsForShippingConfirm(
                    selectedOrder,
                    shippingOrderItems,
                );

                if (cylinderSerials.length > 0) {
                    const cylCust = resolvedOrderCustomerAssetName(selectedOrder);
                    const { error: cylinderErr } = await supabase
                        .from('cylinders')
                        .update({
                            status: 'thuộc khách hàng',
                            customer_name: cylCust,
                            updated_at: new Date().toISOString()
                        })
                        .in('serial_number', cylinderSerials);
                    if (cylinderErr) throw cylinderErr;
                }

                if (machineSerials.length > 0) {
                    const custName = resolvedOrderCustomerAssetName(selectedOrder);
                    const { error: machineErr } = await supabase
                        .from('machines')
                        .update({
                            status: 'thuộc khách hàng',
                            customer_name: custName,
                            warehouse: null,
                            updated_at: new Date().toISOString()
                        })
                        .in('serial_number', machineSerials);
                    if (machineErr) throw machineErr;

                    const actorName =
                        localStorage.getItem('user_name') ||
                        sessionStorage.getItem('user_name') ||
                        'Shipper';
                    const machineLogs = machineSerials.map((serial) => ({
                        serial_number: serial,
                        warehouse_id: toUuidOrNull(selectedOrder?.warehouse),
                        action: 'MAY_GIAO_SHIPPER',
                        description: `Đơn ${selectedOrder.order_code}: Shipper xác nhận giao thành công, máy thuộc khách hàng. Người thực hiện: ${actorName}`
                    }));
                    const { error: machineLogErr } = await supabase.from('cylinder_logs').insert(machineLogs);
                    if (machineLogErr) throw machineLogErr;
                }
            }

            toast.success(
                finalStatus === 'HOAN_THANH'
                    ? '✅ Đã xác nhận giao hàng thành công! Trạng thái đơn: Hoàn thành.'
                    : '⚠️ Đã báo cáo giao thất bại!'
            );
            setIsConfirmModalOpen(false);
            setSelectedOrder(null);
            setShippingOrderItems([]);
            setUploadedImages([]);
            setNotes('');
            setDeliveryStatus('HOAN_THANH');
            fetchShippingTasks();
        } catch (error) {
            console.error('Error confirming delivery:', error);
            toast.error('❌ Lỗi xác nhận: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const q = searchTerm.toLowerCase();
    const filteredOrders = orders.filter((order) => {
        return (
            !searchTerm ||
            order.order_code?.toLowerCase().includes(q) ||
            order.customer_name?.toLowerCase().includes(q) ||
            order.recipient_name?.toLowerCase().includes(q) ||
            order.recipient_address?.toLowerCase().includes(q) ||
            (order.recipient_phone || '').includes(searchTerm)
        );
    });

    const getShipperColumnKey = (order) => (order.delivery_unit || '').trim() || 'Chưa phân công';

    const kanbanByShipper = filteredOrders.reduce((acc, order) => {
        const shipperName = getShipperColumnKey(order);
        if (!acc[shipperName]) acc[shipperName] = [];
        acc[shipperName].push(order);
        return acc;
    }, {});

    const shipperColumns = Object.entries(kanbanByShipper).sort(([a], [b]) => a.localeCompare(b, 'vi'));

    const getStatusBadge = (status) => {
        switch (status) {
            case 'CHO_GIAO_HANG': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'DANG_GIAO_HANG': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'CHO_DOI_SOAT': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
            case 'DOI_SOAT_THAT_BAI': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'HOAN_THANH': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'TRA_HANG': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'CHO_GIAO_HANG': return 'Chờ giao';
            case 'DANG_GIAO_HANG': return 'Đang giao';
            case 'CHO_DOI_SOAT': return 'Chờ đối soát';
            case 'DOI_SOAT_THAT_BAI': return 'Đối soát thất bại';
            case 'HOAN_THANH': return 'Hoàn thành';
            case 'TRA_HANG': return 'Trả hàng';
            default: return status;
        }
    };

    const shipModMachineSerials =
        isConfirmModalOpen && selectedOrder
            ? resolveMachineSerialsForShippingConfirm(selectedOrder, shippingOrderItems)
            : [];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Nhiệm vụ giao hàng</h1>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            Đơn giao hàng (bảng <span className="font-mono text-slate-600">orders</span>) — chỉ thao tác «Giao hàng» để
                            mở phiếu xác nhận, chụp ảnh và tích từng mã máy; lưu trực tiếp vào đơn.
                        </p>
                    </div>
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
                        placeholder="Mã đơn / mã phiếu thu hồi, khách, SĐT..."
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
                        <p className="text-slate-500 text-sm mt-1">
                            Thử làm mới trang hoặc bỏ ô tìm kiếm. Chỉ hiển thị đơn được gán cho bạn trong luồng giao hàng (
                            <span className="font-mono">orders</span>).
                        </p>
                        <button 
                            onClick={fetchShippingTasks}
                            className="mt-6 text-primary font-bold text-sm bg-primary/10 px-6 py-2 rounded-full"
                        >
                            Tải lại trang
                        </button>
                    </div>
                ) : activeView === 'list' ? (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[960px] text-left text-[13px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wide border-b border-slate-200">
                                        <th className="py-3 pl-4 pr-2 min-w-[128px]">
                                            <span className="block normal-case tracking-normal text-[10px] font-bold text-slate-400">Loại nhiệm vụ</span>
                                            <span className="block text-[9px] font-semibold text-slate-400 normal-case tracking-tight mt-0.5">(bảng nguồn)</span>
                                        </th>
                                        <th className="py-3 px-2 whitespace-nowrap">Mã</th>
                                        <th className="py-3 px-2 whitespace-nowrap">Trạng thái</th>
                                        <th className="py-3 px-2 min-w-[140px]">Khách</th>
                                        <th className="py-3 px-2 whitespace-nowrap">Đơn vị giao</th>
                                        <th className="py-3 px-2 min-w-[160px]">Địa chỉ</th>
                                        <th className="py-3 px-2 whitespace-nowrap">SĐT</th>
                                        <th className="py-3 px-2 min-w-[120px]">Hàng / SL</th>
                                        <th className="py-3 px-2 text-right whitespace-nowrap">Giá trị</th>
                                        <th className="py-3 pr-4 pl-2 text-right min-w-[160px]">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 align-top"
                                        >
                                            <td className="py-3 pl-4 pr-2">
                                                <span className="inline-block text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md uppercase whitespace-nowrap">
                                                    Giao hàng
                                                </span>
                                                <span
                                                    className="block text-[10px] text-slate-400 font-mono mt-1.5 leading-tight"
                                                    title="Dòng dữ liệu từ bảng orders"
                                                >
                                                    orders
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 font-bold text-slate-800 whitespace-nowrap">
                                                #{order.order_code}
                                            </td>
                                            <td className="py-3 px-2">
                                                <span
                                                    className={clsx(
                                                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase whitespace-nowrap',
                                                        getStatusBadge(order.status),
                                                    )}
                                                >
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 font-semibold text-slate-900">
                                                {order.recipient_name || '—'}
                                            </td>
                                            <td
                                                className="py-3 px-2 text-slate-600 max-w-[120px] truncate"
                                                title={(order.delivery_unit || '').trim() || undefined}
                                            >
                                                {(order.delivery_unit || '').trim() || '—'}
                                            </td>
                                            <td className="py-3 px-2 text-slate-600 max-w-[220px]">
                                                <span className="line-clamp-2" title={order.recipient_address}>
                                                    {order.recipient_address || '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-2 whitespace-nowrap">
                                                {order.recipient_phone ? (
                                                    <a
                                                        href={`tel:${order.recipient_phone}`}
                                                        className="text-primary font-bold hover:underline"
                                                    >
                                                        {order.recipient_phone}
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="py-3 px-2 text-slate-600 whitespace-nowrap">
                                                {order.product_type || '—'} — SL: {order.quantity ?? '—'}
                                            </td>
                                            <td className="py-3 px-2 text-right font-bold text-primary tabular-nums whitespace-nowrap">
                                                {order.total_amount != null
                                                    ? `${Number(order.total_amount).toLocaleString('vi-VN')}đ`
                                                    : '—'}
                                            </td>
                                            <td className="py-3 pr-4 pl-2">
                                                <div className="flex flex-wrap items-center justify-end gap-1.5 ml-auto">
                                                    {ORDER_STATUSES_NEED_DELIVERY_CONFIRM.includes(order.status) ? (
                                                        <button
                                                            type="button"
                                                            title="Mở phiếu xác nhận giao — ảnh + tích mã máy; lưu vào orders"
                                                            onClick={() => openDeliveryConfirmModal(order)}
                                                            className={giaoHangActionBtnCls}
                                                        >
                                                            Giao hàng
                                                        </button>
                                                    ) : (
                                                        <span className="max-w-[140px] shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[10px] font-bold uppercase leading-tight text-slate-500">
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-hidden">
                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                            {shipperColumns.map(([shipperName, shipperOrders]) => (
                                <div
                                    key={shipperName}
                                    className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0"
                                >
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
                                                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-[12px] font-bold text-primary">
                                                            #{order.order_code}
                                                        </p>
                                                        <span
                                                            className={clsx(
                                                                'px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0',
                                                                getStatusBadge(order.status),
                                                            )}
                                                        >
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1 py-0.5 rounded mt-1.5 inline-block uppercase">
                                                        orders
                                                    </p>
                                                    <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">
                                                        {order.recipient_name || order.customer_name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                        {order.recipient_phone || '—'}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                    {ORDER_STATUSES_NEED_DELIVERY_CONFIRM.includes(order.status) ? (
                                                        <button
                                                            type="button"
                                                            title="Phiếu xác nhận giao — ảnh + mã máy; ghi vào orders"
                                                            className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                void openDeliveryConfirmModal(order);
                                                            }}
                                                        >
                                                            Giao hàng
                                                        </button>
                                                    ) : (
                                                        <span className="w-full min-w-0 flex items-center justify-center py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-[9px] font-bold text-center leading-tight uppercase">
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    )}
                                                </div>
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
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Phiếu xác nhận giao hàng</h2>
                                <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
                                    Dữ liệu được ghi vào bảng nguồn{' '}
                                    <span className="font-mono text-slate-700">orders</span>: ảnh (URL/base64/ghi chú),
                                    <span className="font-mono text-slate-700"> delivery_checklist</span> theo từng mã máy đã tích.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConfirmModalOpen(false);
                                    setShippingOrderItems([]);
                                    setSelectedOrder(null);
                                }}
                                className="shrink-0 self-start mt-0.5 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                            >
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

                            {deliveryStatus === 'HOAN_THANH' && selectedOrder && shipModMachineSerials.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                        Xác nhận từng mã máy trên đơn
                                    </p>
                                    <p className="text-[11px] text-slate-500 mb-3">
                                        Bắt buộc tích đủ trước khi xác nhận. Lưu dưới dạng{' '}
                                        <span className="font-mono text-slate-700">MAY:{'<mã_máy>'}</span> trong{' '}
                                        <span className="font-mono">orders.delivery_checklist</span>.
                                    </p>
                                    <div className="space-y-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        {shipModMachineSerials.map((serial) => (
                                            <label key={serial} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={!!machineChecklist[serial]}
                                                    onChange={(e) =>
                                                        setMachineChecklist((prev) => ({ ...prev, [serial]: e.target.checked }))
                                                    }
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                                                />
                                                <span className="font-mono">{serial}</span>
                                            </label>
                                        ))}
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
                                {deliveryStatus === 'HOAN_THANH'
                                    ? 'Đơn chuyển sang Hoàn thành; máy và bình (nếu có) đều được cập nhật theo mã đã tích.'
                                    : 'Đơn hàng sẽ được trả về kho (Trạng thái: Đơn hàng trả về).'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ShippingTasks;
