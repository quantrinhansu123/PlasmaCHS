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
    const [selectedLogDetail, setSelectedLogDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

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
            case 'ORDER_OUT':
                return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'RECOVERY_IN':
                return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const parseTransferDestination = (note = '') => {
        const match = note.match(/đến\s+(.+?)(?:\.|$)/i);
        return match?.[1]?.trim() || '—';
    };

    const handleOpenLogDetail = async (log) => {
        if (!log?.rawId) return;
        setDetailLoading(true);
        try {
            if (log.type === 'IN') {
                const [{ data: receipt }, { data: items }] = await Promise.all([
                    supabase
                        .from('goods_receipts')
                        .select('*')
                        .eq('id', log.rawId)
                        .single(),
                    supabase
                        .from('goods_receipt_items')
                        .select('*')
                        .eq('receipt_id', log.rawId)
                ]);
                setSelectedLogDetail({
                    type: 'IN',
                    title: 'Chi tiết phiếu nhập kho',
                    code: receipt?.receipt_code || log.code,
                    date: receipt?.receipt_date || receipt?.created_at || log.created_at,
                    fields: [
                        { label: 'Nhà cung cấp', value: receipt?.supplier_name || '—' },
                        { label: 'Kho nhận', value: warehouse?.name || '—' },
                        { label: 'Người giao', value: receipt?.deliverer_name || '—' },
                        { label: 'Người nhận', value: receipt?.received_by || '—' },
                        { label: 'Trạng thái', value: receipt?.status || '—' },
                    ],
                    note: receipt?.note || '',
                    items: (items || []).map(item => ({
                        name: item.item_name,
                        type: item.item_type,
                        quantity: item.quantity,
                        code: item.serial_number,
                        status: item.item_status
                    }))
                });
            } else if (log.type === 'OUT') {
                const [{ data: issue }, { data: items }, { data: suppliers }] = await Promise.all([
                    supabase
                        .from('goods_issues')
                        .select('*')
                        .eq('id', log.rawId)
                        .single(),
                    supabase
                        .from('goods_issue_items')
                        .select('*')
                        .eq('issue_id', log.rawId),
                    supabase.from('suppliers').select('id, name')
                ]);
                const supplierName = suppliers?.find(s => s.id === issue?.supplier_id)?.name || '—';
                setSelectedLogDetail({
                    type: 'OUT',
                    title: 'Chi tiết phiếu xuất kho',
                    code: issue?.issue_code || log.code,
                    date: issue?.issue_date || issue?.created_at || log.created_at,
                    fields: [
                        { label: 'Loại phiếu', value: issue?.issue_type || '—' },
                        { label: 'Kho xuất', value: warehouse?.name || '—' },
                        { label: 'Nhà cung cấp', value: supplierName },
                        { label: 'Trạng thái', value: issue?.status || '—' },
                    ],
                    note: issue?.notes || '',
                    items: (items || []).map(item => ({
                        name: item.item_name || item.item_type,
                        type: item.item_type,
                        quantity: item.quantity,
                        code: item.item_code,
                        status: ''
                    }))
                });
            } else if (log.type === 'ORDER_OUT' || log.type === 'RECOVERY_IN') {
                const { data: tx } = await supabase
                    .from('inventory_transactions')
                    .select('id, inventory_id, reference_code, quantity_changed, note, created_at, transaction_type')
                    .eq('id', log.rawId)
                    .maybeSingle();

                if (!tx) return;

                const { data: inv } = await supabase
                    .from('inventory')
                    .select('item_name, item_type, warehouse_id')
                    .eq('id', tx.inventory_id)
                    .maybeSingle();

                const { data: allWh } = await supabase.from('warehouses').select('id, name');
                const whMap = Object.fromEntries((allWh || []).map(row => [row.id, row.name]));
                const logType = tx.transaction_type === 'OUT' ? 'ORDER_OUT' : 'RECOVERY_IN';

                setSelectedLogDetail({
                    type: logType,
                    title: tx.transaction_type === 'OUT' ? 'Chi tiết xuất bán từ kho' : 'Chi tiết thu hồi về kho',
                    code: tx.reference_code || log.code,
                    date: tx.created_at || log.created_at,
                    fields: [
                        { label: tx.transaction_type === 'OUT' ? 'Kho xuất' : 'Kho nhận', value: whMap[inv?.warehouse_id] || inv?.warehouse_id || warehouse?.name || '—' },
                        { label: 'Loại hàng', value: inv?.item_type || '—' },
                        { label: 'Số lượng', value: String(tx.quantity_changed || 0) }
                    ],
                    note: tx.note || '',
                    items: [{
                        name: inv?.item_name || 'Hàng hóa',
                        type: inv?.item_type || '—',
                        quantity: tx.quantity_changed || 0,
                        code: '',
                        status: tx.transaction_type
                    }]
                });
            } else if (log.type === 'TRANSFER') {
                const [{ data: txRows }, { data: warehouseRows }] = await Promise.all([
                    supabase
                        .from('inventory_transactions')
                        .select('id, inventory_id, reference_code, quantity_changed, note, created_at, transaction_type')
                        .eq('reference_code', log.code)
                        .order('created_at', { ascending: true }),
                    supabase.from('warehouses').select('id, name')
                ]);
                const inventoryIds = [...new Set((txRows || []).map(row => row.inventory_id).filter(Boolean))];
                const { data: inventoryRows } = await supabase
                    .from('inventory')
                    .select('id, item_name, item_type, warehouse_id')
                    .in('id', inventoryIds.length > 0 ? inventoryIds : ['00000000-0000-0000-0000-000000000000']);
                const invMap = Object.fromEntries((inventoryRows || []).map(row => [row.id, row]));
                const whMap = Object.fromEntries((warehouseRows || []).map(row => [row.id, row.name]));
                const items = (txRows || [])
                    .filter(row => row.transaction_type === 'OUT')
                    .map(row => {
                        const inv = invMap[row.inventory_id] || {};
                        return {
                            name: inv.item_name || 'Hàng hóa',
                            type: inv.item_type || '—',
                            quantity: row.quantity_changed,
                            code: '',
                            status: whMap[inv.warehouse_id] || inv.warehouse_id || '—'
                        };
                    });
                const firstNote = txRows?.[0]?.note || '';
                setSelectedLogDetail({
                    type: 'TRANSFER',
                    title: 'Chi tiết phiếu luân chuyển',
                    code: log.code,
                    date: txRows?.[0]?.created_at || log.created_at,
                    fields: [
                        { label: 'Kho xuất', value: warehouse?.name || '—' },
                        { label: 'Kho nhận', value: parseTransferDestination(firstNote) },
                        { label: 'Số dòng', value: String(items.length) },
                    ],
                    note: firstNote,
                    items
                });
            }
        } catch (error) {
            console.error('Error loading warehouse activity detail:', error);
        } finally {
            setDetailLoading(false);
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
            let movementLogs = [];
            if (inventoryIds.length > 0) {
                const { data: txData } = await supabase
                    .from('inventory_transactions')
                    .select('id, reference_code, quantity_changed, note, created_at, transaction_type')
                    .in('inventory_id', inventoryIds)
                    .like('reference_code', 'TRF%')
                    .order('created_at', { ascending: false })
                    .limit(10);
                transferLogs = txData || [];

                const { data: movementData } = await supabase
                    .from('inventory_transactions')
                    .select('id, reference_code, quantity_changed, note, created_at, transaction_type')
                    .in('inventory_id', inventoryIds)
                    .not('reference_code', 'like', 'TRF%')
                    .order('created_at', { ascending: false })
                    .limit(20);
                movementLogs = movementData || [];
            }

            const mergedLogs = [
                ...((receiptsRes.data || []).map((receipt) => ({
                    id: `receipt-${receipt.id}`,
                    rawId: receipt.id,
                    type: 'IN',
                    action: 'Nhập kho từ NCC',
                    code: receipt.receipt_code,
                    created_at: receipt.receipt_date || receipt.created_at,
                    description: `${receipt.supplier_name || 'Nhà cung cấp'} • ${receipt.total_items || 0} dòng hàng`,
                    status: receipt.status
                }))),
                ...((issuesRes.data || []).map((issue) => ({
                    id: `issue-${issue.id}`,
                    rawId: issue.id,
                    type: 'OUT',
                    action: 'Xuất kho',
                    code: issue.issue_code,
                    created_at: issue.issue_date || issue.created_at,
                    description: `${issue.issue_type || 'Phiếu xuất'} • ${issue.total_items || 0} dòng hàng`,
                    status: issue.status
                }))),
                ...(transferLogs.map((log) => ({
                    id: `transfer-${log.id}`,
                    rawId: log.id,
                    type: 'TRANSFER',
                    action: 'Luân chuyển kho',
                    code: log.reference_code,
                    created_at: log.created_at,
                    description: log.note || `Điều chuyển ${log.quantity_changed || 0} đơn vị`,
                    status: log.transaction_type
                }))),
                ...(movementLogs.map((log) => {
                    const isRecovery = log.transaction_type === 'IN' && (log.note || '').toLowerCase().includes('thu hồi vỏ');
                    const isOrderOut = log.transaction_type === 'OUT';
                    return {
                        id: `movement-${log.id}`,
                        rawId: log.id,
                        type: isRecovery ? 'RECOVERY_IN' : (isOrderOut ? 'ORDER_OUT' : log.transaction_type),
                        action: isRecovery ? 'Thu hồi vỏ về kho' : (isOrderOut ? 'Xuất bán từ kho' : 'Biến động kho'),
                        code: log.reference_code,
                        created_at: log.created_at,
                        description: log.note || `${log.transaction_type === 'IN' ? 'Nhập kho' : 'Xuất kho'} ${log.quantity_changed || 0} đơn vị`,
                        status: log.transaction_type
                    };
                }))
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
                            { label: 'Tổng máy (mọi trạng thái)', value: stats.total_machines, icon: Activity, color: 'text-violet-500' },
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
                                    Tồn kho theo bộ lọc ({filteredInventory.length}/{inventory.length})
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

                            <p className="mb-5 text-xs font-semibold text-slate-500">
                                Hiển thị theo bộ lọc: loại <span className="text-slate-700">{selectedType === 'ALL' ? 'Tất cả' : selectedType === 'MAY' ? 'Máy' : 'Bình'}</span>, trạng thái <span className="text-slate-700">{selectedStatus === 'ALL' ? 'Tất cả' : selectedStatus}</span>.
                            </p>

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
                            <div className="rounded-[1.75rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
                                {recentLogs.length === 0 ? (
                                    <div className="p-10 text-center bg-white/50">
                                        <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-slate-400 font-bold text-xs uppercase">Chưa có hoạt động</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/80 border-b border-slate-200">
                                                    <th className="px-5 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Loại</th>
                                                    <th className="px-5 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã phiếu</th>
                                                    <th className="px-5 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Nội dung</th>
                                                    <th className="px-5 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Thời gian</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {recentLogs.map((log) => (
                                                    <tr
                                                        key={log.id}
                                                        onClick={() => handleOpenLogDetail(log)}
                                                        className="group cursor-pointer hover:bg-slate-50/80 transition-colors"
                                                    >
                                                        <td className="px-5 py-4 align-top">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all shrink-0">
                                                                    <Activity className="w-4 h-4" />
                                                                </div>
                                                                <span className="text-[13px] font-black text-slate-800 leading-tight">
                                                                    {log.action || 'Di chuyển bình'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 align-top whitespace-nowrap">
                                                            <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider", getLogColor(log.type))}>
                                                                {log.code || log.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-4 align-top">
                                                            <div className="space-y-2">
                                                                <p className="text-[13px] font-semibold text-slate-600 leading-relaxed break-words">
                                                                    {log.description || `Bình ${log.serial_number} được xử lý tại kho`}
                                                                </p>
                                                                {log.image_url && (
                                                                    <a
                                                                        href={log.image_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100/50 text-[11px] font-black"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <ImageIcon size={12} />
                                                                        <span>Ảnh bàn giao</span>
                                                                        <ExternalLink size={10} />
                                                                    </a>
                                                                )}
                                                                <p className="text-[11px] font-bold text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    Bấm để xem chi tiết
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                                                            <span className="text-[12px] font-black text-slate-400">
                                                                {formatDate(log.created_at)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </div>
            {selectedLogDetail && (
                <div className="absolute inset-0 z-30 bg-white flex flex-col">
                    <div className="px-4 md:px-8 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-slate-900">{selectedLogDetail.title}</h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">Mã phiếu: {selectedLogDetail.code}</p>
                        </div>
                        <button onClick={() => setSelectedLogDetail(null)} className="p-2 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-50">
                        {detailLoading ? (
                            <div className="py-16 text-center text-slate-400 font-bold">Đang tải chi tiết...</div>
                        ) : (
                            <>
                                <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black text-slate-400 uppercase">Ngày tạo</p>
                                            <p className="text-sm font-bold text-slate-800">{formatDate(selectedLogDetail.date)}</p>
                                        </div>
                                        {selectedLogDetail.fields.map((field) => (
                                            <div key={field.label} className="space-y-1">
                                                <p className="text-[11px] font-black text-slate-400 uppercase">{field.label}</p>
                                                <p className="text-sm font-bold text-slate-800">{field.value || '—'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm">
                                    <h4 className="text-base font-black text-slate-900 mb-4">Danh sách hàng hóa</h4>
                                    <div className="space-y-3">
                                        {(selectedLogDetail.items || []).length === 0 ? (
                                            <div className="text-sm font-bold text-slate-400">Không có dữ liệu hàng hóa.</div>
                                        ) : selectedLogDetail.items.map((item, idx) => (
                                            <div key={`${selectedLogDetail.code}-${idx}`} className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800">{item.name || '—'}</p>
                                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                                            {item.type || '—'}{item.code ? ` • ${item.code}` : ''}{item.status ? ` • ${item.status}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className="text-sm font-black text-primary">x {item.quantity || 0}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-sm">
                                    <h4 className="text-base font-black text-slate-900 mb-3">Ghi chú</h4>
                                    <p className="text-sm font-semibold text-slate-600 whitespace-pre-wrap">{selectedLogDetail.note || '—'}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
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
