import { Clock, Edit3, FileText, Plus, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase/config';

const ACTION_CONFIG = {
    CREATED: { icon: Plus, color: 'emerald', label: 'Tạo đơn hàng' },
    EDITED: { icon: Edit3, color: 'amber', label: 'Chỉnh sửa' },
    STATUS_CHANGED: { icon: TrendingUp, color: 'blue', label: 'Đổi trạng thái' }
};

const FIELD_LABELS = {
    customer_name: 'Khách hàng',
    recipient_name: 'Người nhận',
    recipient_address: 'Địa chỉ',
    recipient_phone: 'SĐT',
    quantity: 'Số lượng',
    unit_price: 'Đơn giá',
    total_amount: 'Thành tiền',
    note: 'Ghi chú',
    order_type: 'Loại đơn',
    product_type: 'Loại hàng',
    department: 'Khoa',
    warehouse: 'Kho',
    promotion_code: 'Khuyến mãi',
    shipping_fee: 'Phí vận chuyển',
    delivery_unit: 'Đơn vị vận chuyển',
    status: 'Trạng thái'
};

export default function OrderHistoryTimeline({ orderId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!orderId) return;
        const fetchHistory = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('order_history')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });
            if (!error && data) setHistory(data);
            setLoading(false);
        };
        fetchHistory();
    }, [orderId]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="py-12 text-center">
                <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">Chưa có lịch sử thay đổi</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {history.map((item, idx) => {
                const config = ACTION_CONFIG[item.action] || ACTION_CONFIG.EDITED;
                const Icon = config.icon;
                const isLast = idx === history.length - 1;

                return (
                    <div key={item.id} className="flex gap-4">
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-xl bg-${config.color}-100 text-${config.color}-600 flex items-center justify-center shrink-0`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1"></div>}
                        </div>

                        {/* Content */}
                        <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-black text-sm text-slate-800">{config.label}</span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {formatDate(item.created_at)}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-500 mb-1">
                                bởi <span className="text-slate-700">{item.created_by}</span>
                            </p>

                            {/* Status change */}
                            {item.action === 'STATUS_CHANGED' && item.old_status && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase">{item.old_status}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black uppercase">{item.new_status}</span>
                                </div>
                            )}

                            {/* Changed fields */}
                            {item.action === 'EDITED' && item.changed_fields && (
                                <div className="mt-2 bg-slate-50 rounded-xl p-3 space-y-1.5">
                                    {Object.entries(item.changed_fields).map(([field, vals]) => (
                                        <div key={field} className="flex items-center gap-2 text-xs">
                                            <span className="font-bold text-slate-500 min-w-[100px]">{FIELD_LABELS[field] || field}:</span>
                                            <span className="text-red-400 line-through">{vals.old || '(trống)'}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="font-bold text-emerald-600">{vals.new || '(trống)'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reason */}
                            {item.reason && (
                                <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                    <p className="text-xs font-bold text-amber-700">
                                        💬 Lý do: <span className="font-medium text-amber-900">{item.reason}</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
