import { Activity, Building2, MapPin, Save, User, Warehouse, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { WAREHOUSE_STATUSES } from '../../constants/warehouseConstants';
import { supabase } from '../../supabase/config';

export default function WarehouseFormModal({ warehouse, onClose, onSuccess }) {
    const isEdit = !!warehouse;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const defaultState = {
        name: '',
        manager_name: '',
        address: '',
        capacity: 0,
        status: 'Đang hoạt động',
        branch_office: '',
    };

    const [formData, setFormData] = useState(defaultState);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                name: warehouse.name || '',
                manager_name: warehouse.manager_name || '',
                address: warehouse.address || '',
                capacity: warehouse.capacity || 0,
                status: warehouse.status || 'Đang hoạt động',
                branch_office: warehouse.branch_office || '',
            });
        }
    }, [warehouse, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim() || !formData.manager_name.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ Tên kho và Tên thủ kho.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                name: formData.name.trim(),
                manager_name: formData.manager_name.trim(),
                address: formData.address.trim(),
                capacity: parseInt(formData.capacity) || 0,
                status: formData.status,
                branch_office: formData.branch_office?.trim(),
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('warehouses')
                    .update(payload)
                    .eq('id', warehouse.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('warehouses')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving warehouse:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu thông tin kho.');
        } finally {
            setIsLoading(false);
        }
    };

    const content = (
        <div className="flex flex-col h-full [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <Warehouse className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                            {isEdit ? 'Chỉnh sửa kho hàng' : 'Thêm kho hàng'}
                        </h3>
                        <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                            {isEdit ? `Kho: ${warehouse.name}` : 'Cập nhật thông tin vận hành kho'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
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

                <form id="warehouseForm" onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <Building2 className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin kho</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Building2 className="w-4 h-4 text-primary/60" />
                                    Tên cơ sở kho <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="VD: Kho trung tâm, Kho Đông Anh..."
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Building2 className="w-4 h-4 text-primary/60" />
                                    Chi nhánh / Văn phòng đại diện
                                </label>
                                <input
                                    type="text"
                                    name="branch_office"
                                    value={formData.branch_office}
                                    onChange={handleChange}
                                    placeholder="Tên chi nhánh (Tự động map sang Đại lý KH)"
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                />
                                <p className="text-[11px] text-slate-500 font-medium">Tên này sẽ tự động điền vào ô "Đại lý" khi tạo khách hàng</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <User className="w-4 h-4 text-primary/60" />
                                    Thủ kho phụ trách <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="manager_name"
                                    value={formData.manager_name}
                                    onChange={handleChange}
                                    placeholder="Tên nhân sự quản lý trực tiếp"
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <MapPin className="w-4 h-4 text-primary/60" />
                                    Địa chỉ kho hàng
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Vị trí bến bãi, nhà xưởng..."
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Warehouse className="w-4 h-4 text-primary/60" />
                                    Sức chứa (Vỏ bình)
                                </label>
                                <input
                                    type="number"
                                    name="capacity"
                                    value={formData.capacity}
                                    onChange={handleChange}
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <Activity className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Tình trạng vận hành</h4>
                        </div>

                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                <Activity className="w-4 h-4 text-primary/60" />
                                Trạng thái <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2.5 pt-1">
                                {WAREHOUSE_STATUSES.map(status => (
                                    <button
                                        key={status.id}
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, status: status.label }))}
                                        className={`px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all ${formData.status === status.label
                                            ? 'bg-primary text-white border-primary-dark shadow-sm shadow-primary/20'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                    >
                                        {status.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 sticky bottom-0 z-20">
                <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold text-[15px] transition-colors outline-none"
                    disabled={isLoading}
                >
                    Hủy
                </button>
                <button
                    type="submit"
                    form="warehouseForm"
                    disabled={isLoading}
                    className="flex-1 sm:flex-none px-6 py-3 bg-primary hover:bg-primary/90 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
    );

    return createPortal(
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
                    "relative bg-slate-50 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </div>
        </div>,
        document.body
    );
}
