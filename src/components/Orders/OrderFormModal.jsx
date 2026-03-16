import { ChevronDown, Clock, Edit3, Hash, MapPin, Package, Phone, Save, ScanLine, Search, User, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
    CUSTOMER_CATEGORIES,
    ORDER_TYPES,
    PRODUCT_TYPES
} from '../../constants/orderConstants';
import usePermissions from '../../hooks/usePermissions';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';

export default function OrderFormModal({ order, onClose, onSuccess }) {
    const { role, user } = usePermissions();
    const isEdit = !!order;
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [customers, setCustomers] = useState([]);
    const [shippersList, setShippersList] = useState([]);
    const [promotionsList, setPromotionsList] = useState([]);

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
        orderType: 'THUONG',
        note: '',
        productType: 'BINH_4L',
        quantity: 0,
        unitPrice: 0,
        department: '',
        promotion: '',
        shipperId: '',
        shippingFee: 0,
        assignedCylinders: []
    };

    const [formData, setFormData] = useState(defaultState);
    const [warehousesList, setWarehousesList] = useState([]);

    useEffect(() => {
        fetchRealCustomers();
        fetchWarehouses();
        fetchShippers();
        fetchPromotions();
    }, []);

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
            setFormData({
                orderCode: order.order_code,
                customerCategory: order.customer_category,
                warehouse: order.warehouse,
                customerId: customers.find(c => c.name === order.customer_name)?.id || '',
                recipientName: order.recipient_name,
                recipientAddress: order.recipient_address || '',
                recipientPhone: order.recipient_phone,
                orderType: order.order_type,
                note: order.note || '',
                productType: order.product_type,
                quantity: order.quantity,
                unitPrice: order.unit_price || 0,
                department: order.department || '',
                promotion: order.promotion_code || '',
                shipperId: order.shipper_id || '',
                shippingFee: order.shipping_fee || 0
            });
            if (order.assigned_cylinders) {
                setAssignedCylinders(order.assigned_cylinders);
            }
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
            recipientName: customer.recipient,
            recipientAddress: customer.address,
            recipientPhone: customer.phone,
            customerCategory: customer.category
        }));
        setIsCustomerDropdownOpen(false);
        setCustomerSearchTerm('');
    };

    const filteredCustomers = customers.filter(c => {
        const categoryMatch = c.category === formData.customerCategory || (!c.category && formData.customerCategory === 'BV'); // fallback if c.category is missing
        const searchMatch = c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
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
        setAssignedCylinders(prev => {
            const newArr = [...prev];
            const now = new Date();
            const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

            newArr[index] = {
                serial: value,
                scan_time: value ? (prev[index]?.scan_time || timeStr) : null
            };
            return newArr;
        });
    };

    const handleScanSuccess = useCallback((decodedText) => {
        const currentArr = assignedCylindersRef.current;
        const currentIdx = scanTargetIndexRef.current;

        if (currentIdx === -1) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

        setAssignedCylinders(prev => {
            const newArr = [...prev];
            newArr[currentIdx] = { serial: decodedText, scan_time: timeStr };
            return newArr;
        });

        const updatedArr = [...currentArr];
        updatedArr[currentIdx] = { serial: decodedText, scan_time: timeStr };
        const nextEmpty = updatedArr.findIndex((s, i) => i > currentIdx && !s?.serial);
        const fallbackEmpty = updatedArr.findIndex((s) => !s?.serial);
        const nextIdx = nextEmpty !== -1 ? nextEmpty : fallbackEmpty;

        if (nextIdx !== -1 && nextIdx !== currentIdx) {
            setScanTargetIndex(nextIdx);
        } else {
            setIsScannerOpen(false);
            setScanTargetIndex(-1);
        }
    }, [scanTargetIndex]);

    const startScanner = (targetIdx) => {
        setScanTargetIndex(targetIdx);
        setIsScannerOpen(true);
    };

    const startScanAll = () => {
        const firstEmpty = assignedCylinders.findIndex(s => !s);
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
            setShowReasonModal(true);
            return;
        }

        setIsLoading(true);

        try {
            const customerName = customers.find(c => c.id.toString() === formData.customerId.toString())?.name || '';
            const currentUser = user?.name || user?.email || 'Hệ thống';

            let initialStatus = 'CHO_DUYET';
            if (!isEdit && (role === 'admin' || role === 'thu_kho')) {
                initialStatus = 'DA_DUYET';
            }

            const assignedSerials = formData.productType.startsWith('BINH')
                ? assignedCylinders.map(c => typeof c === 'string' ? c : c.serial).filter(Boolean)
                : [];

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

                const wrongWarehouse = validCylinders.filter(c => c.warehouse_id !== formData.warehouse);
                if (wrongWarehouse.length > 0) {
                    throw new Error(`Mã bình sau không thuộc kho đã chọn: ${wrongWarehouse.map(c => c.serial_number).join(', ')}`);
                }
            }

            // 2. INVENTORY DEDUCTION (If direct DA_DUYET)
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
                        .update({ status: 'đang vận chuyển', customer_name: customerName })
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
                department: formData.department,
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
                    await supabase.from('order_history').insert([{
                        order_id: inserted[0].id,
                        action: 'CREATED',
                        new_status: initialStatus,
                        created_by: currentUser
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

    return (<>
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            {isEdit ? <Edit3 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa đơn hàng' : 'Thêm đơn hàng'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                Mã đơn: #{formData.orderCode}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-emerald-100">
                                <Package className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-[18px] !font-extrabold !text-emerald-700">Thông tin đơn hàng</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Hash className="w-4 h-4 text-emerald-500" />Mã đơn hàng <span className="text-red-500">*</span></label>
                                    <input
                                        value={formData.orderCode}
                                        disabled
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700 cursor-not-allowed"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-emerald-500" />Chọn khách hàng <span className="text-red-500">*</span></label>
                                    <div className="relative" ref={customerDropdownRef}>
                                        <div
                                            className={`w-full h-12 px-4 border rounded-2xl text-[13px] transition-all cursor-pointer flex justify-between items-center ${isFetchingCustomers ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-900 hover:border-emerald-300'}`}
                                            onClick={() => !isFetchingCustomers && setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                        >
                                            <span className={formData.customerId ? 'font-semibold text-[13px]' : 'text-slate-500 font-semibold text-[13px]'}>
                                                {isFetchingCustomers
                                                    ? 'Đang tải thông tin...'
                                                    : formData.customerId
                                                        ? customers.find(c => c.id.toString() === formData.customerId.toString())?.name
                                                        : 'Chọn khách hàng trong hệ thống'}
                                            </span>
                                            <ChevronDown className={`w-4 h-4 transition-transform ${isCustomerDropdownOpen ? 'rotate-180 text-emerald-600' : 'text-emerald-500'}`} />
                                        </div>

                                        {isCustomerDropdownOpen && !isFetchingCustomers && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 shadow-xl max-h-64 overflow-hidden flex flex-col rounded-xl">
                                                <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 sticky top-0 z-10">
                                                    <Search className="w-4 h-4 text-emerald-400" />
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
                                                                <div className={`font-semibold text-sm ${formData.customerId === customer.id ? 'text-blue-700' : 'text-slate-800'}`}>
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
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-emerald-500" />Tên người nhận <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientName"
                                        value={formData.recipientName}
                                        onChange={handleChange}
                                        placeholder="Nhập tên người nhận"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Phone className="w-4 h-4 text-emerald-500" />Số điện thoại <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientPhone"
                                        value={formData.recipientPhone}
                                        onChange={handleChange}
                                        placeholder="09xxxxxxxx"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><MapPin className="w-4 h-4 text-emerald-500" />Địa chỉ giao hàng <span className="text-red-500">*</span></label>
                                    <input
                                        name="recipientAddress"
                                        value={formData.recipientAddress}
                                        onChange={handleChange}
                                        placeholder="Nhập địa chỉ"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-green-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-green-700 [&_label_svg]:text-green-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-green-100">
                                <Edit3 className="w-4 h-4 text-green-600" />
                                <h4 className="text-[18px] !font-extrabold !text-green-700">Vị trí & loại đơn</h4>
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
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        >
                                            <option value="">Chọn kho</option>
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại sản phẩm</label>
                                    <div className="relative">
                                        <select
                                            name="productType"
                                            value={formData.productType}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        >
                                            {PRODUCT_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại đơn hàng</label>
                                    <div className="relative">
                                        <select
                                            name="orderType"
                                            value={formData.orderType}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        >
                                            {ORDER_TYPES.map(item => (
                                                <option key={item.id} value={item.id}>{item.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Đơn giá (VNĐ)</label>
                                        <input
                                            type="text"
                                            value={formatNumber(formData.unitPrice)}
                                            onChange={handleUnitPriceChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-emerald-700">Thành tiền (VNĐ)</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={formatNumber(calculatedTotalAmount)}
                                            className="w-full h-12 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-[15px] font-semibold text-emerald-700 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Số lượng <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.quantity)}
                                        onChange={handleQuantityChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    />
                                </div>

                                {formData.productType.startsWith('MAY') && (
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Khoa sử dụng máy / Mã máy</label>
                                        <input
                                            name="department"
                                            value={formData.department}
                                            onChange={handleChange}
                                            placeholder="Ví dụ: Máy PlasmaRosy PR-01"
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Khuyến mãi (Áp dụng mã)</label>
                                    <div className="relative">
                                        <select
                                            name="promotion"
                                            value={formData.promotion}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                        >
                                            <option value="">-- Không có mã khuyến mãi --</option>
                                            {promotionsList.map(p => (
                                                <option key={p.id} value={p.code}>
                                                    {p.code} - Tặng {p.free_cylinders} bình
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                    {freeCylinders > 0 && (
                                        <div className="mt-1 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl flex justify-between items-center text-[11px] font-bold text-orange-600">
                                            <span>Khấu trừ: -{freeCylinders} bình</span>
                                            <span>Tính tiền: {billedQuantity} bình</span>
                                        </div>
                                    )}
                                </div>

                                {formData.productType.startsWith('BINH') && formData.quantity > 0 && (
                                    <div className="pt-3 mt-2 border-t border-emerald-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[13px] !font-bold !text-emerald-700 flex items-center gap-2">
                                                <ScanLine className="w-4 h-4 text-emerald-600" strokeWidth={2.5} /> Gán mã bình ({assignedCylinders.filter(c => typeof c === 'string' ? (c !== '') : (c?.serial !== '')).length}/{formData.quantity})
                                            </h5>
                                            <button
                                                type="button"
                                                onClick={startScanAll}
                                                className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                                            >
                                                <ScanLine className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /> Quét tất cả
                                            </button>
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
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && e.target.value) {
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
                                                                className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition-all"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => startScanner(idx)}
                                                                className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-all"
                                                            >
                                                                <ScanLine className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                                                            </button>
                                                            {serial && (
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
                                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 rounded-md shadow-sm">
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

                                <div className="pt-3 mt-2 border-t border-emerald-100 space-y-4 [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                                    <h5 className="text-[13px] !font-bold !text-emerald-700">Phí giao hàng & đơn vị VC</h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-slate-800">Đơn vị vận chuyển</label>
                                            <div className="relative">
                                                <select
                                                    name="shipperId"
                                                    value={formData.shipperId}
                                                    onChange={handleChange}
                                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                                >
                                                    <option value="">Chọn đơn vị vận chuyển</option>
                                                    {shippersList.map(shipper => (
                                                        <option key={shipper.id} value={shipper.id}>{shipper.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-emerald-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-slate-800">Phí giao hàng (VNĐ)</label>
                                            <input
                                                type="text"
                                                value={formatNumber(formData.shippingFee)}
                                                onChange={handleShippingFeeChange}
                                                placeholder="Nhập phí giao hàng"
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
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
                                        rows={3}
                                        placeholder="Thông tin bổ sung"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 resize-none focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
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
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-slate-700 font-bold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="orderForm"
                        disabled={isLoading}
                        className="w-full md:flex-1 sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[15px] font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 border border-emerald-700/40 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isLoading ? 'Đang lưu đơn...' : isEdit ? 'Xác nhận cập nhật' : 'Xác nhận tạo đơn hàng'}
                    </button>
                </div>

            </div>
        </div>

        {/* Edit Reason Modal */}
        {
            showReasonModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-black text-gray-900">📝 Lý do chỉnh sửa</h3>
                        <p className="text-sm text-gray-500 font-semibold">Vui lòng nhập lý do chỉnh sửa đơn hàng.</p>
                        <textarea
                            rows="3"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="Ví dụ: Khách yêu cầu thay đổi..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-semibold text-sm resize-none"
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
                                    document.getElementById('orderForm').requestSubmit();
                                }}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                            >
                                Xác nhận & Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
        <BarcodeScanner
            isOpen={isScannerOpen}
            onScanSuccess={handleScanSuccess}
            onClose={() => setIsScannerOpen(false)}
            title={scanTargetIndex !== -1 ? `Quét mã bình #${scanTargetIndex + 1}` : 'Quét mã bình'}
            scan_time={new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}
        />
    </>);
}
