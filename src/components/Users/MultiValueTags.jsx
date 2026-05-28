import { splitMultiValue } from '../../utils/multiValueField';

export default function MultiValueTags({ value, empty = '—' }) {
    const items = splitMultiValue(value);
    if (!items.length) {
        return <span className="text-[13px] text-muted-foreground">{empty}</span>;
    }
    return (
        <div className="flex flex-wrap gap-1 max-w-[280px]">
            {items.map((item) => (
                <span
                    key={item}
                    className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-semibold text-slate-700"
                >
                    {item}
                </span>
            ))}
        </div>
    );
}
