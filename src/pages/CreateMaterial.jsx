import {
    CheckCircle2,
    Layers,
    ListFilter
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MATERIAL_CATEGORIES } from '../constants/materialConstants';
import { supabase } from '../supabase/config';

const CreateMaterial = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editMaterial = state?.material;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState(editMaterial ? {
        category: editMaterial.category,
        name: editMaterial.name,
        extra_number: editMaterial.extra_number || '',
        extra_text: editMaterial.extra_text || ''
    } : {
        category: MATERIAL_CATEGORIES[0].id,
        name: '',
        extra_number: '',
        extra_text: ''
    });

    const currentCategoryDef = useMemo(() => {
        return MATERIAL_CATEGORIES.find(c => c.id === formData.category) || MATERIAL_CATEGORIES[0];
    }, [formData.category]);

    const handleCategoryChange = (e) => {
        setFormData({
            ...formData,
            category: e.target.value,
            // Reset các trường phụ trợ khi đổi danh mục
            extra_number: '',
            extra_text: ''
        });
    };

    const handleCreateMaterial = async () => {
        if (!formData.name.trim()) {
            alert('Vui lòng nhập tên vật tư bắt buộc (*)');
            return;
        }

        // Prepare data payload, ensuring we only send fields relevant to the category
        const payload = {
            category: formData.category,
            name: formData.name.trim(),
            extra_number: currentCategoryDef.hasNumberField && formData.extra_number !== '' ? Number(formData.extra_number) : null,
            extra_text: currentCategoryDef.hasTextField ? formData.extra_text.trim() : null
        };

        setIsSubmitting(true);
        try {
            if (editMaterial) {
                const { error } = await supabase
                    .from('materials')
                    .update(payload)
                    .eq('id', editMaterial.id);

                if (error) throw error;
                alert('🎉 Cập nhật danh mục vật tư thành công!');
                navigate('/nguon-vat-tu');
            } else {
                const { error } = await supabase
                    .from('materials')
                    .insert([payload]);

                if (error) throw error;
                alert('🎉 Đã thêm danh mục vật tư thành công!');
                // Reset dữ liệu về ban đầu nhưng giữ lại loại vật tư đang chọn
                setFormData({
                    category: formData.category,
                    name: '',
                    extra_number: '',
                    extra_text: ''
                });
            }
        } catch (error) {
            console.error('Error creating material:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            category: 'vỏ bình',
            name: '',
            extra_number: '',
            extra_text: ''
        });
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
            <div className="blob blob-emerald w-[350px] h-[350px] -top-20 -left-20 opacity-20"></div>
            <div className="blob blob-blue w-[300px] h-[300px] bottom-1/4 -right-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Layers className="w-8 h-8 text-emerald-600" />
                    {editMaterial ? 'Cập nhật vật tư' : 'Thêm mới vật tư'}
                </h1>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">

                    {/* Section 1: Phân loại */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Nhóm vật liệu (Category)</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <ListFilter className="w-3.5 h-3.5" />
                                    Chọn loại vật tư cần định nghĩa *
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={handleCategoryChange}
                                    disabled={!!editMaterial}
                                    className={`w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm ${editMaterial ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} text-blue-900 transition-all`}
                                >
                                    {MATERIAL_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Thuộc tính chi tiết */}
                    <div className="space-y-4 md:space-y-6 bg-gray-50/50 -mx-6 md:-mx-10 px-6 md:px-10 py-8 border-y border-gray-50">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Thông số chi tiết</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">

                            {/* Tên vật tư (Luôn hiện) */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                                    {currentCategoryDef.nameLabel} *
                                </label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={currentCategoryDef.namePlaceholder}
                                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all focus:bg-white text-gray-900 text-lg"
                                />
                                <p className="text-xs text-gray-400 ml-2 font-medium">Là tên sẽ hiển thị trong các danh sách thả xuống khi lắp ráp Máy / Bình.</p>
                            </div>

                            {/* Cột Number (Nếu có cấu hình) */}
                            {currentCategoryDef.hasNumberField && (
                                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                                        {currentCategoryDef.numberFieldLabel}
                                    </label>
                                    <input
                                        type="text"
                                        value={formatNumber(formData.extra_number)}
                                        onChange={(e) => handleNumericChange('extra_number', e.target.value)}
                                        placeholder={currentCategoryDef.numberPlaceholder}
                                        className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all text-blue-700"
                                    />
                                </div>
                            )}

                            {/* Cột Text (Nếu có cấu hình) */}
                            {currentCategoryDef.hasTextField && (
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                                        {currentCategoryDef.textFieldLabel}
                                    </label>
                                    <textarea
                                        value={formData.extra_text}
                                        onChange={(e) => setFormData({ ...formData, extra_text: e.target.value })}
                                        placeholder={currentCategoryDef.textPlaceholder}
                                        rows={3}
                                        className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-medium shadow-sm transition-all text-gray-700 resize-none"
                                    />
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 md:p-10 bg-white border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-gray-400 text-sm font-medium italic">* Kiểm tra kỹ chính tả trước khi lưu vào từ điển chung.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateMaterial}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-blue-200 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editMaterial ? 'Cập nhật Vật tư' : 'Lưu Vật tư'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateMaterial;
