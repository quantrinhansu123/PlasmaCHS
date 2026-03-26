import React from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

const FilterDropdown = ({
  options,
  selected,
  setSelected,
  filterSearch,
  setFilterSearch,
  singleSelect = false,
}) => {
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
  };

  const filteredOptions = options.filter(opt => {
    const search = filterSearch || '';
    const label = opt.label || '';
    const normalizedLabel = normalizeText(label);
    const normalizedSearch = normalizeText(search);
    return label.toLowerCase().includes(search.toLowerCase()) || 
           normalizedLabel.includes(normalizedSearch);
  });

  const toggleOption = (id) => {
    if (singleSelect) {
      setSelected([id]);
      return;
    }
    if (selected.includes(id)) {
      setSelected(selected.filter(item => item !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      setSelected([]);
    } else {
      setSelected(options.map(opt => opt.id));
    }
  };

  return (
    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-border z-[99999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={14} />
          <input
            autoFocus
            type="text"
            placeholder="Tìm kiếm..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-muted/20 border border-primary/20 rounded-xl text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
          />
        </div>
      </div>

      {!singleSelect && (
        <div className="p-1 px-2 border-b border-border/60 bg-muted/5">
          <div className="flex items-center justify-between p-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                checked={selected.length === options.length && options.length > 0}
                onChange={toggleAll}
              />
              <span className="text-[13px] font-bold text-muted-foreground">Chọn tất cả</span>
            </label>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-[12px] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Xóa chọn
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto p-1 py-2">
        {filteredOptions.length > 0 ? (
          filteredOptions.map(opt => (
            <label
              key={opt.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <input
                  type={singleSelect ? "radio" : "checkbox"}
                  className={clsx(
                    "border-border text-primary focus:ring-primary/20 w-4 h-4",
                    singleSelect ? "rounded-full" : "rounded"
                  )}
                  checked={selected.includes(opt.id)}
                  onChange={() => toggleOption(opt.id)}
                />
                <span className="text-[13px] font-medium text-foreground tracking-tight">{opt.label}</span>
              </div>
              <span className="text-[12px] font-bold text-primary/40 group-hover:text-primary transition-colors">{opt.count}</span>
            </label>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            Không tìm thấy kết quả
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterDropdown;
