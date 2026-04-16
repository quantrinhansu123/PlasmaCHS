import {
    Activity,
    ActivitySquare,
    Building2,
    ChevronDown,
    ChevronUp,
    LogIn,
    LogOut,
    MapPin,
    Package,
    Truck,
    Users,
    Warehouse,
    X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { supabase } from '../../supabase/config';

export default function CylinderDetailsModal({ cylinder, onClose }) {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [storageHistory, setStorageHistory] = useState([]);
    const [showFullTimeline, setShowFullTimeline] = useState(false);
    const [qcData, setQcData] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [warehouseName, setWarehouseName] = useState(cylinder?.warehouses?.name || null);

    const resolveWarehouseName = useCallback((warehouseValue, warehouseMap = {}) => {
        if (!warehouseValue) return '—';
        return warehouseMap[warehouseValue] || warehouseValue;
    }, []);

    useEffect(() => {
        if (!cylinder) return;
        setWarehouseName(cylinder.warehouses?.name || null);
        fetchAllHistory();
        // Resolve warehouse name if not available from join
        if (!cylinder.warehouses?.name && cylinder.warehouse_id) {
            supabase.from('warehouses').select('name').eq('id', cylinder.warehouse_id).maybeSingle()
                .then(({ data }) => { if (data) setWarehouseName(data.name); });
        }
    }, [cylinder]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    }, [onClose]);

    const fetchAllHistory = async () => {
        setLoading(true);
        try {
            // 0. Fetch warehouse lookup for resolving UUIDs to names
            const { data: warehouseList } = await supabase.from('warehouses').select('id, name');
            const warehouseMap = {};
            (warehouseList || []).forEach(w => { warehouseMap[w.id] = w.name; });

            // 1. Orders (giao cho khách / thu hồi / điều chuyển)
            const { data: orderData } = await supabase
                .from('orders')
                .select('*')
                .contains('assigned_cylinders', [cylinder.serial_number])
                .order('created_at', { ascending: false });

            setOrders(orderData || []);

            // 2. Goods Receipts (nhập từ NCC về kho)
            const { data: receiptItems } = await supabase
                .from('goods_receipt_items')
                .select('*, goods_receipts!inner(receipt_code, supplier_name, warehouse_id, receipt_date, status)')
                .eq('serial_number', cylinder.serial_number);

            // 3. Goods Issues (xuất trả về NCC)
            const { data: issueItems } = await supabase
                .from('goods_issue_items')
                .select('*, goods_issues!inner(issue_code, supplier_id, warehouse_id, issue_date, status)')
                .eq('item_code', cylinder.serial_number);

            // 4. QC Data
            const { data: qcDataRes } = await supabase
                .from('cylinder_qc_records')
                .select('*')
                .eq('serial_number', cylinder.serial_number)
                .maybeSingle();

            if (qcDataRes) {
                setQcData(qcDataRes);
            } else {
                setQcData(null);
            }

            // Build unified timeline
            const events = [];

            // From orders
            (orderData || []).forEach(o => {
                const type = o.order_type?.toLowerCase() || '';
                const isOutgoing = type.includes('thuê') || type.includes('bán') || type.includes('giao') || type.includes('xuất') || type.includes('thuong');
                const isInternal = o.customer_name === 'Vỏ bình' || type.includes('điều chuyển') || type.includes('thay đổi kho') || type.includes('nội bộ') || type.includes('kho sang kho');
                const isReturn = type.includes('thu hồi') || type.includes('trả') || type.includes('nhập');

                // Map raw order_type ID to Friendly Label
                let typeLabel = getOrderTypeLabel(o.order_type);

                let eventLabel = typeLabel || 'Thu hồi về kho';
                let eventIcon = 'incoming';
                let eventColor = 'teal';
                let eventType = 'THU_HOI';
                const orderWarehouseName = resolveWarehouseName(o.warehouse, warehouseMap);
                let location = o.customer_name || 'Khách hàng';

                if (isOutgoing) {
                    eventLabel = typeLabel || 'Giao cho khách';
                    eventIcon = 'outgoing';
                    eventColor = 'rose';
                    eventType = 'GIAO_KHACH';
                    location = `${orderWarehouseName} → ${o.customer_name || 'Khách hàng'}`;
                } else if (isInternal) {
                    eventLabel = 'Điều chuyển nội bộ';
                    eventIcon = 'warehouse';
                    eventColor = 'blue';
                    eventType = 'DIEU_CHUYEN';
                    location = `${orderWarehouseName} → Kho nhận`;
                } else if (isReturn) {
                    eventLabel = typeLabel || 'Thu hồi về kho';
                    eventIcon = 'incoming';
                    eventColor = 'teal';
                    eventType = 'THU_HOI';
                    location = `${o.customer_name || 'Khách'} → ${orderWarehouseName}`;
                }

                events.push({
                    date: o.created_at,
                    type: eventType,
                    label: eventLabel,
                    location: location,
                    rawLocation: isOutgoing || isInternal ? orderWarehouseName : (o.customer_name || orderWarehouseName || 'Không xác định'),
                    code: o.order_code,
                    status: o.status,
                    icon: eventIcon,
                    color: eventColor,
                    source: 'order'
                });
            });

            // From goods receipts
            (receiptItems || []).forEach(ri => {
                const r = ri.goods_receipts;
                const whName = resolveWarehouseName(r.warehouse_id, warehouseMap);
                events.push({
                    date: r.receipt_date || ri.created_at,
                    type: 'NHAP_KHO',
                    label: 'Nhập kho từ NCC',
                    location: `NCC ${r.supplier_name} → Kho ${whName}`,
                    rawLocation: `Kho ${whName}`,
                    code: r.receipt_code,
                    status: r.status,
                    icon: 'supplier',
                    color: 'emerald',
                    source: 'receipt'
                });
            });

            // From goods issues
            (issueItems || []).forEach(ii => {
                const gi = ii.goods_issues;
                const whName = resolveWarehouseName(gi.warehouse_id, warehouseMap);
                events.push({
                    date: gi.issue_date || ii.created_at,
                    type: 'TRA_NCC',
                    label: 'Trả về NCC',
                    location: `Kho ${whName} → NCC`,
                    rawLocation: 'NCC',
                    code: gi.issue_code,
                    status: gi.status,
                    icon: 'supplier',
                    color: 'amber',
                    source: 'issue'
                });
            });

            // Sort by date descending (newest first)
            events.sort((a, b) => new Date(b.date) - new Date(a.date));
            setTimeline(events);

            // Calculate Storage History (Top 3 unique locations)
            const distinctLocations = [];
            events.forEach(e => {
                const loc = e.rawLocation;
                if (loc && !distinctLocations.includes(loc) && distinctLocations.length < 3) {
                    distinctLocations.push(loc);
                }
            });
            setStorageHistory(distinctLocations);

        } catch (error) {
            console.error('Error fetching cylinder lifecycle:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('vi-VN');
    };

    const getStatusStyle = (status) => {
        if (['DA_DUYET', 'HOAN_THANH'].includes(status)) return 'bg-emerald-50 text-emerald-600 border-emerald-200';
        if (['HUY_DON', 'DOI_SOAT_THAT_BAI', 'HUY'].includes(status)) return 'bg-rose-50 text-rose-600 border-rose-200';
        return 'bg-amber-50 text-amber-600 border-amber-200';
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'CHO_DUYET': return 'Chờ duyệt';
            case 'CHO_CTY_DUYET': return 'Chờ Cty duyệt';
            case 'KHO_XU_LY': return 'Kho đang xử lý';
            case 'DA_DUYET': return 'Đã xuất kho';
            case 'CHO_GIAO_HANG': return 'Chờ giao hàng';
            case 'DANG_GIAO_HANG': return 'Đang giao';
            case 'CHO_DOI_SOAT': return 'Chờ đối soát';
            case 'HOAN_THANH': return 'Hoàn thành';
            case 'HUY_DON': return 'Đã hủy';
            case 'DOI_SOAT_THAT_BAI': return 'Lỗi đối soát';
            case 'DIEU_CHINH': return 'Cần điều chỉnh';
            default: return status || '—';
        }
    };

    const getOrderTypeLabel = (type) => {
        if (!type) return '—';
        const t = type.toUpperCase();
        switch (t) {
            case 'THUONG': return 'Đơn bán / Thuê';
            case 'DEMO': return 'Đơn dùng thử (Demo)';
            case 'NGOAI_GIAO': return 'Đơn ngoại giao';
            case 'NGHIEN_CUU': return 'Đơn nghiên cứu';
            default: return type;
        }
    };

    const getEventIcon = (iconType) => {
        switch (iconType) {
            case 'outgoing': return <Users className="w-4 h-4" />;
            case 'incoming': return <LogIn className="w-4 h-4" />;
            case 'warehouse': return <Warehouse className="w-4 h-4" />;
            case 'supplier': return <Building2 className="w-4 h-4" />;
            default: return <MapPin className="w-4 h-4" />;
        }
    };

    const colorMap = {
        rose: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', iconBg: 'bg-rose-100' },
        teal: { dot: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', iconBg: 'bg-teal-100' },
        emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', iconBg: 'bg-emerald-100' },
        amber: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', iconBg: 'bg-amber-100' },
        blue: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', iconBg: 'bg-blue-100' }
    };

    const displayedTimeline = showFullTimeline ? timeline : timeline.slice(0, 3);

    const content = (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header Profile */}
            <div className="bg-white px-4 md:px-8 py-4 md:py-6 border-b border-slate-200 shrink-0 overflow-hidden sticky top-0 z-20">
                <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-start md:items-center gap-3 md:gap-5 min-w-0">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/10 shrink-0">
                            <ActivitySquare className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-1 tracking-tight flex items-center gap-2 md:gap-3 truncate">
                                Vỏ bình {cylinder.serial_number}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-slate-500">
                                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-slate-400" /> {cylinder.volume || '—'}</span>
                                {cylinder.category && <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{cylinder.category}</span>}
                                {cylinder.cylinder_code && <span className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md">Mã khắc: {cylinder.cylinder_code}</span>}
                                <span className="flex items-center gap-1.5 text-primary">
                                    <Activity className="w-4 h-4 text-primary/60" /> 
                                    {cylinder.status ? (cylinder.status.charAt(0).toUpperCase() + cylinder.status.slice(1)) : '—'}
                                </span>
                                <span className="flex items-center gap-1.5 text-indigo-600">
                                    <MapPin className="w-4 h-4 text-indigo-400" />
                                    {(() => {
                                        const status = cylinder.status;
                                        if (['thuộc khách hàng', 'đang sử dụng', 'đã sử dụng'].includes(status)) {
                                            return cylinder.customers?.name || cylinder.customer_name?.split(' / ')[0] || '—';
                                        }
                                        if (status === 'đang vận chuyển') return '—';
                                        if (['sẵn sàng', 'bình rỗng', 'chờ nạp', 'hỏng'].includes(status)) {
                                            return warehouseName || cylinder.warehouses?.name || '—';
                                        }
                                        return cylinder.customer_name?.split(' / ')[1] || '—';
                                    })()}
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-500">
                                    <Warehouse className="w-4 h-4 text-slate-400" />
                                    {warehouseName || cylinder.warehouses?.name || '—'}
                                </span>
                                {cylinder.expiry_date && <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 italic">Hạn: {formatDate(cylinder.expiry_date)}</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                {/* Top 3 Storage History */}
                {!loading && storageHistory.length > 0 && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative z-10 shadow-sm">
                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <MapPin className="w-3 h-3" /> 3 Nơi lưu trữ mới nhất
                        </p>
                        <div className="flex items-center gap-2 md:gap-4">
                            {storageHistory.map((loc, idx) => (
                                <div key={idx} className="flex items-center gap-2 md:gap-4 flex-1">
                                    <div className="bg-white px-3 md:px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm grow min-w-0 hover:border-primary/30 transition-all">
                                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">Vị trí {idx + 1}</p>
                                        <p className="font-black text-slate-800 text-xs md:text-sm truncate">{loc}</p>
                                    </div>
                                    {idx < storageHistory.length - 1 && (
                                        <span className="text-slate-300 font-black">←</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col flex-1 items-center justify-center h-40 space-y-4 py-16">
                        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest italic">Đang tải lịch sử luân chuyển...</p>
                    </div>
                ) : (
                    <>
                        {/* Timeline Section - Vòng đời bình */}
                        <div className="px-4 md:px-8 pt-6 md:pt-8 pb-4">
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 min-w-0">
                                    <Truck className="w-4 h-4 text-slate-400" />
                                    <span className="truncate">Vòng đời — {timeline.length} sự kiện</span>
                                </h3>
                                {timeline.length > 3 && (
                                    <button
                                        onClick={() => setShowFullTimeline(!showFullTimeline)}
                                        className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary px-2.5 md:px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        {showFullTimeline ? (
                                            <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                                        ) : (
                                            <><ChevronDown className="w-3.5 h-3.5" /> Xem tất cả ({timeline.length})</>
                                        )}
                                    </button>
                                )}
                            </div>

                            {timeline.length === 0 ? (
                                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white shadow-sm transition-all hover:border-primary/20">
                                    <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-400 font-bold text-sm">Chưa có lịch sử luân chuyển nào</p>
                                </div>
                            ) : (
                                <div className="space-y-0 relative">
                                    {/* Vertical line */}
                                    <div className="absolute left-[15px] md:left-[19px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

                                    {displayedTimeline.map((event, idx) => {
                                        const c = colorMap[event.color] || colorMap.teal;
                                        return (
                                            <div key={idx} className="flex items-start gap-3 md:gap-4 relative group">
                                                {/* Dot */}
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${c.iconBg} ${c.text} flex items-center justify-center shrink-0 z-10 shadow-sm border ${c.border} transition-all group-hover:scale-110 group-hover:shadow-md`}>
                                                    {getEventIcon(event.icon)}
                                                </div>

                                                {/* Content */}
                                                <div className={`flex-1 pb-6`}>
                                                    <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group-hover:border-primary/20">
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${c.text}`}>{event.label}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{formatDate(event.date)}</span>
                                                        </div>
                                                        <h4 className="font-black text-slate-800 text-sm md:text-base mb-2 tracking-tight">{event.location}</h4>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{event.code}</span>
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${getStatusStyle(event.status)}`}>{getStatusLabel(event.status)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!showFullTimeline && timeline.length > 3 && (
                                        <div className="flex items-center gap-4 pl-8 md:pl-10 pt-1">
                                            <p className="text-xs font-bold text-slate-400 italic">
                                                ...và {timeline.length - 3} sự kiện trước đó
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* QC Metadata Section */}
                        {qcData && (
                            <div className="px-4 md:px-8 py-6 bg-white border-y border-slate-100">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-5">
                                    <ActivitySquare className="w-4 h-4 text-primary" />
                                    Thông số kỹ thuật & Kiểm định
                                </h3>
                                <div className="bg-primary/[0.03] border border-primary/10 rounded-2xl p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Trọng lượng (kg)</p>
                                        <p className="font-black text-primary text-lg">{qcData.empty_weight}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Dung tích (L)</p>
                                        <p className="font-black text-primary text-lg">{qcData.water_capacity}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Thời điểm Test</p>
                                        <p className="font-black text-slate-700 text-xs md:text-sm">{qcData.hold_time || '—'}</p>
                                    </div>
                                    <div className="hover:scale-105 transition-transform duration-200">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Kết luận</p>
                                        <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-[10px] font-black inline-block border border-primary/20 shadow-sm">
                                            {qcData.conclusion || 'ĐẠT (OK)'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Summary Columns */}
                        <div className="flex flex-col md:flex-row bg-slate-50/50">
                            {/* Đơn Giao / Cho Thuê */}
                            <div className="flex-1 p-5 md:p-8 md:border-r border-slate-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-primary flex items-center justify-center shadow-sm">
                                        <LogOut className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Đơn giao / cho thuê</h3>
                                </div>
                                <div className="space-y-4">
                                    {orders.filter(o => {
                                        const t = o.order_type?.toLowerCase() || '';
                                        return t.includes('thuê') || t.includes('bán') || t.includes('giao') || t.includes('xuất');
                                    }).length === 0 ? (
                                        <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
                                            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Chưa có dữ liệu</p>
                                        </div>
                                    ) : (
                                        orders.filter(o => {
                                            const t = o.order_type?.toLowerCase() || '';
                                            return t.includes('thuê') || t.includes('bán') || t.includes('giao') || t.includes('xuất');
                                        }).map(o => (
                                            <div key={o.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group overflow-hidden hover:border-primary/20">
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-60"></div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase border border-slate-200">{o.order_code}</span>
                                                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusStyle(o.status)}`}>{getStatusLabel(o.status)}</span>
                                                </div>
                                                <h4 className="font-black text-slate-800 text-sm mb-1 truncate">{o.customer_name}</h4>
                                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{getOrderTypeLabel(o.order_type) || 'Đơn xuất'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2">{formatDate(o.created_at)}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Đơn Nhập / Thu Hồi / Điều Chuyển */}
                            <div className="flex-1 p-5 md:p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shadow-sm">
                                        <LogIn className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Đơn nhập / thu hồi</h3>
                                </div>
                                <div className="space-y-4">
                                    {orders.filter(o => {
                                        const t = o.order_type?.toLowerCase() || '';
                                        return t.includes('thu hồi') || t.includes('trả') || t.includes('nhập') || t.includes('điều chuyển') || t.includes('kho') || o.customer_name === 'Vỏ bình';
                                    }).length === 0 ? (
                                        <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
                                            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Chưa có dữ liệu</p>
                                        </div>
                                    ) : (
                                        orders.filter(o => {
                                            const t = o.order_type?.toLowerCase() || '';
                                            return t.includes('thu hồi') || t.includes('trả') || t.includes('nhập') || t.includes('điều chuyển') || t.includes('kho') || o.customer_name === 'Vỏ bình';
                                        }).map(o => {
                                            const t = o.order_type?.toLowerCase() || '';
                                            const isInternal = o.customer_name === 'Vỏ bình' || t.includes('kho') || t.includes('điều chuyển');
                                            return (
                                                <div key={o.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group overflow-hidden hover:border-teal-200">
                                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isInternal ? 'bg-blue-400' : 'bg-teal-400'} opacity-60`}></div>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase border border-slate-200">{o.order_code}</span>
                                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusStyle(o.status)}`}>{getStatusLabel(o.status)}</span>
                                                    </div>
                                                    <h4 className="font-black text-slate-800 text-sm mb-1 truncate">{isInternal ? 'Lưu chuyển nội bộ' : o.customer_name}</h4>
                                                    <p className={`text-[10px] font-bold ${isInternal ? 'text-blue-500' : 'text-teal-500'} uppercase tracking-widest`}>{getOrderTypeLabel(o.order_type) || 'Đơn nhập'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-2">{formatDate(o.created_at)}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            {/* Backdrop */}
            <div 
                className={clsx(
                    "absolute inset-0 bg-black/45 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Panel */}
            <div 
                className={clsx(
                    "relative bg-white shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </div>
        </div>,
        document.body
    );
}
