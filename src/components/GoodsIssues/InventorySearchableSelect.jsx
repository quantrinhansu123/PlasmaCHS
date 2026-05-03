import React, { useState, useMemo } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Search, ChevronDown, Check, Package, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
    <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
                "z-[100020] min-w-[320px] max-w-[450px] max-h-[85vh] overflow-hidden rounded-3xl border border-slate-200 bg-white/98 backdrop-blur-2xl p-1.5 text-slate-950 shadow-[0_20px_50px_rgba(0,0,0,0.15)] outline-none animate-in fade-in-0 zoom-in-95 duration-200",
                className
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/**
 * A Premium Searchable Dropdown for Inventory Items with Grouping by Asset Type
 */
const InventorySearchableSelect = ({ 
    items = [], 
    value = "", 
    onSelect, 
    placeholder = "Chọn mã Serial/RFID...",
    isMachine = false,
    isEmpty = false,
    isLoading = false,
    excludedSerials = []
}) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Group items by asset type (volume or machine_type)
    const groupedItems = useMemo(() => {
        const blocked = new Set(excludedSerials.filter(Boolean));
        blocked.delete(value);

        const st = searchTerm.toLowerCase();
        const filtered = items.filter((item) => {
            const serialStr = item.serial_number != null ? String(item.serial_number) : '';
            const matchesSearch = serialStr.toLowerCase().includes(st);
            return matchesSearch && !blocked.has(serialStr);
        });

        return filtered.reduce((acc, item) => {
            const key = isMachine ? (item.machine_type || "Khác") : (item.volume || "Khác");
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});
    }, [items, searchTerm, isMachine, excludedSerials, value]);

    const selectedItem = useMemo(
        () => items.find((i) => String(i.serial_number ?? '') === String(value ?? '')),
        [items, value]
    );

    const handleSelect = (serial) => {
        onSelect(serial);
        setOpen(false);
        setSearchTerm("");
    };

    const sortedGroups = Object.keys(groupedItems).sort();

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-black tracking-tight transition-all hover:border-primary/40 hover:bg-slate-50/50 outline-none",
                        open && "border-primary ring-4 ring-primary/10 bg-white shadow-sm",
                        !value && "text-slate-400 font-bold",
                        value && "text-slate-900 border-primary/20 bg-primary/5 shadow-inner"
                    )}
                >
                    <span className="truncate flex items-center gap-2">
                        {value ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                {value}
                            </>
                        ) : placeholder}
                    </span>
                    <ChevronDown 
                        size={16} 
                        className={cn(
                            "text-slate-400 transition-transform duration-300",
                            open && "rotate-180 text-primary"
                        )} 
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent className="p-0 border-none">
                <div className="flex items-center border-b border-slate-100 px-3 py-2 bg-slate-50/50">
                    <Search size={14} className="text-slate-400 mr-2" />
                    <input
                        className="flex-1 bg-transparent border-none outline-none text-[13px] font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Tìm theo Serial..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {isLoading ? (
                        <div className="py-12 text-center">
                            <div className="w-8 h-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">Đang đồng bộ tồn kho...</p>
                        </div>
                    ) : isEmpty || items.length === 0 ? (
                        <div className="py-12 px-6 text-center border-2 border-dashed border-slate-50 rounded-3xl mx-2">
                            <Package size={32} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-[13px] text-slate-500 font-bold leading-relaxed">Kho này hiện không có tài sản khả dụng để xuất trả.</p>
                        </div>
                    ) : sortedGroups.length > 0 ? (
                        sortedGroups.map(group => (
                            <div key={group} className="mb-4 last:mb-1">
                                <div className="px-4 py-2 flex items-center gap-3">
                                    <span className="text-[11px] font-black text-primary/60 uppercase tracking-[0.15em] whitespace-nowrap">{group}</span>
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-100 to-transparent" />
                                </div>
                                <div className="space-y-1 px-1">
                                    {groupedItems[group].map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleSelect(item.serial_number)}
                                            className={cn(
                                                "w-full flex items-center justify-between gap-4 px-4 py-3 rounded-2xl text-[14px] font-bold transition-all group relative overflow-hidden",
                                                value === item.serial_number 
                                                    ? "bg-primary text-white shadow-xl shadow-primary/25 ring-1 ring-white/20" 
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-primary hover:translate-x-1"
                                            )}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                                                    value === item.serial_number 
                                                        ? "bg-white/20 text-white" 
                                                        : "bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary"
                                                )}>
                                                    <Package size={16} />
                                                </div>
                                                <div className="flex min-w-0 flex-col items-start translate-y-[1px]">
                                                    <span className="w-full truncate font-mono tracking-tight leading-none">{item.serial_number}</span>
                                                    <span className={cn(
                                                        "mt-1 w-full truncate text-[10px] font-bold",
                                                        value === item.serial_number ? "text-white/60" : "text-slate-400"
                                                    )}>
                                                        {isMachine ? item.machine_type : item.volume}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center justify-end gap-3">
                                                <span className={cn(
                                                    "text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tight shadow-sm",
                                                    value === item.serial_number 
                                                        ? "bg-white/20 text-white" 
                                                        : item.status === 'hỏng' ? "bg-rose-50 text-rose-500 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                                )}>
                                                    {item.status}
                                                </span>
                                                {value === item.serial_number && <Check size={16} strokeWidth={3} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-10 text-center text-[13px] text-slate-400 font-bold italic">
                            Không tìm thấy kết quả nào.
                        </div>
                    )}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                        <Info size={10} strokeWidth={3} />
                        <span>Hiển thị tài sản theo kho đã chọn</span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default InventorySearchableSelect;
