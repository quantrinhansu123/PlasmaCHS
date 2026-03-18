import { Activity, Bluetooth, Cpu, Hash, MapPin, MonitorIcon, Package, Radio, Save, ScanLine, Settings2, Wind, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    CYLINDER_VOLUMES,
    EMISSION_HEAD_TYPES,
    GAS_TYPES,
    MACHINE_STATUSES,
    MACHINE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';

export default function MachineFormModal({ machine, onClose, onSuccess }) {
    const isEdit = !!machine;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const defaultState = {
        serial_number: '',
        machine_account: '',
        status: 'chưa xác định',
        warehouse: '',
        bluetooth_mac: '',
        machine_type: 'BV',
        version: '',
        cylinder_volume: 'không',
        gas_type: 'Air',
        valve_type: 'không',
        emission_head_type: 'không',
        customer_name: '',
        department_in_charge: ''
    };

    const [formData, setFormData] = useState(defaultState);
    const [warehousesList, setWarehousesList] = useState([]);
    const [customersList, setCustomersList] = useState([]);

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const { data, error } = await supabase
                    .from('warehouses')
                    .select('id, name')
                    .eq('status', 'Đang hoạt động')
                    .order('name');
                if (!error && data) {
                    setWarehousesList(data);
                    // Default to first warehouse if creating new
                    if (!isEdit && data.length > 0 && !formData.warehouse) {
                        setFormData(prev => ({ ...prev, warehouse: data[0].id }));
                    }
                }

                const { data: customerData, error: customerError } = await supabase
                    .from('customers')
                    .select('name')
                    .order('name');
                if (!customerError && customerData) {
                    setCustomersList(customerData);
                }
            } catch (err) {
                console.error('Error fetching warehouses:', err);
            }
        };
        fetchWarehouses();
    }, [isEdit]);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                serial_number: machine.serial_number || '',
                machine_account: machine.machine_account || '',
                status: machine.status || 'chưa xác định',
                warehouse: machine.warehouse || '',
                bluetooth_mac: machine.bluetooth_mac || '',
                machine_type: machine.machine_type || 'BV',
                version: machine.version || '',
                cylinder_volume: machine.cylinder_volume || 'không',
                gas_type: machine.gas_type || 'Air',
                valve_type: machine.valve_type || 'không',
                emission_head_type: machine.emission_head_type || 'không',
                customer_name: machine.customer_name || '',
                department_in_charge: machine.department_in_charge || ''
            });
        }
    }, [machine, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'serial_number') {
                newState.machine_account = value;
            }
            return newState;
        });
    };

    const handleScanSuccess = useCallback((decodedText) => {
        setFormData(prev => ({
            ...prev,
            serial_number: decodedText,
            machine_account: decodedText
        }));
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

        if (!formData.serial_number || !formData.machine_type) {
            setErrorMsg('Vui lòng điền các trường bắt buộc (*)');
            return;
        }

        setIsLoading(true);

        try {
            const payload = { ...formData, updated_at: new Date().toISOString() };

            if (isEdit) {
                const { error } = await supabase
                    .from('machines')
                    .update(payload)
                    .eq('id', machine.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('machines')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving machine:', error);
            if (error.code === '23505') {
                setErrorMsg(`Mã Serial "${formData.serial_number}" đã tồn tại.`);
            } else {
                setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu thiết bị.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={stopScanner}
                onScanSuccess={handleScanSuccess}
                title="Quét mã Serial máy"
            />
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
                <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                                <MonitorIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                    {isEdit ? 'Cập nhật thiết bị hệ thống' : 'Thêm máy mới vào hệ thống'}
                                </h3>
                                <p className="text-[12px] font-semibold text-slate-500 mt-0.5">
                                    {isEdit ? `Mã máy: ${formData.serial_number}` : 'Điền đầy đủ thông tin kỹ thuật bên dưới'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0">
                        {errorMsg && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                                <X className="w-5 h-5 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        <form id="machineForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Section 1: Định danh thiết bị */}
                            <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-emerald-700 pb-3 border-b border-emerald-100">
                                    <Hash className="w-4 h-4 text-emerald-600" /> Định danh thiết bị
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="md:col-span-2 lg:col-span-1">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><ScanLine className="w-4 h-4" />Serial (Mã máy) <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                name="serial_number"
                                                value={formData.serial_number}
                                                onChange={handleChange}
                                                placeholder="PLT-25D1-50-TM"
                                                className="w-full h-12 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={startScanner}
                                                className="absolute right-2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center shadow-sm"
                                                title="Quét barcode"
                                            >
                                                <ScanLine className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Hash className="w-4 h-4" />Tài khoản máy</label>
                                        <input
                                            type="text"
                                            name="machine_account"
                                            value={formData.machine_account}
                                            disabled
                                            className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-2xl font-semibold text-slate-400 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Activity className="w-4 h-4" />Trạng thái <span className="text-red-500">*</span></label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {MACHINE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><MapPin className="w-4 h-4" />Kho quản lý</label>
                                        <select
                                            name="warehouse"
                                            value={formData.warehouse || ''}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                        >
                                            <option value="">-- Chưa xác định --</option>
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Cấu hình kỹ thuật */}
                            <div className="rounded-3xl border border-green-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-green-700 [&_label_svg]:text-green-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-green-700 pb-3 border-b border-green-100">
                                    <MonitorIcon className="w-4 h-4 text-green-600" /> Cấu hình & thông số
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Bluetooth className="w-4 h-4" />Bluetooth MAC</label>
                                        <input
                                            type="text"
                                            name="bluetooth_mac"
                                            value={formData.bluetooth_mac}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Cpu className="w-4 h-4" />Loại máy <span className="text-red-500">*</span></label>
                                        <select
                                            name="machine_type"
                                            value={formData.machine_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {MACHINE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Hash className="w-4 h-4" />Phiên bản</label>
                                        <input
                                            type="text"
                                            name="version"
                                            value={formData.version}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-green-100 focus:border-green-400 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Phụ kiện */}
                            <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-emerald-700 pb-3 border-b border-emerald-100">
                                    <Package className="w-4 h-4 text-emerald-600" /> Phụ kiện & bình khí
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Package className="w-4 h-4" />Thể tích bình</label>
                                        <select
                                            name="cylinder_volume"
                                            value={formData.cylinder_volume}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all text-[14px] font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Wind className="w-4 h-4" />Loại khí</label>
                                        <select
                                            name="gas_type"
                                            value={formData.gas_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all text-[14px] font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Settings2 className="w-4 h-4" />Loại van</label>
                                        <select
                                            name="valve_type"
                                            value={formData.valve_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all text-[14px] font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Radio className="w-4 h-4" />Loại đầu phát</label>
                                        <select
                                            name="emission_head_type"
                                            value={formData.emission_head_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white outline-none transition-all text-[14px] font-semibold text-slate-700 cursor-pointer"
                                        >
                                            {EMISSION_HEAD_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Thông tin sử dụng */}
                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                                    THÔNG TIN SỬ DỤNG
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Khách hàng đang dùng</label>
                                        <select
                                            name="customer_name"
                                            value={formData.customer_name}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900 cursor-pointer"
                                        >
                                            <option value="">-- Trống --</option>
                                            {customersList.map((c, idx) => (
                                                <option key={idx} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Bộ phận phụ trách</label>
                                        <input
                                            type="text"
                                            name="department_in_charge"
                                            value={formData.department_in_charge}
                                            onChange={handleChange}
                                            placeholder="Khoa/Phòng phụ trách..."
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-20">
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
                            form="machineForm"
                            disabled={isLoading}
                            className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center gap-2 border border-emerald-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            {isEdit ? 'Lưu thay đổi' : 'Lưu hồ sơ máy'}
                        </button>
                    </div>

                </div>
            </div>
        </>
    );
}
