import { AlertCircle, AlertTriangle, ArrowRightCircle, Camera, Check, CheckCircle, CheckCircle2, Clock, CloudUpload, Package, Plus, ScanLine, Truck, X, XCircle, ZoomIn, FileText } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ORDER_STATE_TRANSITIONS, PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';
import OrderHistoryTimeline from './OrderHistoryTimeline';
import { notificationService } from '../../utils/notificationService';
import MachineIssueRequestForm from '../Machines/MachineIssueRequestForm';
import usePermissions from '../../hooks/usePermissions';

const parseNoteFieldList = (noteText, prefix) => {
    const lines = (noteText || '').split('\n').map(l => l.trim());
    const line = lines.find((l) => l.startsWith(prefix));
    if (!line) return [];
    const raw = line.replace(prefix, '').replace(/\.$/, '').trim();
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
};

const stripWarehouseAssignmentSection = (noteText) => {
    if (!noteText) return '';
    return noteText
        .replace(/\n*=== MÁY ĐÃ GÁN TỪ KHO ===[\s\S]*$/g, '')
        .trim();
};

const isMachineProductType = (productType) => {
    if (!productType) return false;
    const normalized = String(productType).trim();
    if (normalized.startsWith('MAY')) return true;
    return ['TM', 'SD', 'FM', 'Khac', 'KHAC', 'DNXM'].includes(normalized);
};

