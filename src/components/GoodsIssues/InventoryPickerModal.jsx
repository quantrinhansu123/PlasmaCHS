import { clsx } from 'clsx';
import { Search, X, Package, Check, Hash, LayoutGrid } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export default function InventoryPickerModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    items, 
    isLoading, 
    type // 'BINH' or 'MAY'
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const s = searchTerm.toLowerCase();
        return items.filter(item => 
            item.serial_number?.toLowerCase().includes(s) || 
            (type === 'MAY' ? item.machine_type : item.volume)?.toLowerCase().includes(s)
        );
    }, [items, searchTerm, type]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(i => i.id));
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100010] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-[18px] font-black text-slate-900 tracking-tight">
                                Chọn từ tồn kho ({type === 'MAY' ? 'Máy' : 'Vỏ bình'})
                            </h3>
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                                {isLoading ? 'Đang tải dữ liệu...' : `Tìm thấy ${items.length} tài sản`}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text"
                            placeholder="Tìm theo Serial, RFID, loại sản phẩm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-2xl text-[14px] font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/40 transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={toggleSelectAll}
                            className="text-[12px] font-bold text-emerald-600 hover:text-emerald-700 transition-all flex items-center gap-1.5"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            {selectedIds.length === filteredItems.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả kết quả'}
                        </button>
                        <span className="text-[12px] font-bold text-slate-400 px-2 py-1 bg-slate-100 rounded-lg">
                            Đã chọn: {selectedIds.length}
                        </span>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
                    {isLoading ? (
                        <div className="py-20 text-center">
                            <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-[14px] font-bold text-slate-400">Đang tải danh sách tồn kho...</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl mx-4">
                            <Hash className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-[14px] font-bold text-slate-400">Không tìm thấy sản phẩm nào trong kho</p>
                            <p className="text-[12px] font-medium text-slate-300 mt-1">Vui lòng kiểm tra lại bộ lọc hoặc kho đã chọn</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {filteredItems.map((item) => (
                                <div 
                                    key={item.id}
                                    onClick={() => toggleSelect(item.id)}
                                    className={clsx(
                                        "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                                        selectedIds.includes(item.id) 
                                            ? "bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100/50" 
                                            : "bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                                            selectedIds.includes(item.id)
                                                ? "bg-emerald-500 border-emerald-500 text-white"
                                                : "bg-white border-slate-200 group-hover:border-emerald-300"
                                        )}>
                                            {selectedIds.includes(item.id) && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-black text-slate-800 tracking-tight font-mono">
                                                {item.serial_number}
                                            </div>
                                            <div className="text-[12px] font-bold text-slate-500 mt-0.5">
                                                {type === 'MAY' ? item.machine_type : item.volume}
                                                <span className="mx-2 text-slate-300">|</span>
                                                <span className={clsx(
                                                    "px-1.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider",
                                                    item.status === 'sẵn sàng' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Cập nhật</div>
                                        <div className="text-[12px] font-bold text-slate-600">
                                            {new Date(item.updated_at || item.created_at).toLocaleDateString('vi-VN')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-2xl text-[14px] font-bold text-slate-500 hover:bg-slate-50 transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={() => onConfirm(selectedIds)}
                        disabled={selectedIds.length === 0}
                        className={clsx(
                            "px-8 py-2.5 rounded-2xl text-[14px] font-extrabold shadow-lg transition-all active:scale-95",
                            selectedIds.length === 0 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                        )}
                    >
                        Xác nhận chọn ({selectedIds.length})
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
