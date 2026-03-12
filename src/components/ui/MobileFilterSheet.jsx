import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Filter, Search, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const defaultFilterMatcher = (option, searchValue) =>
  option.label.toLowerCase().includes(searchValue.toLowerCase());

const MobileFilterSheet = ({
  isOpen,
  isClosing = false,
  onClose,
  onApply,
  sections = [],
  title = 'Bộ lọc',
  applyLabel = 'Áp dụng',
  clearAllLabel = 'Xóa tất cả bộ lọc',
  selectAllLabel = 'Chọn tất cả',
  clearSelectionLabel = 'Xóa chọn',
  emptyMessage = 'Không tìm thấy kết quả',
  hasActiveFilters,
  totalActiveFilters,
  showDesktop = false,
}) => {
  const [mobileFilterSearch, setMobileFilterSearch] = useState('');
  const [mobileExpandedSection, setMobileExpandedSection] = useState(null);
  const [mobileClosingSection, setMobileClosingSection] = useState(null);
  const sectionCloseTimerRef = useRef(null);

  const normalizedSections = useMemo(
    () =>
      sections.map((section) => ({
        options: [],
        selectedValues: [],
        onSelectionChange: () => {},
        getOptionCount: (option) => option.count,
        filterOption: defaultFilterMatcher,
        searchPlaceholder: `Tìm ${section.label?.toLowerCase() || 'mục'}...`,
        ...section,
      })),
    [sections]
  );

  const derivedTotalActiveFilters = normalizedSections.reduce(
    (total, section) => total + section.selectedValues.length,
    0
  );
  const resolvedTotalActiveFilters = totalActiveFilters ?? derivedTotalActiveFilters;
  const resolvedHasActiveFilters = hasActiveFilters ?? resolvedTotalActiveFilters > 0;

  useEffect(() => {
    return () => {
      if (sectionCloseTimerRef.current) {
        clearTimeout(sectionCloseTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleToggleAll = (section) => {
    section.onSelectionChange(
      section.selectedValues.length === section.options.length
        ? []
        : section.options.map((option) => option.id)
    );
  };

  const handleToggleOption = (section, optionId) => {
    section.onSelectionChange((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const clearAllSections = () => {
    normalizedSections.forEach((section) => section.onSelectionChange([]));
  };

  return createPortal(
    <div className={clsx('fixed inset-0 z-9999 flex flex-col justify-end', !showDesktop && 'md:hidden')}>
      <div
        className={clsx('absolute inset-0 bg-black/25 transition-opacity duration-300', isClosing ? 'opacity-0' : 'opacity-100')}
        onClick={onClose}
      />
      <div className={clsx('relative bg-white rounded-t-[24px] flex flex-col max-h-[80vh] shadow-2xl will-change-transform', isClosing ? 'animate-out fade-out slide-out-to-bottom-12 [animation-duration:240ms]' : 'animate-in fade-in slide-in-from-bottom-12 [animation-duration:300ms]')}>
        <div className="flex justify-center pt-1 pb-0.5">
          <div className="w-11 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <Filter size={16} className="text-primary" />
            <span className="text-[16px] font-bold text-foreground">{title}</span>
            {resolvedHasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                {resolvedTotalActiveFilters}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {normalizedSections.map((section) => {
            const isExpanded = mobileExpandedSection === section.id;
            const filteredOptions = section.options.filter((option) =>
              mobileFilterSearch === '' || !isExpanded
                ? true
                : section.filterOption(option, mobileFilterSearch)
            );

            const isClosingExpanded = mobileClosingSection === section.id;
            const showExpanded = isExpanded || isClosingExpanded;

            return (
              <div key={section.id} className="border-b border-border/70">
                <button
                  onClick={() => {
                    if (isExpanded) {
                      setMobileClosingSection(section.id);
                      if (sectionCloseTimerRef.current) clearTimeout(sectionCloseTimerRef.current);
                      sectionCloseTimerRef.current = setTimeout(() => {
                        setMobileExpandedSection((prev) => (prev === section.id ? null : prev));
                        setMobileClosingSection((prev) => (prev === section.id ? null : prev));
                      }, 200);
                    } else {
                      if (sectionCloseTimerRef.current) clearTimeout(sectionCloseTimerRef.current);
                      setMobileClosingSection(null);
                      setMobileExpandedSection(section.id);
                    }
                    setMobileFilterSearch('');
                  }}
                  className="w-full relative flex !justify-start items-center py-4 px-0 text-left"
                >
                  <div className="flex items-center gap-2.5 text-foreground pr-8">
                    {section.icon && <span className="text-muted-foreground/90">{section.icon}</span>}
                    <span className="text-[15px] font-semibold">{section.label}</span>
                    {section.selectedValues.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                        {section.selectedValues.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={16} className={clsx('absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-transform', isExpanded ? 'rotate-90' : '')} />
                </button>

                {showExpanded && (
                  <div className={clsx('px-4 pb-4', isExpanded ? 'animate-in slide-in-from-top-4 fade-in [animation-duration:220ms]' : 'animate-out slide-out-to-top-4 fade-out [animation-duration:180ms]')}>
                    {section.searchable !== false && (
                      <div className="relative mb-2.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={13} />
                        <input
                          type="text"
                          placeholder={section.searchPlaceholder}
                          value={mobileFilterSearch}
                          onChange={(e) => setMobileFilterSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted/20 border border-border/60 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 font-medium"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2 px-1">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                          checked={section.selectedValues.length === section.options.length && section.options.length > 0}
                          onChange={() => handleToggleAll(section)}
                        />
                        <span className="text-[13px] font-bold text-muted-foreground">{section.selectAllLabel || selectAllLabel}</span>
                      </label>
                      {section.selectedValues.length > 0 && (
                        <button onClick={() => section.onSelectionChange([])} className="text-[12px] font-bold text-primary">
                          {section.clearSelectionLabel || clearSelectionLabel}
                        </button>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <label key={option.id} className="flex items-center justify-between px-1 py-2.5 rounded-md hover:bg-muted/20 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                                checked={section.selectedValues.includes(option.id)}
                                onChange={() => handleToggleOption(section, option.id)}
                              />
                              <span className="text-[14px] font-medium text-foreground">{option.label}</span>
                            </div>
                            {section.showCounts !== false && section.getOptionCount(option) != null && (
                              <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
                                {section.getOptionCount(option)}
                              </span>
                            )}
                          </label>
                        ))
                      ) : (
                        <div className="px-1 py-5 text-center text-[12px] text-muted-foreground">
                          {section.emptyMessage || emptyMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3.5 border-t border-border bg-white">
          {resolvedTotalActiveFilters > 0 && (
            <button
              onClick={clearAllSections}
              className="w-full mb-2 py-2.5 rounded-full border border-dashed border-red-300 text-red-500 text-[14px] font-bold hover:bg-red-50 transition-all"
            >
              {clearAllLabel}
            </button>
          )}
          <button
            onClick={onApply}
            className="w-full py-3.5 rounded-full bg-primary text-white text-[15px] font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MobileFilterSheet;
