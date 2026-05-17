import { clsx } from 'clsx';
import {
    CheckCircle2,
    Cpu,
    Droplets,
    FileText,
    Filter,
    History,
    Monitor,
    Plus,
    Search,
} from 'lucide-react';

function getAssetStatusBadge(status) {
    const s = String(status || '').trim().toLowerCase();
    if (!s) {
        return { label: '—', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    if (
        s.includes('hoạt') ||
        s.includes('sử dụng') ||
        s.includes('thuộc khách') ||
        s.includes('tốt')
    ) {
        return {
            label: 'Hoạt động tốt',
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
    }
    if (s.includes('bảo trì') || s.includes('sửa') || s.includes('hỏng')) {
        return {
            label: status,
            className: 'bg-amber-50 text-amber-800 border-amber-200',
        };
    }
    return {
        label: status,
        className: 'bg-slate-100 text-slate-600 border-slate-200',
    };
}

function AssetLogTable({ logs, formatDateTime }) {
    if (logs.length === 0) {
        return (
            <p className="px-2 py-3 text-center text-xs font-medium italic text-slate-400">
                Không có nhật ký trong khoảng thời gian đã chọn.
            </p>
        );
    }
    return (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                        <th className="px-2 py-1.5">Thời điểm</th>
                        <th className="px-2 py-1.5">Hành động</th>
                        <th className="px-2 py-1.5">Mô tả</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {logs.map((log) => (
                        <tr key={log.id} className="align-top text-slate-700">
                            <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-500">
                                {formatDateTime(log.created_at)}
                            </td>
                            <td className="px-2 py-1.5 font-bold text-indigo-700">
                                {log.action || '—'}
                            </td>
                            <td className="max-w-[200px] break-words px-2 py-1.5 text-slate-600">
                                {log.description || '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function CustomerAssetsHistoryPanel({
    customer,
    machineRange,
    setMachineRange,
    machinesHistoryLoading,
    filteredMachines,
    filteredCylinders,
    machineSearch,
    setMachineSearch,
    machineSort,
    setMachineSort,
    cylinderSearch,
    setCylinderSearch,
    cylinderSort,
    setCylinderSort,
    assetsQuickDays,
    applyAssetsQuickDays,
    assetDetailKey,
    setAssetDetailKey,
    assetHistoryKey,
    setAssetHistoryKey,
    assetPanelKey,
    logsForAssetSerial,
    formatDateTime,
    formatAssetUpdatedAt,
    machineCount,
    cylinderCount,
}) {
    const renderMachineCard = (m) => {
        const logs = logsForAssetSerial(m.serial_number);
        const panelKey = assetPanelKey('machine', m.serial_number);
        const detailOpen = assetDetailKey === panelKey;
        const historyOpen = assetHistoryKey === panelKey;
        const badge = getAssetStatusBadge(m.status);

        return (
            <div
                key={m.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
                <div className="p-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Monitor className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-black text-slate-900">{m.serial_number}</p>
                                <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                    {logs.length} sự kiện
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                {m.machine_type || '—'} · {m.status || '—'}
                            </p>
                            <span
                                className={clsx(
                                    'mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold',
                                    badge.className,
                                )}
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                {badge.label}
                            </span>
                            <p className="mt-2 text-[10px] font-medium text-slate-400">
                                Cập nhật: {formatAssetUpdatedAt(m)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setAssetDetailKey(detailOpen ? null : panelKey)
                            }
                            className={clsx(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                                detailOpen
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Chi tiết
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAssetHistoryKey(historyOpen ? null : panelKey);
                                if (!historyOpen) setAssetDetailKey(null);
                            }}
                            className={clsx(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                                historyOpen
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                        >
                            <History className="h-3.5 w-3.5" />
                            Lịch sử
                        </button>
                    </div>
                </div>
                {detailOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                        <p>
                            <span className="font-bold text-slate-500">Loại máy:</span>{' '}
                            {m.machine_type || '—'}
                        </p>
                        <p className="mt-1">
                            <span className="font-bold text-slate-500">Trạng thái:</span>{' '}
                            {m.status || '—'}
                        </p>
                        <p className="mt-1">
                            <span className="font-bold text-slate-500">Kho:</span>{' '}
                            {m.warehouse || '—'}
                        </p>
                        {m.customer_name && (
                            <p className="mt-1">
                                <span className="font-bold text-slate-500">Khách ghi nhận:</span>{' '}
                                {m.customer_name}
                            </p>
                        )}
                    </div>
                )}
                {historyOpen && (
                    <div className="border-t border-slate-100 bg-white px-2 py-2">
                        <AssetLogTable logs={logs} formatDateTime={formatDateTime} />
                    </div>
                )}
            </div>
        );
    };

    const renderCylinderCard = (cyl) => {
        const logs = logsForAssetSerial(cyl.serial_number);
        const panelKey = assetPanelKey('cylinder', cyl.serial_number);
        const detailOpen = assetDetailKey === panelKey;
        const historyOpen = assetHistoryKey === panelKey;
        const badge = getAssetStatusBadge(cyl.status);

        return (
            <div
                key={cyl.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
                <div className="p-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                            <Droplets className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-mono text-sm font-black text-slate-900">
                                    {cyl.serial_number}
                                </p>
                                <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                    {logs.length} sự kiện
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                {(cyl.volume && String(cyl.volume).trim()) || '—'} · {cyl.status || '—'}
                            </p>
                            <span
                                className={clsx(
                                    'mt-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold',
                                    badge.className,
                                )}
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                {badge.label}
                            </span>
                            <p className="mt-2 text-[10px] font-medium text-slate-400">
                                Cập nhật: {formatAssetUpdatedAt(cyl)}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setAssetDetailKey(detailOpen ? null : panelKey)
                            }
                            className={clsx(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                                detailOpen
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Chi tiết
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAssetHistoryKey(historyOpen ? null : panelKey);
                                if (!historyOpen) setAssetDetailKey(null);
                            }}
                            className={clsx(
                                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-bold transition-colors',
                                historyOpen
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                        >
                            <History className="h-3.5 w-3.5" />
                            Lịch sử
                        </button>
                    </div>
                </div>
                {detailOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                        <p>
                            <span className="font-bold text-slate-500">Thể tích:</span>{' '}
                            {(cyl.volume && String(cyl.volume).trim()) || '—'}
                        </p>
                        <p className="mt-1">
                            <span className="font-bold text-slate-500">Trạng thái:</span>{' '}
                            {cyl.status || '—'}
                        </p>
                        {cyl.customer_name && (
                            <p className="mt-1">
                                <span className="font-bold text-slate-500">Khách ghi nhận:</span>{' '}
                                {cyl.customer_name}
                            </p>
                        )}
                    </div>
                )}
                {historyOpen && (
                    <div className="border-t border-slate-100 bg-white px-2 py-2">
                        <AssetLogTable logs={logs} formatDateTime={formatDateTime} />
                    </div>
                )}
            </div>
        );
    };

    if (
        !customer?.id &&
        !(customer?.name && String(customer.name).trim())
    ) {
        return (
            <p className="text-sm font-medium italic text-slate-500">
                Cần mã khách hoặc tên khách để tra máy, vỏ bình và nhật ký.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Bộ lọc
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-0.5">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Từ ngày
                            </label>
                            <input
                                type="date"
                                value={machineRange.from}
                                onChange={(e) =>
                                    setMachineRange((r) => ({ ...r, from: e.target.value }))
                                }
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800"
                            />
                        </div>
                        <div className="space-y-0.5">
                            <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                Đến ngày
                            </label>
                            <input
                                type="date"
                                value={machineRange.to}
                                onChange={(e) =>
                                    setMachineRange((r) => ({ ...r, to: e.target.value }))
                                }
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800"
                            />
                        </div>
                        {[7, 30, 90].map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => applyAssetsQuickDays(days)}
                                className={clsx(
                                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                                    assetsQuickDays === days
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                                )}
                            >
                                {days} ngày
                            </button>
                        ))}
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:brightness-110"
                        >
                            <Filter className="h-3.5 w-3.5" />
                            Lọc dữ liệu
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:items-start">
                <div className="min-w-0 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                            Danh sách máy ({machineCount})
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={machineSearch}
                                onChange={(e) => setMachineSearch(e.target.value)}
                                placeholder="Tìm mã máy..."
                                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs font-semibold text-slate-800 outline-none focus:border-primary/40"
                            />
                        </div>
                        <select
                            value={machineSort}
                            onChange={(e) => setMachineSort(e.target.value)}
                            className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary/40"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="oldest">Cũ nhất</option>
                            <option value="serial_asc">Mã A→Z</option>
                        </select>
                    </div>

                    {machinesHistoryLoading ? (
                        <p className="py-8 text-center text-xs font-bold text-slate-400">Đang tải…</p>
                    ) : filteredMachines.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                            <Cpu className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                            <p className="text-sm font-bold text-slate-500">Chưa có máy nào</p>
                            <p className="mt-1 text-xs text-slate-400">
                                Khách hàng chưa được gán máy trên hệ thống
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">{filteredMachines.map(renderMachineCard)}</div>
                    )}

                    <button
                        type="button"
                        onClick={() => window.open('/may', '_blank')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-xs font-bold text-slate-500 transition-colors hover:border-primary hover:text-primary"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm máy mới
                    </button>
                </div>

                <div className="min-w-0 space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                        Danh sách bình ({cylinderCount})
                    </p>
                    <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={cylinderSearch}
                                onChange={(e) => setCylinderSearch(e.target.value)}
                                placeholder="Tìm mã bình..."
                                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs font-semibold text-slate-800 outline-none focus:border-primary/40"
                            />
                        </div>
                        <select
                            value={cylinderSort}
                            onChange={(e) => setCylinderSort(e.target.value)}
                            className="shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-primary/40"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="oldest">Cũ nhất</option>
                            <option value="serial_asc">Mã A→Z</option>
                        </select>
                    </div>

                    {machinesHistoryLoading ? (
                        <p className="py-8 text-center text-xs font-bold text-slate-400">Đang tải…</p>
                    ) : filteredCylinders.length === 0 ? (
                        <div className="rounded-xl border border-slate-100 bg-sky-50/30 py-12 text-center">
                            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100/80">
                                <Droplets className="h-8 w-8 text-sky-400" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">Chưa có vỏ bình nào</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Khách hàng hiện chưa được gán bình gas
                            </p>
                            <button
                                type="button"
                                onClick={() => window.open('/binh/tao', '_blank')}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-xs font-bold text-primary hover:bg-primary/5"
                            >
                                <Plus className="h-4 w-4" />
                                Thêm vỏ bình
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredCylinders.map(renderCylinderCard)}
                        </div>
                    )}

                    {filteredCylinders.length > 0 && (
                        <button
                            type="button"
                            onClick={() => window.open('/binh/tao', '_blank')}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-xs font-bold text-slate-500 transition-colors hover:border-primary hover:text-primary"
                        >
                            <Plus className="h-4 w-4" />
                            Thêm vỏ bình
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
