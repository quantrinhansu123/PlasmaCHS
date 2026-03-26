import React, { useState, useMemo } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "../../lib/utils"

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-[100020] w-[var(--radix-popover-trigger-width)] rounded-2xl border border-slate-200 bg-white p-1 text-slate-950 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export function SearchableSelect({
  options = [],
  value = "",
  onValueChange,
  placeholder = "Chọn...",
  searchPlaceholder = "Tìm tên khách hàng...",
  emptyMessage = "Không có kết quả.",
  className,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const selectedOption = useMemo(() => 
    options.find((option) => option.value === value),
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-left flex items-center justify-between transition-all",
            disabled ? "text-slate-500 cursor-not-allowed" : "text-slate-800 hover:border-primary/40 hover:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10",
            open && "ring-4 ring-primary/10 border-primary/40 bg-white",
            !selectedOption && "text-slate-400 font-normal",
            className
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className={cn(
            "w-4 h-4 text-primary/70 transition-transform duration-300 ml-2 shrink-0",
            open && "rotate-180"
          )} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 overflow-hidden bg-white border border-slate-200">
        <div className="flex items-center border-b border-slate-100 px-3 py-2 bg-slate-50/50">
          <Search size={14} className="text-slate-400 mr-2 shrink-0" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-[13px] font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-normal w-full"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-bold transition-colors mb-0.5 last:mb-0 text-left",
                  value === option.value 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-primary"
                )}
                onClick={() => {
                  onValueChange(option.value)
                  setOpen(false)
                  setSearchTerm("")
                }}
              >
                <span className="truncate flex-1">{option.label}</span>
                {value === option.value && <Check size={14} strokeWidth={3} className="ml-2 shrink-0" />}
              </button>
            ))
          ) : (
            <div className="py-6 text-center text-[12px] text-slate-400 font-bold italic">
              {emptyMessage}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
