import { Building2, MapPin, Phone, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';
import { validateMST, validatePhone, formatPhoneNumber } from '../../utils/taxUtils';

export default function SupplierFormModal({ supplier, onClose, onSuccess }) {
    const isEdit = !!supplier;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [taxError, setTaxError] = useState(false);
    const [phoneError, setPhoneError] = useState(false);

    const defaultState = {
        name: '',
        tax_id: '',
        email: '',
        phone: '',
        address: '',
    };

    const [formData, setFormData] = useState(defaultState);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                name: supplier.name || '',
                tax_id: supplier.tax_id || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
            });
        }
    }, [supplier, isEdit]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'tax_id') {
            setTaxError(value ? !validateMST(value) : false);
            setFormData(prev => ({ ...prev, [name]: value }));
        } else if (name === 'phone') {
            const formatted = formatPhoneNumber(value);
            setFormData(prev => ({ ...prev, [name]: formatted }));
            setPhoneError(formatted ? !validatePhone(formatted) : false);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim() || !formData.phone.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ Tên nhà cung cấp và Số điện thoại.');
            return;
        }

        if (phoneError || (formData.phone && !validatePhone(formData.phone))) {
            setErrorMsg('Số điện thoại không đúng định dạng. Vui lòng kiểm tra lại.');
            setPhoneError(true);
            return;
        }

        if (taxError) {
            setErrorMsg('Mã số thuế không hợp lệ. Vui lòng kiểm tra lại.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                name: formData.name.trim(),
                tax_id: formData.tax_id.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                address: formData.address.trim(),
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(payload)
                    .eq('id', supplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([payload]);
                if (error) throw error;
            }

            // Trigger slide-out animation on success
            setIsClosing(true);
            setTimeout(() => {
                onSuccess();
            }, 300);
        } catch (error) {
            console.error('Error saving supplier:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu nhà cung cấp.');
        } finally {
            setIsLoading(false);
        }
    };

    const drawerContent = (
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end",
            isClosing ? "pointer-events-none" : ""
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Drawer Panel */}
            <div className={clsx(
                "relative h-full w-full max-w-[550px] bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500",
                isClosing && "animate-out slide-out-to-right duration-300",
                "[&_input]:!font-semibold [&_textarea]:!font-semibold [&_input]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400"
            )}>

                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-primary/20">
                            <Building2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1">
                                {isEdit ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
                            </h3>
                            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                {isEdit ? supplier.name : 'Khởi tạo hồ sơ đối tác cung ứng'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-transparent hover:border-primary/10 hover:shadow-sm"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 min-h-0 custom-scrollbar">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[13px] font-bold text-rose-600 flex items-center gap-3 animate-in shake duration-500">
                            <X className="w-4 h-4 shrink-0 p-0.5 bg-rose-100 rounded-full" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="supplierForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-3xl border border-primary/10 bg-white p-6 space-y-6 shadow-sm">
                            <div className="flex items-center gap-2.5 pb-4 border-b border-primary/5">
                                <Building2 className="w-4 h-4 text-primary" />
                                <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Thông tin định danh</h4>
                            </div>

                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                        <Building2 className="w-3.5 h-3.5 text-primary" />
                                        Tên nhà cung cấp <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="VD: Công ty TNHH Oxy Việt Nam..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all shadow-sm"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                        <Building2 className="w-3.5 h-3.5 text-primary" />
                                        Mã số thuế (MST)
                                    </label>
                                    <input
                                        type="text"
                                        name="tax_id"
                                        value={formData.tax_id}
                                        onChange={handleChange}
                                        placeholder="Mã số thuế của doanh nghiệp..."
                                        className={clsx(
                                            "w-full h-12 px-4 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all shadow-sm font-semibold",
                                            taxError 
                                                ? "bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-100 focus:border-rose-400" 
                                                : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-primary/10 focus:border-primary focus:bg-white"
                                        )}
                                    />
                                    {taxError && (
                                        <p className="text-[11px] font-bold text-rose-600 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                                            ⚠ Mã số thuế không đúng định dạng hoặc sai số kiểm tra
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                        <X className="w-3.5 h-3.5 text-primary rotate-45" />
                                        Email liên hệ
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Địa chỉ email nhận thông báo..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                        <Phone className="w-3.5 h-3.5 text-primary" />
                                        Số điện thoại liên hệ <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="VD: 024.1234.5678"
                                        className={clsx(
                                            "w-full h-12 px-4 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all shadow-sm font-semibold",
                                            phoneError 
                                                ? "bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-100 focus:border-rose-400" 
                                                : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-primary/10 focus:border-primary focus:bg-white"
                                        )}
                                        required
                                    />
                                    {phoneError && (
                                        <p className="text-[11px] font-bold text-rose-600 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                                            ⚠ Số điện thoại không đúng định dạng
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-[12px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                        <MapPin className="w-3.5 h-3.5 text-primary" />
                                        Địa chỉ trụ sở / Kho bãi
                                    </label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        rows="4"
                                        placeholder="Số nhà, tên đường, khu vực..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] resize-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-4 sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-6 py-3 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-black text-[13px] uppercase tracking-wider transition-all shadow-sm"
                        disabled={isLoading}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        form="supplierForm"
                        disabled={isLoading}
                        className="flex-1 px-8 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white text-[13px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-3 border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {isEdit ? 'Lưu thay đổi' : 'Xác nhận thêm'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(drawerContent, document.body);
}
