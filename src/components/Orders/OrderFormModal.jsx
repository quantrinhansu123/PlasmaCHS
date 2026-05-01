import { AlertTriangle, ChevronDown, Clock, Edit3, Hash, MapPin, Package, Phone, Plus, Save, ScanLine, Search, User, X, Info } from 'lucide-react';
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
import { isAdminRole, isWarehouseRole } from '../../utils/accessControl';
import BarcodeScanner from '../Common/BarcodeScanner';
import OrderFormReadOnlyView from './OrderFormReadOnlyView';
import clsx from 'clsx';

const READY_CYLINDER_STATUS = 'sẵn sàng';
const isReadyCylinderStatus = (status) => String(status || '').trim().toLowerCase() === READY_CYLINDER_STATUS;

/** Bình trong kho phải khớp loại sản phẩm đơn (theo volume). */
function cylinderVolumeMatchesProduct(volume, productType) {
    const vol = (volume || '').toLowerCase();
    if (productType === 'BINH_4L') return vol.includes('4l') || vol.includes('4 l');
    if (productType === 'BINH_8L') return vol.includes('8l') || vol.includes('8 l');
    if (productType === 'BINH_3LC') return vol.includes('3lc') || vol.includes('3 lc');
    if (productType?.startsWith('BINH')) return true;
    return false;
}

function getTakenCylinderSerialsExceptSlot(items, itemIdx, cylIdx) {
    const taken = new Set();
    items.forEach((it, ii) => {
        (it.assignedCylinders || []).forEach((c, ci) => {
            if (ii === itemIdx && ci === cylIdx) return;
            const s = (typeof c === 'string' ? c : c?.serial)?.trim().toUpperCase();
            if (s) taken.add(s);
        });
    });
    return taken;
}

