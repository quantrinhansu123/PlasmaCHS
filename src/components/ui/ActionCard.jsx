import React from 'react';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModuleIconBox } from './ModuleIconBox';
import { homeModuleCardClass } from './moduleIconStyles';

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
        isHome && homeModuleCardClass,
        !isHome &&
          'flex items-center gap-4 lg:gap-5 bg-[#e8e8e8] rounded-[28px] p-5 lg:p-6 min-h-[120px] border border-black/10 hover:border-black/20 hover:-translate-y-0.5'
      )}
    >
      {isHome ? (
        <>
          <ModuleIconBox icon={Icon} iconKey={href} colorScheme={colorScheme} size="card" variant="solid" />

          <div className="flex-1 min-w-0 pr-8">
            <h3 className="font-bold text-[13px] lg:text-[14px] leading-snug text-slate-900 line-clamp-2">
              {title}
            </h3>
          </div>

          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-400 shadow-sm group-hover:border-blue-200 group-hover:text-blue-500 transition-colors shrink-0"
            aria-hidden
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </span>
        </>
      ) : (
        <>
          <ModuleIconBox icon={Icon} iconKey={href} colorScheme={colorScheme} size="lg" variant="solid" />
          <h3 className="font-extrabold text-[34px] lg:text-[40px] text-[#1a1a1a] leading-tight flex-1">
            {title}
          </h3>
        </>
      )}
    </Link>
  );
};
