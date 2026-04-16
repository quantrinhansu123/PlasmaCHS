import { clsx } from 'clsx';
import {
    Camera,
    CheckCircle2,
    Edit3,
    Hash,
    PackagePlus,
    Plus,
    Trash2,
    X,
    ChevronDown,
    Search,
    PenLine,
    Users,
    User,
    Calendar,
    Warehouse,
    FileText,
    Package,
    ScanLine,
    Search as SearchIcon
} from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import BarcodeScanner from '../Common/BarcodeScanner';
import { Combobox } from '../ui/Combobox';
import { ITEM_TYPES, ITEM_UNITS } from '../../constants/goodsReceiptConstants';
import {
    CYLINDER_STATUSES,
    MACHINE_STATUSES
} from '../../constants/machineConstants';
import { PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';

export default function GoodsReceiptFormModal({ receipt, onClose, onSuccess }) {
    const isEdit = !!receipt;
    const isReadOnly = receipt && receipt.status !== 'CHO_DUYET';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [scannerIndex, setScannerIndex] = useState(null);
    const [cylindersList, setCylindersList] = useState([]);
    const [machinesList, setMachinesList] = useState([]);
    const [deliverers, setDeliverers] = useState([]);
    const [activeSerialDropdown, setActiveSerialDropdown] = useState(null);
    const [isFetchingCyls, setIsFetchingCyls] = useState(false);
    const cylDropdownRef = useRef({});
    const [scanTarget, setScanTarget] = useState({ itemIdx: -1, serialIdx: -1 });
    const scanTargetRef = useRef({ itemIdx: -1, serialIdx: -1 });
    useEffect(() => { scanTargetRef.current = scanTarget; }, [scanTarget]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const emptyItem = {
        item_type: 'MAY',
        item_name: '',
        serial_number: '',
        assigned_serials: [{ serial: '', scan_time: null }],
        item_status: '',
        quantity: 1,
        unit: 'cái',
        unit_price: 0,
        total_price: 0,
        note: ''
    };

    const [formData, setFormData] = useState({
        receipt_code: '',
        supplier_name: '',
        warehouse_id: '',
        receipt_date: new Date().toISOString().split('T')[0],
        received_by: '',
        deliverer_name: '',
        deliverer_address: '',
        note: '',
        receipt_type: 'MAY' // Default to Machine
    });

    const [items, setItems] = useState([{ ...emptyItem, item_type: 'MAY' }]);

    // Auto-generate receipt code or load edit data
    useEffect(() => {
        if (isEdit) {
            setFormData({
                receipt_code: receipt.receipt_code,
                supplier_name: receipt.supplier_name,
                warehouse_id: receipt.warehouse_id,
                receipt_date: receipt.receipt_date ? receipt.receipt_date.split('T')[0] : new Date().toISOString().split('T')[0],
                received_by: receipt.received_by || '',
                deliverer_name: receipt.deliverer_name || '',
                deliverer_address: receipt.deliverer_address || '',
                note: receipt.note || ''
            });

            const fetchItems = async () => {
                const { data } = await supabase
                    .from('goods_receipt_items')
                    .select('*')
                    .eq('receipt_id', receipt.id);
                if (data && data.length > 0) {
                    setItems(data);
                    setFormData(prev => ({ ...prev, receipt_type: data[0].item_type }));
                }
            };
            fetchItems();
        } else {
            const generateCode = async () => {
                try {
                    const { data } = await supabase
                        .from('goods_receipts')
                        .select('receipt_code')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (data && data.length > 0 && data[0].receipt_code.startsWith('PN')) {
                        const numStr = data[0].receipt_code.replace(/[^0-9]/g, '');
                        const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                        setFormData(prev => ({ ...prev, receipt_code: `PN${nextNum.toString().padStart(5, '0')}` }));
                    } else {
                        setFormData(prev => ({ ...prev, receipt_code: 'PN00001' }));
                    }
                } catch {
                    setFormData(prev => ({ ...prev, receipt_code: `PN${Math.floor(10000 + Math.random() * 90000)}` }));
                }
            };
            generateCode();
        }
    }, [receipt, isEdit]);
    // Load suppliers and warehouses
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [suppliersRes, warehousesRes, cylindersRes, machinesRes] = await Promise.all([
                    supabase.from('suppliers').select('id, name').order('name'),
                    supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name'),
                    supabase.from('cylinders').select('serial_number').order('serial_number'),
                    supabase.from('machines').select('serial_number').order('serial_number')
                ]);

                if (suppliersRes.data) {
                    setSuppliers(suppliersRes.data);
                    if (!isEdit && suppliersRes.data.length > 0) {
                        setFormData(prev => !prev.supplier_name ? { ...prev, supplier_name: suppliersRes.data[0].name } : prev);
                    }
                }
                if (warehousesRes.data) {
                    setWarehousesList(warehousesRes.data);
                    if (!isEdit && warehousesRes.data.length > 0) {
                        setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: warehousesRes.data[0].id } : prev);
                    }
                }
                if (cylindersRes.data) setCylindersList(cylindersRes.data.map(c => c.serial_number));
                if (machinesRes.data) setMachinesList(machinesRes.data.map(m => m.serial_number));

                // Fetch deliverers (shippers + app_users with shipper role)
                const [{ data: shippersData }, { data: usersData }] = await Promise.all([
                    supabase.from('shippers').select('id, name').order('name'),
                    supabase.from('app_users').select('id, full_name').eq('role', 'shipper').order('full_name')
                ]);
                
                const combinedDeliverers = [
                    ...(shippersData || []).map(s => ({ id: `s_${s.id}`, name: s.name, type: 'SHIPPER_CO_DINH' })),
                    ...(usersData || []).map(u => ({ id: `u_${u.id}`, name: u.full_name, type: 'USER_SHIPPER' }))
                ];
                setDeliverers(combinedDeliverers);
            } catch (err) {
                console.error('Error fetching initial data:', err);
            }
        };
        loadInitialData();
    }, [isEdit]);

    const addItem = () => {
        setItems(prev => [...prev, { ...emptyItem, item_type: formData.receipt_type }]);
    };

    const removeItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
        setItems(prev => {
            const updated = [...prev];
            const updatedItem = { ...updated[index], [field]: value };
            
            // Sync serials array if quantity changes
            if (field === 'quantity') {
                const isSerialized = formData.receipt_type === 'BINH' || formData.receipt_type === 'MAY';
                const targetQty = parseInt(value, 10) || 0;
                
                if (isSerialized) {
                    let currentSerials = [...(updatedItem.assigned_serials || [])];
                    if (targetQty > currentSerials.length) {
                        for (let i = currentSerials.length; i < targetQty; i++) {
                            currentSerials.push({ serial: '', scan_time: null });
                        }
                    } else if (targetQty < currentSerials.length && targetQty >= 0) {
                        currentSerials = currentSerials.slice(0, targetQty);
                    }
                    updatedItem.assigned_serials = currentSerials;
                }
            }
            
            updated[index] = updatedItem;
            return updated;
        });
    };

    const handleQuantityBlur = (index) => {
        // No longer needed as updateItem handles sync immediately
    };

    const handleSerialChange = (itemIdx, serialIdx, value) => {
        const normalizedVal = value ? value.trim().toUpperCase() : '';
        setItems(prev => {
            const updated = [...prev];
            const item = { ...updated[itemIdx] };
            const newSerials = [...(item.assigned_serials || [])];
            const now = new Date();
            const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Check for duplicates
            let isDuplicate = false;
            updated.forEach((it, i) => {
                (it.assigned_serials || []).forEach((s, si) => {
                    if (i === itemIdx && si === serialIdx) return;
                    const val = (typeof s === 'string' ? s : s?.serial)?.trim().toUpperCase();
                    if (val === normalizedVal && normalizedVal !== '') isDuplicate = true;
                });
            });

            if (isDuplicate) {
                toast.warn(`Mã ${normalizedVal} đang bị trùng!`, { toastId: `dup-${normalizedVal}` });
            }

            const existing = newSerials[serialIdx] || {};
            newSerials[serialIdx] = {
                ...(typeof existing === 'string' ? { serial: existing } : existing),
                serial: normalizedVal,
                scan_time: normalizedVal ? (existing.scan_time || timeStr) : null
            };
            
            // Sync first serial to the legacy serial_number field for compatibility
            if (serialIdx === 0) item.serial_number = normalizedVal;

            item.assigned_serials = newSerials;
            updated[itemIdx] = item;
            return updated;
        });
    };

    const handleScanSuccess = useCallback((decodedText) => {
        const { itemIdx, serialIdx } = scanTargetRef.current;
        if (itemIdx === -1 || serialIdx === -1) {
            // Legacy single scan behavior
            if (scannerIndex !== null) {
                updateItem(scannerIndex, 'serial_number', decodedText);
                setScannerIndex(null);
            }
            return;
        }

        const normalizedText = decodedText.trim().toUpperCase();
        handleSerialChange(itemIdx, serialIdx, normalizedText);

        // Auto move to next empty
        setItems(prev => {
            const item = prev[itemIdx];
            const nextIdx = item.assigned_serials.findIndex((s, i) => i > serialIdx && !(typeof s === 'string' ? s : s?.serial));
            if (nextIdx !== -1) {
                setScanTarget({ itemIdx, serialIdx: nextIdx });
            } else {
                setScanTarget({ itemIdx: -1, serialIdx: -1 });
            }
            return prev;
        });
    }, [scannerIndex]);

    const startScanner = (itemIdx, serialIdx) => {
        setScanTarget({ itemIdx, serialIdx });
    };

    const startScanAll = (itemIdx) => {
        const item = items[itemIdx];
        if (!item) return;
        const firstEmpty = item.assigned_serials.findIndex(s => !(typeof s === 'string' ? s : s?.serial));
        if (firstEmpty === -1) {
            toast.info('Đã nhập đủ mã cho sản phẩm này!');
            return;
        }
        startScanner(itemIdx, firstEmpty);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Manual validation
        if (!formData.supplier_name || !formData.warehouse_id || !formData.receipt_date) {
            toast.error('Vui lòng điền đủ thông tin phiếu nhập kho');
            return;
        }
        if (items.some(item => !item.item_name)) {
            toast.error('Vui lòng điền tên hàng hóa cho tất cả các dòng');
            return;
        }

        setIsSubmitting(true);
        try {
            // Flatten items for DB storage
            const flattenedItems = [];
            items.forEach(item => {
                const isSerialized = formData.receipt_type === 'BINH' || formData.receipt_type === 'MAY';
                if (isSerialized) {
                    const serials = (item.assigned_serials || []).map(s => (typeof s === 'string' ? s : s?.serial)?.trim().toUpperCase()).filter(Boolean);
                    
                    if (serials.length > 0) {
                        serials.forEach(sn => {
                            flattenedItems.push({
                                ...item,
                                quantity: 1,
                                serial_number: sn,
                                total_price: item.unit_price
                            });
                        });
                        
                        if (item.quantity > serials.length) {
                            flattenedItems.push({
                                ...item,
                                quantity: item.quantity - serials.length,
                                serial_number: '',
                                total_price: (item.quantity - serials.length) * item.unit_price
                            });
                        }
                    } else {
                        flattenedItems.push(item);
                    }
                } else {
                    flattenedItems.push(item);
                }
            });

            const totalAmount = flattenedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
            const { receipt_type, ...dbFormData } = formData;
            const receiptPayload = {
                ...dbFormData,
                total_items: flattenedItems.length,
                total_amount: totalAmount,
                status: isEdit ? receipt.status : 'CHO_DUYET',
                deliverer_name: formData.deliverer_name === 'KHAC' ? formData.deliverer_name_manual : formData.deliverer_name
            };

            let receiptId;
            if (isEdit) {
                const { error: receiptError } = await supabase.from('goods_receipts').update(receiptPayload).eq('id', receipt.id);
                if (receiptError) throw receiptError;
                receiptId = receipt.id;
                await supabase.from('goods_receipt_items').delete().eq('receipt_id', receiptId);
            } else {
                const { data: newReceipt, error: receiptError } = await supabase.from('goods_receipts').insert([receiptPayload]).select().single();
                if (receiptError) throw receiptError;
                receiptId = newReceipt.id;
            }

            const itemsPayload = flattenedItems.map(item => ({
                item_type: item.item_type,
                item_name: item.item_name,
                serial_number: item.serial_number,
                item_status: item.item_status,
                quantity: parseFloat(item.quantity) || 0,
                unit: item.unit,
                unit_price: parseFloat(item.unit_price) || 0,
                total_price: parseFloat(item.total_price) || 0,
                note: item.note,
                receipt_id: receiptId
            }));

            // Validate serial existence
            if (formData.receipt_type === 'BINH') {
                const invalidSerials = flattenedItems.filter(i => i.serial_number && !cylindersList.includes(i.serial_number));
                if (invalidSerials.length > 0) {
                    throw new Error(`Mã bình không tồn tại: ${invalidSerials.map(i => i.serial_number).join(', ')}`);
                }
            } else if (formData.receipt_type === 'MAY') {
                const invalidSerials = flattenedItems.filter(i => i.serial_number && !machinesList.includes(i.serial_number));
                if (invalidSerials.length > 0) {
                    throw new Error(`Mã máy không tồn tại: ${invalidSerials.map(i => i.serial_number).join(', ')}`);
                }
            }

            const { error: itemsError } = await supabase.from('goods_receipt_items').insert(itemsPayload);
            if (itemsError) throw itemsError;

            if (!isEdit) {
                const totalQty = flattenedItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
                notificationService.add({
                    title: `📥 Nhập kho mới: #${formData.receipt_code}`,
                    description: `${formData.supplier_name} - ${totalQty} sản phẩm`,
                    type: 'success',
                    link: '/nhap-kho'
                });
            }

            onSuccess();
            handleClose();
        } catch (error) {
            console.error('Error saving goods receipt:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
                        "relative bg-slate-50 shadow-2xl w-full max-w-2xl md:max-w-3xl lg:max-w-4xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                        isClosing && "animate-out slide-out-to-right duration-300"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3.5 md:px-5 md:py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 md:w-11 md:h-11 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                                <PackagePlus className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h3 className="text-[17px] md:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                                    {isEdit ? 'Cập nhật phiếu nhập kho' : 'Tạo phiếu nhập kho'}
                                </h3>
                                <p className="text-slate-500 text-[11px] md:text-xs font-bold mt-0.5 md:mt-1">
                                    Mã phiếu: #{formData.receipt_code}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <div className="p-4 md:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 md:pb-6">
                        <form id="receiptForm" onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                            {/* Section 1: Thông tin chung */}
                            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 md:p-6 space-y-5 md:space-y-6 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                                    <FileText className="w-5 h-5 text-primary" />
                                    <h4 className="text-lg font-extrabold !text-primary">Thông tin phiếu nhập</h4>
                                </div>

                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                                    <label className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                        <Package className="w-4 h-4" /> Loại hàng nhập cho toàn phiếu
                                    </label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'MAY', label: 'Hàng MÁY', icon: '⚡' },
                                            { id: 'BINH', label: 'Hàng BÌNH', icon: '🛢️' }
                                        ].map(type => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                disabled={isReadOnly || (isEdit && items.length > 0)}
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, receipt_type: type.id }));
                                                    setItems(prev => prev.map(item => ({ ...item, item_type: type.id })));
                                                }}
                                                className={clsx(
                                                    "flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 border-2",
                                                    formData.receipt_type === type.id
                                                        ? "bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[1.02]"
                                                        : "bg-white border-slate-200 text-slate-500 hover:border-primary/40 hover:text-primary"
                                                )}
                                            >
                                                <span className="hidden md:inline-block">{type.icon}</span>
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                    {isEdit && <p className="text-[10px] text-slate-400 italic text-center">Lưu ý: Không thể đổi loại hàng khi đang sửa phiếu đã có dữ liệu.</p>}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <Users className="w-4 h-4 text-primary" />
                                            Nhà cung cấp *
                                        </label>
                                        <div className="relative">
                                            <select
                                                disabled={isReadOnly}
                                                value={formData.supplier_name || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, supplier_name: e.target.value }))}
                                                className={clsx(
                                                    "w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none transition-all outline-none",
                                                    isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            >
                                                <option value="">-- Chọn nhà cung cấp --</option>
                                                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none opacity-50" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <Warehouse className="w-4 h-4 text-primary" />
                                            Kho nhận hàng *
                                        </label>
                                        <div className="relative">
                                            <select
                                                disabled={isReadOnly}
                                                value={formData.warehouse_id || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                                                className={clsx(
                                                    "w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none transition-all outline-none",
                                                    isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                            >
                                                <option value="">-- Chọn kho nhập --</option>
                                                {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none opacity-50" />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <Calendar className="w-4 h-4 text-primary" />
                                            Ngày nhập *
                                        </label>
                                        <input
                                            type="date"
                                            disabled={isReadOnly}
                                            value={formData.receipt_date || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, receipt_date: e.target.value }))}
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <User className="w-4 h-4 text-primary" />
                                            Người giao hàng *
                                        </label>
                                        <div className="relative">
                                            <select
                                                disabled={isReadOnly}
                                                value={formData.deliverer_name || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, deliverer_name: e.target.value }))}
                                                className={clsx(
                                                    "w-full h-12 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none transition-all outline-none",
                                                    isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                                )}
                                                required
                                            >
                                                <option value="">-- Chọn hoặc nhập tên --</option>
                                                {deliverers.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name} {d.type === 'USER_SHIPPER' ? '(NV)' : '(ĐVVC)'}</option>
                                                ))}
                                                <option value="KHAC">Tên khác (Nhập tay)...</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none opacity-50" />
                                        </div>
                                        {formData.deliverer_name === 'KHAC' && (
                                            <input
                                                disabled={isReadOnly}
                                                onChange={(e) => setFormData(prev => ({ ...prev, deliverer_name_manual: e.target.value }))}
                                                placeholder="Nhập tên người giao hàng..."
                                                className="w-full h-11 px-4 mt-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none border-primary/30"
                                            />
                                        )}
                                    </div>

                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <PenLine className="w-4 h-4 text-primary" />
                                            Địa chỉ người giao
                                        </label>
                                        <input
                                            disabled={isReadOnly}
                                            value={formData.deliverer_address || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, deliverer_address: e.target.value }))}
                                            placeholder="Địa chỉ/Số điện thoại người giao"
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <User className="w-4 h-4 text-primary" />
                                            Người nhận hàng
                                        </label>
                                        <input
                                            disabled={isReadOnly}
                                            value={formData.received_by || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, received_by: e.target.value }))}
                                            placeholder="Tên người nhận"
                                            className={clsx(
                                                "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="flex items-center gap-2 text-sm font-bold !text-slate-700 ml-1">
                                            <PenLine className="w-4 h-4 text-primary" />
                                            Ghi chú phiếu
                                        </label>
                                        <textarea
                                            disabled={isReadOnly}
                                            value={formData.note || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                            placeholder="Ghi chú thêm về phiếu nhập này"
                                            className={clsx(
                                                "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none min-h-[80px] resize-none",
                                                isReadOnly ? "text-slate-500 cursor-not-allowed" : "text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Danh sách hàng hóa */}
                            <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 p-4 md:p-6 space-y-5 md:space-y-6 shadow-sm">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <Plus className="w-5 h-5 text-primary" />
                                        <h4 className="text-lg font-extrabold !text-primary">Danh sách hàng hóa</h4>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={addItem}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary rounded-xl text-xs font-bold hover:bg-primary/10 transition-all border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5 shrink-0" /> Thêm dòng
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50/50 border border-slate-200 p-4 rounded-2xl space-y-4 transition-all hover:border-primary/40 hover:shadow-sm">
                                            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                                    <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Hàng hóa #{idx + 1}</span>
                                                </div>
                                                {items.length > 1 && !isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Tên hàng hóa *</label>
                                                    <div className="flex flex-col gap-2">
                                                        <select
                                                            disabled={isReadOnly}
                                                            value={PRODUCT_TYPES.some(p => p.label === item.item_name) ? item.item_name : (item.item_name === '' ? '' : 'KHAC')}
                                                            onChange={(e) => {
                                                                if (e.target.value === 'KHAC') {
                                                                    updateItem(idx, 'item_name', 'Sản phẩm khác...');
                                                                } else {
                                                                    updateItem(idx, 'item_name', e.target.value);
                                                                }
                                                            }}
                                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all"
                                                        >
                                                            <option value="">-- Chọn --</option>
                                                            {PRODUCT_TYPES.map(p => <option key={p.id} value={p.label}>{p.label}</option>)}
                                                            <option value="KHAC">Nhập tay</option>
                                                        </select>
                                                        {(!PRODUCT_TYPES.some(p => p.label === item.item_name) && item.item_name !== '') && (
                                                            <input
                                                                disabled={isReadOnly}
                                                                value={item.item_name === 'Sản phẩm khác...' ? '' : item.item_name}
                                                                onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                                                                placeholder="Nhập tên sản phẩm"
                                                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all"
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Loại</label>
                                                        <div className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-500 flex items-center">
                                                            {formData.receipt_type === 'MAY' ? 'MÁY' : 'BÌNH'}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Trạng thái</label>
                                                        <select
                                                            disabled={isReadOnly}
                                                            value={item.item_status}
                                                            onChange={(e) => updateItem(idx, 'item_status', e.target.value)}
                                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                                        >
                                                            <option value="">--</option>
                                                            {formData.receipt_type === 'MAY' ? MACHINE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>) : CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Số lượng</label>
                                                        <input
                                                            step="any"
                                                            value={item.quantity}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={() => handleQuantityBlur(idx)}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === '') {
                                                                    updateItem(idx, 'quantity', '');
                                                                    updateItem(idx, 'total_price', 0);
                                                                    return;
                                                                }
                                                                const q = parseFloat(val);
                                                                if (!isNaN(q)) {
                                                                    updateItem(idx, 'quantity', val);
                                                                    updateItem(idx, 'total_price', q * (item.unit_price || 0));
                                                                }
                                                            }}
                                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-center font-black text-primary outline-none focus:ring-4 focus:ring-primary/10"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Đơn vị</label>
                                                        <select
                                                            disabled={isReadOnly}
                                                            value={item.unit}
                                                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                                                        >
                                                            {ITEM_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Multi-Serial Input Grid */}
                                                {(formData.receipt_type === 'BINH' || formData.receipt_type === 'MAY') && item.quantity > 0 && (
                                                    <div className="pt-4 border-t border-slate-100 col-span-full">
                                                        <div className="flex items-center justify-between mb-3 px-1">
                                                            <label className="text-[12px] font-black text-primary flex items-center gap-2">
                                                                <ScanLine className="w-4 h-4" /> Gán mã RFID cho {item.item_name} ({item.assigned_serials?.length || 0})
                                                            </label>
                                                            {!isReadOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startScanAll(idx)}
                                                                    className="px-3 py-1.5 bg-primary/10 text-primary text-[11px] font-black rounded-xl hover:bg-primary/20 transition-all flex items-center gap-2 border border-primary/20"
                                                                >
                                                                    <ScanLine className="w-4 h-4" /> Quét hàng loạt
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {(item.assigned_serials || []).map((ser, sIdx) => {
                                                                const dropKey = `it-${idx}-ser-${sIdx}`;
                                                                const currentVal = (typeof ser === 'string' ? ser : (ser?.serial || ''));
                                                                const suggestions = formData.receipt_type === 'MAY' ? machinesList : cylindersList;
                                                                const isOpen = activeSerialDropdown === dropKey;

                                                                return (
                                                                    <div key={dropKey} className={clsx("relative", isOpen ? "z-[50]" : "z-[10]")}>
                                                                        <div className="relative">
                                                                            <input
                                                                                value={currentVal}
                                                                                onChange={(e) => handleSerialChange(idx, sIdx, e.target.value)}
                                                                                onFocus={() => setActiveSerialDropdown(dropKey)}
                                                                                onBlur={() => setTimeout(() => { if (activeSerialDropdown === dropKey) setActiveSerialDropdown(null); }, 200)}
                                                                                placeholder={`Mã thứ ${sIdx + 1}...`}
                                                                                autoComplete="off"
                                                                                className={clsx(
                                                                                    "w-full h-10 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-[13px] font-mono font-black transition-all",
                                                                                    isReadOnly ? "text-slate-500 bg-slate-50" : "text-primary focus:border-primary/50 focus:ring-4 focus:ring-primary/5"
                                                                                )}
                                                                                readOnly={isReadOnly}
                                                                            />
                                                                            {!isReadOnly && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => startScanner(idx, sIdx)}
                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-primary/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                                                                >
                                                                                    <ScanLine className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {isOpen && !isReadOnly && (
                                                                            <div className="absolute z-[100] left-0 right-0 top-11 bg-white border border-primary/20 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                                                                                {suggestions.filter(s => s.includes(currentVal.toUpperCase())).slice(0, 20).map(s => (
                                                                                    <button
                                                                                        key={s}
                                                                                        type="button"
                                                                                        onMouseDown={(e) => {
                                                                                            e.preventDefault();
                                                                                            handleSerialChange(idx, sIdx, s);
                                                                                            setActiveSerialDropdown(null);
                                                                                        }}
                                                                                        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-primary/5 transition-colors border-b border-slate-50 last:border-0"
                                                                                    >
                                                                                        <span className="text-[13px] font-mono font-bold text-primary">{s}</span>
                                                                                    </button>
                                                                                ))}
                                                                                {suggestions.filter(s => s.includes(currentVal.toUpperCase())).length === 0 && (
                                                                                    <div className="px-4 py-3 text-xs text-slate-400 italic">Không có mã phù hợp</div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Đơn giá nhập</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            disabled={isReadOnly}
                                                            value={item.unit_price ? formatNumber(item.unit_price) : ''}
                                                            onFocus={(e) => e.target.select()}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                const p = parseFloat(val) || 0;
                                                                updateItem(idx, 'unit_price', p);
                                                                updateItem(idx, 'total_price', (parseFloat(item.quantity) || 0) * p);
                                                            }}
                                                            placeholder="0"
                                                            className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-right font-bold text-slate-700 pr-8 outline-none"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₫</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-black text-primary uppercase tracking-wider ml-1">Thành tiền</label>
                                                    <div className="w-full h-11 px-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-end font-black text-primary">
                                                        {formatNumber(item.total_price)} ₫
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="text-sm font-bold text-slate-500">
                                        Tổng: <span className="text-primary text-lg font-black">{items.length}</span> mặt hàng —
                                        <span className="text-primary text-lg font-black ml-1">{items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0)}</span> đơn vị
                                    </div>
                                    <div className="text-lg font-black text-rose-600 tracking-tight">
                                        {formatNumber(items.reduce((sum, i) => sum + (i.total_price || 0), 0))} <span className="text-sm font-bold">VNĐ</span>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="p-4 md:px-6 md:py-5 bg-white border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 z-20 shrink-0 pb-safe">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 md:flex-none px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm flex items-center justify-center"
                        >
                            Hủy bỏ
                        </button>
                        {!isReadOnly && (
                            <button
                                type="submit"
                                form="receiptForm"
                                disabled={isSubmitting}
                                className={clsx(
                                    "flex-[2] md:flex-none px-6 md:px-10 py-3 rounded-2xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 text-sm",
                                    isSubmitting ? "bg-slate-400 cursor-not-allowed" : "bg-primary hover:bg-primary/90 active:scale-95 shadow-primary/25"
                                )}
                            >
                                {isSubmitting ? (
                                    <>Đang lưu...</>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5 md:w-4 md:h-4" />
                                        {isEdit ? 'Cập nhật' : 'Lưu phiếu nhập'}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

 
            <BarcodeScanner
                isOpen={scannerIndex !== null || scanTarget.itemIdx !== -1}
                onClose={() => {
                    setScannerIndex(null);
                    setScanTarget({ itemIdx: -1, serialIdx: -1 });
                }}
                onScanSuccess={handleScanSuccess}
                title={scanTarget.itemIdx !== -1 ? `Đang quét mã cho dòng ${scanTarget.itemIdx + 1}` : "Quét mã hàng hóa"}
            />
        </>,
        document.body
    );
}
