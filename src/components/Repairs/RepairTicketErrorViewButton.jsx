import { Eye } from 'lucide-react';
import { clsx } from 'clsx';

export default function RepairTicketErrorViewButton({
    ticket,
    onClick,
    variant = 'table',
    className = '',
}) {
    const serial = String(ticket?.machine_serial || '').trim();
    const reference = serial ? `#${ticket.stt} · ${serial}` : `#${ticket.stt}`;
    const title = `Xem thẻ lỗi phiếu ${reference}`;

    if (variant === 'kanban') {
        return (
            <button
                type="button"
                onClick={onClick}
                title={title}
                className={clsx(
                    'inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-800 transition-colors hover:bg-emerald-100',
                    className,
                )}
            >
                <Eye size={11} className="shrink-0" />
                <span className="max-w-[72px] truncate font-mono text-[9px] font-bold leading-none">{reference}</span>
            </button>
        );
    }

    if (variant === 'mobile') {
        return (
            <button
                type="button"
                onClick={onClick}
                title={title}
                className={clsx(
                    'inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-left transition-all active:scale-95 hover:bg-emerald-100',
                    className,
                )}
            >
                <Eye size={14} className="shrink-0 text-emerald-700" />
                <span className="min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-wide text-emerald-800">Thẻ lỗi</span>
                    <span className="block truncate font-mono text-[10px] font-bold text-slate-700">{reference}</span>
                </span>
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={clsx(
                'inline-flex h-8 max-w-[7.5rem] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-left transition-colors hover:bg-emerald-100',
                className,
            )}
        >
            <Eye size={14} className="shrink-0 text-emerald-700" />
            <span className="min-w-0">
                <span className="block text-[8px] font-black uppercase leading-none tracking-wide text-emerald-800">Thẻ lỗi</span>
                <span className="block truncate font-mono text-[10px] font-bold leading-tight text-slate-700">{reference}</span>
            </span>
        </button>
    );
}
