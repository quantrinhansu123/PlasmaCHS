import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    Package,
    Trash2,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase/config';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';
import usePermissions from '../hooks/usePermissions';
import { isShipperRole, isAdminRole } from '../utils/accessControl';
import {
    collectMachineSerialsForOrder,
    resolvedOrderCustomerAssetName,
} from '../utils/orderMachineSerials';
import { normalizeTransferActionRecord } from '../utils/normalizeTransferActionRecord';
import { persistTransferHandover } from '../utils/persistTransferHandover';
import {
    isCloudinaryDeliveryUrl,
    isCloudinaryConfigured,
    uploadDeliveryProofFile,
} from '../utils/cloudinaryUpload';
import RecoveryDeliveryConfirmModal from '../components/CylinderRecovery/RecoveryDeliveryConfirmModal';
import GoodsIssueFormModal from '../components/GoodsIssues/GoodsIssueFormModal';
import GoodsReceiptFormModal from '../components/GoodsReceipts/GoodsReceiptFormModal';
import ShippingTransportConfirmModal from '../components/Shipping/ShippingTransportConfirmModal';
import { tryQuickCompleteRecovery } from '../utils/cylinderRecoveryCompletion';
import {
    canOpenShippingDeliveryConfirm,
    deliveryUnitMatchesShipper,
    isShippingPipelineOrderStatus,
    isTerminalShippingOrderStatus,
    ORDER_STATUSES_SHIPPING_PIPELINE,
} from '../utils/shippingTaskStatus';
import { buildWarehouseLabelMap } from '../utils/orderWarehouseScope';
import { deleteOrdersWithRollback } from '../utils/deleteOrderCascade';

const isTransferHandoverCompleted = (tr) =>
    Boolean(tr?.handover_image_url) ||
    String(tr?.note || '').includes('[Kho Nhan Xac Nhan]: TRUE');

const giaoHangActionBtnCls =
    'shrink-0 rounded-lg border border-primary bg-primary px-3 py-2 text-[11px] font-bold text-white shadow-sm hover:opacity-95 !h-auto !min-h-0';

const TRANSFER_STATUS_SHIPPING_VISIBLE = 'DA_DUYET';

const taskRowKey = (it) => `${it.kind}::${it.row.id}`;

function parseTaskRowKey(key) {
    const idx = String(key).indexOf('::');
    if (idx === -1) return null;
    return { kind: key.slice(0, idx), id: key.slice(idx + 2) };
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function isMissingSupabaseTableError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    return (
        code === '42P01' ||
        code === 'PGRST205' ||
        message.includes('Could not find the table')
    );
}

