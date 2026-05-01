import { clsx } from 'clsx';
import { Printer, Save, Eye, EyeOff, Edit, X, Warehouse } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/config';
import { toast } from 'react-toastify';
import usePermissions from '../../hooks/usePermissions';
import { notificationService } from '../../utils/notificationService';
import {
    isAdminRole as isAdminRoleHelper,
    isSalesRole as isSalesRoleHelper,
    isWarehouseRole as isWarehouseRoleHelper,
    normalizeRole,
} from '../../utils/accessControl';
import MachineHandoverPrintTemplate from '../MachineHandoverPrintTemplate';
import GoodsIssuePrintTemplate from '../GoodsIssues/GoodsIssuePrintTemplate';
import Combobox from '../ui/Combobox';

const dmyToYmd = (dmy) => {
    if (!dmy || typeof dmy !== 'string') return "";
    const parts = dmy.split('/');
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const ymdToDmy = (ymd) => {
    if (!ymd || typeof ymd !== 'string') return "";
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd; // Might be already d/m/y if something went wrong
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
};


const MachineIssueRequestForm = ({ overrideOrderId, overrideViewOnly, onClosePopup }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { role, user } = usePermissions();

    const normalizedRole = normalizeRole(role);
    const isAdminRole = isAdminRoleHelper(role);
    const isWarehouseRole = isWarehouseRoleHelper(role);
    const isSalesRole = isSalesRoleHelper(role);
    
    // Authorization check for Machine Code
    const canEditMachineCode = isAdminRole || isWarehouseRole;
    const canEditApprovedQuantity = !isSalesRole;

    const [formData, setFormData] = useState({
        orangeNumber: '',
        formNumber: '',
        requesterName: '',
        machineManager: '',
        customerId: '',
        customerName: '',
        phone: '',
        facilityName: '',
        placementAddress: '',
        status: '',
        // Checkboxes
        machineType: {
            TM: false,
            SD: false,
            FM: false,
            Khac: false
        },
        machineColor: {
            'Ghi xám': false,
            'Trắng(600-WH1, fullshade)': false,
            'Xanh dương(600-RBL70,WH1)': false,
            'Xanh Lá(600-TGR32, WH1)': false,
            'Hồng Nhạt(600-RRD84, WH1)': false,
            'Tím (600-VT20, RGB17)': false
        },
        quantity: '',
        quantityApproved: '',
        warehouse: '',
        product: '',
        machineCode: '',
        dateNeeded: '',
        dateDelivery: '',
        dateRecall: '',
        dateRecallActual: '',
        shippingMethod: {
            'KD tự vận chuyển': false,
            'Xe Công ty': false
        },
        issueType: {
            'Demo': false,
            'Thuê': false,
            'Bán': false,
            'Ngoại Giao': false
        },
        notes: ''
    });
    const [warehouseList, setWarehouseList] = useState([]);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [availableMachineCodes, setAvailableMachineCodes] = useState([]);
    const [availableMachineCodesByType, setAvailableMachineCodesByType] = useState({});

    // Chống race condition khi đổi kho nhanh
    const readyMachinesLoadReqIdRef = useRef(0);

    const [isMachineCodePickerOpen, setIsMachineCodePickerOpen] = useState(false);

    const parseMachineCodes = (value) =>
        (value || '')
            .toString()
            .split(/[,\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);

    const stripDeliveryImageNote = (value) =>
        String(value || '')
            .split('\n')
            .filter((line) => !/^\s*\[Ảnh giao hàng\]\s*:/i.test(String(line || '').trim()))
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

    const getSelectedMachineTypeKey = (machineTypeMap) =>
        Object.keys(machineTypeMap || {}).find((key) => machineTypeMap[key]);

    const getSerialsByMachineType = (typeKey, serialMap) => {
        if (!typeKey) return [];

        if (typeKey === 'Khac') {
            return Object.entries(serialMap || {})
                .filter(([key]) => !['TM', 'SD', 'FM'].includes(key))
                .flatMap(([, serials]) => serials || []);
        }

        return (serialMap || {})[typeKey] || [];
    };

    const resolveWarehouseCode = (value) => {
        if (!value) return value;
        const input = String(value).trim();
        if (!input) return input;

        if (!Array.isArray(warehouseList) || warehouseList.length === 0) return input;

        // Nếu input là code thật
        const direct = warehouseList.find((w) => w.code === input);
        if (direct?.code) return direct.code;

        // Nếu input là id
        const byId = warehouseList.find((w) => String(w.id) === input);
        if (byId?.code) return byId.code;

        // Nếu input là name
        const byName = warehouseList.find((w) => String(w.name) === input);
        if (byName?.code) return byName.code;

        // Không resolve được thì giữ nguyên
        return input;
    };

    const sanitizeWarehouseForOrder = (value) => {
        const resolved = resolveWarehouseCode(value);
        if (!resolved) return null;
        const candidate = String(resolved).trim();
        if (!candidate) return null;

        // Danh sách code hợp lệ theo constraint hiện tại + code động từ bảng warehouses
        const staticAllowed = ['HN', 'TP.HCM', 'TH', 'DN', 'CT', 'NM', 'NMK', 'OCP1', 'VQ', 'VPMN'];
        const dynamicAllowed = (warehouseList || [])
            .map((w) => (w?.code || '').toString().trim())
            .filter(Boolean);
        const allowed = new Set([...staticAllowed, ...dynamicAllowed]);

        return allowed.has(candidate) ? candidate : null;
    };

    const [editOrderId, setEditOrderId] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [facilities, setFacilities] = useState([]);
    const [isFacilityDropdownOpen, setIsFacilityDropdownOpen] = useState(false);
    const currentActorName =
        user?.name ||
        localStorage.getItem('user_name') ||
        sessionStorage.getItem('user_name') ||
        'Nhân viên';

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const orderId = overrideOrderId || queryParams.get('orderId');
        const viewOnly = overrideViewOnly ? 'true' : queryParams.get('viewOnly');
        const phone = queryParams.get('phone');
        
        if (viewOnly === 'true') {
            setIsReadOnly(true);
            setShowPreview(true);
        }
        
        if (orderId) {
            setEditOrderId(orderId);
            fetchExistingOrder(orderId);
        } else if (phone) {
            setFormData(prev => ({ ...prev, phone }));
        }
    }, [location.search]);

    // Bug2 fix: watch user?.name specifically — fires even when user loads async after mount
    useEffect(() => {
        if (!editOrderId && user?.name) {
            setFormData(prev => {
                // Only overwrite if still blank (don't clobber user edits)
                if (!prev.requesterName) {
                    return { ...prev, requesterName: user.name };
                }
                return prev;
            });
        }
    }, [user?.name, editOrderId]);

    const fetchExistingOrder = async (id) => {
        try {
            const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                const noteStr = data.note || '';
                const lines = noteStr.split('\n').map(l => l.trim());
                
                const parseField = (prefix) => {
                    const match = lines.find(l => l.startsWith(prefix));
                    return match ? match.replace(prefix, '').replace(/\.\s*$/, '').trim() : '';
                };
                
                const types = parseField('Loại máy:').split(',').map(s => s.trim()).filter(Boolean);
                const issues = parseField('Hình thức:').split(',').map(s => s.trim()).filter(Boolean);
                const colors = parseField('Màu máy:').split(',').map(s => s.trim()).filter(Boolean);
                const pShipping = parseField('PT Vận chuyển:').split(',').map(s => s.trim()).filter(Boolean);
                const selectedProduct = parseField('Sản phẩm:');
                
                let notesRemaining = '';
                const ghichuIndex = lines.findIndex(l => l.startsWith('Ghi chú:'));
                if (ghichuIndex !== -1) {
                    const firstLine = lines[ghichuIndex].replace('Ghi chú:', '').trim();
                    const rest = lines.slice(ghichuIndex + 1).map(l => l.replace(/\.\s*$/, '')).join('\n');
                    notesRemaining = `${firstLine}${rest ? '\n' + rest : ''}`;
                }
                notesRemaining = stripDeliveryImageNote(notesRemaining);
                
                setFormData({
                    orangeNumber: data.order_code?.replace('DNXM-', '') || '',
                    requesterName: data.ordered_by || '',
                    machineManager: parseField('Phụ trách máy:'),
                    customerId: data.customer_id || '', // Bug3 fix: restore customer_id for correct mapping
                    customerName: data.customer_name || '',
                    phone: data.recipient_phone || '',
                    facilityName: data.recipient_name || '',
                    placementAddress: data.recipient_address || '',
                    status: data.status || '',
                    
                    machineType: {
                        TM: types.includes('TM'),
                        SD: types.includes('SD'),
                        FM: types.includes('FM'),
                        Khac: types.includes('Khac') || types.includes('Khác (NK, IoT)')
                    },
                    machineColor: {
                        'Ghi xám': colors.includes('Ghi xám'),
                        'Trắng(600-WH1, fullshade)': colors.includes('Trắng(600-WH1, fullshade)'),
                        'Xanh dương(600-RBL70,WH1)': colors.includes('Xanh dương(600-RBL70,WH1)'),
                        'Xanh Lá(600-TGR32, WH1)': colors.includes('Xanh Lá(600-TGR32, WH1)'),
                        'Hồng Nhạt(600-RRD84, WH1)': colors.includes('Hồng Nhạt(600-RRD84, WH1)'),
                        'Tím (600-VT20, RGB17)': colors.includes('Tím (600-VT20, RGB17)')
                    },
                    quantity: data.quantity?.toString() || '',
                    quantityApproved: parseField('SL phê duyệt:') || '',
                    warehouse: data.warehouse || '',
                    product: selectedProduct || '',
                    machineCode: parseMachineCodes(parseField('Mã máy:')).join(', '),
                    dateNeeded: dmyToYmd(parseField('Ngày cần:')),
                    dateDelivery: dmyToYmd(parseField('Giao:')),
                    dateRecall: dmyToYmd(parseField('Thu hồi dự kiến:')),
                    shippingMethod: {
                        'KD tự vận chuyển': pShipping.includes('KD tự vận chuyển'),
                        'Xe Công ty': pShipping.includes('Xe Công ty')
                    },
                    issueType: {
                        'Demo': issues.includes('Demo'),
                        'Thuê': issues.includes('Thuê'),
                        'Bán': issues.includes('Bán'),
                        'Ngoại Giao': issues.includes('Ngoại Giao')
                    },
                    notes: notesRemaining
                });
            }
        } catch (err) {
            console.error('Error fetching DNXM:', err);
            toast.error('Lỗi khi tải phiếu đề xuất: ' + err.message);
        }
    };

    const [isSearching, setIsSearching] = useState(false);
    const [staffList, setStaffList] = useState([]);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data } = await supabase.from('app_users').select('id, name, role').order('name');
                if (data) setStaffList(data);
            } catch (err) {
                console.error('Error fetching staff:', err);
            }
        };
        fetchStaff();
    }, []);

    useEffect(() => {
        const fetchWarehouses = async () => {
            const { data: whs, error } = await supabase.from('warehouses').select('id, name, code').order('name');
            if (!error) setWarehouseList(whs || []);
        };
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (!formData.warehouse) return;
        loadReadyMachinesByWarehouse(formData.warehouse);
    }, [formData.warehouse, warehouseList]);

    useEffect(() => {
        const selected = availableProducts.find((product) => product.value === formData.product);
        setAvailableMachineCodes(selected?.serials || []);
    }, [formData.product, availableProducts]);

    useEffect(() => {
        const selectedType = getSelectedMachineTypeKey(formData.machineType);
        if (!selectedType) return;

        const nextSerials = getSerialsByMachineType(selectedType, availableMachineCodesByType).filter(Boolean);
        setAvailableMachineCodes(nextSerials);

        // Đồng bộ product theo loại máy đang chọn để tránh chọn sai loại serial.
        if (selectedType === 'Khac') {
            const otherProduct = availableProducts.find((p) => !['TM', 'SD', 'FM'].includes(p.value));
            if (otherProduct && otherProduct.value !== formData.product) {
                setFormData((prev) => ({ ...prev, product: otherProduct.value, machineCode: '' }));
            }
            return;
        }

        if (selectedType !== formData.product) {
            setFormData((prev) => ({ ...prev, product: selectedType, machineCode: '' }));
        }
    }, [formData.machineType, availableMachineCodesByType, availableProducts]);

    // Auto-fill logic when phone changes — ONLY for NEW orders.
    // When editing an existing order (editOrderId is set), the customer data
    // is already loaded from the orders table and must NOT be overwritten
    // by a phone lookup, which could return a different customer entirely.
    useEffect(() => {
        // Skip auto-fill entirely when editing an existing order
        if (editOrderId) return;

        const fetchCustomerData = async () => {
            if (!formData.phone || formData.phone.length < 8) return;

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('phone', formData.phone);

                if (data && data.length > 0 && !error) {
                    setFacilities(data);
                    if (data.length === 1) {
                        const customer = data[0];
                        setFormData(prev => ({
                            ...prev,
                            customerId: customer.id || prev.customerId,
                            // Ưu tiên hiển thị Người đại diện theo yêu cầu nghiệp vụ
                            customerName: customer.legal_rep || customer.representative || customer.name || '',
                            facilityName: customer.agency_name || customer.invoice_company_name || customer.name || '',
                            placementAddress: customer.address || '',
                            machineManager: customer.managed_by || prev.machineManager,
                            warehouse: customer.warehouse_id || prev.warehouse
                        }));
                    } else {
                        // Multiple facilities found, let user pick
                        setIsFacilityDropdownOpen(true);
                        // Auto-fill common data from first one
                        const first = data[0];
                        setFormData(prev => ({
                            ...prev,
                            customerId: first.id || prev.customerId,
                            // Ưu tiên hiển thị Người đại diện theo yêu cầu nghiệp vụ
                            customerName: first.legal_rep || first.representative || first.name || '',
                            machineManager: first.managed_by || prev.machineManager,
                            warehouse: first.warehouse_id || prev.warehouse
                        }));
                    }
                } else {
                    setFacilities([]);
                }
            } catch (error) {
                console.log("Customer not found for auto-fill");
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(fetchCustomerData, 600);
        return () => clearTimeout(timeoutId);
    }, [formData.phone, editOrderId]);

    const handleFacilitySelect = (facility) => {
        setFormData(prev => ({
            ...prev,
            customerId: facility.id || prev.customerId,
            // Ưu tiên hiển thị Người đại diện theo yêu cầu nghiệp vụ
            customerName: facility.legal_rep || facility.representative || facility.name || prev.customerName,
            facilityName: facility.agency_name || facility.invoice_company_name || facility.name || '',
            placementAddress: facility.address || '',
            machineManager: facility.managed_by || prev.machineManager,
            warehouse: facility.warehouse_id || prev.warehouse
        }));
        setIsFacilityDropdownOpen(false);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            
            // Auto-calculate quantity based on machineCode split by comma
            if (field === 'machineCode') {
                const codes = value.split(',').map(c => c.trim()).filter(c => c !== '');
                newData.quantity = codes.length > 0 ? codes.length.toString() : '';
            }

            if (field === 'product') {
                newData.machineType = {
                    TM: value === 'TM',
                    SD: value === 'SD',
                    FM: value === 'FM',
                    Khac: value === 'Khac' || (value && !['TM', 'SD', 'FM'].includes(value))
                };
            }
            
            return newData;
        });
    };

    const handleCheckboxChange = (group, key) => {
        const singleSelectGroups = ['machineType', 'machineColor', 'shippingMethod'];

        if (singleSelectGroups.includes(group)) {
            setFormData(prev => {
                const currentValue = !!prev[group]?.[key];
                const resetGroup = Object.keys(prev[group] || {}).reduce((acc, itemKey) => {
                    acc[itemKey] = false;
                    return acc;
                }, {});

                return {
                    ...prev,
                    [group]: {
                        ...resetGroup,
                        [key]: !currentValue
                    }
                };
            });
            return;
        }

        setFormData(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [key]: !prev[group][key]
            }
        }));
    };

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentDay = String(new Date().getDate()).padStart(2, '0');

    const [showPreview, setShowPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [printType, setPrintType] = useState('DNXM'); // 'DNXM' | 'BBBG' | 'XK'
    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [pendingNextStatus, setPendingNextStatus] = useState(null);
    const [pendingApproveData, setPendingApproveData] = useState(null);

    // Filter machines by warehouseCode (e.g. 'HN', 'TP.HCM') — must match machines.warehouse
    const loadReadyMachinesByWarehouse = async (warehouseCode) => {
        const resolvedWarehouseCode = resolveWarehouseCode(warehouseCode);

        if (!resolvedWarehouseCode) {
            setAvailableProducts([]);
            setAvailableMachineCodes([]);
            setAvailableMachineCodesByType({});
            return;
        }

        const reqId = ++readyMachinesLoadReqIdRef.current;
        const { data, error } = await supabase
            .from('machines')
            .select('serial_number, machine_type, warehouse, status')
            .eq('warehouse', resolvedWarehouseCode)
            .eq('status', 'sẵn sàng');

        // Nếu request cũ chưa kịp trả về mà user đã đổi kho mới → bỏ qua
        if (reqId !== readyMachinesLoadReqIdRef.current) return;

        if (error) {
            console.error('Error loading warehouse machines:', error);
            setAvailableProducts([]);
            setAvailableMachineCodes([]);
            setAvailableMachineCodesByType({});
            return;
        }
        const grouped = (data || []).reduce((acc, machine) => {
            const key = (machine.machine_type || 'MAY').toString().trim().toUpperCase();
            if (!acc[key]) acc[key] = [];
            acc[key].push((machine.serial_number || '').trim());
            return acc;
        }, {});
        setAvailableMachineCodesByType(grouped);
        const products = Object.entries(grouped).map(([productType, serials]) => ({
            value: productType,
            label: `${productType} (Sẵn sàng: ${serials.length})`,
            serials: serials.filter(Boolean)
        }));
        setAvailableProducts(products);

        const selectedProductExists = products.some((p) => p.value === formData.product);
        if (!selectedProductExists) {
            // Khi đổi kho, product cũ có thể không còn sẵn sàng ở kho mới.
            setFormData((prev) => ({
                ...prev,
                product: '',
                machineCode: '',
                quantity: '',
                quantityApproved: '',
            }));
            setAvailableMachineCodes([]);
            return;
        }

        setAvailableMachineCodes(
            (products.find((p) => p.value === formData.product)?.serials || []).filter(Boolean)
        );
    };

    const handlePrint = (type = 'DNXM') => {
        setPrintType(type);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handleSave = async () => {
        if (!formData.customerName) {
            toast.error('Vui lòng điền tên khách hàng');
            return;
        }

        const orderCode = formData.orangeNumber ? `DNXM-${formData.orangeNumber}` : `DNXM-${Date.now().toString().slice(-6)}`;
        
        // Checking for duplicate order_code only for NEW orders
        if (!editOrderId) {
            const { data: existing } = await supabase.from('orders').select('id').eq('order_code', orderCode).maybeSingle();
            if (existing) {
                toast.error(`Mã phiếu ${orderCode} đã tồn tại trong hệ thống!`);
                return;
            }
        }

        setIsSaving(true);
        try {
            // Determine machine types
            const selectedMachineTypes = Object.entries(formData.machineType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type);
            
            // For DB product_type constraint, use a single value
            const dbProductType = selectedMachineTypes.length === 1 
                ? selectedMachineTypes[0] 
                : 'MAY';

            const selectedColors = Object.entries(formData.machineColor)
                .filter(([_, checked]) => checked)
                .map(([color]) => color)
                .join(', ');

            const issueTypesList = Object.entries(formData.issueType)
                .filter(([_, checked]) => checked)
                .map(([type]) => type)
                .join(', ');
            const isSaleIssue = !!formData.issueType['Bán'];

            const shippingList = Object.entries(formData.shippingMethod)
                .filter(([_, checked]) => checked)
                .map(([m]) => m)
                .join(', ');

            // Map ĐNXM fields to orders table
            const safeMachineCode = canEditMachineCode ? formData.machineCode : '';
            const safeQuantityApproved = canEditApprovedQuantity ? formData.quantityApproved : '';
            const warehouseCodeForOrder = sanitizeWarehouseForOrder(formData.warehouse);

            if (formData.warehouse && !warehouseCodeForOrder) {
                throw new Error(`Kho không hợp lệ cho đơn hàng: "${formData.warehouse}". Vui lòng chọn lại kho từ danh sách.`);
            }

            const orderData = {
                order_code: formData.orangeNumber || `DNXM-${Date.now().toString().slice(-6)}`,
                customer_name: formData.customerName,
                recipient_name: formData.facilityName || formData.customerName, // Required NOT NULL
                recipient_address: formData.placementAddress || 'N/A', // Required NOT NULL
                recipient_phone: formData.phone || 'N/A', // Required NOT NULL
                product_type: dbProductType,
                quantity: parseInt(formData.quantity) || 1,
                unit_price: 0, // Required NOT NULL
                total_amount: 0, // Required NOT NULL
                order_type: 'DNXM',
                warehouse: warehouseCodeForOrder,
                note: `Loại máy: ${selectedMachineTypes.join(', ')}. 
Sản phẩm: ${formData.product || ''}.
Hình thức: ${issueTypesList || 'Chưa chọn'}.
Màu máy: ${selectedColors}. 
Ngày cần: ${ymdToDmy(formData.dateNeeded)}. 
Giao: ${ymdToDmy(formData.dateDelivery)}. 
${isSaleIssue ? '' : `Thu hồi dự kiến: ${ymdToDmy(formData.dateRecall)}. 
Thu hồi thực tế: ${ymdToDmy(formData.dateRecallActual)}.
`}
Phụ trách máy: ${formData.machineManager}. 
PT Vận chuyển: ${shippingList}. 
Kho: ${warehouseCodeForOrder || ''}.
Mã máy: ${safeMachineCode}. 
SL phê duyệt: ${safeQuantityApproved || ''}.
Ghi chú: ${formData.notes}`,
                ordered_by: formData.requesterName || currentActorName,
                customer_category: 'TM'
            };

            if (editOrderId) {
                const { error } = await supabase
                    .from('orders')
                    .update({ ...orderData, updated_at: new Date().toISOString() })
                    .eq('id', editOrderId);
                if (error) throw error;
                
                notificationService.add({
                    title: `📝 Cập nhật ĐNXM: ${orderData.customer_name}`,
                    description: `${currentActorName} vừa cập nhật thông tin phiếu ĐNXM${formData.orangeNumber ? ' ' + formData.orangeNumber : ''} - KH: ${orderData.customer_name}`,
                    type: 'info',
                    link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
                });

                if (formData.status === 'DA_DUYET') {
                    await assignMachinesToCustomer(formData.machineCode, formData.customerName);
                }

                toast.success('Đã cập nhật Phiếu Đề Nghị Xuất Máy thành công!');
                setTimeout(() => navigate('/de-nghi-xuat-may'), 1000);
            } else {
                orderData.status = 'CHO_DUYET';
                orderData.created_at = new Date().toISOString();
                const { data: insertedData, error } = await supabase
                    .from('orders')
                    .insert([orderData])
                    .select('id')
                    .single();
                if (error) throw error;
                
                const newOrderId = insertedData?.id;

                notificationService.add({
                    title: `💡 ĐNXM mới: ${orderData.customer_name}`,
                    description: `${currentActorName} vừa lập phiếu đề nghị xuất máy mới.`,
                    type: 'info',
                    link: newOrderId ? `/de-nghi-xuat-may/tao?orderId=${newOrderId}&viewOnly=true` : '/de-nghi-xuat-may'
                });
                toast.success('Đã được lưu vào hệ thống!');
                setTimeout(() => navigate('/de-nghi-xuat-may'), 1000);
            }
        } catch (error) {
            console.error('Error saving DNXM:', error);
            toast.error('Lỗi khi lưu phiếu: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-assign machines to customer when warehouse approves
    const assignMachinesToCustomer = async (machineCodes, customerName) => {
        if (!machineCodes) return;
        const codes = machineCodes.split(',').map(c => c.trim()).filter(Boolean);
        if (codes.length === 0) return;

        for (const code of codes) {
            const { error } = await supabase
                .from('machines')
                .update({
                    status: 'thuộc khách hàng',
                    customer_name: customerName,
                    warehouse: null
                })
                .eq('serial_number', code);
            if (error) console.error(`Lỗi gán máy ${code}:`, error);
        }
    };

    const handleApproveStatus = async () => {
        if (!formData.status) return;
        let nextStatus = '';
        let confirmMsg = '';
        let successMsg = '';
        let notifTitle = '';
        let notifDesc = '';

        switch (formData.status) {
            case 'CHO_DUYET':
                nextStatus = 'CHO_CTY_DUYET';
                confirmMsg = 'Leader Duyệt (1/3): Chuyển phiếu cho Công ty duyệt?';
                successMsg = 'Leader đã duyệt → Chờ Công ty duyệt';
                notifTitle = '✅ Leader đã duyệt ĐNXM';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} → Chờ Công ty duyệt`;
                break;
            case 'CHO_CTY_DUYET':
                nextStatus = 'KHO_XU_LY';
                confirmMsg = 'Công ty Duyệt (2/3): Chuyển phiếu cho Kho xử lý?';
                successMsg = 'Công ty đã duyệt → Chờ Kho duyệt';
                notifTitle = '✅ Công ty đã duyệt ĐNXM';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} → Chờ Kho xử lý`;
                break;
            case 'KHO_XU_LY':
                nextStatus = 'DA_DUYET';
                confirmMsg = 'Kho Duyệt (3/3): Xác nhận xuất máy cho khách hàng?';
                successMsg = 'Kho đã duyệt xuất máy thành công!';
                notifTitle = '🏭 Kho đã duyệt xuất máy';
                notifDesc = `Phiếu ĐNXM${formData.orangeNumber || ''} hoàn tất. Máy đã giao cho ${formData.customerName}`;
                break;
            default:
                toast.info('Phiếu đã xử lý, không thể duyệt tiếp.');
                return;
        }

        if (!window.confirm(confirmMsg)) return;

        // Specially Handle level 2 -> 3: Assign Warehouse — Show a proper modal instead of window.prompt
        if (formData.status === 'CHO_CTY_DUYET') {
            // Fetch with code so we can store the short code (HN/TP.HCM/TH/DN) into orders.warehouse
            const { data: whs } = await supabase.from('warehouses').select('id, name, code').order('name');
            if (whs && whs.length > 0) {
                setWarehouseList(whs);
                setPendingNextStatus(nextStatus);
                setPendingApproveData({ nextStatus, successMsg, notifTitle, notifDesc });
                setShowWarehouseModal(true);
                return; // Will resume in handleWarehouseSelected
            }
        }

        await executeApprove({ nextStatus, successMsg, notifTitle, notifDesc, assignedWarehouse: formData.warehouse });
    };

    // whValue is the warehouses.code (e.g. 'HN') — NOT the display name
    const handleWarehouseSelected = async (whValue) => {
        setShowWarehouseModal(false);
        if (!whValue || !pendingApproveData) return;
        await executeApprove({ ...pendingApproveData, assignedWarehouse: whValue });
        setPendingApproveData(null);
        setPendingNextStatus(null);
    };

    const executeApprove = async ({ nextStatus, successMsg, notifTitle, notifDesc, assignedWarehouse }) => {
        setIsSaving(true);
        try {
            const warehouseCodeForOrder = sanitizeWarehouseForOrder(assignedWarehouse);
            if (assignedWarehouse && !warehouseCodeForOrder) {
                throw new Error(`Kho không hợp lệ cho duyệt phiếu: "${assignedWarehouse}". Vui lòng chọn lại kho.`);
            }

            const { error } = await supabase.from('orders').update({
                status: nextStatus,
                warehouse: warehouseCodeForOrder,
                updated_at: new Date().toISOString()
            }).eq('id', editOrderId);

            if (error) throw error;

            // Khi Kho duyệt → tự động gán máy cho khách hàng
            if (nextStatus === 'DA_DUYET') {
                await assignMachinesToCustomer(formData.machineCode, formData.customerName);
            }
            
            setFormData(prev => ({ ...prev, status: nextStatus, warehouse: warehouseCodeForOrder || prev.warehouse }));
            toast.success(successMsg);
            
            notificationService.add({
                title: notifTitle,
                description: `${notifDesc} • Thực hiện bởi: ${currentActorName}`,
                type: 'success',
                link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
            });
        } catch (error) {
            toast.error('Lỗi khi duyệt: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRejectStatus = async () => {
        if (!window.confirm('Bạn có thực sự muốn TỪ CHỐI phiếu đề nghị xuất máy này?')) return;
        
        setIsSaving(true);
        try {
            const { error } = await supabase.from('orders').update({
                status: 'TU_CHOI',
                updated_at: new Date().toISOString()
            }).eq('id', editOrderId);

            if (error) throw error;
            
            setFormData(prev => ({ ...prev, status: 'TU_CHOI' }));
            toast.error('Đã từ chối phiếu đề xuất.');

            notificationService.add({
                title: `❌ ĐNXM bị từ chối`,
                description: `Phiếu ĐNXM${formData.orangeNumber || ''} - KH: ${formData.customerName} đã bị từ chối • Thực hiện bởi: ${currentActorName}.`,
                type: 'warning',
                link: `/de-nghi-xuat-may/tao?orderId=${editOrderId}&viewOnly=true`
            });
        } catch (error) {
            toast.error('Lỗi khi từ chối: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const isSaleIssueSelected = !!formData.issueType['Bán'];
    const selectedMachineCodes = parseMachineCodes(formData.machineCode);
    const approvedQtyLimit = Number.parseInt(formData.quantityApproved || '0', 10);
    const maxSelectableCodes = Number.isFinite(approvedQtyLimit) && approvedQtyLimit > 0 ? approvedQtyLimit : null;

    return (
        <>
            {/* DATA ENTRY FORM (MÀN HÌNH CHUẨN) */}
            <div className={clsx("max-w-4xl mx-auto mb-10 print:hidden space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", isReadOnly ? "hidden" : "block")}>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm p-4 md:p-6 pb-24">
                    <h2 className="text-xl font-bold text-foreground mb-6 pb-4 border-b border-border">Nhập thông tin Đề Nghị Xuất Máy</h2>

                    <div className="space-y-6">
                        {/* Orange/Form Number */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Số Order (Ô cam)</label>
                                <input
                                    type="text"
                                    value={formData.orangeNumber}
                                    readOnly={isReadOnly}
                                    onChange={(e) => handleInputChange('orangeNumber', e.target.value)}
                                    className={clsx("w-full px-4 py-2 border rounded-lg focus:outline-none transition-all", isReadOnly ? "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed italic font-normal" : "bg-background border-border focus:ring-2 focus:ring-primary/20")}
                                    placeholder="Điền số thứ tự"
                                />
                            </div>
                        </div>

                        {/* Người phụ trách */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Người đề nghị</label>
                                <select
                                    value={formData.requesterName}
                                    onChange={(e) => handleInputChange('requesterName', e.target.value)}
                                    className="w-full h-10 px-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-semibold"
                                >
                                    <option value="">-- Chọn Người đề nghị --</option>
                                    {staffList.map(u => (
                                        <option key={u.id} value={u.name}>
                                            {u.name}{u.role ? ` (${u.role})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Nhân viên phụ trách máy</label>
                                <Combobox
                                    options={staffList.map((u) => u.name)}
                                    value={formData.machineManager}
                                    onChange={(v) => handleInputChange('machineManager', v)}
                                    placeholder="Gõ hoặc chọn nhân viên phụ trách máy..."
                                    emptyMessage="Không khớp — hãy gõ để tìm kiếm"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Thông tin Khách hàng */}
                        <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                Thông tin khách hàng
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Số điện thoại (Nhập để tự điền)</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => handleInputChange('phone', e.target.value)}
                                            className={clsx(
                                                "w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20",
                                                isSearching ? "pr-10" : ""
                                            )}
                                        />
                                        {isSearching && <span className="absolute right-3 top-2.5 w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Tên khách hàng / Tên cơ sở</label>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        onChange={(e) => handleInputChange('customerName', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Tên cơ sở</label>
                                    <input
                                        type="text"
                                        value={formData.facilityName}
                                        onFocus={() => facilities.length > 0 && setIsFacilityDropdownOpen(true)}
                                        onChange={(e) => handleInputChange('facilityName', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    {isFacilityDropdownOpen && facilities.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                                            <div className="p-2 border-b border-primary/10 bg-primary/5 text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Warehouse size={12} /> Chọn cơ sở tương ứng
                                                </div>
                                                <button onClick={() => setIsFacilityDropdownOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {facilities.map(f => (
                                                    <div
                                                        key={f.id}
                                                        className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
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
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-foreground mb-1.5">Địa chỉ đặt máy</label>
                                    <input
                                        type="text"
                                        value={formData.placementAddress}
                                        onChange={(e) => handleInputChange('placementAddress', e.target.value)}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phân loại và Yêu cầu */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Checkbox Groups */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Loại máy đề xuất</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.keys(formData.machineType).map(type => (
                                            <label key={type} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="radio"
                                                    name="machineType"
                                                    checked={formData.machineType[type]}
                                                    onChange={() => handleCheckboxChange('machineType', type)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{type === 'Khac' ? 'Khác (NK, IoT)' : type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Dạng xuất</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {Object.keys(formData.issueType).map(type => (
                                            <label key={type} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.issueType[type]}
                                                    onChange={() => handleCheckboxChange('issueType', type)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Phương thức vận chuyển</label>
                                    <div className="flex flex-col gap-3">
                                        {Object.keys(formData.shippingMethod).map(method => (
                                            <label key={method} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="radio"
                                                    name="shippingMethod"
                                                    checked={formData.shippingMethod[method]}
                                                    onChange={() => handleCheckboxChange('shippingMethod', method)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{method}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-3">Màu máy yêu cầu dành cho TM</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {Object.keys(formData.machineColor).map(color => (
                                            <label key={color} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted transition-colors border border-transparent hover:border-border">
                                                <input
                                                    type="radio"
                                                    name="machineColor"
                                                    checked={formData.machineColor[color]}
                                                    onChange={() => handleCheckboxChange('machineColor', color)}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                />
                                                <span className="text-sm">{color}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                            <label className="block text-sm font-medium text-foreground mb-1.5">Kho</label>
                                        <select
                                            value={formData.warehouse}
                                            onChange={(e) => handleInputChange('warehouse', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        >
                                            <option value="">-- Chọn kho --</option>
                                            {warehouseList.map((wh) => {
                                                // Use code (HN/TP.HCM/TH/DN) as value so it matches orders.warehouse constraint
                                                const whValue = wh.code || wh.name;
                                                return (
                                                    <option key={wh.id} value={whValue}>
                                                        {wh.name}{wh.code ? ` (${wh.code})` : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Sản phẩm (sẵn sàng trong kho)</label>
                                        <select
                                            value={formData.product}
                                            onChange={(e) => handleInputChange('product', e.target.value)}
                                            disabled={!formData.warehouse}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                                        >
                                            <option value="">-- Chọn sản phẩm --</option>
                                            {availableProducts.map((product) => (
                                                <option key={product.value} value={product.value}>{product.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Số lượng yêu cầu</label>
                                        <input
                                            type="text"
                                            value={formData.quantity}
                                            onChange={(e) => handleInputChange('quantity', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    {!isSalesRole && (
                                        <div>
                                            <label className="block text-sm font-medium text-foreground mb-1.5">Số lượng phê duyệt</label>
                                            <input
                                                type="text"
                                                value={formData.quantityApproved}
                                                readOnly={!canEditApprovedQuantity}
                                                onChange={(e) => handleInputChange('quantityApproved', e.target.value)}
                                                placeholder={canEditApprovedQuantity ? "Nhập số lượng phê duyệt" : "NVKD không có quyền nhập"}
                                                className={clsx(
                                                    "w-full px-4 py-2 border rounded-lg focus:outline-none transition-all",
                                                    canEditApprovedQuantity
                                                        ? "bg-background border-border focus:ring-2 focus:ring-primary/20"
                                                        : "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed italic font-normal"
                                                )}
                                            />
                                        </div>
                                    )}
                                    {!isSalesRole && (
                                        <div className="md:col-span-2">
                                            <label className={clsx(
                                                "block text-sm font-medium mb-1.5",
                                                canEditMachineCode ? "text-foreground" : "text-muted-foreground"
                                            )}>
                                                Mã máy {!canEditMachineCode && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded ml-1 text-muted-foreground font-normal">(Chỉ Admin/Kho)</span>}
                                            </label>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-[12px] font-bold text-slate-600">
                                                        Đã chọn: {selectedMachineCodes.length}{maxSelectableCodes ? ` / ${maxSelectableCodes}` : ''}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={!canEditMachineCode}
                                                        onClick={() => setIsMachineCodePickerOpen((v) => !v)}
                                                        className={clsx(
                                                            "px-3 py-1.5 rounded-xl border text-[12px] font-bold transition-all",
                                                            canEditMachineCode
                                                                ? "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                                                                : "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed"
                                                        )}
                                                    >
                                                        {isMachineCodePickerOpen ? 'Đóng danh sách' : 'Chọn từ máy sẵn sàng'}
                                                    </button>
                                                </div>

                                                <input
                                                    type="text"
                                                    value={formData.machineCode}
                                                    readOnly
                                                    placeholder={canEditMachineCode ? "Chọn tickbox để lấy mã máy (phân cách bởi dấu phẩy)" : "Chưa được gán mã"}
                                                    className={clsx(
                                                        "w-full px-4 py-2 border rounded-lg focus:outline-none transition-all",
                                                        canEditMachineCode
                                                            ? "bg-background border-border focus:ring-2 focus:ring-primary/20"
                                                            : "bg-muted/50 border-border/50 text-muted-foreground cursor-not-allowed italic font-normal"
                                                    )}
                                                />

                                                {isMachineCodePickerOpen && canEditMachineCode && (
                                                    <div className="bg-white border border-slate-200 rounded-xl p-3">
                                                        {availableMachineCodes.length === 0 ? (
                                                            <div className="text-[12px] text-muted-foreground italic">
                                                                Không có mã máy <b>sẵn sàng</b> trong kho này.
                                                            </div>
                                                        ) : (
                                                            <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2">
                                                                {availableMachineCodes.map((serial) => {
                                                                    const checked = selectedMachineCodes.includes(serial);
                                                                    return (
                                                                        <label
                                                                            key={serial}
                                                                            className={clsx(
                                                                                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                                                                                checked
                                                                                    ? "bg-emerald-50 border-emerald-200"
                                                                                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                                                            )}
                                                                        >
                                                                            <span className="flex items-center gap-2 min-w-0">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={checked}
                                                                                    disabled={!checked && !!maxSelectableCodes && selectedMachineCodes.length >= maxSelectableCodes}
                                                                                    onChange={(e) => {
                                                                                        const nextChecked = e.target.checked;
                                                                                        if (nextChecked && maxSelectableCodes && selectedMachineCodes.length >= maxSelectableCodes) {
                                                                                            toast.warning(`Chỉ được gán tối đa ${maxSelectableCodes} mã máy theo SL phê duyệt.`);
                                                                                            return;
                                                                                        }
                                                                                        const nextArr = nextChecked
                                                                                            ? [...new Set([...selectedMachineCodes, serial])]
                                                                                            : selectedMachineCodes.filter((s) => s !== serial);
                                                                                        handleInputChange('machineCode', nextArr.join(', '));
                                                                                    }}
                                                                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer"
                                                                                />
                                                                                <span className="font-mono font-bold text-[12px] text-slate-800 truncate">
                                                                                    {serial}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                                                sẵn sàng
                                                                            </span>
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Ngày tháng */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày Khách hàng cần</label>
                                <input
                                    type="date"
                                    value={formData.dateNeeded}
                                    onChange={(e) => handleInputChange('dateNeeded', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Ngày giao</label>
                                <input
                                    type="date"
                                    value={formData.dateDelivery}
                                    onChange={(e) => handleInputChange('dateDelivery', e.target.value)}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            {!isSaleIssueSelected && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Ngày thu hồi dự kiến</label>
                                        <input
                                            type="date"
                                            value={formData.dateRecall}
                                            onChange={(e) => handleInputChange('dateRecall', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1.5">Ngày thu hồi thực tế</label>
                                        <input
                                            type="date"
                                            value={formData.dateRecallActual}
                                            onChange={(e) => handleInputChange('dateRecallActual', e.target.value)}
                                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Ghi chú */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">Ghi chú khác (nếu có)</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                rows="3"
                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Print Action / Inline button */}
                {/* ACTION BUTTONS */}
                {!isReadOnly && (
                    <div className="no-print mt-8 px-4 flex flex-wrap justify-center gap-4 w-full z-10 md:justify-end md:px-0">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center justify-center gap-2 bg-slate-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-slate-700 transition-all font-bold text-sm"
                        >
                            {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showPreview ? 'QUAY LẠI NHẬP LIỆU' : 'XEM TRƯỚC VĂN BẢN'}
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all font-bold text-sm disabled:opacity-50"
                        >
                            {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                            {editOrderId ? 'CẬP NHẬT PHIẾU' : 'LƯU HỆ THỐNG'}
                        </button>
                    </div>
                )}
            </div>

            {isReadOnly && (
                <div className="no-print max-w-[210mm] mx-auto flex flex-wrap justify-end gap-4 print:hidden mb-6">
                    {(() => {
                        const isLevel1 = formData.status === 'CHO_DUYET';
                        const isLevel2 = formData.status === 'CHO_CTY_DUYET';
                        const isLevel3 = formData.status === 'KHO_XU_LY';

                        const r = role?.toLowerCase() || '';
                        let canApprove = false;
                        if (isAdminRole) canApprove = true;
                        else if (isLevel1 && (r.includes('lead') || r.includes('trưởng'))) canApprove = true;
                        else if (isLevel2 && isAdminRole) canApprove = true;
                        else if (isLevel3 && (r.includes('kho'))) canApprove = true;

                        const canEdit = ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY', 'DA_DUYET'].includes(formData.status);

                        return (
                            <div className="flex flex-wrap gap-2">
                                {/* Nút Chỉnh sửa - hiện ở mọi bước chưa hoàn tất */}
                                {canEdit && (
                                    <button
                                        onClick={() => {
                                            setIsReadOnly(false);
                                            setShowPreview(false);
                                        }}
                                        className="flex items-center justify-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-amber-600 transition-all font-bold text-sm"
                                    >
                                        <Edit size={18} />
                                        CHỈNH SỬA
                                    </button>
                                )}

                                {/* Nút Duyệt - chỉ hiện nếu user có quyền */}
                                {canApprove && ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY'].includes(formData.status) && (
                                    <button
                                        onClick={handleApproveStatus}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all font-bold text-sm disabled:opacity-50"
                                    >
                                        {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                                        DUYỆT PHIẾU ({
                                            formData.status === 'CHO_DUYET' ? '1/3 - Leader' :
                                            formData.status === 'CHO_CTY_DUYET' ? '2/3 - Công ty' : '3/3 - Kho'
                                        })
                                    </button>
                                )}

                                {/* Nút Từ chối */}
                                {canApprove && ['CHO_DUYET', 'CHO_CTY_DUYET', 'KHO_XU_LY'].includes(formData.status) && (
                                    <button
                                        onClick={handleRejectStatus}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-rose-700 transition-all font-bold text-sm disabled:opacity-50"
                                    >
                                        {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <EyeOff size={18} />}
                                        TỪ CHỐI
                                    </button>
                                )}
                            </div>
                        );
                    })()}

                    {/* Kho xử lý panel - hiện khi thủ kho đang xử lý */}
                    {formData.status === 'KHO_XU_LY' && (isWarehouseRole || isAdminRole) && (
                        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-2 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 mb-3">
                                <Warehouse size={18} className="text-amber-700" />
                                <h3 className="font-bold text-amber-800 text-sm uppercase tracking-wide">Kho Xử Lý — Gán Mã Máy Trước Khi Xuất</h3>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">Nhập mã serial máy (cách nhau dấu phẩy), sau đó in Biên Bản Bàn Giao và Phiếu Xuất Kho trước khi nhấn Duyệt.</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrint('BBBG')}
                                    className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow hover:bg-emerald-700 transition-all font-bold text-xs"
                                >
                                    <Printer size={15} /> IN BBBG
                                </button>
                                <button
                                    onClick={() => handlePrint('XK')}
                                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow hover:bg-indigo-700 transition-all font-bold text-xs"
                                >
                                    <Printer size={15} /> IN PHIẾU XUẤT KHO
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handlePrint('DNXM')}
                            className="flex items-center justify-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-slate-600/30 hover:bg-slate-800 transition-all font-bold text-sm transform active:scale-[0.98]"
                        >
                            <Printer size={18} />
                            IN PHIẾU DNXM
                        </button>
                        {formData.status === 'DA_DUYET' || !['KHO_XU_LY', 'CHO_DUYET', 'CHO_CTY_DUYET'].includes(formData.status) ? (
                            <>
                                <button
                                    onClick={() => handlePrint('BBBG')}
                                    className="flex items-center justify-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-800 transition-all font-bold text-sm transform active:scale-[0.98]"
                                >
                                    <Printer size={18} />
                                    IN BIÊN BẢN BÀN GIAO
                                </button>
                                <button
                                    onClick={() => handlePrint('XK')}
                                    className="flex items-center justify-center gap-2 bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-800 transition-all font-bold text-sm transform active:scale-[0.98]"
                                >
                                    <Printer size={18} />
                                    IN PHIẾU XUẤT KHO
                                </button>
                            </>
                        ) : null}
                    </div>

                    {onClosePopup ? (
                        <button
                            onClick={onClosePopup}
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 px-6 py-3 rounded-xl shadow-lg hover:bg-slate-300 transition-all font-bold text-sm"
                        >
                            ĐÓNG PHIẾU
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/machines')}
                            className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 px-6 py-3 rounded-xl shadow-lg hover:bg-slate-300 transition-all font-bold text-sm"
                        >
                            THOÁT
                        </button>
                    )}
                </div>
            )}

            {/* Warehouse Selection Modal */}
            {showWarehouseModal && (
                <div className="fixed inset-0 z-[200000] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-300">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">Chọn Kho Xuất Hàng</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Bước 2/3 — Công ty duyệt</p>
                            </div>
                            <button onClick={() => { setShowWarehouseModal(false); setPendingApproveData(null); }} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {warehouseList.map(wh => {
                                // Use code (HN/TP.HCM/TH/DN) — must match orders.warehouse CHECK constraint
                                const whCode = wh.code || wh.name;
                                return (
                                    <button
                                        key={wh.id}
                                        onClick={() => handleWarehouseSelected(whCode)}
                                        className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border border-slate-200 hover:border-primary hover:bg-primary/5 transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 bg-slate-100 group-hover:bg-primary/10 rounded-xl flex items-center justify-center shrink-0 transition-colors">
                                            <Warehouse size={20} className="text-slate-500 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-[14px] text-slate-800 group-hover:text-primary transition-colors">{wh.name}</p>
                                            {wh.code && <p className="text-xs text-slate-400 mt-0.5">Mã kho: {wh.code}</p>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* PRINT VIEW (HIỆN KHI ẤN IN HOẶC KHI BẬT PREVIEW) */}
            <div className={clsx(
                "print:block bg-white mx-auto",
                showPreview ? "block" : "hidden"
            )}>
                {/* Switch between different print templates based on printType */}
                {printType === 'DNXM' && (
                    <div id="print-area" className="text-black p-8 bg-white max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl my-10" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* Header section */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="text-sm text-center">
                                <h2 className="font-bold text-blue-800 uppercase print:text-black">CÔNG TY TNHH DỊCH VỤ Y TẾ CỘNG ĐỒNG CHS</h2>
                                <p>Hải Âu 02-57 Vinhomes Ocean Park,</p>
                                <p>Xã Gia Lâm, TP Hà Nội</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm">Mẫu số: 02/XM-CHS</span>
                                    <span className="italic text-sm">Đề nghị xuất máy</span>
                                </div>
                                <input
                                    type="text"
                                    value={formData.orangeNumber}
                                    readOnly
                                    className="bg-orange-400 font-bold px-2 py-1 border border-black w-20 text-center focus:outline-none focus:bg-orange-300 print:bg-transparent print:border-black"
                                />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-6">
                            <h1 className="text-xl font-bold uppercase mb-2">GIẤY ĐỀ NGHỊ XUẤT MÁY</h1>
                            <div className="text-center">
                                <span>Số: ĐNXM{formData.orangeNumber || ''}</span>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4 text-[15px] leading-relaxed">
                            <div className="flex items-center">
                                <span className="min-w-[200px]">1. Họ và tên người đề nghị:</span>
                                <input
                                    type="text"
                                    value={formData.requesterName}
                                    readOnly
                                    className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                    placeholder=""
                                />
                            </div>

                            <div className="flex items-center">
                                <span className="min-w-[200px]">2. Nhân viên phụ trách máy:</span>
                                <input
                                    type="text"
                                    value={formData.machineManager}
                                    readOnly
                                    className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                    placeholder=""
                                />
                            </div>

                            <div className="flex items-start md:items-center print:items-center flex-col md:flex-row print:flex-row gap-6 md:gap-0">
                                <div className="flex items-center flex-1 w-full">
                                    <span className="min-w-[200px]">3. Tên khách hàng / Tên cơ sở:</span>
                                    <input
                                        type="text"
                                        value={formData.customerName}
                                        readOnly
                                        className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                        placeholder=""
                                    />
                                </div>
                                <div className="flex items-center w-full md:w-auto print:w-auto md:ml-4 print:ml-4">
                                    <span className="whitespace-nowrap mr-2">Điện Thoại:</span>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            readOnly
                                            className="focus:outline-none px-2 py-1 w-40 bg-transparent print:border-none print:p-0 print:-ml-2"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center">
                                <span className="min-w-[200px]">4. Tên Cơ Sở:</span>
                                <input
                                    type="text"
                                    value={formData.facilityName}
                                    readOnly
                                    className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                    placeholder=""
                                />
                            </div>

                            <div className="flex items-center">
                                <span className="min-w-[200px]">5. Địa chỉ đặt máy:</span>
                                <input
                                    type="text"
                                    value={formData.placementAddress}
                                    readOnly
                                    className="flex-1 focus:outline-none px-2 bg-transparent print:border-none text-red-700 print:text-black"
                                    placeholder=""
                                />
                            </div>

                            {/* Machine Type */}
                            <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-6">
                                <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">6. Loại máy đề xuất:</span>
                                <div className="flex flex-wrap gap-6 flex-1 items-center">
                                    {Object.keys(formData.machineType).map(type => (
                                        <label key={type} className="flex items-center gap-6 cursor-default">
                                            <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.machineType[type] ? 'bg-gray-100' : ''}`}>
                                                {formData.machineType[type] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                            </div>
                                            <span className="font-medium">{type === 'Khac' ? 'Khác (NK, IoT)' : type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Machine Color */}
                            <div className="mt-6 mb-2">
                                <span className="block mb-2 font-bold">7. Màu máy yêu cầu dành cho TM</span>
                                <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-y-1 gap-x-4 pl-8 md:pl-24 print:pl-24">
                                    {Object.keys(formData.machineColor).map(color => (
                                        <label key={color} className="flex items-center gap-6 cursor-default">
                                            <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center shrink-0 bg-white ${formData.machineColor[color] ? 'bg-gray-100' : ''}`}>
                                                {formData.machineColor[color] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                            </div>
                                            <span>{color}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Quantity and Code */}
                            <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center gap-6 mt-4">
                                <div className="flex items-center">
                                    <span className="mr-2">8. Số lượng máy:</span>
                                    <div className="flex gap-4">
                                        <div className="flex items-center">
                                            <span className="text-xs mr-1 italic text-slate-400">Y/c cầu:</span>
                                            <span className="font-bold">{formData.quantity || 0}</span>
                                        </div>
                                        {formData.quantityApproved && (
                                            <div className="flex items-center bg-blue-50 px-2 rounded">
                                                <span className="text-xs mr-1 italic text-blue-500">Duyệt:</span>
                                                <span className="font-bold text-blue-700">{formData.quantityApproved}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center flex-1">
                                    <span className="mr-2">Mã máy:</span>
                                    <input
                                        type="text"
                                        value={formData.machineCode}
                                        readOnly
                                        className="flex-1 focus:outline-none px-2 bg-transparent print:border-none print:p-0 font-bold"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="flex items-center mt-4">
                                <span className="min-w-[200px]">9. Ngày Khách hàng cần:</span>
                                <input
                                    type="text"
                                    value={ymdToDmy(formData.dateNeeded)}
                                    readOnly
                                    className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0"
                                    placeholder="dd/MM/yyyy"
                                />
                            </div>

                            <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center gap-6 mt-4">
                                <div className="flex items-center">
                                    <span className="min-w-[200px]">10. Ngày giao cho Khách hàng:</span>
                                    <input
                                        type="text"
                                        value={ymdToDmy(formData.dateDelivery)}
                                        readOnly
                                        className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0"
                                        placeholder="dd/MM/yyyy"
                                    />
                                </div>
                                {!isSaleIssueSelected && (
                                    <div className="flex items-center">
                                        <span className="mr-2">11. Thời gian thu hồi dự kiến:</span>
                                        <input
                                            type="text"
                                            value={ymdToDmy(formData.dateRecall)}
                                            readOnly
                                            className="focus:outline-none w-32 px-2 bg-transparent print:border-none print:p-0 font-bold"
                                            placeholder="dd/MM/yyyy"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Shipping Method */}
                            <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                                <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">12. Phương thức vận chuyển:</span>
                                <div className="flex gap-10">
                                    {Object.keys(formData.shippingMethod).map(method => (
                                        <label key={method} className="flex items-center gap-6 cursor-default">
                                            <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.shippingMethod[method] ? 'bg-gray-100' : ''}`}>
                                                {formData.shippingMethod[method] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                            </div>
                                            <span>{method}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Issue Type */}
                            <div className="flex flex-col md:flex-row print:flex-row md:items-center print:items-center mt-4">
                                <span className="min-w-[200px] mb-4 md:mb-0 print:mb-0">13. Dạng xuất:</span>
                                <div className="flex flex-wrap gap-10">
                                    {Object.keys(formData.issueType).map(type => (
                                        <label key={type} className="flex items-center gap-6 cursor-default">
                                            <div className={`w-4 h-4 border border-gray-500 flex items-center justify-center bg-white ${formData.issueType[type] ? 'bg-gray-100' : ''}`}>
                                                {formData.issueType[type] && <span className="text-gray-800 text-xs font-bold font-sans">v</span>}
                                            </div>
                                            <span>{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="mt-6 flex flex-col">
                                <span className="mb-2">14. Ghi chú khác (nếu có):</span>
                                <div
                                    className="w-full border-b border-gray-400 min-h-[60px] bg-transparent px-1 py-1 whitespace-pre-wrap break-words leading-relaxed print:border-none print:min-h-0"
                                >
                                    {formData.notes || ''}
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="mt-8 grid grid-cols-3 gap-6 items-start">
                            <div className="text-center flex flex-col min-h-[120px]">
                                <p className="font-bold">Người đề nghị</p>
                                <div className="flex-1" />
                                <p className="italic text-red-700 print:text-black">{formData.requesterName || ''}</p>
                            </div>
                            <div className="text-center flex flex-col min-h-[120px]">
                                <p className="font-bold">Thủ kho</p>
                                <div className="flex-1" />
                                <p className="italic">&nbsp;</p>
                            </div>
                            <div className="text-center flex flex-col min-h-[120px]">
                                <p className="italic whitespace-nowrap">Hà Nội, ngày {currentDay} tháng {currentMonth} năm {currentYear}</p>
                                <p className="font-bold">Giám đốc</p>
                                <div className="flex-1" />
                                <p className="italic">Bùi Xuân Đức</p>
                            </div>
                        </div>

                        {/* Footer Notes */}
                        <div className="mt-10 text-[12px] italic leading-tight border-t border-gray-200 pt-4 opacity-70">
                            <p>Ghi chú :</p>
                            <p>• Thời gian bàn giao máy đối với màu mặc định là 10 ngày làm việc sau khi nhận được giấy ĐNXM</p>
                            <p>• Thời gian bàn giao máy đối với màu cá nhân hóa là 15 ngày làm việc sau khi nhận được giấy ĐNXM</p>
                            <p>• Đối với các trường hợp máy Demo/Thuê/Ngoại giao bắt buộc điền ngày thu hồi máy</p>
                        </div>
                    </div>
                )}

                {printType === 'BBBG' && (
                    <div className="max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl my-10 print:m-0 print:shadow-none bg-white">
                        <MachineHandoverPrintTemplate 
                            orders={{
                                ...formData,
                                customer_name: formData.customerName,
                                recipient_name: formData.facilityName,
                                recipient_address: formData.placementAddress,
                                recipient_phone: formData.phone,
                                product_type: Object.keys(formData.machineType).find(k => formData.machineType[k]) || 'MAY',
                                quantity: formData.quantity,
                                quantityApproved: formData.quantityApproved,
                                department: formData.machineCode,
                                created_at: new Date().toISOString()
                            }} 
                        />
                    </div>
                )}

                {printType === 'XK' && (
                    <div className="max-w-[210mm] mx-auto min-h-[297mm] shadow-2xl my-10 print:m-0 print:shadow-none bg-white">
                        <GoodsIssuePrintTemplate 
                            issue={{
                                issue_code: `XK-${formData.orangeNumber || Date.now().toString().slice(-6)}`,
                                issue_date: new Date().toISOString(),
                                issue_type: 'TRA_MAY',
                                warehouse_id: formData.warehouse || 'Kho tổng',
                                notes: formData.notes,
                                created_by: currentActorName
                            }}
                            supplierName={formData.customerName}
                            warehouseName={formData.warehouse}
                            items={[{
                                id: 1,
                                item_code: formData.machineCode || 'Chưa gán serial',
                                item_type: Object.keys(formData.machineType).find(k => formData.machineType[k]) || 'MÁY',
                                quantity: formData.quantityApproved || formData.quantity
                            }]}
                        />
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    #root { display: block !important; }
                    /* Reset parent layout containers that break print */
                    body, #root, .min-h-screen, .h-screen, .overflow-hidden, .overflow-y-auto, .noise-bg, main {
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        position: static !important;
                        display: block !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                    }
                    header, nav, aside, footer, .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; margin: 0; }
                    @page { margin: 0; size: A4 portrait; }
                    
                    #print-area {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 10mm 15mm !important;
                        background: white !important;
                        box-shadow: none !important;
                        display: block !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 13px !important;
                    }
                    
                    /* Fix flex containers for print — must remain row */
                    #print-area .flex {
                        display: flex !important;
                    }
                    #print-area .flex-col {
                        flex-direction: column !important;
                    }
                    #print-area .print\\:flex-row {
                        flex-direction: row !important;
                    }
                    #print-area .print\\:items-center {
                        align-items: center !important;
                    }
                    #print-area .print\\:grid-cols-3 {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }
                    
                    /* Fix inputs: remove browser default styling that causes misalignment */
                    #print-area input, #print-area textarea {
                        -webkit-appearance: none !important;
                        appearance: none !important;
                        background: transparent !important;
                        border: none !important;
                        border-bottom: 1px solid #666 !important;
                        outline: none !important;
                        padding: 0 4px !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 13px !important;
                        color: black !important;
                        display: inline-block !important;
                        vertical-align: baseline !important;
                        line-height: 1.4 !important;
                    }
                    /* Flex-1 inputs take full remaining width */
                    #print-area .flex-1 input,
                    #print-area input.flex-1 {
                        width: 100% !important;
                        flex: 1 !important;
                    }
                    /* Fixed-width date inputs */
                    #print-area input.w-32 {
                        width: 110px !important;
                        flex: none !important;
                    }
                    /* Orange number box */
                    #print-area input.w-20 {
                        width: 72px !important;
                        border: 1px solid black !important;
                        text-align: center !important;
                        background: transparent !important;
                    }
                    /* Textarea notes */
                    #print-area textarea {
                        width: 100% !important;
                        min-height: 0 !important;
                        border: none !important;
                        border-bottom: 1px solid #aaa !important;
                        resize: none !important;
                        overflow: visible !important;
                    }
                    
                    /* Checkboxes */
                    #print-area .w-4.h-4 {
                        width: 14px !important;
                        height: 14px !important;
                        border: 1px solid #555 !important;
                        display: inline-flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        background: white !important;
                        flex-shrink: 0 !important;
                    }

                    /* Hide mobile bottom bars just in case */
                    .fixed.bottom-0, [class*="bottom-navigation"] { display: none !important; }
                    
                    /* Tighter vertical spacing specifically for printing */
                    #print-area .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 5px !important; }
                    #print-area .mt-4 { margin-top: 5px !important; }
                    #print-area .mt-6 { margin-top: 7px !important; }
                    #print-area .mb-2 { margin-bottom: 2px !important; }
                    #print-area .mb-4 { margin-bottom: 4px !important; }
                    #print-area .mb-6 { margin-bottom: 10px !important; }
                    #print-area .pt-4 { padding-top: 6px !important; }
                    #print-area .pb-4 { padding-bottom: 6px !important; }
                    #print-area .gap-6, #print-area .gap-8, #print-area .gap-10 { gap: 8px !important; }
                    #print-area .gap-4 { gap: 6px !important; }
                    
                    /* Shrink big margins for signatures and footers to fit on 1 page */
                    #print-area .mb-16 { margin-bottom: 28px !important; }
                    #print-area .mt-10 { margin-top: 12px !important; }
                    #print-area .mt-8 { margin-top: 10px !important; }
                    #print-area .text-\\[15px\\] { font-size: 13px !important; }
                    
                    /* Tighter line height for text wrapping */
                    #print-area, #print-area div, #print-area span, #print-area p {
                        line-height: 1.35 !important;
                        color: black !important;
                    }
                    
                    /* Title styling */
                    #print-area h1 { font-size: 16px !important; }
                    #print-area h2 { font-size: 13px !important; }
                    
                    /* min-w constraints for label spans */
                    #print-area span.min-w-\\[200px\\] {
                        min-width: 190px !important;
                        display: inline-block !important;
                        flex-shrink: 0 !important;
                    }
                }
            `}} />
        </>
    );
};

export default MachineIssueRequestForm;
