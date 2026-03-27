import { clsx } from 'clsx';
import {
    ArrowRightLeft,
    ChevronLeft,
    RefreshCw,
    Save,
    Warehouse
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import { notificationService } from '../utils/notificationService';

const InventoryTransfer = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [inventory, setInventory] = useState([]);

    const [formData, setFormData] = useState({
        from_warehouse_id: '',
        to_warehouse_id: '',
        item_type: 'MAY',
        item_name: '',
        quantity: 1,
        note: ''
    });

    const [availableItems, setAvailableItems] = useState([]);
    const [maxQuantity, setMaxQuantity] = useState(0);

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
            const items = inventory.filter(i => i.item_type === formData.item_type);
            setAvailableItems(items);

            // If current item_name is in new list, update max quantity
            const selected = items.find(i => i.item_name === formData.item_name);
            if (selected) {
                setMaxQuantity(selected.quantity);
            } else {
                setFormData(prev => ({ ...prev, item_name: items[0]?.item_name || '', quantity: 1 }));
                setMaxQuantity(items[0]?.quantity || 0);
            }
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

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động');
        if (data) setWarehouses(data);
    };

    const fetchInventory = async (warehouseId) => {
        const { data } = await supabase
            .from('inventory')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .gt('quantity', 0);
        if (data) setInventory(data);
    };

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

        setLoading(true);
        try {
            // 1. Get Source Inventory
            const sourceItem = inventory.find(i => i.item_name === formData.item_name && i.item_type === formData.item_type);

            // 2. Decrement Source
            const { error: decError } = await supabase
                .from('inventory')
                .update({ quantity: sourceItem.quantity - formData.quantity })
                .eq('id', sourceItem.id);
            if (decError) throw decError;

            // 3. Increment Destination (Upsert)
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

            // 4. Record Transactions
            const transferCode = `TRF${Date.now().toString().slice(-6)}`;
            const { error: txError } = await supabase
                .from('inventory_transactions')
                .insert([
                    {
                        inventory_id: sourceItem.id,
                        transaction_type: 'OUT',
                        reference_code: transferCode,
                        quantity_changed: formData.quantity,
                        note: `Điều chuyển tới ${warehouses.find(w => w.id === formData.to_warehouse_id)?.name}. ${formData.note}`
                    },
                    {
                        inventory_id: destInventoryId,
                        transaction_type: 'IN',
                        reference_code: transferCode,
                        quantity_changed: formData.quantity,
                        note: `Nhận điều chuyển từ ${warehouses.find(w => w.id === formData.from_warehouse_id)?.name}. ${formData.note}`
                    }
                ]);
            if (txError) throw txError;

            // Log notification
            await notificationService.add({
                title: 'Điều chuyển kho',
                description: `Đã chuyển ${formData.quantity} ${formData.item_name} từ ${warehouses.find(w => w.id === formData.from_warehouse_id)?.name} tới ${warehouses.find(w => w.id === formData.to_warehouse_id)?.name}`,
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

    return (
        <div className="w-full flex-1 flex flex-col p-4">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                        <ArrowRightLeft size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Điều chuyển kho nội bộ</h1>
                        <p className="text-xs text-muted-foreground">Chuyển hàng hóa giữa các điểm tập kết trong hệ thống</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto w-full">
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/20 rounded-xl border border-dashed border-border">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Warehouse size={14} /> Kho đi (Nguồn)
                                </label>
                                <select
                                    className="w-full p-2.5 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    value={formData.from_warehouse_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, from_warehouse_id: e.target.value }))}
                                    required
                                >
                                    <option value="">Chọn kho xuất...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                                    <Warehouse size={14} className="text-emerald-600" /> Kho đến (Đích)
                                </label>
                                <select
                                    className="w-full p-2.5 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                    value={formData.to_warehouse_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, to_warehouse_id: e.target.value }))}
                                    required
                                >
                                    <option value="">Chọn kho nhận...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700">Loại hàng hóa</label>
                                    <div className="flex gap-2">
                                        {['MAY', 'BINH', 'VAT_TU'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, item_type: type }))}
                                                className={clsx(
                                                    "flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all",
                                                    formData.item_type === type
                                                        ? "bg-primary border-primary text-white"
                                                        : "bg-white border-border text-slate-500 hover:border-primary/50"
                                                )}
                                            >
                                                {type === 'MAY' ? 'Máy' : type === 'BINH' ? 'Bình' : 'Vật tư'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700">Tên hàng hóa</label>
                                    <select
                                        className="w-full p-2.5 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        value={formData.item_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                                        disabled={!formData.from_warehouse_id || availableItems.length === 0}
                                        required
                                    >
                                        <option value="">Chọn hàng hóa...</option>
                                        {availableItems.map(item => (
                                            <option key={item.id} value={item.item_name}>
                                                {item.item_name} (Hiện có: {item.quantity})
                                            </option>
                                        ))}
                                    </select>
                                    {!formData.from_warehouse_id && (
                                        <p className="text-[10px] text-amber-600 italic">Vui lòng chọn kho đi trước</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700">Số lượng điều chuyển</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full p-2.5 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-blue-600"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                            min="1"
                                            max={maxQuantity}
                                            required
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                            Max: {maxQuantity}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-slate-700">Ghi chú (Tùy chọn)</label>
                                    <input
                                        type="text"
                                        className="w-full p-2.5 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        placeholder="Lý do điều chuyển..."
                                        value={formData.note}
                                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-muted/30 border-t flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="px-6 py-2 text-[13px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "flex items-center gap-2 px-8 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95",
                                loading && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                            Thực hiện điều chuyển
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventoryTransfer;
