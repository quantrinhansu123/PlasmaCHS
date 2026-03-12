import {
    ActivitySquare,
    Camera,
    CheckCircle2,
    X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    CYLINDER_STATUSES,
    CYLINDER_VOLUMES,
    GAS_TYPES,
    HANDLE_TYPES,
    VALVE_TYPES
} from '../constants/machineConstants';
import { supabase } from '../supabase/config';
import { patchIOSVideoPlaysinline } from '../utils/scannerHelper';
import BarcodeScanner from '../components/Common/BarcodeScanner';

const CreateCylinder = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editCylinder = state?.cylinder;
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        warehouse_id: ''
    };

    const initialFormState = editCylinder || defaultState;
    const [formData, setFormData] = useState(initialFormState);
    const [customersList, setCustomersList] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Customers
                const { data: customers } = await supabase
                    .from('customers')
                    .select('id, name')
                    .order('name');
                if (customers) setCustomersList(customers);

                // Fetch Warehouses
                const { data: warehouses } = await supabase
                    .from('warehouses')
                    .select('id, name')
                    .eq('status', 'Đang hoạt động')
                    .order('name');
                if (warehouses) {
                    setWarehousesList(warehouses);
                    // If not editing and we have warehouses, set default to first one
                    if (!editCylinder && warehouses.length > 0) {
                        setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: warehouses[0].id } : prev);
                    }
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            }
        };
        fetchData();
    }, [editCylinder]);

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

    const handleCreateCylinder = async () => {
        if (!formData.serial_number) {
            alert('Vui lòng điền mã Serial (*) bắt buộc');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { ...formData };
            if (!payload.net_weight) delete payload.net_weight;

            if (editCylinder) {
                delete payload.id;
                delete payload.created_at;
                delete payload.updated_at;
                const { error } = await supabase
                    .from('cylinders')
                    .update(payload)
                    .eq('id', editCylinder.id);

                if (error) throw error;
                alert('🎉 Cập nhật vỏ bình thành công!');
            } else {
                const { error } = await supabase
                    .from('cylinders')
                    .insert([payload]);

                if (error) throw error;
                alert('🎉 Đã thêm vỏ bình mới thành công!');
            }

            navigate('/danh-sach-binh');
        } catch (error) {
            console.error('Error creating cylinder:', error);
            if (error.code === '23505') {
                alert(`❌ Lỗi: RFID Serial "${formData.serial_number}" đã tồn tại trên hệ thống.`);
            } else {
                alert('❌ Có lỗi xảy ra: ' + error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData(initialFormState);
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const parts = val.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(',');
    };

    const handleNumericChange = (field, value) => {
        let raw = value.replace(/\./g, '').replace(/,/g, '.');
        raw = raw.replace(/[^0-9.]/g, '');
        const dots = raw.split('.');
        if (dots.length > 2) raw = dots[0] + '.' + dots.slice(1).join('');
        setFormData(prev => ({ ...prev, [field]: raw }));
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-emerald w-[400px] h-[400px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-blue w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <ActivitySquare className="w-8 h-8 text-teal-600" />
                    {editCylinder ? 'Cập nhật vỏ bình / bình khí' : 'Thêm vỏ bình / bình khí mới'}
                </h1>
            </div>

            <BarcodeScanner 
                isOpen={isScannerOpen}
                onClose={stopScanner}
                onScanSuccess={handleScanSuccess}
                title="Quét mã Serial RFID bình"
            />

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-teal-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">
                    {/* Section 1: Thông tin cơ sở */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin cơ sở vỏ bình</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                            {/* Serial RFID + Barcode Scanner */}
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Serial RFID *</label>
                                <div className="flex gap-2">
                                    <input
                                        value={formData.serial_number}
                                        onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                        placeholder="Quét hoặc nhập mã barcode..."
                                        className="flex-1 px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={startScanner}
                                        className="px-5 py-4 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-2xl font-bold transition-all flex items-center gap-2 shrink-0"
                                        title="Quét barcode bằng camera"
                                    >
                                        <Camera className="w-5 h-5" />
                                        <span className="hidden sm:inline text-sm">Quét</span>
                                    </button>
                                </div>
                            </div>

                            {/* Mã bình (khắc trên vỏ) */}
                            <div className="space-y-2 sm:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Mã bình (khắc trên vỏ)</label>
                                <input
                                    value={formData.cylinder_code || ''}
                                    onChange={(e) => setFormData({ ...formData, cylinder_code: e.target.value })}
                                    placeholder="Mã khắc vật lý trên thân bình..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Trạng thái *</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm cursor-pointer text-gray-900"
                                >
                                    {CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Thể loại *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm cursor-pointer text-gray-900"
                                >
                                    <option value="BV">BV</option>
                                    <option value="TM">TM</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Khách hàng</label>
                                <select
                                    value={formData.customer_id || ''}
                                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm cursor-pointer text-gray-900"
                                >
                                    <option value="">-- Trống (Thuộc kho) --</option>
                                    {customersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Kho *</label>
                                <select
                                    value={formData.warehouse_id || ''}
                                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold text-base shadow-sm cursor-pointer text-gray-900"
                                >
                                    <option value="">-- Chọn kho quản lý --</option>
                                    {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Thông số kỹ thuật */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Cấu hình & Thông số</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Khối lượng tịnh (kg)</label>
                                <input
                                    type="text"
                                    value={formatNumber(formData.net_weight)}
                                    onChange={(e) => handleNumericChange('net_weight', e.target.value)}
                                    placeholder="8"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Thể tích</label>
                                <select
                                    value={formData.volume}
                                    onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold shadow-sm cursor-pointer text-sm"
                                >
                                    {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Loại khí</label>
                                <select
                                    value={formData.gas_type}
                                    onChange={(e) => setFormData({ ...formData, gas_type: e.target.value })}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold shadow-sm cursor-pointer text-sm"
                                >
                                    {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Loại van</label>
                                <select
                                    value={formData.valve_type}
                                    onChange={(e) => setFormData({ ...formData, valve_type: e.target.value })}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold shadow-sm cursor-pointer text-sm"
                                >
                                    {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Loại quai</label>
                                <select
                                    value={formData.handle_type}
                                    onChange={(e) => setFormData({ ...formData, handle_type: e.target.value })}
                                    className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 font-bold shadow-sm cursor-pointer text-sm"
                                >
                                    {HANDLE_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-gray-400 text-sm font-medium italic">* Kiểm tra kỹ mã QR RFID trên vỏ bình trước khi lưu.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateCylinder}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-teal-100 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editCylinder ? 'Cập nhật hồ sơ Bình' : 'Lưu hồ sơ Bình'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateCylinder;
