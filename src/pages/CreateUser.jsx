import {
    Briefcase,
    CheckCircle2,
    Phone,
    ShieldCheck,
    UserCircle,
    UserPlus
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { USER_ROLES, USER_STATUSES } from '../constants/userConstants';
import { supabase } from '../supabase/config';

const CreateUser = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editUser = state?.userAcc;

    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormState = editUser ? {
        name: editUser.name,
        username: editUser.username,
        role: editUser.role,
        phone: editUser.phone,
        status: editUser.status
    } : {
        name: '',
        username: '',
        role: USER_ROLES[0].id, // Default to first role (Admin or whatever is first)
        phone: '',
        status: 'Hoạt động'
    };

    const [formData, setFormData] = useState(initialFormState);

    const handleCreateUser = async () => {
        // Validation for required fields
        if (!formData.name.trim() || !formData.username.trim() || !formData.phone.trim() || !formData.role || !formData.status) {
            alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
            return;
        }

        // Additional validation: Ensure phone only contains numbers
        const phoneRegex = /^[0-9]+$/;
        if (!phoneRegex.test(formData.phone)) {
            alert('Số điện thoại chỉ được chứa các ký tự số!');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!editUser || formData.username.trim() !== editUser.username) {
                // Check if username already exists
                const { data: existingUser } = await supabase
                    .from('app_users')
                    .select('id')
                    .eq('username', formData.username.trim())
                    .single();

                if (existingUser) {
                    alert(`Tên tài khoản "${formData.username}" đã tồn tại. Vui lòng chọn tên khác.`);
                    setIsSubmitting(false);
                    return;
                }
            }

            const payload = {
                name: formData.name.trim(),
                username: formData.username.trim(),
                role: formData.role,
                phone: formData.phone.trim(),
                status: formData.status
            };

            if (editUser) {
                const { error } = await supabase
                    .from('app_users')
                    .update(payload)
                    .eq('id', editUser.id);
                if (error) throw error;
                alert('🎉 Đã cập nhật chức danh thành công!');
                navigate('/nhan-su');
            } else {
                const { error } = await supabase
                    .from('app_users')
                    .insert([payload]);

                if (error) throw error;
                alert('🎉 Đã thêm người dùng mới thành công!');
                setFormData(initialFormState);
            }

        } catch (error) {
            console.error('Error creating user:', error);
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
            <div className="blob blob-blue w-[400px] h-[400px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-emerald w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <UserPlus className="w-8 h-8 text-blue-600" />
                    {editUser ? 'Cập nhật tài khoản người dùng' : 'Thêm người dùng mới'}
                </h1>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-10 space-y-10 md:space-y-12">

                    {/* Section 1: Thông tin cá nhân */}
                    <div className="space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">1</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin cá nhân & Tài khoản</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <UserCircle className="w-3.5 h-3.5" />
                                    Tên người dùng *
                                </label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ví dụ: Nguyễn Văn A"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all focus:bg-white text-gray-900"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Tên tài khoản (đăng nhập) *
                                </label>
                                <input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="Ví dụ: nguyenva"
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-blue-700"
                                />
                                <p className="text-xs text-gray-400 ml-2 font-medium">Viết liền không dấu, không chứa ký tự đặc biệt.</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Công việc & Liên hệ */}
                    <div className="space-y-4 md:space-y-6 bg-gray-50/50 -mx-6 md:-mx-10 px-6 md:px-10 py-8 border-y border-gray-50">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-3 md:pb-4">
                            <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-base md:text-lg font-bold text-gray-800 uppercase tracking-tight">Chức vụ & Liên hệ</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" />
                                    Vai trò *
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm cursor-pointer text-gray-900 transition-all appearance-none"
                                >
                                    {USER_ROLES.map(role => (
                                        <option key={role.id} value={role.id}>{role.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" />
                                    Số điện thoại *
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => {
                                        // Restrict input to numbers only
                                        const value = e.target.value.replace(/[^0-9]/g, '');
                                        setFormData({ ...formData, phone: value });
                                    }}
                                    placeholder="09xx xxx xxx"
                                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm transition-all text-gray-900"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                                    Trạng thái hoạt động *
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold shadow-sm cursor-pointer text-gray-900 transition-all appearance-none"
                                >
                                    {USER_STATUSES.map(status => (
                                        <option key={status.id} value={status.id}>{status.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-6 md:p-10 bg-white border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-gray-400 text-sm font-medium italic">* Tài khoản có thể bắt đầu sử dụng ngay sau khi được cấp phép.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all shadow-sm text-center"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateUser}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-12 py-4 rounded-2xl font-black text-white text-lg shadow-xl shadow-blue-200 transition-all flex justify-center items-center gap-3 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                        >
                            {isSubmitting ? 'Đang lưu tài khoản...' : (
                                <>
                                    <CheckCircle2 className="w-5 h-5" />
                                    {editUser ? 'Lưu thay đổi' : 'Tạo Người dùng'}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateUser;
