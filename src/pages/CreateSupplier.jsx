import {
    Building2,
    CheckCircle2
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/config';

const CreateSupplier = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editSupplier = state?.supplier;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormState = editSupplier ? {
        name: editSupplier.name,
        phone: editSupplier.phone,
        address: editSupplier.address
    } : {
        name: '',
        phone: '',
        address: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleCreateSupplier = async () => {
        if (!formData.name || !formData.phone || !formData.address) {
            alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(formData)
                    .eq('id', editSupplier.id);

                if (error) throw error;
                alert('🎉 Đã cập nhật nhà cung cấp thành công!');
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([formData]);

                if (error) throw error;
                alert('🎉 Đã thêm nhà cung cấp thành công!');
            }
            navigate('/nha-cung-cap');
        } catch (error) {
            console.error('Error creating supplier:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData(initialFormState);
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-blue w-[350px] h-[350px] -top-20 -left-20 opacity-20"></div>
            <div className="blob blob-indigo w-[300px] h-[300px] bottom-1/4 -right-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-slate-600" />
                    {editSupplier ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp mới'}
                </h1>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-slate-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">
                    {/* Section 1: Thông tin cơ bản */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Hồ sơ nhà cung cấp</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Tên Nhà cung cấp *</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Công ty TNHH Plasma XY"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Liên hệ */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin liên hệ</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Số điện thoại *</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="09xx xxx xxx"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all text-blue-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Địa chỉ (Text) *</label>
                                <input
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Ví dụ: Văn Quán - Hà Nội"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all text-gray-700"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-gray-400 text-sm font-medium italic">* Vui lòng kiểm tra kỹ các thông tin nhà cung cấp trước khi lưu.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateSupplier}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-blue-200 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editSupplier ? 'Cập nhật Nhà cung cấp' : 'Lưu Nhà cung cấp'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateSupplier;
