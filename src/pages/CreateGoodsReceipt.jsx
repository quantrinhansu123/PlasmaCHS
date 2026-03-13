import {
    Camera,
    CheckCircle2,
    PackagePlus,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BarcodeScanner from '../components/Common/BarcodeScanner';
import { ITEM_TYPES, ITEM_UNITS } from '../constants/goodsReceiptConstants';
import {
    CYLINDER_STATUSES,
    MACHINE_STATUSES
} from '../constants/machineConstants';
import { PRODUCT_TYPES } from '../constants/orderConstants';
import { supabase } from '../supabase/config';

const CreateGoodsReceipt = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editReceipt = state?.receipt;
    const isReadOnly = editReceipt && editReceipt.status !== 'CHO_DUYET';
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [scannerIndex, setScannerIndex] = useState(null);

    const emptyItem = {
        item_type: 'MAY',
        item_name: '',
        serial_number: '',
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
        note: ''
    });

    const [items, setItems] = useState([{ ...emptyItem }]);

    // Auto-generate receipt code
    useEffect(() => {
        if (editReceipt) {
            setFormData({
                receipt_code: editReceipt.receipt_code,
                supplier_name: editReceipt.supplier_name,
                warehouse_id: editReceipt.warehouse_id,
                receipt_date: editReceipt.receipt_date ? editReceipt.receipt_date.split('T')[0] : new Date().toISOString().split('T')[0],
                received_by: editReceipt.received_by || '',
                note: editReceipt.note || ''
            });

            const fetchItems = async () => {
                const { data } = await supabase
                    .from('goods_receipt_items')
                    .select('*')
                    .eq('receipt_id', editReceipt.id);
                if (data && data.length > 0) {
                    setItems(data);
                }
            };
            fetchItems();
            return;
        }

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
    }, [editReceipt]);

    // Load suppliers list
    useEffect(() => {
        const loadSuppliers = async () => {
            try {
                const { data } = await supabase.from('suppliers').select('id, name').order('name');
                if (data) setSuppliers(data);
            } catch (err) {
                console.error('Error fetching suppliers:', err);
            }
        };

        const loadWarehouses = async () => {
            try {
                const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
                if (data) {
                    setWarehousesList(data);
                    // Default to first warehouse if creating new
                    if (!editReceipt && data.length > 0) {
                        setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: data[0].id } : prev);
                    } else if (editReceipt) {
                        // Check if editReceipt's warehouse_id exists in the new UUID list. If not, reset to first.
                        const exists = data.some(w => w.id === editReceipt.warehouse_id);
                        if (!exists && data.length > 0) {
                            setFormData(prev => ({ ...prev, warehouse_id: '' }));
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching warehouses:', err);
            }
        };

        loadSuppliers();
        loadWarehouses();
    }, [editReceipt]);

    const addItem = () => {
        setItems(prev => [...prev, { ...emptyItem }]);
    };

    const removeItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleScanSuccess = useCallback((decodedText) => {
        if (scannerIndex !== null) {
            updateItem(scannerIndex, 'serial_number', decodedText);
            setScannerIndex(null);
        }
    }, [scannerIndex]);

    const stopScanner = useCallback(() => {
        setScannerIndex(null);
    }, []);

    const handleSubmit = async () => {
        if (!formData.supplier_name) {
            alert('Vui lòng chọn nhà cung cấp');
            return;
        }
        if (items.some(item => !item.item_name)) {
            alert('Vui lòng điền tên hàng hóa cho tất cả các dòng');
            return;
        }

        setIsSubmitting(true);
        try {
            // Tính tổng tiền phiếu
            const totalAmount = items.reduce((sum, item) => sum + (item.total_price || 0), 0);

            // Insert or Update master receipt
            const receiptPayload = {
                ...formData,
                total_items: items.length,
                total_amount: totalAmount,
                status: editReceipt ? editReceipt.status : 'CHO_DUYET' // Keep existing status if edit
            };

            let receiptId;

            if (editReceipt) {
                const { error: receiptError } = await supabase
                    .from('goods_receipts')
                    .update(receiptPayload)
                    .eq('id', editReceipt.id);

                if (receiptError) throw receiptError;
                receiptId = editReceipt.id;

                // Delete old items
                await supabase.from('goods_receipt_items').delete().eq('receipt_id', receiptId);
            } else {
                const { data: receipt, error: receiptError } = await supabase
                    .from('goods_receipts')
                    .insert([receiptPayload])
                    .select()
                    .single();

                if (receiptError) throw receiptError;
                receiptId = receipt.id;
            }

            // Insert items
            const itemsPayload = items.map(item => ({
                item_type: item.item_type,
                item_name: item.item_name,
                serial_number: item.serial_number,
                item_status: item.item_status,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price,
                total_price: item.total_price,
                note: item.note,
                receipt_id: receiptId
            }));

            const { error: itemsError } = await supabase
                .from('goods_receipt_items')
                .insert(itemsPayload);

            if (itemsError) throw itemsError;

            alert(editReceipt ? '🎉 Cập nhật phiếu nhập kho thành công!' : '🎉 Tạo phiếu nhập kho thành công!');
            navigate('/nhap-hang');
        } catch (error) {
            console.error('Error creating goods receipt:', error);
            if (error.code === '23505') {
                alert(`❌ Mã phiếu "${formData.receipt_code}" đã tồn tại.`);
            } else {
                alert('❌ Có lỗi xảy ra: ' + error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-emerald w-[400px] h-[400px] -top-20 -left-20 opacity-20"></div>
            <div className="blob blob-teal w-[350px] h-[350px] bottom-1/4 -right-20 opacity-15"></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <PackagePlus className="w-8 h-8 text-emerald-600" />
                    {editReceipt ? 'Cập nhật phiếu nhập kho' : 'Tạo phiếu nhập kho'}
                </h1>
            </div>

            <BarcodeScanner 
                isOpen={scannerIndex !== null}
                onClose={stopScanner}
                onScanSuccess={handleScanSuccess}
                title="Quét mã Serial / Barcode"
            />

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">
                    {/* Section 1: Thông tin phiếu */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin phiếu nhập</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Mã phiếu (tự sinh)</label>
                                <input
                                    value={formData.receipt_code}
                                    disabled
                                    className="w-full px-5 py-4 bg-gray-100 border border-gray-200 rounded-2xl font-black text-emerald-600 text-base cursor-not-allowed shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nhà cung cấp *</label>
                                <select
                                    value={formData.supplier_name}
                                    disabled={isReadOnly}
                                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                                    className={`w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 font-bold text-base shadow-sm transition-all ${isReadOnly ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
                                >
                                    <option value="">-- Chọn nhà cung cấp --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Kho nhận hàng *</label>
                                <select
                                    disabled={isReadOnly}
                                    value={formData.warehouse_id}
                                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                    className={`w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 font-bold text-base shadow-sm transition-all ${isReadOnly ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
                                >
                                    <option value="">-- Chọn kho nhập --</option>
                                    {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Ngày nhập *</label>
                                <input
                                    type="date"
                                    value={formData.receipt_date}
                                    disabled={isReadOnly}
                                    onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                                    className={`w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 font-bold text-base shadow-sm transition-all ${isReadOnly ? 'cursor-not-allowed bg-gray-50' : ''}`}
                                />        </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Người nhận hàng</label>
                                <input
                                    value={formData.received_by}
                                    disabled={isReadOnly}
                                    onChange={(e) => setFormData({ ...formData, received_by: e.target.value })}
                                    placeholder="Tên thủ kho / người nhận..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold shadow-sm transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Ghi chú</label>
                                <input
                                    value={formData.note}
                                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                    placeholder="Ghi chú phiếu nhập..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 font-bold shadow-sm transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Danh sách hàng hóa */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3 md:pb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold">2</span>
                                <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Danh sách hàng hóa nhập</h3>
                            </div>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                            >
                                <Plus className="w-4 h-4" /> Thêm dòng
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map((item, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 p-5 md:p-6 rounded-2xl md:rounded-3xl space-y-5 md:space-y-6 shadow-sm relative transition-all hover:border-emerald-200 hover:shadow-md">
                                    <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-gray-100">
                                        <div className="font-black text-emerald-700 md:text-lg flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">{idx + 1}</span>
                                            Hàng hóa nhập
                                        </div>
                                        {items.length > 1 && (
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 text-sm font-bold"
                                            >
                                                <Trash2 className="w-4 h-4" /> <span className="hidden md:inline">Xóa dòng này</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
                                        {/* Row 1/Col 1: Basic Info */}
                                        <div className="md:col-span-4 space-y-4">
                                            <div className="space-y-1.5 col-span-2">
                                                <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Tên hàng hóa *</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <select
                                                        value={PRODUCT_TYPES.some(p => p.label === item.item_name) ? item.item_name : (item.item_name === '' ? '' : 'KHAC')}
                                                        onChange={(e) => {
                                                            if (e.target.value === 'KHAC') {
                                                                updateItem(idx, 'item_name', 'Sản phẩm khác...');
                                                            } else {
                                                                updateItem(idx, 'item_name', e.target.value);
                                                            }
                                                        }}
                                                        disabled={isReadOnly}
                                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all cursor-pointer"
                                                    >
                                                        <option value="">-- Chọn tên hàng hóa --</option>
                                                        {PRODUCT_TYPES.map(p => (
                                                            <option key={p.id} value={p.label}>{p.label}</option>
                                                        ))}
                                                        <option value="KHAC">Sản phẩm khác (Nhập tay)...</option>
                                                    </select>
                                                    {!PRODUCT_TYPES.some(p => p.label === item.item_name) && item.item_name !== '' && (
                                                        <input
                                                            value={item.item_name === 'Sản phẩm khác...' ? '' : item.item_name}
                                                            onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                                                            placeholder="Nhập tên sản phẩm..."
                                                            disabled={isReadOnly}
                                                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Loại</label>
                                                    <select
                                                        value={item.item_type}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                                                        className={`w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {ITEM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái</label>
                                                    <select
                                                        value={item.item_status}
                                                        disabled={isReadOnly}
                                                        onChange={(e) => updateItem(idx, 'item_status', e.target.value)}
                                                        className={`w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        <option value="">-- Chọn --</option>
                                                        {item.item_type === 'MAY' ? (
                                                            MACHINE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)
                                                        ) : (item.item_type === 'BINH' || item.item_type === 'BINH_CO_KHI') ? (
                                                            CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)
                                                        ) : null}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 1/Col 2: Identity & Quantities */}
                                        <div className="md:col-span-4 space-y-4">
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Serial / Mã (Nếu có)</label>
                                                <div className="flex gap-2 w-full">
                                                    <div className="relative flex-1 min-w-0">
                                                        <input
                                                            value={item.serial_number}
                                                            onChange={(e) => updateItem(idx, 'serial_number', e.target.value)}
                                                            placeholder="Nhập serial hoặc mã quản lý..."
                                                            className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all pr-10"
                                                        />
                                                        {item.serial_number && (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(idx, 'serial_number', '')}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setScannerIndex(idx)}
                                                        className="px-3 py-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 w-[46px] h-[46px]"
                                                        title="Quét barcode bằng camera"
                                                    >
                                                        <Camera className="w-5 h-5 flex-shrink-0" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Số lượng</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const q = parseInt(e.target.value) || 1;
                                                            updateItem(idx, 'quantity', q);
                                                            updateItem(idx, 'total_price', q * (item.unit_price || 0));
                                                        }}
                                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base font-black text-center text-emerald-700 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all shadow-inner"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn vị tính</label>
                                                    <select
                                                        value={item.unit}
                                                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 cursor-pointer transition-all"
                                                    >
                                                        {ITEM_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 1/Col 3: Pricing & Notes */}
                                        <div className="md:col-span-4 space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Đơn giá nhập (VNĐ)</label>
                                                <input
                                                    type="text"
                                                    value={item.unit_price ? item.unit_price.toLocaleString('vi-VN') : ''}
                                                    onChange={(e) => {
                                                        const rawValue = e.target.value.replace(/\./g, '');
                                                        const p = parseFloat(rawValue) || 0;
                                                        updateItem(idx, 'unit_price', p);
                                                        updateItem(idx, 'total_price', (item.quantity || 1) * p);
                                                    }}
                                                    placeholder="0"
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-base font-bold outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all text-right shadow-inner placeholder:text-gray-300"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 items-end">
                                                <div className="space-y-1.5 col-span-2 sm:col-span-1 md:col-span-2 lg:col-span-1">
                                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Ghi chú</label>
                                                    <input
                                                        value={item.note}
                                                        onChange={(e) => updateItem(idx, 'note', e.target.value)}
                                                        placeholder="Vd: Xước vỏ..."
                                                        className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all"
                                                    />
                                                </div>
                                                <div className="col-span-2 sm:col-span-1 md:col-span-2 lg:col-span-1">
                                                    <div className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm flex flex-col justify-center items-end shadow-sm">
                                                        <span className="text-[10px] md:text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-0.5">Thành tiền</span>
                                                        <span className="font-black text-emerald-700 text-lg leading-none">
                                                            {new Intl.NumberFormat('vi-VN').format(item.total_price || 0)} <span className="text-sm">₫</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-500 flex items-center gap-4">
                                <span>
                                    Tổng: <span className="text-emerald-700 text-lg font-black">{items.length}</span> mặt hàng —
                                    <span className="text-emerald-700 text-lg font-black ml-1">{items.reduce((sum, i) => sum + (i.quantity || 0), 0)}</span> đơn vị
                                </span>
                                <span className="w-px h-6 bg-emerald-200/50 block"></span>
                                <span>
                                    Tổng tiền: <span className="text-rose-600 text-xl font-black">{new Intl.NumberFormat('vi-VN').format(items.reduce((sum, i) => sum + (i.total_price || 0), 0))} ₫</span>
                                </span>
                            </span>
                            <button
                                onClick={addItem}
                                className="text-sm font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                            >
                                + Thêm dòng mới
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-gray-400 text-sm font-medium italic">* Kiểm tra kỹ thông tin trước khi lưu phiếu nhập.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={() => navigate('/nhap-hang')}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-emerald-100 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editReceipt ? 'Cập nhật phiếu nhập kho' : 'Lưu phiếu nhập kho'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateGoodsReceipt;
