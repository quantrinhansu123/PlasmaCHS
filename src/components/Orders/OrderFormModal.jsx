import { AlertTriangle, ChevronDown, Clock, Edit3, Hash, MapPin, Package, Phone, Save, ScanLine, Search, User, X, Info } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import {
    CUSTOMER_CATEGORIES,
    ORDER_TYPES,
    PRODUCT_TYPES
} from '../../constants/orderConstants';
import usePermissions from '../../hooks/usePermissions';
import { useReports } from '../../hooks/useReports';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';
import clsx from 'clsx';

export default function OrderFormModal({ order, onClose, onSuccess, initialMode = 'edit' }) {
    const { role, user } = usePermissions();
    const { fetchCustomerCylinderDebt } = useReports();
    const isEdit = !!order;
    const [mode, setMode] = useState(initialMode);
    const isReadOnly = mode === 'view';
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [customers, setCustomers] = useState([]);
    const [shippersList, setShippersList] = useState([]);
    const [promotionsList, setPromotionsList] = useState([]);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    // Scanner states
    const [assignedCylinders, setAssignedCylinders] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanTargetIndex, setScanTargetIndex] = useState(-1);
    const scanTargetIndexRef = useRef(-1);
    useEffect(() => { scanTargetIndexRef.current = scanTargetIndex; }, [scanTargetIndex]);
    const assignedCylindersRef = useRef(assignedCylinders);
    useEffect(() => { assignedCylindersRef.current = assignedCylinders; }, [assignedCylinders]);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [reasonSource, setReasonSource] = useState('initial-edit'); // 'initial-edit' | 'submit'

    // Custom dropdown states
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const customerDropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
                setIsCustomerDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    const getNewOrderCode = () => Math.floor(1000 + Math.random() * 9000).toString();

    const defaultState = {
        orderCode: getNewOrderCode(),
        customerCategory: 'TM',
        warehouse: '',
        customerId: '',
        recipientName: '',
        recipientAddress: '',
        recipientPhone: '',
        orderType: 'BAN',
        note: '',
        productType: 'BINH_4L',
        quantity: 0,
        unitPrice: 0,
        department: '',
        tempDept: '',
        tempSerial: '',
        promotion: '',
        shipperId: '',
        shippingFee: 0,
        assignedCylinders: []
    };

    const [formData, setFormData] = useState(defaultState);
    const [warehousesList, setWarehousesList] = useState([]);
    const [cylinderDebt, setCylinderDebt] = useState([]);

    useEffect(() => {
        fetchRealCustomers();
        fetchWarehouses();
        fetchShippers();
        fetchPromotions();
    }, []);

    useEffect(() => {
        if (formData.customerId) {
            loadCylinderDebt(formData.customerId);
        } else {
            setCylinderDebt([]);
        }
    }, [formData.customerId]);

    const loadCylinderDebt = async (customerId) => {
        const debt = await fetchCustomerCylinderDebt(customerId);
        setCylinderDebt(debt || []);
    };

    const fetchPromotions = async () => {
        try {
            const { data } = await supabase
                .from('app_promotions')
                .select('*')
                .eq('is_active', true)
                .lte('start_date', new Date().toISOString().split('T')[0])
                .gte('end_date', new Date().toISOString().split('T')[0]);
            if (data) setPromotionsList(data);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
                if (!isEdit && data.length > 0) {
                    setFormData(prev => prev.warehouse ? prev : { ...prev, warehouse: data[0].id });
                }
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const fetchRealCustomers = async () => {
        setIsFetchingCustomers(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true });

            if (error && error.code !== '42P01') throw error;

            if (data && data.length > 0) {
                // Map the DB structure to what the form expects
                const dbCustomers = data.map(c => ({
                    id: c.id,
                    name: c.name,
                    address: c.address,
                    recipient: c.legal_rep || c.name,
                    phone: c.phone,
                    category: c.category
                }));
                // Combine with mock if desired or just use DB
                setCustomers(dbCustomers);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setIsFetchingCustomers(false);
        }
    };

    const fetchShippers = async () => {
        try {
            const { data, error } = await supabase
                .from('shippers')
                .select('id, name')
                .order('name', { ascending: true });
            if (error && error.code !== '42P01') throw error;
            setShippersList(data || []);
        } catch (error) {
            console.error('Error fetching shippers:', error);
        }
    };

    useEffect(() => {
        if (isEdit) {
            const productType = order.product_type?.toUpperCase() || '';
            const isCylinder = productType.startsWith('BINH') || productType.startsWith('BÌNH');
            const isMachine = productType.match(/^(MAY|MÁY)/) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM'].includes(productType);
            
            // Tách mã máy và khoa sử dụng từ cột department (Ví dụ: "Khoa Nội / PR-01")
            const rawDept = order.department || '';
            let tDept = '';
            let tSerial = '';
            if (rawDept.includes(' / ')) {
                const parts = rawDept.split(' / ');
                tDept = parts[0];
                tSerial = parts[1];
            } else if (isMachine) {
                // Nếu chỉ có một vế trong cột và là máy, coi đó là mã Serial
                tSerial = rawDept;
            } else {
                tDept = rawDept;
            }

            setFormData({
                orderCode: order.order_code,
                customerCategory: order.customer_category || 'TM',
                warehouse: order.warehouse || '',
                customerId: customers.find(c => c.name === order.customer_name)?.id || '',
                recipientName: order.recipient_name || '',
                recipientAddress: order.recipient_address || '',
                recipientPhone: order.recipient_phone || '',
                orderType: order.order_type || 'THUONG',
                note: order.note || '',
                productType: order.product_type || 'BINH_4L',
                quantity: order.quantity || 0,
                unitPrice: order.unit_price || 0,
                department: order.department || '',
                tempDept: tDept,
                tempSerial: tSerial,
                promotion: order.promotion_code || '',
                shipperId: order.shipper_id || '',
                shippingFee: order.shipping_fee || 0
            });
            
            let initialCylinders = [];
            
            if (order.assigned_cylinders && Array.isArray(order.assigned_cylinders)) {
                initialCylinders = order.assigned_cylinders.map(s => {
                    if (typeof s === 'string') return { serial: s, scan_time: 'Đã lưu' };
                    return s;
                });
            }

            // Always ensure the array matches the quantity for cylinder products
            if (isCylinder) {
                const qty = order.quantity || 0;
                while (initialCylinders.length < qty) {
                    initialCylinders.push({ serial: '', scan_time: null });
                }
                // Truncate if somehow larger
                if (initialCylinders.length > qty) {
                    initialCylinders = initialCylinders.slice(0, qty);
                }
            }
            
            setAssignedCylinders(initialCylinders);
        }
    }, [order, isEdit, customers]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCustomerSelect = (customer) => {
        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            recipientName: customer.recipient || '',
            recipientAddress: customer.address || '',
            recipientPhone: customer.phone || '',
            customerCategory: customer.category || 'TM'
        }));
        setIsCustomerDropdownOpen(false);
        setCustomerSearchTerm('');
    };

    const filteredCustomers = customers.filter(c => {
        const categoryMatch = !formData.customerCategory || formData.customerCategory === 'ALL' || c.category === formData.customerCategory;
        const searchMatch = !customerSearchTerm ||
            c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
            (c.phone && c.phone.includes(customerSearchTerm)) ||
            (c.recipient && c.recipient.toLowerCase().includes(customerSearchTerm.toLowerCase()));
        return categoryMatch && searchMatch;
    });

    const handleQuantityChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        const parsedValue = value === '' ? 0 : parseInt(value, 10);
        setFormData(prev => ({ ...prev, quantity: parsedValue }));

        // Auto-resize assignedCylinders for BINH
        if (formData.productType.startsWith('BINH')) {
            setAssignedCylinders(prev => {
                const newArr = [...prev];
                if (parsedValue > newArr.length) {
                    for (let i = newArr.length; i < parsedValue; i++) newArr.push({ serial: '', scan_time: null });
                } else {
                    newArr.length = parsedValue;
                }
                return newArr;
            });
        }
    };

    const handleCylinderSerialChange = (index, value) => {
        const normalizedVal = value ? value.trim().toUpperCase() : '';
        setAssignedCylinders(prev => {
            const newArr = [...prev];
            const now = new Date();
            const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Warning for duplicates during typing
            if (normalizedVal) {
                const isDuplicate = newArr.some((s, idx) => {
                    const existingSerial = (typeof s === 'string' ? s : s?.serial)?.trim().toUpperCase();
                    return idx !== index && existingSerial === normalizedVal;
                });
                if (isDuplicate) {
                    toast.warn(`Mã ${normalizedVal} đang bị trùng trong đơn hàng này!`, {
                        toastId: `dup-${normalizedVal}`,
                        position: 'top-center',
                        autoClose: 2000
                    });
                }
            }

            newArr[index] = {
                serial: normalizedVal,
                scan_time: normalizedVal ? (prev[index]?.scan_time || timeStr) : null
            };
            return newArr;
        });
    };

    const handleScanSuccess = useCallback((decodedText) => {
        const currentArr = assignedCylindersRef.current;
        const currentIdx = scanTargetIndexRef.current;

        if (currentIdx === -1) return;

        const normalizedText = decodedText.trim().toUpperCase();

        // Skip if already in the list
        if (currentArr.some(s => (typeof s === 'string' ? s : s?.serial)?.trim().toUpperCase() === normalizedText)) {
            toast.info(`Mã ${normalizedText} đã được gán vào đơn hàng này rồi!`);
            return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

        setAssignedCylinders(prev => {
            const newArr = [...prev];
            newArr[currentIdx] = { serial: normalizedText, scan_time: timeStr };
            return newArr;
        });

        const updatedArr = [...currentArr];
        updatedArr[currentIdx] = { serial: normalizedText, scan_time: timeStr };
        const nextEmpty = updatedArr.findIndex((s, i) => i > currentIdx && !(typeof s === 'string' ? s : s?.serial));
        const fallbackEmpty = updatedArr.findIndex((s) => !(typeof s === 'string' ? s : s?.serial));
        const nextIdx = nextEmpty !== -1 ? nextEmpty : fallbackEmpty;

        if (nextIdx !== -1 && nextIdx !== currentIdx) {
            setScanTargetIndex(nextIdx);
        } else {
            setIsScannerOpen(false);
            setScanTargetIndex(-1);
            toast.success('Đã gán đủ mã bình!', { position: 'top-center' });
        }
    }, [scanTargetIndex]);

    const startScanner = (targetIdx) => {
        setScanTargetIndex(targetIdx);
        setIsScannerOpen(true);
    };

    const startScanAll = () => {
        const firstEmpty = assignedCylinders.findIndex(s => !(typeof s === 'string' ? s : s?.serial));
        if (firstEmpty === -1) {
            alert('Đã gán đủ mã bình!');
            return;
        }
        startScanner(firstEmpty);
    };

    const handleUnitPriceChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, unitPrice: value === '' ? 0 : parseInt(value, 10) }));
    };

    const handleShippingFeeChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, shippingFee: value === '' ? 0 : parseInt(value, 10) }));
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '0';
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const selectedPromo = promotionsList.find(p => p.code === formData.promotion);
    const freeCylinders = selectedPromo ? (selectedPromo.free_cylinders || 0) : 0;
    const billedQuantity = Math.max(0, (formData.quantity || 0) - freeCylinders);
    const calculatedTotalAmount = billedQuantity * (formData.unitPrice || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.customerId || !formData.recipientName || !formData.recipientAddress || !formData.recipientPhone || formData.quantity <= 0) {
            setErrorMsg('Vui lòng điền đầy đủ thông tin bắt buộc và số lượng phải lớn hơn 0.');
            return;
        }

        if (isEdit && !editReason.trim()) {
            setReasonSource('submit');
            setShowReasonModal(true);
            return;
        }

        setIsLoading(true);

        try {
            const customerName = customers.find(c => c.id.toString() === formData.customerId.toString())?.name || '';
            const currentUser = user?.name || user?.email || localStorage.getItem('user_name') || 'Admin hệ thống';

            let initialStatus = 'CHO_DUYET';
            if (!isEdit && (role === 'admin' || role === 'thu_kho')) {
                initialStatus = 'DA_DUYET';
            }

            const assignedSerials = formData.productType.startsWith('BINH')
                ? assignedCylinders.map(c => (typeof c === 'string' ? c : c?.serial)?.trim().toUpperCase()).filter(Boolean)
                : [];

            // 1. VALIDATION: Check if cylinders exist and are in the correct warehouse
            if (assignedSerials.length > 0) {
                // Check local duplicates first
                const uniqueSerials = [...new Set(assignedSerials)];
                if (uniqueSerials.length !== assignedSerials.length) {
                    const counts = {};
                    assignedSerials.forEach(s => counts[s] = (counts[s] || 0) + 1);
                    const duplicates = Object.entries(counts).filter(([_, count]) => count > 1).map(([s]) => s);
                    throw new Error(`Bạn đã nhập trùng mã bình: ${duplicates.join(', ')}. Mỗi mã bình chỉ được xuất hiện một lần trong một đơn hàng.`);
                }

                const { data: validCylinders, error: checkError } = await supabase
                    .from('cylinders')
                    .select('serial_number, warehouse_id, status')
                    .in('serial_number', uniqueSerials);

                if (checkError) throw new Error('Lỗi kiểm tra mã bình: ' + checkError.message);

                if (!validCylinders || validCylinders.length !== uniqueSerials.length) {
                    const foundSerials = validCylinders?.map(c => c.serial_number.toUpperCase()) || [];
                    const missing = uniqueSerials.filter(s => !foundSerials.includes(s));
                    throw new Error(`Mã bình không tồn tại trong hệ thống: ${missing.join(', ')}`);
                }

                // Check warehouse consistency
                const wrongWarehouse = validCylinders.filter(c => c.warehouse_id !== formData.warehouse);
                if (wrongWarehouse.length > 0) {
                    throw new Error(`Mã bình sau không thuộc kho đã chọn: ${wrongWarehouse.map(c => c.serial_number).join(', ')}`);
                }
            }

            // 2. INVENTORY DEDUCTION (If direct DA_DUYET)
            const customerNameWithDept = `${customerName}${formData.department ? ` / ${formData.department}` : ''}`;

            if (!isEdit && initialStatus === 'DA_DUYET') {
                const productConfig = PRODUCT_TYPES.find(p => p.id === formData.productType);
                const productLabel = productConfig ? productConfig.label : formData.productType;

                const { data: invData, error: invErr } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', formData.warehouse)
                    .ilike('item_name', productLabel.trim())
                    .maybeSingle();

                if (invErr) throw new Error('Lỗi kiểm tra tồn kho: ' + invErr.message);
                if (!invData || invData.quantity < formData.quantity) {
                    throw new Error(`Tồn kho không đủ! Hiện tại chỉ còn ${invData?.quantity || 0} ${productLabel}.`);
                }

                if (assignedSerials.length > 0) {
                    const { error: cylUpdErr } = await supabase
                        .from('cylinders')
                        .update({ 
                            status: 'đang vận chuyển', 
                            customer_name: customerNameWithDept 
                        })
                        .in('serial_number', assignedSerials);
                    if (cylUpdErr) throw new Error('Lỗi cập nhật trạng thái bình: ' + cylUpdErr.message);
                }

                const { error: invUpdErr } = await supabase
                    .from('inventory')
                    .update({ quantity: invData.quantity - formData.quantity })
                    .eq('id', invData.id);
                if (invUpdErr) throw new Error('Lỗi trừ tồn kho: ' + invUpdErr.message);

                await supabase.from('inventory_transactions').insert([{
                    inventory_id: invData.id,
                    transaction_type: 'OUT',
                    quantity_changed: formData.quantity,
                    note: `Xuất kho trực tiếp (từ Modal) - Đơn ${formData.orderCode}`
                }]);
            }

            const payload = {
                order_code: formData.orderCode,
                customer_category: formData.customerCategory,
                warehouse: formData.warehouse,
                customer_name: customerName,
                recipient_name: formData.recipientName,
                recipient_address: formData.recipientAddress,
                recipient_phone: formData.recipientPhone,
                order_type: formData.orderType,
                note: formData.note,
                product_type: formData.productType,
                quantity: formData.quantity,
                unit_price: formData.unitPrice || 0,
                total_amount: calculatedTotalAmount,
                department: (formData.tempDept || formData.tempSerial) ? `${formData.tempDept}${formData.tempDept && formData.tempSerial ? ' / ' : ''}${formData.tempSerial}`.trim() : '',
                promotion_code: formData.promotion,
                shipper_id: formData.shipperId || null,
                shipping_fee: formData.shippingFee || 0,
                assigned_cylinders: assignedSerials.length > 0 ? assignedSerials : null,
                status: isEdit ? order.status : initialStatus,
                ordered_by: isEdit ? order.ordered_by : currentUser,
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const changedFields = {};
                const fieldMap = {
                    customer_name: order.customer_name,
                    recipient_name: order.recipient_name,
                    recipient_address: order.recipient_address,
                    recipient_phone: order.recipient_phone,
                    quantity: order.quantity,
                    unit_price: order.unit_price,
                    total_amount: order.total_amount,
                    note: order.note,
                    order_type: order.order_type,
                    product_type: order.product_type,
                    department: order.department,
                    warehouse: order.warehouse,
                    promotion_code: order.promotion_code,
                    shipper_id: order.shipper_id,
                    shipping_fee: order.shipping_fee
                };
                Object.entries(fieldMap).forEach(([key, oldVal]) => {
                    const newVal = payload[key];
                    if (String(oldVal || '') !== String(newVal || '')) {
                        changedFields[key] = { old: oldVal || '', new: newVal || '' };
                    }
                });

                const { error } = await supabase
                    .from('orders')
                    .update(payload)
                    .eq('id', order.id);
                if (error) throw error;

                await supabase.from('order_history').insert([{
                    order_id: order.id,
                    action: 'EDITED',
                    changed_fields: Object.keys(changedFields).length > 0 ? changedFields : null,
                    reason: editReason,
                    created_by: currentUser
                }]);
            } else {
                const { data: inserted, error } = await supabase
                    .from('orders')
                    .insert([payload])
                    .select('id');
                if (error) throw error;

                if (inserted && inserted[0]) {
                    const orderId = inserted[0].id;
                    await supabase.from('order_history').insert([{
                        order_id: orderId,
                        action: 'CREATED',
                        new_status: initialStatus,
                        created_by: currentUser
                    }]);

                    // Create System Notification
                    await supabase.from('notifications').insert([{
                        title: `Đơn hàng mới: ${formData.orderCode}`,
                        description: `Khách hàng ${customerName} đã được tạo bởi ${currentUser}.`,
                        type: 'info',
                        link: `/danh-sach-don-hang`
                    }]);
                }
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving order:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu đơn hàng.');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <>
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
                        "relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                        isClosing && "animate-out slide-out-to-right duration-300"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                {isReadOnly ? <Package className="w-5 h-5" /> : isEdit ? <Edit3 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                    {isReadOnly ? 'Chi tiết đơn hàng' : isEdit ? 'Chỉnh sửa đơn hàng' : 'Thêm đơn hàng'}
                                </h3>
                                <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                    Mã đơn: #{formData.orderCode}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-primary hover:text-primary/90 hover:bg-primary/5 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Body - Rest of the component remains the same */}

                {/* Form Body */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                <Package className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin đơn hàng</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Hash className="w-4 h-4 text-primary/70" />Mã đơn hàng <span className="text-red-500">*</span></label>
                                    <input
                                        value={formData.orderCode}
                                        disabled
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700 cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-primary/70" />Chọn khách hàng <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-4 border rounded-2xl text-[13px] transition-all flex justify-between items-center ${isFetchingCustomers || isReadOnly ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed shadow-none' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-primary/40 cursor-pointer'}`}
                                            onClick={() => !isFetchingCustomers && !isReadOnly && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span className={formData.customerId ? 'font-semibold text-[13px]' : 'text-slate-500 font-semibold text-[13px]'}>
                                                {isFetchingCustomers
                                                    ? 'Đang tải thông tin...'
                                                    : formData.customerId
                                                        ? customers.find(c => c.id.toString() === formData.customerId.toString())?.name
                                                        : 'Chọn khách hàng trong hệ thống'}
                                            </span>
                                            {!isReadOnly && <ChevronDown className={`w-4 h-4 transition-transform ${isCustomerDropdownOpen ? 'rotate-180 text-primary' : 'text-primary/70'}`} />}
                                        </div>

                                        {isCustomerDropdownOpen && !isFetchingCustomers && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-64 overflow-hidden flex flex-col rounded-xl">
                                                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-primary/50" />
                                                    <input
                                                        type="text"
                                                        className="w-full bg-transparent border-none outline-none text-sm font-semibold placeholder-slate-400 text-slate-700"
                                                        placeholder="Tìm tên KH, người đại diện hoặc SDT..."
                                                        value={customerSearchTerm}
                                                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                                    {filteredCustomers.length > 0 ? (
                                                        filteredCustomers.map(customer => (
                                                            <div
                                                                key={customer.id}
                                                                className={`px-4 py-2.5 cursor-pointer border-b border-slate-100 ${formData.customerId === customer.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                                                onClick={() => handleCustomerSelect(customer)}
                                                            >
                                                                <div className={`font-semibold text-sm ${formData.customerId === customer.id ? 'text-primary' : 'text-slate-800'}`}>
                                                                    {customer.name}
                                                                </div>
                                                                <div className="text-xs text-slate-500 flex gap-3 mt-1">
                                                                    {customer.recipient && <span>{customer.recipient}</span>}
                                                                    {customer.phone && <span>{customer.phone}</span>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-6 text-center text-sm text-slate-500">Không tìm thấy khách hàng phù hợp.</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {cylinderDebt.length > 0 && (
                                        <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-[11px] uppercase tracking-wider">
                                                <AlertTriangle size={14} /> Nợ vỏ hiện tại
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {cylinderDebt.map((debt, idx) => (
                                                    <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white border border-amber-100 rounded-xl shadow-sm">
                                                        <span className="text-[12px] font-bold text-slate-600">{debt.cylinder_type}</span>
                                                        <span className="text-[14px] font-black text-amber-600">{debt.debt_count} cái</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-primary/70" />Tên người nhận <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientName"
                                        value={formData.recipientName}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="Nhập tên người nhận"
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Phone className="w-4 h-4 text-primary/70" />Số điện thoại <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientPhone"
                                        value={formData.recipientPhone}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="09xxxxxxxx"
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><MapPin className="w-4 h-4 text-primary/70" />Địa chỉ giao hàng <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientAddress"
                                        value={formData.recipientAddress}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="Nhập địa chỉ"
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                <Edit3 className="w-4 h-4 text-primary/80" />
                                <h4 className="text-[18px] !font-extrabold !text-primary">Vị trí & loại đơn</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại khách hàng</label>
                                    <select
                                        name="customerCategory"
                                        value={formData.customerCategory}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] cursor-not-allowed text-slate-600"
                                        disabled
                                    >
                                        {CUSTOMER_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Kho xuất hàng <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            name="warehouse"
                                            value={formData.warehouse}
                                            onChange={handleChange}
                                            disabled={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none transition-all",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        >
                                            <option value="">Chọn kho</option>
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                        {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại sản phẩm</label>
                                    <div className="relative">
                                        <select
                                            name="productType"
                                            value={formData.productType}
                                            onChange={handleChange}
                                            disabled={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        >
                                            {PRODUCT_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                        </select>
                                        {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại đơn hàng</label>
                                    <div className="relative">
                                        <select
                                            name="orderType"
                                            value={formData.orderType}
                                            onChange={handleChange}
                                            disabled={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        >
                                            {ORDER_TYPES.map(item => (
                                                <option key={item.id} value={item.id}>{item.label}</option>
                                            ))}
                                        </select>
                                        {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Đơn giá (VNĐ)</label>
                                        <input
                                            type="text"
                                            value={formatNumber(formData.unitPrice)}
                                            onChange={handleUnitPriceChange}
                                            readOnly={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-primary">Thành tiền (VNĐ)</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={formatNumber(calculatedTotalAmount)}
                                            className="w-full h-12 px-4 bg-primary/5 border border-primary/20 rounded-2xl text-[15px] font-semibold text-primary cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Số lượng <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.quantity)}
                                        onChange={handleQuantityChange}
                                        readOnly={isReadOnly}
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                    />
                                </div>

                                {((formData.productType?.toUpperCase().match(/^(MAY|MÁY)/) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED'].includes(formData.productType?.toUpperCase())) || !!formData.tempSerial) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-slate-800">Khoa sử dụng máy</label>
                                            <input
                                                name="tempDept"
                                                value={formData.tempDept}
                                                onChange={handleChange}
                                                readOnly={isReadOnly}
                                                placeholder="Ví dụ: Khoa Da Liễu"
                                                className={clsx(
                                                    "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-primary">Mã máy (Serial) <span className="text-red-500">*</span></label>
                                            <input
                                                name="tempSerial"
                                                value={formData.tempSerial}
                                                onChange={handleChange}
                                                readOnly={isReadOnly}
                                                placeholder="Ví dụ: PR-01"
                                                className={clsx(
                                                    "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-bold transition-all",
                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-primary border-primary/20 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Khuyến mãi (Áp dụng mã)</label>
                                    <div className="relative">
                                        <select
                                            name="promotion"
                                            value={formData.promotion}
                                            onChange={handleChange}
                                            disabled={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        >
                                            <option value="">-- Không có mã khuyến mãi --</option>
                                            {promotionsList.map(p => (
                                                <option key={p.id} value={p.code}>
                                                    {p.code} - Tặng {p.free_cylinders} bình
                                                </option>
                                            ))}
                                        </select>
                                        {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                    </div>
                                    {freeCylinders > 0 && (
                                        <div className="mt-1 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl flex justify-between items-center text-[11px] font-bold text-orange-600">
                                            <span>Khấu trừ: -{freeCylinders} bình</span>
                                            <span>Tính tiền: {billedQuantity} bình</span>
                                        </div>
                                    )}
                                </div>

                                {(formData.productType?.toUpperCase().startsWith('BINH') || formData.productType?.toUpperCase().startsWith('BÌNH') || (assignedCylinders && assignedCylinders.length > 0)) && formData.quantity > 0 && (
                                    <div className="pt-3 mt-2 border-t border-primary/10 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[13px] !font-bold !text-primary flex items-center gap-2">
                                                <ScanLine className="w-4 h-4 text-primary/80" strokeWidth={2.5} /> Gán mã bình ({assignedCylinders.filter(c => typeof c === 'string' ? (c !== '') : (c?.serial !== '')).length}/{formData.quantity})
                                            </h5>
                                            {!isReadOnly && (
                                                <button
                                                    type="button"
                                                    onClick={startScanAll}
                                                    className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-700 transition-all flex items-center gap-1.5"
                                                >
                                                    <ScanLine className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /> Quét tất cả
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {assignedCylinders.map((item, idx) => {
                                                const serial = typeof item === 'string' ? item : item.serial;
                                                const scanTime = typeof item === 'string' ? null : item.scan_time;

                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
                                                            <input
                                                                type="text"
                                                                value={serial}
                                                                onChange={(e) => handleCylinderSerialChange(idx, e.target.value)}
                                                                readOnly={isReadOnly}
                                                                onKeyDown={(e) => {
                                                                    if (!isReadOnly && e.key === 'Enter' && e.target.value) {
                                                                        const now = new Date();
                                                                        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                                                                        toast.success(`Đã nhận mã: ${e.target.value} (${timeStr})`, {
                                                                            position: "top-center",
                                                                            autoClose: 1500,
                                                                            hideProgressBar: true,
                                                                            closeOnClick: true,
                                                                            pauseOnHover: false,
                                                                            draggable: true,
                                                                            theme: "colored",
                                                                            style: {
                                                                                borderRadius: '16px',
                                                                                fontWeight: 'bold',
                                                                                fontSize: '13px',
                                                                                fontFamily: 'Inter, sans-serif'
                                                                            }
                                                                        });
                                                                    }
                                                                }}
                                                                placeholder={`Mã serial bình ${idx + 1}...`}
                                                                className={clsx(
                                                                    "flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-[13px] transition-all",
                                                                    isReadOnly ? "text-slate-500 cursor-default" : "focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40"
                                                                )}
                                                            />
                                                            {!isReadOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startScanner(idx)}
                                                                    className="p-2.5 bg-primary/10 text-primary/80 rounded-xl hover:bg-primary/20 transition-all"
                                                                >
                                                                    <ScanLine className="w-4 h-4 text-primary/80" strokeWidth={2.5} />
                                                                </button>
                                                            )}
                                                            {serial && !isReadOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCylinderSerialChange(idx, '')}
                                                                    className="p-2.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {scanTime && (
                                                            <div className="flex items-center gap-1 ml-7">
                                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary rounded-md shadow-sm">
                                                                    <Clock className="w-3 h-3 text-white" strokeWidth={2.5} />
                                                                    <span className="text-[10px] font-black tracking-wider text-white" style={{ color: 'white !important', WebkitTextFillColor: 'white' }}>
                                                                        ĐÃ QUÉT: {scanTime}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-3 mt-2 border-t border-primary/10 space-y-4 [&_label]:text-primary [&_label_svg]:text-primary/80">
                                    <h5 className="text-[13px] !font-bold !text-primary">Phí giao hàng & đơn vị VC</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-slate-800">Đơn vị vận chuyển</label>
                                            <div className="relative">
                                                <select
                                                    name="shipperId"
                                                    value={formData.shipperId}
                                                    onChange={handleChange}
                                                    disabled={isReadOnly}
                                                    className={clsx(
                                                        "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                        isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                    )}
                                                >
                                                    <option value="">Chọn đơn vị vận chuyển</option>
                                                    {shippersList.map(shipper => (
                                                        <option key={shipper.id} value={shipper.id}>{shipper.name}</option>
                                                    ))}
                                                </select>
                                                {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-slate-800">Phí giao hàng (VNĐ)</label>
                                            <input
                                                type="text"
                                                value={formatNumber(formData.shippingFee)}
                                                onChange={handleShippingFeeChange}
                                                readOnly={isReadOnly}
                                                placeholder="Nhập phí giao hàng"
                                                className={clsx(
                                                    "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Ghi chú</label>
                                    <textarea
                                        name="note"
                                        value={formData.note}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        rows={3}
                                        placeholder="Thông tin bổ sung"
                                        className={clsx(
                                            "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold resize-none transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-primary font-bold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy
                    </button>
                    <button
                        type={isReadOnly ? "button" : "submit"}
                        form={isReadOnly ? undefined : "orderForm"}
                        disabled={isLoading}
                        onClick={isReadOnly ? () => {
                            setReasonSource('initial-edit');
                            setShowReasonModal(true);
                        } : undefined}
                        className={clsx(
                            "w-full md:flex-1 sm:w-auto px-6 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50",
                            isReadOnly 
                                ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-amber-200" 
                                : "bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200"
                        )}
                    >
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            isReadOnly ? <Edit3 className="w-4 h-4" /> : <Save className="w-4 h-4" />
                        )}
                        {isLoading 
                            ? 'Đang lưu đơn...' 
                            : isReadOnly 
                                ? 'Sửa đơn' 
                                : isEdit ? 'Xác nhận cập nhật' : 'Xác nhận tạo đơn hàng'}
                    </button>
                </div>

                </div>
            </div>

            {/* Edit Reason Modal */}
            {showReasonModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110000] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full p-8 space-y-6 animate-in zoom-in-95 duration-300 border border-slate-100">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100 shadow-sm">
                                <Edit3 className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight">Lý do chỉnh sửa</h3>
                                <p className="text-[13px] text-slate-500 font-bold leading-relaxed px-4">Để đảm bảo tính minh bạch, vui lòng nhập lý do bạn thực hiện thay đổi đơn hàng này.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung thay đổi</label>
                            <textarea
                                rows="3"
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                placeholder="Ví dụ: Thay đổi số lượng theo yêu cầu khách, cập nhật địa chỉ mới..."
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 font-bold text-[15px] text-slate-700 resize-none transition-all placeholder:text-slate-300"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-4 pt-2">
                            <button
                                onClick={() => setShowReasonModal(false)}
                                className="flex-1 px-6 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-black text-[14px] uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={() => {
                                    if (!editReason.trim()) {
                                        toast.warning('Vui lòng nhập lý do!', {
                                            position: "top-center",
                                            autoClose: 2000,
                                            hideProgressBar: true,
                                            theme: "colored"
                                        });
                                        return;
                                    }
                                    setShowReasonModal(false);
                                    if (reasonSource === 'initial-edit') {
                                        setMode('edit');
                                    } else {
                                        // Use requestSubmit instead of submit to trigger HTML5 validation
                                        document.getElementById('orderForm').requestSubmit();
                                    }
                                }}
                                className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-black text-[14px] uppercase tracking-wider hover:bg-primary-700 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Lưu thay đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BarcodeScanner
                isOpen={isScannerOpen}
                onScanSuccess={handleScanSuccess}
                onClose={() => setIsScannerOpen(false)}
                className="z-[110005]"
                title={scanTargetIndexRef.current !== -1 ? `Quét mã bình #${scanTargetIndexRef.current + 1}` : 'Quét mã bình'}
                scan_time={new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
            />
        </>,
        document.body
    );
}
