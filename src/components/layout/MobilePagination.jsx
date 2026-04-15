import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Reusable Mobile Pagination Bar (sticky bottom)
 *
 * @param {number}   currentPage    - Active page number (1-indexed)
 * @param {Function} setCurrentPage - Page setter
 * @param {number}   pageSize       - Items per page
 * @param {Function} setPageSize    - Page size setter
 * @param {number}   totalRecords   - Total number of records
 * @param {number[]} pageSizeOptions - Available page sizes (default: [10, 20, 50, 100])
 * @param {boolean}  scrollToTop    - Whether to scroll to top on page change (default: true)
 * @param {string}   className      - Additional wrapper class
 */
function MobilePagination({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalRecords,
  pageSizeOptions = [10, 20, 50, 100],
  scrollToTop = true,
  className,
}) {
  const totalPages = Math.ceil(totalRecords / pageSize);

  const goToPage = (page) => {
    setCurrentPage(page);
    if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (totalRecords <= 0) return null;

  return (
    <div
      className={clsx(
        'md:hidden sticky bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200 px-3 py-1 animate-in fade-in duration-300 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] shrink-0',
        className
      )}
    >
      <div className="flex items-center justify-between">
        {/* Left: Range / Total */}
        <div className="flex items-center shrink-0">
          <div className="flex items-center text-[11px] whitespace-nowrap overflow-hidden">
            <span className="text-slate-800 font-bold">
              {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, totalRecords)}
            </span>
            <span className="mx-0.5 text-slate-300">/</span>
            <span className="text-slate-400 text-[9px]">T:</span>
            <span className="ml-0.5 text-slate-800 font-bold">{totalRecords}</span>
          </div>

          {/* Vertical Separator */}
          <div className="w-[1px] h-3 bg-slate-200 mx-1.5" />

          {/* Page Size Selector */}
          <div className="relative shrink-0">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="appearance-none bg-white border border-slate-300 rounded-md pl-1 pr-4 py-0 text-[10px] font-bold text-slate-700 focus:outline-none transition-all cursor-pointer h-6"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 leading-none h-2 flex items-center justify-center">
              <ChevronDown size={8} />
            </div>
          </div>
        </div>

        {/* Right: Navigation Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="btn-compact w-6 h-6 p-0 flex items-center justify-center rounded-md border border-slate-300 text-slate-400 disabled:opacity-20 active:bg-slate-50 transition-all font-bold text-[9px] leading-none"
          >
            «
          </button>

          <button
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn-compact w-6 h-6 p-0 flex items-center justify-center rounded-md border border-slate-300 text-slate-400 disabled:opacity-20 active:bg-slate-50 transition-all font-bold text-[9px] leading-none"
          >
            ‹
          </button>

          <div className="flex items-center gap-0.5 mx-0.5 whitespace-nowrap">
            <div className="w-6 h-6 p-0 flex items-center justify-center rounded-md bg-primary text-white font-bold text-[11px] leading-none">
              {currentPage}
            </div>
            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap leading-none">
              / {totalPages}
            </span>
          </div>

          <button
            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="btn-compact w-6 h-6 p-0 flex items-center justify-center rounded-md border border-slate-300 text-slate-400 disabled:opacity-20 active:bg-slate-50 transition-all font-bold text-[9px] leading-none"
          >
            ›
          </button>

          <button
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="btn-compact w-6 h-6 p-0 flex items-center justify-center rounded-md border border-slate-300 text-slate-400 disabled:opacity-20 active:bg-slate-50 transition-all font-bold text-[9px] leading-none"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobilePagination;
