import React from 'react';
import { Package, Truck, User, Calendar, MapPin, Hash } from 'lucide-react';

const GoodsIssuePrintTemplate = React.forwardRef(({ issue, items = [], warehouseName, supplierName }, ref) => {
    if (!issue) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return '.../.../202...';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    return (
        <div ref={ref} className="p-8 bg-white text-slate-800 font-sans print:p-4 print:text-[12pt]">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 border-b-2 border-slate-800 pb-4">
                <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-2xl">
                        PVN
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">PLASMA VIỆT NAM</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hệ thống quản lý kho vận thông minh</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-black text-slate-900 uppercase">PHIẾU XUẤT TRẢ HÀNG</h2>
                    <div className="flex items-center justify-end gap-2 mt-1 text-[13px] font-bold text-slate-600">
                        <Hash size={14} />
                        <span>Số: {issue.issue_code}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[13px] font-bold text-slate-600">
                        <Calendar size={14} />
                        <span>Ngày: {formatDate(issue.issue_date)}</span>
                    </div>
                </div>
            </div>

            {/* Info Sections */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                        <Truck size={16} className="text-slate-400" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Đơn vị nhận (NCC)</span>
                    </div>
                    <p className="text-[15px] font-black text-slate-800">{supplierName || 'N/A'}</p>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium">
                        <MapPin size={14} />
                        <span>Địa chỉ: ........................................................................</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                        <Package size={16} className="text-slate-400" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Kho xuất hàng</span>
                    </div>
                    <p className="text-[15px] font-black text-slate-800">{warehouseName || 'N/A'}</p>
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium">
                        <User size={14} />
                        <span>Người lập: {issue.created_by || 'Admin'}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="mb-8">
                <table className="w-full border-collapse border-2 border-slate-800">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="border-2 border-slate-800 px-3 py-2 text-[11px] font-black uppercase text-center w-10">STT</th>
                            <th className="border-2 border-slate-800 px-3 py-2 text-[11px] font-black uppercase text-left">Tên hàng hóa / Serial</th>
                            <th className="border-2 border-slate-800 px-3 py-2 text-[11px] font-black uppercase text-center w-24">Loại</th>
                            <th className="border-2 border-slate-800 px-3 py-2 text-[11px] font-black uppercase text-center w-28">Thông số</th>
                            <th className="border-2 border-slate-800 px-3 py-2 text-[11px] font-black uppercase text-center w-20">SL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? (
                            items.map((item, index) => (
                                <tr key={item.id}>
                                    <td className="border-2 border-slate-800 px-3 py-2 text-[13px] text-center font-bold">{index + 1}</td>
                                    <td className="border-2 border-slate-800 px-3 py-2 text-[13px] font-black">{item.item_code}</td>
                                    <td className="border-2 border-slate-800 px-3 py-2 text-[13px] text-center font-bold uppercase">{item.item_type}</td>
                                    <td className="border-2 border-slate-800 px-3 py-2 text-[13px] text-center font-medium">
                                        {item.item_type === 'MÁY' ? 'Máy Plasma' : 'Bình Oxy'}
                                    </td>
                                    <td className="border-2 border-slate-800 px-3 py-2 text-[13px] text-center font-black">1</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="border-2 border-slate-800 px-3 py-8 text-center text-slate-400 italic font-bold">
                                    Không có dữ liệu chi tiết hàng hóa
                                </td>
                            </tr>
                        )}
                        {/* Empty rows for layout if needed */}
                        {[...Array(Math.max(0, 5 - items.length))].map((_, i) => (
                            <tr key={`empty-${i}`} className="h-8">
                                <td className="border-2 border-slate-800 px-3 py-2"></td>
                                <td className="border-2 border-slate-800 px-3 py-2"></td>
                                <td className="border-2 border-slate-800 px-3 py-2"></td>
                                <td className="border-2 border-slate-800 px-3 py-2"></td>
                                <td className="border-2 border-slate-800 px-3 py-2"></td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 font-black">
                            <td colSpan="4" className="border-2 border-slate-800 px-3 py-2 text-right text-[11px] uppercase">Tổng cộng</td>
                            <td className="border-2 border-slate-800 px-3 py-2 text-center text-[13px]">{items.length}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Notes */}
            <div className="mb-12 border-2 border-slate-100 p-4 rounded-xl bg-slate-50/50">
                <p className="text-[11px] font-black text-slate-400 uppercase mb-1 tracking-wider">Ghi chú phiếu xuất:</p>
                <p className="text-[13px] font-bold text-slate-700 italic">{issue.notes || 'Không có ghi chú.'}</p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-4 text-center mt-12">
                <div>
                    <p className="text-[13px] font-black uppercase">Người lập phiếu</p>
                    <p className="text-[10px] text-slate-400 italic mb-16">(Ký, họ tên)</p>
                    <p className="text-[14px] font-black">{issue.created_by || 'Admin'}</p>
                </div>
                <div>
                    <p className="text-[13px] font-black uppercase">Người giao hàng</p>
                    <p className="text-[10px] text-slate-400 italic mb-16">(Ký, họ tên)</p>
                    <div className="w-32 h-px bg-slate-200 mx-auto"></div>
                </div>
                <div>
                    <p className="text-[13px] font-black uppercase">Người nhận hàng</p>
                    <p className="text-[10px] text-slate-400 italic mb-16">(Ký, họ tên)</p>
                    <div className="w-32 h-px bg-slate-200 mx-auto"></div>
                </div>
            </div>

            {/* Footer Text */}
            <div className="mt-20 pt-4 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tighter">
                    Cảm ơn quý khách đã tin tưởng dịch vụ của Plasma Việt Nam
                </p>
            </div>
        </div>
    );
});

export default GoodsIssuePrintTemplate;
