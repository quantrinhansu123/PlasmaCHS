import {
    CheckCircle2,
    Truck
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SHIPPER_STATUSES, SHIPPING_TYPES } from '../constants/shipperConstants';
import { supabase } from '../supabase/config';

const CreateShipper = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editShipper = state?.shipper;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormState = editShipper ? {
        name: editShipper.name,
        shipping_type: editShipper.shipping_type,
        manager_name: editShipper.manager_name,
        phone: editShipper.phone,
        address: editShipper.address,
        status: editShipper.status
    } : {
        name: '',
        shipping_type: 'NHAN_VIEN',
        manager_name: '',
        phone: '',
        address: '',
        status: 'Đang hoạt động'
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleCreateShipper = async () => {
        if (!formData.name || !formData.manager_name || !formData.phone || !formData.address) {
            alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editShipper) {
                const { error } = await supabase
                    .from('shippers')
                    .update(formData)
                    .eq('id', editShipper.id);

                if (error) throw error;
                alert('🎉 Đã cập nhật đơn vị vận chuyển thành công!');
            } else {
                const { error } = await supabase
                    .from('shippers')
                    .insert([formData]);

                if (error) throw error;
                alert('🎉 Đã thêm đơn vị vận chuyển thành công!');
            }
            navigate('/danh-sach-dvvc');
        } catch (error) {
            console.error('Error creating shipper:', error);
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
            <div className="blob blob-emerald w-[400px] h-[400px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-blue w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Truck className="w-8 h-8 text-emerald-600" />
                    {editShipper ? 'Cập nhật ĐVVC' : 'Thêm đơn vị vận chuyển'}
                </h1>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-emerald-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">
                    {/* Section 1: Thông tin cơ bản */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Hồ sơ nhà vận chuyển</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Tên ĐVVC / Công ty *</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Công ty TNHH Vận tải XY"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Loại hình vận chuyển *</label>
                                <select
                                    value={formData.shipping_type}
                                    onChange={(e) => setFormData({ ...formData, shipping_type: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-base shadow-sm cursor-pointer text-gray-900 transition-all"
                                >
                                    {SHIPPING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Trạng thái *</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-base shadow-sm cursor-pointer text-gray-900 transition-all"
                                >
                                    {SHIPPER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Người đại diện & Liên hệ */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Người quản lý & Liên hệ</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Người quản lý *</label>
                                <input
                                    value={formData.manager_name}
                                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                                    placeholder="Nguyễn Văn B"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all"
                                />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Số điện thoại *</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0936394670"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all text-blue-700"
                                />
                            </div>
                            <div className="space-y-2 lg:col-span-3">
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
                    <p className="text-gray-400 text-sm font-medium italic">* Vui lòng kiểm tra kỹ các thông tin liên hệ bảo mật.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateShipper}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-blue-200 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editShipper ? 'Cập nhật ĐVVC' : 'Lưu ĐVVC'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateShipper;
