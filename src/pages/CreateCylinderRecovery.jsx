import {
    Camera,
    CheckCircle2,
    Link2,
    PackageCheck,
    Plus,
    ScanLine,
    Trash2,
    X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WAREHOUSES } from '../constants/orderConstants';
import { ITEM_CONDITIONS } from '../constants/recoveryConstants';
import { supabase } from '../supabase/config';

const CreateCylinderRecovery = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editRecovery = state?.recovery;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerOrders, setCustomerOrders] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const html5QrCodeRef = useRef(null);
    const photoInputRef = useRef(null);
    const [photoUrls, setPhotoUrls] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [formData, setFormData] = useState({
        recovery_code: '',
        recovery_date: new Date().toISOString().split('T')[0],
        customer_id: '',
        order_id: '',
        warehouse_id: 'HN',
        driver_name: '',
        notes: '',
        total_items: 0,
        status: 'CHO_DUYET'
    });

    const [items, setItems] = useState([]);
    const itemsRef = useRef(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    useEffect(() => {
        loadCustomers();
        if (editRecovery) {
            setFormData(editRecovery);
            setPhotoUrls(editRecovery.photos || []);
            fetchItems(editRecovery.id);
        } else {
            generateCode();
        }
    }, [editRecovery]);

    const loadCustomers = async () => {
        const { data } = await supabase.from('customers').select('id, name').order('name');
        if (data) setCustomers(data);
    };

    // Load orders for selected customer
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

    // Load orders when customer changes
    useEffect(() => {
        if (formData.customer_id && customers.length > 0) {
            loadCustomerOrders(formData.customer_id);
        } else {
            setCustomerOrders([]);
        }
    }, [formData.customer_id, customers]);

    const fetchItems = async (recoveryId) => {
        const { data } = await supabase.from('cylinder_recovery_items').select('*').eq('recovery_id', recoveryId);
        if (data) setItems(data.map(i => ({ ...i, _id: i.id || Date.now() })));
    };

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

    // Barcode scanner optimized for 1D barcodes (mã vạch)
    const startScanner = useCallback(async () => {
        // Ensure previous scanner is fully stopped
        if (html5QrCodeRef.current) {
            try { await html5QrCodeRef.current.stop(); } catch { }
            html5QrCodeRef.current = null;
        }

        setIsScannerOpen(true);
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        // Only 1D barcode formats for faster/more accurate detection
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.QR_CODE,
        ];

        setTimeout(async () => {
            try {
                const qr = new Html5Qrcode("recovery-barcode-reader", {
                    formatsToSupport,
                    verbose: false,
                });
                html5QrCodeRef.current = qr;
                await qr.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        // Wide & short box optimized for horizontal 1D barcodes
                        qrbox: (viewfinderWidth, viewfinderHeight) => ({
                            width: Math.floor(viewfinderWidth * 0.85),
                            height: Math.floor(viewfinderHeight * 0.35)
                        }),
                        disableFlip: false,
                    },
                    (decodedText) => {
                        const currentItems = itemsRef.current;
                        if (currentItems.some(i => i.serial_number === decodedText)) {
                            return;
                        }
                        setItems(prev => [...prev, { _id: Date.now(), serial_number: decodedText, condition: 'tot', note: '' }]);
                    },
                    () => { }
                );
            } catch (err) {
                console.error('Scanner error:', err);
                alert('❌ Không mở được camera: ' + err);
                setIsScannerOpen(false);
            }
        }, 300);
    }, []);

    const stopScanner = useCallback(async () => {
        if (html5QrCodeRef.current) {
            try { await html5QrCodeRef.current.stop(); } catch { }
            html5QrCodeRef.current = null;
        }
        setIsScannerOpen(false);
    }, []);

    useEffect(() => {
        return () => { if (html5QrCodeRef.current) html5QrCodeRef.current.stop().catch(() => { }); };
    }, []);

    // Photo capture
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
            alert('❌ Upload ảnh thất bại: ' + err.message);
        } finally {
            setUploadingPhoto(false);
            e.target.value = '';
        }
    };

    const removePhoto = (idx) => setPhotoUrls(prev => prev.filter((_, i) => i !== idx));

    // Items management
    const addItemManual = () => {
        setItems(prev => [...prev, { _id: Date.now(), serial_number: '', condition: 'tot', note: '' }]);
    };
    const updateItem = (id, field, value) => {
        setItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));
    };
    const removeItem = (id) => setItems(prev => prev.filter(i => i._id !== id));

    // Update total
    useEffect(() => {
        setFormData(prev => ({ ...prev, total_items: items.length }));
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.customer_id) { alert('Vui lòng chọn khách hàng!'); return; }
        if (items.length === 0) { alert('Vui lòng quét hoặc nhập ít nhất 1 vỏ bình!'); return; }
        if (items.some(i => !i.serial_number)) { alert('Có dòng chưa điền mã serial!'); return; }

        setIsSubmitting(true);
        try {
            const payload = { ...formData, photos: photoUrls };
            if (!payload.order_id) delete payload.order_id;

            let recoveryId;
            if (editRecovery) {
                delete payload.id; delete payload.created_at; delete payload.updated_at;
                const { error } = await supabase.from('cylinder_recoveries').update(payload).eq('id', editRecovery.id);
                if (error) throw error;
                recoveryId = editRecovery.id;
                await supabase.from('cylinder_recovery_items').delete().eq('recovery_id', recoveryId);
            } else {
                const { data, error } = await supabase.from('cylinder_recoveries').insert([payload]).select().single();
                if (error) throw error;
                recoveryId = data.id;
            }

            const itemPayloads = items.map(i => ({
                recovery_id: recoveryId,
                serial_number: i.serial_number,
                condition: i.condition,
                note: i.note || ''
            }));
            const { error: itemsError } = await supabase.from('cylinder_recovery_items').insert(itemPayloads);
            if (itemsError) throw itemsError;

            // === POST-SAVE AUTOMATION ===
            const serialNumbers = items.map(i => i.serial_number);

            // 1. Cập nhật trạng thái vỏ bình → sẵn sàng, xoá tên KH
            for (const serial of serialNumbers) {
                await supabase
                    .from('cylinders')
                    .update({ status: 'sẵn sàng', customer_name: null, updated_at: new Date().toISOString() })
                    .eq('serial_number', serial);
            }

            // 2. Giảm borrowed_cylinders của KH
            const { data: customerData } = await supabase
                .from('customers')
                .select('borrowed_cylinders')
                .eq('id', formData.customer_id)
                .single();
            if (customerData) {
                const newBorrowed = Math.max(0, (customerData.borrowed_cylinders || 0) - items.length);
                await supabase
                    .from('customers')
                    .update({ borrowed_cylinders: newBorrowed, updated_at: new Date().toISOString() })
                    .eq('id', formData.customer_id);
            }

            // 3. Ghi log inventory_transactions (nhập kho vỏ)
            const { data: invRecord } = await supabase
                .from('inventory')
                .select('id')
                .eq('warehouse_id', formData.warehouse_id)
                .eq('item_type', 'BINH')
                .eq('item_name', 'Vỏ bình thu hồi')
                .maybeSingle();

            let inventoryId = invRecord?.id;
            if (!inventoryId) {
                const { data: newInv } = await supabase
                    .from('inventory')
                    .insert([{ warehouse_id: formData.warehouse_id, item_type: 'BINH', item_name: 'Vỏ bình thu hồi', quantity: 0 }])
                    .select().single();
                inventoryId = newInv?.id;
            }

            if (inventoryId) {
                await supabase.from('inventory_transactions').insert([{
                    inventory_id: inventoryId,
                    transaction_type: 'IN',
                    reference_id: recoveryId,
                    reference_code: formData.recovery_code,
                    quantity_changed: items.length,
                    note: `Thu hồi ${items.length} vỏ bình từ KH`
                }]);
                await supabase
                    .from('inventory')
                    .update({ quantity: (invRecord?.quantity || 0) + items.length })
                    .eq('id', inventoryId);
            }

            alert('🎉 Lưu phiếu thu hồi thành công!');
            navigate('/thu-hoi-vo');
        } catch (error) {
            console.error(error);
            if (error.code === '23505') alert(`❌ Mã phiếu "${formData.recovery_code}" đã tồn tại.`);
            else alert('❌ Lỗi: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto font-sans min-h-screen noise-bg">
            <div className="blob blob-blue w-[400px] h-[400px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-indigo w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-inner">
                        <PackageCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                            {editRecovery ? 'Cập nhật phiếu thu hồi' : 'Tạo phiếu thu hồi vỏ bình'}
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Thu hồi vỏ bình từ khách hàng — dành cho NV vận chuyển</p>
                    </div>
                </div>
            </div>

            {/* Barcode Scanner Overlay */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                <ScanLine className="w-5 h-5 text-blue-600" /> Quét liên tục
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg">{items.length} đã quét</span>
                                <button onClick={stopScanner} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>
                        <div id="recovery-barcode-reader" className="w-full"></div>
                        <div className="px-6 py-4 text-center">
                            <p className="text-sm text-gray-500 font-medium">Hướng camera vào barcode — quét xong tự thêm vào danh sách</p>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
                {/* 1. Thông tin phiếu */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                        <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin phiếu thu hồi</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Mã phiếu *</label>
                            <input value={formData.recovery_code} onChange={(e) => setFormData({ ...formData, recovery_code: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Ngày thu hồi *</label>
                            <input type="date" value={formData.recovery_date} onChange={(e) => setFormData({ ...formData, recovery_date: e.target.value })} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Khách hàng *</label>
                            <select value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value, order_id: '' })} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none cursor-pointer">
                                <option value="">-- Chọn khách hàng --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Đơn hàng liên kết</label>
                            <select value={formData.order_id} onChange={(e) => setFormData({ ...formData, order_id: e.target.value })} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none cursor-pointer">
                                <option value="">-- Không liên kết --</option>
                                {customerOrders.map(o => <option key={o.id} value={o.id}>ĐH {o.order_code} — {o.quantity} {o.product_type?.startsWith('BINH') ? 'bình' : 'máy'} ({o.status})</option>)}
                            </select>
                            {formData.order_id && (() => {
                                const selectedOrder = customerOrders.find(o => o.id === formData.order_id);
                                if (selectedOrder?.assigned_cylinders?.length > 0) {
                                    return <p className="text-xs text-blue-600 font-medium mt-1">Bình đã giao: {selectedOrder.assigned_cylinders.join(', ')}</p>;
                                }
                                return null;
                            })()}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Kho nhận về *</label>
                            <select value={formData.warehouse_id} onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none cursor-pointer">
                                {WAREHOUSES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">NV vận chuyển</label>
                            <input value={formData.driver_name || ''} onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })} placeholder="Tên nhân viên..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Ghi chú</label>
                            <input value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Ghi chú thêm..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-normal text-gray-900 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none" />
                        </div>
                    </div>
                </div>

                {/* 2. Danh sách vỏ bình */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Danh sách vỏ bình thu hồi ({items.length})</h3>
                        </div>
                        <button type="button" onClick={startScanner} className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-200">
                            <ScanLine className="w-5 h-5" /> Quét Barcode
                        </button>
                    </div>

                    <div className="space-y-3">
                        {items.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                                <ScanLine className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 font-bold">Bấm "Quét Barcode" hoặc thêm thủ công</p>
                            </div>
                        ) : (
                            items.map((item, idx) => (
                                <div key={item._id} className="flex flex-col md:flex-row items-center gap-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all">
                                    <span className="font-bold text-gray-400 w-6 shrink-0">{idx + 1}.</span>
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                                        <div className="md:col-span-5">
                                            <input value={item.serial_number} onChange={(e) => updateItem(item._id, 'serial_number', e.target.value)} placeholder="Mã serial vỏ bình" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                        <div className="md:col-span-3">
                                            <select value={item.condition} onChange={(e) => updateItem(item._id, 'condition', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer">
                                                {ITEM_CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-4">
                                            <input value={item.note || ''} onChange={(e) => updateItem(item._id, 'note', e.target.value)} placeholder="Ghi chú..." className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeItem(item._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        )}
                        <button type="button" onClick={addItemManual} className="w-full md:w-auto mt-2 flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 hover:border-blue-400 transition-all">
                            <Plus className="w-5 h-5" /> Thêm thủ công
                        </button>
                    </div>
                </div>

                {/* 3. Ảnh chụp */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">3</span>
                        <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Ảnh chụp hiện trường ({photoUrls.length})</h3>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {photoUrls.map((url, idx) => (
                            <div key={idx} className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 group">
                                <img src={url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => removePhoto(idx)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        <label className={`w-28 h-28 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                            {uploadingPhoto ? (
                                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Camera className="w-6 h-6 text-blue-400 mb-1" />
                                    <span className="text-[10px] font-bold text-blue-400">Chụp ảnh</span>
                                </>
                            )}
                            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4">
                    <p className="text-gray-500 font-medium">
                        Tổng vỏ thu hồi: <span className="text-xl font-black text-gray-900">{items.length}</span>
                    </p>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button type="button" onClick={() => navigate('/thu-hoi-vo')} className="flex-1 sm:flex-none px-8 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm">
                            Hủy
                        </button>
                        <button type="submit" disabled={isSubmitting} className={`flex-1 sm:flex-none px-12 py-4 text-white font-black text-lg rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-600/30'}`}>
                            {isSubmitting ? 'Đang lưu...' : (<><CheckCircle2 className="w-6 h-6" /> Lưu phiếu thu hồi</>)}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateCylinderRecovery;
