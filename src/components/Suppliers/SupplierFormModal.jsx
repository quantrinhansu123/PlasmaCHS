import { Building2, MapPin, Phone, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

export default function SupplierFormModal({ supplier, onClose, onSuccess }) {
    const isEdit = !!supplier;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const defaultState = {
        name: '',
        phone: '',
        address: '',
    };

    const [formData, setFormData] = useState(defaultState);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                name: supplier.name || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
            });
        }
    }, [supplier, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim() || !formData.phone.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ Tên nhà cung cấp và Số điện thoại.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                name: formData.name.trim(),
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

            onSuccess();
        } catch (error) {
            console.error('Error saving supplier:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu nhà cung cấp.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                {isEdit ? supplier.name : 'Khởi tạo hồ sơ đối tác cung ứng vật tư'}
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

                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="supplierForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-3xl border border-emerald-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-emerald-700 [&_label_svg]:text-emerald-600">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-emerald-100">
                                <Building2 className="w-4 h-4 text-emerald-600" />
                                <h4 className="text-[18px] !font-extrabold !text-emerald-700">Thông tin nhà cung cấp</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Building2 className="w-4 h-4 text-emerald-500" />
                                        Tên nhà cung cấp <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="VD: Công ty TNHH Oxy Việt Nam, Nhà máy cơ khí..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Phone className="w-4 h-4 text-emerald-500" />
                                        Số điện thoại liên hệ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="024xxxxxxxx..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <MapPin className="w-4 h-4 text-emerald-500" />
                                        Địa chỉ trụ sở / Kho bãi
                                    </label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        rows="3"
                                        placeholder="Số nhà, đường, quận/huyện, tỉnh/thành..."
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 resize-none focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 focus:bg-white transition-all"
                                    />
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
                        form="supplierForm"
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
