import { Home as HomeIcon, Layout, LogOut } from "lucide-react";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const isAuthenticated = true;
    const username = "Lê Minh Công";
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        navigate("/trang-chu");
    };

    // Don't show header on pages that have their own custom layouts or on login
    // Home has its own sidebar/topbar
    if (location.pathname === "/dang-nhap" || location.pathname === "/" || location.pathname === "/trang-chu") {
        return null;
    }

    return (
        <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 shadow-sm">
            <div className="mx-auto px-6 md:px-12">
                <div className="flex items-center justify-between h-20 gap-4">
                    {/* Brand/Logo */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-blue-100">
                            <Layout className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight hidden sm:inline-block">
                            PlasmaVN
                        </span>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center gap-6">
                        <Link
                            to="/trang-chu"
                            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:bg-blue-50/50 group"
                        >
                            <HomeIcon className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                            <span className="hidden md:inline">Trang chủ</span>
                        </Link>

                        {isAuthenticated && (
                            <div className="flex items-center gap-6 pl-6 border-l border-slate-100">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xs">
                                        AD
                                    </div>
                                    <div className="hidden xs:flex flex-col items-start leading-tight">
                                        <span className="text-sm font-black text-slate-800 tracking-tight">{username}</span>
                                        <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Quản trị viên</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border border-transparent hover:border-red-100 outline-none"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="hidden sm:inline">Đăng xuất</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
