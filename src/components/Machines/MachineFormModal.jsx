import { Hash, MonitorIcon, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    CYLINDER_VOLUMES,
    EMISSION_HEAD_TYPES,
    GAS_TYPES,
    MACHINE_STATUSES,
    MACHINE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { supabase } from '../../supabase/config';

export default function MachineFormModal({ machine, onClose, onSuccess }) {
    const isEdit = !!machine;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

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
        emission_head_type: 'không'
    };

    const [formData, setFormData] = useState(defaultState);
    const [warehousesList, setWarehousesList] = useState([]);

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
                emission_head_type: machine.emission_head_type || 'không'
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="p-6 border-b border-indigo-100 flex items-center justify-between shrink-0 bg-indigo-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700">
                            <MonitorIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">
                                {isEdit ? 'Cập nhật thiết bị hệ thống' : 'Thêm máy mới vào hệ thống'}
                            </h3>
                            <p className="text-sm font-medium text-slate-500">
                                {isEdit ? `Mã máy: ${formData.serial_number}` : 'Điền đầy đủ thông tin kỹ thuật bên dưới'}
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

                    <form id="machineForm" onSubmit={handleSubmit} className="space-y-10">
                        {/* Section 1: Định danh thiết bị */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-sm font-black text-indigo-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                                <Hash className="w-4 h-4" /> ĐỊNH DANH THIẾT BỊ
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="md:col-span-2 lg:col-span-1">
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Serial (Mã máy) *</label>
                                    <input
                                        type="text"
                                        name="serial_number"
                                        value={formData.serial_number}
                                        onChange={handleChange}
                                        placeholder="PLT-25D1-50-TM"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tài khoản máy</label>
                                    <input
                                        type="text"
                                        name="machine_account"
                                        value={formData.machine_account}
                                        disabled
                                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-400 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Trạng thái *</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {MACHINE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Kho quản lý</label>
                                    <select
                                        name="warehouse"
                                        value={formData.warehouse || ''}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        <option value="">-- Chưa xác định --</option>
                                        {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Cấu hình kỹ thuật */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                                <MonitorIcon className="w-4 h-4" /> CẤU HÌNH & THÔNG SỐ
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Bluetooth MAC</label>
                                    <input
                                        type="text"
                                        name="bluetooth_mac"
                                        value={formData.bluetooth_mac}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Loại máy *</label>
                                    <select
                                        name="machine_type"
                                        value={formData.machine_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                    >
                                        {MACHINE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Phiên bản</label>
                                    <input
                                        type="text"
                                        name="version"
                                        value={formData.version}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Phụ kiện */}
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                                PHỤ KIỆN & BÌNH KHÍ
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Thể tích bình</label>
                                    <select
                                        name="cylinder_volume"
                                        value={formData.cylinder_volume}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer"
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
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer"
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
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer"
                                    >
                                        {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Loại đầu phát</label>
                                    <select
                                        name="emission_head_type"
                                        value={formData.emission_head_type}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer"
                                    >
                                        {EMISSION_HEAD_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-white border-t border-indigo-50 shrink-0 flex items-center justify-end gap-3 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
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
                        form="machineForm"
                        disabled={isLoading}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center gap-2 border border-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    );
}