/** Chỉ đơn giao hàng (`orders`) — không gộp phiếu thu hồi vỏ. */
const ShippingTasks = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const focusOrderId = searchParams.get('focusOrderId');
    const focusTransferId = searchParams.get('focusTransferId');
    const { role, loading: permissionsLoading } = usePermissions();
    const [orders, setOrders] = useState([]);
    const [transferTasks, setTransferTasks] = useState([]);
    const [recoveryTasks, setRecoveryTasks] = useState([]);
    const [receiptTasks, setReceiptTasks] = useState([]);
    const [issueTasks, setIssueTasks] = useState([]);
    const [customersMap, setCustomersMap] = useState({});
    const [suppliersMap, setSuppliersMap] = useState({});
    const [warehouseNameById, setWarehouseNameById] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedRecovery, setSelectedRecovery] = useState(null);
    const [recoveryConfirmItems, setRecoveryConfirmItems] = useState([]);
    const [isRecoveryConfirmOpen, setIsRecoveryConfirmOpen] = useState(false);
    const [isSubmittingRecoveryConfirm, setIsSubmittingRecoveryConfirm] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);
    const [notes, setNotes] = useState('');
    const [deliveryStatus, setDeliveryStatus] = useState('HOAN_THANH');
    const [activeView, setActiveView] = useState('list');
    const [kanbanMode, setKanbanMode] = useState('shipper'); // shipper | order_status | transfer_status | task_type
    const [machineChecklist, setMachineChecklist] = useState({});
    /** Dòng order_items của đơn đang mở modal giao — cần để gom mã máy giống OrderStatusUpdater */
    const [shippingOrderItems, setShippingOrderItems] = useState([]);
    const [transferHandoverRecord, setTransferHandoverRecord] = useState(null);
    const [transferActionTab, setTransferActionTab] = useState('actions');
    const [transferChecklist, setTransferChecklist] = useState({});
    const [confirmTransferCheck, setConfirmTransferCheck] = useState(false);
    const [handoverProofBase64, setHandoverProofBase64] = useState('');
    const [isSubmittingTransferHandover, setIsSubmittingTransferHandover] = useState(false);
    const [selectedGoodsIssue, setSelectedGoodsIssue] = useState(null);
    const [isGoodsIssueModalOpen, setIsGoodsIssueModalOpen] = useState(false);
    const [selectedGoodsReceipt, setSelectedGoodsReceipt] = useState(null);
    const [isGoodsReceiptModalOpen, setIsGoodsReceiptModalOpen] = useState(false);
    const [transportConfirm, setTransportConfirm] = useState(null);
    const [selectedTaskKeys, setSelectedTaskKeys] = useState([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const selectAllRef = useRef(null);
    useEffect(() => {
        if (permissionsLoading) return;
        fetchShippingTasks();
    }, [role, permissionsLoading]);

    const fetchShippingTasks = async () => {
        setIsLoading(true);
        try {
            const storageUserName =
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                '';
            const shipperOnly = isShipperRole(role) && !isAdminRole(role);

            const shipperKey = String(storageUserName || '').trim();
            let orderQuery = supabase
                .from('orders')
                .select('*')
                .in('status', ORDER_STATUSES_SHIPPING_PIPELINE)
                .order('created_at', { ascending: false });
            const { data: orderData, error: orderError } = await orderQuery;
            if (orderError) throw orderError;

            let pipelineOrders = (orderData || []).filter((o) =>
                isShippingPipelineOrderStatus(o.status),
            );
            if (shipperOnly) {
                pipelineOrders = pipelineOrders.filter((o) =>
                    deliveryUnitMatchesShipper(o.delivery_unit, shipperKey),
                );
            }
            setOrders(pipelineOrders);

            // Also load inventory transfer requests so "Luân chuyển" shows up in Vận chuyển.
            let recoveryQuery = supabase
                .from('cylinder_recoveries')
                .select('*')
                .in('status', ['DANG_THU_HOI', 'CHO_PHAN_CONG'])
                .order('created_at', { ascending: false })
            let receiptQuery = supabase
                .from('goods_receipts')
                .select('*')
                .in('status', ['DA_NHAP', 'CHO_DUYET'])
                .order('created_at', { ascending: false })
                .limit(300);

            let issueQuery = supabase
                .from('goods_issues')
                .select('*')
                .in('status', ['DA_XUAT', 'CHO_DUYET'])
                .order('created_at', { ascending: false })
                .limit(300);

            if (shipperOnly) {
                const shipperFilter = shipperKey || '__NO_SHIPPER_NAME__';
                recoveryQuery = recoveryQuery.eq('driver_name', shipperFilter);
                receiptQuery = receiptQuery.eq('deliverer_name', shipperFilter);
                issueQuery = issueQuery.eq('deliverer_name', shipperFilter);
            }

            const [
                { data: transferRows, error: transferError },
                { data: whRows, error: whError },
                { data: recoveryRows, error: recoveryErr },
                { data: customerRows, error: custErr },
                { data: receiptRows, error: receiptErr },
                { data: issueRows, error: issueErr },
                { data: supplierRows, error: supErr }
            ] = await Promise.all([
                    supabase
                        .from('inventory_transfer_requests')
                        .select('*')
                        .eq('status', TRANSFER_STATUS_SHIPPING_VISIBLE)
                        .order('created_at', { ascending: false })
                        .limit(300),
                    supabase
                        .from('warehouses')
                        .select('id, name')
                        .order('name'),
                    recoveryQuery,
                    supabase.from('customers').select('id, name, phone, address'),
                    receiptQuery,
                    issueQuery,
                    supabase.from('suppliers').select('id, name')
                ]);

            if (transferError) throw transferError;
            if (whError) throw whError;
            if (recoveryErr) throw recoveryErr;
            if (custErr) throw custErr;
            if (receiptErr) throw receiptErr;
            if (issueErr && !isMissingSupabaseTableError(issueErr)) throw issueErr;
            if (supErr) throw supErr;

            if (issueErr && isMissingSupabaseTableError(issueErr)) {
                console.warn('[ShippingTasks] Thiếu bảng goods_issues — chạy setup_goods_issues.sql trên Supabase.');
            }

            const whMap = Object.fromEntries([...buildWarehouseLabelMap(whRows || [])]);
            setWarehouseNameById(whMap);
            setTransferTasks(Array.isArray(transferRows) ? transferRows : []);
            setRecoveryTasks(Array.isArray(recoveryRows) ? recoveryRows : []);
            setReceiptTasks(Array.isArray(receiptRows) ? receiptRows : []);
            setIssueTasks(issueErr ? [] : (Array.isArray(issueRows) ? issueRows : []));
            
            const custMap = Object.fromEntries((customerRows || []).map((c) => [String(c.id), c]));
            setCustomersMap(custMap);

            const supMap = Object.fromEntries((supplierRows || []).map((s) => [String(s.id), s]));
            setSuppliersMap(supMap);
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
            if (!isCloudinaryConfigured()) {
                throw new Error(
                    'Chưa cấu hình Cloudinary. Thêm VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET vào .env, rồi khởi động lại npm run dev.',
                );
            }
            for (const file of files) {
                const { url } = await uploadDeliveryProofFile(
                    file,
                    `plasmavn/delivery_proofs/shipping/${selectedOrder?.order_code || 'tasks'}`,
                );
                newImages.push(url);
            }
            setUploadedImages(newImages);
            setDeliveryStatus('HOAN_THANH');
            toast.success(`Đã tải lên Cloudinary ${files.length} ảnh.`);

            const machineSerials = resolveMachineSerialsForShippingConfirm(selectedOrder, shippingOrderItems);
            const autoChecklist = { ...machineChecklist };
            machineSerials.forEach((serial) => {
                autoChecklist[serial] = true;
            });
            if (machineSerials.length > 0) {
                setMachineChecklist(autoChecklist);
            }

            setTimeout(() => {
                void confirmDelivery({
                    images: newImages,
                    status: 'HOAN_THANH',
                    machineChecklist: autoChecklist,
                });
            }, 0);
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
        setTransferHandoverRecord(null);
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

    const openTransferHandover = useCallback(
        (tr) => {
            if (!tr?.id) return;
            setIsConfirmModalOpen(false);
            setSelectedOrder(null);
            setShippingOrderItems([]);
            setTransferHandoverRecord(normalizeTransferActionRecord(tr, warehouseNameById));
            setTransferActionTab('actions');
        },
        [warehouseNameById],
    );

    const openRecoveryConfirmModal = useCallback(async (recovery) => {
        if (!recovery?.id) return;
        try {
            const { data: itemRows, error } = await supabase
                .from('cylinder_recovery_items')
                .select('id, serial_number, condition, note')
                .eq('recovery_id', recovery.id)
                .order('created_at', { ascending: true });
            if (error) throw error;

            setSelectedRecovery(recovery);
            setRecoveryConfirmItems(itemRows || []);
            setIsRecoveryConfirmOpen(true);
        } catch (err) {
            console.error(err);
            toast.error('Không tải được danh sách mã bình: ' + (err?.message || ''));
        }
    }, []);

    const closeRecoveryConfirmModal = useCallback(() => {
        setIsRecoveryConfirmOpen(false);
        setSelectedRecovery(null);
        setRecoveryConfirmItems([]);
    }, []);

    const confirmRecoveryDelivery = async (photoUrls = []) => {
        if (!selectedRecovery?.id) return;
        if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
            toast.error('Vui lòng chụp ít nhất một ảnh hiện trường.');
            return;
        }
        setIsSubmittingRecoveryConfirm(true);
        try {
            const res = await tryQuickCompleteRecovery(supabase, selectedRecovery.id, { photos: photoUrls });
            if (res?.ok) {
                closeRecoveryConfirmModal();
                fetchShippingTasks();
            }
        } catch (err) {
            console.error(err);
            toast.error('Xác nhận thu hồi thất bại: ' + (err?.message || ''));
        } finally {
            setIsSubmittingRecoveryConfirm(false);
        }
    };

    const openTransportConfirmModal = useCallback(async (kind, row) => {
        if (!row?.id) return;
        const table = kind === 'ISSUE' ? 'goods_issues' : 'goods_receipts';
        try {
            const { data, error } = await supabase.from(table).select('*').eq('id', row.id).single();
            if (error) throw error;
            const partyName =
                kind === 'ISSUE'
                    ? suppliersMap[String(data.supplier_id)]?.name || '—'
                    : data.supplier_name || '—';
            setTransportConfirm({ kind, record: data, partyName });
        } catch (err) {
            console.error(err);
            toast.error('Không tải được phiếu: ' + (err?.message || ''));
        }
    }, [suppliersMap]);

    const closeTransportConfirmModal = useCallback(() => {
        setTransportConfirm(null);
    }, []);

    const openGoodsIssueEditModal = useCallback(async (issueRow) => {
        if (!issueRow?.id) return;
        try {
            const { data, error } = await supabase.from('goods_issues').select('*').eq('id', issueRow.id).single();
            if (error) throw error;
            setSelectedGoodsIssue(data);
            setIsGoodsIssueModalOpen(true);
        } catch (err) {
            toast.error('Không tải được phiếu xuất: ' + (err?.message || ''));
        }
    }, []);

    const closeGoodsIssueEditModal = useCallback(() => {
        setIsGoodsIssueModalOpen(false);
        setSelectedGoodsIssue(null);
    }, []);

    const openGoodsReceiptEditModal = useCallback(async (receiptRow) => {
        if (!receiptRow?.id) return;
        try {
            const { data, error } = await supabase.from('goods_receipts').select('*').eq('id', receiptRow.id).single();
            if (error) throw error;
            setSelectedGoodsReceipt(data);
            setIsGoodsReceiptModalOpen(true);
        } catch (err) {
            toast.error('Không tải được phiếu nhập: ' + (err?.message || ''));
        }
    }, []);

    const closeGoodsReceiptEditModal = useCallback(() => {
        setIsGoodsReceiptModalOpen(false);
        setSelectedGoodsReceipt(null);
    }, []);

    const openGiaoHangTask = useCallback(
        (task) => {
            if (!task?.row) return;
            if (task.kind === 'TRANSFER') {
                openTransferHandover(task.row);
                return;
            }
            if (task.kind === 'RECOVERY') {
                void openRecoveryConfirmModal(task.row);
                return;
            }
            if (task.kind === 'RECEIPT') {
                void openTransportConfirmModal('RECEIPT', task.row);
                return;
            }
            if (task.kind === 'ISSUE') {
                void openTransportConfirmModal('ISSUE', task.row);
                return;
            }
            if (task.kind === 'ORDER') {
                if (!canOpenShippingDeliveryConfirm(task.row.status)) {
                    toast.info('Đơn không còn ở bước xác nhận giao trên màn nhiệm vụ.');
                    return;
                }
                void openDeliveryConfirmModal(task.row);
            }
        },
        [
            openDeliveryConfirmModal,
            openTransportConfirmModal,
            openRecoveryConfirmModal,
            openTransferHandover,
        ],
    );

    const closeTransferHandover = useCallback(() => {
        setTransferHandoverRecord(null);
    }, []);

    useEffect(() => {
        if (!transferHandoverRecord) return;
        const nextChecklist = {};
        transferHandoverRecord.items.forEach((item, idx) => {
            nextChecklist[`${idx}:${item.itemName}:${item.itemType}`] = false;
        });
        setTransferChecklist(nextChecklist);
        setConfirmTransferCheck(false);
        setHandoverProofBase64('');
    }, [transferHandoverRecord?.id]);

    const handleTransferHandoverImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setHandoverProofBase64(reader.result);
        reader.readAsDataURL(file);
    };

    const confirmTransferHandover = async () => {
        if (!transferHandoverRecord) return;
        if (!confirmTransferCheck) {
            toast.error('Bạn cần xác nhận đã bàn giao hàng cho kho nhận.');
            return;
        }

        setIsSubmittingTransferHandover(true);
        try {
            const { proofUrl } = await persistTransferHandover({
                transferRequestId: transferHandoverRecord.id,
                transferCode: transferHandoverRecord.transferCode,
                handoverProofBase64,
                transferChecklist,
            });

            toast.success('Đã xác nhận bàn giao luân chuyển.');
            closeTransferHandover();
            fetchShippingTasks();
        } catch (error) {
            console.error('Confirm transfer handover failed:', error);
            toast.error('Xác nhận luân chuyển thất bại: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSubmittingTransferHandover(false);
        }
    };

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
            if (canOpenShippingDeliveryConfirm(order.status)) {
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

    /** Mở thao tác bàn giao luân chuyển từ URL (?focusTransferId=). */
    useEffect(() => {
        if (!focusTransferId || isLoading) return;
        const transfer = transferTasks.find((tr) => String(tr.id) === String(focusTransferId));
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('focusTransferId');
                return next;
            },
            { replace: true },
        );
        if (transfer) {
            setActiveView('list');
            openTransferHandover(transfer);
        } else if (transferTasks.length > 0) {
            toast.info('Phiếu luân chuyển chưa duyệt hoặc không nằm trong danh sách nhiệm vụ giao.');
        }
    }, [focusTransferId, isLoading, transferTasks, setSearchParams, openTransferHandover]);

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

    const confirmDelivery = async (options = {}) => {
        if (!selectedOrder) return;
        const images = options.images ?? uploadedImages;
        const effectiveStatus = options.status ?? deliveryStatus;
        const checklistOverride = options.machineChecklist ?? machineChecklist;

        const machineSerialsForConfirm = resolveMachineSerialsForShippingConfirm(
            selectedOrder,
            shippingOrderItems,
        );
        
        if (effectiveStatus === 'TRA_HANG' && !notes.trim()) {
            toast.error('Vui lòng nhập lý do giao hàng chưa thành công!');
            return;
        }
        if (effectiveStatus === 'HOAN_THANH' && machineSerialsForConfirm.length > 0) {
            const uncheckedMachines = machineSerialsForConfirm.filter((serial) => !checklistOverride[serial]);
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
                effectiveStatus !== 'HOAN_THANH' ? 'TRA_HANG' : 'HOAN_THANH';
            const notePrefix = finalStatus === 'TRA_HANG' ? '[Lý do Giao Không Thành Công]: ' : '[Ghi chú Shipper]: ';
            const newNoteText = notes ? `\n${notePrefix}${notes}` : '';
            const proofUrls = images.filter((url) => isCloudinaryDeliveryUrl(url));
            if (finalStatus === 'HOAN_THANH' && images.length > 0 && proofUrls.length !== images.length) {
                throw new Error('Một hoặc nhiều ảnh chưa upload Cloudinary. Vui lòng chọn lại ảnh sau khi cấu hình .env.');
            }
            const firstProof = proofUrls[0] || '';
            const deliveryImageUrl = finalStatus === 'HOAN_THANH'
                ? (firstProof || selectedOrder.delivery_image_url || null)
                : selectedOrder.delivery_image_url;
            const deliveryProofBase64 = finalStatus === 'HOAN_THANH' && firstProof
                ? firstProof
                : (isCloudinaryDeliveryUrl(selectedOrder.delivery_proof_base64)
                    ? selectedOrder.delivery_proof_base64
                    : null);

            /** Gộp tick máy shipper vào JSON (đồng bộ với OrderStatusUpdater / parseCylinderSerialsFromOrder). */
            let nextDeliveryChecklist =
                selectedOrder.delivery_checklist && typeof selectedOrder.delivery_checklist === 'object'
                    ? { ...selectedOrder.delivery_checklist }
                    : {};
            if (finalStatus === 'HOAN_THANH' && machineSerialsForConfirm.length > 0) {
                machineSerialsForConfirm.forEach((sn) => {
                    if (checklistOverride[sn]) {
                        nextDeliveryChecklist[`MAY:${sn}`] = true;
                    }
                });
            }

            const orderUpdatePayload = {
                status: finalStatus,
                delivery_image_url: deliveryImageUrl,
                delivery_proof_base64: deliveryProofBase64,
                note: (selectedOrder.note || '') + newNoteText,
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
                            customer_id: selectedOrder.customer_id || null,
                            updated_at: new Date().toISOString(),
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
        if (isTerminalShippingOrderStatus(order.status)) return false;
        return (
            !searchTerm ||
            order.order_code?.toLowerCase().includes(q) ||
            order.customer_name?.toLowerCase().includes(q) ||
            order.recipient_name?.toLowerCase().includes(q) ||
            order.recipient_address?.toLowerCase().includes(q) ||
            (order.recipient_phone || '').includes(searchTerm)
        );
    });

    const filteredTransfers = transferTasks.filter((tr) => {
        if (isTransferHandoverCompleted(tr)) return false;
        if (String(tr.status || '').trim().toUpperCase() !== TRANSFER_STATUS_SHIPPING_VISIBLE) return false;
        if (!searchTerm) return true;
        const q2 = searchTerm.toLowerCase();
        return (
            String(tr.transfer_code || '').toLowerCase().includes(q2) ||
            String(tr.status || '').toLowerCase().includes(q2) ||
            String(tr.note || '').toLowerCase().includes(q2) ||
            String(tr.created_by || '').toLowerCase().includes(q2) ||
            String(warehouseNameById[String(tr.from_warehouse_id)] || tr.from_warehouse_id || '').toLowerCase().includes(q2) ||
            String(warehouseNameById[String(tr.to_warehouse_id)] || tr.to_warehouse_id || '').toLowerCase().includes(q2)
        );
    });

    const filteredRecoveries = recoveryTasks.filter((rec) => {
        if (rec.status === 'HOAN_THANH' || rec.status === 'HUY') return false;
        if (!searchTerm) return true;
        const q2 = searchTerm.toLowerCase();
        return (
            String(rec.recovery_code || '').toLowerCase().includes(q2) ||
            String(rec.driver_name || '').toLowerCase().includes(q2)
        );
    });

    const filteredReceipts = receiptTasks.filter((rec) => {
        if (!searchTerm) return true;
        const q2 = searchTerm.toLowerCase();
        return (
            String(rec.receipt_code || '').toLowerCase().includes(q2) ||
            String(rec.supplier_name || '').toLowerCase().includes(q2) ||
            String(rec.deliverer_name || '').toLowerCase().includes(q2)
        );
    });

    const filteredIssues = issueTasks.filter((iss) => {
        if (!searchTerm) return true;
        const q2 = searchTerm.toLowerCase();
        return (
            String(iss.issue_code || '').toLowerCase().includes(q2) ||
            String(iss.deliverer_name || '').toLowerCase().includes(q2)
        );
    });

    const combinedTasks = [
        ...filteredOrders.map((order) => ({ kind: 'ORDER', row: order })), 
        ...filteredTransfers.map((tr) => ({ kind: 'TRANSFER', row: tr })),
        ...filteredRecoveries.map((rec) => ({ kind: 'RECOVERY', row: rec })),
        ...filteredReceipts.map((r) => ({ kind: 'RECEIPT', row: r })),
        ...filteredIssues.map((i) => ({ kind: 'ISSUE', row: i }))
    ].sort((a, b) => {
        const aTime = new Date(a.row?.created_at || a.row?.updated_at || 0).getTime();
        const bTime = new Date(b.row?.created_at || b.row?.updated_at || 0).getTime();
        return bTime - aTime;
    });

    const listTasks = combinedTasks;

    const listTaskKeys = listTasks.map(taskRowKey);
    const allListTasksSelected =
        listTaskKeys.length > 0 && listTaskKeys.every((k) => selectedTaskKeys.includes(k));
    const someListTasksSelected =
        listTaskKeys.some((k) => selectedTaskKeys.includes(k)) && !allListTasksSelected;

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = someListTasksSelected;
        }
    }, [someListTasksSelected]);

    const isTaskSelected = (it) => selectedTaskKeys.includes(taskRowKey(it));

    const toggleTaskSelected = (it) => {
        const key = taskRowKey(it);
        setSelectedTaskKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
    };

    const toggleSelectAllListTasks = () => {
        if (listTaskKeys.length === 0) return;
        if (allListTasksSelected) {
            setSelectedTaskKeys((prev) => prev.filter((k) => !listTaskKeys.includes(k)));
        } else {
            setSelectedTaskKeys((prev) => [...new Set([...prev, ...listTaskKeys])]);
        }
    };

    const clearTaskSelection = () => setSelectedTaskKeys([]);

    const handleBulkDelete = async () => {
        if (selectedTaskKeys.length === 0) return;
        if (
            !window.confirm(
                `Xóa ${selectedTaskKeys.length} nhiệm vụ đã chọn?\n\nĐơn hàng sẽ được hoàn tác tồn kho/bình/máy trước khi xóa. Thao tác không hoàn tác.`,
            )
        ) {
            return;
        }

        setBulkDeleting(true);
        try {
            const byKind = { ORDER: [], TRANSFER: [], RECOVERY: [], RECEIPT: [], ISSUE: [] };
            for (const key of selectedTaskKeys) {
                const p = parseTaskRowKey(key);
                if (!p || !byKind[p.kind]) continue;
                byKind[p.kind].push(p.id);
            }

            if (byKind.ORDER.length > 0) {
                const { deleted, failed } = await deleteOrdersWithRollback(supabase, byKind.ORDER);
                if (failed.length > 0) {
                    const detail = failed.map((f) => `• ${f.orderId}: ${f.message}`).join('\n');
                    throw new Error(
                        `Xóa đơn: ${deleted}/${byKind.ORDER.length} thành công.\n${detail}`,
                    );
                }
            }

            for (const chunk of chunkArray(byKind.TRANSFER, 80)) {
                if (!chunk.length) continue;
                const { error } = await supabase.from('inventory_transfer_requests').delete().in('id', chunk);
                if (error) throw error;
            }

            for (const chunk of chunkArray(byKind.RECOVERY, 80)) {
                if (!chunk.length) continue;
                const { error: errItems } = await supabase
                    .from('cylinder_recovery_items')
                    .delete()
                    .in('recovery_id', chunk);
                if (errItems) console.warn('cylinder_recovery_items delete:', errItems);
                const { error } = await supabase.from('cylinder_recoveries').delete().in('id', chunk);
                if (error) throw error;
            }

            for (const chunk of chunkArray(byKind.RECEIPT, 80)) {
                if (!chunk.length) continue;
                const { error } = await supabase.from('goods_receipts').delete().in('id', chunk);
                if (error) throw error;
            }

            for (const chunk of chunkArray(byKind.ISSUE, 80)) {
                if (!chunk.length) continue;
                const { error } = await supabase.from('goods_issues').delete().in('id', chunk);
                if (error) throw error;
            }

            toast.success(`Đã xóa ${selectedTaskKeys.length} nhiệm vụ`);
            setSelectedTaskKeys([]);
            await fetchShippingTasks();
        } catch (e) {
            console.error('Bulk delete shipping tasks:', e);
            toast.error('Lỗi xóa: ' + (e.message || String(e)));
        } finally {
            setBulkDeleting(false);
        }
    };

    const renderTaskCheckbox = (it) => (
        <input
            type="checkbox"
            checked={isTaskSelected(it)}
            onChange={() => toggleTaskSelected(it)}
            disabled={bulkDeleting}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary/20"
            aria-label="Chọn nhiệm vụ"
        />
    );

    const transferStatusBadge = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'DA_DUYET') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (s === 'TU_CHOI') return 'bg-rose-100 text-rose-800 border-rose-200';
        return 'bg-amber-100 text-amber-700 border-amber-200';
    };

    const transferStatusLabel = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'DA_DUYET') return 'Đã duyệt';
        if (s === 'TU_CHOI') return 'Từ chối';
        return 'Chờ duyệt';
    };

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

    // NOTE: Extra cross-module action buttons were removed per request.

    const shipModMachineSerials =
        isConfirmModalOpen && selectedOrder
            ? resolveMachineSerialsForShippingConfirm(selectedOrder, shippingOrderItems)
            : [];

    const renderCombinedTaskCards = () =>
        listTasks.map((it) => {
            if (it.kind === 'RECOVERY') {
                const rec = it.row;
                const cust = customersMap[String(rec.customer_id)] || {};
                const customerName = cust.name || rec.customer_id || '—';
                const customerPhone = cust.phone || '—';
                const customerAddress = cust.address || '—';

                return (
                    <article key={`rec-${rec.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col gap-2', isTaskSelected(it) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-2 min-w-0 flex-1">
                                {renderTaskCheckbox(it)}
                                <div className="min-w-0">
                                <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded uppercase">Thu hồi vỏ</span>
                                <p className="text-[13px] font-black text-primary mt-1.5 leading-tight">{rec.recovery_code || '—'}</p>
                                </div>
                            </div>
                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase shrink-0', rec.status === 'DANG_THU_HOI' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                                {rec.status === 'DANG_THU_HOI' ? 'Đang thu hồi' : 'Chờ phân công'}
                            </span>
                        </div>

                        {/* Thông tin khách hàng */}
                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col gap-1 border border-slate-100 mt-1">
                            <p className="text-[11px] font-bold text-slate-800 line-clamp-2">Khách hàng: {customerName}</p>
                            <p className="text-[10px] text-slate-600 font-medium">SĐT: {customerPhone}</p>
                            <p className="text-[10px] text-slate-600 line-clamp-2" title={customerAddress}>Địa chỉ: {customerAddress}</p>
                        </div>

                        {rec.notes ? (
                            <p className="text-[10px] text-slate-500 line-clamp-2" title={String(rec.notes)}>{rec.notes}</p>
                        ) : null}
                        <p className="text-[10px] text-slate-500 mb-1">Số lượng thu: <span className="font-bold text-slate-700">{rec.requested_quantity ?? '—'}</span></p>
                        
                        <div className="mt-auto pt-1">
                            <button type="button" className={clsx(giaoHangActionBtnCls, 'w-full py-2 text-[10px] bg-amber-500 border-amber-500 text-white hover:bg-amber-600')} onClick={() => openRecoveryConfirmModal(rec)}>
                                Xác nhận thu hồi
                            </button>
                        </div>
                    </article>
                );
            }
            if (it.kind === 'RECEIPT') {
                const rec = it.row;
                return (
                    <article key={`receipt-${rec.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col gap-2', isTaskSelected(it) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-2 min-w-0 flex-1">
                                {renderTaskCheckbox(it)}
                                <div className="min-w-0">
                                <span className="inline-block text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase">Nhập hàng NCC</span>
                                <p className="text-[13px] font-black text-primary mt-1.5 leading-tight">{rec.receipt_code || '—'}</p>
                                </div>
                            </div>
                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase shrink-0', 'bg-blue-100 text-blue-700')}>
                                Chờ vận chuyển
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col gap-1 border border-slate-100 mt-1">
                            <p className="text-[11px] font-bold text-slate-800 line-clamp-2">NCC: {rec.supplier_name || '—'}</p>
                            <p className="text-[10px] text-slate-600 line-clamp-2" title={rec.deliverer_address}>Địa chỉ nhận: {rec.deliverer_address || '—'}</p>
                        </div>
                        
                        <div className="mt-auto pt-1">
                            <button type="button" className={clsx(giaoHangActionBtnCls, 'w-full py-2 text-[10px] bg-teal-500 border-teal-500 text-white hover:bg-teal-600')} onClick={() => openTransportConfirmModal('RECEIPT', rec)}>
                                Xác nhận vận chuyển
                            </button>
                        </div>
                    </article>
                );
            }
            if (it.kind === 'ISSUE') {
                const iss = it.row;
                const supplierName = suppliersMap[String(iss.supplier_id)]?.name || '—';
                return (
                    <article key={`issue-${iss.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col gap-2', isTaskSelected(it) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-2 min-w-0 flex-1">
                                {renderTaskCheckbox(it)}
                                <div className="min-w-0">
                                <span className="inline-block text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase">Xuất trả NCC</span>
                                <p className="text-[13px] font-black text-primary mt-1.5 leading-tight">{iss.issue_code || '—'}</p>
                                </div>
                            </div>
                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase shrink-0', 'bg-blue-100 text-blue-700')}>
                                Chờ vận chuyển
                            </span>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col gap-1 border border-slate-100 mt-1">
                            <p className="text-[11px] font-bold text-slate-800 line-clamp-2">NCC: {supplierName}</p>
                            <p className="text-[10px] text-slate-600 line-clamp-2" title={iss.deliverer_address}>Địa chỉ giao: {iss.deliverer_address || '—'}</p>
                        </div>
                        
                        <div className="mt-auto pt-1">
                            <button type="button" className={clsx(giaoHangActionBtnCls, 'w-full py-2 text-[10px] bg-rose-500 border-rose-500 text-white hover:bg-rose-600')} onClick={() => openTransportConfirmModal('ISSUE', iss)}>
                                Xác nhận vận chuyển
                            </button>
                        </div>
                    </article>
                );
            }
            if (it.kind === 'TRANSFER') {
                const tr = it.row;
                const fromName = warehouseNameById[String(tr.from_warehouse_id)] || tr.from_warehouse_id || '—';
                const toName = warehouseNameById[String(tr.to_warehouse_id)] || tr.to_warehouse_id || '—';
                return (
                    <article key={`tr-${tr.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col gap-2', isTaskSelected(it) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-2 min-w-0 flex-1">
                                {renderTaskCheckbox(it)}
                                <div className="min-w-0">
                                <span className="inline-block text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded uppercase">Luân chuyển</span>
                                <p className="text-[13px] font-black text-primary mt-1.5 leading-tight">{tr.transfer_code || '—'}</p>
                                <p className="text-[11px] font-semibold text-slate-800 mt-0.5 line-clamp-2">{fromName} → {toName}</p>
                                </div>
                            </div>
                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase shrink-0', transferStatusBadge(tr.status))}>
                                {transferStatusLabel(tr.status)}
                            </span>
                        </div>
                        {tr.note ? (
                            <p className="text-[10px] text-slate-500 line-clamp-2" title={String(tr.note)}>{tr.note}</p>
                        ) : null}
                        <p className="text-[10px] text-slate-500">SL: <span className="font-bold text-slate-700">{tr.total_quantity ?? '—'}</span></p>
                        <button type="button" className={clsx(giaoHangActionBtnCls, 'w-full py-2 text-[10px]')} onClick={() => openGiaoHangTask(it)} title="Mở phiếu xác nhận bàn giao luân chuyển">
                            Giao hàng
                        </button>
                    </article>
                );
            }

            const order = it.row;
            return (
                <article key={`od-${order.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 flex flex-col gap-2', isTaskSelected(it) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-2 min-w-0 flex-1">
                            {renderTaskCheckbox(it)}
                            <div className="min-w-0">
                            <span className="inline-block text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase">Giao hàng</span>
                            <p className="text-[13px] font-black text-primary mt-1.5 leading-tight">#{order.order_code}</p>
                            <p className="text-[11px] font-semibold text-slate-800 mt-0.5 line-clamp-2">{order.recipient_name || order.customer_name}</p>
                            </div>
                        </div>
                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getStatusBadge(order.status))}>
                            {getStatusLabel(order.status)}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-600 line-clamp-2" title={order.recipient_address || ''}>{order.recipient_address || '—'}</p>
                    {order.recipient_phone ? (
                        <a href={`tel:${order.recipient_phone}`} className="text-[11px] text-primary font-bold hover:underline">{order.recipient_phone}</a>
                    ) : null}
                    <p className="text-[10px] text-slate-500">{order.product_type || '—'} — SL: {order.quantity ?? '—'}</p>
                    {canOpenShippingDeliveryConfirm(order.status) ? (
                        <button type="button" className={clsx(giaoHangActionBtnCls, 'w-full py-2 text-[10px]')} onClick={() => openGiaoHangTask(it)}>
                            Giao hàng
                        </button>
                    ) : (
                        <span className="w-full flex items-center justify-center py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[9px] font-bold uppercase">
                            {getStatusLabel(order.status)}
                        </span>
                    )}
                </article>
            );
        });

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
                        <p className="hidden sm:block text-[11px] text-slate-500 font-semibold mt-0.5">
                            Đơn giao hàng và phiếu luân chuyển — bấm «Giao hàng» để mở phiếu xác nhận trực tiếp trên trang này.
                        </p>
                    </div>
                </div>

                <div className="mb-3 flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                    {[
                        { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                        { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={16} />, desktopOnly: true },
                    ].map((view) => (
                        <button
                            key={view.id}
                            type="button"
                            onClick={() => setActiveView(view.id)}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-bold transition-all',
                                view.desktopOnly && 'hidden md:flex',
                                activeView === view.id
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-500',
                            )}
                        >
                            {view.icon} {view.label}
                        </button>
                    ))}
                </div>

                {activeView === 'kanban' && (
                    <div className="mb-3 hidden md:block">
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { id: 'shipper', label: 'Theo ĐV giao (Đơn)' },
                                { id: 'order_status', label: 'Theo Trạng thái (Đơn)' },
                                { id: 'transfer_status', label: 'Theo Trạng thái (Luân chuyển)' },
                                { id: 'task_type', label: 'Theo Loại nhiệm vụ' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setKanbanMode(opt.id)}
                                    className={clsx(
                                        'px-3 py-2 rounded-xl border text-[12px] font-black transition-all',
                                        kanbanMode === opt.id
                                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 mt-2">
                            Chọn cách chia cột Kanban (không hiển thị 2 cấp).
                        </p>
                    </div>
                )}

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

                {listTasks.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    checked={allListTasksSelected}
                                    onChange={toggleSelectAllListTasks}
                                    disabled={bulkDeleting || listTaskKeys.length === 0}
                                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                                />
                                Chọn tất cả ({listTaskKeys.length})
                            </label>
                            <button
                                type="button"
                                onClick={clearTaskSelection}
                                disabled={selectedTaskKeys.length === 0 || bulkDeleting}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-black text-slate-500 disabled:opacity-40"
                            >
                                Bỏ chọn
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={selectedTaskKeys.length === 0 || bulkDeleting}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-black text-rose-700 disabled:opacity-40"
                            >
                                <Trash2 size={12} />
                                {bulkDeleting ? 'Đang xóa…' : `Xóa (${selectedTaskKeys.length})`}
                            </button>
                        </div>
                        {selectedTaskKeys.length > 0 && (
                            <p className="text-[10px] font-semibold text-slate-500">
                                Đang chọn {selectedTaskKeys.length} nhiệm vụ (đơn / luân chuyển / thu hồi / nhập / xuất).
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                {isLoading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-primary" size={32} />
                        <p className="text-slate-500 font-medium">Đang tải danh sách nhiệm vụ...</p>
                    </div>
                ) : combinedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Truck size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Không có nhiệm vụ nào</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Thử làm mới trang hoặc bỏ ô tìm kiếm. Danh sách gồm đơn giao hàng và phiếu luân chuyển đã duyệt.
                        </p>
                        <button 
                            onClick={fetchShippingTasks}
                            className="mt-6 text-primary font-bold text-sm bg-primary/10 px-6 py-2 rounded-full"
                        >
                            Tải lại trang
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2 md:hidden">
                            {listTasks.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-[11px] font-semibold text-slate-400">
                                    Không có nhiệm vụ phù hợp.
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {renderCombinedTaskCards()}
                                </div>
                            )}
                        </div>
                        <div className="hidden md:block">
                            {activeView === 'list' ? (
                                <div className="space-y-3">
                                    {listTasks.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-[11px] font-semibold text-slate-400">
                                            Không có nhiệm vụ phù hợp.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                            {renderCombinedTaskCards()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                    <div className="space-y-5">
                        <div className="overflow-x-auto overflow-y-hidden">
                            {(() => {
                                if (kanbanMode === 'transfer_status') {
                                    const byStatus = filteredTransfers.reduce((acc, tr) => {
                                        const k = String(tr.status || 'CHO_DUYET').trim().toUpperCase();
                                        if (!acc[k]) acc[k] = [];
                                        acc[k].push(tr);
                                        return acc;
                                    }, {});
                                    const statusOrder = ['CHO_DUYET', 'DA_DUYET', 'TU_CHOI'];
                                    const cols = statusOrder
                                        .filter((k) => byStatus[k]?.length)
                                        .concat(Object.keys(byStatus).filter((k) => !statusOrder.includes(k)));
                                    if (cols.length === 0) {
                                        return (
                                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-center text-[12px] font-semibold text-slate-400">
                                                Không có phiếu luân chuyển phù hợp.
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                                            {cols.map((st) => {
                                                const list = byStatus[st] || [];
                                                return (
                                                    <div key={st} className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0">
                                                        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                            <p className="text-[12px] font-bold text-slate-700 truncate pr-2">
                                                                {transferStatusLabel(st)}
                                                            </p>
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                                                                {list.length}
                                                            </span>
                                                        </div>
                                                        <div className="p-2.5 space-y-2 overflow-y-auto min-h-0">
                                                            {list.map((tr) => {
                                                                const fromName = warehouseNameById[String(tr.from_warehouse_id)] || tr.from_warehouse_id || '—';
                                                                const toName = warehouseNameById[String(tr.to_warehouse_id)] || tr.to_warehouse_id || '—';
                                                                return (
                                                                    <div key={tr.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all">
                                                                        <div>
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <p className="text-[12px] font-bold text-primary">
                                                                                    {tr.transfer_code || '—'}
                                                                                </p>
                                                                                <span
                                                                                    className={clsx(
                                                                                        'px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0',
                                                                                        transferStatusBadge(tr.status),
                                                                                    )}
                                                                                >
                                                                                    {transferStatusLabel(tr.status)}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-100 px-1 py-0.5 rounded mt-1.5 inline-block uppercase">
                                                                                inventory_transfer_requests
                                                                            </p>
                                                                            <p className="text-[12px] font-bold text-slate-800 mt-1 line-clamp-2">
                                                                                {fromName} → {toName}
                                                                            </p>
                                                                            {tr.note ? (
                                                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2" title={String(tr.note)}>
                                                                                    {tr.note}
                                                                                </p>
                                                                            ) : null}
                                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                                SL: <span className="font-bold text-slate-700">{tr.total_quantity ?? '—'}</span>
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                                            <button
                                                                                type="button"
                                                                                className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto"
                                                                                onClick={() => openGiaoHangTask({ kind: 'TRANSFER', row: tr })}
                                                                                title="Mở thao tác xác nhận bàn giao luân chuyển"
                                                                            >
                                                                                Giao hàng
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                if (kanbanMode === 'task_type') {
                                    const cols = [
                                        { id: 'ORDER', label: 'Giao hàng', items: filteredOrders.map((o) => ({ kind: 'ORDER', row: o })) },
                                        { id: 'TRANSFER', label: 'Luân chuyển', items: filteredTransfers.map((t) => ({ kind: 'TRANSFER', row: t })) },
                                    ].filter((c) => c.items.length > 0);
                                    if (cols.length === 0) {
                                        return (
                                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6 text-center text-[12px] font-semibold text-slate-400">
                                                Không có nhiệm vụ phù hợp.
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                                            {cols.map((col) => (
                                                <div key={col.id} className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0">
                                                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                        <p className="text-[12px] font-bold text-slate-700 truncate pr-2">{col.label}</p>
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                                                            {col.items.length}
                                                        </span>
                                                    </div>
                                                    <div className="p-2.5 space-y-2 overflow-y-auto min-h-0">
                                                        {col.items.map((it) => {
                                                            if (it.kind === 'TRANSFER') {
                                                                const tr = it.row;
                                                                const fromName = warehouseNameById[String(tr.from_warehouse_id)] || tr.from_warehouse_id || '—';
                                                                const toName = warehouseNameById[String(tr.to_warehouse_id)] || tr.to_warehouse_id || '—';
                                                                return (
                                                                    <div key={`tr-${tr.id}`} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <p className="text-[12px] font-bold text-primary">{tr.transfer_code || '—'}</p>
                                                                            <span className={clsx('px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase shrink-0', transferStatusBadge(tr.status))}>
                                                                                {transferStatusLabel(tr.status)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[12px] font-bold text-slate-800 line-clamp-2">{fromName} → {toName}</p>
                                                                        <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                                        <button type="button" className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto" onClick={() => openGiaoHangTask({ kind: 'TRANSFER', row: tr })} title="Mở phiếu xác nhận bàn giao luân chuyển">
                                                                                Giao hàng
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            const order = it.row;
                                                            return (
                                                                <div key={`od-${order.id}`} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <p className="text-[12px] font-bold text-primary">#{order.order_code}</p>
                                                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getStatusBadge(order.status))}>
                                                                            {getStatusLabel(order.status)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[12px] font-bold text-slate-800 line-clamp-2">{order.recipient_name || order.customer_name}</p>
                                                                    <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                                        {canOpenShippingDeliveryConfirm(order.status) ? (
                                                                            <button type="button" className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto" onClick={() => openGiaoHangTask({ kind: 'ORDER', row: order })}>
                                                                                Giao hàng
                                                                            </button>
                                                                        ) : (
                                                                            <span className="w-full min-w-0 flex items-center justify-center py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-[9px] font-bold text-center leading-tight uppercase">
                                                                                {getStatusLabel(order.status)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                }

                                if (kanbanMode === 'order_status') {
                                    const byStatus = filteredOrders.reduce((acc, o) => {
                                        const k = String(o.status || '—').trim();
                                        if (!acc[k]) acc[k] = [];
                                        acc[k].push(o);
                                        return acc;
                                    }, {});
                                    const statusOrder = ORDER_STATUSES_SHIPPING_PIPELINE;
                                    const cols = statusOrder
                                        .filter((k) => byStatus[k]?.length)
                                        .concat(Object.keys(byStatus).filter((k) => !statusOrder.includes(k)));
                                    return (
                                        <div className="grid grid-flow-col auto-cols-[280px] gap-3 min-h-full">
                                            {cols.map((st) => {
                                                const list = byStatus[st] || [];
                                                return (
                                                    <div key={st} className="rounded-xl border border-slate-200 bg-white flex flex-col min-h-0">
                                                        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                            <p className="text-[12px] font-bold text-slate-700 truncate pr-2">{getStatusLabel(st)}</p>
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">{list.length}</span>
                                                        </div>
                                                        <div className="p-2.5 space-y-2 overflow-y-auto min-h-0">
                                                            {list.map((order) => (
                                                                <div key={order.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <p className="text-[12px] font-bold text-primary">#{order.order_code}</p>
                                                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getStatusBadge(order.status))}>
                                                                            {getStatusLabel(order.status)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[12px] font-bold text-slate-800 line-clamp-2">{order.recipient_name || order.customer_name}</p>
                                                                    <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                                        {canOpenShippingDeliveryConfirm(order.status) ? (
                                                                            <button type="button" className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto" onClick={() => openGiaoHangTask({ kind: 'ORDER', row: order })}>
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
                                                );
                                            })}
                                        </div>
                                    );
                                }

                                // Default: shipper columns (orders)
                                return (
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
                                                        <div key={order.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex flex-col gap-2 hover:bg-white hover:shadow-sm transition-all">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-[12px] font-bold text-primary">#{order.order_code}</p>
                                                                <span className={clsx('px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0', getStatusBadge(order.status))}>
                                                                    {getStatusLabel(order.status)}
                                                                </span>
                                                            </div>
                                                            <p className="text-[12px] font-bold text-slate-800 line-clamp-2">{order.recipient_name || order.customer_name}</p>
                                                            <div className="flex flex-wrap items-stretch gap-1 pt-1.5 border-t border-slate-200/80">
                                                                {canOpenShippingDeliveryConfirm(order.status) ? (
                                                                    <button type="button" className="flex-1 min-w-[100px] py-1.5 rounded-md bg-primary text-white text-[10px] font-bold shadow-sm active:opacity-90 !h-auto" onClick={() => openGiaoHangTask({ kind: 'ORDER', row: order })}>
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
                                );
                            })()}
                        </div>
                    </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Modal Xác nhận */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-500">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Phiếu xác nhận giao hàng</h2>
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

            {transferHandoverRecord && createPortal(
                <div className="fixed inset-0 z-[100005] flex justify-end">
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeTransferHandover} />
                    <div className="relative bg-slate-50 shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div className="leading-tight">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Phiếu xác nhận bàn giao luân chuyển</h3>
                                    <p className="text-xs font-bold text-slate-500 tracking-wide">Mã: {transferHandoverRecord.transferCode}</p>
                                    <p className="text-[11px] font-semibold text-slate-500 mt-1 leading-snug">
                                        Dữ liệu ghi vào bảng nguồn{' '}
                                        <span className="font-mono text-slate-700">inventory_transfer_requests</span>: ghi chú bàn giao, checklist và ảnh xác nhận.
                                    </p>
                                </div>
                            </div>
                            <button type="button" onClick={closeTransferHandover} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-sm shadow-sm">
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Kho xuất</span><span className="font-black text-slate-900 text-right">{transferHandoverRecord.fromWarehouses.join(', ') || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Kho nhận</span><span className="font-black text-slate-900 text-right">{transferHandoverRecord.toWarehouses.join(', ') || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Số lượng</span><span className="font-black text-primary text-right">{transferHandoverRecord.totalQuantity}</span></div>
                            </div>
                            <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setTransferActionTab('actions')}
                                    className={clsx('h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center', transferActionTab === 'actions' ? 'bg-primary text-white shadow' : 'text-slate-500 hover:bg-slate-100')}
                                >
                                    Thao tác
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTransferActionTab('history')}
                                    className={clsx('h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center', transferActionTab === 'history' ? 'bg-primary text-white shadow' : 'text-slate-500 hover:bg-slate-100')}
                                >
                                    Lịch sử
                                </button>
                            </div>

                            {transferActionTab === 'actions' ? (
                                <div className="space-y-3">
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                            <CheckCircle2 className="w-4 h-4 text-primary" />
                                            Checklist bàn giao kho nhận
                                        </label>
                                        <div className="space-y-2 max-h-44 overflow-y-auto">
                                            {Object.entries(transferChecklist).map(([key, checked]) => {
                                                const [, itemName, itemType] = key.split(':');
                                                return (
                                                    <label key={key} className={clsx('flex items-center gap-2 p-2 rounded-xl border cursor-pointer', checked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => setTransferChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-[12px] font-semibold text-slate-700">{itemName} ({itemType})</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                            <Camera className="w-4 h-4 text-primary" />
                                            Ảnh xác nhận kho nhận
                                        </label>
                                        {handoverProofBase64 ? (
                                            <img src={handoverProofBase64} alt="Kho nhận xác nhận" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                                        ) : (
                                            <label className="h-28 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-sm font-bold text-slate-500 cursor-pointer hover:bg-slate-50">
                                                Chụp / chọn ảnh bàn giao
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleTransferHandoverImageChange} />
                                            </label>
                                        )}
                                    </div>

                                    <label className={clsx(
                                        'flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all',
                                        confirmTransferCheck ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200',
                                    )}>
                                        <input
                                            type="checkbox"
                                            checked={confirmTransferCheck}
                                            onChange={() => setConfirmTransferCheck((v) => !v)}
                                            className="w-5 h-5"
                                        />
                                        <span className={clsx('text-sm font-bold', confirmTransferCheck ? 'text-emerald-700' : 'text-slate-600')}>
                                            Tôi xác nhận đã bàn giao đầy đủ cho kho nhận
                                        </span>
                                    </label>

                                    <button
                                        type="button"
                                        disabled={isSubmittingTransferHandover}
                                        onClick={confirmTransferHandover}
                                        className="w-full p-4 rounded-2xl border border-primary bg-primary text-white font-black text-sm disabled:opacity-60"
                                    >
                                        {isSubmittingTransferHandover ? 'Đang xác nhận...' : 'Xác nhận hoàn tất luân chuyển'}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                                    {transferHandoverRecord.items.map((item, idx) => (
                                        <div key={`${transferHandoverRecord.id}-history-${idx}`} className="text-sm font-medium text-slate-700">
                                            {item.itemName} ({item.itemType}) x {item.quantity}
                                        </div>
                                    ))}
                                    <p className="text-xs text-slate-400 font-bold pt-2 border-t border-slate-100">
                                        {new Date(transferHandoverRecord.createdAt).toLocaleString('vi-VN')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,

                document.body,
            )}

            {isRecoveryConfirmOpen && selectedRecovery && (
                <RecoveryDeliveryConfirmModal
                    recovery={selectedRecovery}
                    items={recoveryConfirmItems}
                    isSubmitting={isSubmittingRecoveryConfirm}
                    onClose={closeRecoveryConfirmModal}
                    onConfirm={confirmRecoveryDelivery}
                />
            )}

            {transportConfirm && (
                <ShippingTransportConfirmModal
                    kind={transportConfirm.kind}
                    record={transportConfirm.record}
                    partyName={transportConfirm.partyName}
                    onClose={closeTransportConfirmModal}
                    onSuccess={() => {
                        closeTransportConfirmModal();
                        fetchShippingTasks();
                    }}
                    onEditDetails={(row) => {
                        closeTransportConfirmModal();
                        if (transportConfirm.kind === 'ISSUE') {
                            openGoodsIssueEditModal(row);
                        } else {
                            openGoodsReceiptEditModal(row);
                        }
                    }}
                />
            )}

            {isGoodsIssueModalOpen && selectedGoodsIssue && (
                <GoodsIssueFormModal
                    issue={selectedGoodsIssue}
                    onClose={closeGoodsIssueEditModal}
                    onSuccess={() => {
                        closeGoodsIssueEditModal();
                        fetchShippingTasks();
                    }}
                />
            )}

            {isGoodsReceiptModalOpen && selectedGoodsReceipt && (
                <GoodsReceiptFormModal
                    receipt={selectedGoodsReceipt}
                    onClose={closeGoodsReceiptEditModal}
                    onSuccess={() => {
                        closeGoodsReceiptEditModal();
                        fetchShippingTasks();
                    }}
                />
            )}

        </div>
    );
};

export default ShippingTasks;
