import { ActivitySquare, Camera, Hash, Save, ScanLine, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    CYLINDER_STATUSES,
    CYLINDER_VOLUMES,
    GAS_TYPES,
    HANDLE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { supabase } from '../../supabase/config';
import { patchIOSVideoPlaysinline } from '../../utils/scannerHelper';

export default function CylinderFormModal({ cylinder, onClose, onSuccess }) {
    const isEdit = !!cylinder;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const html5QrCodeRef = useRef(null);

    const defaultState = {
        serial_number: '',
        status: 'sẵn sàng',
        net_weight: '8',
        category: 'BV',
        volume: 'bình 4L/ CGA870',
        gas_type: 'AirMAC',
        valve_type: 'Van Messer/Phi 6/ CB Trắng',
        handle_type: 'Có quai',
        customer_id: '',
        warehouse_id: 'HN'
    };

    const [formData, setFormData] = useState(defaultState);
    const [customersList, setCustomersList] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('id, name')
                    .order('name');
                if (!error && data) {
                    setCustomersList(data);
                }
            } catch (err) {
                console.error('Error fetching customers:', err);
            }
        };

        const fetchWarehouses = async () => {
            try {
                const { data, error } = await supabase
                    .from('warehouses')
                    .select('id, name')
                    .eq('status', 'Đang hoạt động')
                    .order('name');
                if (!error && data) {
                    setWarehousesList(data);
                    // Default to first warehouse if not editing
                    if (!isEdit && data.length > 0 && !formData.warehouse_id) {
                        setFormData(prev => ({ ...prev, warehouse_id: data[0].id }));
                    }
                }
            } catch (err) {
                console.error('Error fetching warehouses:', err);
            }
        };

        fetchCustomers();
        fetchWarehouses();
    }, [isEdit]);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                serial_number: cylinder.serial_number || '',
                status: cylinder.status || 'sẵn sàng',
                net_weight: cylinder.net_weight || '',
                category: cylinder.category || 'BV',
                volume: cylinder.volume || 'bình 4L/ CGA870',
                gas_type: cylinder.gas_type || 'AirMAC',
                valve_type: cylinder.valve_type || 'Van Messer/Phi 6/ CB Trắng',
                handle_type: cylinder.handle_type || 'Có quai',
                customer_id: cylinder.customer_id || '',
                warehouse_id: cylinder.warehouse_id || 'HN'
            });
        }
    }, [cylinder, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumericChange = (field, value) => {
        let raw = value.replace(/\./g, '').replace(/,/g, '.');
        raw = raw.replace(/[^0-9.]/g, '');
        const dots = raw.split('.');
        if (dots.length > 2) raw = dots[0] + '.' + dots.slice(1).join('');
        setFormData(prev => ({ ...prev, [field]: raw }));
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const parts = val.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(',');
    };

    // Barcode scanner
    const startScanner = useCallback(async () => {
        setIsScannerOpen(true);
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        setTimeout(async () => {
            try {
                const qr = new Html5Qrcode('modal-barcode-reader', {
                    useBarCodeDetectorIfSupported: true,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                    ]
                });
                html5QrCodeRef.current = qr;
                patchIOSVideoPlaysinline('modal-barcode-reader');
                await qr.start(
                    { facingMode: 'environment' },
                    {
                        fps: 20,
                        qrbox: (viewfinderWidth, viewfinderHeight) => ({
                            width: Math.floor(viewfinderWidth * 0.9),
                            height: Math.floor(viewfinderHeight * 0.4)
                        }),
                        disableFlip: false,
                    },
                    (decodedText) => {
                        setFormData(prev => ({ ...prev, serial_number: decodedText }));
                        qr.stop().catch(() => { });
                        html5QrCodeRef.current = null;
                        setIsScannerOpen(false);
                    },
                    () => { }
                );
            } catch (err) {
                alert('❌ Không mở được camera: ' + err);
                setIsScannerOpen(false);
            }
        }, 400);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.serial_number) {
            setErrorMsg('Vui lòng nhập mã Serial RFID.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = { ...formData, updated_at: new Date().toISOString() };
            if (!payload.net_weight) delete payload.net_weight;
            payload.customer_id = payload.customer_id || null;

            if (isEdit) {
                const { error } = await supabase
                    .from('cylinders')
                    .update(payload)
                    .eq('id', cylinder.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('cylinders')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving cylinder:', error);
            if (error.code === '23505') {
                setErrorMsg(`Mã RFID Serial "${formData.serial_number}" đã tồn tại trên hệ thống.`);
            } else {
                setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu thông tin bình khí.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center text-teal-700">
                            <ActivitySquare className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">
                                {isEdit ? 'Cập nhật Vỏ bình / Bình khí' : 'Thêm mới Vỏ bình / Bình khí'}
                            </h3>
                            <p className="text-sm font-medium text-slate-500">
                                {isEdit ? `Mã RFID: ${formData.serial_number}` : 'Điền đầy đủ thông tin kỹ thuật bên dưới'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-8 overflow-y-auto">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm font-bold text-rose-600 flex items-center gap-2">
                            <X className="w-5 h-5 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="cylinderForm" onSubmit={handleSubmit} className="space-y-8">

                        {/* Scanner Overlay */}
                        {isScannerOpen && (
                            <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[300] flex flex-col">
                                <div className="flex flex-col h-full md:h-auto md:max-h-[90vh] md:max-w-lg md:w-full md:m-auto md:rounded-3xl md:shadow-2xl bg-black md:bg-white overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-black/50 md:bg-white border-b border-white/10 md:border-gray-100 shrink-0">
                                        <h3 className="font-black text-white md:text-gray-800 flex items-center gap-2 text-sm md:text-base">
                                            <ScanLine className="w-5 h-5 text-teal-400 md:text-teal-600" /> Quét Barcode
                                        </h3>
                                        <button type="button" onClick={stopScanner} className="p-2 hover:bg-white/10 md:hover:bg-gray-100 rounded-xl transition-colors">
                                            <X className="w-5 h-5 text-white md:text-gray-500" />
                                        </button>
                                    </div>
                                    <div id="modal-barcode-reader" className="flex-1 w-full min-h-0"></div>
                                    <div className="px-4 py-3 md:px-6 md:py-4 text-center bg-black/50 md:bg-white shrink-0">
                                        <p className="text-xs md:text-sm text-gray-400 md:text-gray-500 font-medium">Hướng camera vào barcode</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 1: Thông tin cơ bản */}
                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-black text-teal-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                                <Hash className="w-4 h-4" /> THÔNG TIN ĐỊNH DANH & TRẠNG THÁI
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Mã Serial RFID *</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="serial_number"
                                            value={formData.serial_number}
                                            onChange={handleChange}
                                            placeholder="Ví dụ: QR04116"
                                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-900"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={startScanner}
                                            className="px-3 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center gap-1 transition-all shadow-sm"
                                            title="Quét Barcode"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Trạng thái</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Thể loại</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        <option value="BV">Bệnh viện (BV)</option>
                                        <option value="TM">Thẩm mỹ viện (TM)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Khách hàng</label>
                                    <select
                                        name="customer_id"
                                        value={formData.customer_id || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        <option value="">-- Trống (Thuộc kho) --</option>
                                        {customersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Kho *</label>
                                    <select
                                        name="warehouse_id"
                                        value={formData.warehouse_id || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        <option value="">-- Chọn kho --</option>
                                        {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Thông số kỹ thuật */}
                        <div>
                            <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">
                                <ActivitySquare className="w-4 h-4" /> THÔNG SỐ CẤU HÌNH & KỸ THUẬT
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Khối lượng tịnh (kg)</label>
                                    <input
                                        type="text"
                                        name="net_weight"
                                        value={formatNumber(formData.net_weight)}
                                        onChange={(e) => handleNumericChange('net_weight', e.target.value)}
                                        placeholder="Ví dụ: 12,5"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Thể tích</label>
                                    <select
                                        name="volume"
                                        value={formData.volume}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Loại khí</label>
                                    <select
                                        name="gas_type"
                                        value={formData.gas_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Loại van</label>
                                    <select
                                        name="valve_type"
                                        value={formData.valve_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Loại quai</label>
                                    <select
                                        name="handle_type"
                                        value={formData.handle_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {HANDLE_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        disabled={isLoading}
                    >
                        Hủy thoát
                    </button>
                    <button
                        type="submit"
                        form="cylinderForm"
                        disabled={isLoading}
                        className="px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-sm shadow-teal-200 transition-all flex items-center gap-2 border border-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        {isEdit ? 'Lưu thay đổi' : 'Lưu hồ sơ Bình'}
                    </button>
                </div>

            </div>
        </div>
    );
}
