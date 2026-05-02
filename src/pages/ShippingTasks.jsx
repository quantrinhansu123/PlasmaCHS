import React, { useState, useEffect, useCallback } from 'react';
import { 
    Truck, 
    CheckCircle2, 
    Camera, 
    X, 
    ChevronLeft, 
    Search, 
    MapPin, 
    Phone, 
    Package,
    PackageCheck,
    Clock,
    AlertCircle,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    LayoutGrid,
    List
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import usePermissions from '../hooks/usePermissions';
import { isShipperRole, isAdminRole } from '../utils/accessControl';
import { tryQuickCompleteRecovery } from '../utils/cylinderRecoveryCompletion';
import {
    collectMachineSerialsForOrder,
    resolvedOrderCustomerAssetName,
} from '../utils/orderMachineSerials';
import { stripDeliveryMediaFromNote } from '../utils/orderNoteSanitize';

/** Gộp đơn giao hàng + phiếu thu hồi vỏ cần shipper / tài xế xử lý */
const ShippingTasks = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const focusOrderId = searchParams.get('focusOrderId');
    const { role } = usePermissions();
    const [tasks, setTasks] = useState([]);
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
    /** Tách khỏi isLoading (giao hàng / tải trang) để nút Hoàn thành thu hồi luôn bấm được */
    const [completingRecoveryId, setCompletingRecoveryId] = useState(null);

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

            let orderQuery = supabase
                .from('orders')
                .select('*')
                .in('status', ['CHO_GIAO_HANG', 'DANG_GIAO_HANG'])
                .order('created_at', { ascending: false });
            if (shipperOnly && storageUserName) {
                orderQuery = orderQuery.eq('delivery_unit', storageUserName);
            }
            const { data: orderData, error: orderError } = await orderQuery;
            if (orderError) throw orderError;

            const { data: recoveryData, error: recoveryError } = await supabase
                .from('cylinder_recoveries')
                .select('*, customers(name, phone, address)')
                .in('status', ['CHO_PHAN_CONG', 'DANG_THU_HOI'])
                .order('created_at', { ascending: false });

            if (recoveryError) throw recoveryError;

            let recoveries = recoveryData || [];
            if (shipperOnly && storageUserName) {
                const token = storageUserName.trim();
                recoveries = recoveries.filter((r) => {
                    const d = (r.driver_name || '').trim();
                    return d && d.includes(token);
                });
            }

            // Gộp 2 nguồn: orders (giao hàng) + cylinder_recoveries (phiếu thu hồi vỏ) — UI phân biệt theo task.kind.
            const merged = [
                ...(orderData || []).map((o) => ({
                    kind: 'ORDER',
                    id: o.id,
                    sortAt: o.created_at,
                    order: o,
                })),
                ...recoveries.map((r) => ({
                    kind: 'RECOVERY',
                    id: r.id,
                    sortAt: r.created_at,
                    recovery: r,
                })),
            ].sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));

            setTasks(merged);
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
        const task = tasks.find(
            (t) => t.kind === 'ORDER' && String(t.order.id) === String(focusOrderId),
        );
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('focusOrderId');
                return next;
            },
            { replace: true },
        );
        if (task?.order) {
            setActiveView('list');
            void openDeliveryConfirmModal(task.order);
        } else if (tasks.length > 0) {
            toast.info('Đơn không nằm trong danh sách nhiệm vụ giao (trạng thái hoặc phân quyền tài xế).');
        }
    }, [focusOrderId, isLoading, tasks, setSearchParams, openDeliveryConfirmModal]);

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
    const filteredTasks = tasks.filter((task) => {
        if (task.kind === 'ORDER') {
            const order = task.order;
            return (
                order.order_code?.toLowerCase().includes(q) ||
                order.customer_name?.toLowerCase().includes(q) ||
                order.recipient_name?.toLowerCase().includes(q) ||
                order.recipient_address?.toLowerCase().includes(q) ||
                (order.recipient_phone || '').includes(searchTerm)
            );
        }
        const r = task.recovery;
        const c = r.customers;
        return (
            r.recovery_code?.toLowerCase().includes(q) ||
            (c?.name || '').toLowerCase().includes(q) ||
            (c?.phone || '').includes(searchTerm)
        );
    });

    const getShipperColumnKey = (task) => {
        if (task.kind === 'ORDER') {
            return (task.order.delivery_unit || '').trim() || 'Chưa phân công';
        }
        return (task.recovery.driver_name || '').trim() || 'Chưa phân công';
    };

    const kanbanByShipper = filteredTasks.reduce((acc, task) => {
        const shipperName = getShipperColumnKey(task);
        if (!acc[shipperName]) acc[shipperName] = [];
        acc[shipperName].push(task);
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

    const getRecoveryStatusBadge = (status) => {
        switch (status) {
            case 'CHO_PHAN_CONG': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'DANG_THU_HOI': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getRecoveryStatusLabel = (status) => {
        switch (status) {
            case 'CHO_PHAN_CONG': return 'Chờ phân công';
            case 'DANG_THU_HOI': return 'Đang thu hồi';
            default: return status;
        }
    };

    const openRecoveryTask = (recoveryId) => {
        navigate(`/thu-hoi-vo?recovery=${recoveryId}`);
    };

    /** Hoàn thành từ Nhiệm vụ giao hàng: chốt nhanh nếu đã có vỏ; không thì mở phiếu (hoanThanh=1) */
    const completeRecoveryTask = async (recoveryId) => {
        if (completingRecoveryId) return;
        setCompletingRecoveryId(recoveryId);
        try {
            const res = await tryQuickCompleteRecovery(supabase, recoveryId, {
                onNeedOpenForm: () => navigate(`/thu-hoi-vo?recovery=${recoveryId}&hoanThanh=1`),
            });
            if (res?.ok) await fetchShippingTasks();
        } finally {
            setCompletingRecoveryId(null);
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
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Giao hàng + thu hồi vỏ bình</p>
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
                {isLoading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <p className="text-slate-500 font-medium">Đang tải danh sách nhiệm vụ...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Truck size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Không có nhiệm vụ nào</h3>
                        <p className="text-slate-500 text-sm mt-1">Không có đơn cần giao hoặc phiếu thu hồi vỏ đang xử lý.</p>
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
                                        <th className="py-3 pr-4 pl-2 text-right min-w-[200px]">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.map((task) => {
                                        if (task.kind === 'ORDER') {
                                            const order = task.order;
                                            const orderNoteDisplay = stripDeliveryMediaFromNote(order.note);
                                            return (
                                                <tr
                                                    key={`ord-${order.id}`}
                                                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 align-top"
                                                >
                                                    <td className="py-3 pl-4 pr-2">
                                                        <span className="inline-block text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md uppercase whitespace-nowrap">
                                                            Giao hàng
                                                        </span>
                                                        <span
                                                            className="block text-[10px] text-slate-400 font-mono mt-1.5 leading-tight"
                                                            title="Dữ liệu dòng này lấy từ bảng orders (đơn giao hàng)"
                                                        >
                                                            orders
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 font-bold text-slate-800 whitespace-nowrap">#{order.order_code}</td>
                                                    <td className="py-3 px-2">
                                                        <span className={clsx('inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase whitespace-nowrap', getStatusBadge(order.status))}>
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 font-semibold text-slate-900">{order.recipient_name || '—'}</td>
                                                    <td className="py-3 px-2 text-slate-600 max-w-[120px] truncate" title={(order.delivery_unit || '').trim() || undefined}>
                                                        {(order.delivery_unit || '').trim() || '—'}
                                                    </td>
                                                    <td className="py-3 px-2 text-slate-600 max-w-[220px]">
                                                        <span className="line-clamp-2" title={order.recipient_address}>{order.recipient_address || '—'}</span>
                                                    </td>
                                                    <td className="py-3 px-2 whitespace-nowrap">
                                                        {order.recipient_phone ? (
                                                            <a href={`tel:${order.recipient_phone}`} className="text-primary font-bold hover:underline">
                                                                {order.recipient_phone}
                                                            </a>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-2 text-slate-600">
                                                        <span className="line-clamp-2">{order.product_type || '—'} — SL: {order.quantity ?? '—'}</span>
                                                        {orderNoteDisplay ? (
                                                            <span
                                                                className="block text-[11px] text-amber-700 mt-0.5 line-clamp-1"
                                                                title={orderNoteDisplay}
                                                            >
                                                                {orderNoteDisplay}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="py-3 px-2 text-right font-bold text-primary tabular-nums whitespace-nowrap">
                                                        {order.total_amount != null ? `${Number(order.total_amount).toLocaleString('vi-VN')}đ` : '—'}
                                                    </td>
                                                    <td className="py-3 pr-4 pl-2">
                                                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openDeliveryConfirmModal(order)}
                                                                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold shadow-sm hover:opacity-95"
                                                            >
                                                                Giao hàng
                                                            </button>
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.recipient_address || '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                                title="Bản đồ"
                                                            >
                                                                <MapPin size={16} />
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        const r = task.recovery;
                                        const c = r.customers || {};
                                        const addr = c.address || '—';
                                        const phone = c.phone || '—';
                                        return (
                                            <tr
                                                key={`rec-${r.id}`}
                                                className="border-b border-slate-100 last:border-0 bg-teal-50/30 hover:bg-teal-50/60 align-top"
                                            >
                                                <td className="py-3 pl-4 pr-2">
                                                    <span className="inline-block text-[10px] font-bold text-white bg-teal-600 px-1.5 py-0.5 rounded-md uppercase whitespace-nowrap">
                                                        Thu hồi vỏ
                                                    </span>
                                                    <span
                                                        className="block text-[10px] text-slate-500 font-mono mt-1.5 leading-tight"
                                                        title="Dữ liệu dòng này lấy từ bảng cylinder_recoveries (phiếu thu hồi vỏ)"
                                                    >
                                                        cylinder_recoveries
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 font-bold text-teal-800 whitespace-nowrap">#{r.recovery_code}</td>
                                                <td className="py-3 px-2">
                                                    <span className={clsx('inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase whitespace-nowrap', getRecoveryStatusBadge(r.status))}>
                                                        {getRecoveryStatusLabel(r.status)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 font-semibold text-slate-900">{c.name || 'Khách hàng'}</td>
                                                <td className="py-3 px-2 text-slate-600 max-w-[120px] truncate" title={(r.driver_name || '').trim() || undefined}>
                                                    {(r.driver_name || '').trim() || '—'}
                                                </td>
                                                <td className="py-3 px-2 text-slate-600 max-w-[220px]">
                                                    <span className="line-clamp-2" title={addr}>{addr}</span>
                                                </td>
                                                <td className="py-3 px-2 whitespace-nowrap">
                                                    {phone !== '—' ? (
                                                        <a href={`tel:${phone}`} className="text-primary font-bold hover:underline">
                                                            {phone}
                                                        </a>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="py-3 px-2 text-slate-600">
                                                    Yêu cầu: <span className="font-bold">{r.requested_quantity ?? 0}</span> vỏ
                                                    {r.notes ? (
                                                        <span className="block text-[11px] text-amber-700 mt-0.5 line-clamp-1" title={r.notes}>
                                                            {r.notes}
                                                        </span>
                                                    ) : null}
                                                </td>
                                                <td className="py-3 px-2 text-right text-slate-400">—</td>
                                                <td className="py-3 pr-4 pl-2">
                                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            title="Danh sách / module thu hồi vỏ (dòng này là phiếu cylinder_recoveries)"
                                                            onClick={() => navigate('/thu-hoi-vo')}
                                                            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50"
                                                        >
                                                            Trang thu hồi vỏ
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openRecoveryTask(r.id)}
                                                            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white text-[11px] font-bold shadow-sm hover:bg-teal-700"
                                                        >
                                                            Mở phiếu
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Chốt phiếu thu hồi (đã có vỏ trên phiếu). Chưa có vỏ sẽ mở phiếu để nhập."
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                completeRecoveryTask(r.id);
                                                            }}
                                                            disabled={!!completingRecoveryId}
                                                            className={clsx(
                                                                'shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1',
                                                                completingRecoveryId === r.id
                                                                    ? 'bg-emerald-500/90 text-white cursor-wait'
                                                                    : completingRecoveryId
                                                                        ? 'bg-emerald-600/40 text-white cursor-not-allowed'
                                                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                            )}
                                                        >
                                                            {completingRecoveryId === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                                            Hoàn thành
                                                        </button>
                                                        {addr && addr !== '—' ? (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                                title="Bản đồ"
                                                            >
                                                                <MapPin size={16} />
                                                            </a>
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-hidden">
                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                            {shipperColumns.map(([shipperName, shipperTasks]) => (
                                <div key={shipperName} className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0">
                                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                        <p className="text-[12px] font-bold text-slate-700 truncate pr-2">{shipperName}</p>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                                            {shipperTasks.length}
                                        </span>
                                    </div>
                                    <div className="p-2.5 space-y-2 overflow-y-auto min-h-0">
                                        {shipperTasks.map((task) => (
                                            task.kind === 'ORDER' ? (
                                            <div
                                                key={`k-ord-${task.order.id}`}
                                                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-[12px] font-bold text-primary">#{task.order.order_code}</p>
                                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getStatusBadge(task.order.status))}>
                                                            {getStatusLabel(task.order.status)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1 py-0.5 rounded mt-1.5 inline-block uppercase">Giao hàng</p>
                                                    <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">{task.order.recipient_name || task.order.customer_name}</p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{task.order.recipient_phone || '—'}</p>
                                                </div>
                                                <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                    <button
                                                        type="button"
                                                        className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void openDeliveryConfirmModal(task.order);
                                                        }}
                                                    >
                                                        Giao hàng
                                                    </button>
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.order.recipient_address || '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 active:bg-slate-100"
                                                        title="Bản đồ"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <MapPin size={16} />
                                                    </a>
                                                </div>
                                            </div>
                                            ) : (
                                            <div
                                                key={`k-rec-${task.recovery.id}`}
                                                className="bg-teal-50/80 border border-teal-200 rounded-lg overflow-hidden hover:bg-white hover:shadow-sm transition-all flex flex-col"
                                            >
                                                <div className="p-2.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-[12px] font-bold text-teal-700">#{task.recovery.recovery_code}</p>
                                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getRecoveryStatusBadge(task.recovery.status))}>
                                                            {getRecoveryStatusLabel(task.recovery.status)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-teal-600 mt-0.5 uppercase">Thu hồi vỏ</p>
                                                    <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">{(task.recovery.customers || {}).name || '—'}</p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{(task.recovery.customers || {}).phone || '—'}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-1 p-2 pt-0 border-t border-teal-200/60">
                                                    <button
                                                        type="button"
                                                        title="Danh sách thu hồi vỏ"
                                                        className="shrink-0 px-1.5 py-1.5 rounded-md border border-teal-200 bg-white text-teal-700 text-[9px] font-bold leading-tight text-left max-w-[108px]"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            navigate('/thu-hoi-vo');
                                                        }}
                                                    >
                                                        Trang thu hồi vỏ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="shrink-0 px-2 py-1.5 rounded-md bg-teal-600 text-white text-[10px] font-bold shadow-sm"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openRecoveryTask(task.recovery.id);
                                                        }}
                                                    >
                                                        Mở phiếu
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Chốt phiếu từ nhiệm vụ (đã có vỏ). Chưa có vỏ sẽ mở phiếu."
                                                        className={clsx(
                                                            'shrink-0 px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1',
                                                            completingRecoveryId === task.recovery.id
                                                                ? 'bg-emerald-500/90 text-white cursor-wait'
                                                                : completingRecoveryId
                                                                    ? 'bg-emerald-600/40 text-white cursor-not-allowed'
                                                                    : 'bg-emerald-600 text-white active:bg-emerald-700'
                                                        )}
                                                        disabled={!!completingRecoveryId}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            completeRecoveryTask(task.recovery.id);
                                                        }}
                                                    >
                                                        {completingRecoveryId === task.recovery.id ? (
                                                            <Loader2 size={12} className="animate-spin shrink-0" />
                                                        ) : null}
                                                        Hoàn thành
                                                    </button>
                                                    {(() => {
                                                        const raw = String((task.recovery.customers || {}).address || '').trim();
                                                        if (!raw || raw === '—') return null;
                                                        return (
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600"
                                                                title="Bản đồ"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MapPin size={16} />
                                                            </a>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            )
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
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConfirmModalOpen(false);
                                    setShippingOrderItems([]);
                                    setSelectedOrder(null);
                                }}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
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
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tích xác nhận mã máy đã giao</p>
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
