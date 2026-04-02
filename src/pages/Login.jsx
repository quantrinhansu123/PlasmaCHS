import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase/config';
import bcrypt from 'bcryptjs';
import { Lock, User, Eye, EyeOff, LogIn, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');

    // Thêm CSS để ghi đè Autofill của trình duyệt
    const autofillStyles = `
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active  {
            -webkit-text-fill-color: white !important;
            -webkit-box-shadow: 0 0 0 1000px #1e293b inset !important;
            transition: background-color 5000s ease-in-out 0s;
        }
    `;

    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/trang-chu';

    // Check if already logged in
    useEffect(() => {
        const isAuthed = localStorage.getItem('is_authenticated') === 'true';
        if (isAuthed) {
            navigate(from, { replace: true });
        }
    }, [navigate, from]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // 1. Fetch user from database
            const { data: user, error: fetchError } = await supabase
                .from('app_users')
                .select('*')
                .eq('username', username.trim())
                .single();

            if (fetchError || !user) {
                throw new Error('Tài khoản không tồn tại trên hệ thống.');
            }

            if (user.status !== 'Hoạt động') {
                throw new Error('Tài khoản của bạn đang bị tạm khóa.');
            }

            // 2. Verify password with bcrypt
            const isPasswordValid = bcrypt.compareSync(password, user.password);

            if (!isPasswordValid) {
                throw new Error('Mật khẩu không chính xác.');
            }

            // 3. Set session
            const storage = rememberMe ? localStorage : sessionStorage;
            
            // Luôn xóa session cũ
            localStorage.removeItem('is_authenticated');
            localStorage.removeItem('user_id');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_role');
            sessionStorage.clear();

            storage.setItem('is_authenticated', 'true');
            storage.setItem('user_id', user.id);
            storage.setItem('user_name', user.name);
            storage.setItem('user_role', user.role);
            storage.setItem('user_avatar', user.avatar_url || '');

            toast.success(`Chào mừng trở lại, ${user.name}!`);
            
            // 4. Redirect
            setTimeout(() => {
                navigate(from, { replace: true });
            }, 500);

        } catch (err) {
            console.error('Login error:', err);
            setError(err.message);
            toast.error(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden font-sans">
            <style>{autofillStyles}</style>
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            
            <div className="relative w-full max-w-[450px] px-6 py-12">
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="w-20 h-20 bg-gradient-to-tr from-primary to-blue-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/20 mb-6 group transition-transform hover:scale-105">
                        <LogIn className="text-white w-10 h-10 group-hover:rotate-12 transition-transform" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">PLASMA VN</h1>
                    <p className="text-slate-300 text-sm font-semibold uppercase tracking-[0.2em] opacity-90">Hệ thống Quản lý Nội bộ</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-3xl animate-in zoom-in-95 duration-500">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username Field */}
                        <div className="space-y-2">
                            <label className="text-[12px] font-black text-white uppercase tracking-[0.1em] ml-1">Tài khoản</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-white transition-colors" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên đăng nhập..."
                                    autoComplete="off"
                                    className="w-full h-14 bg-white/10 border-2 border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-4 focus:ring-primary/40 focus:border-primary transition-all text-[16px] font-bold"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[12px] font-black text-white uppercase tracking-[0.1em]">Mật khẩu</label>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-white transition-colors" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    className="w-full h-14 bg-white/10 border-2 border-white/10 rounded-2xl pl-12 pr-12 text-white placeholder:text-white/30 focus:outline-none focus:ring-4 focus:ring-primary/40 focus:border-primary transition-all text-[16px] font-bold"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm animate-in shake duration-300">
                                <ShieldAlert size={18} className="shrink-0" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        {/* Keep Logged In */}
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={() => setRememberMe(!rememberMe)}
                                        className="peer sr-only"
                                    />
                                    <div className="w-5 h-5 border-2 border-slate-500 rounded-md bg-transparent transition-all peer-checked:bg-white peer-checked:border-white group-hover:border-white" />
                                    <CheckCircle2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary scale-0 peer-checked:scale-100 transition-transform" />
                                </div>
                                <span className="text-[13px] font-black text-slate-200 group-hover:text-white transition-colors uppercase tracking-tight">Ghi nhớ đăng nhập</span>
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={clsx(
                                "w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-[16px] shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                                isLoading && "cursor-wait"
                            )}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Đang xác thực...</span>
                                </>
                            ) : (
                                <>
                                    <span>Đăng nhập hệ thống</span>
                                    <LogIn className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Info */}
                <div className="mt-12 text-center text-slate-300 text-[11px] font-bold tracking-[0.2em] uppercase opacity-60">
                    &copy; 2026 Plasma VN. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default Login;
