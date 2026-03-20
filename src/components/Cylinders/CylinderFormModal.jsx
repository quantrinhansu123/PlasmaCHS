import { Activity, ActivitySquare, Camera, Gauge, Hash, Save, Scale, ScanLine, Settings2, Tag, User, Warehouse, Wind, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    CYLINDER_STATUSES,
    CYLINDER_VOLUMES,
    GAS_TYPES,
    HANDLE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';

export default function CylinderFormModal({ cylinder, onClose, onSuccess }) {
    const isEdit = !!cylinder;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

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
        department: '',
        warehouse_id: ''
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
                    if (!isEdit && data.length > 0) {
                        setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: data[0].id } : prev);
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
            const [, cDept] = cylinder.customer_name?.split(' / ') || ['', ''];
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
                department: cDept || '',
                warehouse_id: cylinder.warehouse_id || ''
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
    const handleScanSuccess = useCallback((decodedText) => {
        setFormData(prev => ({ ...prev, serial_number: decodedText }));
        setIsScannerOpen(false);
    }, []);

    const startScanner = useCallback(() => {
        setIsScannerOpen(true);
    }, []);

    const stopScanner = useCallback(() => {
        setIsScannerOpen(false);
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
            // Get customer name from list
            const customerObj = customersList.find(c => c.id === formData.customer_id);
            const customerNameBase = customerObj ? customerObj.name : '';
            const combinedCustomerName = customerNameBase
                ? `${customerNameBase}${formData.department ? ` / ${formData.department}` : ''}`
                : '';

            const payload = {
                ...formData,
                customer_name: combinedCustomerName,
                updated_at: new Date().toISOString()
            };
            if (!payload.net_weight) delete payload.net_weight;
            payload.customer_id = payload.customer_id || null;
            // Remove local only field
            delete payload.department;

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
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <ActivitySquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa vỏ bình / bình khí' : 'Thêm vỏ bình / bình khí'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                {isEdit ? `Mã RFID: ${formData.serial_number}` : 'Điền thông tin nhận diện và thông số kỹ thuật'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="cylinderForm" onSubmit={handleSubmit} className="space-y-6">
                        <BarcodeScanner
                            isOpen={isScannerOpen}
                            onClose={stopScanner}
                            onScanSuccess={handleScanSuccess}
                            title="Quét Barcode RFID"
                        />

                        <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-emerald-100">
                                <Hash className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-[18px] !font-extrabold !text-emerald-700">Thông tin định danh</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="md:col-span-2 lg:col-span-1 space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <ScanLine className="w-4 h-4 text-emerald-500" />
                                        Mã Serial RFID <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            name="serial_number"
                                            value={formData.serial_number}
                                            onChange={handleChange}
                                            placeholder="Ví dụ: QR04116"
                                            className="flex-1 h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={startScanner}
                                            className="h-12 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center transition-all shadow-sm border border-emerald-700/40"
                                            title="Quét Barcode"
                                        >
                                            <Camera className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Activity className="w-4 h-4 text-emerald-500" />
                                        Trạng thái
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    >
                                        {CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Tag className="w-4 h-4 text-emerald-500" />
                                        Thể loại
                                    </label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    >
                                        <option value="BV">Bệnh viện (BV)</option>
                                        <option value="TM">Thẩm mỹ viện (TM)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <User className="w-4 h-4 text-emerald-500" />
                                        Khách hàng
                                    </label>
                                    <select
                                        name="customer_id"
                                        value={formData.customer_id || ''}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    >
                                        <option value="">-- Trống (Thuộc kho) --</option>
                                        {customersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Settings2 className="w-4 h-4 text-emerald-500" />
                                        Vị trí
                                    </label>
                                    <input
                                        type="text"
                                        name="department"
                                        value={formData.department || ''}
                                        onChange={handleChange}
                                        placeholder="Ví dụ: Khoa Cấp cứu, Tầng 3..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Warehouse className="w-4 h-4 text-emerald-500" />
                                        Kho quản lý <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="warehouse_id"
                                        value={formData.warehouse_id || ''}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    >
                                        <option value="">-- Chọn kho --</option>
                                        {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-green-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-green-700 [&_label_svg]:text-green-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-green-100">
                                <ActivitySquare className="w-4 h-4 text-green-600" />
                                <h4 className="text-[18px] !font-extrabold !text-green-700">Thông số kỹ thuật</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Scale className="w-4 h-4 text-green-500" />
                                        Khối lượng tịnh (kg)
                                    </label>
                                    <input
                                        type="text"
                                        name="net_weight"
                                        value={formatNumber(formData.net_weight)}
                                        onChange={(e) => handleNumericChange('net_weight', e.target.value)}
                                        placeholder="Ví dụ: 12,5"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Gauge className="w-4 h-4 text-green-500" />
                                        Thể tích
                                    </label>
                                    <select
                                        name="volume"
                                        value={formData.volume}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    >
                                        {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Wind className="w-4 h-4 text-green-500" />
                                        Loại khí
                                    </label>
                                    <select
                                        name="gas_type"
                                        value={formData.gas_type}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    >
                                        {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Settings2 className="w-4 h-4 text-green-500" />
                                        Loại van
                                    </label>
                                    <select
                                        name="valve_type"
                                        value={formData.valve_type}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    >
                                        {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Wrench className="w-4 h-4 text-green-500" />
                                        Loại quai
                                    </label>
                                    <select
                                        name="handle_type"
                                        value={formData.handle_type}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white transition-all"
                                    >
                                        {HANDLE_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="cylinderForm"
                        disabled={isLoading}
                        className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 border border-emerald-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
                    </button>
                </div>
            </div>
        </div>
    );
}
