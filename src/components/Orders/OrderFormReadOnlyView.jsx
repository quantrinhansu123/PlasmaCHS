import { AlertTriangle, Edit3, Package } from 'lucide-react';
import {
    CUSTOMER_CATEGORIES,
    ORDER_TYPES,
    ORDER_STATUSES,
    PRODUCT_TYPES
} from '../../constants/orderConstants';

function Row({ label, value }) {
    const display = value !== null && value !== undefined && value !== '' ? value : '—';
    return (
        <div className="py-2.5 border-b border-slate-100 last:border-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
            <p className="text-[15px] font-semibold text-slate-900 break-words whitespace-pre-wrap">{display}</p>
        </div>
    );
}

export default function OrderFormReadOnlyView({
    formData,
    order,
    customers,
    warehousesList,
    shippersList,
    promotionsList,
    cylinderDebt,
    formatNumber,
    calculatedTotalAmount,
    freeCylinders,
    billedQuantity
}) {
    const customerName = formData.customerId
        ? customers.find(c => c.id.toString() === formData.customerId.toString())?.name
        : null;
    const displayCustomer = customerName || order?.customer_name || '—';

    const warehouseLabel =
        warehousesList.find(
            w => w.id === formData.warehouse || String(w.id) === String(formData.warehouse)
        )?.name || formData.warehouse || '—';

    const orderTypeLabel = ORDER_TYPES.find(t => t.id === formData.orderType)?.label || formData.orderType;
    const categoryLabel =
        CUSTOMER_CATEGORIES.find(c => c.id === formData.customerCategory)?.label || formData.customerCategory;

    const promoLabel = formData.promotion
        ? (() => {
              const p = promotionsList.find(x => x.code === formData.promotion);
              return p ? `${p.code} — Tặng ${p.free_cylinders ?? 0} bình` : formData.promotion;
          })()
        : 'Không có';

    const shipperLabel = formData.shipperId
        ? shippersList.find(s => s.id === formData.shipperId || String(s.id) === String(formData.shipperId))?.name ||
          '—'
        : '—';

    const statusLabel = order?.status
        ? ORDER_STATUSES.find(s => s.id === order.status)?.label || order.status
        : null;

    return (
        <div className="space-y-6">
            {order && (statusLabel || order.ordered_by || order.created_at) && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-1">
                        <Package className="w-4 h-4 text-primary" />
                        <h4 className="text-[18px] font-extrabold text-slate-800">Trạng thái & hệ thống</h4>
                    </div>
                    {statusLabel && <Row label="Trạng thái" value={statusLabel} />}
                    {order.ordered_by ? <Row label="Người tạo / phụ trách" value={order.ordered_by} /> : null}
                    {order.created_at ? (
                        <Row label="Ngày tạo" value={new Date(order.created_at).toLocaleString('vi-VN')} />
                    ) : null}
                </div>
            )}

            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10 mb-1">
                    <Package className="w-4 h-4 text-primary" />
                    <h4 className="text-[18px] font-extrabold text-primary">Thông tin đơn hàng</h4>
                </div>
                <Row label="Mã đơn hàng" value={formData.orderCode} />
                <Row label="Khách hàng" value={displayCustomer} />
                <Row label="Người nhận" value={formData.recipientName} />
                <Row label="Số điện thoại" value={formData.recipientPhone} />
                <Row label="Địa chỉ giao hàng" value={formData.recipientAddress} />

                {cylinderDebt.length > 0 && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-2 text-amber-700 font-bold text-[11px] uppercase tracking-wider">
                            <AlertTriangle size={14} /> Nợ vỏ hiện tại
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {cylinderDebt.map((debt, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between px-3 py-1.5 bg-white border border-amber-100 rounded-xl shadow-sm"
                                >
                                    <span className="text-[12px] font-bold text-slate-600">{debt.cylinder_type}</span>
                                    <span className="text-[14px] font-black text-amber-600">{debt.debt_count} cái</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10 mb-1">
                    <Edit3 className="w-4 h-4 text-primary/80" />
                    <h4 className="text-[18px] font-extrabold text-primary">Sản phẩm & thanh toán</h4>
                </div>
                <Row label="Loại khách hàng" value={categoryLabel} />
                <Row label="Kho xuất hàng" value={warehouseLabel} />

                <div className="space-y-3 mt-4">
                    {formData.items.map((item, idx) => {
                        const isMachine =
                            item.productType?.match(/^(MAY|MÁY)/) ||
                            ['TM', 'SD', 'FM', 'KHAC', 'DNXM', 'MAY_ROSY', 'MAY_MED', 'MAY_MED_NEW'].includes(
                                item.productType?.toUpperCase()
                            );
                        const isCylinder = item.productType?.startsWith('BINH');
                        const pt = PRODUCT_TYPES.find(p => p.id === item.productType);
                        const serials = (item.assignedCylinders || [])
                            .map(c => (typeof c === 'string' ? c : c?.serial))
                            .filter(Boolean);
                        return (
                            <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 space-y-0">
                                <p className="text-[11px] font-black text-primary uppercase tracking-wide pb-2 mb-2 border-b border-slate-200/80">
                                    Sản phẩm {idx + 1}
                                </p>
                                <Row label="Loại sản phẩm" value={pt?.label || item.productType} />
                                <Row label="Số lượng" value={String(item.quantity ?? 0)} />
                                <Row label="Đơn giá (VNĐ)" value={formatNumber(item.unitPrice)} />
                                <Row
                                    label="Thành tiền (VNĐ)"
                                    value={formatNumber((item.quantity || 0) * (item.unitPrice || 0))}
                                />
                                {isMachine && (
                                    <>
                                        <Row label="Khoa / bộ phận dùng máy" value={item.tempDept} />
                                        <Row label="Số serial máy" value={item.tempSerial} />
                                    </>
                                )}
                                {isCylinder && serials.length > 0 && (
                                    <Row label="Mã vỏ bình RFID" value={serials.join(', ')} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                    <Row label="Tổng giá trị đơn hàng (VNĐ)" value={formatNumber(calculatedTotalAmount)} />
                </div>
                <Row label="Loại đơn hàng" value={orderTypeLabel} />
                <Row label="Khuyến mãi" value={promoLabel} />
                {freeCylinders > 0 && (
                    <p className="text-[12px] font-bold text-orange-600 px-0.5 pt-1">
                        Khấu trừ: {freeCylinders} bình miễn phí · Tính tiền theo bình: {billedQuantity}
                    </p>
                )}
                <Row label="Đơn vị vận chuyển" value={shipperLabel} />
                <Row label="Phí giao hàng (VNĐ)" value={formatNumber(formData.shippingFee)} />
                <Row label="Ghi chú" value={formData.note} />
            </div>
        </div>
    );
}
