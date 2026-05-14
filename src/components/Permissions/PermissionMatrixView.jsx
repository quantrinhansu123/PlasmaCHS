import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ACTION_TYPES, buildPermissionRows } from '../../constants/permissionConstants';

const PERMISSION_GROUPS = buildPermissionRows();

const normalizeQuery = (value = '') =>
    String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export default function PermissionMatrixView({
    permissions = {},
    readOnly = false,
    onToggle,
    onToggleGroup,
    permissionQuery = '',
}) {
    const [expandedGroups, setExpandedGroups] = useState(() =>
        Object.fromEntries(PERMISSION_GROUPS.map((group) => [group.id, true])),
    );

    const query = normalizeQuery(permissionQuery);

    const visibleGroups = useMemo(() => {
        if (!query) return PERMISSION_GROUPS;
        return PERMISSION_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                const haystack = normalizeQuery(`${item.title} ${item.description} ${item.moduleId} ${item.actionId}`);
                return haystack.includes(query);
            }),
        })).filter((group) => group.items.length > 0);
    }, [query]);

    const isGroupFullyChecked = (group) =>
        group.items.every((item) => Boolean(permissions?.[item.moduleId]?.[item.actionId]));

    const toggleGroupExpanded = (groupId) => {
        setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    if (visibleGroups.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-400">
                Không có quyền phù hợp với từ khóa tìm kiếm.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {visibleGroups.map((group) => {
                const expanded = expandedGroups[group.id] !== false;
                const groupChecked = isGroupFullyChecked(group);
                return (
                    <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => toggleGroupExpanded(group.id)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                                <ChevronDown
                                    className={clsx(
                                        'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                                        expanded ? 'rotate-0' : '-rotate-90',
                                    )}
                                />
                                <div className="min-w-0">
                                    <p className="truncate text-[12px] font-black uppercase tracking-wide text-slate-800">
                                        {group.label}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-400">{group.items.length} quyền</p>
                                </div>
                            </button>
                            {!readOnly && onToggleGroup ? (
                                <label className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    <span>Tất cả</span>
                                    <input
                                        type="checkbox"
                                        checked={groupChecked}
                                        onChange={() => onToggleGroup(group.id, !groupChecked)}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </label>
                            ) : null}
                        </div>

                        {expanded ? (
                            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                {group.items.map((item) => {
                                    const checked = Boolean(permissions?.[item.moduleId]?.[item.actionId]);
                                    const actionMeta = ACTION_TYPES.find((action) => action.id === item.actionId);
                                    return (
                                        <div
                                            key={item.key}
                                            className="flex min-h-[104px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:border-blue-200 hover:bg-white"
                                        >
                                            <div className="min-w-0">
                                                <p className="line-clamp-2 text-[12px] font-bold leading-snug text-slate-800">{item.title}</p>
                                                <p className="mt-1 truncate text-[10px] font-medium text-slate-400">{item.description}</p>
                                            </div>
                                            <div className="mt-3 flex items-center justify-end">
                                                {readOnly ? (
                                                    <span
                                                        className={clsx(
                                                            'rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide',
                                                            checked
                                                                ? actionMeta?.colorClass || 'bg-blue-50 text-blue-700 border-blue-100'
                                                                : 'border-slate-200 bg-white text-slate-300',
                                                        )}
                                                    >
                                                        {checked ? 'Bật' : 'Tắt'}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => onToggle?.(item.moduleId, item.actionId)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}
