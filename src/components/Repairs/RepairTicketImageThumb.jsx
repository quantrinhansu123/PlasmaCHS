import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { resolveRepairTicketImageAccess } from '../../utils/repairTicketImages';

export default function RepairTicketImageThumb({
    src,
    alt = '',
    className = '',
    linkClassName = 'block h-full w-full',
    imageClassName = 'h-full w-full object-cover',
    onRemove,
    removeDisabled = false,
    removeTitle = 'Xóa ảnh',
}) {
    const [resolvedSrc, setResolvedSrc] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        setResolvedSrc('');

        if (!src) return undefined;

        resolveRepairTicketImageAccess(src)
            .then((url) => {
                if (!cancelled) setResolvedSrc(url || '');
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });

        return () => {
            cancelled = true;
        };
    }, [src]);

    const preview = failed || !resolvedSrc ? (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 px-2 text-center text-[10px] font-semibold text-slate-400">
            Không tải được ảnh
        </div>
    ) : (
        <img
            src={resolvedSrc}
            alt={alt}
            className={imageClassName}
            onError={() => setFailed(true)}
        />
    );

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {resolvedSrc && !failed ? (
                <a href={resolvedSrc} target="_blank" rel="noopener noreferrer" className={linkClassName}>
                    {preview}
                </a>
            ) : (
                <div className={linkClassName}>{preview}</div>
            )}
            {onRemove ? (
                <button
                    type="button"
                    disabled={removeDisabled}
                    onClick={onRemove}
                    className="absolute top-1 right-1 rounded-md bg-rose-600 p-1 text-white shadow hover:bg-rose-700 disabled:opacity-50"
                    title={removeTitle}
                >
                    <X size={12} />
                </button>
            ) : null}
        </div>
    );
}
