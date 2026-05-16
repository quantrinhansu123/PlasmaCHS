import React from 'react';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModuleIconBox } from './ModuleIconBox';
import {
  flatIconBoxClass,
  flatIconColorMap,
  mobileModuleCardClass,
  desktopModuleCardClass,
} from './moduleIconStyles';

export const ActionCard = ({
  icon: Icon,
  title,
  description,
  href,
  colorScheme,
  cardLayout = 'default',
}) => {
  const isHome = cardLayout === 'home';

  return (
    <Link
      to={href}
      className={clsx(
        'group transition-all duration-200',
        isHome && mobileModuleCardClass,
        isHome && desktopModuleCardClass,
        !isHome &&
          'flex items-center gap-4 lg:gap-5 bg-[#e8e8e8] rounded-[28px] p-5 lg:p-6 min-h-[120px] border border-black/10 hover:border-black/20 hover:-translate-y-0.5'
      )}
    >
      {isHome ? (
        <>
          <span className="lg:hidden">
            <ModuleIconBox icon={Icon} colorScheme={colorScheme} size="card" />
          </span>
          <span className="hidden lg:block">
            <ModuleIconBox icon={Icon} colorScheme={colorScheme} size="lg" />
          </span>

          <div className="mt-2.5 flex-1 flex flex-col min-w-0 pr-8">
            <h3 className="font-bold text-[13px] leading-snug text-slate-900 line-clamp-2 lg:mt-0 lg:pr-0 lg:font-extrabold lg:text-[34px] xl:text-[40px] lg:text-[#1a1a1a] lg:leading-tight lg:line-clamp-none">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-[11px] leading-[1.45] text-slate-500 line-clamp-2 lg:hidden">
                {description}
              </p>
            ) : null}
          </div>

          <span
            className="absolute bottom-3 right-3 lg:hidden flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-400 shadow-sm group-hover:border-blue-200 group-hover:text-blue-500 transition-colors"
            aria-hidden
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </span>
        </>
      ) : (
        <>
          <div className={clsx(flatIconBoxClass, flatIconColorMap[colorScheme] || flatIconColorMap.blue)}>
            <Icon size={30} strokeWidth={1.8} />
          </div>
          <h3 className="font-extrabold text-[34px] lg:text-[40px] text-[#1a1a1a] leading-tight">
            {title}
          </h3>
        </>
      )}
    </Link>
  );
};

