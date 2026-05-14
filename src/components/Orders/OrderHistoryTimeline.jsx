import clsx from 'clsx';
import { CheckCircle2, Clock, FileText, History } from 'lucide-react';
import { getOrderStatusMeta } from '../../constants/orderConstants';

const formatHistoryTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const describeHistoryEntry = (entry) => {
    const actor = entry.created_by || 'Hệ thống';

    switch (entry.action) {
        case 'CREATED':
            return `${actor} tạo đơn hàng`;
        case 'STATUS_CHANGED': {
            const fromLabel = getOrderStatusMeta(entry.old_status).label;
            const toLabel = getOrderStatusMeta(entry.new_status).label;
            return `${actor} chuyển trạng thái: ${fromLabel} → ${toLabel}`;
        }
        case 'EDITED':
            return `${actor} chỉnh sửa đơn hàng`;
        case 'APPROVED':
            return `${actor} duyệt đơn hàng`;
        case 'NOTIFICATION':
            return entry.title || entry.description || 'Cập nhật trạng thái đơn';
        default:
            return entry.title || `${actor} cập nhật đơn hàng`;
    }
};

export default function OrderHistoryTimeline({ entries = [], loading = false }) {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <History className="h-4 w-4 text-primary" aria-hidden />
                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                    Lịch sử duyệt đơn
                </h4>
            </div>

            {loading ? (
                <div className="space-y-3 p-4">
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : entries.length === 0 ? (
                <div className="px-4 py-6 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-slate-200" aria-hidden />
                    <p className="text-sm font-bold text-slate-500">Chưa có lịch sử duyệt</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                        Các bước duyệt và chuyển trạng thái sẽ hiển thị tại đây.
                    </p>
                </div>
            ) : (
                <div className="custom-scrollbar max-h-72 space-y-0 overflow-y-auto p-4">
                    {entries.map((entry, index) => {
                        const isLatest = index === 0;
                        const detail = entry.description || entry.reason;

                        return (
                            <div key={entry.id || `${entry.created_at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                                {index < entries.length - 1 && (
                                    <span className="absolute bottom-0 left-[11px] top-6 w-px bg-slate-200" aria-hidden />
                                )}
                                <div
                                    className={clsx(
                                        'relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                                        isLatest
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                            : 'border-slate-200 bg-slate-50 text-slate-400'
                                    )}
                                >
                                    {isLatest ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-bold leading-snug text-slate-800">
                                        {describeHistoryEntry(entry)}
                                    </p>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                                        {formatHistoryTime(entry.created_at)}
                                    </p>
                                    {detail ? (
                                        <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] font-medium leading-relaxed text-slate-600">
                                            {detail}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
