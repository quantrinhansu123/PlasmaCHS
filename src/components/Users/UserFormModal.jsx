import { clsx } from 'clsx';
import { Briefcase, CheckCircle2, ChevronDown, Phone, ShieldCheck, UserCircle, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { USER_ROLES, USER_STATUSES } from '../../constants/userConstants';
import { supabase } from '../../supabase/config';

export default function UserFormModal({ user, onClose, onSuccess }) {
    const isEdit = !!user;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const defaultState = {
        name: '',
        username: '',
        role: USER_ROLES[0].id,
        phone: '',
        department: '',
        sales_group: '',
        approval_level: 'Staff',
        status: 'Hoạt động',
    };

    const [formData, setFormData] = useState(defaultState);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                name: user.name || '',
                username: user.username || '',
                role: user.role || USER_ROLES[0].id,
                phone: user.phone || '',
                department: user.department || '',
                sales_group: user.sales_group || '',
                approval_level: user.approval_level || 'Staff',
                status: user.status || 'Hoạt động',
            });
        }
    }, [user, isEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        setFormData(prev => ({ ...prev, phone: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.name.trim() || !formData.username.trim() || !formData.phone.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
            return;
        }

        setIsLoading(true);

        try {
            if (!isEdit || formData.username.trim() !== user.username) {
                const { data: existingUser } = await supabase
                    .from('app_users')
                    .select('id')
                    .eq('username', formData.username.trim())
                    .single();

                if (existingUser) {
                    setErrorMsg(`Tên tài khoản "${formData.username}" đã tồn tại.`);
                    setIsLoading(false);
                    return;
                }
            }

            const payload = {
                name: formData.name.trim(),
                username: formData.username.trim(),
                role: formData.role,
                phone: formData.phone.trim(),
                department: formData.department.trim(),
                sales_group: formData.sales_group.trim(),
                approval_level: formData.approval_level,
                status: formData.status,
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('app_users')
                    .update(payload)
                    .eq('id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('app_users')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving user:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu nhân sự.');
        } finally {
            setIsLoading(false);
        }
    };

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
                    "relative bg-slate-50 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                            <UserCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Cập nhật tài khoản' : 'Thêm nhân sự mới'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-semibold mt-0.5 uppercase tracking-wider">
                                {isEdit ? `Tài khoản: @${user.username}` : 'Quản lý truy cập hệ thống'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-primary hover:text-primary/90 hover:bg-primary/5 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="userForm" onSubmit={handleSubmit} className="space-y-6">
                        {/* Section 1: Định danh */}
                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary uppercase tracking-tight">Định danh & Tài khoản</h4>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        Họ và tên nhân viên <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="VD: Nguyễn Văn A"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        required
                                    />
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        Tên tài khoản (đăng nhập) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        disabled={isEdit}
                                        placeholder="VD: nguyenva"
                                        className={clsx(
                                            "w-full h-12 px-4 border rounded-2xl font-bold text-[15px] transition-all uppercase tracking-wider",
                                            isEdit 
                                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                                                : "bg-slate-50 border-slate-200 text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                        required
                                    />
                                    {!isEdit && <p className="text-[10px] text-slate-400 ml-1 font-bold italic">* Viết liền không dấu, không chứa ký tự đặc biệt.</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Công việc */}
                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                <Briefcase className="w-4 h-4 text-primary" />
                                <h4 className="text-[18px] !font-extrabold !text-primary uppercase tracking-tight">Chức vụ & Liên lạc</h4>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        Vai trò hệ thống <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        >
                                            {USER_ROLES.map(role => (
                                                <option key={role.id} value={role.id}>{role.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary/70">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            Phòng ban / Đại lý
                                        </label>
                                        <input
                                            type="text"
                                            name="department"
                                            value={formData.department}
                                            onChange={handleChange}
                                            placeholder="VD: Kế toán, Đại lý A..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                            Nhóm kinh doanh
                                        </label>
                                        <input
                                            type="text"
                                            name="sales_group"
                                            value={formData.sales_group}
                                            onChange={handleChange}
                                            placeholder="VD: Nhóm 1, Miền Bắc..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        Quyền hạn phê duyệt (Approval)
                                    </label>
                                    <div className="relative">
                                        <select
                                            name="approval_level"
                                            value={formData.approval_level}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 appearance-none transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        >
                                            <option value="Staff">Nhân viên (Staff)</option>
                                            <option value="Supervisor">Tổ trưởng (Supervisor)</option>
                                            <option value="Manager">Quản lý (Manager)</option>
                                            <option value="Admin">Giám đốc / Admin</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary/70">
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                        <Phone className="w-3.5 h-3.5" />
                                        Số điện thoại <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        placeholder="09xxxxxxxx"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Trạng thái */}
                        <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                            <label className="text-[14px] font-extrabold text-primary uppercase tracking-wider block mb-1">
                                Trạng thái hoạt động <span className="text-rose-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {USER_STATUSES.map(status => {
                                    const isActive = formData.status === status.label;
                                    return (
                                        <button
                                            key={status.id}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, status: status.label }))}
                                            className={clsx(
                                                "px-4 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all duration-300 flex items-center justify-center gap-2",
                                                isActive
                                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                                                    : "bg-white text-slate-400 border-slate-100 hover:border-primary/30 hover:text-slate-600"
                                            )}
                                        >
                                            {isActive && <CheckCircle2 className="w-4 h-4" />}
                                            {status.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-primary font-bold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="userForm"
                        disabled={isLoading}
                        className={clsx(
                            "w-full md:flex-1 sm:w-auto px-6 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50",
                            "bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200"
                        )}
                    >
                        {isLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        {isLoading 
                            ? (isEdit ? 'Đang lưu...' : 'Đang thêm...') 
                            : (isEdit ? 'Lưu cập nhật' : 'Xác nhận Thêm')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
