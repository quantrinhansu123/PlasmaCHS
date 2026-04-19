import clsx from 'clsx';
import {
    Camera,
    CheckCircle2,
    ChevronDown,
    Clock,
    Edit3,
    Hash,
    Package,
    PackageMinus,
    Plus,
    Save,
    ScanLine,
    Trash2,
    User,
    X,
    LayoutGrid,
    StickyNote,
    Calendar,
    Search,
    CheckSquare,
    Square
} from 'lucide-react';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import BarcodeScanner from '../Common/BarcodeScanner';
import InventoryPickerModal from './InventoryPickerModal';
import InventorySearchableSelect from './InventorySearchableSelect';
import { ISSUE_TYPES } from '../../constants/goodsIssueConstants';
import { PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';

export default function GoodsIssueFormModal({ issue, onClose, onSuccess, forcedType }) {
    const isEdit = !!issue;
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [activeScanningIndex, setActiveScanningIndex] = useState(null);
    const [isInventoryPickerOpen, setIsInventoryPickerOpen] = useState(false);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [inventorySearchTerm, setInventorySearchTerm] = useState('');
    const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
    const [manualReturnType, setManualReturnType] = useState('BINH_4L');
    const [manualReturnQty, setManualReturnQty] = useState('1');

    const [formData, setFormData] = useState({
        issue_code: '',
        issue_date: new Date().toISOString().split('T')[0],
        issue_type: forcedType || 'TRA_VO',
        supplier_id: '',
        warehouse_id: '',
        notes: '',
        total_items: 0,
        status: 'HOAN_THANH'
    });

    const [items, setItems] = useState([
        { id: Date.now(), item_type: 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }
    ]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        loadSuppliers();
        fetchWarehouses();
        if (issue) {
            const { id, created_at, ...editData } = issue;
            setFormData(editData);
            fetchItems(issue.id);
        } else {
            generateCode();
            if (forcedType) {
                setFormData(prev => ({
                    ...prev,
                    issue_type: forcedType,
                    notes: (forcedType === 'TRA_VO' || forcedType === 'TRA_MAY') ? 'Khách hàng trả' : prev.notes
                }));
            }
        }
    }, [issue, forcedType]);

    useEffect(() => {
        if (formData.warehouse_id && ['TRA_VO', 'TRA_BINH_LOI', 'TRA_MAY'].includes(formData.issue_type)) {
            fetchInventory();
        }
    }, [formData.warehouse_id, formData.issue_type]);

    const fetchItems = async (issueId) => {
        const { data } = await supabase
            .from('goods_issue_items')
            .select('*')
            .eq('issue_id', issueId);
        if (data && data.length > 0) {
            setItems(data.map(item => ({ ...item, _search: '' })));
        }
    };

    const generateCode = async () => {
        const date = new Date();
        const yy = date.getFullYear().toString().slice(2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `PX${yy}${mm}`;

        try {
            const { data, error } = await supabase
                .from('goods_issues')
                .select('issue_code')
                .like('issue_code', `${prefix}%`)
                .order('issue_code', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const lastCode = data[0].issue_code;
                const lastNum = parseInt(lastCode.slice(-3));
                const newNum = (lastNum + 1).toString().padStart(3, '0');
                setFormData(prev => ({ ...prev, issue_code: `${prefix}${newNum}` }));
            } else {
                setFormData(prev => ({ ...prev, issue_code: `${prefix}001` }));
            }
        } catch (e) {
            console.error('Lỗi khi tạo mã:', e);
            setFormData(prev => ({ ...prev, issue_code: `${prefix}001` }));
        }
    };

    const loadSuppliers = async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name')
                .order('name');
            if (!error && data) setSuppliers(data);
        } catch (e) {
            console.error(e);
        }
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

    const addItem = () => {
        setItems([...items, { id: Date.now(), item_type: formData.issue_type === 'TRA_MAY' ? 'MAY' : 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }]);
    };

    const fetchInventory = async () => {
        if (!formData.warehouse_id) return;

        setIsInventoryLoading(true);
        // We don't necessarily open the picker modal here, just load the items
        // setIsInventoryPickerOpen(true); 

        try {
            if (formData.issue_type === 'TRA_MAY') {
                const { data, error } = await supabase
                    .from('machines')
                    .select('*')
                    .eq('warehouse', formData.warehouse_id)
                    .not('status', 'in', '("thuộc khách hàng")');
                if (error) throw error;
                setInventoryItems(data || []);
            } else {
                let query = supabase
                    .from('cylinders')
                    .select('*')
                    .eq('warehouse_id', formData.warehouse_id);

                // Return-empty cylinders should allow selecting all cylinders in the warehouse.
                if (formData.issue_type !== 'TRA_VO') {
                    query = query.not('status', 'in', '("đang sử dụng", "thuộc khách hàng")');
                }

                const { data, error } = await query;
                if (error) throw error;
                setInventoryItems(data || []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setIsInventoryLoading(false);
        }
    };

    const updateItemWithInventory = (id, serial) => {
        const inventoryItem = inventoryItems.find(i => i.serial_number === serial);
        if (!inventoryItem) {
            updateItem(id, 'item_code', serial);
            return;
        }

        const productType = mapToProductType(inventoryItem);
        
        setItems(items.map(it => it.id === id ? { 
            ...it, 
            item_code: serial, 
            item_id: inventoryItem.id,
            item_type: productType 
        } : it));
    };

    const mapToProductType = (item) => {
        if (formData.issue_type === 'TRA_MAY') {
            if (item.machine_type === 'BV') return 'MAY_MED';
            if (item.machine_type === 'TM') return 'MAY_ROSY';
            return 'MAY_MED'; // Default
        } else {
            if (item.volume?.includes('4L')) return 'BINH_4L';
            if (item.volume?.includes('8L')) return 'BINH_8L';
            return 'BINH_4L'; // Default
        }
    };

    const toggleInventoryItem = (inventoryItem) => {
        const isSelected = items.some(it => it.item_id === inventoryItem.id);
        
        if (isSelected) {
            // Remove
            setItems(items.filter(it => it.item_id !== inventoryItem.id));
        } else {
            // Add
            const productType = mapToProductType(inventoryItem);
            const newItem = {
                id: Date.now() + Math.random(),
                item_type: productType,
                item_id: inventoryItem.id,
                item_code: inventoryItem.serial_number,
                quantity: 1,
                _search: ''
            };
            
            // Remove any empty row if it's the only one
            if (items.length === 1 && !items[0].item_code) {
                setItems([newItem]);
            } else {
                setItems([...items, newItem]);
            }
        }
    };

    const addInventoryItemIfMissing = useCallback((inventoryItem) => {
        const alreadySelected = items.some(it => it.item_id === inventoryItem.id);
        if (alreadySelected) return false;

        const productType = mapToProductType(inventoryItem);
        const newItem = {
            id: Date.now() + Math.random(),
            item_type: productType,
            item_id: inventoryItem.id,
            item_code: inventoryItem.serial_number,
            quantity: 1,
            _search: ''
        };

        if (items.length === 1 && !items[0].item_code && !items[0].item_id) {
            setItems([newItem]);
        } else {
            setItems(prev => [...prev, newItem]);
        }
        return true;
    }, [items, mapToProductType]);

    const handleConfirmInventorySelection = (selectedIds) => {
        const selectedItems = inventoryItems.filter(item => selectedIds.includes(item.id));
        if (selectedItems.length === 0) {
            setIsInventoryPickerOpen(false);
            return;
        }

        const mapToProductType = (item) => {
            if (formData.issue_type === 'TRA_MAY') {
                if (item.machine_type === 'BV') return 'MAY_MED';
                if (item.machine_type === 'TM') return 'MAY_ROSY';
                return 'MAY_MED'; // Default
            } else {
                if (item.volume?.includes('4L')) return 'BINH_4L';
                if (item.volume?.includes('8L')) return 'BINH_8L';
                return 'BINH_4L'; // Default
            }
        };

        const newItems = selectedItems.map(item => ({
            id: Date.now() + Math.random(),
            item_type: mapToProductType(item),
            item_id: item.id,
            item_code: item.serial_number,
            quantity: 1,
            _search: ''
        }));

        // Filter out empty items from current list
        const currentValidItems = items.filter(i => i.item_code || i.item_id);
        
        setItems([...currentValidItems, ...newItems]);
        setIsInventoryPickerOpen(false);
    };

    const filteredInventory = useMemo(() => {
        if (!inventorySearchTerm) return inventoryItems;
        const s = inventorySearchTerm.toLowerCase();
        return inventoryItems.filter(item => 
            item.serial_number?.toLowerCase().includes(s) || 
            item.machine_type?.toLowerCase().includes(s) ||
            item.volume?.toLowerCase().includes(s)
        );
    }, [inventoryItems, inventorySearchTerm]);

    const removeItem = (id) => {
        if (items.length <= 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const openScanner = (index) => {
        setActiveScanningIndex(index);
        setIsScannerOpen(true);
    };

    const handleScanSuccess = (code) => {
        const normalizedCode = (code || '').toString().trim();
        if (!normalizedCode) return;

        if (activeScanningIndex !== null) {
            const itemToUpdate = items[activeScanningIndex];

            // For machine issue, only accept serials that exist in current warehouse suggestion list.
            if (formData.issue_type === 'TRA_MAY') {
                const matchedMachine = inventoryItems.find(
                    (i) => (i.serial_number || '').trim().toUpperCase() === normalizedCode.toUpperCase()
                );
                if (!matchedMachine) {
                    notificationService.add({
                        title: 'Mã máy không hợp lệ',
                        description: `Mã ${normalizedCode} không thuộc danh sách máy sẵn sàng của kho đã chọn.`,
                        type: 'error'
                    });
                    return;
                }
                updateItemWithInventory(itemToUpdate.id, matchedMachine.serial_number);
            } else {
                updateItem(itemToUpdate.id, 'item_code', normalizedCode);
            }

            setIsScannerOpen(false);
            setActiveScanningIndex(null);
        } else {
            // Batch scanning for "Chọn nhanh"
            const invItem = inventoryItems.find(
                (i) => (i.serial_number || '').trim().toUpperCase() === normalizedCode.toUpperCase()
            );
            if (invItem) {
                const wasAdded = addInventoryItemIfMissing(invItem);
                notificationService.add({
                    title: wasAdded ? 'Đã thêm vỏ từ QR' : 'Mã đã được quét',
                    description: wasAdded ? normalizedCode : `${normalizedCode} đã tồn tại trong danh sách`,
                    type: wasAdded ? 'success' : 'warning'
                });
            } else {
                notificationService.add({
                    title: 'Không tìm thấy mã trong kho',
                    description: normalizedCode,
                    type: 'error'
                });
            }
            // Keep scanner open for continuous scanning if desired, 
            // but usually users scan one by one. Let's close it to be safe or keep it?
            // User said "nút quét qr cạnh chọn toàn bộ list" which implies batch.
            // Let's keep it open if it's batch scan.
        }
    };

    useEffect(() => {
        if (formData.issue_type !== 'TRA_VO') return;

        const targetQty = Number(manualReturnQty);
        if (!Number.isInteger(targetQty) || targetQty < 1) return;

        setItems(prev => {
            const nonManualRows = prev.filter(it => {
                if (it._manualQuick) return false;
                // Avoid keeping placeholder rows without serial in auto-sync mode.
                return Boolean(it.item_id || (it.item_code || '').trim());
            });
            const currentManualRows = prev.filter(it => it._manualQuick && it.item_type === manualReturnType);
            const keptManualRows = currentManualRows.slice(0, targetQty);

            if (keptManualRows.length < targetQty) {
                const rowsToAdd = targetQty - keptManualRows.length;
                for (let idx = 0; idx < rowsToAdd; idx += 1) {
                    keptManualRows.push({
                        id: Date.now() + Math.random() + idx,
                        item_type: manualReturnType,
                        item_id: null,
                        item_code: '',
                        quantity: 1,
                        _search: '',
                        _manualQuick: true
                    });
                }
            }

            const nextItems = [...nonManualRows, ...keptManualRows];
            if (nextItems.length === prev.length && nextItems.every((row, idx) => row.id === prev[idx].id)) {
                return prev;
            }
            return nextItems;
        });
    }, [formData.issue_type, manualReturnQty, manualReturnType]);

    useEffect(() => {
        const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        setFormData(prev => ({ ...prev, total_items: total }));
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const isReturnToSupplier = ['TRA_VO', 'TRA_BINH_LOI', 'TRA_MAY'].includes(formData.issue_type);
        if (!formData.supplier_id && isReturnToSupplier) {
            alert('Vui lòng chọn Nhà cung cấp khi trả hàng!');
            return;
        }

        if (formData.issue_type === 'TRA_VO') {
            const targetQty = Number(manualReturnQty);
            if (!Number.isInteger(targetQty) || targetQty < 1) {
                alert('Số lượng vỏ phải lớn hơn 0.');
                return;
            }
        }

        if (formData.issue_type === 'TRA_VO') {
            const manualRows = items.filter(i => i._manualQuick);
            const missingCodes = manualRows.filter(i => !(i.item_id || (i.item_code || '').trim()));
            if (missingCodes.length > 0) {
                alert('Vui lòng nhập/quét đủ mã cho toàn bộ số lượng vỏ cần trả.');
                return;
            }
        }

        const validItems = items.filter(i => {
            const qty = Number(i.quantity) || 0;
            const hasCode = Boolean(i.item_id || (i.item_code || '').trim());
            return hasCode && qty > 0;
        });
        if (validItems.length === 0) {
            alert('Vui lòng điền ít nhất 1 sản phẩm cần xuất!');
            return;
        }

        if (formData.issue_type === 'TRA_VO') {
            const invalidRows = items.filter(i => (Number(i.quantity) || 0) > 1);
            if (invalidRows.length > 0) {
                alert('Mỗi vỏ trả phải tương ứng 1 mã serial. Vui lòng để số lượng mỗi dòng bằng 1.');
                return;
            }
        }

        if (formData.issue_type === 'TRA_MAY') {
            const invalidRows = validItems.filter((i) => {
                const qty = Number(i.quantity) || 0;
                return qty !== 1;
            });
            if (invalidRows.length > 0) {
                alert('Mỗi máy phải tương ứng đúng 1 mã serial. Vui lòng để số lượng mỗi dòng bằng 1.');
                return;
            }

            const missingItemIdRows = validItems.filter((i) => !i.item_id || !(i.item_code || '').trim());
            if (missingItemIdRows.length > 0) {
                alert('Phiếu xuất máy chỉ được chọn từ danh sách máy sẵn sàng trong kho. Không dùng mã nhập tay linh tinh.');
                return;
            }

            const serials = validItems.map((i) => (i.item_code || '').trim().toUpperCase()).filter(Boolean);
            const uniqueSerials = new Set(serials);
            if (uniqueSerials.size !== serials.length) {
                alert('Danh sách mã máy đang bị trùng. Vui lòng kiểm tra lại.');
                return;
            }

            const { data: machineRows, error: machineError } = await supabase
                .from('machines')
                .select('id, serial_number, status, warehouse')
                .in('serial_number', [...uniqueSerials]);

            if (machineError) {
                alert('Không thể kiểm tra mã máy trong kho: ' + machineError.message);
                return;
            }

            const normalizedWarehouse = (formData.warehouse_id || '').trim();
            const dbMap = new Map((machineRows || []).map((m) => [String(m.serial_number || '').trim().toUpperCase(), m]));
            const invalidSerial = [...uniqueSerials].find((serial) => {
                const machine = dbMap.get(serial);
                if (!machine) return true;
                if (String(machine.warehouse || '').trim() !== normalizedWarehouse) return true;
                if (String(machine.status || '').toLowerCase().trim() === 'thuộc khách hàng') return true;
                return false;
            });

            if (invalidSerial) {
                alert(`Mã máy ${invalidSerial} không hợp lệ với kho hiện tại hoặc không còn trạng thái sẵn sàng.`);
                return;
            }
        }

        setIsLoading(true);
        try {
            const issuePayload = { ...formData };
            delete issuePayload.id;
            delete issuePayload.created_at;

            let issueId;

            if (isEdit) {
                const { error: issueError } = await supabase
                    .from('goods_issues')
                    .update(issuePayload)
                    .eq('id', issue.id);

                if (issueError) throw issueError;
                issueId = issue.id;
                await supabase.from('goods_issue_items').delete().eq('issue_id', issueId);
            } else {
                const { data: issueData, error: issueError } = await supabase
                    .from('goods_issues')
                    .insert([issuePayload])
                    .select()
                    .single();

                if (issueError) {
                    if (issueError.code === '23505') {
                        await generateCode();
                        alert('⚠️ Mã phiếu xuất này đã tồn tại trên hệ thống. Hệ thống đã tự động cập nhật mã mới tiếp theo, vui lòng nhấn "Lưu" một lần nữa!');
                        setIsLoading(false);
                        return;
                    }
                    throw issueError;
                }
                issueId = issueData.id;
            }

            const itemPayloads = validItems.map(item => ({
                issue_id: issueId,
                item_type: item.item_type,
                item_id: item.item_id || null,
                item_code: item.item_code || '',
                quantity: Number(item.quantity) || 1
            }));

            const { error: itemsError } = await supabase
                .from('goods_issue_items')
                .insert(itemPayloads);

            if (itemsError) throw itemsError;

            // INVENTORY DEDUCTION: Deduct from warehouse inventory when creating a new goods issue
            if (!isEdit) {
                // Group items by product type for inventory deduction
                const itemsByType = {};
                for (const item of validItems) {
                    const productLabel = PRODUCT_TYPES.find(p => p.id === item.item_type)?.label || item.item_type;
                    const itemType = item.item_type?.startsWith('BINH') ? 'BINH' : 'MAY';
                    const key = `${itemType}::${productLabel}`;
                    itemsByType[key] = (itemsByType[key] || 0) + (Number(item.quantity) || 1);
                }

                for (const [key, qty] of Object.entries(itemsByType)) {
                    const [itemType, itemName] = key.split('::');
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('id, quantity')
                        .eq('warehouse_id', formData.warehouse_id)
                        .eq('item_type', itemType)
                        .ilike('item_name', itemName.trim())
                        .maybeSingle();

                    if (invData) {
                        await supabase
                            .from('inventory')
                            .update({ quantity: Math.max(0, invData.quantity - qty) })
                            .eq('id', invData.id);

                        await supabase.from('inventory_transactions').insert([{
                            inventory_id: invData.id,
                            transaction_type: 'OUT',
                            reference_id: issueId,
                            reference_code: formData.issue_code,
                            quantity_changed: qty,
                            note: `Xuất kho ${qty} ${itemName} - Phiếu ${formData.issue_code}`
                        }]);
                    }
                }
            }

            // Global notification for new goods issue
            if (!isEdit) {
                const typeLabel = ISSUE_TYPES.find(t => t.id === formData.issue_type)?.label || 'Xuất kho';
                const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || '';
                notificationService.add({
                    title: `📤 ${typeLabel}: #${formData.issue_code}`,
                    description: `${supplierName ? supplierName + ' - ' : ''}${validItems.length} mặt hàng - ${formData.total_items} đơn vị`,
                    type: 'warning',
                    link: '/xuat-kho'
                });
            }
            
            onSuccess();
        } catch (error) {
            console.error('Error saving goods issue:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProductsForType = (type) => {
        if (type === 'TRA_VO') return PRODUCT_TYPES.filter(p => p.id.startsWith('BINH'));
        if (type === 'TRA_MAY') return PRODUCT_TYPES.filter(p => p.id.startsWith('MAY'));
        return PRODUCT_TYPES;
    };

    const currentFilteredProducts = filteredProductsForType(formData.issue_type);

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
                                <PackageMinus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-black text-primary tracking-tight">
                                    {isEdit ? 'Cập nhật Phiếu Xuất' : (
                                        formData.issue_type === 'TRA_VO' ? 'Xuất Trả Vỏ' :
                                            formData.issue_type === 'TRA_MAY' ? 'Xuất Trả Máy' :
                                                'Lập Phiếu Xuất'
                                    )}
                                </h3>
                                <p className="text-primary/60 text-[12px] font-bold mt-0.5">
                                    Mã phiếu: #{formData.issue_code}
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
                    <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                        <form id="goodsIssueForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Thông tin đơn */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Hash className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin chung</h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                            <Calendar className="w-4 h-4 text-primary/70" /> Ngày xuất
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.issue_date}
                                            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                            Loại hình xuất
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.issue_type}
                                                onChange={(e) => {
                                                    const type = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        issue_type: type,
                                                        notes: (type === 'TRA_VO' || type === 'TRA_MAY') ? 'Khách hàng trả' : formData.notes
                                                    });
                                                }}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            >
                                                {ISSUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        Kho xuất hàng
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.warehouse_id}
                                            onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            required
                                        >
                                            <option value="">Chọn kho xuất</option>
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        <User className="w-4 h-4 text-primary/70" /> Nhà cung cấp trả về
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.supplier_id}
                                            onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                        >
                                            <option value="">-- Chọn NCC trả về --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        <StickyNote className="w-4 h-4 text-primary/70" /> Ghi chú
                                    </label>
                                    <textarea
                                        value={formData.notes || ''}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Lý do xuất, phương tiện v.v"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all min-h-[80px]"
                                    />
                                </div>
                            </div>

                            {/* Bảng chọn nhanh (Chỉ hiện khi là loại Trả NCC) */}
                            {(formData.issue_type === 'TRA_VO' || formData.issue_type === 'TRA_BINH_LOI' || formData.issue_type === 'TRA_MAY') && formData.warehouse_id && (
                                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/30 p-5 sm:p-6 space-y-4 shadow-sm">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200 shrink-0">
                                                <CheckSquare size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-[16px] font-black text-emerald-800 tracking-tight">Chọn nhanh tài sản từ kho</h4>
                                                <p className="text-[11px] font-bold text-emerald-600/70 uppercase">Có {inventoryItems.length} sản phẩm khả dụng trong kho này</p>
                                            </div>
                                        </div>
                                        {inventoryItems.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-3 w-full">
                                                <div className="relative group flex-1 min-w-[200px]">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" size={14} />
                                                    <input 
                                                        type="text"
                                                        placeholder="Tìm serial/loại bình..."
                                                        value={inventorySearchTerm}
                                                        onChange={(e) => setInventorySearchTerm(e.target.value)}
                                                        className="h-9 pl-9 pr-4 w-full bg-white border border-emerald-100 rounded-xl text-[12px] font-bold text-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all"
                                                    />
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveScanningIndex(null);
                                                        setIsScannerOpen(true);
                                                    }}
                                                    className="p-2 bg-white border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
                                                    title="Quét mã chọn nhanh"
                                                >
                                                    <ScanLine size={18} />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const allIds = inventoryItems.map(i => i.id);
                                                        const currentIds = items.map(it => it.item_id).filter(Boolean);
                                                        const areAllSelected = allIds.every(id => currentIds.includes(id));
                                                        
                                                        if (areAllSelected) {
                                                            // Clear all returned items that belong to this warehouse inventory
                                                            setItems(items.filter(it => !allIds.includes(it.item_id)));
                                                        } else {
                                                            // Add missing items
                                                            const newItems = inventoryItems
                                                                .filter(i => !currentIds.includes(i.id))
                                                                .map(i => ({
                                                                    id: Date.now() + Math.random(),
                                                                    item_type: mapToProductType(i),
                                                                    item_id: i.id,
                                                                    item_code: i.serial_number,
                                                                    quantity: 1,
                                                                    _search: ''
                                                                }));
                                                            setItems([...items.filter(it => it.item_code), ...newItems]);
                                                        }
                                                    }}
                                                    className="px-4 py-1.5 bg-white border border-emerald-200 rounded-lg text-[12px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
                                                >
                                                    {inventoryItems.length > 0 && inventoryItems.every(i => items.some(it => it.item_id === i.id)) ? 'Bỏ chọn hàng loạt' : 'Chọn toàn bộ list'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isInventoryLoading ? (
                                        <div className="py-12 text-center bg-white/40 rounded-2xl border border-dashed border-emerald-100">
                                            <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                                            <p className="text-[12px] font-bold text-emerald-600/60 uppercase tracking-widest">Đang đồng bộ list hàng...</p>
                                        </div>
                                    ) : inventoryItems.length === 0 ? (
                                        <div className="py-12 text-center bg-white/50 rounded-2xl border border-dashed border-emerald-200">
                                            <Package size={32} className="mx-auto text-emerald-200 mb-3" />
                                            <p className="text-[13px] font-bold text-emerald-800/40">Kho này hiện không có tài sản để trả về</p>
                                        </div>
                                    ) : filteredInventory.length === 0 ? (
                                        <div className="py-10 text-center bg-white/30 rounded-2xl border border-dashed border-emerald-100">
                                            <p className="text-[12px] font-bold text-emerald-400">Không tìm thấy mã trùng khớp với "{inventorySearchTerm}"</p>
                                        </div>
                                    ) : (
                                        <div className="max-h-[350px] overflow-auto custom-scrollbar border border-emerald-100 rounded-2xl bg-white shadow-inner">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 z-10 bg-emerald-50 shadow-sm">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[11px] font-black text-emerald-800 uppercase tracking-wider w-10 text-center">Chọn</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-emerald-800 uppercase tracking-wider">Số Serial / Barcode</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-emerald-800 uppercase tracking-wider text-center">Loại</th>
                                                        <th className="px-4 py-3 text-[11px] font-black text-emerald-800 uppercase tracking-wider">Thông tin</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-emerald-50">
                                                    {filteredInventory.map(invItem => {
                                                        const isSelected = items.some(it => it.item_id === invItem.id);
                                                        return (
                                                            <tr 
                                                                key={invItem.id}
                                                                onClick={() => toggleInventoryItem(invItem)}
                                                                className={clsx(
                                                                    "group cursor-pointer transition-all hover:bg-emerald-50/50",
                                                                    isSelected ? "bg-emerald-50/70" : "bg-white"
                                                                )}
                                                            >
                                                                <td className="px-4 py-3 text-center">
                                                                    <div className={clsx(
                                                                        "w-5 h-5 mx-auto rounded-md border flex items-center justify-center transition-all",
                                                                        isSelected ? "bg-emerald-600 border-emerald-600 text-white shadow-md" : "bg-white border-slate-200 group-hover:border-emerald-300"
                                                                    )}>
                                                                        {isSelected && <CheckCircle2 size={12} strokeWidth={4} />}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className={clsx("font-mono text-[13px] font-black tracking-tight", isSelected ? "text-emerald-700" : "text-slate-700")}>
                                                                        {invItem.serial_number}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={clsx(
                                                                        "text-[9px] font-black px-2 py-0.5 rounded-md",
                                                                        isSelected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                                                    )}>
                                                                        {formData.issue_type === 'TRA_MAY' ? 'MÁY' : 'BÌNH'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className={clsx("text-[12px] font-bold", isSelected ? "text-emerald-800/70" : "text-slate-500")}>
                                                                        {formData.issue_type === 'TRA_MAY' ? invItem.machine_type : invItem.volume}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formData.issue_type === 'TRA_VO' && (
                                <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <h4 className="text-[16px] font-black text-primary tracking-tight">Nhập nhanh số lượng vỏ trả</h4>
                                        <span className="text-[11px] font-bold text-slate-500">Quét QR hoặc thêm nhiều dòng để nhập mã thủ công (1 vỏ = 1 mã)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                        <div className="sm:col-span-5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Loại vỏ</label>
                                            <select
                                                value={manualReturnType}
                                                onChange={(e) => setManualReturnType(e.target.value)}
                                                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 appearance-none outline-none focus:border-primary/40"
                                            >
                                                {currentFilteredProducts.map(p => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Số lượng</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={manualReturnQty}
                                                onChange={(e) => setManualReturnQty(e.target.value)}
                                                onBlur={(e) => {
                                                    const qty = Number(e.target.value);
                                                    if (!Number.isInteger(qty) || qty < 1) {
                                                        alert('Số lượng vỏ phải lớn hơn 0.');
                                                    }
                                                }}
                                                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black text-slate-800 outline-none focus:border-primary/40"
                                            />
                                        </div>
                                        <div className="sm:col-span-4" />
                                    </div>
                                </div>
                            )}

                            {/* Chi tiết sản phẩm */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <LayoutGrid className="w-4 h-4 text-primary" />
                                        <h4 className="text-[18px] !font-extrabold !text-primary">Chi tiết xuất</h4>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={fetchInventory}
                                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 text-[13px] font-bold"
                                        >
                                            <Package size={16} />
                                            Chọn từ kho
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all flex items-center gap-1.5 text-[13px] font-bold"
                                        >
                                            <Plus size={16} />
                                            Thêm dòng
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {items.map((item, index) => (
                                        <div key={item.id} className="relative p-4 rounded-2xl bg-slate-50 border border-slate-200 group">
                                            <div className="grid grid-cols-12 gap-3 sm:items-end">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Loại tài sản</label>
                                                    <div className="relative">
                                                        <select
                                                            value={item.item_type}
                                                            onChange={(e) => updateItem(item.id, 'item_type', e.target.value)}
                                                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 appearance-none outline-none focus:border-primary/40"
                                                        >
                                                            {currentFilteredProducts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                                        </select>
                                                        <ChevronDown className="w-3.5 h-3.5 text-primary/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div className="col-span-12 sm:col-span-5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                                                        Số Serial / RFID
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <InventorySearchableSelect
                                                                items={inventoryItems}
                                                                value={item.item_code}
                                                                onSelect={(serial) => updateItemWithInventory(item.id, serial)}
                                                                isMachine={formData.issue_type === 'TRA_MAY'}
                                                                isLoading={isInventoryLoading}
                                                                isEmpty={!formData.warehouse_id}
                                                                excludedSerials={items
                                                                    .filter(it => it.id !== item.id)
                                                                    .map(it => (it.item_code || '').trim())
                                                                    .filter(Boolean)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openScanner(index)}
                                                            className="h-10 w-10 shrink-0 inline-flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all shadow-sm border border-primary/20"
                                                            title="Quét mã"
                                                            aria-label="Quét mã serial"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-span-8 sm:col-span-2">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block text-center">S.Lượng</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                        disabled={formData.issue_type === 'TRA_VO'}
                                                        className={clsx(
                                                            "w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-[13px] font-black text-slate-800 text-center outline-none focus:border-primary/40",
                                                            formData.issue_type === 'TRA_VO' && "bg-slate-100 text-slate-500 cursor-not-allowed"
                                                        )}
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-1 flex items-end justify-end sm:justify-center pb-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="h-10 w-10 inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                        title="Xóa dòng"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Tổng sản phẩm</span>
                            <span className="text-[20px] font-black text-slate-900 leading-none">{formData.total_items}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-[14px] font-bold hover:bg-slate-50 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                form="goodsIssueForm"
                                disabled={isLoading}
                                className={clsx(
                                    "px-8 py-2.5 rounded-2xl text-[14px] font-extrabold flex items-center gap-2 shadow-lg transition-all active:scale-95",
                                    isLoading ? "bg-slate-300 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Clock className="animate-spin w-4 h-4" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Lưu Phiếu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title="Quét mã tài sản"
            />

            <InventoryPickerModal
                isOpen={isInventoryPickerOpen}
                onClose={() => setIsInventoryPickerOpen(false)}
                onConfirm={handleConfirmInventorySelection}
                items={inventoryItems}
                isLoading={isInventoryLoading}
                type={formData.issue_type === 'TRA_MAY' ? 'MAY' : 'BINH'}
            />
        </>,
        document.body
    );
}
