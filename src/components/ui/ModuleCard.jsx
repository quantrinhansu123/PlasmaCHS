import React from 'react';
import { clsx } from 'clsx';
import { ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ModuleIconBox } from './ModuleIconBox';
import { homeModuleCardClass } from './moduleIconStyles';

export function ModuleCard({
  icon: Icon,
  title,
  description,
  colorScheme,
  path,
  isBookmarked = false,
  onToggleBookmark,
  cardLayout = 'default',
}) {
  const navigate = useNavigate();
  const isHome = cardLayout === 'home';

  const handleClick = () => {
    if (path) {
      navigate(path);
    }
  };

  const bookmarkButtons = (className = '') => (
    <div
      className={clsx('hidden md:flex shrink-0 text-muted-foreground/30', className)}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onToggleBookmark?.(path)}
        className={clsx(
          'transition-colors',
          isBookmarked ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-amber-500'
        )}
        title={isBookmarked ? 'Bỏ đánh dấu' : 'Đánh dấu'}
        disabled={!path}
      >
        <Star size={15} className={clsx(isBookmarked && 'fill-current')} />
      </button>
    </div>
  );

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'group transition-all duration-200 cursor-pointer',
        isHome && homeModuleCardClass,
        !isHome &&
          'flex items-center gap-4 bg-[#e8e8e8] rounded-[28px] p-5 lg:p-6 min-h-[120px] border border-black/10 hover:border-black/20 hover:-translate-y-0.5',
        !path && 'opacity-60 grayscale-[0.5] cursor-not-allowed hover:translate-y-0 hover:border-border lg:grayscale-[0.5]'
      )}
    >
      {isHome ? (
        <>
          <ModuleIconBox icon={Icon} iconKey={path} colorScheme={colorScheme} size="card" variant="solid" />

          <div className="flex-1 min-w-0 pr-8">
            <h3 className="font-bold text-[13px] lg:text-[14px] leading-snug text-slate-900 line-clamp-2">
              {title}
            </h3>
          </div>

          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-400 shadow-sm shrink-0"
            aria-hidden
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </span>

          {bookmarkButtons('absolute top-2 right-10')}
        </>
      ) : (
        <>
          <ModuleIconBox icon={Icon} iconKey={path} colorScheme={colorScheme} size="lg" variant="solid" />

          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-extrabold text-[34px] lg:text-[40px] text-[#1a1a1a] leading-tight">
              {title}
            </h3>
          </div>

          {bookmarkButtons()}
        </>
      )}
    </div>
  );
}

export default ModuleCard;

