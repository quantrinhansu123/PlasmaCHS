import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

const normalizeSearch = (text) =>
    String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));

/**
 * Danh sách checkbox có ô tìm kiếm — chọn nhiều giá trị.
 */
export default function CheckboxSearchList({
    options = [],
    selected = [],
    onChange,
    placeholder = 'Tìm kiếm...',
    emptyMessage = 'Không có dữ liệu gợi ý.',
    allowCustom = true,
    customAddLabel,
    className,
    maxHeightClass = 'max-h-48',
}) {
    const [search, setSearch] = useState('');

    const allOptions = useMemo(() => {
        const merged = new Set([...(options || []), ...(selected || [])]);
        return [...merged].sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
    }, [options, selected]);

    const filteredOptions = useMemo(() => {
        const q = normalizeSearch(search);
        if (!q) return allOptions;
        return allOptions.filter((opt) => normalizeSearch(opt).includes(q));
    }, [allOptions, search]);

    const trimmedSearch = search.trim();
    const canAddCustom =
        allowCustom &&
        trimmedSearch.length > 0 &&
        !allOptions.some((opt) => normalizeSearch(opt) === normalizeSearch(trimmedSearch));

    const toggle = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const toggleAll = () => {
        if (selected.length === allOptions.length && allOptions.length > 0) {
            onChange([]);
        } else {
            onChange([...allOptions]);
        }
    };

    const addCustom = () => {
        if (!trimmedSearch || selected.includes(trimmedSearch)) return;
        onChange([...selected, trimmedSearch]);
        setSearch('');
    };

    return (
        <div
            className={clsx(
                'rounded-2xl border border-slate-200 bg-slate-50/80 overflow-hidden',
                className
            )}
        >
            <div className="p-2.5 border-b border-slate-200 bg-white">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={14}
                    />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                    />
                </div>
            </div>

            {allOptions.length > 0 ? (
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white/80">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4"
                            checked={
                                allOptions.length > 0 && selected.length === allOptions.length
                            }
                            onChange={toggleAll}
                        />
                        <span className="text-[12px] font-bold text-slate-600">Chọn tất cả</span>
                    </label>
                    {selected.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="text-[11px] font-bold text-primary hover:text-primary/80"
                        >
                            Bỏ chọn ({selected.length})
                        </button>
                    ) : null}
                </div>
            ) : null}

            <div className={clsx('overflow-y-auto p-2 space-y-0.5 custom-scrollbar', maxHeightClass)}>
                {canAddCustom ? (
                    <button
                        type="button"
                        onClick={addCustom}
                        className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-bold text-primary bg-primary/5 border border-primary/15 hover:bg-primary/10 mb-1"
                    >
                        {customAddLabel
                            ? customAddLabel(trimmedSearch)
                            : `+ Thêm "${trimmedSearch}"`}
                    </button>
                ) : null}

                {filteredOptions.length > 0 ? (
                    filteredOptions.map((opt) => (
                        <label
                            key={opt}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 text-primary focus:ring-primary/20 w-4 h-4 shrink-0"
                                checked={selected.includes(opt)}
                                onChange={() => toggle(opt)}
                            />
                            <span className="text-[13px] font-medium text-slate-800 leading-snug">
                                {opt}
                            </span>
                        </label>
                    ))
                ) : (
                    <p className="px-3 py-6 text-center text-[12px] text-slate-400 font-medium italic">
                        {search ? 'Không khớp từ khóa tìm kiếm' : emptyMessage}
                    </p>
                )}
            </div>

            {selected.length > 0 ? (
                <div className="px-3 py-2 border-t border-slate-200 bg-white text-[11px] font-semibold text-slate-500">
                    Đã chọn: {selected.join(', ')}
                </div>
            ) : null}
        </div>
    );
}
