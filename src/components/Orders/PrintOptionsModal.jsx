import React, { useState } from 'react';
import { Printer, X, Copy, FileText, Layout, Info } from 'lucide-react';
import clsx from 'clsx';

export default function PrintOptionsModal({ onClose, onConfirm, title = "Tùy chọn in ấn" }) {
    const [options, setOptions] = useState({
        copies: 2, // Default to 2 copies as per common business practice
        paperSize: 'A5', // A5 is very common for bills
        orientation: 'landscape'
    });

    const handleConfirm = () => {
        onConfirm(options);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100010] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/10">
                            <Printer className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight">{title}</h3>
                            <p className="text-xs text-slate-500 font-medium">Cấu hình bản in trước khi xuất</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Copies */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Copy className="w-4 h-4 text-primary" /> Số bản in cho mỗi phiếu
                        </label>
                        <div className="flex items-center gap-3">
                            {[1, 2, 3].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setOptions(prev => ({ ...prev, copies: num }))}
                                    className={clsx(
                                        "flex-1 py-3 px-4 rounded-2xl border-2 font-bold transition-all text-[15px]",
                                        options.copies === num 
                                            ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10" 
                                            : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                                    )}
                                >
                                    {num} bản
                                </button>
                            ))}
                            <div className="w-20">
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={options.copies}
                                    onChange={(e) => setOptions(prev => ({ ...prev, copies: parseInt(e.target.value) || 1 }))}
                                    className="w-full py-3 px-3 rounded-2xl border-2 border-slate-100 bg-slate-50 text-center font-bold text-slate-700 focus:border-primary/40 focus:bg-white outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Paper Size */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <FileText className="w-4 h-4 text-primary" /> Khổ giấy và định dạng
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOptions(prev => ({ ...prev, paperSize: 'A4', orientation: 'portrait' }))}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                    options.paperSize === 'A4'
                                        ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10"
                                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                                )}
                            >
                                <Layout className="w-6 h-6 rotate-0" />
                                <span className="font-bold text-[14px]">Khổ A4 (Dọc)</span>
                            </button>
                            <button
                                onClick={() => setOptions(prev => ({ ...prev, paperSize: 'A5', orientation: 'landscape' }))}
                                className={clsx(
                                    "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                                    options.paperSize === 'A5'
                                        ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/10"
                                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                                )}
                            >
                                <Layout className="w-6 h-6 rotate-90" />
                                <span className="font-bold text-[14px]">Khổ A5 (Ngang)</span>
                            </button>
                        </div>
                    </div>

                    {/* Helper Info */}
                    <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex gap-3">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-[12px] font-bold text-blue-800 leading-tight">Mẹo tiết kiệm giấy:</p>
                            <p className="text-[11px] text-blue-600 font-medium leading-normal">
                                Chọn **2 bản in** và in **2 mặt (Duplex)** trong cài đặt trình duyệt để in 2 liên trên cùng 1 tờ giấy (trước/sau).
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-[2] py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary/95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        <Printer className="w-5 h-5" />
                        Xác nhận & In ngay
                    </button>
                </div>
            </div>
        </div>
    );
}
