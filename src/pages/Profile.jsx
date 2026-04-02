import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase/config';
import bcrypt from 'bcryptjs';
import { 
    User, 
    Mail, 
    Phone, 
    ShieldCheck, 
    Briefcase, 
    Lock, 
    Camera, 
    Save, 
    Loader2, 
    Eye, 
    EyeOff, 
    CheckCircle2, 
    AlertCircle,
    Building2,
    HandIcon
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';

const Profile = () => {
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    
    // Password change state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    const fileInputRef = useRef(null);
    const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

    useEffect(() => {
        if (userId) {
            fetchUserData();
        }
    }, [userId]);

    const fetchUserData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setUserData(data);
            
            // Sync localStorage in case it was updated on another tab
            localStorage.setItem('user_name', data.name);
            localStorage.setItem('user_role', data.role);
            localStorage.setItem('user_avatar', data.avatar_url || '');
        } catch (err) {
            console.error('Error fetching user data:', err);
            toast.error('Không thể tải thông tin hồ sơ.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. Validate size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Kích thước ảnh không được vượt quá 2MB.');
            return;
        }

        // 2. Validate type
        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn tệp hình ảnh hợp lệ.');
            return;
        }

        setIsUpdatingAvatar(true);
        try {
            // Convert to Base64 for internal storage simulation
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result;

                const { error } = await supabase
                    .from('app_users')
                    .update({ avatar_url: base64Data })
                    .eq('id', userId);

                if (error) throw error;

                setUserData(prev => ({ ...prev, avatar_url: base64Data }));
                localStorage.setItem('user_avatar', base64Data);
                toast.success('Cập nhật ảnh đại diện thành công!');
                setIsUpdatingAvatar(false);
            };
        } catch (err) {
            console.error('Avatar update error:', err);
            toast.error('Không thể cập nhật ảnh đại diện.');
            setIsUpdatingAvatar(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Mật khẩu xác nhận không khớp.');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }

        setIsUpdatingPassword(true);
        try {
            // 1. Verify current password
            const isMatch = bcrypt.compareSync(passwordData.currentPassword, userData.password);
            if (!isMatch) {
                toast.error('Mật khẩu hiện tại không chính xác.');
                setIsUpdatingPassword(false);
                return;
            }

            // 2. Hash new password
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(passwordData.newPassword, salt);

            // 3. Update in Supabase
            const { error } = await supabase
                .from('app_users')
                .update({ password: hashedPassword })
                .eq('id', userId);

            if (error) throw error;

            toast.success('Đổi mật khẩu thành công! Bạn có thể tiếp tục sử dụng hệ thống.');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error('Password change error:', err);
            toast.error('Có lỗi xảy ra khi đổi mật khẩu.');
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-slate-500 font-medium">Đang tải thông tin hồ sơ...</p>
            </div>
        );
    }

    const displayName = userData.name?.split(' ').map(n => n.charAt(0)).join('+') || 'U';
    const defaultAvatar = `https://ui-avatars.com/api/?name=${displayName}&background=random&color=random`;

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Profile Card */}
                <div className="w-full md:w-80 shrink-0 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 flex flex-col items-center text-center">
                    <div className="relative group cursor-pointer mb-6" onClick={() => fileInputRef.current.click()}>
                        <div className="w-32 h-32 rounded-full border-4 border-slate-50 shadow-inner overflow-hidden relative">
                            {isUpdatingAvatar ? (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                                </div>
                            ) : null}
                            <img 
                                src={userData.avatar_url || defaultAvatar} 
                                alt="Avatar" 
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            />
                        </div>
                        <div className="absolute bottom-0 right-0 w-10 h-10 bg-primary text-white rounded-full border-4 border-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 group-active:scale-95">
                            <Camera size={18} />
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleAvatarUpload}
                        />
                    </div>
                    
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{userData.name}</h2>
                    <p className="text-primary font-bold text-sm bg-primary/5 px-4 py-1.5 rounded-full mt-2 inline-block">
                        {userData.role}
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3 w-full mt-8 pt-8 border-t border-slate-100">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                <User size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài khoản</p>
                                <p className="text-[13px] font-bold text-slate-700">{userData.username}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                <Phone size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Số điện thoại</p>
                                <p className="text-[13px] font-bold text-slate-700">{userData.phone || 'Chưa cập nhật'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 space-y-8 w-full">
                    {/* General Info */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Briefcase size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Thông tin nhân sự</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <Building2 size={12} className="text-primary" />
                                    Phòng ban
                                </label>
                                <div className="h-12 flex items-center px-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-bold">
                                    {userData.department || 'Văn phòng'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <HandIcon size={12} className="text-primary" />
                                    Nhóm kinh doanh
                                </label>
                                <div className="h-12 flex items-center px-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-bold">
                                    {userData.sales_group || 'Chưa phân nhóm'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <ShieldCheck size={12} className="text-primary" />
                                    Vai trò hệ thống
                                </label>
                                <div className="h-12 flex items-center px-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 font-bold">
                                    {userData.role}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                                    <CheckCircle2 size={12} className="text-emerald-500" />
                                    Trạng thái tài khoản
                                </label>
                                <div className="h-12 flex items-center px-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 font-bold">
                                    {userData.status}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-8 md:p-10">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                                <Lock size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Bảo mật & Mật khẩu</h3>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-6 max-w-lg">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu hiện tại</label>
                                <div className="relative">
                                    <input 
                                        type={showPasswords.current ? "text" : "password"}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        placeholder="Nhập mật khẩu hiện tại"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white pr-12"
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu mới</label>
                                    <div className="relative">
                                        <input 
                                            type={showPasswords.new ? "text" : "password"}
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                            placeholder="••••••••"
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white pr-12"
                                            required
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Xác nhận mật khẩu</label>
                                    <div className="relative">
                                        <input 
                                            type={showPasswords.confirm ? "text" : "password"}
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                            placeholder="••••••••"
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white pr-12"
                                            required
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isUpdatingPassword}
                                className="h-12 px-8 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-[14px] shadow-lg shadow-slate-200 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                            >
                                {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                                Đổi mật khẩu
                            </button>
                        </form>

                        <div className="mt-8 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-amber-800">
                            <AlertCircle size={20} className="shrink-0 mt-0.5 text-amber-500" />
                            <div className="text-[13px] leading-relaxed">
                                <p className="font-black mb-1">Lưu ý bảo mật:</p>
                                <p className="font-bold opacity-80">Mật khẩu nên chứa ít nhất 6 ký tự và tránh sử dụng các thông tin cá nhân dễ đoán như ngày sinh, số điện thoại.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="text-center pb-8 opacity-20 text-[11px] font-black uppercase tracking-[0.3em]">
                &copy; 2026 Plasma VN Internal Management System
            </div>
        </div>
    );
};

export default Profile;
