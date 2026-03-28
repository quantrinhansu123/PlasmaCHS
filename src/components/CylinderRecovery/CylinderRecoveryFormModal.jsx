import { clsx } from 'clsx';
import {
    Calendar,
    Camera,
    Check,
    ChevronDown,
    Clock,
    Edit3,
    FileText,
    MapPin,
    PackageCheck,
    Plus,
    Save,
    ScanLine,
    Search,
    Trash2,
    Truck,
    X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { ITEM_CONDITIONS } from '../../constants/recoveryConstants';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';
import BarcodeScanner from '../Common/BarcodeScanner';
import { SearchableSelect } from '../ui/SearchableSelect';

export default function CylinderRecoveryFormModal({ recovery, onClose, onSuccess, initialMode = 'edit' }) {
    const isEdit = !!recovery;
    const [mode, setMode] = useState(initialMode);
    const isReadOnly = mode === 'view';
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [customers, setCustomers] = useState([]);
    const [customerOrders, setCustomerOrders] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerType, setScannerType] = useState('item');
    const [photoUrls, setPhotoUrls] = useState([]);
    const [shippers, setShippers] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const photoInputRef = useRef(null);

    const [formData, setFormData] = useState({
        recovery_code: '',
        recovery_date: new Date().toISOString().split('T')[0],
        customer_id: '',
        order_id: '',
        warehouse_id: '',
        driver_name: '',
        notes: '',
        total_items: 0,
        requested_quantity: 0,
        created_by: localStorage.getItem('user_name') || 'Admin hệ thống',
        status: 'CHO_PHAN_CONG'
    });

    const [items, setItems] = useState([]);
    const itemsRef = useRef(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    const customersRef = useRef(customers);
    useEffect(() => { customersRef.current = customers; }, [customers]);

    const formDataRef = useRef(formData);
    useEffect(() => { formDataRef.current = formData; }, [formData]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        loadCustomers();
        fetchWarehouses();
        fetchShippers();
        if (recovery) {
            setFormData({
                ...recovery,
                order_id: recovery.order_id || '',
                driver_name: recovery.driver_name || '',
                notes: recovery.notes || '',
                requested_quantity: recovery.requested_quantity || 0,
                created_by: recovery.created_by || ''
            });
            setPhotoUrls(recovery.photos || []);
            fetchItems(recovery.id);
        } else {
            generateCode();
        }
    }, [recovery]);

    const loadCustomers = async () => {
        const { data } = await supabase.from('customers').select('id, name').order('name');
        if (data) setCustomers(data);
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
                if (!isEdit && data.length > 0) {
                    setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: data[0].id } : prev);
                }
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const loadCustomerOrders = async (customerId) => {
        if (!customerId) { setCustomerOrders([]); return; }
        const { data } = await supabase
            .from('orders')
            .select('id, order_code, customer_name, quantity, product_type, assigned_cylinders, status')
            .eq('customer_name', customers.find(c => c.id === customerId)?.name || '')
            .in('status', ['HOAN_THANH', 'DANG_GIAO_HANG', 'CHO_DOI_SOAT', 'DA_DUYET'])
            .order('created_at', { ascending: false });
        setCustomerOrders(data || []);
    };

    useEffect(() => {
        if (formData.customer_id && customers.length > 0) {
            loadCustomerOrders(formData.customer_id);
        } else {
            setCustomerOrders([]);
        }
    }, [formData.customer_id, customers]);

    const fetchShippers = async () => {
        const { data: internalShippers } = await supabase
            .from('app_users')
            .select('name')
            .eq('role', 'Shipper')
            .eq('status', 'Hoạt động');

        const { data: externalShippers } = await supabase
            .from('shippers')
            .select('name')
            .eq('status', 'Đang hoạt động');

        const combined = [
            ...(internalShippers?.map(u => `[Nội bộ] ${u.name}`) || []),
            ...(externalShippers?.map(s => `[Đối tác] ${s.name}`) || [])
        ];
        setShippers(combined);
    };

    const fetchItems = async (recoveryId) => {
        const { data } = await supabase.from('cylinder_recovery_items').select('*').eq('recovery_id', recoveryId);
        if (data) setItems(data.map(i => ({ ...i, _id: i.id || Date.now() + Math.random() })));
    };

    const generateCode = async () => {
        const date = new Date();
        const yy = date.getFullYear().toString().slice(2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `TH${yy}${mm}`;
        try {
            const { data } = await supabase
                .from('cylinder_recoveries')
                .select('recovery_code')
                .like('recovery_code', `${prefix}%`)
                .order('recovery_code', { ascending: false })
                .limit(1);
            if (data?.length > 0) {
                const num = parseInt(data[0].recovery_code.slice(-3)) + 1;
                setFormData(prev => ({ ...prev, recovery_code: `${prefix}${num.toString().padStart(3, '0')}` }));
            } else {
                setFormData(prev => ({ ...prev, recovery_code: `${prefix}001` }));
            }
        } catch {
            setFormData(prev => ({ ...prev, recovery_code: `${prefix}001` }));
        }
    };

    const handleScanSuccess = useCallback(async (decodedText, time) => {
        if (scannerType === 'order') {
            await handleOrderScanSuccess(decodedText);
            return;
        }

        const currentItems = itemsRef.current;
        if (currentItems.some(i => i.serial_number === decodedText)) {
            toast.info(`Mã ${decodedText} đã được quét!`);
            return;
        }

        const safeTime = time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        // Add item first with loading state
        const newItemId = crypto.randomUUID();
        setItems(prev => [...prev, {
            _id: newItemId,
            serial_number: decodedText,
            condition: 'tot',
            note: '',
            scan_time: safeTime,
            isValidating: true,
            isValid: null,
            error: null
        }]);

        const validateCylinder = async () => {
            const currentFormData = formDataRef.current;
            const currentCustomers = customersRef.current;

            try {
                const { data: cylData } = await supabase
                    .from('cylinders')
                    .select('customer_name')
                    .eq('serial_number', decodedText)
                    .maybeSingle();

                if (!cylData) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Không tồn tại' } : i));
                    toast.error(`Mã bình ${decodedText} không tồn tại!`);
                    return;
                }

                if (!cylData.customer_name) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Đang ở kho' } : i));
                    toast.warning(`Bình ${decodedText} đang ở kho (chưa giao cho khách).`);
                    return;
                }

                const matchedCustomer = currentCustomers.find(c => c.name === cylData.customer_name);
                if (!matchedCustomer) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: `Của KH: ${cylData.customer_name}` } : i));
                    return;
                }

                // Scenario A: No customer selected
                if (!currentFormData.customer_id) {
                    setFormData(prev => ({ ...prev, customer_id: matchedCustomer.id }));
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: true, error: null } : i));
                    toast.success(`Đã tự động chọn KH: ${matchedCustomer.name}`);
                }
                // Scenario B: Customer already selected
                else if (currentFormData.customer_id === matchedCustomer.id) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: true, error: null } : i));
                }
                // Scenario C: Mismatch
                else {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: `Của: ${matchedCustomer.name}` } : i));
                    toast.error(`Bình ${decodedText} thuộc về KH "${matchedCustomer.name}", không khớp với KH đang chọn!`);
                }

                // Auto-link order if valid
                if (matchedCustomer && (!currentFormData.order_id || currentFormData.customer_id !== matchedCustomer.id)) {
                    const { data: orderData } = await supabase
                        .from('orders')
                        .select('id, order_code')
                        .eq('customer_name', cylData.customer_name)
                        .contains('assigned_cylinders', [decodedText])
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (orderData) {
                        setFormData(prev => ({ ...prev, order_id: orderData.id }));
                        toast.success(`Đã tự động quét mã QR đơn hàng: ĐH ${orderData.order_code}`);
                    }
                }
            } catch (err) {
                console.error('Validation failed:', err);
                setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Lỗi kiểm tra' } : i));
            }
        };

        validateCylinder();
    }, [scannerType]);

    const handleOrderScanSuccess = async (orderCode) => {
        setIsScannerOpen(false);

        try {
            const { data: orderData, error } = await supabase
                .from('orders')
                .select('id, order_code, customer_name')
                .eq('order_code', orderCode)
                .maybeSingle();

            if (error) throw error;
            if (!orderData) {
                toast.error(`Không tìm thấy đơn hàng "${orderCode}"`);
                return;
            }

            // Find customer by name
            const currentCustomers = customersRef.current;
            const matchedCustomer = currentCustomers.find(c => c.name === orderData.customer_name);

            if (matchedCustomer) {
                setFormData(prev => ({
                    ...prev,
                    customer_id: matchedCustomer.id,
                    order_id: orderData.id
                }));
                toast.success(`Đã quét được đơn hàng ${orderCode} của KH ${orderData.customer_name}`);
            } else {
                setFormData(prev => ({ ...prev, order_id: orderData.id }));
                toast.success(`Đã quét được đơn hàng ${orderCode}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Lỗi khi quét đơn hàng: ' + err.message);
        }
    };

    const handlePhotoCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingPhoto(true);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `recovery_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('recovery-photos').upload(fileName, file);
            if (error) throw error;
            const { data: urlData } = supabase.storage.from('recovery-photos').getPublicUrl(fileName);
            setPhotoUrls(prev => [...prev, urlData.publicUrl]);
        } catch (err) {
            console.error(err);
            toast.error('Upload ảnh thất bại: ' + err.message);
        } finally {
            setUploadingPhoto(false);
            e.target.value = '';
        }
    };

    const removePhoto = (idx) => setPhotoUrls(prev => prev.filter((_, i) => i !== idx));

    const addItemManual = () => {
        setItems(prev => [...prev, {
            _id: crypto.randomUUID(),
            serial_number: '',
            condition: 'tot',
            note: '',
            isValidating: false,
            isValid: null,
            error: null
        }]);
    };

    const updateItem = (id, field, value) => {
        setItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));

        // If serial number changed, trigger re-validation
        if (field === 'serial_number' && value.length >= 3) {
            triggerItemValidation(id, value);
        }
    };

    const triggerItemValidation = async (id, serial) => {
        setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: true, error: null } : i));

        try {
            const currentFormData = formDataRef.current;
            const currentCustomers = customersRef.current;

            const { data: cylData } = await supabase
                .from('cylinders')
                .select('customer_name')
                .eq('serial_number', serial)
                .maybeSingle();

            if (!cylData) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: 'Không tồn tại' } : i));
                return;
            }

            if (!cylData.customer_name) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: 'Đang ở kho' } : i));
                return;
            }

            const matchedCustomer = currentCustomers.find(c => c.name === cylData.customer_name);
            if (!matchedCustomer) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: `Của: ${cylData.customer_name}` } : i));
                return;
            }

            if (!currentFormData.customer_id) {
                setFormData(prev => ({ ...prev, customer_id: matchedCustomer.id }));
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: true, error: null } : i));
            } else if (currentFormData.customer_id === matchedCustomer.id) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: true, error: null } : i));
            } else {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: `Của: ${matchedCustomer.name}` } : i));
            }
        } catch (err) {
            setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: 'Lỗi' } : i));
        }
    };
    const removeItem = (id) => setItems(prev => prev.filter(i => i._id !== id));

    useEffect(() => {
        setFormData(prev => ({ ...prev, total_items: items.length }));
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.customer_id) { setErrorMsg('Vui lòng chọn khách hàng!'); return; }
        if (items.length === 0) { setErrorMsg('Vui lòng quét hoặc nhập ít nhất 1 vỏ bình!'); return; }
        if (items.some(i => !i.serial_number)) { setErrorMsg('Có dòng chưa điền mã serial!'); return; }

        // Final ownership check
        const invalidItems = items.filter(i => !i.isValid);
        if (invalidItems.length > 0) {
            setErrorMsg(`Có ${invalidItems.length} bình không hợp lệ (sai khách hàng hoặc không tồn tại). Vui lòng kiểm tra lại danh sách!`);
            return;
        }

        setIsLoading(true);
        try {
            const payload = { ...formData, photos: photoUrls };
            if (!payload.order_id) delete payload.order_id;

            // Format data for saving
            const dbPayload = {
                recovery_code: payload.recovery_code,
                recovery_date: payload.recovery_date,
                customer_id: payload.customer_id,
                order_id: payload.order_id || null,
                warehouse_id: payload.warehouse_id,
                driver_name: payload.driver_name,
                notes: payload.notes,
                total_items: payload.total_items,
                status: payload.status,
                photos: payload.photos,
                requested_quantity: payload.requested_quantity || 0,
                created_by: payload.created_by || 'Admin hệ thống'
            };

            let recoveryId;
            if (isEdit) {
                const { error } = await supabase.from('cylinder_recoveries').update(dbPayload).eq('id', recovery.id);
                if (error) throw error;
                recoveryId = recovery.id;
                await supabase.from('cylinder_recovery_items').delete().eq('recovery_id', recoveryId);
            } else {
                const { data, error } = await supabase.from('cylinder_recoveries').insert([dbPayload]).select().single();
                if (error) throw error;
                recoveryId = data.id;
            }

            const itemPayloads = items.map(i => ({
                recovery_id: recoveryId,
                serial_number: i.serial_number,
                condition: i.condition,
                note: i.note || ''
            }));
            const { error: itemsError } = await supabase.from('cylinder_recovery_items').insert(itemPayloads);
            if (itemsError) throw itemsError;

            // Post-save automation
            if (!isEdit) {
                const serialNumbers = items.map(i => i.serial_number);
                for (const serial of serialNumbers) {
                    await supabase
                        .from('cylinders')
                        .update({ status: 'sẵn sàng', customer_name: null, updated_at: new Date().toISOString() })
                        .eq('serial_number', serial);
                }

                const { data: customerData } = await supabase
                    .from('customers')
                    .select('borrowed_cylinders')
                    .eq('id', formData.customer_id)
                    .single();
                if (customerData) {
                    const newBorrowed = Math.max(0, (customerData.borrowed_cylinders || 0) - items.length);
                    await supabase
                        .from('customers')
                        .update({ borrowed_cylinders: newBorrowed, updated_at: new Date().toISOString() })
                        .eq('id', formData.customer_id);
                }

                const { data: invRecord } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', formData.warehouse_id)
                    .eq('item_type', 'BINH')
                    .eq('item_name', 'Vỏ bình thu hồi')
                    .maybeSingle();

                let inventoryId = invRecord?.id;
                if (!inventoryId) {
                    const { data: newInv } = await supabase
                        .from('inventory')
                        .insert([{ warehouse_id: formData.warehouse_id, item_type: 'BINH', item_name: 'Vỏ bình thu hồi', quantity: 0 }])
                        .select().single();
                    inventoryId = newInv?.id;
                }

                if (inventoryId) {
                    await supabase.from('inventory_transactions').insert([{
                        inventory_id: inventoryId,
                        transaction_type: 'IN',
                        reference_id: recoveryId,
                        reference_code: formData.recovery_code,
                        quantity_changed: items.length,
                        note: `Thu hồi ${items.length} vỏ bình từ KH`
                    }]);
                    await supabase
                        .from('inventory')
                        .update({ quantity: (invRecord?.quantity || 0) + items.length })
                        .eq('id', inventoryId);
                }
            }

            // Log notification for shipping assignment
            if (formData.shipper_id) {
                const { data: shipperData } = await supabase
                    .from('shipping_partners')
                    .select('name')
                    .eq('id', formData.shipper_id)
                    .single();
                
                await notificationService.add({
                    title: 'Phân công thu hồi vỏ',
                    description: `Phiếu #${formData.recovery_code} đã được gán cho đơn vị vận chuyển: ${shipperData?.name || 'Đối tác'}`,
                    type: 'info',
                    link: '/thu-hoi/vo-binh'
                });
            }

            toast.success('🎉 Lưu phiếu thu hồi thành công!');
            onSuccess();
        } catch (error) {
            console.error(error);
            if (error.code === '23505') setErrorMsg(`Mã phiếu "${formData.recovery_code}" đã tồn tại.`);
            else setErrorMsg('Lỗi: ' + error.message);
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
                                <PackageCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                    {isReadOnly ? 'Chi tiết phiếu thu hồi' : isEdit ? 'Cập nhật phiếu thu hồi' : 'Tạo phiếu thu hồi vỏ'}
                                </h3>
                                <p className="text-slate-500 text-[12px] font-semibold mt-0.5 tracking-tight flex items-center gap-1.5">
                                    Mã phiếu: #{formData.recovery_code}
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

                    {/* Form Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-24 sm:pb-8">
                        {errorMsg && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-[13px] font-bold text-red-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                <X className="w-4 h-4 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        <form id="recoveryForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Section 1: Info */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Edit3 className="w-4 h-4 text-primary/80" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin cơ bản</h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <Calendar className="w-4 h-4 text-primary/70" />
                                            Ngày thu hồi <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.recovery_date}
                                            onChange={(e) => setFormData({ ...formData, recovery_date: e.target.value })}
                                            disabled={isReadOnly}
                                            required
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <MapPin className="w-4 h-4 text-primary/70" />
                                            Kho nhận về <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.warehouse_id}
                                                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                                disabled={isReadOnly}
                                                required
                                                className={clsx(
                                                    "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                    isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            >
                                                {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                            {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <PackageCheck className="w-4 h-4 text-primary/70" />
                                            Tổng số vỏ thu yêu cầu
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.requested_quantity}
                                            onChange={(e) => setFormData({ ...formData, requested_quantity: parseInt(e.target.value) || 0 })}
                                            disabled={isReadOnly}
                                            placeholder="SL yêu cầu..."
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <Edit3 className="w-4 h-4 text-primary/70" />
                                            NV tạo phiếu
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.created_by}
                                            disabled
                                            className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-2xl text-[15px] font-bold text-slate-500 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Search className="w-4 h-4 text-primary/70" />
                                        Khách hàng <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <SearchableSelect
                                            options={customers.map(c => ({ label: c.name, value: c.id }))}
                                            value={formData.customer_id}
                                            onValueChange={(val) => setFormData({ ...formData, customer_id: val, order_id: '' })}
                                            placeholder="-- Chọn khách hàng --"
                                            searchPlaceholder="Tìm tên khách hàng..."
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <ScanLine className="w-4 h-4 text-primary/70" /> Quét mã QR
                                    </label>
                                    <div className="flex gap-2 items-center">
                                        <div className="relative flex-1">
                                            <select
                                                value={formData.order_id}
                                                onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
                                                disabled={isReadOnly || !formData.customer_id}
                                                className={clsx(
                                                    "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold appearance-none transition-all",
                                                    (isReadOnly || !formData.customer_id) ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            >
                                                <option value=""></option>
                                                {customerOrders.map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        ĐH {o.order_code} — {o.quantity} {o.product_type?.startsWith('BINH') ? 'bình' : 'máy'} ({o.status})
                                                    </option>
                                                ))}
                                            </select>
                                            {!isReadOnly && formData.customer_id && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setScannerType('order');
                                                    setIsScannerOpen(true);
                                                }}
                                                className="w-12 h-12 flex items-center justify-center bg-primary/10 text-primary border border-primary/20 rounded-2xl hover:bg-primary/20 transition-all shadow-sm"
                                                title="Quét mã đơn hàng"
                                            >
                                                <ScanLine size={20} />
                                            </button>
                                        )}
                                    </div>
                                    {formData.order_id && (() => {
                                        const selectedOrder = customerOrders.find(o => o.id === formData.order_id);
                                        if (selectedOrder?.assigned_cylinders?.length > 0) {
                                            return <p className="text-[11px] text-primary font-bold ml-1 mt-1 flex items-center gap-1">
                                                <PackageCheck className="w-3 h-3 text-primary/70" /> Bình đã giao: {selectedOrder.assigned_cylinders.join(', ')}
                                            </p>;
                                        }
                                        return null;
                                    })()}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <Truck className="w-4 h-4 text-primary/70" />
                                            Nhân viên vận chuyển
                                        </label>
                                        <div className="relative group">
                                            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50 group-focus-within:text-primary transition-colors z-10" />
                                            <input
                                                list="shipper-list"
                                                value={formData.driver_name}
                                                onChange={(e) => {
                                                    const name = e.target.value;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        driver_name: name,
                                                        status: (prev.status === 'CHO_PHAN_CONG' && name) ? 'DANG_THU_HOI' : prev.status
                                                    }));
                                                }}
                                                placeholder="Chọn Shipper"
                                                disabled={isReadOnly}
                                                className={clsx(
                                                    "w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            />
                                            <datalist id="shipper-list">
                                                {shippers.map((name, idx) => (
                                                    <option key={idx} value={name} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <FileText className="w-4 h-4 text-primary/70" />
                                            Ghi chú
                                        </label>
                                        <input
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Ghi chú thêm"
                                            disabled={isReadOnly}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Items List */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <ScanLine className="w-4 h-4 text-primary/80" strokeWidth={2.5} />
                                        <h4 className="text-[18px] !font-extrabold !text-primary uppercase tracking-tight">Danh sách vỏ ({items.length})</h4>
                                        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100">
                                            THỰC TẾ: {items.length}
                                        </div>
                                    </div>
                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannerType('item');
                                                setIsScannerOpen(true);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20"
                                        >
                                            <ScanLine size={14} strokeWidth={2.5} /> Quét
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {items.length === 0 ? (
                                        <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center gap-2">
                                            <div className="w-12 h-12 bg-slate-50 flex items-center justify-center rounded-full text-slate-200">
                                                <ScanLine size={24} />
                                            </div>
                                            <p className="text-slate-300 text-[13px] font-bold">Quét barcode hoặc thêm thủ công</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                            {items.map((item, idx) => (
                                                <div key={item._id} className="group relative bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all hover:bg-white hover:shadow-md hover:shadow-primary/5">
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-[11px] font-black text-slate-300 mt-2.5 w-4 shrink-0">{idx + 1}</span>
                                                        <div className="flex-1 space-y-2.5">
                                                            <div className="flex gap-2">
                                                                <div className="flex-1 relative">
                                                                    <input
                                                                        value={item.serial_number}
                                                                        onChange={(e) => updateItem(item._id, 'serial_number', e.target.value)}
                                                                        placeholder="Mã serial"
                                                                        disabled={isReadOnly}
                                                                        className={clsx(
                                                                            "w-full px-3 py-2 bg-white border rounded-xl font-black text-[14px] outline-none transition-all",
                                                                            item.isValid === true ? "border-green-200 focus:ring-green-500 text-green-700 bg-green-50/30" :
                                                                                item.isValid === false ? "border-red-200 focus:ring-red-500 text-red-700 bg-red-50/30" :
                                                                                    "border-slate-200 focus:ring-primary text-slate-800"
                                                                        )}
                                                                    />
                                                                    {item.isValidating && (
                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                            <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <select
                                                                    value={item.condition}
                                                                    onChange={(e) => updateItem(item._id, 'condition', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-32 px-2 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[12px] text-slate-800 focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                                                                >
                                                                    {ITEM_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <input
                                                                    value={item.note || ''}
                                                                    onChange={(e) => updateItem(item._id, 'note', e.target.value)}
                                                                    placeholder="Ghi chú SP..."
                                                                    disabled={isReadOnly}
                                                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-medium text-[12px] text-slate-600 focus:ring-2 focus:ring-primary outline-none"
                                                                />
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {item.error && (
                                                                        <div className="px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                                                            <X size={10} strokeWidth={3} /> {item.error}
                                                                        </div>
                                                                    )}
                                                                    {item.isValid === true && (
                                                                        <div className="px-2 py-0.5 bg-green-100 text-green-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                                                            <Check size={10} strokeWidth={3} /> Hợp lệ
                                                                        </div>
                                                                    )}
                                                                    {item.scan_time && (
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-lg">
                                                                            <Clock size={10} strokeWidth={2.5} />
                                                                            <span className="text-[10px] font-black uppercase">{item.scan_time}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item._id)}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0 mt-1"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={addItemManual}
                                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-100 text-slate-400 font-bold rounded-2xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-500 transition-all text-sm mt-2"
                                        >
                                            <Plus className="w-4 h-4" /> Thêm thủ công
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Section 3: Photos */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-2 border-b border-primary/10 mb-2">
                                    <Camera className="w-4 h-4 text-primary/80" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary uppercase tracking-tight">Ảnh hiện trường ({photoUrls.length})</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {photoUrls.map((url, idx) => (
                                        <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-100 group shadow-sm">
                                            <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                                            {!isReadOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoto(idx)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {!isReadOnly && !uploadingPhoto && (
                                        <label className="w-20 h-20 border-2 border-dashed border-blue-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all group">
                                            <Camera className="w-6 h-6 text-blue-300 group-hover:text-blue-500 transition-colors" />
                                            <span className="text-[9px] font-black text-blue-300 group-hover:text-blue-500 mt-1 uppercase tracking-tighter">Chụp ảnh</span>
                                            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                                        </label>
                                    )}
                                    {uploadingPhoto && (
                                        <div className="w-20 h-20 border-2 border-slate-100 rounded-2xl flex items-center justify-center bg-slate-50">
                                            <div className="w-5 h-5 border-2 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Mobile Optimized Footer */}
                    <div className="px-5 py-4 pb-10 sm:px-10 sm:py-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col md:flex-row items-center justify-between gap-5 shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between w-full md:w-auto md:justify-start gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0 transition-transform active:scale-90">
                                    <PackageCheck className="w-5 h-5 text-primary/80" strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em] leading-none mb-1">
                                        Tổng vỏ thu
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[22px] font-black text-slate-900 leading-none">{items.length}</span>
                                        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-tight">Vỏ</div>
                                    </div>
                                </div>
                            </div>

                            {!isReadOnly && (
                                <button
                                    form="recoveryForm"
                                    type="submit"
                                    disabled={isLoading}
                                    className={clsx(
                                        "flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] border whitespace-nowrap",
                                        isLoading
                                            ? "bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none"
                                            : "bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200"
                                    )}
                                >
                                    {isLoading ? (
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    <span className="hidden xs:inline">{isEdit ? 'Lưu phiếu' : 'Xác nhận tạo phiếu'}</span>
                                    <span className="xs:hidden">{isEdit ? 'Lưu' : 'Xác nhận'}</span>
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full md:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-primary font-bold text-[14px] transition-all outline-none active:bg-slate-50"
                        >
                            Hủy
                        </button>
                    </div>
                </div>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title={scannerType === 'order' ? 'Quét mã QR đơn hàng' : `Quét mã vạch (${items.length} đã thêm)`}
                currentCount={items.length}
                allowDuplicateScans={true}
            />
        </>,
        document.body
    );
}
