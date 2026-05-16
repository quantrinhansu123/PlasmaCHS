import React from 'react';
import { Home, Package, Warehouse, Bell, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { usePermissions } from '../../hooks/usePermissions';
import { canAccessPath } from '../../utils/accessControl';

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Trang chủ',
    path: '/trang-chu',
    icon: Home,
    isActive: (path) => path === '/trang-chu' || path === '/',
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    path: '/don-hang',
    icon: Package,
    canAccess: (role, permissions) => canAccessPath('/don-hang', role, permissions),
    isActive: (path) => path === '/don-hang' || path.startsWith('/don-hang-kinh-doanh'),
  },
  {
    id: 'warehouse',
    label: 'Kho',
    path: '/kho',
    icon: Warehouse,
    canAccess: (role, permissions) => canAccessPath('/kho', role, permissions),
    isActive: (path) => path === '/kho' || path.startsWith('/kho/'),
  },
  {
    id: 'notifications',
    label: 'Thông báo',
    action: 'notifications',
    icon: Bell,
    isActive: () => false,
  },
  {
    id: 'profile',
    label: 'Tài khoản',
    path: '/ho-so',
    icon: User,
    isActive: (path) => path === '/ho-so',
  },
];

function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, permissions } = usePermissions();

  const handleNav = (item) => {
    if (item.action === 'notifications') {
      window.dispatchEvent(new CustomEvent('plasmavn:open-notifications'));
      return;
    }
    if (item.path) {
      navigate(item.path);
    }
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.canAccess || item.canAccess(role, permissions)
  );

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-safe"
      aria-label="Điều hướng chính"
    >
      <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1.5 min-h-[62px]">
        {visibleItems.map((item) => {
          const active = item.isActive(location.pathname);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item)}
              className={clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 px-1 py-1 rounded-xl transition-colors',
                active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <span
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-all',
                  active && 'bg-blue-50 shadow-sm'
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={clsx('text-[10px] font-semibold leading-tight truncate max-w-full', active && 'text-blue-600')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
