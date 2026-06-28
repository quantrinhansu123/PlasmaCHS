import clsx from 'clsx';

/** Hiển thị ảnh bằng chứng giao hàng — không dùng link text trong ghi chú. */
export default function DeliveryProofGallery({ urls = [], className, compact = false }) {
    const list = [...new Set((urls || []).map((u) => String(u || '').trim()).filter(Boolean))];
    if (!list.length) return null;

    return (
        <div className={clsx('space-y-1.5', className)}>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                Ảnh xác nhận giao hàng
            </p>
            <div
                className={clsx(
                    'grid gap-2',
                    compact ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4',
                )}
            >
                {list.map((url, idx) => (
                    <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={clsx(
                            'relative overflow-hidden rounded-xl border border-emerald-200 bg-slate-100 shadow-sm hover:ring-2 hover:ring-emerald-300 transition-all',
                            compact ? 'aspect-square' : 'aspect-[4/3]',
                        )}
                        title="Xem ảnh giao hàng"
                    >
                        <img
                            src={url}
                            alt={`Ảnh giao hàng ${idx + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    </a>
                ))}
            </div>
        </div>
    );
}
