import {
    Activity,
    Box,
    ChevronDown,
    ChevronUp,
    Clock,
    Filter,
    History,
    MapPin,
    Package,
    Search,
    Shield,
    Truck,
    Warehouse,
    X,
    Image as ImageIcon,
    ExternalLink
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { supabase } from '../../supabase/config';

export default function WarehouseDetailsModal({ warehouse, onClose }) {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total_items: 0,
        active_orders: 0,
        recent_receipts: 0,
        available_capacity: 0
    });
    const [inventory, setInventory] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);
    const [showFullInventory, setShowFullInventory] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState('ALL');

    useEffect(() => {
        if (!warehouse) return;
        fetchWarehouseData();
    }, [warehouse]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => onClose(), 300);
    }, [onClose]);

    const warehouseKeys = [warehouse?.id, warehouse?.name].filter(Boolean);

    const getStatusClass = (status) => {
        const normalized = (status || '').toLowerCase();
        if (normalized === 'sẵn sàng') return "bg-emerald-500 text-white";
        if (normalized === 'đang vận chuyển') return "bg-blue-500 text-white";
        if (normalized === 'thuộc khách hàng') return "bg-indigo-500 text-white";
        if (normalized === 'bảo trì' || normalized === 'kiểm tra' || normalized === 'đang sửa') return "bg-amber-500 text-white";
        return "bg-slate-100 text-slate-600";
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'IN':
                return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'OUT':
                return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'TRANSFER':
                return 'bg-blue-50 text-blue-600 border-blue-200';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const fetchWarehouseData = async () => {
        setLoading(true);
        try {
            const { data: invData } = await supabase
                .from('cylinders')
                .select('*')
                .eq('warehouse_id', warehouse.id)
                .order('serial_number', { ascending: true });

            const { data: machinesData } = await supabase
                .from('machines')
                .select('id, serial_number, machine_type, status, warehouse')
                .in('warehouse', warehouseKeys);

            const [receiptsRes, issuesRes, inventoryRes] = await Promise.all([
                supabase
                    .from('goods_receipts')
                    .select('id, receipt_code, supplier_name, total_items, status, receipt_date, created_at')
                    .eq('warehouse_id', warehouse.id)
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('goods_issues')
                    .select('id, issue_code, issue_type, total_items, status, issue_date, created_at')
                    .eq('warehouse_id', warehouse.id)
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('inventory')
                    .select('id')
                    .eq('warehouse_id', warehouse.id)
            ]);

            const unifiedCylinders = (invData || []).map(cyl => ({
                ...cyl,
                uid: `cyl_${cyl.id}`,
                itemType: 'BINH',
                category: cyl.category || 'Vỏ bình',
                volume: cyl.volume || '—'
            }));

            const unifiedMachines = (machinesData || []).map(mac => ({
                ...mac,
                uid: `mac_${mac.id}`,
                itemType: 'MAY',
                category: 'Máy móc',
                volume: mac.machine_type || '—'
            }));

            const combinedInventory = [...unifiedCylinders, ...unifiedMachines].sort((a, b) => 
                (a.serial_number || '').localeCompare(b.serial_number || '')
            );

            setInventory(combinedInventory);
            const inventoryIds = (inventoryRes.data || []).map(item => item.id).filter(Boolean);
            let transferLogs = [];
            if (inventoryIds.length > 0) {
                const { data: txData } = await supabase
                    .from('inventory_transactions')
                    .select('id, reference_code, quantity_changed, note, created_at, transaction_type')
                    .in('inventory_id', inventoryIds)
                    .like('reference_code', 'TRF%')
                    .order('created_at', { ascending: false })
                    .limit(10);
                transferLogs = txData || [];
            }

            const mergedLogs = [
                ...((receiptsRes.data || []).map((receipt) => ({
                    id: `receipt-${receipt.id}`,
                    type: 'IN',
                    action: 'Nhập kho từ NCC',
                    code: receipt.receipt_code,
                    created_at: receipt.receipt_date || receipt.created_at,
                    description: `${receipt.supplier_name || 'Nhà cung cấp'} • ${receipt.total_items || 0} dòng hàng`,
                    status: receipt.status
                }))),
                ...((issuesRes.data || []).map((issue) => ({
                    id: `issue-${issue.id}`,
                    type: 'OUT',
                    action: 'Xuất kho',
                    code: issue.issue_code,
                    created_at: issue.issue_date || issue.created_at,
                    description: `${issue.issue_type || 'Phiếu xuất'} • ${issue.total_items || 0} dòng hàng`,
                    status: issue.status
                }))),
                ...(transferLogs.map((log) => ({
                    id: `transfer-${log.id}`,
                    type: 'TRANSFER',
                    action: 'Luân chuyển kho',
                    code: log.reference_code,
                    created_at: log.created_at,
                    description: log.note || `Điều chuyển ${log.quantity_changed || 0} đơn vị`,
                    status: log.transaction_type
                })))
            ]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 12);

            setRecentLogs(mergedLogs);

            // Calc Stats
            const cylinderCount = unifiedCylinders.length;
            const machineCount = unifiedMachines.length;
            const totalItems = cylinderCount + machineCount;
            const capacity = warehouse.capacity || 0;

            const inTransitCount = combinedInventory.filter(i => 
                i.status && i.status.toLowerCase() === 'đang vận chuyển'
            ).length;

            setStats({
                total_cylinders: cylinderCount,
                total_machines: machineCount,
                active_orders: 0, // Tính năng Yêu cầu chờ chưa có bảng map
                in_transit: inTransitCount,
                available_capacity: Math.max(0, capacity - totalItems)
            });

        } catch (error) {
            console.error('Error fetching warehouse data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredInventory = inventory.filter((item) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearch
            || item.serial_number?.toLowerCase().includes(normalizedSearch)
            || item.volume?.toLowerCase().includes(normalizedSearch)
            || item.category?.toLowerCase().includes(normalizedSearch);
        const matchesType = selectedType === 'ALL' || item.itemType === selectedType;
        const matchesStatus = selectedStatus === 'ALL' || (item.status || '').toLowerCase() === selectedStatus.toLowerCase();
        return matchesSearch && matchesType && matchesStatus;
    });

    const displayedInventory = showFullInventory ? filteredInventory : filteredInventory.slice(0, 5);

    const content = (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header Profile */}
            <div className="bg-white px-4 md:px-8 py-4 md:py-6 border-b border-slate-200 shrink-0 overflow-hidden sticky top-0 z-20">
                <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60 pointer-events-none"></div>

                <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-start md:items-center gap-3 md:gap-5 min-w-0">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/10 shrink-0">
                            <Warehouse className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-black mb-1 tracking-tight flex items-center gap-2 md:gap-3 truncate text-primary">
                                {warehouse.name || warehouse.warehouse_name || 'Kho hàng'}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold text-slate-500">
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {warehouse.location || '—'}</span>
                                <span className="flex items-center gap-1.5 text-primary"><Shield className="w-4 h-4 text-primary/60" /> {warehouse.status || 'Hoạt động'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 md:p-2.5 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shrink-0">
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                {/* Quick Stats */}
                {!loading && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10 w-full overflow-x-auto custom-scrollbar pb-2">
                        {[
                            { label: 'Tổng số bình', value: stats.total_cylinders, icon: Package, color: 'text-primary' },
                            { label: 'Tổng số máy', value: stats.total_machines, icon: Activity, color: 'text-violet-500' },
                            { label: 'Sức chứa còn', value: stats.available_capacity, icon: Box, color: 'text-emerald-500' },
                            { label: 'Yêu cầu chờ', value: stats.active_orders, icon: Clock, color: 'text-amber-500' },
                            { label: 'Đang vận chuyển', value: stats.in_transit, icon: Truck, color: 'text-blue-500' }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-white px-3 md:px-4 py-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group shrink-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <stat.icon className={clsx("w-3.5 h-3.5", stat.color)} />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{stat.label}</p>
                                </div>
                                <p className="font-black text-slate-800 text-lg md:text-xl">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col flex-1 items-center justify-center h-40 space-y-4 py-16">
                        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest italic">Đang tải dữ liệu kho...</p>
                    </div>
                ) : (
                    <div className="p-4 md:p-8 space-y-8">
                        {/* Current Inventory Section */}
                        <section>
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 min-w-0">
                                    <Box className="w-4 h-4 text-primary" />
                                    Tồn kho hiện tại ({filteredInventory.length})
                                </h3>
                                {filteredInventory.length > 5 && (
                                    <button
                                        onClick={() => setShowFullInventory(!showFullInventory)}
                                        className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        {showFullInventory ? (
                                            <><ChevronUp className="w-3.5 h-3.5" /> Thu gọn</>
                                        ) : (
                                            <><ChevronDown className="w-3.5 h-3.5" /> Xem tất cả</>
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className="mb-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_220px] gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Tìm kiếm serial, loại bình, máy..."
                                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                    />
                                </div>
                                <div className="relative">
                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                    >
                                        <option value="ALL">Tất cả loại</option>
                                        <option value="BINH">Bình</option>
                                        <option value="MAY">Máy</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <select
                                            value={selectedStatus}
                                            onChange={(e) => setSelectedStatus(e.target.value)}
                                            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40"
                                        >
                                            <option value="ALL">Tất cả trạng thái</option>
                                            <option value="sẵn sàng">Sẵn sàng</option>
                                            <option value="đang vận chuyển">Đang vận chuyển</option>
                                            <option value="thuộc khách hàng">Thuộc khách hàng</option>
                                            <option value="bảo trì">Bảo trì</option>
                                            <option value="kiểm tra">Kiểm tra</option>
                                            <option value="đang sửa">Đang sửa</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setSelectedType('ALL');
                                            setSelectedStatus('ALL');
                                        }}
                                        className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
                                        title="Xóa bộ lọc"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {filteredInventory.length === 0 ? (
                                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold">Không có dữ liệu phù hợp với bộ lọc</p>
                                </div>
                            ) : (
                                <div className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm shadow-slate-100">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                                    <th className="px-5 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Loại</th>
                                                    <th className="px-5 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Số hiệu / Serial</th>
                                                    <th className="px-5 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Kiểm định</th>
                                                    <th className="px-5 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {displayedInventory.map((item) => (
                                                    <tr key={item.uid} className="hover:bg-primary/[0.02] transition-colors group">
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-9 min-w-[40px] px-3 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[12px] group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                                                    {item.volume || '—'}
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.category || 'Vỏ bình'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            <span className="font-black text-slate-800 text-[14px]">{item.serial_number}</span>
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap text-center">
                                                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100/50">
                                                                OK
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 whitespace-nowrap text-right">
                                                            <span className={clsx(
                                                                "inline-flex px-3 py-1 rounded-full text-[10px] font-black tracking-wide shadow-sm",
                                                                getStatusClass(item.status)
                                                            )}>
                                                                {item.status?.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Recent Activity Section */}
                        <section>
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <History className="w-4 h-4 text-emerald-500" />
                                Hoạt động gần đây
                            </h3>
                            <div className="space-y-4">
                                {recentLogs.length === 0 ? (
                                    <div className="p-10 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50">
                                        <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-slate-400 font-bold text-xs uppercase">Chưa có hoạt động</p>
                                    </div>
                                ) : (
                                    recentLogs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-4 relative group">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all">
                                                <Activity className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md group-hover:border-primary/20 transition-all">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 truncate">{log.action || 'Di chuyển bình'}</p>
                                                        <span className={clsx("shrink-0 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider", getLogColor(log.type))}>
                                                            {log.code || log.type}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{formatDate(log.created_at)}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-500">{log.description || `Bình ${log.serial_number} được xử lý tại kho`}</p>
                                                
                                                {log.image_url && (
                                                    <div className="mt-2 pt-2 border-t border-slate-50">
                                                        <a 
                                                            href={log.image_url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all border border-emerald-100/50"
                                                        >
                                                            <ImageIcon size={12} />
                                                            <span className="text-[10px] font-black uppercase">Ảnh bàn giao</span>
                                                            <ExternalLink size={10} />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
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
