import { clsx } from 'clsx';
import {
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
                const { data, error } = await supabase
                    .from('cylinders')
                    .select('*')
                    .eq('warehouse_id', formData.warehouse_id)
                    .not('status', 'in', '("đang sử dụng", "thuộc khách hàng")');
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
        if (activeScanningIndex !== null) {
            const itemToUpdate = items[activeScanningIndex];
            updateItem(itemToUpdate.id, 'item_code', code);
            setIsScannerOpen(false);
            setActiveScanningIndex(null);
        }
    };

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

        const validItems = items.filter(i => i.item_id || i.item_code);
        if (validItems.length === 0) {
            alert('Vui lòng điền ít nhất 1 sản phẩm cần xuất!');
            return;
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
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200">
                                                <CheckSquare size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-[16px] font-black text-emerald-800 tracking-tight">Chọn nhanh tài sản từ kho</h4>
                                                <p className="text-[11px] font-bold text-emerald-600/70 uppercase">Có {inventoryItems.length} sản phẩm khả dụng trong kho này</p>
                                            </div>
                                        </div>
                                        {inventoryItems.length > 0 && (
                                            <div className="flex items-center gap-3">
                                                <div className="relative group">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 group-focus-within:text-emerald-600 transition-colors" size={14} />
                                                    <input 
                                                        type="text"
                                                        placeholder="Tìm serial/loại bình..."
                                                        value={inventorySearchTerm}
                                                        onChange={(e) => setInventorySearchTerm(e.target.value)}
                                                        className="h-9 pl-9 pr-4 bg-white border border-emerald-100 rounded-xl text-[12px] font-bold text-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all w-[180px] sm:w-[240px]"
                                                    />
                                                </div>
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
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                                            {filteredInventory.map(invItem => {
                                                const isSelected = items.some(it => it.item_id === invItem.id);
                                                return (
                                                    <button
                                                        key={invItem.id}
                                                        type="button"
                                                        onClick={() => toggleInventoryItem(invItem)}
                                                        className={clsx(
                                                            "flex flex-col items-start p-3 rounded-2xl border transition-all text-left group relative ring-offset-2",
                                                            isSelected 
                                                                ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200 ring-2 ring-emerald-500 scale-[0.98]" 
                                                                : "bg-white border-slate-100 text-slate-600 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between w-full mb-2">
                                                            <div className={clsx(
                                                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                                isSelected ? "bg-white border-white text-emerald-600" : "bg-slate-50 border-slate-200 group-hover:border-emerald-300"
                                                            )}>
                                                                {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                                                            </div>
                                                            <span className={clsx(
                                                                "text-[9px] font-black px-1.5 py-0.5 rounded-md",
                                                                isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                                            )}>
                                                                {formData.issue_type === 'TRA_MAY' ? 'MÁY' : 'BÌNH'}
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-[12px] font-black truncate w-full mb-0.5 tracking-tight">
                                                            {invItem.serial_number}
                                                        </div>
                                                        <div className={clsx(
                                                            "text-[10px] font-bold truncate w-full opacity-70",
                                                            isSelected ? "text-white" : "text-slate-400"
                                                        )}>
                                                            {formData.issue_type === 'TRA_MAY' ? invItem.machine_type : invItem.volume}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Chi tiết sản phẩm */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center justify-between pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <LayoutGrid className="w-4 h-4 text-primary" />
                                        <h4 className="text-[18px] !font-extrabold !text-primary">Chi tiết xuất</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                            <div className="grid grid-cols-12 gap-3">
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
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Số Serial / RFID</label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <InventorySearchableSelect
                                                                items={inventoryItems}
                                                                value={item.item_code}
                                                                onSelect={(serial) => updateItemWithInventory(item.id, serial)}
                                                                isMachine={formData.issue_type === 'TRA_MAY'}
                                                                isLoading={isInventoryLoading}
                                                                isEmpty={!formData.warehouse_id}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openScanner(index)}
                                                            className="p-2.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all shadow-sm border border-primary/10"
                                                            title="Quét mã"
                                                        >
                                                            <ScanLine size={18} />
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
                                                        className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-[13px] font-black text-slate-800 text-center outline-none focus:border-primary/40"
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-1 flex items-end justify-center pb-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
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
