import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import * as PopoverPrimitive from "@radix-ui/react-popover";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[100010] w-full min-w-[var(--radix-popover-trigger-width)] rounded-xl border border-slate-200 bg-white p-1 text-slate-950 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/**
 * Combobox component that allows both selecting from a list and entering custom text.
 */
export function Combobox({ 
    options = [], 
    value = "", 
    onChange, 
    placeholder = "Chọn hoặc nhập...", 
    emptyMessage = "Không tìm thấy kết quả.",
    className,
    disabled = false
}) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const inputRef = useRef(null);

    // Sync search term with value when value changes externally
    useEffect(() => {
        setSearchTerm(value);
    }, [value]);

    // Simple filtering logic
    const filteredOptions = (options || []).filter(option => 
        (option || "").toLowerCase().includes((searchTerm || "").toLowerCase())
    ).slice(0, 50);

    const handleInputChange = (e) => {
        const newVal = e.target.value;
        setSearchTerm(newVal);
        onChange(newVal);
        if (!open) setOpen(true);
    };

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setSearchTerm(optionValue);
        setOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange("");
        setSearchTerm("");
        inputRef.current?.focus();
        setOpen(true);
    };

    const toggleOpen = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(prev => !prev);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div 
                    className="relative w-full"
                    onClick={() => { if (!disabled) setOpen(true); }}
                >
                    <input
                        ref={inputRef}
                        disabled={disabled}
                        value={searchTerm}
                        onChange={handleInputChange}
                        autoComplete="off"
                        placeholder={placeholder}
                        className={cn(
                            "w-full h-11 px-4 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-bold outline-none transition-all pr-16",
                            "focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white focus:border-primary",
                            open && "ring-4 ring-primary/10 border-primary bg-white shadow-sm",
                            disabled && "bg-slate-50 text-slate-500 cursor-not-allowed",
                            className
                        )}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        {searchTerm && !disabled && (
                            <button 
                                type="button" 
                                onClick={handleClear}
                                className="p-2 text-slate-400 hover:text-rose-500 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={toggleOpen}
                            disabled={disabled}
                            className={cn(
                                "p-2 text-slate-400 hover:text-primary rounded-full transition-all",
                                open && "text-primary"
                            )}
                        >
                            <ChevronDown className={cn(
                                "w-4 h-4 transition-transform duration-300",
                                open && "rotate-180"
                            )} />
                        </button>
                    </div>
                </div>
            </PopoverTrigger>

            <PopoverContent 
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => {
                    // Don't close if clicking the input or clear button
                    if (e.target && inputRef.current?.contains(e.target)) {
                        e.preventDefault();
                    }
                }}
                className="z-[100020] p-1 w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto custom-scrollbar shadow-2xl border border-slate-200 bg-white"
                align="start"
                sideOffset={6}
            >
                <div className="p-1">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onPointerDown={(e) => e.preventDefault()} // Prevents focus theft
                                onClick={() => handleSelect(option)}
                                className={cn(
                                    "w-full text-left px-3 py-2 rounded-lg text-[13px] font-bold transition-colors",
                                    value === option 
                                        ? "bg-primary/10 text-primary" 
                                        : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                                )}
                            >
                                {option}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-4 text-center text-xs text-slate-400 font-semibold italic">
                            {(!options || options.length === 0) 
                             ? "Không có dữ liệu gợi ý." 
                             : (searchTerm ? emptyMessage : "Hãy gõ để tìm kiếm...")
                            }
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default Combobox;
