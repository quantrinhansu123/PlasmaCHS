import { CalendarDays, Gift, Save, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';
import { CUSTOMER_CATEGORIES } from '../../constants/orderConstants';



export default function PromotionFormModal({ promotion, onClose, onSuccess }) {
    const isEdit = !!promotion;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const defaultState = {
        code: '',
        free_cylinders: '',
        start_date: '',
        end_date: '',
        customer_type: CUSTOMER_CATEGORIES[0].id,
    };

    const [formData, setFormData] = useState(defaultState);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                code: promotion.code || '',
                free_cylinders: promotion.free_cylinders || '',
                start_date: promotion.start_date || '',
                end_date: promotion.end_date || '',
                customer_type: promotion.customer_type || CUSTOMER_CATEGORIES[0].id,
            });
        }
    }, [promotion, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumericChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, free_cylinders: value === '' ? '' : parseInt(value, 10) }));
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.code.trim()) {
            setErrorMsg('Vui lòng nhập Mã khuyến mãi.');
            return;
        }
        if (!formData.free_cylinders || Number(formData.free_cylinders) <= 0) {
            setErrorMsg('Số lượng bình KM phải lớn hơn 0.');
            return;
        }
        if (!formData.start_date || !formData.end_date) {
            setErrorMsg('Vui lòng chọn ngày bắt đầu và kết thúc.');
            return;
        }
        if (formData.end_date < formData.start_date) {
            setErrorMsg('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                free_cylinders: Number(formData.free_cylinders),
                start_date: formData.start_date,
                end_date: formData.end_date,
                customer_type: formData.customer_type,
                is_active: isEdit ? promotion.is_active : true,
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('app_promotions')
                    .update(payload)
                    .eq('id', promotion.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('app_promotions')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving promotion:', error);
            if (error.code === '23505') {
                setErrorMsg(`Mã khuyến mãi "${formData.code}" đã tồn tại!`);
            } else {
                setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu chương trình khuyến mãi.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-200 [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="bg-slate-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] border-0 sm:border sm:border-slate-200">

                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-rose-500">
                            <Gift className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa khuyến mãi' : 'Thêm khuyến mãi'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                {isEdit ? `Mã: ${promotion.code}` : 'Thiết lập chính sách ưu đãi bình khí'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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

                    <form id="promoForm" onSubmit={handleSubmit} className="space-y-6">
                        <div className="rounded-3xl border border-rose-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-rose-700 [&_label_svg]:text-rose-500">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-rose-100">
                                <Tag className="w-4 h-4 text-rose-500" />
                                <h4 className="text-[18px] !font-extrabold !text-rose-700">Thông tin chương trình</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Tag className="w-4 h-4 text-rose-400" />
                                        Mã khuyến mãi <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        placeholder="VD: KM02, KM_VIP..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 uppercase focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 focus:bg-white transition-all"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Gift className="w-4 h-4 text-rose-400" />
                                        Số lượng bình KM <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.free_cylinders)}
                                        onChange={handleNumericChange}
                                        placeholder="VD: 2.000"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 focus:bg-white transition-all"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-rose-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-rose-700 [&_label_svg]:text-rose-500">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-rose-100">
                                <CalendarDays className="w-4 h-4 text-rose-500" />
                                <h4 className="text-[18px] !font-extrabold !text-rose-700">Thời gian & đối tượng áp dụng</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <CalendarDays className="w-4 h-4 text-rose-400" />
                                            Ngày bắt đầu <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 focus:bg-white transition-all"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            <CalendarDays className="w-4 h-4 text-rose-400" />
                                            Ngày kết thúc <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="end_date"
                                            value={formData.end_date}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 focus:bg-white transition-all"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[14px] font-semibold text-slate-800">Loại khách hàng áp dụng <span className="text-red-500">*</span></label>
                                    <select
                                        name="customer_type"
                                        value={formData.customer_type}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 focus:bg-white transition-all"
                                    >
                                        {CUSTOMER_CATEGORIES.map(type => (
                                            <option key={type.id} value={type.id}>{type.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-500 font-semibold">Chỉ khách hàng thuộc loại này mới được áp dụng khấu trừ tự động.</p>
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
                        form="promoForm"
                        disabled={isLoading}
                        className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-rose-400 to-pink-400 hover:from-rose-500 hover:to-pink-500 text-white text-[15px] font-bold rounded-2xl shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-2 border border-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
