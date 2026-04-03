import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase/config';
import bcrypt from 'bcryptjs';
import {
    Lock,
    User,
    Eye,
    EyeOff,
    LogIn,
    ShieldAlert,
    Loader2,
    Check,
    HeartPulse,
    ShieldCheck,
    Activity,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toast } from 'react-toastify';

/** Hình bình oxy y tế (vector) — nền chìm, màu theo currentColor */
function OxygenCylinderWatermark({ className }) {
    return (
        <svg
            className={className}
            viewBox="0 0 200 520"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <rect x="82" y="0" width="36" height="36" rx="5" />
            <rect x="72" y="32" width="56" height="28" rx="8" />
            <rect x="40" y="58" width="120" height="410" rx="16" />
            <ellipse cx="100" cy="468" rx="58" ry="24" opacity="0.28" />
            <rect x="40" y="232" width="120" height="9" rx="2" opacity="0.2" />
            <rect x="40" y="354" width="120" height="9" rx="2" opacity="0.2" />
            <text
                x="100"
                y="318"
                textAnchor="middle"
                fill="currentColor"
                opacity="0.17"
                style={{ fontSize: '40px', fontWeight: 700, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
                O₂
            </text>
        </svg>
    );
}

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');

    const autofillStyles = `
        .login-medical input:-webkit-autofill,
        .login-medical input:-webkit-autofill:hover,
        .login-medical input:-webkit-autofill:focus,
        .login-medical input:-webkit-autofill:active {
            -webkit-text-fill-color: #0f172a !important;
            -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
            transition: background-color 5000s ease-in-out 0s;
        }
    `;

    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/trang-chu';

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

            const isPasswordValid = bcrypt.compareSync(password, user.password);

            if (!isPasswordValid) {
                throw new Error('Mật khẩu không chính xác.');
            }

            const storage = rememberMe ? localStorage : sessionStorage;

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
        <div className="login-medical relative min-h-screen w-full flex font-sans text-slate-800 bg-[#f0fdfa] overflow-x-hidden">
            <style>{autofillStyles}</style>

            {/* Bình O₂ chìm — toàn trang (mobile) */}
            <div
                className="lg:hidden pointer-events-none absolute -right-8 bottom-0 w-[220px] sm:w-[260px] opacity-[0.07] text-teal-800 z-0"
                aria-hidden
            >
                <OxygenCylinderWatermark className="w-full h-auto" />
            </div>

            {/* Cột thương hiệu — giao diện y tế */}
            <aside className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#0d9488] via-[#0f766e] to-[#115e59] text-white overflow-hidden">
                <div
                    className="absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />
                <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -left-16 bottom-0 w-72 h-72 rounded-full bg-emerald-300/20 blur-3xl" />

                {/* Bình O₂ chìm — cột thương hiệu */}
                <div
                    className="pointer-events-none absolute right-[-12%] bottom-[-6%] w-[min(72%,420px)] max-h-[85vh] opacity-[0.13] text-white z-[1]"
                    aria-hidden
                >
                    <OxygenCylinderWatermark className="w-full h-auto max-h-[min(520px,85vh)]" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                            <HeartPulse className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-2xl xl:text-3xl font-bold tracking-tight">Plasma VN</h1>
                            <p className="text-sm text-teal-100/95 font-medium">Nền tảng quản lý chuyên nghiệp</p>
                        </div>
                    </div>
                    <p className="mt-10 text-lg xl:text-xl font-semibold leading-relaxed text-white/95 max-w-md">
                        An toàn dữ liệu — vận hành minh bạch cho đơn vị y tế và chuỗi cung ứng.
                    </p>
                </div>

                <div className="relative z-10 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm">
                        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-teal-100" />
                        <div>
                            <p className="font-semibold text-sm">Tuân thủ và bảo mật</p>
                            <p className="text-xs text-teal-100/90 mt-0.5 leading-relaxed">
                                Phiên làm việc được mã hóa; chỉ nhân sự được phân quyền mới truy cập được hệ thống.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-4 backdrop-blur-sm">
                        <Activity className="w-5 h-5 shrink-0 mt-0.5 text-teal-100" />
                        <div>
                            <p className="font-semibold text-sm">Theo dõi vận hành theo thời gian thực</p>
                            <p className="text-xs text-teal-100/90 mt-0.5 leading-relaxed">
                                Báo cáo, kho và quy trình nội bộ được tập trung trên một nền tảng thống nhất.
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Form đăng nhập */}
            <main className="relative z-[2] flex-1 flex flex-col items-center justify-center p-6 sm:p-10 min-h-screen overflow-hidden">
                <div
                    className="pointer-events-none absolute -right-4 md:-right-8 bottom-0 w-[min(320px,42vw)] max-h-[70vh] opacity-[0.055] text-teal-700 hidden lg:block"
                    aria-hidden
                >
                    <OxygenCylinderWatermark className="w-full h-auto max-h-[min(480px,70vh)]" />
                </div>
                <div className="relative z-[3] w-full max-w-md">
                    <div className="lg:hidden flex flex-col items-center text-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shadow-lg shadow-teal-900/15 mb-4">
                            <HeartPulse className="w-8 h-8 text-white" strokeWidth={2} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Plasma VN</h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Cổng đăng nhập hệ thống nội bộ</p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 p-8 sm:p-9">
                        <div className="hidden lg:block mb-8">
                            <h2 className="text-xl font-bold text-slate-900">Đăng nhập</h2>
                            <p className="text-sm text-slate-500 mt-1">Nhập thông tin tài khoản được cấp.</p>
                        </div>
                        <div className="lg:hidden mb-6">
                            <h2 className="text-lg font-bold text-slate-900">Đăng nhập tài khoản</h2>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label htmlFor="login-username" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Tài khoản
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                                    <input
                                        id="login-username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Tên đăng nhập"
                                        autoComplete="username"
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all text-[15px] font-medium"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="login-password" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Mật khẩu
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 group-focus-within:text-teal-600 transition-colors" />
                                    <input
                                        id="login-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-11 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all text-[15px] font-medium"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div
                                    role="alert"
                                    className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl flex items-start gap-3 text-sm"
                                >
                                    <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                                    <span className="font-medium leading-snug">{error}</span>
                                </div>
                            )}

                            <div className="flex items-center px-0.5">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={() => setRememberMe(!rememberMe)}
                                            className="peer sr-only"
                                        />
                                        <div className="absolute inset-0 rounded-md border-2 border-slate-300 bg-white transition-all peer-checked:bg-teal-600 peer-checked:border-teal-600 group-hover:border-teal-500" />
                                        <Check className="relative z-10 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none stroke-[3]" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
                                        Ghi nhớ đăng nhập
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={clsx(
                                    'w-full h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[15px] shadow-md shadow-teal-900/10 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
                                    isLoading && 'cursor-wait'
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Đang xác thực…</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Đăng nhập</span>
                                        <LogIn className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="mt-8 text-center text-xs text-slate-400 font-medium">
                        © 2026 Plasma VN. Hệ thống dành cho người dùng nội bộ.
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Login;
