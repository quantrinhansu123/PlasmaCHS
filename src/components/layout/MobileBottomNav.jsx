import React from 'react';
import { ChevronLeft, Home, ClipboardList } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { usePermissions } from '../../hooks/usePermissions';
import { canAccessPath } from '../../utils/accessControl';

function MobileBottomNav() {
  const navigate = useNavigate();
  const { role, permissions } = usePermissions();
  const location = useLocation();

  const isHome = location.pathname === '/trang-chu' || location.pathname === '/';

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-slate-100 z-40 px-8 flex items-center justify-between pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="!p-2 !h-10 !w-10 !min-w-0 !rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <ChevronLeft size={24} strokeWidth={2} />
      </button>

      {/* Floating Home Button - FORCED CIRCULAR */}
      <button
        onClick={() => navigate('/trang-chu')}
        className={clsx(
          "relative !w-12 !h-12 !p-0 !rounded-full flex items-center justify-center -translate-y-4 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.12)] border border-slate-50 transition-all duration-300 hover:scale-110 active:scale-95 group",
          isHome ? "bg-white text-primary" : "bg-white text-slate-500"
        )}
      >
        <div className="absolute inset-0 !rounded-full bg-white" />
        <Home 
          size={22} 
          strokeWidth={2.2} 
          className="relative z-10"
        />
      </button>

      {/* Right Slot: Shipping Tasks or Spacer */}
      {canAccessPath('/nhiem-vu-giao-hang', role, permissions) ? (
        <button
          onClick={() => navigate('/nhiem-vu-giao-hang')}
          className={clsx(
            '!p-2 !h-10 !w-10 !min-w-0 !rounded-full flex items-center justify-center transition-colors',
            location.pathname === '/nhiem-vu-giao-hang' ? 'text-primary bg-primary/5' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          <ClipboardList size={22} strokeWidth={2} />
        </button>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
}

export default MobileBottomNav;

