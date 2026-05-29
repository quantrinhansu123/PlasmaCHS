import {
    BarChart3,
    Check,
    ChevronDown,
    ClipboardList,
    FileText,
    Gift,
    Minus,
    Package,
    RotateCcw,
    ShieldCheck,
    ShoppingCart,
    Truck,
    UserCircle,
    Users,
    Warehouse,
    Wrench,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { buildPermissionRows } from '../../constants/permissionConstants';

const PERMISSION_GROUPS = buildPermissionRows();

const MODULE_ICONS = {
    users: UserCircle,
    permissions: ShieldCheck,
    dashboard: BarChart3,
    reports: FileText,
    customers: Users,
    machines: Wrench,
    cylinders: Package,
    warehouses: Warehouse,
    suppliers: Truck,
    shippers: Truck,
    materials: Package,
    promotions: Gift,
    orders: ShoppingCart,
    shipping_tasks: ClipboardList,
    dnxm: ClipboardList,
    cylinder_recoveries: RotateCcw,
    machine_recoveries: RotateCcw,
};

const MODULE_ICON_COLORS = {
    users: 'text-violet-600 bg-violet-50',
    permissions: 'text-blue-600 bg-blue-50',
    dashboard: 'text-indigo-600 bg-indigo-50',
    reports: 'text-slate-600 bg-slate-100',
    customers: 'text-emerald-600 bg-emerald-50',
    machines: 'text-amber-600 bg-amber-50',
    cylinders: 'text-cyan-600 bg-cyan-50',
    warehouses: 'text-orange-600 bg-orange-50',
    suppliers: 'text-teal-600 bg-teal-50',
    shippers: 'text-sky-600 bg-sky-50',
    materials: 'text-lime-600 bg-lime-50',
    promotions: 'text-pink-600 bg-pink-50',
    orders: 'text-blue-600 bg-blue-50',
    shipping_tasks: 'text-indigo-600 bg-indigo-50',
    dnxm: 'text-violet-600 bg-violet-50',
    cylinder_recoveries: 'text-rose-600 bg-rose-50',
    machine_recoveries: 'text-rose-600 bg-rose-50',
};

const normalizeQuery = (value = '') =>
    String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export default function PermissionMatrixView({
    permissions = {},
    readOnly = false,
    variant = 'matrix',
    onToggle,
    onToggleGroup,
    permissionQuery = '',
}) {
    const isSummary = variant === 'summary';
    const [expandedGroups, setExpandedGroups] = useState(() =>
        Object.fromEntries(PERMISSION_GROUPS.map((group) => [group.id, true])),
    );

    const query = normalizeQuery(permissionQuery);

    const visibleGroups = useMemo(() => {
        const base = !query
            ? PERMISSION_GROUPS
            : PERMISSION_GROUPS.map((group) => ({
                  ...group,
                  items: group.items.filter((item) => {
                      const haystack = normalizeQuery(`${item.title} ${item.path} ${item.moduleId}`);
                      return haystack.includes(query);
                  }),
              })).filter((group) => group.items.length > 0);

        if (!isSummary) return base;

        return base
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => Boolean(permissions?.[item.moduleId]?.view)),
            }))
            .filter((group) => group.items.length > 0);
    }, [query, isSummary, permissions]);

    const isGroupFullyChecked = (group) =>
        group.items.every((item) => Boolean(permissions?.[item.moduleId]?.view));

    const isGroupPartiallyChecked = (group) => {
        const checkedCount = group.items.filter((item) => permissions?.[item.moduleId]?.view).length;
        return checkedCount > 0 && checkedCount < group.items.length;
    };

    const toggleGroupExpanded = (groupId) => {
        setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const handleRowToggle = (moduleId, actionId) => {
        if (readOnly || !onToggle) return;
        onToggle(moduleId, actionId);
    };

    if (visibleGroups.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-400">
                {isSummary
                    ? 'Chưa cấp quyền xem module nào.'
                    : 'Không có quyền phù hợp với từ khóa tìm kiếm.'}
            </div>
        );
    }

    if (isSummary) {
        return (
            <div className="space-y-4">
                {visibleGroups.map((group) => (
                    <section key={group.id}>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                            {group.label}
                        </p>
                        <ul className="mt-2 space-y-1.5 border-l-2 border-blue-100 pl-4">
                            {group.items.map((item) => (
                                <li key={item.key} className="text-[13px] font-semibold text-slate-800">
                                    {item.title}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Module / Phân hệ
                            </th>
                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Đường dẫn (Path)
                            </th>
                            <th className="w-[88px] px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-blue-600">
                                Xem
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleGroups.map((group) => {
                            const expanded = expandedGroups[group.id] !== false;
                            const groupChecked = isGroupFullyChecked(group);
                            const groupPartial = isGroupPartiallyChecked(group);

                            return (
                                <Fragment key={group.id}>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleGroupExpanded(group.id)}
                                                className="flex items-center gap-2 text-left"
                                            >
                                                <ChevronDown
                                                    className={clsx(
                                                        'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                                                        expanded ? 'rotate-0' : '-rotate-90',
                                                    )}
                                                />
                                                <span className="text-[13px] font-bold text-slate-800">
                                                    {group.label}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="text-[12px] font-medium text-slate-400">
                                                {group.pathPattern}
                                            </code>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {!readOnly && onToggleGroup ? (
                                                <label
                                                    className="inline-flex cursor-pointer items-center justify-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={groupChecked}
                                                        ref={(el) => {
                                                            if (el) el.indeterminate = groupPartial;
                                                        }}
                                                        onChange={() => onToggleGroup(group.id, !groupChecked)}
                                                        className="h-[18px] w-[18px] rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </label>
                                            ) : (
                                                <ViewStatusBadge checked={groupChecked} partial={groupPartial} />
                                            )}
                                        </td>
                                    </tr>

                                    {expanded
                                        ? group.items.map((item) => {
                                              const checked = Boolean(permissions?.[item.moduleId]?.view);
                                              const Icon = MODULE_ICONS[item.moduleId] || FileText;
                                              const iconColor =
                                                  MODULE_ICON_COLORS[item.moduleId] ||
                                                  'text-slate-600 bg-slate-100';

                                              return (
                                                  <tr
                                                      key={item.key}
                                                      className={clsx(
                                                          'border-b border-slate-50 transition-colors',
                                                          !readOnly && 'cursor-pointer hover:bg-slate-50/80',
                                                          checked && 'bg-blue-50/20',
                                                      )}
                                                      onClick={() => handleRowToggle(item.moduleId, item.actionId)}
                                                  >
                                                      <td className="px-4 py-2.5">
                                                          <div className="flex items-center gap-3 pl-6">
                                                              <span
                                                                  className={clsx(
                                                                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                                                      iconColor,
                                                                  )}
                                                              >
                                                                  <Icon className="h-4 w-4" />
                                                              </span>
                                                              <span className="text-[13px] font-semibold text-slate-800">
                                                                  {item.title}
                                                              </span>
                                                          </div>
                                                      </td>
                                                      <td className="px-4 py-2.5">
                                                          <code className="text-[12px] text-slate-400">
                                                              {item.path}
                                                          </code>
                                                      </td>
                                                      <td
                                                          className="px-3 py-2.5 text-center"
                                                          onClick={(e) => e.stopPropagation()}
                                                      >
                                                          {readOnly ? (
                                                              <ViewStatusBadge checked={checked} />
                                                          ) : (
                                                              <label className="inline-flex cursor-pointer items-center justify-center">
                                                                  <input
                                                                      type="checkbox"
                                                                      checked={checked}
                                                                      onChange={() =>
                                                                          onToggle?.(item.moduleId, item.actionId)
                                                                      }
                                                                      className="h-[18px] w-[18px] rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                  />
                                                              </label>
                                                          )}
                                                      </td>
                                                  </tr>
                                              );
                                          })
                                        : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ViewStatusBadge({ checked, partial = false }) {
    if (partial) {
        return (
            <span className="text-[10px] font-bold text-amber-600">Một phần</span>
        );
    }
    if (checked) {
        return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
        );
    }
    return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-300">
            <Minus className="h-3.5 w-3.5" />
        </span>
    );
}
