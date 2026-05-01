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
import { applyRecoveryCompletionInventory } from '../../utils/cylinderRecoveryCompletion';
import BarcodeScanner from '../Common/BarcodeScanner';
import { SearchableSelect } from '../ui/SearchableSelect';

/** prefillComplete: mở form ở trạng thái Hoàn thành; recovery vẫn là bản ghi DB (để xử lý kho đúng). */
export default function CylinderRecoveryFormModal({
    recovery,
    onClose,
    onSuccess,
    initialMode = 'edit',
    prefillComplete = false,
}) {
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

    const [masterBarcode, setMasterBarcode] = useState('');
    const masterInputRef = useRef(null);
    const [scanResultInfo, setScanResultInfo] = useState(null);

    // Cylinder autocomplete for serial input
    const [availableCyls, setAvailableCyls] = useState([]);
    const [isFetchingCyls, setIsFetchingCyls] = useState(false);
    const [activeSerialDropdown, setActiveSerialDropdown] = useState(null); // item._id

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

    const normalizeCustomerText = (value) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();

    const resolveCustomerByName = useCallback((rawName) => {
        const source = customersRef.current || [];
        const normalizedTarget = normalizeCustomerText(rawName);
        if (!normalizedTarget) return null;

        const exact = source.find((c) => normalizeCustomerText(c.name) === normalizedTarget);
        if (exact) return exact;

        const includes = source.find((c) => {
            const candidate = normalizeCustomerText(c.name);
            return candidate.includes(normalizedTarget) || normalizedTarget.includes(candidate);
        });
        return includes || null;
    }, []);

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
            const statusUi =
                prefillComplete && recovery.status !== 'HOAN_THANH'
                    ? 'HOAN_THANH'
                    : recovery.status;
            setFormData({
                ...recovery,
                order_id: recovery.order_id || '',
                driver_name: recovery.driver_name || '',
                notes: recovery.notes || '',
                requested_quantity: recovery.requested_quantity || 0,
                created_by: recovery.created_by || '',
                status: statusUi,
            });
            setPhotoUrls(recovery.photos || []);
            fetchItems(recovery.id);
        } else {
            generateCode();
        }
    }, [recovery, prefillComplete]);

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

    // Fetch cylinders currently at customer sites for autocomplete suggestions
    const fetchAvailableCyls = async () => {
        if (availableCyls.length > 0 || isFetchingCyls) return;
        setIsFetchingCyls(true);
        try {
            const { data } = await supabase
                .from('cylinders')
                .select('serial_number, volume, customer_name, status')
                .eq('status', 'thuộc khách hàng')
                .not('customer_name', 'is', null)
                .order('serial_number', { ascending: true })
                .limit(5000);
            setAvailableCyls(data || []);
        } catch (e) {
            console.error('fetchAvailableCyls error', e);
        } finally {
            setIsFetchingCyls(false);
        }
    };

    // Get matching suggestions for a specific item row
    const getCylSuggestions = (itemId, searchVal) => {
        if (!availableCyls || availableCyls.length === 0) return [];
        const search = (searchVal || '').trim().toUpperCase();
        const takenSerials = new Set(
            items.filter(i => i._id !== itemId && i.serial_number?.trim()).map(i => i.serial_number.trim().toUpperCase())
        );
        // If customer is selected, filter by that customer
        const selectedCustomer = customers.find(c => c.id === formData.customer_id);
        return availableCyls
            .filter(c => {
                const serial = c.serial_number?.toUpperCase();
                if (!serial) return false;
                if (takenSerials.has(serial)) return false;
                if (selectedCustomer && c.customer_name && !c.customer_name.includes(selectedCustomer.name)) return false;
                if (!search) return true;
                return serial.includes(search);
            })
            .slice(0, 30);
    };

    // Synchronize items list with requested_quantity in real-time
    useEffect(() => {
        if (isReadOnly) return;
        
        const targetCount = formData.requested_quantity || 0;
        if (targetCount === items.length) return;

        if (targetCount > items.length) {
            // Add rows
            const rowsToAdd = targetCount - items.length;
            const newRows = Array.from({ length: rowsToAdd }).map(() => ({
                _id: crypto.randomUUID(),
                serial_number: '',
                condition: 'tot',
                note: '',
                isValidating: false,
                isValid: null,
                error: null
            }));
            setItems(prev => [...prev, ...newRows]);
        } else if (targetCount < items.length) {
            // Remove rows from the end, but be careful if they have data
            const itemsWithData = items.slice(targetCount).filter(i => i.serial_number);
            if (itemsWithData.length > 0) {
                // If there's data in the rows being removed, we might want to warn
                // But for high-speed UI, we'll just respect the number
                console.log('Truncating rows that contained data');
            }
            setItems(prev => prev.slice(0, targetCount));
        }
    }, [formData.requested_quantity, isReadOnly]);

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

    const addNewRecoveredItem = useCallback(async (serial, scanTime) => {
        const newItemId = crypto.randomUUID();
        setItems(prev => [...prev, {
            _id: newItemId,
            serial_number: serial,
            condition: 'tot',
            note: '',
            scan_time: scanTime,
            isValidating: true,
            isValid: null,
            error: null
        }]);

        try {
            const currentFormData = formDataRef.current;
            const currentCustomers = customersRef.current;

            const { data: cylData } = await supabase
                .from('cylinders')
                .select('customer_name')
                .eq('serial_number', serial)
                .maybeSingle();

            if (!cylData) {
                setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Không tồn tại' } : i));
                toast.error(`Mã bình ${serial} không tồn tại!`);
                return;
            }

            if (!cylData.customer_name) {
                setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Đang ở kho' } : i));
                toast.warn(`Bình ${serial} đang lưu tại kho, không cần thu hồi.`);
                setScanResultInfo({
                    type: 'BINH',
                    code: serial,
                    customerName: 'Đang ở kho',
                    extra: 'Không ghi nhận đang ở khách hàng',
                });
                return;
            }

            const matchedCustomer = resolveCustomerByName(cylData.customer_name);
            if (!matchedCustomer) {
                setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: `Của: ${cylData.customer_name}` } : i));
                return;
            }

            // Successfully validated
            setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: true, error: null } : i));
            setScanResultInfo({
                type: 'BINH',
                code: serial,
                customerName: cylData.customer_name,
                extra: 'Đã ghi nhận từ mã bình',
            });

            // Auto-detect customer if not set
            if (!currentFormData.customer_id) {
                setFormData(prev => ({ ...prev, customer_id: matchedCustomer.id }));
            }
        } catch (err) {
            console.error('Validation failed:', err);
            setItems(prev => prev.map(i => i._id === newItemId ? { ...i, isValidating: false, isValid: false, error: 'Lỗi' } : i));
        }
    }, [setItems, setFormData]);

    // Must be declared before handleScanSuccess to avoid TDZ (Cannot access before initialization)
    const updateItem = useCallback((id, field, value) => {
        setItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));

        // If serial number changed, trigger re-validation
        if (field === 'serial_number' && value.trim().length >= 3) {
            triggerItemValidation(id, value.trim());
        }
    }, [setItems]);

    const handleOrderScanSuccess = useCallback(async (orderCode) => {
        setIsScannerOpen(false);

        try {
            const { data: orderData, error } = await supabase
                .from('orders')
                .select('id, order_code, customer_name, status')
                .eq('order_code', orderCode)
                .maybeSingle();

            if (error) throw error;
            if (!orderData) {
                toast.error(`Không tìm thấy đơn hàng "${orderCode}"`);
                return;
            }

            // Find customer by name
            const currentCustomers = customersRef.current;
            const matchedCustomer = resolveCustomerByName(orderData.customer_name);

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
            setScanResultInfo({
                type: 'DON_HANG',
                code: orderData.order_code,
                customerName: orderData.customer_name || '—',
                extra: `Trạng thái: ${orderData.status || '—'}`,
            });
        } catch (err) {
            console.error(err);
            toast.error('Lỗi khi quét đơn hàng: ' + err.message);
        }
    }, [setFormData, setIsScannerOpen]);

    const handleScanSuccess = useCallback(async (decodedText, time, specificItemId) => {
        const safeTime = time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const normalizedText = decodedText.trim().toUpperCase();

        // Check if it's a known cylinder serial first (PRIORITY Fix)
        const { data: cylinderData } = await supabase
            .from('cylinders')
            .select('serial_number')
            .eq('serial_number', normalizedText)
            .maybeSingle();

        if (cylinderData) {
            if (specificItemId) {
                updateItem(specificItemId, 'serial_number', normalizedText);
            } else {
                const currentItems = itemsRef.current;
                if (currentItems.some(i => i.serial_number === normalizedText)) {
                    toast.info(`Mã bình ${normalizedText} đã được quét!`);
                } else {
                    addNewRecoveredItem(normalizedText, safeTime);
                }
            }
            setIsScannerOpen(false);
            return;
        }

        // Third priority: machine serial lookup to show ownership info
        const { data: machineData } = await supabase
            .from('machines')
            .select('serial_number, customer_name, status')
            .eq('serial_number', normalizedText)
            .maybeSingle();
        if (machineData) {
            const currentCustomers = customersRef.current;
            const matchedCustomer = resolveCustomerByName(machineData.customer_name);
            if (matchedCustomer && !formDataRef.current.customer_id) {
                setFormData(prev => ({ ...prev, customer_id: matchedCustomer.id }));
            }
            setScanResultInfo({
                type: 'MAY',
                code: machineData.serial_number || normalizedText,
                customerName: machineData.customer_name || 'Đang ở kho',
                extra: `Trạng thái: ${machineData.status || '—'}`,
            });
            toast.success(`Đã nhận diện mã máy ${normalizedText}`);
            setIsScannerOpen(false);
            return;
        }

        // Second priority: Check if it's an order code pattern
        const isOrderCode = /^(DN|HD|PL|TH|DNXM)-/.test(normalizedText);
        if (isOrderCode) {
            await handleOrderScanSuccess(normalizedText);
            setIsScannerOpen(false);
            return;
        }

        // Final fallback: just add as Serial Number if no order code match
        if (specificItemId) {
            updateItem(specificItemId, 'serial_number', normalizedText);
        } else {
            addNewRecoveredItem(normalizedText, safeTime);
        }
        setScanResultInfo({
            type: 'KHAC',
            code: normalizedText,
            customerName: 'Không xác định',
            extra: 'Không tìm thấy dữ liệu máy/bình/đơn',
        });
        setIsScannerOpen(false);
    }, [addNewRecoveredItem, handleOrderScanSuccess, updateItem]);

    const fileToDataUrl = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

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
            const message = String(err?.message || '');
            if (message.includes('Bucket not found')) {
                try {
                    const dataUrl = await fileToDataUrl(file);
                    if (dataUrl) {
                        setPhotoUrls(prev => [...prev, dataUrl]);
                        toast.warn('Bucket ảnh chưa tạo. Đã lưu ảnh tạm dạng base64 để tiếp tục thao tác.');
                    }
                } catch (fallbackErr) {
                    toast.error('Upload ảnh thất bại: ' + String(fallbackErr?.message || fallbackErr));
                }
            } else {
                toast.error('Upload ảnh thất bại: ' + message);
            }
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


    const handleSerialKeyDown = (e, idx) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const nextIdx = idx + 1;
            const nextInput = document.getElementById(`recovery-serial-${nextIdx}`);
            if (nextInput) {
                nextInput.focus();
            } else {
                addItemManual();
                setTimeout(() => {
                    const brandNewInput = document.getElementById(`recovery-serial-${nextIdx}`);
                    if (brandNewInput) brandNewInput.focus();
                }, 50);
            }
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

            const matchedCustomer = resolveCustomerByName(cylData.customer_name);
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

    const persistRecovery = async (statusOverride = null) => {
        setErrorMsg('');
        const effective = statusOverride != null ? { ...formData, status: statusOverride } : formData;
        const isCompleting = effective.status === 'HOAN_THANH';

        if (!effective.customer_id) { setErrorMsg('Vui lòng chọn khách hàng!'); return; }

        if (isCompleting) {
            if (items.length === 0) { setErrorMsg('Khi hoàn thành phiếu, vui lòng quét hoặc nhập ít nhất 1 vỏ bình!'); return; }
            if (items.some(i => !i.serial_number)) { setErrorMsg('Có dòng chưa điền mã serial!'); return; }

            const invalidItems = items.filter((i) => i.isValid === false);
            if (invalidItems.length > 0) {
                setErrorMsg(`Có ${invalidItems.length} bình không hợp lệ (sai khách hàng hoặc không tồn tại). Vui lòng kiểm tra lại danh sách!`);
                return;
            }
        }

        setIsLoading(true);
        try {
            const payload = { ...effective, photos: photoUrls };
            if (!payload.order_id) delete payload.order_id;

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
            } else {
                const { data, error } = await supabase.from('cylinder_recoveries').insert([dbPayload]).select().single();
                if (error) throw error;
                recoveryId = data.id;
            }
            const { error: itemsError } = await supabase.from('cylinder_recovery_items').delete().eq('recovery_id', recoveryId);
            if (itemsError) throw itemsError;

            if (items.length > 0) {
                const itemPayloads = items.map(i => ({
                    recovery_id: recoveryId,
                    serial_number: i.serial_number,
                    condition: i.condition,
                    note: i.note || ''
                }));
                const { error: insertItemsError } = await supabase.from('cylinder_recovery_items').insert(itemPayloads);
                if (insertItemsError) throw insertItemsError;
            }

            const shouldProcessInventory = isCompleting && (!isEdit || recovery?.status !== 'HOAN_THANH');
            if (shouldProcessInventory) {
                await applyRecoveryCompletionInventory(supabase, {
                    recoveryId,
                    recoveryCode: effective.recovery_code,
                    customerId: effective.customer_id,
                    customerName: customersRef.current.find(c => c.id === effective.customer_id)?.name || 'Khách hàng',
                    warehouseId: effective.warehouse_id,
                    items: items.map((i) => ({ serial_number: i.serial_number })),
                });
            }

            const customerName = customersRef.current.find(c => c.id === effective.customer_id)?.name || 'Khách hàng';
            if (!isEdit) {
                notificationService.add({
                    title: `🛢️ Yêu cầu thu hồi vỏ mới: #${effective.recovery_code}`,
                    description: `${customerName} - Yêu cầu: ${effective.requested_quantity} vỏ - Chờ phân công`,
                    type: 'info',
                    link: '/thu-hoi/vo-binh'
                });
            } else if (payload.status === 'DANG_THU_HOI' && recovery.status === 'CHO_PHAN_CONG') {
                notificationService.add({
                    title: `🚚 Phân công thu hồi: #${effective.recovery_code}`,
                    description: `Phiếu của ${customerName} đã được gán cho: ${effective.driver_name}`,
                    type: 'success',
                    link: '/thu-hoi/vo-binh'
                });
            } else if (isCompleting && recovery.status !== 'HOAN_THANH') {
                notificationService.add({
                    title: `✅ Đã thu hồi xong: #${effective.recovery_code}`,
                    description: `${customerName} - Đã thu ${items.length} vỏ về kho.`,
                    type: 'success',
                    link: '/thu-hoi/vo-binh'
                });
            }

            if (statusOverride != null) {
                setFormData((prev) => ({ ...prev, status: statusOverride }));
            }

            toast.success(isCompleting ? '🎉 Đã hoàn thành thu hồi!' : '🎉 Lưu phiếu thu hồi thành công!');
            onSuccess();
        } catch (error) {
            console.error(error);
            if (error.code === '23505') setErrorMsg(`Mã phiếu "${formData.recovery_code}" đã tồn tại.`);
            else setErrorMsg('Lỗi: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await persistRecovery();
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
                                <p className="text-slate-500 text-[12px] font-semibold mt-0.5 tracking-tight flex items-center gap-2">
                                    Mã phiếu: #{formData.recovery_code}
                                    {formData.status && (() => {
                                        const s = ITEM_CONDITIONS.find(sc => sc.id === formData.status) || { label: formData.status, color: 'bg-slate-100 text-slate-600' };
                                        // Wait, RECOVERY_STATUSES is in the parent. Modal might not have it.
                                        // I'll check if RECOVERY_STATUSES is imported or defined.
                                        return <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] uppercase font-bold">{formData.status}</span>
                                    })()}
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
                            {/* Master Scanner / Barcode Input */}
                            {!isReadOnly && (
                                <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-3 shadow-sm animate-in zoom-in-95 duration-300">
                                    <label className="flex items-center gap-2 text-[15px] font-black text-primary uppercase tracking-tight">
                                        <ScanLine className="w-5 h-5" />
                                        Quét hoặc Nhập Barcode (Bình hoặc Đơn)
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                ref={masterInputRef}
                                                autoFocus
                                                value={masterBarcode}
                                                onChange={(e) => setMasterBarcode(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (masterBarcode.trim()) {
                                                            handleScanSuccess(masterBarcode.trim());
                                                            setMasterBarcode('');
                                                        }
                                                    }
                                                }}
                                                placeholder="Quét mã vỏ bình hoặc mã đơn hàng..."
                                                className="w-full h-14 pl-5 pr-12 bg-white border-2 border-primary/20 rounded-2xl text-[18px] font-black text-slate-800 placeholder:text-slate-300 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (masterBarcode.trim()) {
                                                        handleScanSuccess(masterBarcode.trim());
                                                        setMasterBarcode('');
                                                    }
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
                                            >
                                                <Plus size={20} strokeWidth={3} />
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannerType('master');
                                                setIsScannerOpen(true);
                                            }}
                                            className="h-14 w-14 sm:w-auto sm:px-5 flex items-center justify-center gap-2 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                        >
                                            <Camera size={24} />
                                            <span className="hidden sm:inline uppercase">Mở Camera</span>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-bold italic">
                                        * Hệ thống sẽ tự động phân loại: nếu là mã bình (Serial) sẽ thêm vào danh sách, nếu là mã đơn sẽ tự chọn KH/Đơn.
                                    </p>
                                    {scanResultInfo && (
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                                            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                                                Thông tin nhận diện
                                            </p>
                                            <div className="text-[13px] text-slate-700 font-semibold leading-relaxed">
                                                <div>Loại: <span className="font-black text-slate-900">{scanResultInfo.type}</span></div>
                                                <div>Mã: <span className="font-mono font-black text-slate-900">{scanResultInfo.code}</span></div>
                                                <div>Khách hàng: <span className="font-black text-slate-900">{scanResultInfo.customerName || '—'}</span></div>
                                                <div className="text-[12px] text-emerald-700">{scanResultInfo.extra || ''}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
                                            value={formData.requested_quantity === 0 ? '' : formData.requested_quantity}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                                setFormData({ ...formData, requested_quantity: isNaN(val) ? 0 : val });
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            disabled={isReadOnly}
                                            placeholder="0"
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
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <ScanLine className="w-4 h-4 text-primary/80 shrink-0" strokeWidth={2.5} />
                                        <h4 className="text-[16px] sm:text-[18px] !font-extrabold !text-primary uppercase tracking-tight">Danh sách vỏ ({items.length})</h4>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black border border-emerald-100 shrink-0">
                                            THỰC TẾ: {items.length}
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setScannerType('item');
                                                    setIsScannerOpen(true);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20 shrink-0"
                                            >
                                                <ScanLine size={14} strokeWidth={2.5} /> Quét
                                            </button>
                                        )}
                                    </div>
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
                                                                            id={`recovery-serial-${idx}`}
                                                                            value={item.serial_number}
                                                                            onChange={(e) => updateItem(item._id, 'serial_number', e.target.value)}
                                                                            onFocus={() => {
                                                                                fetchAvailableCyls();
                                                                                setActiveSerialDropdown(item._id);
                                                                            }}
                                                                            onBlur={() => {
                                                                                setTimeout(() => {
                                                                                    setActiveSerialDropdown(curr => curr === item._id ? null : curr);
                                                                                }, 200);
                                                                            }}
                                                                            onKeyDown={(e) => handleSerialKeyDown(e, idx)}
                                                                            placeholder="Nhập mã serial..."
                                                                            disabled={isReadOnly}
                                                                            autoComplete="off"
                                                                            className={clsx(
                                                                                "w-full pl-3 pr-10 py-2.5 bg-white border rounded-xl font-black text-[14px] outline-none transition-all",
                                                                                item.isValid === true ? "border-green-200 focus:ring-2 focus:ring-green-500/20 text-green-700 bg-green-50/30" :
                                                                                    item.isValid === false ? "border-red-200 focus:ring-2 focus:ring-red-500/20 text-red-700 bg-red-50/30" :
                                                                                        "border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-slate-800"
                                                                            )}
                                                                        />
                                                                        {/* Autocomplete Dropdown */}
                                                                        {activeSerialDropdown === item._id && !isReadOnly && (
                                                                            <div className="absolute z-[9999] left-0 right-0 top-[42px] bg-white border border-primary/20 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                                                                                {isFetchingCyls ? (
                                                                                    <div className="px-4 py-3 text-xs text-slate-400 italic">Đang tải danh sách bình...</div>
                                                                                ) : (() => {
                                                                                    const suggs = getCylSuggestions(item._id, item.serial_number);
                                                                                    if (suggs.length === 0) return (
                                                                                        <div className="px-4 py-3 text-xs text-slate-400 italic">
                                                                                            {item.serial_number ? 'Không tìm thấy bình phù hợp' : 'Nhập để tìm kiếm...'}
                                                                                        </div>
                                                                                    );
                                                                                    return suggs.map(c => (
                                                                                        <button
                                                                                            key={c.serial_number}
                                                                                            type="button"
                                                                                            onMouseDown={(e) => {
                                                                                                e.preventDefault();
                                                                                                updateItem(item._id, 'serial_number', c.serial_number);
                                                                                                setActiveSerialDropdown(null);
                                                                                                // Move focus to next row
                                                                                                setTimeout(() => {
                                                                                                    const nextInput = document.getElementById(`recovery-serial-${idx + 1}`);
                                                                                                    if (nextInput) nextInput.focus();
                                                                                                }, 50);
                                                                                            }}
                                                                                            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0"
                                                                                        >
                                                                                            <span className="text-[13px] font-mono font-bold text-slate-800">{c.serial_number}</span>
                                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                                {c.volume && <span className="text-[10px] text-slate-400">{c.volume}</span>}
                                                                                                {c.customer_name && <span className="text-[10px] text-primary/60 font-semibold max-w-[100px] truncate">{c.customer_name}</span>}
                                                                                            </div>
                                                                                        </button>
                                                                                    ));
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                        {!isReadOnly && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setScannerType('item');
                                                                                    setIsScannerOpen(true);
                                                                                    window._currentScanItemId = item._id;
                                                                                }}
                                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary/60 hover:text-primary transition-colors hover:bg-primary/5 rounded-lg z-10"
                                                                            >
                                                                                <ScanLine className="w-5 h-5" />
                                                                            </button>
                                                                        )}
                                                                        {item.isValidating && (
                                                                            <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                                                                <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                <select
                                                                    value={item.condition}
                                                                    onChange={(e) => updateItem(item._id, 'condition', e.target.value)}
                                                                    disabled={isReadOnly}
                                                                    className="w-32 px-2 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-[12px] text-slate-800 focus:ring-2 focus:ring-primary outline-none cursor-pointer"
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
                                <div className="flex flex-col xs:flex-row gap-2 flex-1 md:flex-none min-w-0">
                                    {isEdit && formData.status !== 'HOAN_THANH' && recovery?.status !== 'HOAN_THANH' && (
                                        <button
                                            type="button"
                                            onClick={() => persistRecovery('HOAN_THANH')}
                                            disabled={isLoading}
                                            className={clsx(
                                                'px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] border whitespace-nowrap',
                                                isLoading
                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none'
                                                    : 'bg-emerald-600 text-white border-emerald-700/30 hover:bg-emerald-700 shadow-emerald-600/20'
                                            )}
                                        >
                                            {isLoading ? (
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Check size={16} strokeWidth={2.5} />
                                            )}
                                            Hoàn thành
                                        </button>
                                    )}
                                    <button
                                        form="recoveryForm"
                                        type="submit"
                                        disabled={isLoading}
                                        className={clsx(
                                            'flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] border whitespace-nowrap',
                                            isLoading
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none'
                                                : 'bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200'
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
                                </div>
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
                onClose={() => {
                    setIsScannerOpen(false);
                    window._currentScanItemId = null;
                }}
                onScanSuccess={(text, time) => handleScanSuccess(text, time, window._currentScanItemId)}
                title={scannerType === 'order' ? 'Quét mã QR đơn hàng' : `Quét mã vạch (${items.length} đã thêm)`}
                currentCount={items.length}
                allowDuplicateScans={true}
            />
        </>,
        document.body
    );
}
