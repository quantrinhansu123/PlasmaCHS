import { clsx } from 'clsx';
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    Camera,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    Hash,
    Image as ImageIcon,
    Info,
    Loader2,
    Package,
    Printer,
    RefreshCw,
    Save,
    ScanLine,
    Warehouse,
    X,
    Plus,
    Trash2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import BarcodeScanner from '../components/Common/BarcodeScanner';
import MachineHandoverPrintTemplate from '../components/MachineHandoverPrintTemplate';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';
import { notificationService } from '../utils/notificationService';

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
    const [serialOptionsByItemName, setSerialOptionsByItemName] = useState({});

    const [formData, setFormData] = useState({
        from_warehouse_id: '',
        to_warehouse_id: '',
        note: ''
    });

    const [transferItems, setTransferItems] = useState([
        { id: Date.now().toString(), item_type: 'MAY', item_name: '', quantity: '', maxQuantity: 0, specific_codes: [] }
    ]);

    const [uploading, setUploading] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [printBBBG, setPrintBBBG] = useState(false);

    // Scanner states
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanTargetItemIdx, setScanTargetItemIdx] = useState(-1);
    const [scanTargetCodeIdx, setScanTargetCodeIdx] = useState(-1);
    
    const scanRef = useRef({ itemIdx: -1, codeIdx: -1 });
    useEffect(() => { 
        scanRef.current = { itemIdx: scanTargetItemIdx, codeIdx: scanTargetCodeIdx }; 
    }, [scanTargetItemIdx, scanTargetCodeIdx]);

    // Validating state
    const [isValidating, setIsValidating] = useState(false);

    const mockOrderForBBBG = useMemo(() => {
        const orderItems = transferItems.filter(t => t.item_name && t.quantity > 0).map(t => {
            const codesList = t.specific_codes.filter(c => c.code).map(c => c.code).join(', ');
            return {
                product_type: t.item_type,
                product_name: t.item_name,
                quantity: t.quantity,
                codesList: codesList
            };
        });

        return {
            id: 'bbbg_transfer',
            created_at: new Date().toISOString(),
            customer_name: warehouses.find(w => w.id === formData.to_warehouse_id)?.name || 'Kho Nhận',
            recipient_name: 'Đại diện ' + (warehouses.find(w => w.id === formData.to_warehouse_id)?.name || 'Kho Nhận'),
            recipient_address: 'Luân chuyển nội bộ',
            items: orderItems,
            product_type: orderItems[0]?.product_type,
            quantity: orderItems[0]?.quantity,
        };
    }, [formData, warehouses, transferItems]);

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
            // Clear items when changing source warehouse
            setTransferItems([{ id: Date.now().toString(), item_type: 'MAY', item_name: '', quantity: '', maxQuantity: 0, specific_codes: [] }]);
        } else {
            setInventory([]);
            setTransferItems([{ id: Date.now().toString(), item_type: 'MAY', item_name: '', quantity: '', maxQuantity: 0, specific_codes: [] }]);
        }
    }, [formData.from_warehouse_id]);

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
        if (data) {
            setWarehouses(data);

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
        try {
            // 1. Fetch Materials (VAT_TU)
            const { data: invData } = await supabase
                .from('inventory')
                .select('*')
                .eq('warehouse_id', warehouseId)
                .eq('item_type', 'VAT_TU')
                .gt('quantity', 0);

            // 2. Fetch Machines (MAY)
            const { data: machinesData } = await supabase
                .from('machines')
                .select('machine_type, status, serial_number')
                .eq('warehouse', warehouseId)
                .eq('status', 'sẵn sàng');

            // 3. Fetch Cylinders (BINH)
            const { data: cylindersData } = await supabase
                .from('cylinders')
                .select('volume, status, serial_number')
                .eq('warehouse_id', warehouseId)
                .in('status', ['sẵn sàng', 'bình rỗng']);

            // Process counts
            const machCounts = (machinesData || []).reduce((acc, m) => {
                const name = `Máy ${m.machine_type}`;
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});

            const cylCounts = (cylindersData || []).reduce((acc, c) => {
                const name = `Bình ${c.volume || 'khác'}`;
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});
            const machineSerials = (machinesData || []).reduce((acc, machine) => {
                const name = `Máy ${machine.machine_type}`;
                const serial = (machine.serial_number || '').trim().toUpperCase();
                if (!serial) return acc;
                if (!acc[name]) acc[name] = new Set();
                acc[name].add(serial);
                return acc;
            }, {});
            const cylinderSerials = (cylindersData || []).reduce((acc, cylinder) => {
                const name = `Bình ${cylinder.volume || 'khác'}`;
                const serial = (cylinder.serial_number || '').trim().toUpperCase();
                if (!serial) return acc;
                if (!acc[name]) acc[name] = new Set();
                acc[name].add(serial);
                return acc;
            }, {});

            const realInventory = [
                ...(invData || []).map(i => ({ ...i, item_type: 'VAT_TU' })),
                ...Object.entries(machCounts).map(([name, qty]) => ({
                    id: `mach-${name}`,
                    item_name: name,
                    item_type: 'MAY',
                    quantity: qty,
                    warehouse_id: warehouseId
                })),
                ...Object.entries(cylCounts).map(([name, qty]) => ({
                    id: `cyl-${name}`,
                    item_name: name,
                    item_type: 'BINH',
                    quantity: qty,
                    warehouse_id: warehouseId
                }))
            ];

            setInventory(realInventory);
            const serialMap = {};
            Object.entries(machineSerials).forEach(([name, serialSet]) => {
                serialMap[name] = Array.from(serialSet).sort();
            });
            Object.entries(cylinderSerials).forEach(([name, serialSet]) => {
                serialMap[name] = Array.from(serialSet).sort();
            });
            setSerialOptionsByItemName(serialMap);
        } catch (error) {
            console.error('Error fetching real inventory:', error);
            toast.error('Lỗi khi tải dữ liệu tồn thực tế');
        }
    };

    const warehouseOptions = useMemo(() =>
        warehouses.map(w => ({ value: w.id, label: w.name })),
        [warehouses]
    );

    // ── ROW MANAGEMENT ──

    const addRow = () => {
        setTransferItems(prev => [...prev, {
            id: Date.now().toString() + Math.random(),
            item_type: 'MAY',
            item_name: '',
            quantity: '',
            maxQuantity: 0,
            specific_codes: []
        }]);
    };

    const removeRow = (index) => {
        setTransferItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateRowType = (index, type) => {
        setTransferItems(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                item_type: type,
                item_name: '',
                quantity: '',
                maxQuantity: 0,
                specific_codes: []
            };
            return next;
        });
    };

    const updateRowName = (index, name) => {
        setTransferItems(prev => {
            const next = [...prev];
            const type = next[index].item_type;
            const availableItems = inventory.filter(i => {
                if (type === 'MAY') return i.item_type === 'MAY';
                if (type === 'BINH') return i.item_type === 'BINH';
                if (type === 'VAT_TU') return i.item_type === 'VAT_TU';
                return true;
            });
            const selected = availableItems.find(i => i.item_name === name);
            const maxQty = selected ? selected.quantity : 0;
            
            // Check if already exist in other rows to calculate remaining maxQty? 
            // Optional: for simplicity, rely on maxQty limits. But better to subtract already allocated.
            
            next[index] = {
                ...next[index],
                item_name: name,
                quantity: '',
                maxQuantity: maxQty,
                specific_codes: []
            };
            return next;
        });
    };

    const updateRowQuantity = (index, value) => {
        setTransferItems(prev => {
            const next = [...prev];
            const item = next[index];
            const maxQty = item.maxQuantity || 9999;
            const raw = value.replace(/\D/g, '');
            const num = raw === '' ? '' : Math.min(parseInt(raw, 10), maxQty);
            
            item.quantity = num;
            
            const needsSpecificCodes = item.item_type === 'MAY' || item.item_type === 'BINH';
            if (needsSpecificCodes) {
                const qty = num || 0;
                const currentCodes = [...item.specific_codes];
                if (currentCodes.length < qty) {
                    for (let i = currentCodes.length; i < qty; i++) {
                        currentCodes.push({ code: '', status: 'pending' });
                    }
                } else if (currentCodes.length > qty) {
                    currentCodes.length = qty;
                }
                item.specific_codes = currentCodes;
            } else {
                item.specific_codes = [];
            }
            return next;
        });
    };

    // ── SPECIFIC CODE HANDLING ──

    const handleCodeChange = (itemIdx, codeIdx, value) => {
        const normalizedVal = value.trim().toUpperCase();
        setTransferItems(prev => {
            const next = [...prev];
            const codes = [...next[itemIdx].specific_codes];
            codes[codeIdx] = { code: normalizedVal, status: 'pending' };
            next[itemIdx].specific_codes = codes;
            return next;
        });
    };

    const handleRemoveCode = (itemIdx, codeIdx) => {
        setTransferItems(prev => {
            const next = [...prev];
            const codes = [...next[itemIdx].specific_codes];
            codes[codeIdx] = { code: '', status: 'pending' };
            next[itemIdx].specific_codes = codes;
            return next;
        });
    };

    // Check for duplicate codes globally across all items
    const getDuplicateIndicesGlobally = () => {
        const seen = {};
        const duplicates = new Set(); // store string like "itemIdx-codeIdx"
        
        transferItems.forEach((item, itemIdx) => {
            if (!item.specific_codes) return;
            item.specific_codes.forEach((entry, codeIdx) => {
                if (!entry.code) return;
                const globalKey = entry.code;
                const currentLoc = `${itemIdx}-${codeIdx}`;
                if (seen[globalKey] !== undefined) {
                    duplicates.add(seen[globalKey]);
                    duplicates.add(currentLoc);
                } else {
                    seen[globalKey] = currentLoc;
                }
            });
        });
        return duplicates;
    };

    const duplicateIndicesSet = useMemo(() => getDuplicateIndicesGlobally(), [transferItems]);
    const getSerialSuggestions = (item, itemIdx, codeIdx, currentValue) => {
        const candidates = serialOptionsByItemName[item.item_name] || [];
        const normalizedCurrent = (currentValue || '').trim().toUpperCase();
        const usedCodes = new Set();

        transferItems.forEach((row, rowIdx) => {
            (row.specific_codes || []).forEach((entry, entryIdx) => {
                if (rowIdx === itemIdx && entryIdx === codeIdx) return;
                if (entry?.code) usedCodes.add(entry.code);
            });
        });

        return candidates
            .filter((code) => !usedCodes.has(code))
            .filter((code) => !normalizedCurrent || code.includes(normalizedCurrent))
            .slice(0, 20);
    };

    // Validate specific codes against database
    const validateCodes = async () => {
        let allValid = true;
        setIsValidating(true);
        try {
            // Group codes by table
            const cylindersToVerify = [];
            const machinesToVerify = [];

            transferItems.forEach((item) => {
                if (!item.item_name || !item.quantity || !item.item_type) return;
                const codes = item.specific_codes.filter(c => c.code).map(c => c.code);
                if (item.item_type === 'BINH') cylindersToVerify.push(...codes);
                if (item.item_type === 'MAY') machinesToVerify.push(...codes);
            });

            const dbMap = {}; // { tableName: { code: dbItem } }
            dbMap['cylinders'] = {};
            dbMap['machines'] = {};

            if (cylindersToVerify.length > 0) {
                const { data: cyls } = await supabase.from('cylinders').select('id, serial_number, status, warehouse_id').in('serial_number', cylindersToVerify);
                (cyls || []).forEach(c => dbMap['cylinders'][c.serial_number] = c);
            }

            if (machinesToVerify.length > 0) {
                const { data: macs } = await supabase.from('machines').select('id, serial_number, status, warehouse').in('serial_number', machinesToVerify);
                (macs || []).forEach(m => dbMap['machines'][m.serial_number] = m);
            }

            const updatedItems = transferItems.map((item) => {
                if (!item.item_name || item.item_type === 'VAT_TU') return item;
                
                const tableName = item.item_type === 'BINH' ? 'cylinders' : 'machines';
                const whColumn = item.item_type === 'BINH' ? 'warehouse_id' : 'warehouse';

                const updatedCodes = item.specific_codes.map(entry => {
                    if (!entry.code) return entry;
                    
                    const dbItem = dbMap[tableName][entry.code];
                    if (!dbItem) {
                        allValid = false;
                        return { ...entry, status: 'invalid', message: 'Mã không tồn tại' };
                    }
                    if (dbItem[whColumn] !== formData.from_warehouse_id) {
                        allValid = false;
                        return { ...entry, status: 'invalid', message: 'Không thuộc kho xuất' };
                    }
                    const currentStatus = (dbItem.status || '').toLowerCase();
                    const isCylinderAndAllowedStatus = item.item_type === 'BINH' && (currentStatus === 'sẵn sàng' || currentStatus === 'bình rỗng');
                    const isMachineAndAllowedStatus = item.item_type === 'MAY' && currentStatus === 'sẵn sàng';

                    if (!isCylinderAndAllowedStatus && !isMachineAndAllowedStatus) {
                        allValid = false;
                        return { ...entry, status: 'invalid', message: `Trạng thái: ${dbItem.status}` };
                    }
                    return { ...entry, status: 'valid', message: 'Hợp lệ', dbId: dbItem.id };
                });

                return { ...item, specific_codes: updatedCodes };
            });

            setTransferItems(updatedItems);
            return { allValid, updatedItems };
        } catch (error) {
            console.error('Validation error:', error);
            toast.error('Lỗi kiểm tra mã: ' + error.message);
            return { allValid: false, updatedItems: transferItems };
        } finally {
            setIsValidating(false);
        }
    };

    // Scanner helpers
    const startScannerCode = (itemIdx, codeIdx) => {
        setScanTargetItemIdx(itemIdx);
        setScanTargetCodeIdx(codeIdx);
        setIsScannerOpen(true);
    };

    const startScanAllForItem = (itemIdx) => {
        const firstEmpty = transferItems[itemIdx].specific_codes.findIndex(c => !c.code);
        if (firstEmpty === -1) {
            toast.info('Đã điền đủ mã cho mặt hàng này!');
            return;
        }
        startScannerCode(itemIdx, firstEmpty);
    };

    const handleScanSuccess = useCallback((decodedText) => {
        const normalizedText = decodedText.trim().toUpperCase();
        const { itemIdx, codeIdx } = scanRef.current;
        if (itemIdx === -1 || codeIdx === -1) return;

        setTransferItems(prev => {
            const next = [...prev];
            const item = next[itemIdx];
            const codes = [...item.specific_codes];
            
            // Local & Global duplicate check inside scanner
            // (We could just rely on global check but it's nice to prevent insert)
            const isDuplicateLocal = codes.some((c, i) => i !== codeIdx && c.code === normalizedText);
            let isDuplicateGlobal = false;
            next.forEach((it, i) => {
                if (i !== itemIdx) {
                    if (it.specific_codes && it.specific_codes.some(c => c.code === normalizedText)) {
                        isDuplicateGlobal = true;
                    }
                }
            });

            if (isDuplicateLocal || isDuplicateGlobal) {
                toast.warn(`Mã ${normalizedText} đã được nhập!`, { toastId: `dup-${normalizedText}` });
                return prev;
            }

            codes[codeIdx] = { code: normalizedText, status: 'pending' };
            next[itemIdx].specific_codes = codes;

            // Auto advance within the SAME item
            const nextEmpty = codes.findIndex((c, i) => i > codeIdx && !c.code);
            if (nextEmpty !== -1) {
                setScanTargetItemIdx(itemIdx); // Keep same
                setScanTargetCodeIdx(nextEmpty);
            } else {
                setIsScannerOpen(false);
                setScanTargetItemIdx(-1);
                setScanTargetCodeIdx(-1);
                toast.success(`Đã quét xong mục này!`);
            }

            return next;
        });
    }, []);

    // ── SUBMIT HANDLER ──

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.from_warehouse_id || !formData.to_warehouse_id) {
            toast.error('Vui lòng chọn đầy đủ kho xuất và kho nhận');
            return;
        }
        if (formData.from_warehouse_id === formData.to_warehouse_id) {
            toast.error('Kho đi và kho đến không được trùng nhau');
            return;
        }

        // Validate items
        const validItems = transferItems.filter(item => item.item_name && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Vui lòng thêm ít nhất một mặt hàng và số lượng chuyển');
            return;
        }

        // Check stock
        // Group by item_name to handle multiple lines of the SAME item_name (if any)
        const totalQtyByName = {};
        let stockError = '';
        for (const it of validItems) {
             if (!totalQtyByName[it.item_name]) totalQtyByName[it.item_name] = 0;
             totalQtyByName[it.item_name] += it.quantity;
             if (totalQtyByName[it.item_name] > it.maxQuantity) {
                 stockError = `Tổng số lượng điều chuyển của ${it.item_name} vượt quá tồn kho (${it.maxQuantity})`;
                 break;
             }
        }
        if (stockError) {
            toast.error(stockError);
            return;
        }

        // Validate specific codes
        let codesError = '';
        for (const it of validItems) {
            const needsSpecificCodes = it.item_type === 'MAY' || it.item_type === 'BINH';
            if (needsSpecificCodes) {
                const filledCodes = it.specific_codes.filter(c => c.code);
                if (filledCodes.length !== it.quantity) {
                    codesError = `Mặt hàng [${it.item_name}] cần nhập đúng ${it.quantity} mã. Đã nhập: ${filledCodes.length}`;
                    break;
                }
            }
        }
        if (codesError) {
            toast.error(codesError);
            return;
        }

        // Check for duplicates
        if (duplicateIndicesSet.size > 0) {
            toast.error('Phát hiện mã máy/bình bị trùng lặp, vui lòng kiểm tra lại!');
            return;
        }

        // DB validation
        const { allValid, updatedItems } = await validateCodes();
        if (!allValid) {
            toast.error('Một số mã không hợp lệ. Vui lòng kiểm tra lại các mã đánh dấu đỏ.');
            return;
        }

        const validItemsToSubmit = updatedItems.filter(item => item.item_name && item.quantity > 0);

        setLoading(true);
        try {
            const transferCode = `TRF${Date.now().toString().slice(-6)}`;
            const toName = warehouses.find(w => w.id === formData.to_warehouse_id)?.name;
            const fromName = warehouses.find(w => w.id === formData.from_warehouse_id)?.name;
            const currentUserName =
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                'Hệ thống';

            const requestItems = validItemsToSubmit.map((item) => ({
                item_type: item.item_type,
                item_name: item.item_name,
                quantity: item.quantity,
                maxQuantity: item.maxQuantity,
                specific_codes: (item.specific_codes || []).map((entry) => ({
                    code: entry.code || '',
                    status: entry.status || 'pending',
                    message: entry.message || '',
                    dbId: entry.dbId || null
                }))
            }));

            const totalQuantity = requestItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const { error: requestError } = await supabase
                .from('inventory_transfer_requests')
                .insert([{
                    transfer_code: transferCode,
                    from_warehouse_id: formData.from_warehouse_id,
                    to_warehouse_id: formData.to_warehouse_id,
                    status: 'CHO_DUYET',
                    note: formData.note || '',
                    handover_image_url: uploadedImage || null,
                    items_json: requestItems,
                    total_quantity: totalQuantity,
                    created_by: currentUserName
                }]);

            if (requestError) throw requestError;

            await notificationService.add({
                title: 'Tạo yêu cầu điều chuyển kho',
                description: `Phiếu ${transferCode} từ ${fromName} tới ${toName} đang chờ duyệt.`,
                type: 'info',
                link: '/danh-sach-dieu-chuyen'
            });

            toast.success('Đã tạo phiếu điều chuyển, chờ thủ kho/Admin duyệt!');
            navigate('/danh-sach-dieu-chuyen');
        } catch (error) {
            console.error('Transfer error:', error);
            toast.error('Lỗi khi điều chuyển: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ── HELPERS ──
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

    return (
        <div className="fixed md:static inset-0 z-[100] md:z-auto w-full md:flex-1 flex flex-col px-4 pt-16 pb-4 sm:p-6 bg-slate-50 overflow-y-auto md:overflow-visible custom-scrollbar md:min-h-screen">
            {/* Page Header */}
            <div className="hidden md:flex max-w-5xl mx-auto w-full mb-8 flex-col md:flex-row md:items-center justify-center relative gap-4 md:gap-6">
                <button
                    onClick={() => navigate(-1)}
                    className="md:absolute md:left-0 self-start md:self-auto !h-9 !px-3 md:!h-10 md:!px-4 flex items-center justify-center gap-1.5 md:gap-2 bg-white border border-slate-200 rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-slate-800 shadow-sm"
                >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                    <span className="font-bold text-[13px] md:text-[14px]">Quay lại</span>
                </button>
                <div className="hidden md:flex flex-col text-center">
                    <h1 className="text-[22px] md:text-2xl font-bold text-slate-900 tracking-tight leading-tight">Thêm Mới Phiếu Điều Chuyển Hàng Loạt</h1>
                    <p className="text-[12px] md:text-[13px] text-slate-500 font-medium">Chọn xuất nhiều mặt hàng trong cùng 1 lần chuyển</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto w-full">
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
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, from_warehouse_id: val }))}
                                        placeholder="Chọn kho xuất..."
                                        searchPlaceholder="Tìm kho..."
                                        disabled={role !== 'Admin' && department}
                                    />
                                </div>
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
                            <div className="hidden md:flex absolute left-1/2 top-[52px] -translate-x-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center text-primary/40 z-10 pointer-events-none">
                                <ArrowRight size={20} />
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary mb-1.5">
                                <ClipboardList className="w-4 h-4 text-primary/70" /> Ghi chú điều chuyển tổng (Tùy chọn)
                            </label>
                            <input
                                type="text"
                                className="w-full h-11 md:h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14.5px] font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-inner"
                                placeholder="Nhập chung lý do..."
                                value={formData.note}
                                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                            <div className="flex items-center gap-2.5">
                                <Package className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary">Các Món Hàng Điều Chuyển</h4>
                            </div>
                            <button
                                type="button"
                                onClick={addRow}
                                className="flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-xl text-[12.5px] font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                            >
                                <Plus size={16} /> Thêm Dòng
                            </button>
                        </div>

                        <div className="space-y-4">
                            {transferItems.map((item, itemIdx) => {
                                const needsScan = item.item_type === 'MAY' || item.item_type === 'BINH';
                                const filledCount = item.specific_codes ? item.specific_codes.filter(c => c.code).length : 0;
                                const totalSlots = item.specific_codes ? item.specific_codes.length : 0;

                                // Filter options for THIS item
                                const availableForThisType = inventory.filter(i => {
                                    if (item.item_type === 'MAY') return i.item_type === 'MAY';
                                    if (item.item_type === 'BINH') return i.item_type === 'BINH';
                                    if (item.item_type === 'VAT_TU') return i.item_type === 'VAT_TU';
                                    return true;
                                });
                                const optionsList = availableForThisType.map(i => ({
                                    value: i.item_name, label: `${i.item_name} (Tồn: ${i.quantity})`
                                }));

                                return (
                                    <div key={item.id} className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4 shadow-sm">
                                        {/* Remove line button */}
                                        {transferItems.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeRow(itemIdx)}
                                                className="absolute top-4 right-4 text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-3 pr-8 md:pr-10">
                                            {/* Type */}
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-[12px] font-bold text-slate-500">Phân loại</label>
                                                <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
                                                    {['MAY', 'BINH', 'VAT_TU'].map(type => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => updateRowType(itemIdx, type)}
                                                            className={clsx(
                                                                "flex-1 !h-8 py-0.5 px-1 rounded-lg text-[11px] font-bold transition-all",
                                                                item.item_type === type
                                                                    ? "bg-slate-100 text-primary shadow-sm"
                                                                    : "bg-transparent text-slate-400 hover:text-slate-600"
                                                            )}
                                                        >
                                                            {type === 'MAY' ? 'Máy' : type === 'BINH' ? 'Bình' : 'Vật tư'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Name */}
                                            <div className="md:col-span-6 space-y-1">
                                                <label className="text-[12px] font-bold text-slate-500">Tên hàng hóa</label>
                                                <SearchableSelect
                                                    options={optionsList}
                                                    value={item.item_name}
                                                    onValueChange={(val) => updateRowName(itemIdx, val)}
                                                    disabled={!formData.from_warehouse_id}
                                                    placeholder="Chọn vật tư..."
                                                    searchPlaceholder="Tìm kiếm..."
                                                    className="!h-10 !rounded-xl text-[13px]"
                                                />
                                            </div>

                                            {/* Quantity */}
                                            <div className="md:col-span-3 space-y-1">
                                                <label className="text-[12px] font-bold text-slate-500">Số lượng (SL)</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={item.quantity}
                                                        onChange={(e) => updateRowQuantity(itemIdx, e.target.value)}
                                                        className="w-full h-10 pl-3 pr-16 bg-white border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                                        placeholder="0"
                                                        disabled={!item.item_name}
                                                    />
                                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-1 rounded truncate max-w-[50px]">
                                                        Max:{item.maxQuantity}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SCANNERS FOR THIS ROW */}
                                        {needsScan && item.quantity > 0 && item.item_name && (
                                            <div className="mt-3 pt-3 border-t border-slate-200">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <ScanLine size={14} className="text-primary" />
                                                        <span className="text-[13px] font-bold text-primary">Chi tiết mã {item.item_type === 'BINH' ? 'Bình' : 'Máy'} ({filledCount}/{totalSlots})</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={validateCodes}
                                                            disabled={isValidating || filledCount === 0}
                                                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[12px] font-bold rounded-lg hover:bg-slate-50 transition-all disabled:opacity-50"
                                                        >
                                                            {isValidating ? 'Đang...' : 'Kiểm tra mã'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => startScanAllForItem(itemIdx)}
                                                            className="px-3 py-1.5 bg-primary/10 text-primary text-[12px] font-bold rounded-lg hover:bg-primary/20 transition-all"
                                                        >
                                                            <ScanLine size={14} className="inline mr-1"/> Quét Camera
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                                    {item.specific_codes.map((entry, codeIdx) => {
                                                        const isDup = duplicateIndicesSet.has(`${itemIdx}-${codeIdx}`);
                                                        return (
                                                            <div key={codeIdx} className="relative group">
                                                                <div className="relative">
                                                                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10">
                                                                        {getStatusIcon(isDup ? 'invalid' : entry.status)}
                                                                    </div>
                                                                    <input
                                                                        value={entry.code}
                                                                        onChange={(e) => handleCodeChange(itemIdx, codeIdx, e.target.value)}
                                                                        list={`transfer-serial-options-${itemIdx}-${codeIdx}`}
                                                                        placeholder={`Mã #${codeIdx + 1}`}
                                                                        className={clsx(
                                                                            "w-full h-9 pl-8 pr-16 border rounded-lg text-[12px] font-mono font-bold transition-all outline-none focus:ring-2 focus:ring-primary/10",
                                                                            getStatusBorder(isDup ? 'invalid' : entry.status, isDup)
                                                                        )}
                                                                    />
                                                                    <datalist id={`transfer-serial-options-${itemIdx}-${codeIdx}`}>
                                                                        {getSerialSuggestions(item, itemIdx, codeIdx, entry.code).map((code) => (
                                                                            <option key={code} value={code} />
                                                                        ))}
                                                                    </datalist>
                                                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => startScannerCode(itemIdx, codeIdx)}
                                                                            className="p-1 text-primary/40 hover:text-primary transition-all"
                                                                        >
                                                                            <ScanLine size={12} />
                                                                        </button>
                                                                        {entry.code && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveCode(itemIdx, codeIdx)}
                                                                                className="p-1 text-slate-400 hover:text-rose-500 transition-all ml-0.5"
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {entry.status !== 'pending' && entry.message && (
                                                                    <p className={clsx("text-[9px] font-bold mt-0.5 ml-1", entry.status === 'valid' ? "text-emerald-600" : "text-rose-500")}>
                                                                        {entry.message}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            
                            {transferItems.length === 0 && (
                                <div className="text-center py-6 text-slate-400 text-[13px] font-semibold border-2 border-dashed border-slate-200 rounded-2xl">
                                    Vui lòng nhấn "Thêm Dòng" để bắt đầu chọn hàng hóa
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Certs Section */}
                    <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary">Chứng từ và Hình Ảnh Bàn Giao</h4>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">Biên Bản Bàn Giao (In Hàng Loạt)</label>
                                <button
                                    type="button"
                                    onClick={handlePrintBBBG}
                                    disabled={!formData.to_warehouse_id || transferItems.filter(i => i.item_name).length === 0}
                                    className="w-full h-11 md:h-12 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-2xl transition-all disabled:opacity-50"
                                >
                                    <Printer size={18} /> In Biên Bản (Mẫu CHS)
                                </button>
                                <p className="text-[11px] text-slate-500 italic mt-1 px-1">Cho phép in BBBG tổng hợp các mặt hàng.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">Ảnh chụp bàn giao (BBBG đã ký...)</label>
                                {uploadedImage ? (
                                    <div className="relative h-11 md:h-12 rounded-2xl border border-emerald-500 bg-emerald-50 flex items-center justify-between px-3 group overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon size={18} className="text-emerald-600" />
                                            <span className="text-[13px] font-bold text-emerald-700 truncate max-w-[150px]">Ảnh đính kèm</span>
                                            <a href={uploadedImage} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-600 underline">Xem</a>
                                        </div>
                                        <button type="button" onClick={() => setUploadedImage(null)} className="p-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition-colors"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="relative h-11 md:h-12">
                                        <input type="file" accept="image/*" capture="environment" onChange={handleUploadImage} disabled={uploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        <div className="w-full h-full border border-dashed border-primary/40 rounded-2xl flex items-center justify-center gap-2 text-primary/70 bg-primary/5 hover:bg-primary/10 transition-colors">
                                            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                                            <span className="text-[13px] font-bold">{uploading ? 'Đang tải...' : 'Chụp/Tải ảnh'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {printBBBG && createPortal(
                        <div className="print-only-content">
                            <MachineHandoverPrintTemplate orders={[mockOrderForBBBG]} />
                        </div>,
                        document.body
                    )}

                    <div className="fixed md:static z-40 bottom-0 left-0 right-0 border-t md:border-none border-slate-200 p-4 md:p-0 bg-white md:bg-transparent flex flex-col-reverse sm:flex-row gap-3 md:gap-4 pt-4 items-center justify-end shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] md:shadow-none pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-16 mt-6 md:mt-0">
                        <button type="button" onClick={() => navigate(-1)} className="w-full sm:w-auto px-6 py-3 font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-[14px]">
                            Hủy bỏ
                        </button>
                        <button type="submit" disabled={loading || isValidating} className={clsx("w-full sm:w-auto px-8 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50", "bg-primary text-white border-primary/40 hover:bg-primary/90 shadow-primary/20", (loading || isValidating) && "opacity-70 cursor-not-allowed")}>
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Ghi Nhận Chuyển Kho
                        </button>
                    </div>
                </form>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => { setIsScannerOpen(false); setScanTargetItemIdx(-1); setScanTargetCodeIdx(-1); }}
                onScanSuccess={handleScanSuccess}
                title={scanTargetItemIdx >= 0 ? `Quét Mã ${(transferItems[scanTargetItemIdx]?.item_type) === 'BINH' ? 'Bình' : 'Máy'} #${scanTargetCodeIdx + 1}` : 'Quét Mã'}
                elementId="transfer-barcode-reader"
                currentCount={scanTargetItemIdx >= 0 ? transferItems[scanTargetItemIdx].specific_codes.filter(c => c.code).length : 0}
                totalCount={scanTargetItemIdx >= 0 ? transferItems[scanTargetItemIdx].specific_codes.length : 0}
            />
        </div>
    );
};

export default InventoryTransfer;
