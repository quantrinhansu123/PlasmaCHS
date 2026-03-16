import {
    ScanLine, Plus, X, ChevronDown, Trash2,
    Link2, User, Phone, MapPin, Package, Clock
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CUSTOMER_CATEGORIES,
    ORDER_TYPES,
    PRODUCT_TYPES
} from '../constants/orderConstants';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';
import { patchIOSVideoPlaysinline } from '../utils/scannerHelper';
import BarcodeScanner from '../components/Common/BarcodeScanner';
import { toast } from 'react-toastify';

const CreateOrder = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editOrder = state?.order;
    const { role, user } = usePermissions();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customersList, setCustomersList] = useState([]);
    const [shippersList, setShippersList] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [promotionsList, setPromotionsList] = useState([]);

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
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [assignedCylinders, setAssignedCylinders] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanTargetIndex, setScanTargetIndex] = useState(-1);
    const scanTargetIndexRef = useRef(-1);
    useEffect(() => { scanTargetIndexRef.current = scanTargetIndex; }, [scanTargetIndex]);
    const [scanCount, setScanCount] = useState(0);
    const [isBatchScanning, setIsBatchScanning] = useState(false);
    const [assignedCylinderTimes, setAssignedCylinderTimes] = useState(new Array(editOrder?.quantity || 0).fill(''));
    const assignedCylindersRef = useRef(assignedCylinders);
    useEffect(() => { assignedCylindersRef.current = assignedCylinders; }, [assignedCylinders]);
    const isBatchScanningRef = useRef(isBatchScanning);
    useEffect(() => { isBatchScanningRef.current = isBatchScanning; }, [isBatchScanning]);

    // Sync scan times array length with cylinders array
    useEffect(() => {
        setAssignedCylinderTimes(prev => {
            if (prev.length === assignedCylinders.length) return prev;
            const newArr = [...prev];
            if (assignedCylinders.length > newArr.length) {
                return [...newArr, ...new Array(assignedCylinders.length - newArr.length).fill('')];
            } else {
                return newArr.slice(0, assignedCylinders.length);
            }
        });
    }, [assignedCylinders.length]);

    const getNewOrderCode = () => Math.floor(1000 + Math.random() * 9000).toString();

    const defaultState = {
        orderCode: getNewOrderCode(),
        customerCategory: 'TM',
        warehouse: '',
        customerId: '',
        recipientName: '',
        recipientAddress: '',
        recipientPhone: '',
        orderType: 'THUONG',
        productType: 'BINH_4L',
        quantity: 0,
        unitPrice: 0,
        department: '',
        promotion: '',
        shipperId: '',
        shippingFee: 0,
        note: ''
    };

    const initialFormState = editOrder ? {
        orderCode: editOrder.order_code,
        customerCategory: editOrder.customer_category,
        warehouse: editOrder.warehouse,
        customerId: '', // Sẽ load sau
        customerName: editOrder.customer_name || '',
        recipientName: editOrder.recipient_name,
        recipientAddress: editOrder.recipient_address || '',
        recipientPhone: editOrder.recipient_phone,
        orderType: editOrder.order_type,
        productType: editOrder.product_type,
        quantity: editOrder.quantity,
        unitPrice: editOrder.unit_price || 0,
        department: editOrder.department || '',
        promotion: editOrder.promotion_code || '',
        shipperId: editOrder.shipper_id || '',
        shippingFee: editOrder.shipping_fee || 0,
        note: editOrder.note || ''
    } : defaultState;

    const [formData, setFormData] = useState(initialFormState);

    const resetForm = () => {
        setFormData({
            ...defaultState,
            orderCode: getNewOrderCode()
        });
    };

    // Load actual customers instead of MOCK
    useEffect(() => {
        const fetchCustomers = async () => {
            const { data } = await supabase.from('customers').select('*');
            if (data) {
                setCustomersList(data);
                // If editing, find the ID naturally
                if (editOrder) {
                    const match = data.find(c => c.name === editOrder.customer_name);
                    if (match) {
                        setFormData(prev => ({ ...prev, customerId: match.id }));
                    }
                }
            }
        };
        const fetchShippers = async () => {
            const { data } = await supabase.from('shippers').select('id, name');
            if (data) setShippersList(data);
        };
        const fetchWarehouses = async () => {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
                // Set default warehouse if not editing
                if (!editOrder && data.length > 0 && !formData.warehouse) {
                    setFormData(prev => ({ ...prev, warehouse: data[0].id }));
                } else if (editOrder) {
                    const exists = data.some(w => w.id === editOrder.warehouse);
                    if (!exists && data.length > 0) {
                        setFormData(prev => ({ ...prev, warehouse: '' }));
                    }
                }
            }
        };
        const fetchPromotions = async () => {
            const { data } = await supabase
                .from('app_promotions')
                .select('*')
                .eq('is_active', true)
                .lte('start_date', new Date().toISOString().split('T')[0])
                .gte('end_date', new Date().toISOString().split('T')[0]);
            if (data) setPromotionsList(data);
        };
        fetchCustomers();
        fetchShippers();
        fetchWarehouses();
        fetchPromotions();
    }, [editOrder]);

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '0';
        const parts = val.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(',');
    };

    const handleQuantityChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');

        if (value === '') {
            setFormData({ ...formData, quantity: 0 });
            setAssignedCylinders([]);
            return;
        }

        const parsedValue = parseInt(value, 10);
        setFormData({ ...formData, quantity: parsedValue });

        // Only auto-resize for BINH product type
        if (formData.productType.startsWith('BINH')) {
            setAssignedCylinders(prev => {
                const newArr = [...prev];
                if (parsedValue > newArr.length) {
                    for (let i = newArr.length; i < parsedValue; i++) newArr.push('');
                } else {
                    newArr.length = parsedValue;
                }
                return newArr;
            });
        }
    };

    const handleUnitPriceChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value === '') {
            setFormData({ ...formData, unitPrice: 0 });
            return;
        }
        setFormData({ ...formData, unitPrice: parseInt(value, 10) });
    };

    const handleShippingFeeChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value === '') {
            setFormData({ ...formData, shippingFee: 0 });
            return;
        }
        setFormData({ ...formData, shippingFee: parseInt(value, 10) });
    };

    const selectedPromo = promotionsList.find(p => p.code === formData.promotion);
    const freeCylinders = selectedPromo ? (selectedPromo.free_cylinders || 0) : 0;
    const billedQuantity = Math.max(0, (formData.quantity || 0) - freeCylinders);
    const calculatedTotalAmount = billedQuantity * (formData.unitPrice || 0);

    const handleCustomerSelect = (customer) => {
        setFormData({
            ...formData,
            customerId: customer.id,
            recipientName: customer.representative_name || customer.name || '',
            recipientAddress: customer.shipping_address || customer.address || '',
            recipientPhone: customer.phone || '',
            customerCategory: customer.category || 'TM'
        });
        setIsCustomerDropdownOpen(false);
        setCustomerSearchTerm('');
    };

    const filteredCustomers = customersList.filter(c => {
        const categoryMatch = c.category === formData.customerCategory || (!c.category && formData.customerCategory === 'BV'); // fallback if c.category is missing
        const searchMatch = c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
            (c.phone && c.phone.includes(customerSearchTerm)) ||
            (c.representative_name && c.representative_name.toLowerCase().includes(customerSearchTerm.toLowerCase()));
        return categoryMatch && searchMatch;
    });

    // Initialize assignedCylinders when editing
    useEffect(() => {
        if (editOrder?.assigned_cylinders) {
            setAssignedCylinders(editOrder.assigned_cylinders);
            setAssignedCylinderTimes(new Array(editOrder.assigned_cylinders.length).fill(''));
        }
    }, [editOrder]);

    const stopCylinderScanner = useCallback(() => {
        setIsScannerOpen(false);
        setScanTargetIndex(-1);
    }, []);

    const startCylinderScanner = useCallback((targetIndex, isBatch = false) => {
        setScanTargetIndex(targetIndex);
        setScanCount(0);
        setIsScannerOpen(true);
        setIsBatchScanning(isBatch);
    }, []);

    // Find first empty slot and start scanning
    const startScanAll = useCallback(() => {
        const firstEmpty = assignedCylinders.findIndex(s => !s);
        if (firstEmpty === -1) {
            alert('\u0110\u00e3 g\u00e1n \u0111\u1ee7 m\u00e3 b\u00ecnh!');
            return;
        }
        startCylinderScanner(firstEmpty, true);
    }, [assignedCylinders, startCylinderScanner]);

    const handleCylinderSerialChange = (index, value) => {
        setAssignedCylinders(prev => {
            const newArr = [...prev];
            newArr[index] = value;
            return newArr;
        });
    };

    const handleManualConfirm = (index) => {
        const serial = assignedCylinders[index];
        if (serial) {
            setAssignedCylinderTimes(prev => {
                const newArr = [...prev];
                newArr[index] = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                return newArr;
            });
            toast.success(`Đã xác nhận thời gian quét cho mã ${serial}`);
        }
    };

    // Handle the scanning event coming from the new 3-tier generic Barcode Scanner
    // that uses Native/ZXing behind the scenes
    const handleScanSuccess = useCallback((decodedText, time) => {
        const currentArr = assignedCylindersRef.current;
        const currentIdx = scanTargetIndexRef.current;
        
        if (currentIdx === -1) return;
        
        // Skip if already in the list
        if (currentArr.includes(decodedText)) {
            toast.info(`Mã ${decodedText} đã được gán vào đơn hàng này rồi!`);
            return;
        }

        // Fill the current target index
        setAssignedCylinders(prev => {
            const newArr = [...prev];
            newArr[currentIdx] = decodedText;
            return newArr;
        });
        setAssignedCylinderTimes(prev => {
            const newArr = [...prev];
            newArr[currentIdx] = time;
            return newArr;
        });
        setScanCount(prev => prev + 1);

        // Find next empty slot
        const updatedArr = [...currentArr];
        updatedArr[currentIdx] = decodedText;
        const nextEmpty = updatedArr.findIndex((s, i) => i > currentIdx && !s);
        const fallbackEmpty = updatedArr.findIndex((s) => !s);
        const nextIdx = nextEmpty !== -1 ? nextEmpty : fallbackEmpty;

        if (nextIdx !== -1 && nextIdx !== currentIdx && isBatchScanningRef.current) {
            // Found a next empty slot, keep scanner open and move target index
            setScanTargetIndex(nextIdx);
        } else {
            // All slots filled OR not in batch mode
            stopCylinderScanner();
            if (isBatchScanningRef.current && nextIdx === -1) {
                alert('Đã gán đủ mã bình!');
            }
        }
    }, [scanTargetIndex, stopCylinderScanner]);


    const handleCreateOrder = async () => {
        if (!formData.customerId || !formData.recipientName || !formData.recipientAddress || !formData.recipientPhone || formData.quantity <= 0) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc và số lượng phải lớn hơn 0 (*)');
            return;
        }

        // If editing, require reason
        if (editOrder && !editReason.trim()) {
            setShowReasonModal(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const customerName = customersList.find(c => c.id === formData.customerId)?.name || formData.customerName || '';
            const currentUser = user?.name || user?.email || 'Hệ thống';

            let initialStatus = 'CHO_DUYET';
            if (!editOrder && (role === 'admin' || role === 'thu_kho')) {
                initialStatus = 'DA_DUYET';
            }

            const assignedSerials = formData.productType.startsWith('BINH') ? assignedCylinders.filter(Boolean) : [];

            // 1. VALIDATION: Check if cylinders exist and are in the correct warehouse
            if (assignedSerials.length > 0) {
                const { data: validCylinders, error: checkError } = await supabase
                    .from('cylinders')
                    .select('serial_number, warehouse_id, status')
                    .in('serial_number', assignedSerials);

                if (checkError) throw new Error('Lỗi kiểm tra mã bình: ' + checkError.message);

                if (!validCylinders || validCylinders.length !== assignedSerials.length) {
                    const foundSerials = validCylinders?.map(c => c.serial_number) || [];
                    const missing = assignedSerials.filter(s => !foundSerials.includes(s));
                    throw new Error(`Mã bình không tồn tại trong hệ thống: ${missing.join(', ')}`);
                }

                // Check warehouse consistency
                const wrongWarehouse = validCylinders.filter(c => c.warehouse_id !== formData.warehouse);
                if (wrongWarehouse.length > 0) {
                    throw new Error(`Mã bình sau không thuộc kho đã chọn: ${wrongWarehouse.map(c => c.serial_number).join(', ')}`);
                }
            }

            // 2. INVENTORY DEDUCTION (If direct DA_DUYET)
            if (!editOrder && initialStatus === 'DA_DUYET') {
                const productConfig = PRODUCT_TYPES.find(p => p.id === formData.productType);
                const productLabel = productConfig ? productConfig.label : formData.productType;

                // Check Inventory
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

                // Start updates (Cylinders and Inventory)
                if (assignedSerials.length > 0) {
                    const { error: cylUpdErr } = await supabase
                        .from('cylinders')
                        .update({ status: 'đang vận chuyển', customer_name: customerName })
                        .in('serial_number', assignedSerials);
                    if (cylUpdErr) throw new Error('Lỗi cập nhật trạng thái bình: ' + cylUpdErr.message);
                }

                // Update inventory
                const { error: invUpdErr } = await supabase
                    .from('inventory')
                    .update({ quantity: invData.quantity - formData.quantity })
                    .eq('id', invData.id);
                if (invUpdErr) throw new Error('Lỗi trừ tồn kho: ' + invUpdErr.message);

                // Log transaction
                await supabase.from('inventory_transactions').insert([{
                    inventory_id: invData.id,
                    transaction_type: 'OUT',
                    quantity_changed: formData.quantity,
                    note: `Xuất kho trực tiếp - Đơn ${formData.orderCode}`
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
                unit_price: formData.unitPrice,
                total_amount: calculatedTotalAmount,
                department: formData.department,
                promotion_code: formData.promotion,
                shipper_id: formData.shipperId || null,
                shipping_fee: formData.shippingFee || 0,
                assigned_cylinders: assignedSerials.length > 0 ? assignedSerials : null,
                status: editOrder ? editOrder.status : initialStatus,
                ordered_by: editOrder ? editOrder.ordered_by : currentUser
            };

            if (editOrder) {
                // Detect changed fields
                const changedFields = {};
                const fieldMap = {
                    customer_name: editOrder.customer_name,
                    recipient_name: editOrder.recipient_name,
                    recipient_address: editOrder.recipient_address,
                    recipient_phone: editOrder.recipient_phone,
                    quantity: editOrder.quantity,
                    unit_price: editOrder.unit_price,
                    total_amount: editOrder.total_amount,
                    note: editOrder.note,
                    order_type: editOrder.order_type,
                    product_type: editOrder.product_type,
                    department: editOrder.department,
                    warehouse: editOrder.warehouse,
                    promotion_code: editOrder.promotion_code,
                    shipping_fee: editOrder.shipping_fee
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
                    .eq('id', editOrder.id);
                if (error) throw error;

                // Log EDITED history
                await supabase.from('order_history').insert([{
                    order_id: editOrder.id,
                    action: 'EDITED',
                    changed_fields: Object.keys(changedFields).length > 0 ? changedFields : null,
                    reason: editReason,
                    created_by: currentUser
                }]);

                alert('🎉 Cập nhật đơn hàng thành công!');
                navigate('/danh-sach-don-hang');
            } else {
                const { data: inserted, error } = await supabase
                    .from('orders')
                    .insert([payload])
                    .select('id');
                if (error) throw error;

                // Log CREATED history
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

                alert('🎉 Tạo đơn hàng thành công!');
                resetForm();
            }

        } catch (error) {
            console.error('Error creating order:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="p-4 md:p-8 max-w-[1200px] mx-auto min-h-screen bg-[#F8F9FA]" style={{ fontFamily: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                {/* Main Content Card */}
                <div className="bg-white shadow-sm border border-[#E5E7EB] overflow-hidden relative z-10">
                    <div className="p-6 md:p-8 border-b border-[#E5E7EB] bg-[#2563EB] text-white">
                        <h3 className="text-xl font-semibold flex items-center gap-3" style={{ fontFamily: '"Roboto", sans-serif' }}>
                            <div className="w-8 h-8 bg-white/20 flex items-center justify-center text-white">
                                <Plus className="w-5 h-5" />
                            </div>
                            {editOrder ? 'Cập nhật đơn hàng' : 'Thông tin đơn hàng'}
                        </h3>
                        <p className="text-blue-100 text-sm mt-2 ml-11" style={{ fontFamily: '"Roboto", sans-serif' }}>Vui lòng điền đầy đủ các thông tin bắt buộc được đánh dấu (*)</p>
                    </div>

                    <div className="p-6 md:p-10 space-y-8 md:space-y-10">
                        {/* Section 1: Thông tin định danh */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>1. Mã đơn hàng (Tự động)</label>
                                <input value={formData.orderCode} disabled className="w-full px-4 py-3 bg-[#F3F4F6] border border-[#D1D5DB] font-medium text-[#6B7280] text-sm cursor-not-allowed" style={{ fontFamily: '"Roboto", sans-serif' }} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>2. Loại khách hàng *</label>
                                <select
                                    value={formData.customerCategory}
                                    onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                    style={{ fontFamily: '"Roboto", sans-serif' }}
                                >
                                    {CUSTOMER_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>3. Kho</label>
                                <select
                                    value={formData.warehouse}
                                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                    style={{ fontFamily: '"Roboto", sans-serif' }}
                                >
                                    <option value="">-- Chọn kho --</option>
                                    {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Section 2: Thông tin khách hàng & Người nhận */}
                        <div className="p-6 md:p-8 bg-[#EFF6FF] border border-[#BFDBFE] space-y-6 md:space-y-8">
                            <div className="space-y-2 relative" ref={customerDropdownRef}>
                                <label className="text-xs font-medium text-[#2563EB] uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                    <Package className="w-4 h-4" /> 4. Chọn Khách hàng *
                                </label>

                                {/* Custom Select Trigger */}
                                <div
                                    className="w-full px-4 py-3 bg-white border border-[#93C5FD] outline-none hover:border-[#2563EB] font-medium text-sm transition-all cursor-pointer flex justify-between items-center"
                                    onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                >
                                    <span className={formData.customerId ? "text-[#111827]" : "text-gray-500"}>
                                        {formData.customerId
                                            ? customersList.find(c => c.id === formData.customerId)?.name
                                            : '-- Chọn khách hàng trong hệ thống --'}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Custom Dropdown Menu */}
                                {isCustomerDropdownOpen && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-hidden flex flex-col">
                                        <div className="p-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50 sticky top-0">
                                            <Search className="w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                className="w-full bg-transparent border-none outline-none text-sm placeholder-gray-400"
                                                placeholder="Tìm tên KH, người đại diện hoặc SĐT..."
                                                value={customerSearchTerm}
                                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="overflow-y-auto custom-scrollbar flex-1">
                                            {filteredCustomers.length > 0 ? (
                                                filteredCustomers.map(customer => (
                                                    <div
                                                        key={customer.id}
                                                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-none transition-colors"
                                                        onClick={() => handleCustomerSelect(customer)}
                                                    >
                                                        <div className="font-medium text-sm text-gray-900">{customer.name}</div>
                                                        <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                                                            {customer.representative_name && <span>👤 {customer.representative_name}</span>}
                                                            {customer.phone && <span>📞 {customer.phone}</span>}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-4 text-sm text-center text-gray-500 italic">
                                                    Không tìm thấy khách hàng nào khớp.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>5. Tên người nhận *</label>
                                    <input
                                        value={formData.recipientName}
                                        onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                                        placeholder="Hệ thống tự động hiển thị..."
                                        className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                        style={{ fontFamily: '"Roboto", sans-serif' }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>7. SĐT người nhận *</label>
                                    <input
                                        value={formData.recipientPhone}
                                        onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                                        placeholder="Ví dụ: 0399749111"
                                        className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                        style={{ fontFamily: '"Roboto", sans-serif' }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>6. Địa chỉ nhận *</label>
                                <input
                                    value={formData.recipientAddress}
                                    onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                                    placeholder="Hệ thống tự động hiển thị..."
                                    className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                    style={{ fontFamily: '"Roboto", sans-serif' }}
                                />
                            </div>
                        </div>

                        {/* Section 3: Chi tiết đơn hàng & Hàng hóa */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                            <div className="space-y-6 md:space-y-8">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>8. Loại đơn hàng *</label>
                                    <select
                                        value={formData.orderType}
                                        onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                        style={{ fontFamily: '"Roboto", sans-serif' }}
                                    >
                                        {ORDER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>9. Ghi chú</label>
                                    <textarea
                                        rows="4"
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        placeholder="Thông tin bổ sung để admin duyệt đơn..."
                                        className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-normal text-sm transition-all resize-none"
                                        style={{ fontFamily: '"Roboto", sans-serif' }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-6 md:space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>10. Hàng hóa *</label>
                                        <select
                                            value={formData.productType}
                                            onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                            style={{ fontFamily: '"Roboto", sans-serif' }}
                                        >
                                            {PRODUCT_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>11. Số lượng *</label>
                                        <input
                                            type="text"
                                            value={formatNumber(formData.quantity)}
                                            onChange={handleQuantityChange}
                                            className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-semibold text-base text-[#2563EB] transition-all"
                                            style={{ fontFamily: '"Roboto", sans-serif' }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>11b. Đơn giá (VNĐ) *</label>
                                        <input
                                            type="text"
                                            value={formatNumber(formData.unitPrice)}
                                            onChange={handleUnitPriceChange}
                                            className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#10B981] focus:border-[#10B981] font-semibold text-base text-[#059669] transition-all"
                                            style={{ fontFamily: '"Roboto", sans-serif' }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-[#059669] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>11c. Thành tiền (VNĐ)</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                disabled
                                                value={formatNumber(calculatedTotalAmount)}
                                                className="w-full px-4 py-3 bg-[#D1FAE5] border border-[#A7F3D0] font-semibold text-base text-[#065F46] cursor-not-allowed"
                                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                            />
                                            {freeCylinders > 0 && (
                                                <div className="absolute -bottom-5 right-0 text-[10px] font-bold text-orange-600 flex gap-2">
                                                    <span>Khấu trừ: -{formatNumber(freeCylinders)} bình</span>
                                                    <span>Tính tiền: {formatNumber(billedQuantity)} bình</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Cylinder Serial Assignment */}
                                {formData.productType.startsWith('BINH') && formData.quantity > 0 && (
                                    <div className="mt-6 p-5 bg-[#EFF6FF] border border-[#BFDBFE] space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-medium text-[#2563EB] uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: '"Roboto", sans-serif' }}>
                                                <ScanLine className="w-4 h-4" /> Gán mã bình ({assignedCylinders.filter(Boolean).length}/{formData.quantity})
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={startScanAll}
                                                className="px-3 py-1.5 bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] transition-all flex items-center gap-1.5"
                                            >
                                                <ScanLine className="w-3.5 h-3.5" /> Quét tất cả
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {assignedCylinders.map((serial, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-400 w-6 text-right">{idx + 1}.</span>
                                                        <input
                                                            type="text"
                                                            value={serial}
                                                            onChange={(e) => handleCylinderSerialChange(idx, e.target.value)}
                                                            placeholder={`Mã serial bình ${idx + 1}...`}
                                                            className="flex-1 px-3 py-2.5 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                                            style={{ fontFamily: '"Roboto", sans-serif' }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleManualConfirm(idx);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => startCylinderScanner(idx)}
                                                            className="flex-none w-10 h-10 bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-all flex items-center justify-center rounded-md shadow-sm"
                                                            title="Quét barcode"
                                                        >
                                                            <ScanLine className="w-5 h-5" />
                                                        </button>
                                                        {serial && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    handleCylinderSerialChange(idx, '');
                                                                    setAssignedCylinderTimes(prev => {
                                                                        const newArr = [...prev];
                                                                        newArr[idx] = '';
                                                                        return newArr;
                                                                    });
                                                                }}
                                                                className="flex-none p-2 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-md"
                                                                title="Xóa"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {assignedCylinderTimes[idx] && (
                                                        <div className="ml-8 mt-1">
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded shadow-sm border border-blue-500">
                                                                <Clock className="w-3 h-3" />
                                                                ĐÃ QUÉT: {assignedCylinderTimes[idx]}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {formData.productType.startsWith('MAY') && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>12. Khoa sử dụng máy / Mã máy</label>
                                        <input
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            placeholder="Ví dụ: Máy PlasmaRosy PR-01"
                                            className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                            style={{ fontFamily: '"Roboto", sans-serif' }}
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#374151] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>13. Khuyến mãi (Áp dụng mã)</label>
                                    <select
                                        value={formData.promotion}
                                        onChange={(e) => setFormData({ ...formData, promotion: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-[#D1D5DB] outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] font-medium text-sm transition-all"
                                        style={{ fontFamily: '"Roboto", sans-serif' }}
                                    >
                                        <option value="">-- Không có mã khuyến mãi --</option>
                                        {promotionsList.map(p => (
                                            <option key={p.id} value={p.code}>
                                                {p.code} - Tặng {p.free_cylinders} bình
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 mt-4 border-t border-[#E5E7EB] space-y-6">
                                    <h4 className="text-xs font-medium text-[#DC2626] uppercase tracking-wide" style={{ fontFamily: '"Roboto", sans-serif' }}>14. Phí Giao Hàng & Đơn vị VC</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                                        <div className="space-y-2">
                                            <select
                                                value={formData.shipperId}
                                                onChange={(e) => setFormData({ ...formData, shipperId: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-[#FCA5A5] outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-[#DC2626] font-medium text-sm transition-all"
                                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                            >
                                                <option value="">-- Chọn Đơn vị VC (Tuỳ chọn) --</option>
                                                {shippersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2 relative">
                                            <input
                                                type="text"
                                                value={formatNumber(formData.shippingFee)}
                                                onChange={handleShippingFeeChange}
                                                placeholder="Nhập cước phí..."
                                                className="w-full px-4 py-3 pl-10 bg-white border border-[#FCA5A5] outline-none focus:ring-2 focus:ring-[#DC2626] focus:border-[#DC2626] font-semibold text-base text-[#DC2626] transition-all placeholder:text-[#FCA5A5] placeholder:font-normal"
                                                style={{ fontFamily: '"Roboto", sans-serif' }}
                                            />
                                            <span className="absolute left-4 top-[11px] text-[#F87171] font-medium text-sm">đ</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-10 bg-[#F9FAFB] border-t border-[#E5E7EB] flex flex-col md:flex-row items-center justify-between gap-6">
                        <p className="text-sm text-[#6B7280] font-normal w-full text-center md:text-left" style={{ fontFamily: '"Roboto", sans-serif' }}>* Vui lòng kiểm tra kỹ thông tin trước khi nhấn Xác nhận.</p>
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <button
                                onClick={() => navigate('/danh-sach-don-hang')}
                                className="w-full sm:w-auto px-8 py-3 bg-white border border-[#D1D5DB] text-[#374151] font-medium hover:bg-[#F3F4F6] transition-all"
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleCreateOrder}
                                disabled={isSubmitting}
                                className={`w-full sm:w-auto px-10 py-3 text-white font-medium text-base transition-all ${isSubmitting
                                    ? 'bg-[#9CA3AF] cursor-not-allowed'
                                    : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                                    }`}
                                style={{ fontFamily: '"Roboto", sans-serif' }}
                            >
                                {isSubmitting ? 'Đang lưu đơn...' : editOrder ? 'Xác nhận cập nhật' : 'Xác nhận tạo đơn hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showReasonModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-black text-gray-900">📝 Lý do chỉnh sửa</h3>
                        <p className="text-sm text-gray-500 font-medium">Vui lòng nhập lý do chỉnh sửa đơn hàng để lưu lịch sử.</p>
                        <textarea
                            rows="3"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Ví dụ: Khách yêu cầu tăng số lượng..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-medium text-sm resize-none"
                            autoFocus
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowReasonModal(false)}
                                className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    if (!editReason.trim()) {
                                        alert('Vui lòng nhập lý do!');
                                        return;
                                    }
                                    setShowReasonModal(false);
                                    handleCreateOrder();
                                }}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                            >
                                Xác nhận & Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3-Tier Barcode Scanner UI Component */}
            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={stopCylinderScanner}
                onScanSuccess={handleScanSuccess}
                title={`Quét mã bình (${assignedCylinders.filter(Boolean).length}/${formData.quantity})`}
                currentCount={assignedCylinders.filter(Boolean).length}
                totalCount={formData.quantity}
                allowDuplicateScans={true}
            />
        </>
    );
};

export default CreateOrder;