export default function OrderStatusUpdater({ order, warehouseName, userRole, onClose, onUpdateSuccess }) {
    const { user } = usePermissions();
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryUnit, setDeliveryUnit] = useState(order?.delivery_unit || '');
    const [selectedFile, setSelectedFile] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [quantityValidationMsg, setQuantityValidationMsg] = useState('');
    const [scannedSerials, setScannedSerials] = useState('');
    const [activeTab, setActiveTab] = useState('actions');
    const [shippers, setShippers] = useState([]);
    const [adjustedQuantity, setAdjustedQuantity] = useState(order?.quantity || 0);
    const [adjustedQuantity2, setAdjustedQuantity2] = useState(order?.quantity_2 || 0);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [showAdjustmentInput, setShowAdjustmentInput] = useState(false);
    // Cylinder autocomplete for warehouse serials
    const [availableCylsWH, setAvailableCylsWH] = useState([]);
    const [isFetchingCylsWH, setIsFetchingCylsWH] = useState(false);
    const [activeCylDropdownWH, setActiveCylDropdownWH] = useState(null); // idx as string
    const [orderItems, setOrderItems] = useState([]);
    const [isFetchingItems, setIsFetchingItems] = useState(true);
    const [deliveryChecklist, setDeliveryChecklist] = useState({});
    const [confirmDeliveryCheck, setConfirmDeliveryCheck] = useState(false);
    const [deliveryProofBase64, setDeliveryProofBase64] = useState(order?.delivery_proof_base64 || '');
    const [showProofModal, setShowProofModal] = useState(false);
    const [showMachinePreviewPopup, setShowMachinePreviewPopup] = useState(false);
    const [realWarehouseName, setRealWarehouseName] = useState(warehouseName || order?.warehouse);
    // Warehouse assignment when company approves DNXM
    const [approvedWarehouseId, setApprovedWarehouseId] = useState(order?.warehouse || '');
    const [warehouseList, setWarehouseList] = useState([]);
    const [machineAssignments, setMachineAssignments] = useState([]);
    const [availableMachineSerials, setAvailableMachineSerials] = useState([]);
    const [isFetchingMachineSerials, setIsFetchingMachineSerials] = useState(false);
    const [machineAssignErrorMsg, setMachineAssignErrorMsg] = useState('');

    const isDNXM = order?.order_code?.startsWith('DNXM-');
    const hasMachineItems = orderItems.length > 0
        ? orderItems.some(it => isMachineProductType(it?.product_type))
        : (isMachineProductType(order?.product_type) || isMachineProductType(order?.product_type_2));
    const approvedMachineCount = Math.max(0, parseInt(adjustedQuantity2) || 0);

    useEffect(() => {
        if (order?.warehouse && (realWarehouseName === order.warehouse || /^[0-9a-fA-F]{8}-/.test(realWarehouseName))) {
            const fetchWName = async () => {
                const { data } = await supabase.from('warehouses').select('name').eq('id', order.warehouse).maybeSingle();
                if (data?.name) {
                    setRealWarehouseName(data.name);
                } else {
                    const { data: bData } = await supabase.from('branches').select('name').eq('id', order.warehouse).maybeSingle();
                    if (bData?.name) {
                        setRealWarehouseName(bData.name);
                    } else {
                        setRealWarehouseName('—');
                    }
                }
            };
            fetchWName();
        }
    }, [order?.warehouse, warehouseName]);

    // Fetch warehouse list when approving DNXM (CHO_CTY_DUYET)
    useEffect(() => {
        if (order?.status === 'CHO_CTY_DUYET' && isDNXM) {
            supabase.from('warehouses').select('id, name').order('name').then(({ data }) => {
                setWarehouseList(data || []);
            });
        }
    }, [order?.status, isDNXM]);

    useEffect(() => {
        if (!hasMachineItems || order?.status !== 'KHO_XU_LY') return;

        const initialSerials = (order?.department || '')
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);

        setMachineAssignments((prev) => {
            const next = Array.from({ length: approvedMachineCount }).map((_, idx) => ({
                serial: prev[idx]?.serial || initialSerials[idx] || '',
            }));
            return next;
        });
    }, [
        hasMachineItems,
        order?.status,
        order?.department,
        approvedMachineCount,
        order?.id
    ]);

    useEffect(() => {
        const fetchAvailableMachineSerials = async () => {
            if (!hasMachineItems || order?.status !== 'KHO_XU_LY' || !order?.warehouse) {
                setAvailableMachineSerials([]);
                return;
            }

            try {
                setIsFetchingMachineSerials(true);
                const { data, error } = await supabase
                    .from('machines')
                    .select('serial_number')
                    .eq('warehouse', order.warehouse)
                    .eq('status', 'sẵn sàng')
                    .order('serial_number', { ascending: true })
                    .limit(3000);

                if (error) throw error;
                setAvailableMachineSerials((data || []).map(item => item.serial_number).filter(Boolean));
            } catch (err) {
                console.error('Error fetching machine serials:', err);
                setAvailableMachineSerials([]);
            } finally {
                setIsFetchingMachineSerials(false);
            }
        };

        fetchAvailableMachineSerials();
    }, [hasMachineItems, order?.status, order?.warehouse]);

    // Initialize delivery checklist from assigned items
    useEffect(() => {
        if (order?.status === 'DANG_GIAO_HANG') {
            const checklist = {};
            if (order.assigned_cylinders?.length > 0) {
                order.assigned_cylinders.forEach(serial => {
                    checklist[`BINH:${serial}`] = false;
                });
            }
            if (isDNXM) {
                // Đối với đơn máy, lấy mã từ department hoặc note
                let machineSerials = [];
                if (order.department) {
                    machineSerials = order.department.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
                } else if (order.note && order.note.includes('Mã máy:')) {
                    const match = order.note.match(/Mã máy:\s*(.*)/);
                    if (match && match[1]) {
                        machineSerials = match[1].split(',').map(s => s.trim()).filter(Boolean);
                    }
                }

                machineSerials.forEach(serial => {
                    checklist[`MAY:${serial}`] = false;
                });
            } else if (order.department) {
                const machineSerials = order.department.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
                machineSerials.forEach(serial => {
                    checklist[`MAY:${serial}`] = false;
                });
            }
            setDeliveryChecklist(checklist);
        }
    }, [order?.id]);

    const handleProofImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setDeliveryProofBase64(reader.result);
        };
        reader.readAsDataURL(file);
    };

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

    const fetchAvailableCylindersWH = async () => {
        if (availableCylsWH.length > 0 || isFetchingCylsWH) return;
        setIsFetchingCylsWH(true);
        try {
            const { data } = await supabase
                .from('cylinders')
                .select('serial_number, volume, status')
                .eq('status', 's\u1eb5n s\u00e0ng')
                .order('serial_number', { ascending: true })
                .limit(5000);
            setAvailableCylsWH(data || []);
        } catch (e) {
            console.error('fetch cylinders WH error', e);
        } finally {
            setIsFetchingCylsWH(false);
        }
    };

    const getCylSuggestionsWH = (idx, searchVal) => {
        if (!availableCylsWH || availableCylsWH.length === 0) return [];

        const search = (searchVal || '').trim().toUpperCase();
        const currentList = scannedSerials.split(/\r?\n/);
        const taken = new Set(
            currentList
                .filter((s, i) => i !== idx && s.trim())
                .map(s => s.trim().toUpperCase())
        );

        return availableCylsWH
            .filter(c => {
                const serial = c.serial_number?.toUpperCase();
                if (!serial) return false;
                if (taken.has(serial)) return false;
                if (!search) return true;
                return serial.includes(search);
            })
            .slice(0, 30);
    };

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

    const updateMachineAssignmentField = (idx, field, value, totalCount) => {
        setMachineAssignments(prev => {
            const next = [...prev];
            while (next.length < totalCount) next.push({ serial: '' });
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const handleMachineSerialChange = (idx, rawValue, totalCount) => {
        const value = rawValue || '';
        const normalized = value.trim().toUpperCase();

        if (!normalized) {
            setMachineAssignErrorMsg('');
            updateMachineAssignmentField(idx, 'serial', value, totalCount);
            return;
        }

        const duplicateIdx = machineAssignments.findIndex((item, i) => {
            if (i === idx) return false;
            return String(item?.serial || '').trim().toUpperCase() === normalized;
        });

        if (duplicateIdx !== -1) {
            setMachineAssignErrorMsg(`Mã máy ${value} đã được chọn ở máy #${duplicateIdx + 1}.`);
            return;
        }

        setMachineAssignErrorMsg('');
        updateMachineAssignmentField(idx, 'serial', value, totalCount);
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

        const fetchOrderItems = async () => {
            try {
                setIsFetchingItems(true);
                const { data, error } = await supabase
                    .from('order_items')
                    .select('*')
                    .eq('order_id', order.id);

                if (error) throw error;
                setOrderItems(data || []);
            } catch (err) {
                console.error('Error fetching order items:', err);
                setErrorMsg('Không thể tải chi tiết sản phẩm.');
            } finally {
                setIsFetchingItems(false);
            }
        };

        fetchShippers();
        fetchOrderItems();
    }, [order.id]);

    const validateSerials = async (currentList) => {
        const allSerials = (currentList || scannedSerials).split(/[\n, ]+/).map(s => s.trim()).filter(Boolean);
        if (allSerials.length === 0) return;

        const uniqueSerials = [...new Set(allSerials)];
        if (uniqueSerials.length < allSerials.length) {
            setErrorMsg('Phát hiện mã trùng bị quét lại! Hệ thống đã tự động lọc.');
            setScannedSerials(uniqueSerials.join('\n') + '\n');
            return;
        }

        const { data, error } = await supabase.from('cylinders').select('serial_number, status').in('serial_number', uniqueSerials);
        if (error) return;

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
        } else {
            setErrorMsg('');
        }
    };

    // Validation now happens only onBlur or specific actions, not while typing

    if (!order) return null;

    // Get transitions available for current status
    const transitions = ORDER_STATE_TRANSITIONS[order.status] || [];

    // Normalize Vietnamese role names from DB to match ORDER_ROLES constants
    const normalizeRole = (role) => {
        if (!role) return '';
        const r = role.toLowerCase().trim();
        
        // Exact matches first
        if (r === 'admin' || r === 'quản trị' || r === 'quan tri') return 'admin';
        
        // Pattern matches
        if (r.includes('thủ kho') || r.includes('thu kho') || r.includes('kho')) return 'thu_kho';
        if (r.includes('shipper') || r.includes('giao hàng') || r.includes('giao hang')) return 'shipper';
        if (r.includes('lead') || r.includes('trưởng') || r.includes('truong')) return 'lead_sale';
        if (r.includes('kinh doanh') || r.includes('sale')) return 'sale';
        
        return r;
    };

    const normalizedRole = normalizeRole(userRole);
    const availableActions = transitions.filter(t => {
        if (!normalizedRole) return false;
        return normalizedRole === 'admin' || t.allowedRoles.includes(normalizedRole);
    });

    const handleUpdateStatus = async (transition) => {
        try {
            setIsLoading(true);
            setErrorMsg('');
            const actorName =
                user?.name ||
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                'Hệ thống';
            const actionTime = new Date().toLocaleString('vi-VN');

            let imageUrl = order.delivery_image_url;

            // Validate adjusted quantities before proceeding
            const reqQty = parseInt(adjustedQuantity);
            const appQty = parseInt(adjustedQuantity2);

            if (isNaN(reqQty) || reqQty <= 0) {
                throw new Error('Số lượng yêu cầu phải lớn hơn 0.');
            }
            if (isNaN(appQty) || appQty < 0) {
                throw new Error('Số lượng phê duyệt phải lớn hơn hoặc bằng 0.');
            }
            if (appQty > reqQty) {
                throw new Error('Số lượng phê duyệt không được lớn hơn số lượng yêu cầu.');
            }

            // 1. ADVANCED VALIDATION & INVENTORY DEDUCTION (Multi-product)
            if ((transition.nextStatus === 'CHO_GIAO_HANG' || transition.nextStatus === 'DA_DUYET') && order.status === 'KHO_XU_LY') {
                const cylItems = orderItems.filter(it => it.product_type?.startsWith('BINH'));
                const totalCylQty = cylItems.reduce((sum, it) => sum + (it.quantity || 0), 0);

                // For cylinders, we need scanned serials
                if (totalCylQty > 0) {
                    const serials = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                    if (serials.length !== totalCylQty) {
                        throw new Error(`Kho xuất: Bạn cần quét đúng ${totalCylQty} mã bình. Hiện tại đã quét: ${serials.length}`);
                    }

                    // Cập nhật trạng thái vỏ bình sang đang vận chuyển
                    const { data: updatedCylinders, error: cylError } = await supabase
                        .from('cylinders')
                        .update({
                            status: 'đang vận chuyển',
                            customer_name: `${order.customer_name}${order.department ? ` / ${order.department}` : ''}`
                        })
                        .in('serial_number', serials)
                        .select('id, serial_number, category');

                    if (cylError) throw new Error('Cập nhật mã bình trên kho thất bại: ' + cylError.message);

                    if (!updatedCylinders || updatedCylinders.length !== totalCylQty) {
                        throw new Error(`Phát hiện mã bình không tồn tại! Vui lòng kiểm tra lại.`);
                    }

                    // Update serials back to order_items (optional but good for tracking)
                    // Simplified: We just update the main order record for now if needed, 
                    // but according to protocol we should ideally update each order_item line with its specific serials.
                    // For now, we'll keep it simple as the original code had a single array.
                }

                // Trừ tồn kho cho từng sản phẩm từ order_items
                for (const item of orderItems) {
                    if (!item.quantity || item.quantity <= 0) continue;

                    if (isMachineProductType(item.product_type)) continue;

                    const productLabel = PRODUCT_TYPES.find(p => p.id === item.product_type)?.label || item.product_type;

                    const { data: invData, error: invErr } = await supabase
                        .from('inventory')
                        .select('id, quantity, item_name')
                        .eq('warehouse_id', order.warehouse)
                        .ilike('item_name', productLabel.trim())
                        .maybeSingle();

                    if (invErr) throw new Error(`Lỗi kiểm tra tồn kho cho ${productLabel}: ` + invErr.message);

                    if (!invData) {
                        throw new Error(`Kho ${order.warehouse || '—'} chưa có dòng tồn cho ${productLabel}. Vui lòng khởi tạo tồn kho trước khi xuất bán.`);
                    }

                    if (invData.quantity < item.quantity) {
                        throw new Error(`Tồn kho không đủ! ${productLabel} hiện tại chỉ còn ${invData.quantity}.`);
                    }

                    await supabase
                        .from('inventory')
                        .update({ quantity: Math.max(0, invData.quantity - item.quantity) })
                        .eq('id', invData.id);

                    await supabase.from('inventory_transactions').insert([{
                        inventory_id: invData.id,
                        transaction_type: 'OUT',
                        reference_id: order.id,
                        reference_code: order.order_code,
                        quantity_changed: item.quantity,
                        note: `Bán cho ${order.customer_name || 'Khách lẻ'} | Đơn ${order.order_code} | Sản phẩm ${productLabel} x${item.quantity} | Đang ở: ${order.customer_name || 'Khách hàng'} | Kho xuất: ${order.warehouse || '—'} | Người giao: ${deliveryUnit || 'Chưa gán'} | Người duyệt: ${actorName} | Thời gian: ${actionTime}`
                    }]);
                }
            }

            const isCylinder1 = order.product_type?.startsWith('BINH');
            const isCylinder2 = order.product_type_2?.startsWith('BINH');
            const totalCylindersNeeded = (isCylinder1 ? order.quantity : 0) + (isCylinder2 ? order.quantity_2 : 0);

            // Nếu Shipper gán mã lỗi do Kho quên
            const needsCylinderAssignmentByShipper = (order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') &&
                totalCylindersNeeded > 0 &&
                (!order.assigned_cylinders || order.assigned_cylinders.length < totalCylindersNeeded);

            if (needsCylinderAssignmentByShipper && transition.nextStatus !== 'HUY_DON') {
                const serials = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                if (serials.length !== totalCylindersNeeded) {
                    throw new Error(`Shipper: Bạn cần quét đúng ${totalCylindersNeeded} mã bình trước khi giao. Hiện tại đã quét: ${serials.length}`);
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

                if (!updatedCylinders || updatedCylinders.length !== totalCylindersNeeded) {
                    throw new Error(`Phát hiện mã bình không hợp lệ! Vui lòng quét lại.`);
                }
            }

            if (transition.nextStatus === 'CHO_GIAO_HANG' && !deliveryUnit && order.status === 'KHO_XU_LY') {
                throw new Error('Bạn phải bắt buộc chọn Đơn vị vận chuyển trước khi xuất kho giao hàng.');
            }

            const shouldValidateDnxmMachineAssign =
                hasMachineItems &&
                order.status === 'KHO_XU_LY' &&
                transition.nextStatus === 'CHO_GIAO_HANG';

            if (shouldValidateDnxmMachineAssign) {
                const expectedCount = Math.max(0, parseInt(adjustedQuantity2) || 0);
                if (expectedCount <= 0) {
                    throw new Error('Đơn máy cần có số lượng phê duyệt lớn hơn 0 trước khi kho báo đã xuất.');
                }

                if (machineAssignments.length !== expectedCount) {
                    throw new Error(`Vui lòng nhập đủ thông tin ${expectedCount} máy đã gán.`);
                }

                const missing = machineAssignments.findIndex((item) => {
                    return !item?.serial?.trim();
                });
                if (missing !== -1) {
                    throw new Error(`Máy #${missing + 1} chưa nhập mã máy.`);
                }

                const serials = machineAssignments.map(item => item.serial.trim());
                const uniqueSerials = new Set(serials.map(s => s.toUpperCase()));
                if (uniqueSerials.size !== serials.length) {
                    setMachineAssignErrorMsg('Mã máy bị trùng. Vui lòng kiểm tra lại danh sách máy đã gán.');
                    throw new Error('Mã máy bị trùng. Vui lòng kiểm tra lại danh sách máy đã gán.');
                }

                const { data: machineRows, error: machineFetchErr } = await supabase
                    .from('machines')
                    .select('serial_number, status, warehouse')
                    .in('serial_number', serials);

                if (machineFetchErr) {
                    throw new Error('Không thể kiểm tra mã máy: ' + machineFetchErr.message);
                }

                if (!machineRows || machineRows.length !== serials.length) {
                    throw new Error('Có mã máy không tồn tại trong hệ thống. Vui lòng kiểm tra lại.');
                }

                const invalidMachine = machineRows.find((m) => m.status !== 'sẵn sàng' || m.warehouse !== order.warehouse);
                if (invalidMachine) {
                    throw new Error(`Mã máy ${invalidMachine.serial_number} không ở trạng thái sẵn sàng tại kho hiện tại.`);
                }

                const { error: updateMachineErr } = await supabase
                    .from('machines')
                    .update({
                        status: 'kiểm tra',
                        customer_name: order.customer_name || null,
                        updated_at: new Date().toISOString()
                    })
                    .in('serial_number', serials);

                if (updateMachineErr) {
                    throw new Error('Không thể cập nhật trạng thái máy đã gán: ' + updateMachineErr.message);
                }
            }

            if ((transition.nextStatus === 'CHO_DOI_SOAT' || transition.nextStatus === 'HOAN_THANH') && order.status === 'DANG_GIAO_HANG') {
                if (!confirmDeliveryCheck) {
                    throw new Error('Bạn cần tick xác nhận đã giao hàng cho khách hàng.');
                }
                if (!deliveryProofBase64) {
                    throw new Error('Bạn cần chụp ảnh phiếu xác nhận giao hàng.');
                }

                const totalItems = Object.keys(deliveryChecklist).length;
                const checkedItems = Object.values(deliveryChecklist).filter(Boolean).length;

                if (totalItems > 0 && checkedItems < totalItems) {
                    const missingSerials = Object.entries(deliveryChecklist)
                        .filter(([_, checked]) => !checked)
                        .map(([key]) => key.split(':')[1]);

                    await notificationService.add({
                        title: `⚠️ Giao hàng thiếu — Đơn ${order.order_code}`,
                        description: `Shipper xác nhận thiếu ${totalItems - checkedItems} mã hàng: ${missingSerials.join(', ')}. Khách: ${order.customer_name}`,
                        type: 'error',
                        link: `/don-hang`
                    });
                }

                if (hasMachineItems && order.department) {
                    const machineSerials = order.department.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
                    if (machineSerials.length > 0) {
                        const { error: deliveredMachineErr } = await supabase
                            .from('machines')
                            .update({
                                status: 'thuộc khách hàng',
                                customer_name: order.customer_name || null,
                                warehouse: null,
                                updated_at: new Date().toISOString()
                            })
                            .in('serial_number', machineSerials);

                        if (deliveredMachineErr) {
                            throw new Error('Không thể cập nhật máy sang trạng thái thuộc khách hàng: ' + deliveredMachineErr.message);
                        }
                    }
                }
            }

            // 2. INVENTORY REFUND ON CANCEL - Auto-refund when cancelling a post-KHO_XU_LY order
            const POST_INVENTORY_STATUSES = ['DA_DUYET', 'CHO_GIAO_HANG', 'DANG_GIAO_HANG', 'CHO_DOI_SOAT', 'DOI_SOAT_THAT_BAI'];
            if (transition.nextStatus === 'HUY_DON' && POST_INVENTORY_STATUSES.includes(order.status)) {
                // Refund inventory for each product
                for (const item of orderItems) {
                    if (!item.quantity || item.quantity <= 0) continue;

                    const productLabel = PRODUCT_TYPES.find(p => p.id === item.product_type)?.label || item.product_type;

                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('id, quantity')
                        .eq('warehouse_id', order.warehouse)
                        .ilike('item_name', productLabel.trim())
                        .maybeSingle();

                    if (invData) {
                        await supabase
                            .from('inventory')
                            .update({ quantity: invData.quantity + item.quantity })
                            .eq('id', invData.id);

                        await supabase.from('inventory_transactions').insert([{
                            inventory_id: invData.id,
                            transaction_type: 'IN',
                            reference_id: order.id,
                            reference_code: order.order_code,
                            quantity_changed: item.quantity,
                            note: `Hoàn về kho do hủy đơn | Đơn ${order.order_code} | ${productLabel} x${item.quantity} | Từ: ${order.customer_name || 'Khách hàng'} | Về kho: ${order.warehouse || '—'} | Người duyệt: ${actorName} | Thời gian: ${actionTime}`
                        }]);
                    }
                }

                // Release assigned cylinders back to available
                if (order.assigned_cylinders?.length > 0) {
                    await supabase
                        .from('cylinders')
                        .update({ status: 'sẵn sàng', customer_name: null, updated_at: new Date().toISOString() })
                        .in('serial_number', order.assigned_cylinders);
                }

                // Release any machines assigned to this order back to available
                const machineItems = orderItems.filter(it => !it.product_type?.startsWith('BINH'));
                if (machineItems.length > 0 && order.department) {
                    // If machines were assigned via department/serial, release them
                    const machineSerials = order.department.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
                    if (machineSerials.length > 0) {
                        await supabase
                            .from('machines')
                            .update({ status: 'sẵn sàng', customer_name: null, updated_at: new Date().toISOString() })
                            .in('serial_number', machineSerials);
                    }
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
            let nextNote = transition.label === 'Yêu cầu điều chỉnh' ? adjustmentNote : (order.note || '');

            const updatePayload = {
                status: transition.nextStatus,
                updated_at: new Date().toISOString(),
                note: nextNote
            };

            // Công ty duyệt DNXM → gán kho cấp
            if (order.status === 'CHO_CTY_DUYET' && transition.nextStatus === 'KHO_XU_LY' && isDNXM) {
                if (!approvedWarehouseId) {
                    throw new Error('Bạn phải chỉ định Kho cấp trước khi duyệt chuyển sang Kho xử lý.');
                }
                updatePayload.warehouse = approvedWarehouseId;
            }

            // Calculate total amount if quantity changed
            const q1 = parseInt(adjustedQuantity) || 0;
            const q2 = parseInt(adjustedQuantity2) || 0;

            if (q1 !== order.quantity || q2 !== order.quantity_2) {
                let freeCylinders = 0;
                if (order.promotion_code) {
                    const { data: promoData } = await supabase
                        .from('app_promotions')
                        .select('free_cylinders')
                        .eq('code', order.promotion_code)
                        .maybeSingle();
                    if (promoData) freeCylinders = promoData.free_cylinders || 0;
                }
                const billedQuantity = Math.max(0, q1 - freeCylinders);
                updatePayload.quantity = q1;
                updatePayload.quantity_2 = q2;
                updatePayload.total_amount = (billedQuantity * (order.unit_price || 0)) + (q2 * (order.unit_price_2 || 0));
                updatePayload.total_amount_2 = q2 * (order.unit_price_2 || 0);
            }

            // Nếu đây là lúc xuất kho (Gán mã bình) hoặc Shipper gán mã bổ sung
            if (((transition.nextStatus === 'CHO_GIAO_HANG' || transition.nextStatus === 'DA_DUYET') && order.status === 'KHO_XU_LY' && order.product_type?.startsWith('BINH')) || needsCylinderAssignmentByShipper) {
                updatePayload.assigned_cylinders = scannedSerials.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            }

            if (hasMachineItems && order.status === 'KHO_XU_LY' && transition.nextStatus === 'CHO_GIAO_HANG') {
                const machineSerials = machineAssignments.map(item => item.serial.trim()).filter(Boolean);
                const assignmentLines = machineAssignments
                    .map((item, idx) => `${idx + 1}) Mã: ${item.serial.trim()}`)
                    .join('\n');

                nextNote = [
                    stripWarehouseAssignmentSection(nextNote),
                    '=== MÁY ĐÃ GÁN TỪ KHO ===',
                    assignmentLines,
                ].filter(Boolean).join('\n');

                updatePayload.note = nextNote;
                updatePayload.department = machineSerials.join(', ');
            }

            if (deliveryUnit) {
                updatePayload.delivery_unit = deliveryUnit;
            }
            if (imageUrl) {
                updatePayload.delivery_image_url = imageUrl;
            }
            if (order.status === 'DANG_GIAO_HANG' && deliveryProofBase64) {
                updatePayload.delivery_proof_base64 = deliveryProofBase64;
                updatePayload.delivery_checklist = deliveryChecklist;
            }

            const { error: dbError } = await supabase
                .from('orders')
                .update(updatePayload)
                .eq('id', order.id);

            if (dbError) throw dbError;

            // Log history — ưu tiên user từ hook (chính xác nhất), fallback sang storage
            await supabase.from('order_history').insert([{
                order_id: order.id,
                action: 'STATUS_CHANGED',
                old_status: order.status,
                new_status: transition.nextStatus,
                created_by: actorName
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
                    "relative bg-slate-50 shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <Package className="w-5 h-5" />
                        </div>
                        <div className="leading-tight">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Thao tác đơn hàng</h3>
                            <p className="text-xs font-bold text-slate-500 tracking-wide">Mã: #{order.order_code}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Order Summary */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 text-sm shadow-sm">
                        <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Khách hàng</span><span className="font-black text-slate-900 text-right">{order.customer_name || '—'}</span></div>

                        {isFetchingItems ? (
                            <div className="animate-pulse flex space-x-2 py-2">
                                <div className="h-4 bg-slate-200 rounded w-full"></div>
                            </div>
                        ) : orderItems.length > 0 ? (
                            orderItems.map((it, idx) => (
                                <div key={idx} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5 mb-1.5 last:border-0 last:pb-0 last:mb-0">
                                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">SP {idx + 1}</span>
                                    <span className="font-black text-slate-900 text-right">
                                        {PRODUCT_TYPES.find(p => p.id === it.product_type)?.label || it.product_type} x {it.quantity}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex justify-between border-b border-slate-100 pb-1.5 mb-1.5 text-slate-500 italic">
                                <span>(Không có chi tiết sản phẩm)</span>
                            </div>
                        )}

                        <div className="flex justify-between gap-3 pt-1"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Cơ sở / Phòng</span><span className="font-black text-primary text-right">{order.department || '—'}</span></div>
                        {order.warehouse && (
                            <div className="flex justify-between gap-3 pt-1"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Kho xuất</span><span className="font-black text-slate-900 text-right">{realWarehouseName}</span></div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm grid grid-cols-2 gap-1.5">
                        <button
                            onClick={() => setActiveTab('actions')}
                            className={clsx(
                                "h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center",
                                activeTab === 'actions'
                                    ? 'bg-primary text-white shadow'
                                    : 'text-slate-500 hover:bg-slate-100'
                            )}
                        >
                            Thao tác
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={clsx(
                                "h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5",
                                activeTab === 'history'
                                    ? 'bg-primary text-white shadow'
                                    : 'text-slate-500 hover:bg-slate-100'
                            )}
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

                            {/* ── KHO CẤP: Công ty chỉ định khi duyệt DNXM ── */}
                            {order.status === 'CHO_CTY_DUYET' && isDNXM && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                                            <Package className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest">Chỉ định Kho cấp</p>
                                            <p className="text-[10px] text-indigo-500 font-medium">Kho sẽ nhận lệnh xuất máy</p>
                                        </div>
                                    </div>
                                    <select
                                        value={approvedWarehouseId}
                                        onChange={e => setApprovedWarehouseId(e.target.value)}
                                        className="w-full h-11 px-4 bg-white border-2 border-indigo-300 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all text-sm cursor-pointer"
                                    >
                                        <option value="">-- Chọn kho cấp --</option>
                                        {warehouseList.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                    {!approvedWarehouseId && (
                                        <p className="text-[11px] text-indigo-600 font-bold flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Bắt buộc chọn kho trước khi duyệt
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Quantity Adjustment + RFID Scanner for Warehouse */}
                            {(order.status === 'CHO_DUYET' || order.status === 'CHO_CTY_DUYET' || order.status === 'KHO_XU_LY') && (
                                <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                                Số lượng yêu cầu
                                            </label>
                                            <input
                                                type="number"
                                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all text-sm"
                                                value={adjustedQuantity}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const nextRequestedQty = val === '' ? '' : Math.max(0, parseInt(val) || 0);
                                                    setAdjustedQuantity(nextRequestedQty);

                                                    const q1 = parseInt(nextRequestedQty) || 0;
                                                    const q2 = parseInt(adjustedQuantity2) || 0;
                                                    if (q2 > q1) {
                                                        setQuantityValidationMsg('Số lượng phê duyệt không được lớn hơn số lượng yêu cầu.');
                                                    } else {
                                                        setQuantityValidationMsg('');
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                                Số lượng phê duyệt
                                            </label>
                                            <input
                                                type="number"
                                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all text-sm"
                                                value={adjustedQuantity2}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    const q1 = parseInt(adjustedQuantity) || 0;
                                                    const inputVal = val === '' ? '' : Math.max(0, parseInt(val) || 0);
                                                    const normalizedApprovedQty = parseInt(inputVal) || 0;
                                                    setAdjustedQuantity2(inputVal);

                                                    if (normalizedApprovedQty > q1) {
                                                        setQuantityValidationMsg('Số lượng phê duyệt không được lớn hơn số lượng yêu cầu.');
                                                    } else {
                                                        setQuantityValidationMsg('');
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {quantityValidationMsg && (
                                        <p className="text-[11px] text-rose-600 font-bold text-center">{quantityValidationMsg}</p>
                                    )}
                                    {(adjustedQuantity !== order.quantity || adjustedQuantity2 !== order.quantity_2) && (
                                        <p className="text-[11px] text-orange-600 font-bold italic text-center">* Số lượng đã điều chỉnh so với đơn gốc.</p>
                                    )}

                                    {(() => {
                                        // Tính tổng bình từ orderItems (multi-product), fallback legacy fields
                                        const cylItems = orderItems.filter(it => it.product_type?.startsWith('BINH'));

                                        // Priority: 
                                        // 1. If user is in a status where they can adjust (CHO_DUYET...KHO_XU_LY), Use adjustedQuantity/2
                                        // 2. Otherwise use baked orderItems
                                        const useAdjusted = ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY'].includes(order.status);

                                        const q1 = parseInt(adjustedQuantity) || 0;
                                        const q2 = parseInt(adjustedQuantity2) || 0;

                                        const approvedPrimaryQty = useAdjusted ? q2 : (parseInt(order.quantity_2) || 0);
                                        const totalCylCount = useAdjusted
                                            ? (order.product_type?.startsWith('BINH') ? approvedPrimaryQty : 0)
                                            + (order.product_type_2?.startsWith('BINH') ? q2 : 0)
                                            : (cylItems.length > 0
                                                ? cylItems.reduce((sum, it) => sum + (it.quantity || 0), 0)
                                                : (order.product_type?.startsWith('BINH') ? approvedPrimaryQty : 0)
                                                + (order.product_type_2?.startsWith('BINH') ? q2 : 0));

                                        // Nếu đang fetch → hiện skeleton placeholder
                                        if (isFetchingItems) {
                                            return (
                                                <div className="pt-3 border-t border-slate-100 space-y-2 animate-pulse">
                                                    <div className="h-4 bg-slate-200 rounded w-40" />
                                                    <div className="h-10 bg-slate-100 rounded-xl" />
                                                    <div className="h-10 bg-slate-100 rounded-xl" />
                                                </div>
                                            );
                                        }
                                        if (totalCylCount === 0) return null;
                                        return (
                                            <div className="space-y-3 pt-3 border-t border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest">
                                                        <ScanLine className="w-4 h-4 text-primary" />
                                                        <span>Mã vỏ bình RFID ({totalCylCount})</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsScannerOpen(true)}
                                                        className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1.5 uppercase tracking-wider"
                                                    >
                                                        <Camera className="w-3.5 h-3.5" /> Quét ảnh
                                                    </button>
                                                </div>
                                                <div className="space-y-2 mt-2">
                                                    {Array.from({ length: totalCylCount }).map((_, idx) => {
                                                        const serialsList = scannedSerials.split('\n');
                                                        const currentVal = serialsList[idx] || '';
                                                        const dropKey = String(idx);
                                                        const isOpen = activeCylDropdownWH === dropKey;
                                                        // Only calculate suggestions for the active dropdown to save performance and avoid race conditions
                                                        const suggestions = isOpen ? getCylSuggestionsWH(idx, currentVal) : [];
                                                        return (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-[12px] flex items-center justify-center shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <div className="relative flex-1">
                                                                    <input
                                                                        id={`serial-input-wh-${idx}`}
                                                                        type="text"
                                                                        autoComplete="off"
                                                                        className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono tracking-wider placeholder:tracking-normal"
                                                                        placeholder={`Nhập hoặc quét mã số ${idx + 1}...`}
                                                                        value={currentVal}
                                                                        onFocus={() => { fetchAvailableCylindersWH(); setActiveCylDropdownWH(dropKey); }}
                                                                        onBlur={() => {
                                                                            setTimeout(() => {
                                                                                // Only clear if we are still on the same dropdown (prevent flicker when focusing next)
                                                                                setActiveCylDropdownWH(curr => curr === dropKey ? null : curr);
                                                                                validateSerials();
                                                                            }, 200);
                                                                        }}
                                                                        onChange={(e) => {
                                                                            const newList = [...serialsList];
                                                                            while (newList.length < totalCylCount) newList.push('');
                                                                            newList[idx] = e.target.value;
                                                                            setScannedSerials(newList.join('\n'));
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                const nextInput = document.getElementById(`serial-input-wh-${idx + 1}`);
                                                                                if (nextInput) nextInput.focus();
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setIsScannerOpen(true)}
                                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors z-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                                                                        title="Mở camera quét RFID"
                                                                        aria-label="Mở camera quét RFID"
                                                                    >
                                                                        <ScanLine className="w-5 h-5 shrink-0" strokeWidth={2.25} />
                                                                    </button>
                                                                    {isOpen && (
                                                                        <div className="absolute z-[9999] left-0 right-0 top-[46px] bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                            {isFetchingCylsWH ? (
                                                                                <div className="px-4 py-3 text-xs text-slate-400 italic">Đang tải danh sách bình...</div>
                                                                            ) : suggestions.length === 0 ? (
                                                                                <div className="px-4 py-3 text-xs text-slate-400 italic">{currentVal ? 'Không tìm thấy bình phù hợp' : 'Gõ mã để tìm kiếm...'}</div>
                                                                            ) : (
                                                                                suggestions.map(c => (
                                                                                    <button
                                                                                        key={c.serial_number}
                                                                                        type="button"
                                                                                        onMouseDown={(e) => {
                                                                                            e.preventDefault();
                                                                                            const newList = scannedSerials.split('\n');
                                                                                            while (newList.length < totalCylCount) newList.push('');
                                                                                            newList[idx] = c.serial_number;
                                                                                            setScannedSerials(newList.join('\n'));
                                                                                            setActiveCylDropdownWH(null);
                                                                                            setTimeout(() => {
                                                                                                const nextInput = document.getElementById(`serial-input-wh-${idx + 1}`);
                                                                                                if (nextInput) nextInput.focus();
                                                                                            }, 50);
                                                                                        }}
                                                                                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0"
                                                                                    >
                                                                                        <span className="text-[13px] font-mono font-bold text-primary">{c.serial_number}</span>
                                                                                        <span className="text-[10px] text-slate-400 ml-2">{c.volume || ''}</span>
                                                                                    </button>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {hasMachineItems && order.status === 'KHO_XU_LY' && approvedMachineCount > 0 && (
                                <div className="space-y-3 bg-cyan-50/60 p-4 rounded-2xl border border-cyan-200 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-black text-cyan-700 uppercase tracking-widest">
                                            Gán mã máy theo SL phê duyệt ({approvedMachineCount})
                                        </p>
                                        {isFetchingMachineSerials && (
                                            <span className="text-[10px] font-bold text-cyan-600 italic">Đang tải serial sẵn sàng...</span>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {Array.from({ length: approvedMachineCount }).map((_, idx) => {
                                            const row = machineAssignments[idx] || { serial: '' };
                                            const currentSerialUpper = String(row.serial || '').trim().toUpperCase();
                                            const usedByOther = new Set(
                                                machineAssignments
                                                    .map((item, i) => (i === idx ? '' : String(item?.serial || '').trim().toUpperCase()))
                                                    .filter(Boolean)
                                            );
                                            const rowSerialOptions = availableMachineSerials.filter((serial) => {
                                                const key = String(serial || '').trim().toUpperCase();
                                                if (!key) return false;
                                                return !usedByOther.has(key) || key === currentSerialUpper;
                                            });
                                            return (
                                                <div key={idx} className="bg-white border border-cyan-100 rounded-xl p-3 space-y-2.5">
                                                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-wider">Máy #{idx + 1}</p>

                                                    <input
                                                        type="text"
                                                        list={`dnxm-ready-machine-serials-${idx}`}
                                                        value={row.serial}
                                                        onChange={(e) => handleMachineSerialChange(idx, e.target.value, approvedMachineCount)}
                                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-800 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 font-mono"
                                                        placeholder="Nhập mã máy (serial)"
                                                    />

                                                    <datalist id={`dnxm-ready-machine-serials-${idx}`}>
                                                        {rowSerialOptions.map((serial) => (
                                                            <option key={`${idx}-${serial}`} value={serial} />
                                                        ))}
                                                    </datalist>

                                                    <p className="text-[11px] text-slate-500 font-medium">Chỉ cần nhập mã máy theo số lượng đã phê duyệt.</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {machineAssignErrorMsg && (
                                        <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                                            {machineAssignErrorMsg}
                                        </p>
                                    )}
                                </div>
                            )}
                            {/* RFID Scanner for Shipper */}

                            {(() => {
                                const approvedCylShipperCount = parseInt(order.quantity_2) || parseInt(order.quantity) || 0;
                                const shouldShowShipperRfid = (order.status === 'CHO_GIAO_HANG' || order.status === 'DANG_GIAO_HANG') &&
                                order.product_type?.startsWith('BINH') &&
                                (!order.assigned_cylinders || order.assigned_cylinders.length < approvedCylShipperCount);
                                if (!shouldShowShipperRfid) return null;
                                return (
                                    <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-1.5 text-xs font-black text-orange-600 uppercase tracking-widest">
                                                <AlertTriangle className="w-4 h-4" />
                                                <span>Quét gán {approvedCylShipperCount} bình:</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setIsScannerOpen(true)}
                                                className="px-3 py-1.5 bg-orange-600 text-white text-[10px] font-black rounded-lg hover:bg-orange-700 transition-all flex items-center gap-1.5 uppercase tracking-wider shadow-sm"
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Quét ảnh
                                            </button>
                                        </div>
                                        <div className="space-y-2 mt-2">
                                            {Array.from({ length: approvedCylShipperCount }).map((_, idx) => {
                                                const serialsList = scannedSerials.split('\n');
                                                return (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 font-bold text-[12px] flex items-center justify-center shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="relative flex-1">
                                                            <input
                                                            id={`serial-input-sp-${idx}`}
                                                            type="text"
                                                            className="w-full pl-4 pr-12 py-2.5 bg-white border border-orange-200 rounded-xl text-[14px] font-bold text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 transition-all font-mono tracking-wider placeholder:tracking-normal"
                                                            placeholder={`Quét mã số ${idx + 1}...`}
                                                            value={serialsList[idx] || ''}
                                                            onFocus={() => { fetchAvailableCylindersWH(); setActiveCylDropdownWH(`sp-${idx}`); }}
                                                            onBlur={() => {
                                                                setTimeout(() => {
                                                                    setActiveCylDropdownWH(curr => curr === `sp-${idx}` ? null : curr);
                                                                    validateSerials();
                                                                }, 200);
                                                            }}
                                                            onChange={(e) => {
                                                                const newList = [...serialsList];
                                                                while (newList.length < approvedCylShipperCount) newList.push('');
                                                                newList[idx] = e.target.value;
                                                                setScannedSerials(newList.join('\n'));
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const nextInput = document.getElementById(`serial-input-sp-${idx + 1}`);
                                                                    if (nextInput) nextInput.focus();
                                                                }
                                                            }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsScannerOpen(true)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors z-10 text-orange-800 hover:text-orange-950 hover:bg-orange-50 border border-transparent hover:border-orange-200"
                                                                title="Mở camera quét RFID"
                                                                aria-label="Mở camera quét RFID"
                                                            >
                                                                <ScanLine className="w-5 h-5 shrink-0" strokeWidth={2.25} />
                                                            </button>
                                                            {activeCylDropdownWH === `sp-${idx}` && (
                                                                <div className="absolute z-[9999] left-0 right-0 top-[46px] bg-white border border-orange-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                    {isFetchingCylsWH ? (
                                                                        <div className="px-4 py-3 text-xs text-slate-400 italic">Đang tải...</div>
                                                                    ) : (() => {
                                                                        const suggestions = getCylSuggestionsWH(idx, serialsList[idx] || '');
                                                                        if (suggestions.length === 0) {
                                                                            return <div className="px-4 py-3 text-xs text-slate-400 italic">Không tìm thấy bình phù hợp</div>;
                                                                        }
                                                                        return suggestions.map(c => (
                                                                            <button
                                                                                key={c.serial_number}
                                                                                type="button"
                                                                                onMouseDown={(e) => {
                                                                                    e.preventDefault();
                                                                                    const newList = [...serialsList];
                                                                                    while (newList.length < approvedCylShipperCount) newList.push('');
                                                                                    newList[idx] = c.serial_number;
                                                                                    setScannedSerials(newList.join('\n'));
                                                                                    setActiveCylDropdownWH(null);
                                                                                    setTimeout(() => {
                                                                                        const nextInput = document.getElementById(`serial-input-sp-${idx + 1}`);
                                                                                        if (nextInput) nextInput.focus();
                                                                                    }, 50);
                                                                                }}
                                                                                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-orange-50 transition-colors border-b border-orange-50 last:border-0"
                                                                            >
                                                                                <span className="text-[13px] font-mono font-bold text-orange-700">{c.serial_number}</span>
                                                                                <span className="text-[10px] text-slate-400 ml-2">{c.volume || ''}</span>
                                                                            </button>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

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

                                {/* DELIVERY CONFIRMATION FORM — Shipper */}
                                {order.status === 'DANG_GIAO_HANG' && (() => {
                                    const checklistEntries = Object.entries(deliveryChecklist);
                                    const totalItems = checklistEntries.length;
                                    const checkedItems = checklistEntries.filter(([_, v]) => v).length;
                                    const allChecked = totalItems > 0 && checkedItems === totalItems;

                                    return (
                                        <div className="space-y-5">
                                            {/* SECTION NÚT XEM PHIẾU ĐỀ XUẤT CHO MÁY */}
                                            {isDNXM && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMachinePreviewPopup(true)}
                                                    className="w-full flex items-center justify-center gap-2 p-3.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl font-bold hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm group"
                                                >
                                                    <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                    Xem Phiếu Đề Xuất Trực Tuyến
                                                </button>
                                            )}

                                            {/* SECTION 1: Danh sách hàng hóa */}
                                            {totalItems > 0 && (
                                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                                            <Package className="w-4 h-4 text-primary" />
                                                            Hàng hóa đã giao ({checkedItems}/{totalItems})
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newChecklist = { ...deliveryChecklist };
                                                                const shouldCheckAll = !allChecked;
                                                                Object.keys(newChecklist).forEach(k => newChecklist[k] = shouldCheckAll);
                                                                setDeliveryChecklist(newChecklist);
                                                            }}
                                                            className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline"
                                                        >
                                                            {allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                                        {checklistEntries.map(([key, checked]) => {
                                                            const [type, serial] = key.split(':');
                                                            const isCylinder = type === 'BINH';
                                                            return (
                                                                <label
                                                                    key={key}
                                                                    className={clsx(
                                                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                                                        checked
                                                                            ? "bg-emerald-50 border-emerald-200"
                                                                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                                                    )}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => setDeliveryChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
                                                                        className="w-5 h-5 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-sm font-bold text-slate-800 font-mono tracking-wider">{serial}</span>
                                                                    </div>
                                                                    <span className={clsx(
                                                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                                                        isCylinder
                                                                            ? "bg-blue-50 text-blue-600 border-blue-200"
                                                                            : "bg-amber-50 text-amber-600 border-amber-200"
                                                                    )}>
                                                                        {isCylinder ? 'Bình' : 'Máy'}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                    {!allChecked && totalItems > 0 && (
                                                        <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl animate-in fade-in duration-300">
                                                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                                            <span className="text-[11px] font-bold text-rose-600">
                                                                Thiếu {totalItems - checkedItems} mã hàng! Giao thiếu sẽ báo cáo lên Leader.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* SECTION 2: Ảnh phiếu xác nhận */}
                                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                                <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                                    <Camera className="w-4 h-4 text-primary" />
                                                    Ảnh phiếu xác nhận <span className="text-rose-500">*</span>
                                                </label>

                                                {deliveryProofBase64 ? (
                                                    <div className="relative">
                                                        <img
                                                            src={deliveryProofBase64}
                                                            alt="Phiếu xác nhận"
                                                            className="w-full max-h-[200px] object-contain rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                                                            onClick={() => setShowProofModal(true)}
                                                        />
                                                        <div className="absolute top-2 right-2 flex gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowProofModal(true)}
                                                                className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                                                                title="Phóng to"
                                                            >
                                                                <ZoomIn size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeliveryProofBase64('')}
                                                                className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-rose-600 transition-colors"
                                                                title="Xóa ảnh"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <label className="flex flex-col items-center justify-center w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all group">
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            <Camera className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                                                            <p className="text-[12px] font-bold text-slate-500 group-hover:text-primary">
                                                                Chụp / chọn ảnh phiếu xác nhận
                                                            </p>
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            capture="environment"
                                                            className="hidden"
                                                            onChange={handleProofImageChange}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {/* SECTION 3: Checkbox xác nhận */}
                                            <label className={clsx(
                                                "flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                                                confirmDeliveryCheck
                                                    ? "bg-emerald-50 border-emerald-400 shadow-sm"
                                                    : "bg-white border-slate-200 hover:border-primary/30"
                                            )}>
                                                <input
                                                    type="checkbox"
                                                    checked={confirmDeliveryCheck}
                                                    onChange={() => setConfirmDeliveryCheck(!confirmDeliveryCheck)}
                                                    className="w-6 h-6 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                                                />
                                                <span className={clsx(
                                                    "text-sm font-bold",
                                                    confirmDeliveryCheck ? "text-emerald-700" : "text-slate-600"
                                                )}>
                                                    Tôi xác nhận đã giao hàng hóa cho khách hàng
                                                </span>
                                            </label>
                                        </div>
                                    );
                                })()}

                                {/* View proof for completed orders */}
                                {(order.status === 'CHO_DOI_SOAT' || order.status === 'HOAN_THANH') && (
                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                                            Ảnh chứng từ giao hàng
                                        </label>
                                        {order.delivery_proof_base64 ? (
                                            <div className="space-y-2">
                                                <img
                                                    src={order.delivery_proof_base64}
                                                    alt="Phiếu xác nhận"
                                                    className="w-full max-h-[200px] object-contain rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                                                    onClick={() => setShowProofModal(true)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProofModal(true)}
                                                    className="w-full py-2 text-[11px] font-black text-primary uppercase tracking-wider bg-primary/5 rounded-xl hover:bg-primary/10 transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <ZoomIn size={14} /> Xem phóng to
                                                </button>
                                            </div>
                                        ) : order.delivery_image_url ? (
                                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    <span className="text-[12px] font-bold text-emerald-700">Đã có chứng từ</span>
                                                </div>
                                                <a href={order.delivery_image_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary hover:underline hover:text-primary/80 uppercase tracking-wider">Xem ảnh</a>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                                <span className="text-[12px] text-slate-400 italic">Chưa có ảnh chứng từ</span>
                                            </div>
                                        )}

                                        {/* Checklist review */}
                                        {order.delivery_checklist && Object.keys(order.delivery_checklist).length > 0 && (
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Checklist giao hàng</span>
                                                {Object.entries(order.delivery_checklist).map(([key, checked]) => {
                                                    const [type, serial] = key.split(':');
                                                    return (
                                                        <div key={key} className="flex items-center gap-2 text-[12px]">
                                                            {checked
                                                                ? <Check className="w-4 h-4 text-emerald-500" />
                                                                : <X className="w-4 h-4 text-rose-500" />
                                                            }
                                                            <span className={clsx("font-mono font-bold", checked ? "text-slate-700" : "text-rose-600 line-through")}>{serial}</span>
                                                            <span className="text-slate-400 text-[9px] uppercase">{type === 'BINH' ? 'Bình' : 'Máy'}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(errorMsg || quantityValidationMsg) && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[13px] font-bold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <XCircle className="w-4 h-4 shrink-0" />
                                    {quantityValidationMsg || errorMsg}
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
                            <div className="pt-4 border-t border-slate-200 space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Các thao tác khả dụng</label>
                                {availableActions.length === 0 ? (
                                    <div className="p-5 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                                        <p className="text-sm font-bold text-slate-500 italic">Không có quyền thao tác</p>
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
                                                        if (quantityValidationMsg) {
                                                            setErrorMsg(quantityValidationMsg);
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

                <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-center">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="w-full h-11 text-slate-600 font-black text-[11px] uppercase tracking-widest bg-slate-100 hover:bg-slate-200 transition-all rounded-xl border border-slate-200"
                    >
                        Quay lại bảng điều khiển
                    </button>
                </div>
            </div>

            {/* Proof Image Modal */}
            {showProofModal && (
                <div
                    className="fixed inset-0 z-[100010] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowProofModal(false)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors z-10"
                        onClick={() => setShowProofModal(false)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={deliveryProofBase64 || order?.delivery_proof_base64}
                        alt="Phiếu xác nhận giao hàng"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Machine Preview Popup */}
            {showMachinePreviewPopup && (
                <div
                    className="fixed inset-0 z-[100010] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
                >
                    <div className="w-full max-w-4xl max-h-[95vh] bg-slate-50 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
                            <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider">Phiếu Đề Xuất Máy</h3>
                            <button
                                onClick={() => setShowMachinePreviewPopup(false)}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <MachineIssueRequestForm
                                overrideOrderId={order.id}
                                overrideViewOnly={true}
                                onClosePopup={() => setShowMachinePreviewPopup(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

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
