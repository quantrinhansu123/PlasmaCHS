import { useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarClock,
    Clock,
    Edit,
    Image as ImageIcon,
    Package,
    User,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import { clsx } from 'clsx';
import RepairTicketImageThumb from './RepairTicketImageThumb';

const DETAIL_TABS = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'evidence', label: 'Hình ảnh' },
    { id: 'team', label: 'Phân công' },
];

export default function RepairTicketErrorDetailDialog({
    ticket,
    onClose,
    onEdit,
    getCustomerName,
    getErrorTypeName,
    getUserName,
    getStatusBadge,
    getLoaiLoiBadgeClass,
    getErrorLevelColor,
}) {
    const [activeTab, setActiveTab] = useState('overview');

    const serial = String(ticket?.machine_serial || '').trim();
    const reference = serial ? `#${ticket.stt} · ${serial}` : `#${ticket.stt}`;
    const errorImageCount = Array.isArray(ticket?.error_images) ? ticket.error_images.length : 0;
    const technicalImageCount = Array.isArray(ticket?.technical_images) ? ticket.technical_images.length : 0;

    const reportedAt = useMemo(
        () => (ticket?.created_at ? new Date(ticket.created_at).toLocaleString('vi-VN') : '—'),
        [ticket?.created_at],
    );

    const expectedCompletion = useMemo(
        () =>
            ticket?.expected_completion_date
                ? new Date(ticket.expected_completion_date).toLocaleDateString('vi-VN')
                : null,
        [ticket?.expected_completion_date],
    );

    return (
        <div className="fixed inset-0 z-[100009] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
                aria-label="Đóng"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ticket-error-detail-title"
                className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[88vh] sm:max-w-2xl sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 px-4 pb-3 pt-4 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                Thẻ lỗi · Phiếu sửa chữa
                            </p>
                            <h2 id="ticket-error-detail-title" className="mt-1 font-mono text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                                {reference}
                            </h2>
                            <p className="mt-1 truncate text-[13px] font-semibold text-slate-600">
                                {ticket.machine_name || 'Thiết bị chưa đặt tên'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
                            title="Đóng"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        <span className={clsx('rounded-full border px-2.5 py-0.5 text-[11px] font-bold', getErrorLevelColor(ticket.error_level))}>
                            {ticket.error_level || 'Trung bình'}
                        </span>
                        {ticket.loai_loi ? (
                            <span className={clsx('rounded-lg border px-2 py-0.5 text-[11px] font-bold', getLoaiLoiBadgeClass(ticket.loai_loi))}>
                                {ticket.loai_loi}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Khách hàng</p>
                            <p className="mt-0.5 truncate text-[12px] font-bold text-slate-800">{getCustomerName(ticket.customer_id)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Loại lỗi</p>
                            <p className="mt-0.5 truncate text-[12px] font-bold text-rose-600">{getErrorTypeName(ticket.error_type_id)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Ngày báo</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{reportedAt}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Dự kiến xong</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{expectedCompletion || 'Chưa đặt'}</p>
                        </div>
                    </div>

                    <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                        {DETAIL_TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors',
                                    activeTab === tab.id
                                        ? 'bg-white text-emerald-800 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700',
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-5">
                    {activeTab === 'overview' ? (
                        <div className="space-y-4">
                            <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                    <AlertCircle size={14} className="text-rose-500" />
                                    Mô tả chi tiết
                                </div>
                                {ticket.error_details?.trim() ? (
                                    <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-slate-700">
                                        {ticket.error_details}
                                    </p>
                                ) : (
                                    <p className="text-[13px] italic text-slate-400">Chưa có mô tả chi tiết.</p>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                                    <Package size={14} className="text-blue-600" />
                                    Thiết bị
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Mã thiết bị</p>
                                        <p className="font-mono text-[13px] font-bold text-blue-800">{ticket.machine_serial || '—'}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                        <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Tên thiết bị</p>
                                        <p className="text-[13px] font-semibold text-slate-800">{ticket.machine_name || '—'}</p>
                                    </div>
                                </div>
                            </section>

                            {ticket.technical_feedback?.trim() ? (
                                <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                                    <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-blue-700">
                                        <Wrench size={14} />
                                        Phản hồi kỹ thuật
                                    </div>
                                    <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-slate-700">
                                        {ticket.technical_feedback}
                                    </p>
                                </section>
                            ) : null}
                        </div>
                    ) : null}

                    {activeTab === 'evidence' ? (
                        <div className="space-y-4">
                            <section className="rounded-2xl border border-rose-100 bg-rose-50/30 p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-rose-700">
                                        <ImageIcon size={14} />
                                        Hình ảnh chi tiết lỗi
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                        {errorImageCount} ảnh
                                    </span>
                                </div>
                                {errorImageCount > 0 ? (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {ticket.error_images.map((url, idx) => (
                                            <RepairTicketImageThumb
                                                key={`err-img-${idx}`}
                                                src={url}
                                                alt={`Chi tiết ${idx + 1}`}
                                                className="aspect-square rounded-xl border border-rose-100 bg-white hover:ring-2 hover:ring-rose-200"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] italic text-slate-400">Chưa có ảnh chi tiết lỗi.</p>
                                )}
                            </section>

                            <section className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-blue-700">
                                        <ImageIcon size={14} />
                                        Hình ảnh xử lý kỹ thuật
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                        {technicalImageCount} ảnh
                                    </span>
                                </div>
                                {technicalImageCount > 0 ? (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {ticket.technical_images.map((url, idx) => (
                                            <RepairTicketImageThumb
                                                key={`tech-img-${idx}`}
                                                src={url}
                                                alt={`Kỹ thuật ${idx + 1}`}
                                                className="aspect-square rounded-xl border border-blue-100 bg-white hover:ring-2 hover:ring-blue-200"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[13px] italic text-slate-400">Chưa có ảnh xử lý kỹ thuật.</p>
                                )}
                            </section>
                        </div>
                    ) : null}

                    {activeTab === 'team' ? (
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                        <User size={13} />
                                        Người báo
                                    </div>
                                    <p className="text-[14px] font-bold text-slate-800">
                                        {ticket.created_by ? getUserName(ticket.created_by) : 'Hệ thống'}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                                        <CalendarClock size={12} />
                                        {reportedAt}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                        <Wrench size={13} />
                                        Kỹ thuật phụ trách
                                    </div>
                                    <p className="text-[14px] font-bold text-slate-800">{getUserName(ticket.technician_id)}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                                        <Users size={13} />
                                        Kinh doanh
                                    </div>
                                    <p className="text-[14px] font-bold text-slate-800">{getUserName(ticket.sales_id)}</p>
                                </div>
                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                                    <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-indigo-500">
                                        <Users size={13} />
                                        CSKH
                                    </div>
                                    <p className="text-[14px] font-bold text-indigo-900">{getUserName(ticket.cskh_id)}</p>
                                </div>
                            </div>
                            {expectedCompletion ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-bold text-emerald-800">
                                    <Clock size={14} />
                                    Dự kiến hoàn thành: {expectedCompletion}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-[13px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        Đóng
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit(ticket)}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-600 px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-blue-700"
                    >
                        <Edit size={16} />
                        Chỉnh sửa phiếu
                    </button>
                </div>
            </div>
        </div>
    );
}
