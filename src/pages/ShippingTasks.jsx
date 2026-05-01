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
    PackageCheck,
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
import usePermissions from '../hooks/usePermissions';
import { isShipperRole, isAdminRole } from '../utils/accessControl';
import { tryQuickCompleteRecovery } from '../utils/cylinderRecoveryCompletion';

/** Gộp đơn giao hàng + phiếu thu hồi vỏ cần shipper / tài xế xử lý */
const ShippingTasks = () => {
    const navigate = useNavigate();
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

    const parseMachineSerialsFromOrder = (order) => {
        const sanitizeSerial = (value) => {
            const cleaned = String(value || '')
                .replace(/^\d+\)\s*/g, '')
                .replace(/^mã máy:\s*/i, '')
                .replace(/^mã:\s*/i, '')
                .replace(/[.;]+$/g, '')
                .trim();
            if (!cleaned) return '';
            if (!/[a-z0-9]/i.test(cleaned)) return '';
            return cleaned;
        };

        const fromDepartment = String(order?.department || '')
            .split(/[\n,]+/)
            .map(sanitizeSerial)
            .filter(Boolean);

        const note = String(order?.note || '');
        const fromNote = [];
        note.split('\n').forEach((line) => {
            const trimmed = line.trim();
            // Hỗ trợ cả format "Mã máy: A, B" và "1) Mã: A"
            const multiMatch = trimmed.match(/^Mã máy:\s*(.+)$/i);
            if (multiMatch?.[1]) {
                multiMatch[1]
                    .split(',')
                    .map(sanitizeSerial)
                    .filter(Boolean)
                    .forEach((serial) => fromNote.push(serial));
            }
            const singleMatch = trimmed.match(/Mã:\s*(.+)$/i);
            if (singleMatch?.[1]) {
                const serial = sanitizeSerial(singleMatch[1]);
                if (serial) fromNote.push(serial);
            }
        });

        return [...new Set([...fromDepartment, ...fromNote])];
    };

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
        const machineSerialsForConfirm = parseMachineSerialsFromOrder(selectedOrder);
        
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
            const finalStatus = deliveryStatus === 'HOAN_THANH'
                ? (selectedOrder.status === 'CHO_GIAO_HANG' ? 'DANG_GIAO_HANG' : 'HOAN_THANH')
                : 'TRA_HANG';
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

            // Khi giao thành công từ bước "ĐANG_GIAO_HANG", đồng bộ máy sang "thuộc khách hàng".
            if (finalStatus === 'HOAN_THANH' && selectedOrder.status === 'DANG_GIAO_HANG') {
                const machineSerials = (selectedOrder.department || '')
                    .split(/[\n,]+/)
                    .map((serial) => serial.trim())
                    .filter(Boolean);

                if (machineSerials.length > 0) {
                    const { error: deliveredMachineErr } = await supabase
                        .from('machines')
                        .update({
                            status: 'thuộc khách hàng',
                            customer_name: selectedOrder.customer_name || null,
                            warehouse: null,
                            updated_at: new Date().toISOString()
                        })
                        .in('serial_number', machineSerials);

                    if (deliveredMachineErr) {
                        throw new Error('Không thể cập nhật máy sang trạng thái thuộc khách hàng: ' + deliveredMachineErr.message);
                    }
                }
            }

            const { error } = await supabase
                .from('orders')
                .update({
                    status: finalStatus,
                    delivery_image_url: deliveryImageUrl,
                    delivery_proof_base64: deliveryProofBase64,
                    note: (selectedOrder.note || '') + newNoteText + uploadedProofText,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedOrder.id);

            if (error) throw error;

            if (finalStatus === 'HOAN_THANH') {
                const cylinderSerials = parseCylinderSerialsFromOrder(selectedOrder);
                const machineSerials = parseMachineSerialsFromOrder(selectedOrder);

                if (cylinderSerials.length > 0) {
                    const { error: cylinderErr } = await supabase
                        .from('cylinders')
                        .update({
                            status: 'thuộc khách hàng',
                            customer_name: selectedOrder.customer_name || null,
                            updated_at: new Date().toISOString()
                        })
                        .in('serial_number', cylinderSerials);
                    if (cylinderErr) throw cylinderErr;
                }

                if (machineSerials.length > 0) {
                    const { error: machineErr } = await supabase
                        .from('machines')
                        .update({
                            status: 'thuộc khách hàng',
                            customer_name: selectedOrder.customer_name || null,
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
                finalStatus === 'DANG_GIAO_HANG'
                    ? '✅ Đã chuyển đơn sang trạng thái Đang giao!'
                    : finalStatus === 'HOAN_THANH'
                        ? '✅ Đã xác nhận giao hàng thành công!'
                        : '⚠️ Đã báo cáo giao thất bại!'
            );
            setIsConfirmModalOpen(false);
            setSelectedOrder(null);
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
                    filteredTasks.map((task) => {
                        if (task.kind === 'ORDER') {
                            const order = task.order;
                            return (
                        <div key={`ord-${order.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden active:scale-[0.98] transition-transform duration-200">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md uppercase">Giao hàng</span>
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
                                    type="button"
                                    onClick={() => navigate('/thu-hoi-vo')}
                                    className="flex-1 bg-white border border-teal-200 text-teal-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:bg-teal-50"
                                >
                                    <RefreshCw size={18} />
                                    Thu hồi vỏ
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setSelectedOrder(order);
                                        setDeliveryStatus('HOAN_THANH');
                                        setNotes('');
                                        setUploadedImages([]);
                                        const serials = parseMachineSerialsFromOrder(order);
                                        const initialChecklist = {};
                                        serials.forEach((serial) => { initialChecklist[serial] = false; });
                                        setMachineChecklist(initialChecklist);
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
                            );
                        }
                        const r = task.recovery;
                        const c = r.customers || {};
                        const addr = c.address || '—';
                        const phone = c.phone || '—';
                        return (
                        <div key={`rec-${r.id}`} className="bg-white rounded-2xl border border-teal-200/80 shadow-sm overflow-hidden active:scale-[0.98] transition-transform duration-200 ring-1 ring-teal-100/60">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[10px] font-bold text-white bg-teal-600 px-1.5 py-0.5 rounded-md uppercase">Thu hồi vỏ</span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">#{r.recovery_code}</span>
                                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase', getRecoveryStatusBadge(r.status))}>
                                            {getRecoveryStatusLabel(r.status)}
                                        </span>
                                    </div>
                                    <h3 className="text-[17px] font-extrabold text-slate-900 leading-tight">{c.name || 'Khách hàng'}</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-[13px] font-bold text-teal-700">
                                        Yêu cầu: {r.requested_quantity ?? 0} vỏ
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {r.driver_name && (
                                    <div className="flex items-center gap-3">
                                        <User size={16} className="text-slate-400" />
                                        <p className="text-sm text-slate-600 font-medium">{r.driver_name}</p>
                                    </div>
                                )}
                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-slate-400 mt-0.5" />
                                    <p className="text-sm text-slate-600 font-medium line-clamp-2">{addr}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone size={16} className="text-slate-400" />
                                    <a href={`tel:${phone}`} className="text-sm text-primary font-bold">{phone}</a>
                                </div>
                                {r.notes && (
                                    <div className="flex items-start gap-3 p-2 bg-amber-50 rounded-lg border border-amber-100">
                                        <AlertCircle size={14} className="text-amber-500 mt-0.5" />
                                        <p className="text-[12px] text-amber-700 italic">{r.notes}</p>
                                    </div>
                                )}
                            </div>
                            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => openRecoveryTask(r.id)}
                                    className="flex-1 min-w-[130px] bg-teal-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 active:bg-teal-700"
                                >
                                    <PackageCheck size={18} />
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
                                        'flex-1 min-w-[130px] py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md active:bg-emerald-700',
                                        completingRecoveryId === r.id
                                            ? 'bg-emerald-500/80 text-white shadow-emerald-600/20 cursor-wait'
                                            : completingRecoveryId
                                                ? 'bg-emerald-600/50 text-white/90 cursor-not-allowed shadow-emerald-600/15'
                                                : 'bg-emerald-600 text-white shadow-emerald-600/25'
                                    )}
                                >
                                    {completingRecoveryId === r.id ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <CheckCircle2 size={18} />
                                    )}
                                    Hoàn thành
                                </button>
                                {addr && addr !== '—' && (
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-12 min-h-[2.5rem] shrink-0 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 shadow-sm active:bg-slate-100"
                                    >
                                        <MapPin size={20} />
                                    </a>
                                )}
                            </div>
                        </div>
                        );
                    })
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
                                                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:bg-white hover:shadow-sm transition-all"
                                                onClick={() => {
                                                    const order = task.order;
                                                    setSelectedOrder(order);
                                                    setDeliveryStatus('HOAN_THANH');
                                                    setNotes('');
                                                    setUploadedImages([]);
                                                    const serials = parseMachineSerialsFromOrder(order);
                                                    const initialChecklist = {};
                                                    serials.forEach((serial) => { initialChecklist[serial] = false; });
                                                    setMachineChecklist(initialChecklist);
                                                    setIsConfirmModalOpen(true);
                                                }}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-[12px] font-bold text-primary">#{task.order.order_code}</p>
                                                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase', getStatusBadge(task.order.status))}>
                                                        {getStatusLabel(task.order.status)}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">{task.order.recipient_name || task.order.customer_name}</p>
                                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{task.order.recipient_phone || '—'}</p>
                                            </div>
                                            ) : (
                                            <div
                                                key={`k-rec-${task.recovery.id}`}
                                                className="bg-teal-50/80 border border-teal-200 rounded-lg overflow-hidden hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <button
                                                    type="button"
                                                    className="w-full text-left p-2.5 cursor-pointer"
                                                    onClick={() => openRecoveryTask(task.recovery.id)}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-[12px] font-bold text-teal-700">#{task.recovery.recovery_code}</p>
                                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase', getRecoveryStatusBadge(task.recovery.status))}>
                                                            {getRecoveryStatusLabel(task.recovery.status)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-teal-600 mt-0.5 uppercase">Thu hồi vỏ</p>
                                                    <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">{(task.recovery.customers || {}).name || '—'}</p>
                                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{(task.recovery.customers || {}).phone || '—'}</p>
                                                </button>
                                                <div className="flex border-t border-teal-200/60">
                                                    <button
                                                        type="button"
                                                        title="Chốt phiếu từ nhiệm vụ (đã có vỏ). Chưa có vỏ sẽ mở phiếu."
                                                        className={clsx(
                                                            'flex-1 py-2 text-[10px] font-bold flex items-center justify-center gap-1',
                                                            completingRecoveryId === task.recovery.id
                                                                ? 'text-emerald-800 bg-emerald-100 cursor-wait'
                                                                : completingRecoveryId
                                                                    ? 'text-teal-600/60 bg-teal-100/30 cursor-not-allowed'
                                                                    : 'text-teal-800 bg-teal-100/50 hover:bg-teal-100'
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

                            {deliveryStatus === 'HOAN_THANH' && selectedOrder && parseMachineSerialsFromOrder(selectedOrder).length > 0 && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tích xác nhận mã máy đã giao</p>
                                    <div className="space-y-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        {parseMachineSerialsFromOrder(selectedOrder).map((serial) => (
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
                                    ? (selectedOrder?.status === 'CHO_GIAO_HANG'
                                        ? 'Trạng thái đơn hàng sẽ chuyển thành Đang giao.'
                                        : 'Trạng thái đơn hàng sẽ chuyển thành Hoàn thành.')
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
