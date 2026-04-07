import { clsx } from 'clsx';
import {
    Calendar,
    Camera,
    ChevronDown,
    Edit3,
    FileText,
    MapPin,
    Monitor,
    Save,
    ScanLine,
    Search,
    Trash2,
    Truck,
    User,
    X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { MACHINE_ITEM_CONDITIONS } from '../../constants/machineRecoveryConstants';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';
import BarcodeScanner from '../Common/BarcodeScanner';
import { SearchableSelect } from '../ui/SearchableSelect';

export default function MachineRecoveryFormModal({ recovery, onClose, onSuccess, initialMode = 'edit' }) {
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

    const [orderCodeInput, setOrderCodeInput] = useState('');

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

    const debounceTimersRef = useRef({});

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
                created_by: recovery.created_by || 'Admin hệ thống'
            });
            setPhotoUrls(recovery.photos || []);
            fetchItems(recovery.id);
            
            if (recovery.order_id) {
                supabase.from('orders').select('order_code').eq('id', recovery.order_id).maybeSingle()
                    .then(({data}) => { if (data) setOrderCodeInput(data.order_code); });
            }
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
            .select('id, order_code, customer_name, quantity, product_type, status')
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
        const { data } = await supabase.from('machine_recovery_items').select('*').eq('recovery_id', recoveryId);
        if (data) setItems(data.map(i => ({ ...i, _id: i.id || Date.now() + Math.random() })));
    };

    const generateCode = async () => {
        const date = new Date();
        const yy = date.getFullYear().toString().slice(2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `THM${yy}${mm}`;
        try {
            const { data } = await supabase
                .from('machine_recoveries')
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

        const validateMachine = async () => {
            const currentFormData = formDataRef.current;
            const currentCustomers = customersRef.current;

            try {
                const { data: machData } = await supabase
                    .from('machines')
                    .select('customer_name')
                    .eq('serial_number', decodedText)
                    .maybeSingle();

                if (!machData) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Không tồn tại' } : i));
                    toast.error(`Mã máy ${decodedText} không tồn tại!`);
                    return;
                }

                if (!machData.customer_name) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Đang ở kho' } : i));
                    toast.warning(`Máy ${decodedText} đang ở kho (chưa giao cho khách).`);
                    return;
                }

                const matchedCustomer = currentCustomers.find(c => c.name === machData.customer_name);
                if (!matchedCustomer) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: `Của KH: ${machData.customer_name}` } : i));
                    return;
                }

                if (!currentFormData.customer_id) {
                    setFormData(prev => ({ ...prev, customer_id: matchedCustomer.id }));
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: true, error: null } : i));
                    toast.success(`Đã tự động chọn KH: ${matchedCustomer.name}`);
                }
                else if (currentFormData.customer_id === matchedCustomer.id) {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: true, error: null } : i));
                }
                else {
                    setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: `Của: ${matchedCustomer.name}` } : i));
                    toast.error(`Máy ${decodedText} thuộc về KH "${matchedCustomer.name}", không khớp với KH đang chọn!`);
                }
            } catch (err) {
                console.error('Validation failed:', err);
                setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Lỗi kiểm tra' } : i));
            }
        };

        validateMachine();
    }, [scannerType]);

    const handleOrderScanSuccess = async (orderCode) => {
        setIsScannerOpen(false);

        try {
            const cleanCode = orderCode.trim().toUpperCase();
            const { data: orderData, error } = await supabase
                .from('orders')
                .select('id, order_code, customer_name')
                .ilike('order_code', cleanCode)
                .maybeSingle();

            if (error) throw error;
            if (!orderData) {
                toast.error(`Không tìm thấy đơn hàng "${cleanCode}"`);
                return;
            }

            const currentCustomers = customersRef.current;
            const matchedCustomer = currentCustomers.find(c => c.name === orderData.customer_name);

            if (matchedCustomer) {
                setFormData(prev => ({
                    ...prev,
                    customer_id: matchedCustomer.id,
                    order_id: orderData.id
                }));
                toast.success(`Đã lấy đơn hàng ${cleanCode} của KH ${orderData.customer_name}`);
            } else {
                setFormData(prev => ({ ...prev, order_id: orderData.id }));
                toast.success(`Đã lấy đơn hàng ${cleanCode}`);
            }
            
            // Cập nhật lại UI Input
            setOrderCodeInput(orderData.order_code);
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
            const fileName = `machine_recovery_${Date.now()}.${ext}`;
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

        if (field === 'serial_number') {
            if (debounceTimersRef.current[id]) clearTimeout(debounceTimersRef.current[id]);
            
            if (value.length >= 3) {
                // Hiển thị trạng thái đang check ngay khi gõ đủ 3 ký tự (tùy chọn)
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: true, isValid: null, error: null } : i));
                
                debounceTimersRef.current[id] = setTimeout(() => {
                    triggerItemValidation(id, value);
                }, 600);
            } else {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: null, error: null } : i));
            }
        }
    };

    const handleItemKeyDown = (e, id, value) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (debounceTimersRef.current[id]) clearTimeout(debounceTimersRef.current[id]);
            if (value.length >= 3) {
                triggerItemValidation(id, value);
            }
        }
    };

    const triggerItemValidation = async (id, serial) => {
        setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: true, error: null } : i));

        try {
            const currentFormData = formDataRef.current;
            const currentCustomers = customersRef.current;

            const { data: machData } = await supabase
                .from('machines')
                .select('customer_name')
                .eq('serial_number', serial)
                .maybeSingle();

            // Chống cuộc đua (Race condition check): 
            // Nếu người dùng đã gõ thêm ký tự mới đổi khác 'serial' ban đầu thì bỏ qua kết quả này
            const latestItem = itemsRef.current.find(i => i._id === id);
            if (latestItem && latestItem.serial_number !== serial) return;

            if (!machData) {
                setItems(prev => prev.map(i => i._id === id && i.serial_number === serial ? { ...i, isValidating: false, isValid: false, error: 'Không tồn tại' } : i));
                return;
            }

            if (!machData.customer_name) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: 'Đang ở kho' } : i));
                return;
            }

            const matchedCustomer = currentCustomers.find(c => c.name === machData.customer_name);
            if (!matchedCustomer) {
                setItems(prev => prev.map(i => i._id === id ? { ...i, isValidating: false, isValid: false, error: `Của: ${machData.customer_name}` } : i));
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
        if (items.length === 0) { setErrorMsg('Vui lòng quét hoặc nhập ít nhất 1 máy!'); return; }
        if (items.some(i => !i.serial_number)) { setErrorMsg('Có dòng chưa điền mã serial!'); return; }

        const invalidItems = items.filter(i => !i.isValid);
        if (invalidItems.length > 0) {
            setErrorMsg(`Có ${invalidItems.length} máy không hợp lệ. Vui lòng kiểm tra lại danh sách!`);
            return;
        }

        setIsLoading(true);
        try {
            const dbPayload = {
                recovery_code: formData.recovery_code,
                recovery_date: formData.recovery_date,
                customer_id: formData.customer_id,
                order_id: formData.order_id || null,
                warehouse_id: formData.warehouse_id,
                driver_name: formData.driver_name,
                notes: formData.notes,
                total_items: formData.total_items,
                status: formData.status,
                photos: photoUrls,
                created_by: recovery?.created_by || formData.created_by || 'Admin hệ thống'
            };

            let recoveryId;
            if (isEdit) {
                const { error } = await supabase.from('machine_recoveries').update(dbPayload).eq('id', recovery.id);
                if (error) throw error;
                recoveryId = recovery.id;
                await supabase.from('machine_recovery_items').delete().eq('recovery_id', recoveryId);
            } else {
                const { data, error } = await supabase.from('machine_recoveries').insert([dbPayload]).select().single();
                if (error) throw error;
                recoveryId = data.id;
            }

            const itemPayloads = items.map(i => ({
                recovery_id: recoveryId,
                serial_number: i.serial_number,
                condition: i.condition,
                note: i.note || ''
            }));
            const { error: itemsError } = await supabase.from('machine_recovery_items').insert(itemPayloads);
            if (itemsError) throw itemsError;

            // Automation for inventory and machine status
            if (!isEdit && dbPayload.status === 'HOAN_THANH') {
                // Update each machine
                for (const item of items) {
                    await supabase
                        .from('machines')
                        .update({ status: 'sẵn sàng', customer_name: null, updated_at: new Date().toISOString() })
                        .eq('serial_number', item.serial_number);
                }

                // Update customer machine count
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('current_machines')
                    .eq('id', formData.customer_id)
                    .single();
                if (customerData) {
                    const newCount = Math.max(0, (customerData.current_machines || 0) - items.length);
                    await supabase
                        .from('customers')
                        .update({ current_machines: newCount, updated_at: new Date().toISOString() })
                        .eq('id', formData.customer_id);
                }

                // Update Warehouse Inventory (item_type = 'MAY')
                const { data: invRecord } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', formData.warehouse_id)
                    .eq('item_type', 'MAY')
                    .eq('item_name', 'Máy thu hồi')
                    .maybeSingle();

                let inventoryId = invRecord?.id;
                if (!inventoryId) {
                    const { data: newInv } = await supabase
                        .from('inventory')
                        .insert([{ warehouse_id: formData.warehouse_id, item_type: 'MAY', item_name: 'Máy thu hồi', quantity: 0 }])
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
                        note: `Thu hồi ${items.length} máy từ khách hàng`
                    }]);
                    await supabase
                        .from('inventory')
                        .update({ quantity: (invRecord?.quantity || 0) + items.length })
                        .eq('id', inventoryId);
                }

                // Global notification for every new machine recovery
                const customerName = customersRef.current.find(c => c.id === formData.customer_id)?.name || 'Khách hàng';
                notificationService.add({
                    title: `🔧 Thu hồi máy mới: #${formData.recovery_code}`,
                    description: `${customerName} - ${items.length} máy - ${formData.driver_name || 'Tự do'}`,
                    type: 'info',
                    link: '/thu-hoi/may-moc'
                });
            }

            // Log notification for shipping assignment
            if (formData.shipper_id) {
                const { data: shipperData } = await supabase
                    .from('shipping_partners')
                    .select('name')
                    .eq('id', formData.shipper_id)
                    .single();
                
                await notificationService.add({
                    title: 'Phân công thu hồi máy',
                    description: `Phiếu #${formData.recovery_code} đã được gán cho đơn vị vận chuyển: ${shipperData?.name || 'Đối tác'}`,
                    type: 'info',
                    link: '/thu-hoi/may-moc'
                });
            }

            toast.success('🎉 Lưu phiếu thu hồi máy thành công!');
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
                <div className={clsx("absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300", isClosing && "animate-out fade-out duration-300")} onClick={handleClose} />

                <div className={clsx("relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500", isClosing && "animate-out slide-out-to-right duration-300")} onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <Monitor className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-[20px] font-bold text-slate-900 tracking-tight">
                                    {isReadOnly ? 'Chi tiết phiếu thu hồi máy' : isEdit ? 'Cập nhật phiếu thu hồi máy' : 'Tạo phiếu thu hồi máy'}
                                </h3>
                                <p className="text-slate-500 text-[12px] font-semibold mt-0.5 flex items-center gap-1.5">Mã phiếu: #{formData.recovery_code}</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                    </div>

                    {/* Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 pb-24 sm:pb-8 custom-scrollbar bg-slate-50">
                        {errorMsg && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-[13px] font-bold text-red-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2"><X size={16} />{errorMsg}</div>}

                        <form id="machineRecoveryForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* General Info */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Edit3 className="w-4 h-4 text-primary/80" />
                                    <h4 className="text-[18px] font-extrabold text-primary">Thông tin chung</h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><Calendar size={16} /> Ngày thu hồi</label>
                                        <input type="date" value={formData.recovery_date} onChange={e => setFormData({ ...formData, recovery_date: e.target.value })} disabled={isReadOnly} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><MapPin size={16} /> Kho nhận máy</label>
                                        <select value={formData.warehouse_id} onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })} disabled={isReadOnly} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold transition-all outline-none appearance-none">
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><Search size={16} /> Khách hàng</label>
                                    <SearchableSelect options={customers.map(c => ({ label: c.name, value: c.id }))} value={formData.customer_id} onValueChange={v => setFormData({ ...formData, customer_id: v })} placeholder="-- Chọn khách hàng --" disabled={isReadOnly} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><ScanLine size={16} /> Quét / Nhập mã Đơn hàng</label>
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <input 
                                                    list="customer-orders-list"
                                                    value={orderCodeInput} 
                                                    onChange={e => {
                                                        const val = e.target.value.toUpperCase();
                                                        setOrderCodeInput(val);
                                                        const found = customerOrders.find(o => o.order_code.toUpperCase() === val);
                                                        if (found) {
                                                            setFormData(prev => ({...prev, order_id: found.id}));
                                                        }
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (orderCodeInput.trim()) handleOrderScanSuccess(orderCodeInput.trim());
                                                        }
                                                    }}
                                                    disabled={isReadOnly} 
                                                    placeholder="Gõ mã ĐH và ấn Enter..." 
                                                    className="w-full h-11 px-4 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all uppercase"
                                                />
                                                <datalist id="customer-orders-list">
                                                    {customerOrders.map(o => <option key={o.id} value={o.order_code}>ĐH {o.order_code} ({o.status})</option>)}
                                                </datalist>
                                                {/* Hiển thị dấu check xanh nếu đã map được order_id */}
                                                {!isReadOnly && formData.order_id && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" title="Đã khớp đơn hàng"></div>}
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setScannerType('order');
                                                        setIsScannerOpen(true);
                                                    }}
                                                    className="w-11 h-11 shrink-0 flex items-center justify-center bg-primary text-white border border-primary/20 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                                                    title="Quét mã đơn hàng"
                                                >
                                                    <ScanLine className="w-5 h-5 shrink-0" strokeWidth={2} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><User size={16} /> Nhân viên tạo phiếu</label>
                                        <input
                                            type="text"
                                            value={formData.created_by}
                                            readOnly
                                            className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 cursor-not-allowed outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><Truck size={16} /> NV vận chuyển</label>
                                        <SearchableSelect 
                                            options={shippers.map(s => ({ label: s, value: s }))} 
                                            value={formData.driver_name} 
                                            onValueChange={(name) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    driver_name: name,
                                                    status: (prev.status === 'CHO_PHAN_CONG' && name) ? 'DANG_THU_HOI' : (!name && prev.status === 'DANG_THU_HOI') ? 'CHO_PHAN_CONG' : prev.status
                                                }));
                                            }} 
                                            placeholder="-- Chọn NV Vận chuyển --" 
                                            disabled={isReadOnly} 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800"><FileText size={16} /> Ghi chú</label>
                                        <input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} disabled={isReadOnly} placeholder="" className="w-full h-11 px-4 border border-slate-200 rounded-xl font-bold bg-slate-50 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Machine Items */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <ScanLine className="w-5 h-5 text-primary" strokeWidth={2.5} />
                                        <h4 className="text-[18px] font-extrabold text-primary whitespace-nowrap">Danh sách máy ({items.length})</h4>
                                    </div>
                                    {!isReadOnly && (
                                        <button type="button" onClick={() => {
                                            setScannerType('item');
                                            setIsScannerOpen(true);
                                        }} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 bg-primary text-white font-bold rounded-xl text-xs shadow-lg shadow-primary/20 transition-all active:scale-95"><ScanLine size={14} strokeWidth={2.5} /> Quét barcode</button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {items.length === 0 ? (
                                        <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center gap-2">
                                            <p className="text-slate-300 text-xs font-bold uppercase">Chưa có máy nào được thêm</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                            {items.map((item, idx) => (
                                                <div key={item._id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-black text-slate-300">{idx + 1}</span>
                                                        <div className="flex-1 relative">
                                                            <input 
                                                                value={item.serial_number} 
                                                                onChange={e => updateItem(item._id, 'serial_number', e.target.value)} 
                                                                onKeyDown={e => handleItemKeyDown(e, item._id, item.serial_number)}
                                                                disabled={isReadOnly} 
                                                                placeholder="Mã Serial" 
                                                                className={clsx("w-full px-3 py-2 border rounded-xl font-black text-[14px] outline-none", item.isValid === true ? "text-green-700 bg-green-50 border-green-200" : item.isValid === false ? "text-red-700 bg-red-50 border-red-200" : "bg-white border-slate-100")} 
                                                            />
                                                            {item.isValidating && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                                                        </div>
                                                        <select value={item.condition} onChange={e => updateItem(item._id, 'condition', e.target.value)} disabled={isReadOnly} className="w-28 px-2 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[11px] outline-none">
                                                            {MACHINE_ITEM_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                                        </select>
                                                        {!isReadOnly && <button type="button" onClick={() => removeItem(item._id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={16} /></button>}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <input value={item.note || ''} onChange={e => updateItem(item._id, 'note', e.target.value)} placeholder="Chi tiết lỗi/tình trạng" className="flex-1 px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[11px] font-medium text-slate-600 outline-none" />
                                                        {item.error && <span className="text-[10px] font-black text-red-500 uppercase">{item.error}</span>}
                                                        {item.isValid && <span className="text-[10px] font-black text-green-600 uppercase">Hợp lệ</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {!isReadOnly && <button type="button" onClick={addItemManual} className="w-full py-2.5 border-2 border-dashed border-slate-100 text-slate-400 font-bold rounded-xl text-xs hover:bg-white hover:text-primary transition-all">+ Thêm thủ công</button>}
                                </div>
                            </div>

                            {/* Photos */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-3 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-2 border-b border-primary/10">
                                    <Camera size={18} className="text-primary" />
                                    <h4 className="text-[18px] font-extrabold text-primary">Ảnh hiện trường</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {photoUrls.map((url, idx) => (
                                        <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-100 overflow-hidden group">
                                            <img src={url} className="w-full h-full object-cover" />
                                            {!isReadOnly && <button type="button" onClick={() => removePhoto(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X size={10} /></button>}
                                        </div>
                                    ))}
                                    {!isReadOnly && (
                                        <label className="w-16 h-16 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center cursor-pointer hover:bg-primary/5 transition-all">
                                            <Camera size={20} className="text-primary/30" />
                                            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    {!isReadOnly && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3 z-30">
                            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Hủy</button>
                            <button form="machineRecoveryForm" type="submit" disabled={isLoading} className="px-8 py-2.5 rounded-2xl bg-primary text-white font-black shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2">
                                {isLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                                Lưu phiếu
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isScannerOpen && (
                <BarcodeScanner
                    isOpen={isScannerOpen}
                    onClose={() => setIsScannerOpen(false)}
                    onScanSuccess={handleScanSuccess}
                    title={scannerType === 'order' ? 'Quét mã QR đơn hàng' : 'Quét mã máy'}
                />
            )}
        </>
        , document.body);
}
