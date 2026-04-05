import { clsx } from 'clsx';
import {
    ArrowRightLeft,
    ChevronLeft,
    RefreshCw,
    Save,
    Warehouse,
    Package,
    ClipboardList,
    ArrowRight,
    ArrowDown,
    Hash,
    Info,
    Camera,
    Printer,
    Image as ImageIcon,
    X,
    Loader2,
    ScanLine,
    AlertTriangle,
    CheckCircle2,
    Trash2
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import { notificationService } from '../utils/notificationService';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import MachineHandoverPrintTemplate from '../components/MachineHandoverPrintTemplate';
import BarcodeScanner from '../components/Common/BarcodeScanner';
import usePermissions from '../hooks/usePermissions';

// Helper functions for smart categorization
const isMachine = (item) => {
    if (!item) return false;
    const type = (item.item_type || '').toUpperCase();
    const name = (item.item_name || '').toLowerCase();
    return type === 'MAY' || name.includes('máy') || name.includes('plasma');
};

const isCylinder = (item) => {
    if (!item) return false;
    const type = (item.item_type || '').toUpperCase();
    const name = (item.item_name || '').toLowerCase();
    // Match 'BINH', 'BINH_CO_KHI', etc or name containing 'bình'
    return type.startsWith('BINH') || name.includes('bình');
};

const InventoryTransfer = () => {
    const { role, department } = usePermissions();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [inventory, setInventory] = useState([]);

    const [formData, setFormData] = useState({
        from_warehouse_id: '',
        to_warehouse_id: '',
        item_type: 'MAY',
        item_name: '',
        quantity: '',
        note: '',
        specific_codes: [] // Array of { code: string, status: 'pending'|'valid'|'invalid', message?: string }
    });

    const [availableItems, setAvailableItems] = useState([]);
    const [maxQuantity, setMaxQuantity] = useState(0);

    const [uploading, setUploading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [printBBBG, setPrintBBBG] = useState(false);

    // Scanner states
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanTargetIdx, setScanTargetIdx] = useState(-1);
    const scanTargetIdxRef = useRef(-1);
    useEffect(() => { scanTargetIdxRef.current = scanTargetIdx; }, [scanTargetIdx]);

    // Validating state
    const [isValidating, setIsValidating] = useState(false);

    const needsSpecificCodes = formData.item_type === 'MAY' || formData.item_type === 'BINH';

    const mockOrderForBBBG = useMemo(() => {
        const codesList = formData.specific_codes.filter(c => c.code).map(c => c.code).join(', ');
        return {
            id: 'bbbg_transfer',
            created_at: new Date().toISOString(),
            product_type: formData.item_type,
            quantity: formData.quantity,
            department: codesList || formData.item_name,
            customer_name: warehouses.find(w => w.id === formData.to_warehouse_id)?.name || 'Kho Nhận',
            recipient_name: 'Đại diện ' + (warehouses.find(w => w.id === formData.to_warehouse_id)?.name || 'Kho Nhận'),
            recipient_address: 'Luân chuyển nội bộ',
        };
    }, [formData, warehouses]);

    const handlePrintBBBG = () => {
        setPrintBBBG(true);
        setTimeout(() => {
            window.print();
            setPrintBBBG(false);
        }, 100);
    };

    const handleUploadImage = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `inventory_transfers/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('delivery_proofs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('delivery_proofs')
                .getPublicUrl(filePath);

            setUploadedImage(publicUrl);
            toast.success('Đã tải lên ảnh bàn giao!');
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Lỗi tải ảnh: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        if (formData.from_warehouse_id) {
            fetchInventory(formData.from_warehouse_id);
        } else {
            setAvailableItems([]);
        }
    }, [formData.from_warehouse_id]);

    useEffect(() => {
        if (formData.item_type && inventory.length > 0) {
            // Smart filtering based on derived type
            const items = inventory.filter(i => {
                if (formData.item_type === 'MAY') return isMachine(i) && !isCylinder(i);
                if (formData.item_type === 'BINH') return isCylinder(i);
                if (formData.item_type === 'VAT_TU') return !isMachine(i) && !isCylinder(i);
                return true;
            });

            setAvailableItems(items);

            const selected = items.find(i => i.item_name === formData.item_name);
            if (selected) {
                setMaxQuantity(selected.quantity);
            } else {
                setFormData(prev => ({ ...prev, item_name: items[0]?.item_name || '', quantity: '', specific_codes: [] }));
                setMaxQuantity(items[0]?.quantity || 0);
            }
        } else if (inventory.length === 0) {
            setAvailableItems([]);
        }
    }, [formData.item_type, inventory]);

    useEffect(() => {
        const selected = availableItems.find(i => i.item_name === formData.item_name);
        if (selected) {
            setMaxQuantity(selected.quantity);
        } else {
            setMaxQuantity(0);
        }
    }, [formData.item_name]);

    // Auto-resize specific_codes array when quantity changes (only for MAY, BINH)
    useEffect(() => {
        if (!needsSpecificCodes) {
            if (formData.specific_codes.length > 0) {
                setFormData(prev => ({ ...prev, specific_codes: [] }));
            }
            return;
        }
        const qty = parseInt(formData.quantity, 10) || 0;
        setFormData(prev => {
            const current = [...prev.specific_codes];
            if (current.length === qty) return prev;
            if (current.length < qty) {
                for (let i = current.length; i < qty; i++) {
                    current.push({ code: '', status: 'pending' });
                }
            } else {
                current.length = qty;
            }
            return { ...prev, specific_codes: current };
        });
    }, [formData.quantity, needsSpecificCodes]);

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
        if (data) {
            setWarehouses(data);

            // Auto-select source warehouse for non-admin users
            if (role !== 'Admin' && department) {
                const userWhCode = department.includes('-') ? department.split('-')[0].trim() : department.trim();
                const userWh = data.find(w => w.id === userWhCode);
                if (userWh) {
                    setFormData(prev => ({ ...prev, from_warehouse_id: userWh.id }));
                }
            }
        }
    };

    const fetchInventory = async (warehouseId) => {
        const { data } = await supabase
            .from('inventory')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .gt('quantity', 0);
        if (data) setInventory(data);
    };

    const warehouseOptions = useMemo(() =>
        warehouses.map(w => ({ value: w.id, label: w.name })),
        [warehouses]
    );

    const itemOptions = useMemo(() =>
        availableItems.map(item => ({
            value: item.item_name,
            label: `${item.item_name} (Tồn: ${item.quantity})`
        })),
        [availableItems]
    );

    // ── SPECIFIC CODE HANDLING ──

    const handleCodeChange = (index, value) => {
        const normalizedVal = value.trim().toUpperCase();
        setFormData(prev => {
            const codes = [...prev.specific_codes];
            codes[index] = { code: normalizedVal, status: 'pending' };
            return { ...prev, specific_codes: codes };
        });
    };

    const handleRemoveCode = (index) => {
        setFormData(prev => {
            const codes = [...prev.specific_codes];
            codes[index] = { code: '', status: 'pending' };
            return { ...prev, specific_codes: codes };
        });
    };

    // Check for duplicate codes within the form
    const getDuplicateIndices = () => {
        const seen = {};
        const duplicates = new Set();
        formData.specific_codes.forEach((item, idx) => {
            if (!item.code) return;
            if (seen[item.code] !== undefined) {
                duplicates.add(seen[item.code]);
                duplicates.add(idx);
            } else {
                seen[item.code] = idx;
            }
        });
        return duplicates;
    };

    const duplicateIndices = useMemo(() => getDuplicateIndices(), [formData.specific_codes]);

    // Validate specific codes against database
    const validateCodes = async () => {
        const codes = formData.specific_codes.filter(c => c.code).map(c => c.code);
        if (codes.length === 0) return true;

        setIsValidating(true);
        try {
            const tableName = formData.item_type === 'BINH' ? 'cylinders' : 'machines';
            const whColumn = formData.item_type === 'BINH' ? 'warehouse_id' : 'warehouse';
            const serialColumn = 'serial_number';

            const { data: items, error } = await supabase
                .from(tableName)
                .select(`id, ${serialColumn}, status, ${whColumn}`)
                .in(serialColumn, codes);

            if (error) throw error;

            const itemMap = {};
            (items || []).forEach(item => {
                itemMap[item.serial_number] = item;
            });

            let allValid = true;
            const updatedCodes = formData.specific_codes.map(entry => {
                if (!entry.code) return entry;

                const dbItem = itemMap[entry.code];
                if (!dbItem) {
                    allValid = false;
                    return { ...entry, status: 'invalid', message: 'Mã không tồn tại trong hệ thống' };
                }

                const itemWarehouse = dbItem[whColumn];
                if (itemWarehouse !== formData.from_warehouse_id) {
                    allValid = false;
                    return { ...entry, status: 'invalid', message: `Không thuộc kho xuất (đang ở: ${itemWarehouse || 'N/A'})` };
                }

                if (dbItem.status !== 'sẵn sàng') {
                    allValid = false;
                    return { ...entry, status: 'invalid', message: `Trạng thái: "${dbItem.status}" (cần "sẵn sàng")` };
                }

                return { ...entry, status: 'valid', message: 'Hợp lệ', dbId: dbItem.id };
            });

            setFormData(prev => ({ ...prev, specific_codes: updatedCodes }));
            return allValid;
        } catch (error) {
            console.error('Validation error:', error);
            toast.error('Lỗi kiểm tra mã: ' + error.message);
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    // Scanner handlers
    const startScanner = (index) => {
        setScanTargetIdx(index);
        setIsScannerOpen(true);
    };

    const startScanAll = () => {
        const firstEmpty = formData.specific_codes.findIndex(c => !c.code);
        if (firstEmpty === -1) {
            toast.info('Đã điền đủ mã cho tất cả vị trí!');
            return;
        }
        startScanner(firstEmpty);
    };

    const handleScanSuccess = useCallback((decodedText) => {
        const normalizedText = decodedText.trim().toUpperCase();
        const targetIdx = scanTargetIdxRef.current;
        if (targetIdx === -1) return;

        // Check for duplicates
        setFormData(prev => {
            const codes = [...prev.specific_codes];
            const isDuplicate = codes.some((c, i) => i !== targetIdx && c.code === normalizedText);

            if (isDuplicate) {
                toast.warn(`Mã ${normalizedText} đã được nhập trước đó!`, { toastId: `dup-${normalizedText}` });
                return prev;
            }

            codes[targetIdx] = { code: normalizedText, status: 'pending' };

            // Auto-advance to next empty slot
            const nextEmpty = codes.findIndex((c, i) => i > targetIdx && !c.code);
            if (nextEmpty !== -1) {
                setScanTargetIdx(nextEmpty);
            } else {
                setIsScannerOpen(false);
                setScanTargetIdx(-1);
                toast.success(`Đã quét xong ${codes.filter(c => c.code).length} mã!`);
            }

            return { ...prev, specific_codes: codes };
        });
    }, []);

    // ── SUBMIT HANDLER ──

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.from_warehouse_id || !formData.to_warehouse_id || !formData.item_name || formData.quantity <= 0) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (formData.from_warehouse_id === formData.to_warehouse_id) {
            toast.error('Kho đi và kho đến không được trùng nhau');
            return;
        }

        if (formData.quantity > maxQuantity) {
            toast.error(`Số lượng chuyển (${formData.quantity}) vượt quá tồn kho (${maxQuantity})`);
            return;
        }

        // Validate specific codes for MAY/BINH
        if (needsSpecificCodes) {
            const filledCodes = formData.specific_codes.filter(c => c.code);

            if (filledCodes.length === 0) {
                toast.error(`Vui lòng nhập ít nhất mã ${formData.item_type === 'BINH' ? 'bình' : 'máy'} cần điều chuyển`);
                return;
            }

            if (filledCodes.length !== formData.quantity) {
                toast.error(`Cần nhập đúng ${formData.quantity} mã. Hiện tại đã nhập: ${filledCodes.length}`);
                return;
            }

            if (duplicateIndices.size > 0) {
                toast.error('Phát hiện mã bị trùng lặp, vui lòng kiểm tra lại!');
                return;
            }

            // Validate against database
            const valid = await validateCodes();
            if (!valid) {
                toast.error('Một số mã không hợp lệ. Vui lòng kiểm tra lại các mã đánh dấu đỏ.');
                return;
            }
        }

        setLoading(true);
        try {
            // Find the exact source item record (using all fields to ensure correct match)
            const sourceItem = inventory.find(i => i.item_name === formData.item_name && (
                (formData.item_type === 'MAY' && isMachine(i)) ||
                (formData.item_type === 'BINH' && isCylinder(i)) ||
                (formData.item_type === 'VAT_TU' && !isMachine(i) && !isCylinder(i))
            ));

            if (!sourceItem) {
                toast.error('Không tìm thấy thông tin hàng hóa trong kho nguồn');
                setLoading(false);
                return;
            }

            // 1. Decrease source inventory count
            const { error: decError } = await supabase
                .from('inventory')
                .update({ quantity: sourceItem.quantity - formData.quantity })
                .eq('id', sourceItem.id);
            if (decError) throw decError;

            // 2. Increase/Create destination inventory count
            const { data: destItemData, error: destQueryError } = await supabase
                .from('inventory')
                .select('id, quantity')
                .eq('warehouse_id', formData.to_warehouse_id)
                .eq('item_type', formData.item_type)
                .eq('item_name', formData.item_name)
                .maybeSingle();
            if (destQueryError) throw destQueryError;

            let destInventoryId;
            if (destItemData) {
                const { data: updatedDest, error: incError } = await supabase
                    .from('inventory')
                    .update({ quantity: destItemData.quantity + formData.quantity })
                    .eq('id', destItemData.id)
                    .select().single();
                if (incError) throw incError;
                destInventoryId = updatedDest.id;
            } else {
                const { data: newDest, error: insError } = await supabase
                    .from('inventory')
                    .insert([{
                        warehouse_id: formData.to_warehouse_id,
                        item_type: formData.item_type,
                        item_name: formData.item_name,
                        quantity: formData.quantity
                    }])
                    .select().single();
                if (insError) throw insError;
                destInventoryId = newDest.id;
            }

            // 3. Update individual item locations (cylinders/machines)
            if (needsSpecificCodes) {
                const validCodes = formData.specific_codes.filter(c => c.code && c.dbId);
                const tableName = formData.item_type === 'BINH' ? 'cylinders' : 'machines';
                const whColumn = formData.item_type === 'BINH' ? 'warehouse_id' : 'warehouse';

                for (const entry of validCodes) {
                    const { error: updateErr } = await supabase
                        .from(tableName)
                        .update({ [whColumn]: formData.to_warehouse_id })
                        .eq('id', entry.dbId);

                    if (updateErr) {
                        console.error(`Failed to update ${tableName} ${entry.code}:`, updateErr);
                    }
                }
            }

            // 4. Create transaction records
            const transferCode = `TRF${Date.now().toString().slice(-6)}`;

            const toName = warehouses.find(w => w.id === formData.to_warehouse_id)?.name;
            const fromName = warehouses.find(w => w.id === formData.from_warehouse_id)?.name;

            // Build codes list for note
            const codesList = formData.specific_codes.filter(c => c.code).map(c => c.code).join(', ');
            const codesNote = codesList ? `\nMã cụ thể: [${codesList}]` : '';

            const finalNoteOut = uploadedImage
                ? `Điều chuyển tới ${toName}. ${formData.note}${codesNote}\n[Ảnh Bàn Giao]: ${uploadedImage}`
                : `Điều chuyển tới ${toName}. ${formData.note}${codesNote}`;

            const finalNoteIn = uploadedImage
                ? `Nhận điều chuyển từ ${fromName}. ${formData.note}${codesNote}\n[Ảnh Bàn Giao]: ${uploadedImage}`
                : `Nhận điều chuyển từ ${fromName}. ${formData.note}${codesNote}`;

            const { error: txError } = await supabase
                .from('inventory_transactions')
                .insert([
                    {
                        inventory_id: sourceItem.id,
                        transaction_type: 'OUT',
                        reference_code: transferCode,
                        quantity_changed: formData.quantity,
                        note: finalNoteOut
                    },
                    {
                        inventory_id: destInventoryId,
                        transaction_type: 'IN',
                        reference_code: transferCode,
                        quantity_changed: formData.quantity,
                        note: finalNoteIn
                    }
                ]);
            if (txError) throw txError;

            await notificationService.add({
                title: 'Điều chuyển kho',
                description: `Đã chuyển ${formData.quantity} ${formData.item_name} từ ${fromName} tới ${toName}${codesList ? ` (${codesList})` : ''}`,
                type: 'success',
                link: '/bao-cao/kho'
            });

            toast.success('Điều chuyển kho thành công!');
            navigate('/bao-cao/kho');
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error('Lỗi khi điều chuyển: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ── STATUS HELPERS ──

    const getStatusIcon = (status) => {
        switch (status) {
            case 'valid': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'invalid': return <AlertTriangle size={16} className="text-rose-500" />;
            default: return <Hash size={16} className="text-slate-400" />;
        }
    };

    const getStatusBorder = (status, isDuplicate) => {
        if (isDuplicate) return 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-200';
        switch (status) {
            case 'valid': return 'border-emerald-400 bg-emerald-50/30';
            case 'invalid': return 'border-rose-400 bg-rose-50/30';
            default: return 'border-slate-200 bg-white';
        }
    };

    const filledCount = formData.specific_codes.filter(c => c.code).length;
    const totalSlots = formData.specific_codes.length;

    return (
        <div className="fixed md:static inset-0 z-[100] md:z-auto w-full md:flex-1 flex flex-col px-4 pt-16 pb-4 sm:p-6 bg-slate-50 overflow-y-auto md:overflow-visible custom-scrollbar md:min-h-screen">
            {/* Optimized Page Header */}
            <div className="hidden md:flex max-w-4xl mx-auto w-full mb-8 flex-col md:flex-row md:items-center justify-center relative gap-4 md:gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="md:absolute md:left-0 self-start md:self-auto !h-9 !px-3 md:!h-10 md:!px-4 flex items-center justify-center gap-1.5 md:gap-2 bg-white border border-slate-200 rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-slate-800 shadow-sm"
                >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                    <span className="font-bold text-[13px] md:text-[14px]">Quay lại</span>
                </button>
                <div className="hidden md:flex flex-col text-center">
                    <h1 className="text-[22px] md:text-2xl font-bold text-slate-900 tracking-tight leading-tight">Điều chuyển kho nội bộ</h1>
                    <p className="text-[12px] md:text-[13px] text-slate-500 font-medium">Quản lý luân chuyển hàng hóa giữa các kho</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full">
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 pb-32 md:pb-0">
                    {/* Warehouse Info Section */}
                    <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                            <Warehouse className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin kho hàng</h4>
                        </div>

                        <div className="relative">
                            <div className="flex flex-col md:grid md:grid-cols-2 gap-5 md:gap-14 relative transition-all duration-300">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                        <Warehouse className="w-4 h-4 text-primary/70" /> Kho xuất (Nguồn) <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        options={warehouseOptions}
                                        value={formData.from_warehouse_id}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, from_warehouse_id: val, specific_codes: [] }))}
                                        placeholder="Chọn kho xuất..."
                                        searchPlaceholder="Tìm kho..."
                                        disabled={role !== 'Admin' && department}
                                    />
                                </div>

                                {/* Arrow Down Indicator for Mobile */}
                                <div className="flex md:hidden items-center justify-center -my-2.5 text-primary/30 pointer-events-none">
                                    <ArrowDown size={22} />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                        <Warehouse className="w-4 h-4 text-emerald-600" /> Kho nhận (Đích) <span className="text-red-500">*</span>
                                    </label>
                                    <SearchableSelect
                                        options={warehouseOptions}
                                        value={formData.to_warehouse_id}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, to_warehouse_id: val }))}
                                        placeholder="Chọn kho nhận..."
                                        searchPlaceholder="Tìm kho..."
                                    />
                                </div>
                            </div>

                            {/* Arrow Right indicator on Desktop */}
                            <div className="hidden md:flex absolute left-1/2 top-[52px] -translate-x-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center text-primary/40 z-10 pointer-events-none">
                                <ArrowRight size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Item Info Section */}
                    <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                            <Package className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Chi tiết vật tư điều chuyển</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                    <Info className="w-4 h-4 text-primary/70" /> Loại hàng hóa <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                                    {['MAY', 'BINH', 'VAT_TU'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, item_type: type, specific_codes: [] }))}
                                            className={clsx(
                                                "flex-1 !h-9 md:!h-10 py-1 px-2 rounded-xl text-[12px] md:text-[13px] font-bold transition-all shadow-sm",
                                                formData.item_type === type
                                                    ? "bg-white text-primary border-transparent"
                                                    : "bg-transparent text-slate-500 hover:text-slate-800"
                                            )}
                                        >
                                            {type === 'MAY' ? 'Máy' : type === 'BINH' ? 'Bình' : 'Vật tư'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                    <Package className="w-4 h-4 text-primary/70" /> Tên hàng hóa <span className="text-red-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={itemOptions}
                                    value={formData.item_name}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, item_name: val, specific_codes: [] }))}
                                    disabled={!formData.from_warehouse_id || availableItems.length === 0}
                                    placeholder="Chọn hàng hóa..."
                                    searchPlaceholder="Tìm hàng hóa..."
                                />
                                {!formData.from_warehouse_id && (
                                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg w-fit">
                                        <Info size={12} /> Vui lòng chọn kho xuất trước
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                    <Hash className="w-4 h-4 text-primary/70" /> Số lượng <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className="w-full h-11 md:h-12 pl-4 pr-24 bg-slate-50 border border-slate-200 rounded-2xl text-[14.5px] font-black text-primary outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-inner"
                                        value={formData.quantity}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\D/g, '');
                                            const num = raw === '' ? '' : Math.min(parseInt(raw, 10), maxQuantity || 9999);
                                            setFormData(prev => ({ ...prev, quantity: num }));
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0"
                                        required
                                    />
                                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-primary text-white text-[10px] md:text-[11px] font-bold px-2 py-1.5 rounded-xl shadow-lg shadow-primary/20">
                                        Tồn: {maxQuantity}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                                    <ClipboardList className="w-4 h-4 text-primary/70" /> Ghi chú (Tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-11 md:h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14.5px] font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-inner"
                                    placeholder="Lý do điều chuyển..."
                                    value={formData.note}
                                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── SPECIFIC CODES SECTION (MAY / BINH only) ── */}
                    {needsSpecificCodes && formData.quantity > 0 && formData.item_name && (
                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                            <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                                <div className="flex items-center gap-2.5">
                                    <ScanLine className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">
                                        Mã {formData.item_type === 'BINH' ? 'bình (RFID)' : 'máy (Serial)'}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={clsx(
                                        "text-[11px] font-bold px-2.5 py-1 rounded-full",
                                        filledCount === totalSlots
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-amber-100 text-amber-700"
                                    )}>
                                        {filledCount}/{totalSlots}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={startScanAll}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-[12px] font-bold rounded-xl hover:bg-primary/20 transition-all"
                                    >
                                        <ScanLine size={14} /> Quét hàng loạt
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[12px] text-slate-500 font-medium">
                                    Nhập hoặc quét mã {formData.item_type === 'BINH' ? 'RFID trên vỏ bình' : 'serial trên máy'} cho từng đơn vị cần điều chuyển.
                                    Hệ thống sẽ kiểm tra mã thuộc kho xuất và cập nhật vị trí khi hoàn tất.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                                {formData.specific_codes.map((entry, idx) => {
                                    const isDuplicate = duplicateIndices.has(idx);
                                    return (
                                        <div key={idx} className="relative group/code">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {getStatusIcon(isDuplicate ? 'invalid' : entry.status)}
                                                <span className="text-[11px] font-bold text-slate-500">
                                                    {formData.item_type === 'BINH' ? 'Mã bình' : 'Mã máy'} #{idx + 1}
                                                </span>
                                                {isDuplicate && (
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">TRÙNG</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    value={entry.code}
                                                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                                                    placeholder={formData.item_type === 'BINH' ? `VD: QR04116` : `VD: PLT-25D1-50-TM`}
                                                    className={clsx(
                                                        "w-full h-10 pl-4 pr-20 border rounded-xl text-[13px] font-mono font-bold transition-all outline-none focus:ring-2 focus:ring-primary/10",
                                                        getStatusBorder(isDuplicate ? 'invalid' : entry.status, isDuplicate)
                                                    )}
                                                />
                                                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                    {entry.code && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCode(idx)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => startScanner(idx)}
                                                        className="p-1.5 text-primary/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                                    >
                                                        <ScanLine size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            {entry.status !== 'pending' && entry.message && (
                                                <p className={clsx(
                                                    "text-[10px] font-bold mt-0.5 px-1",
                                                    entry.status === 'valid' ? "text-emerald-600" : "text-rose-500"
                                                )}>
                                                    {entry.message}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Validation button */}
                            {filledCount > 0 && (
                                <button
                                    type="button"
                                    onClick={validateCodes}
                                    disabled={isValidating}
                                    className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] rounded-2xl transition-all border border-slate-200 disabled:opacity-50"
                                >
                                    {isValidating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {isValidating ? 'Đang kiểm tra...' : `Kiểm tra ${filledCount} mã`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* BBBG & Handover Photo Section */}
                    <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                         <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary">Chứng từ và Hình Ảnh Bàn Giao</h4>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                            {/* BBBG Button */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">Biên Bản Bàn Giao</label>
                                <button
                                    type="button"
                                    onClick={handlePrintBBBG}
                                    disabled={!formData.to_warehouse_id || !formData.item_name}
                                    className="w-full h-11 md:h-12 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-2xl transition-all disabled:opacity-50"
                                >
                                    <Printer size={18} /> In Biên Bản Bàn Giao (Mẫu CHS)
                                </button>
                                <p className="text-[11px] text-slate-500 italic mt-1 px-1">Cho phép in BBBG lưu nháp để các bên ký nhận.</p>
                            </div>

                            {/* Photo Upload */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">Ảnh chụp bàn giao (BBBG đã ký, Hàng hóa...)</label>
                                {uploadedImage ? (
                                     <div className="relative h-11 md:h-12 rounded-2xl border border-emerald-500 bg-emerald-50 flex items-center justify-between px-3 group overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon size={18} className="text-emerald-600" />
                                            <span className="text-[13px] font-bold text-emerald-700 truncate max-w-[150px]">Đã tải lên ảnh chụp</span>
                                            <a href={uploadedImage} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-600 underline">Xem</a>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setUploadedImage(null)}
                                            className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                     </div>
                                ) : (
                                    <div className="relative h-11 md:h-12">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleUploadImage}
                                            disabled={uploading}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="w-full h-full border border-dashed border-primary/40 rounded-2xl flex items-center justify-center gap-2 text-primary/70 bg-primary/5 hover:bg-primary/10 transition-colors">
                                            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                                            <span className="text-[13px] font-bold">{uploading ? 'Đang tải lên...' : 'Bấm tải ảnh bàn giao'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hidden Print Template */}
                    {printBBBG && createPortal(
                        <div className="print-only-content">
                            <MachineHandoverPrintTemplate orders={[mockOrderForBBBG]} />
                        </div>,
                        document.body
                    )}

                    {/* Bottom Actions */}
                    <div className="fixed md:static z-40 bottom-0 left-0 right-0 border-t md:border-none border-slate-200 p-4 md:p-0 bg-white md:bg-transparent flex flex-col-reverse sm:flex-row gap-3 md:gap-4 pt-4 items-center justify-end shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:shadow-none pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-16 mt-6 md:mt-0">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="w-full sm:w-auto px-6 py-3 font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-[14px]"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={loading || isValidating}
                            className={clsx(
                                "w-full sm:w-auto px-6 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50",
                                "bg-primary text-white border-primary/40 hover:bg-primary/90 shadow-primary/20",
                                (loading || isValidating) && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Xác nhận điều chuyển
                        </button>
                    </div>
                </form>
            </div>

            {/* Barcode Scanner Modal */}
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => { setIsScannerOpen(false); setScanTargetIdx(-1); }}
                onScanSuccess={handleScanSuccess}
                title={`Quét mã ${formData.item_type === 'BINH' ? 'bình' : 'máy'} #${scanTargetIdx + 1}`}
                elementId="transfer-barcode-reader"
                currentCount={filledCount}
                totalCount={totalSlots}
            />
        </div>
    );
};

export default InventoryTransfer;