export default function OrderFormModal({ order, onClose, onSuccess, initialMode = 'edit' }) {
    const { role, user, department } = usePermissions();
    const { fetchCustomerCylinderDebt } = useReports();
    const isEdit = !!order;
    const [mode, setMode] = useState(initialMode);
    const isReadOnly = mode === 'view';

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingCustomers, setIsFetchingCustomers] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [customers, setCustomers] = useState([]);
    const [shippersList, setShippersList] = useState([]);
    const [promotionsList, setPromotionsList] = useState([]);
    const [isClosing, setIsClosing] = useState(false);
    // Bình sẵn sàng trong kho xuất (theo warehouse đã chọn)
    const [warehouseReadyCylinders, setWarehouseReadyCylinders] = useState([]);
    const [isFetchingCyls, setIsFetchingCyls] = useState(false);
    const warehouseReadyCylindersRef = useRef([]);
    useEffect(() => { warehouseReadyCylindersRef.current = warehouseReadyCylinders; }, [warehouseReadyCylinders]);
    const [isFacilityDropdownOpen, setIsFacilityDropdownOpen] = useState(false);
    const [facilities, setFacilities] = useState([]);
    const facilityDropdownRef = useRef(null);

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
    const hasLoadedItemsRef = useRef(false);

    useEffect(() => {
        hasLoadedItemsRef.current = false;
    }, [order?.id]);

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
            if (facilityDropdownRef.current && !facilityDropdownRef.current.contains(event.target)) {
                setIsFacilityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);



    const getNewOrderCode = () => Math.floor(1000 + Math.random() * 9000).toString();

    const defaultState = {
        orderCode: getNewOrderCode(),
        customerCategory: 'ALL',
        warehouse: '',
        customerId: '',
        orderedBy: '',
        recipientName: '',
        recipientAddress: '',
        recipientPhone: '',
        orderType: 'BAN',
        note: '',
        items: [
            { 
                productType: 'BINH_4L', 
                quantity: 1, 
                unitPrice: 0, 
                tempDept: '', 
                tempSerial: '',
                assignedCylinders: [{ serial: '', scan_time: null }]
            }
        ],
        promotion: '',
        shipperId: '',
        shippingFee: 0
    };

    const [formData, setFormData] = useState(defaultState);
    const formDataRef = useRef(formData);
    useEffect(() => { formDataRef.current = formData; }, [formData]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [cylinderDebt, setCylinderDebt] = useState([]);
    const [availableProductTypes, setAvailableProductTypes] = useState(PRODUCT_TYPES);
    const [isFetchingStock, setIsFetchingStock] = useState(false);

    /** Chỉ dùng mã kho (cột code) cho orders.warehouse — tránh ghi nhầm tên kho dài và vi phạm check_warehouse trên DB. */
    const warehouseSelectCode = (w) => String(w?.code || '').trim();

    const resolveWarehouseCode = (value, warehouseList = []) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const normalized = raw.toLowerCase();
        const matched = warehouseList.find((w) => {
            const code = String(w?.code || '').trim().toLowerCase();
            const id = String(w?.id || '').trim().toLowerCase();
            const name = String(w?.name || '').trim().toLowerCase();
            return normalized === code || normalized === id || normalized === name;
        });
        return matched ? warehouseSelectCode(matched) : '';
    };

    const getWarehouseLookupValues = (value, warehouseList = []) => {
        const raw = String(value || '').trim();
        if (!raw) return [];
        const normalized = raw.toLowerCase();
        const matched = warehouseList.find((w) => {
            const code = String(w?.code || '').trim().toLowerCase();
            const id = String(w?.id || '').trim().toLowerCase();
            const name = String(w?.name || '').trim().toLowerCase();
            return normalized === code || normalized === id || normalized === name;
        });
        const values = [
            raw,
            String(matched?.code || '').trim(),
            String(matched?.id || '').trim(),
            String(matched?.name || '').trim()
        ].filter(Boolean);
        return [...new Set(values)];
    };

    useEffect(() => {
        if (isEdit) return;
        const currentUserName =
            user?.name ||
            localStorage.getItem('user_name') ||
            sessionStorage.getItem('user_name') ||
            '';
        if (!currentUserName) return;
        setFormData(prev => (prev.orderedBy ? prev : { ...prev, orderedBy: currentUserName }));
    }, [isEdit, user?.name]);

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

    const updateStockOptions = async (warehouseId) => {
        if (!warehouseId) {
            setAvailableProductTypes(PRODUCT_TYPES);
            return;
        }

        setIsFetchingStock(true);
        try {
            // 1. Fetch Machine counts
            const { data: machines, error: mErr } = await supabase
                .from('machines')
                .select('machine_type')
                .eq('warehouse', warehouseId)
                .eq('status', 'sẵn sàng');
            
            if (mErr) throw mErr;

            // 2. Fetch Cylinder counts
            const { data: cylinders, error: cErr } = await supabase
                .from('cylinders')
                .select('volume')
                .eq('warehouse_id', warehouseId)
                .eq('status', 'sẵn sàng');
            
            if (cErr) throw cErr;

            // Count occurrences
            const mCounts = {};
            machines?.forEach(m => {
                const type = m.machine_type || 'Khac';
                mCounts[type] = (mCounts[type] || 0) + 1;
            });

            const cCounts = {};
            cylinders?.forEach(c => {
                const vol = c.volume || '';
                if (vol.includes('4L')) cCounts['BINH_4L'] = (cCounts['BINH_4L'] || 0) + 1;
                else if (vol.includes('8L')) cCounts['BINH_8L'] = (cCounts['BINH_8L'] || 0) + 1;
                else if (vol.includes('3LC')) cCounts['BINH_3LC'] = (cCounts['BINH_3LC'] || 0) + 1;
            });

            // Map static PRODUCT_TYPES to their stock counts
            const updatedTypes = PRODUCT_TYPES.map(pt => {
                let stock = 0;
                if (pt.id === 'BINH_4L') stock = cCounts['BINH_4L'] || 0;
                else if (pt.id === 'BINH_8L') stock = cCounts['BINH_8L'] || 0;
                else if (pt.id === 'MAY_MED') stock = mCounts['BV'] || 0;
                else if (pt.id === 'TM') stock = mCounts['TM'] || 0;
                else if (pt.id === 'FM') stock = mCounts['FM'] || 0;
                else if (pt.id === 'MAY_ROSY') stock = mCounts['ROSY'] || mCounts['MAY_ROSY'] || 0;
                else if (pt.id === 'MAY') stock = machines?.length || 0;
                
                return { ...pt, stock };
            });

            setAvailableProductTypes(updatedTypes);
        } catch (error) {
            console.error('Error updating stock options:', error);
            setAvailableProductTypes(PRODUCT_TYPES);
        } finally {
            setIsFetchingStock(false);
        }
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
            const { data } = await supabase.from('warehouses').select('id, name, code').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                let finalWarehouses = data;
                
                // If not admin and user has a department, filter the list
                if (isWarehouseRole(role) && department) {
                    const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                    finalWarehouses = data.filter(wh => wh.name === userWhCode || wh.id === userWhCode || wh.code === userWhCode);
                }

                setWarehousesList(finalWarehouses);
                
                if (!isEdit && finalWarehouses.length > 0) {
                    const firstCoded = finalWarehouses.find((wh) => warehouseSelectCode(wh));
                    let defaultWh = firstCoded ? warehouseSelectCode(firstCoded) : '';
                    if (isWarehouseRole(role) && department) {
                        const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                        const matched = finalWarehouses.find(wh => wh.name === userWhCode || wh.id === userWhCode || wh.code === userWhCode);
                        if (matched) defaultWh = resolveWarehouseCode(warehouseSelectCode(matched) || matched.id || matched.name, finalWarehouses);
                    }
                    
                    setFormData(prev => {
                        const newWh = resolveWarehouseCode(prev.warehouse, finalWarehouses) || defaultWh;
                        updateStockOptions(newWh);
                        return { ...prev, warehouse: newWh };
                    });
                } else if (isEdit && order.warehouse) {
                    const editWhCode = resolveWarehouseCode(order.warehouse, finalWarehouses);
                    if (editWhCode) {
                        updateStockOptions(editWhCode);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const loadWarehouseCylinders = async () => {
            if (!formData.warehouse) {
                setWarehouseReadyCylinders([]);
                return;
            }
            setIsFetchingCyls(true);
            try {
                const warehouseCandidates = getWarehouseLookupValues(formData.warehouse, warehousesList);
                let loadedCylinders = [];
                let latestError = null;

                for (const warehouseKey of warehouseCandidates) {
                    const { data, error } = await supabase
                        .from('cylinders')
                        .select('serial_number, volume, status, warehouse_id')
                        .eq('warehouse_id', warehouseKey)
                        .eq('status', 's\u1eb5n s\u00e0ng')
                        .order('serial_number', { ascending: true })
                        .limit(5000);

                    if (error) {
                        latestError = error;
                        continue;
                    }

                    if (Array.isArray(data) && data.length > 0) {
                        loadedCylinders = data;
                        break;
                    }
                }

                if (loadedCylinders.length === 0 && latestError) throw latestError;
                if (!cancelled) setWarehouseReadyCylinders(loadedCylinders);
            } catch (e) {
                console.error('loadWarehouseCylinders', e);
                if (!cancelled) setWarehouseReadyCylinders([]);
            } finally {
                if (!cancelled) setIsFetchingCyls(false);
            }
        };
        loadWarehouseCylinders();
        return () => { cancelled = true; };
    }, [formData.warehouse, warehousesList]);

    const getCylinderSelectOptions = useCallback((itemIdx, cylIdx) => {
        const item = formData.items[itemIdx];
        if (!item?.productType?.startsWith('BINH')) return [];
        const taken = getTakenCylinderSerialsExceptSlot(formData.items, itemIdx, cylIdx);
        return (warehouseReadyCylinders || [])
            .filter((c) => isReadyCylinderStatus(c.status))
            .filter((c) => cylinderVolumeMatchesProduct(c.volume, item.productType))
            .filter((c) => !taken.has((c.serial_number || '').trim().toUpperCase()))
            .slice()
            .sort((a, b) => (a.serial_number || '').localeCompare(b.serial_number || '', undefined, { sensitivity: 'base' }));
    }, [formData.items, warehouseReadyCylinders]);

    const fetchRealCustomers = async () => {
        setIsFetchingCustomers(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, legal_rep, phone, address, category')
                .order('name', { ascending: true })
                .limit(10000);

            if (error && error.code !== '42P01') throw error;

            const dbCustomers = (data || []).map(c => ({
                id: c.id,
                name: c.name,
                address: c.address,
                recipient: c.legal_rep || c.representative || c.name,
                phone: c.phone,
                category: c.category
            }));
            setCustomers(dbCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
            setCustomers([]);
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
        const loadOrderData = async () => {
            // Guard: Only load if in edit mode, order exists, and we haven't successfully loaded items yet.
            // This prevents the data from being overwritten if the user already started editing
            // when the customer list or other dependencies finish loading asynchronously.
            if (isEdit && order && !hasLoadedItemsRef.current) {
                hasLoadedItemsRef.current = true; // Set early to prevent parallel executions
                const { data: itemsData, error: itemsErr } = await supabase
                    .from('order_items')
                    .select('*')
                    .eq('order_id', order.id)
                    .order('created_at', { ascending: true });

                let mappedItems = [];
                if (itemsData && itemsData.length > 0) {
                    mappedItems = itemsData.map(item => {
                        const isMachine = item.product_type?.match(/^(MAY|MÁY)/) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED'].includes(item.product_type?.toUpperCase());
                        return {
                            id: item.id,
                            productType: item.product_type,
                            quantity: item.quantity,
                            unitPrice: item.unit_price,
                            tempDept: isMachine ? item.department : '',
                            tempSerial: isMachine ? item.serial_number : '',
                            assignedCylinders: (item.assigned_cylinders || []).map(s => (typeof s === 'string' ? { serial: s, scan_time: 'Đã lưu' } : s))
                        };
                    });
                } else {
                    // Fallback to legacy columns if no items found in order_items
                    const productType = order.product_type?.toUpperCase() || '';
                    const isMachine = productType.match(/^(MAY|MÁY)/) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED'].includes(productType);
                    
                    const rawDept = order.department || '';
                    let tDept = '', tSerial = '';
                    if (rawDept.includes(' / ')) {
                        const parts = rawDept.split(' / ');
                        tDept = parts[0]; tSerial = parts[1];
                    } else if (isMachine) {
                        tSerial = rawDept;
                    } else {
                        tDept = rawDept;
                    }

                    mappedItems.push({
                        productType: order.product_type || 'BINH_4L',
                        quantity: order.quantity || 0,
                        unitPrice: order.unit_price || 0,
                        tempDept: tDept,
                        tempSerial: tSerial,
                        assignedCylinders: (order.assigned_cylinders || []).map(s => (typeof s === 'string' ? { serial: s, scan_time: 'Đã lưu' } : s))
                    });

                    // Legacy product 2
                    if (order.product_type_2 && order.quantity_2 > 0) {
                        mappedItems.push({
                            productType: order.product_type_2,
                            quantity: order.quantity_2,
                            unitPrice: order.unit_price_2 || 0,
                            assignedCylinders: []
                        });
                    }
                }

                // Map customer ID - PRIORITY: Use order.customer_id first, then fallback to name matching
                // This prevents customer ID mapping errors when multiple customers have similar names
                let matchedCustomerId = '';
                
                if (order.customer_id) {
                    // First priority: Use the stored customer_id from order
                    const customerExists = customers.find(c => c.id === order.customer_id);
                    if (customerExists) {
                        matchedCustomerId = order.customer_id;
                    }
                }
                
                // Fallback: If no customer_id or customer not found, try matching by name
                if (!matchedCustomerId && order.customer_name) {
                    const matchedCustomer = customers.find(c => c.name === order.customer_name);
                    if (matchedCustomer) {
                        matchedCustomerId = matchedCustomer.id;
                    }
                }

                setFormData({
                    orderCode: order.order_code,
                    customerCategory: order.customer_category || 'TM',
                    warehouse: resolveWarehouseCode(order.warehouse, warehousesList),
                    customerId: matchedCustomerId,
                    orderedBy: order.ordered_by || '',
                    recipientName: order.recipient_name || '',
                    recipientAddress: order.recipient_address || '',
                    recipientPhone: order.recipient_phone || '',
                    orderType: order.order_type || 'THUONG',
                    note: order.note || '',
                    items: mappedItems,
                    promotion: order.promotion_code || '',
                    shipperId: order.shipper_id || '',
                    shippingFee: order.shipping_fee || 0
                });

                hasLoadedItemsRef.current = true;
            } else if (isEdit && order && hasLoadedItemsRef.current && customers.length > 0 && !formData.customerId) {
                // If we already loaded items but were waiting for customers to map the ID
                // PRIORITY: Use order.customer_id first
                let matchedCustomerId = '';
                
                if (order.customer_id) {
                    const customerExists = customers.find(c => c.id === order.customer_id);
                    if (customerExists) {
                        matchedCustomerId = order.customer_id;
                    }
                }
                
                if (!matchedCustomerId && order.customer_name) {
                    const matchedCustomer = customers.find(c => c.name === order.customer_name);
                    if (matchedCustomer) {
                        matchedCustomerId = matchedCustomer.id;
                    }
                }
                
                if (matchedCustomerId) {
                    setFormData(prev => ({ ...prev, customerId: matchedCustomerId }));
                }
            }
        };

        loadOrderData();
    }, [order, isEdit, customers, formData.customerId]);

    const handleChange = (e) => {
        let { name, value } = e.target;
        
        // Filter non-digits for phone numbers
        if (name === 'recipientPhone') {
            value = value.replace(/\D/g, '').slice(0, 11); // Max 11 digits for some formats
        }
        
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'warehouse') {
            updateStockOptions(value);
        }
    };

    const handleCustomerSelect = async (customer) => {
        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            recipientName: customer.recipient || customer.legal_rep || customer.name || '',
            recipientAddress: customer.address || '',
            recipientPhone: customer.phone || '',
            customerCategory: customer.category || 'TM'
        }));
        setIsCustomerDropdownOpen(false);
        setCustomerSearchTerm('');

        // Fetch related facilities (locations with same phone)
        if (customer.phone) {
            try {
                const { data } = await supabase
                    .from('customers')
                    .select('id, name, legal_rep, phone, address, category, agency_name')
                    .eq('phone', customer.phone);
                
                if (data && data.length > 1) {
                    const mappedFacilities = data.map(f => ({
                        id: f.id,
                        name: f.name,
                        address: f.address,
                        recipient: f.legal_rep || f.name,
                        agency_name: f.agency_name
                    }));
                    setFacilities(mappedFacilities);
                    setIsFacilityDropdownOpen(true);
                } else {
                    setFacilities([]);
                }
            } catch (err) {
                console.error('Error fetching facilities:', err);
            }
        }
    };

    const handleFacilitySelect = (facility) => {
        setFormData(prev => ({
            ...prev,
            recipientName: facility.recipient || facility.name,
            recipientAddress: facility.address || prev.recipientAddress
        }));
        setIsFacilityDropdownOpen(false);
    };

    const filteredCustomers = customers.filter(c => {
        const searchLow = customerSearchTerm.toLowerCase();
        const searchMatch = !customerSearchTerm ||
            c.name?.toLowerCase().includes(searchLow) ||
            (c.phone && c.phone.includes(customerSearchTerm)) ||
            (c.recipient && c.recipient.toLowerCase().includes(searchLow));
        return searchMatch;
    });

    /** Một dòng: tên người liên hệ + SĐT (đồng bộ với dropdown) */
    const customerDropdownLabel = (c) => {
        if (!c) return '';
        const nm = String(c.recipient || c.name || '').trim();
        const phone = String(c.phone || '').trim();
        if (nm && phone) return `${nm} · ${phone}`;
        return nm || phone || '—';
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                { 
                    productType: availableProductTypes[0]?.id || 'BINH_4L', 
                    quantity: 1, 
                    unitPrice: availableProductTypes[0]?.price || 0, 
                    tempDept: '', 
                    tempSerial: '', 
                    assignedCylinders: (availableProductTypes[0]?.id || 'BINH_4L').startsWith('BINH') ? [{ serial: '', scan_time: null }] : [] 
                }
            ]
        }));
    };

    const removeItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            const updatedItem = { ...newItems[index], [field]: value };
            
            // Sync RFID list if quantity or type changes for cylinders
            if (field === 'quantity' || field === 'productType') {
                const isCyl = updatedItem.productType?.startsWith('BINH');
                const targetQty = parseInt(updatedItem.quantity, 10);
                
                if (isCyl) {
                    const currentCyls = [...(updatedItem.assignedCylinders || [])];
                    
                    // ON CHANGE: We only allow GROWING the list. 
                    // This ensures that while a user is typing (and might temporarily have a small or empty number),
                    // the already filled boxes don't disappear.
                    if (!isNaN(targetQty) && targetQty > currentCyls.length) {
                        for (let i = currentCyls.length; i < targetQty; i++) {
                            currentCyls.push({ serial: '', scan_time: null });
                        }
                        updatedItem.assignedCylinders = currentCyls;
                    }
                } else {
                    // Changing to non-cylinder clears instantly
                    updatedItem.assignedCylinders = [];
                }
            }
            
            newItems[index] = updatedItem;
            return { ...prev, items: newItems };
        });
    };

    const handleQuantityBlur = (index) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[index] };
            const isCyl = item.productType?.startsWith('BINH');
            
            if (isCyl) {
                const currentQty = parseInt(item.quantity, 10) || 0;
                const currentCyls = [...(item.assignedCylinders || [])];
                
                // ON BLUR: We force the list to match the final quantity exactly (SHRINK or GROW)
                if (currentCyls.length !== currentQty) {
                    if (currentQty > currentCyls.length) {
                        for (let i = currentCyls.length; i < currentQty; i++) {
                            currentCyls.push({ serial: '', scan_time: null });
                        }
                    } else {
                        currentCyls.length = currentQty;
                    }
                    item.assignedCylinders = currentCyls;
                }
            }
            
            newItems[index] = item;
            return { ...prev, items: newItems };
        });
    };

    const handleCylinderSerialChange = (itemIndex, serialIndex, value) => {
        const normalizedVal = value ? value.trim().toUpperCase() : '';
        setFormData(prev => {
            const newItems = [...prev.items];
            const item = { ...newItems[itemIndex] };
            const newCyls = [...(item.assignedCylinders || [])];
            const now = new Date();
            const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Check for duplicates across ALL items
            let isDuplicate = false;
            newItems.forEach((it, i) => {
                (it.assignedCylinders || []).forEach((c, ci) => {
                    if (i === itemIndex && ci === serialIndex) return;
                    const s = (typeof c === 'string' ? c : c?.serial)?.trim().toUpperCase();
                    if (s === normalizedVal && normalizedVal !== '') isDuplicate = true;
                });
            });

            if (isDuplicate) {
                toast.warn(`Mã ${normalizedVal} đang bị trùng!`, { toastId: `dup-${normalizedVal}` });
            }

            // Update specific slot while preserving other metadata if exists
            const existing = newCyls[serialIndex] || {};
            newCyls[serialIndex] = {
                ...(typeof existing === 'string' ? { serial: existing } : existing),
                serial: normalizedVal,
                scan_time: normalizedVal ? (existing.scan_time || timeStr) : null
            };
            item.assignedCylinders = newCyls;
            newItems[itemIndex] = item;
            return { ...prev, items: newItems };
        });
    };

    const [scanTarget, setScanTarget] = useState({ itemIdx: -1, serialIdx: -1 });
    const scanTargetRef = useRef({ itemIdx: -1, serialIdx: -1 });
    useEffect(() => { scanTargetRef.current = scanTarget; }, [scanTarget]);

    const handleScanSuccess = useCallback((decodedText) => {
        const { itemIdx, serialIdx } = scanTargetRef.current;
        if (itemIdx === -1 || serialIdx === -1) return;

        const normalizedText = decodedText.trim().toUpperCase();
        const fd = formDataRef.current;
        if (!fd.warehouse) {
            toast.error('Vui lòng chọn kho xuất trước khi quét mã bình.');
            return;
        }
        const item = fd.items[itemIdx];
        if (!item?.productType?.startsWith('BINH')) return;

        const cylinders = warehouseReadyCylindersRef.current || [];
        const match = cylinders.find((c) => (c.serial_number || '').trim().toUpperCase() === normalizedText);
        if (!match || !cylinderVolumeMatchesProduct(match.volume, item.productType)) {
            toast.error(`Mã ${normalizedText} không có trong kho đã chọn (sẵn sàng) cho loại bình này.`);
            return;
        }
        const taken = getTakenCylinderSerialsExceptSlot(fd.items, itemIdx, serialIdx);
        if (taken.has(normalizedText)) {
            toast.warn('Mã này đã được chọn ở ô khác.');
            return;
        }

        handleCylinderSerialChange(itemIdx, serialIdx, normalizedText);

        setFormData((prev) => {
            const row = prev.items[itemIdx];
            const nextIdx = row.assignedCylinders.findIndex((s, i) => i > serialIdx && !(typeof s === 'string' ? s : s?.serial));
            if (nextIdx !== -1) {
                setScanTarget({ itemIdx, serialIdx: nextIdx });
            } else {
                setIsScannerOpen(false);
                setScanTarget({ itemIdx: -1, serialIdx: -1 });
            }
            return prev;
        });
    }, []);

    const startScanner = (itemIdx, serialIdx) => {
        setScanTarget({ itemIdx, serialIdx });
        setIsScannerOpen(true);
    };

    const startScanAll = (itemIdx) => {
        const item = formData.items[itemIdx];
        if (!item) return;
        
        const firstEmpty = item.assignedCylinders.findIndex(s => !(typeof s === 'string' ? s : s?.serial));
        if (firstEmpty === -1) {
            toast.info('Đã gán đủ mã bình cho sản phẩm này!');
            return;
        }
        startScanner(itemIdx, firstEmpty);
    };

    const handleUnitPriceChange = (index, value) => {
        const num = value.replace(/\D/g, '');
        handleItemChange(index, 'unitPrice', num === '' ? 0 : parseInt(num, 10));
    };

    const handleQuantityChange = (index, value) => {
        const num = value.replace(/\D/g, '');
        handleItemChange(index, 'quantity', num === '' ? 0 : parseInt(num, 10));
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
    
    // Total calculation for dynamic items
    const calculatedTotalAmount = formData.items.reduce((sum, item, idx) => {
        // Ensure strictly numbers to avoid calculation bugs
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        // Apply promo discount to first item if it's a cylinder (legacy compatibility)
        if (idx === 0 && freeCylinders > 0 && item.productType?.startsWith('BINH')) {
            return sum + (Math.max(0, qty - freeCylinders) * price);
        }
        return sum + (qty * price);
    }, 0);

    const billedQuantity = formData.items[0]?.productType?.startsWith('BINH') 
        ? Math.max(0, (formData.items[0]?.quantity || 0) - freeCylinders) 
        : (formData.items[0]?.quantity || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const failSubmit = (message) => {
            setErrorMsg(message);
            toast.error(message);
        };

        const validItems = formData.items.filter(it => it.quantity > 0);
        const needsCylinderWarehouse = validItems.some((it) => it.productType?.startsWith('BINH') && it.quantity > 0);
        if (needsCylinderWarehouse && !formData.warehouse) {
            failSubmit('Vui lòng chọn kho xuất hàng để gán mã bình.');
            return;
        }
        const resolvedWh = resolveWarehouseCode(formData.warehouse, warehousesList);
        if (formData.warehouse && !resolvedWh) {
            failSubmit('Kho đã chọn chưa có mã (code) trong hệ thống — không thể lưu đơn. Vui lòng cập nhật mã kho trong danh mục kho hoặc chọn kho khác.');
            return;
        }

        const phoneRegex = /^(0|84)(3|5|7|8|9)([0-9]{8})$/;
        if (!formData.customerId || !formData.recipientName || !formData.recipientAddress || !formData.recipientPhone || validItems.length === 0) {
            failSubmit('Vui lòng chọn khách hàng, nhập thông tin giao hàng và ít nhất một loại sản phẩm với số lượng lớn hơn 0.');
            return;
        }

        if (!phoneRegex.test(formData.recipientPhone.replace(/\s/g, ''))) {
            failSubmit('Số điện thoại không đúng định dạng (VD: 0987xxxxxx, 10 chữ số).');
            return;
        }

        // Allow unit price = 0; only block invalid negative values
        const invalidNegativePrice = validItems.filter((it) => Number(it.unitPrice) < 0);
        if (invalidNegativePrice.length > 0) {
            const names = invalidNegativePrice.map((it) => it.productType || 'Sản phẩm').join(', ');
            failSubmit(`Đơn giá không hợp lệ cho: ${names}. Đơn giá phải lớn hơn hoặc bằng 0đ.`);
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
            const currentUser =
                user?.name ||
                user?.email ||
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                'Admin hệ thống';

            let initialStatus = 'CHO_DUYET';
            if (!isEdit && (isAdminRole(role) || isWarehouseRole(role))) {
                initialStatus = 'DA_DUYET';
            }

            // 1. ADVANCED VALIDATION for all items
            const selectedWarehouseCandidates = new Set(
                getWarehouseLookupValues(formData.warehouse, warehousesList)
                    .map((v) => String(v || '').trim().toUpperCase())
                    .filter(Boolean)
            );
            for (const item of validItems) {
                const isCyl = item.productType?.startsWith('BINH');
                const serials = (item.assignedCylinders || []).map(c => (typeof c === 'string' ? c : c?.serial)?.trim().toUpperCase()).filter(Boolean);

                if (isCyl && serials.length > 0) {
                    if (serials.length !== item.quantity) {
                        throw new Error(`Sản phẩm ${item.productType}: Bạn đã quét ${serials.length}/${item.quantity} bình. Vui lòng quét đủ hoặc xóa bớt.`);
                    }

                    const uniqueSerials = [...new Set(serials)];
                    if (uniqueSerials.length !== serials.length) {
                        throw new Error(`Sản phẩm ${item.productType}: Có mã bình bị trùng lặp.`);
                    }

                    const { data: validCyls, error: checkErr } = await supabase
                        .from('cylinders')
                        .select('serial_number, warehouse_id, status, volume')
                        .in('serial_number', uniqueSerials);
                    
                    if (checkErr) throw checkErr;
                    if (!validCyls || validCyls.length !== uniqueSerials.length) {
                        const found = validCyls?.map(c => c.serial_number) || [];
                        const missing = uniqueSerials.filter(s => !found.includes(s));
                        throw new Error(`Sản phẩm ${item.productType}: Mã bình không tồn tại: ${missing.join(', ')}`);
                    }
                    for (const c of validCyls) {
                        const cylWarehouseValue = String(c.warehouse_id || '').trim().toUpperCase();
                        if (!selectedWarehouseCandidates.has(cylWarehouseValue)) {
                            throw new Error(`Sản phẩm ${item.productType}: Mã ${c.serial_number} không thuộc kho xuất đã chọn.`);
                        }
                        if ((c.status || '').trim() !== READY_CYLINDER_STATUS) {
                            throw new Error(`Sản phẩm ${item.productType}: Mã ${c.serial_number} không ở trạng thái sẵn sàng (${c.status || '—'}).`);
                        }
                        if (!cylinderVolumeMatchesProduct(c.volume, item.productType)) {
                            throw new Error(`Sản phẩm ${item.productType}: Mã ${c.serial_number} không khớp loại bình (volume: ${c.volume || '—'}).`);
                        }
                    }
                }
            }

            // 2. PREPARE MAIN ORDER PAYLOAD (Legacy compatibility + summary)
            const firstItem = validItems[0];
            const payload = {
                order_code: formData.orderCode,
                customer_category: formData.customerCategory,
                warehouse: resolveWarehouseCode(formData.warehouse, warehousesList),
                customer_name: customerName,
                customer_id: formData.customerId || null,
                recipient_name: formData.recipientName,
                recipient_address: formData.recipientAddress,
                recipient_phone: formData.recipientPhone,
                order_type: formData.orderType,
                note: formData.note,
                
                // Legacy columns (populate with first item)
                product_type: firstItem.productType,
                quantity: firstItem.quantity,
                unit_price: firstItem.unitPrice,
                department: (firstItem.tempDept || firstItem.tempSerial) ? `${firstItem.tempDept}${firstItem.tempDept && firstItem.tempSerial ? ' / ' : ''}${firstItem.tempSerial}`.trim() : '',
                assigned_cylinders: firstItem.productType.startsWith('BINH') ? firstItem.assignedCylinders.map(c => typeof c === 'string' ? c : c?.serial).filter(Boolean) : null,
                
                total_amount: calculatedTotalAmount,
                promotion_code: formData.promotion,
                shipper_id: formData.shipperId || null,
                shipping_fee: formData.shippingFee || 0,
                status: isEdit ? order.status : initialStatus,
                ordered_by: (formData.orderedBy || currentUser).trim(),
                updated_at: new Date().toISOString()
            };

            let orderId = order?.id;

            if (isEdit) {
                const { error } = await supabase.from('orders').update(payload).eq('id', order.id);
                if (error) throw error;
            } else {
                const { data: inserted, error: insErr } = await supabase.from('orders').insert([payload]).select('id').single();
                if (insErr) throw insErr;
                orderId = inserted.id;
            }

            // 3. SYNC ORDER ITEMS
            if (isEdit) {
                // Remove all current items and re-insert (Simplest sync for now)
                await supabase.from('order_items').delete().eq('order_id', orderId);
            }

            const itemsPayload = validItems.map(item => ({
                order_id: orderId,
                product_type: item.productType,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_amount: item.quantity * item.unitPrice,
                department: item.tempDept || null,
                serial_number: item.tempSerial || null,
                assigned_cylinders: item.productType.startsWith('BINH') ? item.assignedCylinders.map(c => typeof c === 'string' ? c : c?.serial).filter(Boolean) : null
            }));

            const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
            if (itemsErr) throw itemsErr;

            onSuccess();
        } catch (error) {
            console.error('Error saving multi-product order:', error);
            const msg = error.message || 'Lỗi khi lưu đơn hàng đa sản phẩm.';
            setErrorMsg(msg);
            toast.error(msg);
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

                    {isReadOnly ? (
                        <OrderFormReadOnlyView
                            formData={formData}
                            order={order}
                            customers={customers}
                            warehousesList={warehousesList}
                            shippersList={shippersList}
                            promotionsList={promotionsList}
                            cylinderDebt={cylinderDebt}
                            formatNumber={formatNumber}
                            calculatedTotalAmount={calculatedTotalAmount}
                            freeCylinders={freeCylinders}
                            billedQuantity={billedQuantity}
                        />
                    ) : (
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
                                                        ? customerDropdownLabel(customers.find(c => c.id.toString() === formData.customerId.toString()))
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
                                                        placeholder="Tìm tên hoặc SĐT..."
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
                                                                <div className={`text-sm font-semibold truncate ${formData.customerId === customer.id ? 'text-primary' : 'text-slate-800'}`}>
                                                                    {customerDropdownLabel(customer)}
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

                                <div className="space-y-1.5 overflow-visible relative" ref={facilityDropdownRef}>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-primary/70" />Tên người nhận <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            name="recipientName"
                                            value={formData.recipientName}
                                            onChange={handleChange}
                                            onFocus={() => facilities.length > 0 && setIsFacilityDropdownOpen(true)}
                                            readOnly={isReadOnly}
                                            placeholder="Nhập tên người nhận"
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold transition-all",
                                                isReadOnly ? "text-slate-500 cursor-default" : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                            required
                                        />
                                        {!isReadOnly && facilities.length > 0 && (
                                            <button 
                                                type="button"
                                                onClick={() => setIsFacilityDropdownOpen(!isFacilityDropdownOpen)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary/50 hover:text-primary"
                                            >
                                                <ChevronDown size={18} className={isFacilityDropdownOpen ? 'rotate-180' : ''} />
                                            </button>
                                        )}
                                    </div>

                                    {isFacilityDropdownOpen && facilities.length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                                            <div className="p-2 border-b border-primary/10 bg-primary/5 text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                                <MapPin size={12} /> Chọn cơ sở / phòng tương ứng
                                            </div>
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar whitespace-normal">
                                                {facilities.map(f => (
                                                    <div
                                                        key={f.id}
                                                        className="px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                                                        onClick={() => handleFacilitySelect(f)}
                                                    >
                                                        <div className="font-bold text-slate-800 text-[13px]">{f.name}</div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">{f.address}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><Phone className="w-4 h-4 text-primary/70" />Số điện thoại <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        name="recipientPhone"
                                        value={formData.recipientPhone}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="Ví dụ: 0987123456"
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                        required
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium px-1 italic">* Yêu cầu đúng 10 chữ số (VD: 09xxx...)</p>
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

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800"><User className="w-4 h-4 text-primary/70" />Kinh doanh phụ trách</label>
                                    <input
                                        name="orderedBy"
                                        value={formData.orderedBy}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="Tên nhân sự phụ trách đơn hàng"
                                        className={clsx(
                                            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all",
                                            isReadOnly ? "text-slate-500 cursor-default" : "focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
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
                                            {warehousesList
                                                .filter((w) => warehouseSelectCode(w))
                                                .map((w) => {
                                                    const whCode = warehouseSelectCode(w);
                                                    return (
                                                        <option key={w.id} value={whCode}>
                                                            {w.name} ({whCode})
                                                        </option>
                                                    );
                                                })}
                                        </select>
                                        {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                    </div>
                                    {!isReadOnly && warehousesList.length > 0 && !warehousesList.some((w) => warehouseSelectCode(w)) && (
                                        <p className="text-[11px] font-semibold text-amber-600 px-1">
                                            Chưa có kho nào được gán mã (code). Cập nhật cột code trong danh mục kho để tạo đơn bình.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-6 pt-2">
                                    {formData.items.map((item, idx) => {
                                        const isMachine = item.productType?.match(/^(MAY|MÁY)/) || ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED', 'MAY_MED_NEW'].includes(item.productType?.toUpperCase());
                                        const isCylinder = item.productType?.startsWith('BINH');

                                        return (
                                            <div key={idx} className="p-4 border border-slate-200 rounded-3xl bg-slate-50/50 space-y-4 relative group animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg w-fit">
                                                        <span className="text-[11px] font-black text-primary uppercase">Sản phẩm {idx + 1}</span>
                                                    </div>
                                                    {!isReadOnly && formData.items.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(idx)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[13px] font-bold text-slate-700">Loại sản phẩm <span className="text-red-500">*</span></label>
                                                        <div className="relative">
                                                            <select
                                                                value={item.productType}
                                                                onChange={(e) => handleItemChange(idx, 'productType', e.target.value)}
                                                                disabled={isReadOnly || isFetchingStock}
                                                                className={clsx(
                                                                    "w-full h-11 px-4 bg-white border border-slate-200 rounded-2xl text-[14px] font-semibold appearance-none transition-all",
                                                                    (isReadOnly || isFetchingStock) ? "text-slate-500 cursor-not-allowed" : "text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                                                )}
                                                            >
                                                                {isFetchingStock ? (
                                                                    <option>Đang tải tồn kho...</option>
                                                                ) : (
                                                                    availableProductTypes.map(p => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.label} {p.stock !== undefined ? (p.stock > 0 ? `(Tồn: ${p.stock})` : '(Hết hàng)') : ''}
                                                                        </option>
                                                                    ))
                                                                )}
                                                            </select>
                                                            {!isReadOnly && <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[13px] font-bold text-slate-700">Đơn giá (VNĐ)</label>
                                                            <input
                                                                type="text"
                                                                value={formatNumber(item.unitPrice)}
                                                                onChange={(e) => handleUnitPriceChange(idx, e.target.value)}
                                                                readOnly={isReadOnly}
                                                                placeholder="0"
                                                                className={clsx(
                                                                    "w-full h-11 px-4 bg-white border border-slate-200 rounded-2xl text-[14px] font-semibold transition-all",
                                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[13px] font-bold text-slate-700">Số lượng <span className="text-red-500">*</span></label>
                                                            <input
                                                                type="text"
                                                                value={formatNumber(item.quantity)}
                                                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                                                onBlur={() => handleQuantityBlur(idx)}
                                                                readOnly={isReadOnly}
                                                                placeholder="0"
                                                                className={clsx(
                                                                    "w-full h-11 px-4 bg-white border border-slate-200 rounded-2xl text-[14px] font-semibold transition-all",
                                                                    isReadOnly ? "text-slate-500 cursor-default" : "text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Machine specific fields */}
                                                    {isMachine && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 italic">
                                                            <div className="space-y-1.5">
                                                                <label className="text-[12px] font-bold text-slate-600">Khoa sử dụng máy</label>
                                                                <input
                                                                    value={item.tempDept || ''}
                                                                    onChange={(e) => handleItemChange(idx, 'tempDept', e.target.value)}
                                                                    readOnly={isReadOnly}
                                                                    placeholder="VD: Khoa Nội"
                                                                    className="w-full h-10 px-4 bg-white/50 border border-slate-200 rounded-xl text-[13px] font-medium"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="text-[12px] font-bold text-slate-600">Số serial máy</label>
                                                                <input
                                                                    value={item.tempSerial || ''}
                                                                    onChange={(e) => handleItemChange(idx, 'tempSerial', e.target.value)}
                                                                    readOnly={isReadOnly}
                                                                    placeholder="VD: SN-123"
                                                                    className="w-full h-10 px-4 bg-white/50 border border-slate-200 rounded-xl text-[13px] font-medium"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Cylinder assigned codes */}
                                                    {isCylinder && item.quantity > 0 && (
                                                        <div className="pt-2 border-t border-slate-100">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-[12px] font-bold text-primary flex items-center gap-1.5">
                                                                    <ScanLine className="w-3.5 h-3.5" /> Gán mã RFID cho {item.productType} ({item.assignedCylinders?.length || 0})
                                                                </label>
                                                                {!isReadOnly && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startScanAll(idx)}
                                                                        className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1"
                                                                    >
                                                                        <ScanLine className="w-3 h-3" /> Quét hàng loạt
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {!formData.warehouse && !isReadOnly && (
                                                                <p className="text-[11px] font-bold text-amber-600 mb-2">Chọn kho xuất để hiện danh sách mã bình sẵn sàng.</p>
                                                            )}
                                                            {formData.warehouse && !isReadOnly && !isFetchingCyls && getCylinderSelectOptions(idx, 0).length === 0 && (
                                                                <p className="text-[11px] font-bold text-amber-600 mb-2">Kho này hiện chưa có mã RFID sẵn sàng cho loại bình đã chọn.</p>
                                                            )}
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1 custom-scrollbar">
                                                                {item.assignedCylinders?.map((cyl, cIdx) => {
                                                                    const dropKey = `it-${idx}-cyl-${cIdx}`;
                                                                    const currentVal = (typeof cyl === 'string' ? cyl : (cyl?.serial || '')).trim().toUpperCase();
                                                                    const rowReadOnly = mode === 'view' || item.isLocked;
                                                                    const options = getCylinderSelectOptions(idx, cIdx);

                                                                    return (
                                                                        <div key={dropKey} className="relative flex items-center gap-2">
                                                                            {rowReadOnly ? (
                                                                                <input
                                                                                    value={currentVal}
                                                                                    readOnly
                                                                                    className="w-full h-10 pl-4 pr-4 bg-white border border-slate-200 rounded-xl text-[13px] font-mono font-bold text-slate-600"
                                                                                />
                                                                            ) : (
                                                                                <select
                                                                                    value={currentVal}
                                                                                    onChange={(e) => handleCylinderSerialChange(idx, cIdx, e.target.value)}
                                                                                    disabled={isFetchingCyls}
                                                                                    className="w-full h-10 pl-3 pr-10 bg-white border border-slate-200 rounded-xl text-[13px] font-mono font-bold text-primary focus:border-primary/50 focus:ring-2 focus:ring-primary/5 appearance-none cursor-pointer"
                                                                                >
                                                                                    <option value="">— Chọn mã bình #{cIdx + 1} —</option>
                                                                                    {options.map((c) => (
                                                                                        <option key={c.serial_number} value={(c.serial_number || '').trim().toUpperCase()}>
                                                                                            {(c.serial_number || '').trim().toUpperCase()}{c.volume ? ` — ${c.volume}` : ''}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            )}
                                                                            {!rowReadOnly && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => startScanner(idx, cIdx)}
                                                                                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-sm transition-all"
                                                                                    title="Quét mã"
                                                                                    aria-label="Quét mã RFID"
                                                                                >
                                                                                    <ScanLine className="w-4 h-4 shrink-0" strokeWidth={2.25} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="w-full py-3 border-2 border-dashed border-primary/20 text-primary/60 hover:text-primary hover:bg-primary/5 rounded-3xl flex items-center justify-center gap-2 font-bold text-[14px] transition-all"
                                        >
                                            <Plus size={18} /> Thêm sản phẩm khác
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1.5 pt-4 border-t border-slate-100">
                                    <label className="text-[14px] font-bold text-primary flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span>Tổng giá trị đơn hàng (VNĐ)</span>
                                            <span className="text-[20px] font-black tracking-tight text-primary shadow-sm px-2 bg-primary/5 rounded-lg">{formatNumber(calculatedTotalAmount)}</span>
                                        </div>
                                        {formData.items.filter(it => it.quantity > 0).length > 0 && (
                                            <div className="text-[11px] font-semibold text-slate-400 text-right">
                                                {formData.items.filter(it => it.quantity > 0).map((it, i) => (
                                                    <span key={i}>
                                                        {i > 0 && ' + '}
                                                        {formatNumber(it.quantity)} × {formatNumber(it.unitPrice)}đ
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {calculatedTotalAmount === 0 && formData.items.some(it => it.quantity > 0) && (
                                            <div className="text-[11px] font-bold text-amber-500 text-right flex items-center justify-end gap-1">
                                                ⚠️ Tổng tiền = 0đ. Kiểm tra lại đơn giá!
                                            </div>
                                        )}
                                    </label>
                                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-full opacity-30"></div>
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
                    )}
                </div>

                <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className={clsx(
                            "px-6 py-3 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 border",
                            isReadOnly 
                                ? "w-full sm:w-auto bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" 
                                : "w-full sm:w-auto px-4 py-2.5 border border-slate-300 bg-white text-slate-500 hover:text-primary"
                        )}
                        disabled={isLoading}
                    >
                        {isReadOnly ? <X className="w-4 h-4" /> : null}
                        {isReadOnly ? 'Đóng cửa sổ' : 'Hủy'}
                    </button>
                    {!isReadOnly && (
                        <button
                            type={isReadOnly ? "button" : "submit"}
                            form={isReadOnly ? undefined : "orderForm"}
                            disabled={isLoading}
                            className={clsx(
                                "w-full md:flex-1 sm:w-auto px-6 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50 bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200"
                            )}
                        >
                            {isLoading ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isLoading 
                                ? 'Đang lưu đơn...' 
                                : isEdit ? 'Xác nhận cập nhật' : 'Xác nhận tạo đơn hàng'}
                        </button>
                    )}
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
