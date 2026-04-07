import { ChevronLeft, Filter, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

/**
 * Reusable Mobile Page Header (sticky toolbar)
 *
 * @param {string}   searchTerm          - Current search value
 * @param {Function} setSearchTerm       - Setter for search value
 * @param {string}   searchPlaceholder   - Placeholder text (default: "Tìm kiếm...")
 * @param {Function} onFilterClick       - Callback when filter button is tapped
 * @param {boolean}  hasActiveFilters    - Whether any filter is active
 * @param {number}   totalActiveFilters  - Badge count for active filters
 * @param {Function} onBack             - Override back navigation (default: navigate(-1))
 * @param {React.ReactNode} actions      - Extra action buttons rendered after filter button
 * @param {React.ReactNode} selectionBar - Selection indicator content (shown below header when items selected)
 * @param {boolean}  sticky             - Whether header is sticky (default: true)
 * @param {string}   className          - Additional wrapper class
 */
function MobilePageHeader({
  searchTerm = '',
  setSearchTerm,
  searchPlaceholder = 'Tìm kiếm...',
  onFilterClick,
  hasActiveFilters = false,
  totalActiveFilters = 0,
  onBack,
  actions,
  selectionBar,
  summary,
  sticky = true,
  className,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <div
      className={clsx(
        'md:hidden flex flex-col p-3 border-b border-border glass-header z-30 rounded-t-2xl',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {/* Back Button */}
        <button
          onClick={handleBack}
          className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0 active:scale-95 transition-all shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={15}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all font-medium placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Button */}
        {onFilterClick && (
          <button
            onClick={onFilterClick}
            className={clsx(
              'relative p-2 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm',
              hasActiveFilters
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-slate-200 bg-white text-slate-600'
            )}
          >
            <Filter size={18} />
            {hasActiveFilters && totalActiveFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-white">
                {totalActiveFilters}
              </span>
            )}
          </button>
        )}

        {/* Extra Action Buttons */}
        {actions}
      </div>

      {/* Summary Area (optional) */}
      {summary && (
        <div className="mt-2.5 px-0.5">
          {summary}
        </div>
      )}

      {/* Selection Indicator (optional) */}
      {selectionBar}
    </div>
  );
}

export default MobilePageHeader;
