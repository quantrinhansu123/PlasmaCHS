import { MapPin, Phone, Save, Truck, User, X, Edit3 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SHIPPING_TYPES } from '../../constants/shipperConstants';
import { supabase } from '../../supabase/config';
import { cn } from '../../lib/utils';
import { validatePhone, formatPhoneNumber } from '../../utils/taxUtils';

export default function ShipperFormModal({ shipper, onClose, onSuccess }) {
    const isEdit = !!shipper;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const defaultState = {
        name: '',
        shipping_type: SHIPPING_TYPES[0].id,
        manager_name: '',
        phone: '',
        address: '',
        status: 'Đang hoạt động',
    };

    const [formData, setFormData] = useState(defaultState);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                name: shipper.name || '',
                shipping_type: shipper.shipping_type || SHIPPING_TYPES[0].id,
                manager_name: shipper.manager_name || '',
                phone: shipper.phone || '',
                address: shipper.address || '',
                status: shipper.status || 'Đang hoạt động',
            });
        }
    }, [shipper, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            const formatted = formatPhoneNumber(value);
            setFormData(prev => ({ ...prev, [name]: formatted }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim() || !formData.manager_name.trim() || !formData.phone.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ các trường thông tin bắt buộc.');
            return;
        }

        if (!validatePhone(formData.phone)) {
            setErrorMsg('Số điện thoại không đúng định dạng Việt Nam (10 chữ số).');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                name: formData.name.trim(),
                shipping_type: formData.shipping_type,
                manager_name: formData.manager_name.trim(),
                phone: formData.phone.trim(),
                address: formData.address.trim(),
                status: formData.status,
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('shippers')
                    .update(payload)
                    .eq('id', shipper.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('shippers')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving shipper:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu đơn vị vận chuyển.');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <>
            <div className={cn(
                "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
                isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
                {/* Backdrop */}
                <div
                    className={cn(
                        "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                        isClosing && "animate-out fade-out duration-300"
                    )}
                    onClick={handleClose}
                />

                {/* Panel */}
                <div
                    className={cn(
                        "relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                        isClosing && "animate-out slide-out-to-right duration-300"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >

                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                {isEdit ? <Edit3 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                    {isEdit ? 'Chỉnh sửa ĐVVC' : 'Thêm mới ĐVVC'}
                                </h3>
                                <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                    {isEdit ? formData.name : 'Đăng ký thông tin đơn vị vận chuyển mới'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-primary hover:text-primary/90 hover:bg-primary/10 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                        {errorMsg && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                                <X className="w-4 h-4 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        <form id="shipperForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Info */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Truck className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin cơ bản</h4>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <Truck className="w-4 h-4 text-primary/70" />
                                            Tên đơn vị vận chuyển <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="VD: J&T, GHTK, Thanh Tùng Express..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Loại hình vận chuyển</label>
                                        <select
                                            name="shipping_type"
                                            value={formData.shipping_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all appearance-none"
                                        >
                                            {SHIPPING_TYPES.map(type => (
                                                <option key={type.id} value={type.id}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                                <User className="w-4 h-4 text-primary/70" />
                                                Người quản lý / Tài xế <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="manager_name"
                                                value={formData.manager_name}
                                                onChange={handleChange}
                                                placeholder="Tên người liên hệ trực tiếp"
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                                <Phone className="w-4 h-4 text-primary/70" />
                                                Số điện thoại liên hệ <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="0xxxxxxxxx..."
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Address & Status */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Địa chỉ & Trạng thái</h4>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <MapPin className="w-4 h-4 text-primary/70" />
                                            Địa chỉ văn phòng / Bãi xe
                                        </label>
                                        <input
                                            type="text"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            placeholder="Địa chỉ cụ thể, Quận/Huyện, Tỉnh/TP..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Trạng thái hợp tác</label>
                                        <div className="flex flex-wrap gap-2.5 pt-1">
                                            {[
                                                { id: 'Đang hoạt động', label: 'Đang hoạt động' },
                                                { id: 'Tạm ngưng', label: 'Tạm ngưng' },
                                                { id: 'Ngừng hợp tác', label: 'Ngừng hợp tác' }
                                            ].map(status => (
                                                <button
                                                    key={status.id}
                                                    type="button"
                                                    onClick={() => setFormData(p => ({ ...p, status: status.id }))}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all h-10",
                                                        formData.status === status.id
                                                            ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                    )}
                                                >
                                                    {status.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 sticky bottom-0 z-20">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-700 font-semibold text-[15px] transition-colors outline-none h-11"
                            disabled={isLoading}
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            form="shipperForm"
                            disabled={isLoading}
                            className="flex-1 sm:flex-none px-6 py-3 bg-primary hover:bg-primary/90 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed h-12"
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
        </>,
        document.body
    );
}
