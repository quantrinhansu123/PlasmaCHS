import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

import { sidebarMenu } from '../../constants/sidebarMenu';
import { actionModuleGroups } from '../../constants/actionModuleData';
import { usePermissions } from '../../hooks/usePermissions';
import { canAccessPath, normalizeRole } from '../../utils/accessControl';

function Sidebar({ isOpen, setIsOpen }) {
  const { role, permissions } = usePermissions();
  const hasRoleAccess = (allowedRoles, currentRole) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const normalizedCurrent = normalizeRole(currentRole);
    return allowedRoles.some((r) => normalizeRole(r) === normalizedCurrent);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 bg-white border-r border-border transition-all duration-300 flex flex-col h-full',
          isOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-[72px]'
        )}
      >
        <div
          className={clsx(
            'h-[65px] flex items-center border-b border-border overflow-hidden shrink-0 transition-all duration-300',
            isOpen ? 'px-5' : 'justify-center'
          )}
        >
          <div
            className={clsx(
              'rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 transition-all duration-300 shadow-sm',
              isOpen ? 'w-9 h-9' : 'w-10 h-10'
            )}
          >
            <Sparkles size={20} />
          </div>
          <div className={clsx('flex flex-col ml-3 whitespace-nowrap transition-opacity duration-300', !isOpen && 'opacity-0 hidden')}>
            <span className="font-bold text-[16px] leading-tight text-slate-900 tracking-tight">PlasmaVN</span>
            <span className="text-[11px] text-slate-600 leading-tight font-bold">Hệ thống quản lý</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-2 custom-scrollbar flex flex-col items-center lg:items-stretch">
          {sidebarMenu
            .filter(item => hasRoleAccess(item.roles, role) && canAccessPath(item.path, role, permissions))
            .map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isOpen={isOpen}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setIsOpen(false);
                  }
                }}
              />
            ))}
        </nav>
      </aside>
    </>
  );
}

function NavItem({ item, onClick, isOpen }) {
  const location = useLocation();

  const modulePathByItemPath = Object.fromEntries(
    actionModuleGroups.flatMap((group) => group.items.map((entry) => [entry.href, group.path]))
  );

  const isActive = location.pathname === item.path || modulePathByItemPath[location.pathname] === item.path;

  // Mapping for Tailwind classes to ensure they are picked up by the compiler
  const colorMap = {
    'blue-500': { bg: 'bg-blue-500', indicator: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
    'amber-500': { bg: 'bg-amber-500', indicator: 'bg-amber-500', shadow: 'shadow-amber-500/20' },
    'emerald-500': { bg: 'bg-emerald-500', indicator: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' },
    'cyan-500': { bg: 'bg-cyan-500', indicator: 'bg-cyan-500', shadow: 'shadow-cyan-500/20' },
    'orange-500': { bg: 'bg-orange-500', indicator: 'bg-orange-500', shadow: 'shadow-orange-500/20' },
    'rose-500': { bg: 'bg-rose-500', indicator: 'bg-rose-500', shadow: 'shadow-rose-500/20' },
    'sky-500': { bg: 'bg-sky-500', indicator: 'bg-sky-500', shadow: 'shadow-sky-500/20' },
    'teal-500': { bg: 'bg-teal-500', indicator: 'bg-teal-500', shadow: 'shadow-teal-500/20' },
    'slate-500': { bg: 'bg-slate-500', indicator: 'bg-slate-500', shadow: 'shadow-slate-500/20' },
    'indigo-500': { bg: 'bg-indigo-500', indicator: 'bg-indigo-500', shadow: 'shadow-indigo-500/20' },
    'blue-600': { bg: 'bg-blue-600', indicator: 'bg-blue-600', shadow: 'shadow-blue-600/20' },
  };

  const colorKey = item.color ? item.color.replace('text-', '') : 'blue-600';
  const styles = colorMap[colorKey] || colorMap['blue-600'];

  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive: linkActive }) =>
        clsx(
          'relative flex items-center transition-all duration-300 group',
          isOpen ? 'px-4 py-2 w-full' : 'w-full justify-center h-14'
        )
      }
      title={!isOpen ? item.label : undefined}
    >
      {/* Active Indicator Bar */}
      <div
        className={clsx(
          'absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-r-full transition-all duration-500 ease-out',
          isActive ? clsx('opacity-100 scale-y-100', styles.indicator) : 'opacity-0 scale-y-50'
        )}
      />

      <div
        className={clsx(
          'flex items-center justify-center shrink-0 transition-all duration-300 rounded-[14px]',
          isActive
            ? clsx('text-white shadow-lg', styles.bg, styles.shadow)
            : 'text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600',
          isOpen ? 'w-10 h-10 mr-3' : 'w-11 h-11'
        )}
      >
        <item.icon
          size={22}
          strokeWidth={2.25}
        />
      </div>

      <span
        className={clsx(
          'font-semibold text-[14px] transition-all duration-300',
          !isOpen && 'opacity-0 w-0 hidden',
          isActive ? 'text-slate-900 shadow-sm' : 'text-slate-700 group-hover:text-slate-900'
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}

export default Sidebar;
