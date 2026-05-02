import { clsx } from 'clsx';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import {
    ChevronLeft,
    ChevronDown,
    List,
    Search,
    X,
    BarChart2,
    ImageIcon,
    Camera,
    Eye,
    Package,
    Truck,
    User,
    Recycle,
    ArrowLeftRight,
    Trash2,
    LayoutGrid,
    MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../supabase/config';
import OrderStatusUpdater from '../components/Orders/OrderStatusUpdater';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import MobilePagination from '../components/layout/MobilePagination';

// Delivery type constants
const DELIVERY_TYPES = [
    { id: 'GIAO_HANG', label: 'Giao hàng', colorCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Truck },
    { id: 'THU_HOI_VO', label: 'Thu hồi vỏ', colorCls: 'bg-amber-50 text-amber-700 border-amber-200', icon: Recycle },
    { id: 'LUAN_CHUYEN', label: 'Luân chuyển', colorCls: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowLeftRight },
];

const getTypeInfo = (type) => DELIVERY_TYPES.find(d => d.id === type) || DELIVERY_TYPES[0];

const rowKey = (r) => `${r.type}::${r.id}`;

function parseRowKey(key) {
    const idx = String(key).indexOf('::');
    if (idx === -1) return null;
    return { type: key.slice(0, idx), id: key.slice(idx + 2) };
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export default function DeliveryHistory() {
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');

    // Mobile filter sheet state
    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingTypes, setPendingTypes] = useState([]);
    const [pendingDateRange, setPendingDateRange] = useState({ start_date: '', end_date: '' });

    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [orderToView, setOrderToView] = useState(null);
    const [activeView, setActiveView] = useState('list');
    const [previewImages, setPreviewImages] = useState(null);

    // Lookup maps
    const [customerMap, setCustomerMap] = useState({});
    const [warehouseMap, setWarehouseMap] = useState({});

    /** Chọn nhiều để xóa — key dạng `GIAO_HANG::<uuid>` */
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const pageSelectAllRef = useRef(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const valid = new Set(records.map(rowKey));
        setSelectedRowKeys((prev) => prev.filter((k) => valid.has(k)));
    }, [records]);

    // Mobile filter handlers
    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingTypes(selectedTypes);
        setPendingDateRange({ start_date: fromDate, end_date: toDate });
        setShowMobileFilter(true);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedTypes(pendingTypes);
        setFromDate(pendingDateRange.start_date);
        setToDate(pendingDateRange.end_date);
        closeMobileFilter();
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch all 3 sources + lookup tables in parallel
            const [ordersRes, recoveriesRes, transfersRes, customersRes, warehousesRes] = await Promise.all([
                // 1. Delivery orders
                supabase.from('orders').select('*')
                    .or('delivery_unit.not.is.null,status.in.(CHO_GIAO_HANG,DANG_GIAO_HANG,CHO_DOI_SOAT,DOI_SOAT_THAT_BAI,HOAN_THANH,TRA_HANG)')
                    .order('created_at', { ascending: false }),
                // 2. Cylinder recoveries
                supabase.from('cylinder_recoveries').select('*')
                    .order('created_at', { ascending: false }),
                // 3. Inventory transfers (only OUT to avoid duplicates)
                supabase.from('inventory_transactions').select('*')
                    .eq('transaction_type', 'OUT')
                    .like('reference_code', 'TRF%')
                    .order('created_at', { ascending: false }),
                // Lookups
                supabase.from('customers').select('id, name'),
                supabase.from('warehouses').select('id, name'),
            ]);

            // Build lookup maps
            const custMap = {};
            (customersRes.data || []).forEach(c => { custMap[c.id] = c.name; });
            setCustomerMap(custMap);

            const whMap = {};
            (warehousesRes.data || []).forEach(w => { whMap[w.id] = w.name; });
            setWarehouseMap(whMap);

            // Normalize into unified records
            const unified = [];

            // -- Orders (Giao hàng)
            (ordersRes.data || []).forEach(o => {
                unified.push({
                    id: o.id,
                    type: 'GIAO_HANG',
                    code: o.order_code,
                    date: o.created_at,
                    customerName: o.customer_name || '—',
                    executor: o.delivery_unit || 'Chưa gán',
                    quantity: o.quantity || 0,
                    status: o.status,
                    statusLabel: getOrderStatusLabel(o.status),
                    statusCls: getOrderStatusCls(o.status),
                    images: getOrderImages(o),
                    shippingFee: o.shipping_fee,
                    note: o.note,
                    rawOrder: o,
                });
            });

            // -- Cylinder recoveries (Thu hồi vỏ)
            (recoveriesRes.data || []).forEach(r => {
                unified.push({
                    id: r.id,
                    type: 'THU_HOI_VO',
                    code: r.recovery_code,
                    date: r.created_at,
                    customerName: custMap[r.customer_id] || '—',
                    executor: r.driver_name || 'Chưa gán',
                    quantity: r.total_items || r.requested_quantity || 0,
                    status: r.status,
                    statusLabel: getRecoveryStatusLabel(r.status),
                    statusCls: getRecoveryStatusCls(r.status),
                    images: Array.isArray(r.photos) ? r.photos : [],
                    shippingFee: null,
                    note: r.notes,
                    rawOrder: null,
                });
            });

            // -- Inventory transfers (Luân chuyển)
            (transfersRes.data || []).forEach(t => {
                // Extract destination from note: "Điều chuyển tới Kho X. ..."
                const noteStr = t.note || '';
                const destMatch = noteStr.match(/Điều chuyển tới (.+?)\./);
                const destination = destMatch ? destMatch[1] : '—';

                // Extract image URL if stored in note
                const imgMatch = noteStr.match(/\[Ảnh Bàn Giao\]: (.+)/);
                const imgs = imgMatch ? [imgMatch[1].trim()] : [];

                unified.push({
                    id: t.id,
                    type: 'LUAN_CHUYEN',
                    code: t.reference_code,
                    date: t.created_at,
                    customerName: destination,
                    executor: 'Nội bộ',
                    quantity: t.quantity_changed || 0,
                    status: 'DONE',
                    statusLabel: 'Đã chuyển',
                    statusCls: 'bg-blue-50 text-blue-700 border-blue-200',
                    images: imgs,
                    shippingFee: null,
                    note: noteStr,
                    rawOrder: null,
                });
            });

            // Sort all by date descending
            unified.sort((a, b) => new Date(b.date) - new Date(a.date));
            setRecords(unified);
        } catch (error) {
            toast.error('Lỗi tải dữ liệu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Status helpers ---
    function getOrderStatusLabel(status) {
        const map = {
            'CHO_GIAO_HANG': 'Chờ giao hàng',
            'DANG_GIAO_HANG': 'Đang giao hàng',
            'CHO_DOI_SOAT': 'Chờ đối soát',
            'DOI_SOAT_THAT_BAI': 'Đối soát thất bại',
            'HOAN_THANH': 'Hoàn thành',
            'TRA_HANG': 'Trả hàng',
        };
        return map[status] || status || '—';
    }

    function getOrderStatusCls(status) {
        const map = {
            'CHO_GIAO_HANG': 'bg-amber-50 text-amber-700 border-amber-200',
            'DANG_GIAO_HANG': 'bg-sky-50 text-sky-700 border-sky-200',
            'CHO_DOI_SOAT': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'DOI_SOAT_THAT_BAI': 'bg-red-50 text-red-700 border-red-200',
            'HOAN_THANH': 'bg-green-50 text-green-700 border-green-200',
            'TRA_HANG': 'bg-red-50 text-red-700 border-red-200',
        };
        return map[status] || 'bg-slate-50 text-slate-700 border-slate-200';
    }

    function getRecoveryStatusLabel(status) {
        const map = {
            'CHO_PHAN_CONG': 'Chờ phân công',
            'DANG_THU_HOI': 'Đang thu hồi',
            'CHO_DUYET': 'Chờ duyệt',
            'HOAN_THANH': 'Hoàn thành',
            'HUY': 'Đã hủy',
        };
        return map[status] || status || '—';
    }

    function getRecoveryStatusCls(status) {
        const map = {
            'CHO_PHAN_CONG': 'bg-blue-50 text-blue-700 border-blue-200',
            'DANG_THU_HOI': 'bg-amber-50 text-amber-700 border-amber-200',
            'CHO_DUYET': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'HOAN_THANH': 'bg-green-50 text-green-700 border-green-200',
            'HUY': 'bg-red-50 text-red-700 border-red-200',
        };
        return map[status] || 'bg-slate-50 text-slate-700 border-slate-200';
    }

    function getOrderImages(o) {
        const imgs = [];
        if (Array.isArray(o.delivery_images) && o.delivery_images.length > 0) imgs.push(...o.delivery_images);
        if (o.delivery_proof_base64) imgs.push(o.delivery_proof_base64);
        if (o.delivery_image_url && !imgs.includes(o.delivery_image_url)) imgs.push(o.delivery_image_url);
        return imgs;
    }

    // --- Filtering ---
    const filteredRecords = records.filter(r => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
            (r.code || '').toLowerCase().includes(term) ||
            (r.customerName || '').toLowerCase().includes(term) ||
            (r.executor || '').toLowerCase().includes(term);

        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(r.type);
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);

        const rDate = new Date(r.date).getTime();
        let matchesDate = true;
        if (fromDate) matchesDate = matchesDate && rDate >= new Date(fromDate).getTime();
        if (toDate) matchesDate = matchesDate && rDate <= new Date(toDate).getTime() + 86399999;

        return matchesSearch && matchesType && matchesStatus && matchesDate;
    });

    const totalRecords = filteredRecords.length;
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const isRowSelected = (r) => selectedRowKeys.includes(rowKey(r));

    const toggleRowSelected = (r) => {
        const k = rowKey(r);
        setSelectedRowKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
    };

    const pageKeys = paginatedRecords.map(rowKey);
    const selectedOnPageCount = pageKeys.filter((k) => selectedRowKeys.includes(k)).length;
    const allPageSelected = pageKeys.length > 0 && selectedOnPageCount === pageKeys.length;
    const somePageSelected = selectedOnPageCount > 0 && !allPageSelected;

    useEffect(() => {
        const el = pageSelectAllRef.current;
        if (el) el.indeterminate = somePageSelected;
    }, [somePageSelected]);

    const toggleSelectAllOnPage = () => {
        if (pageKeys.length === 0) return;
        if (allPageSelected) {
            setSelectedRowKeys((prev) => prev.filter((k) => !pageKeys.includes(k)));
        } else {
            setSelectedRowKeys((prev) => [...new Set([...prev, ...pageKeys])]);
        }
    };

    const allFilteredKeys = filteredRecords.map(rowKey);
    const allFilteredSelected =
        allFilteredKeys.length > 0 && allFilteredKeys.every((k) => selectedRowKeys.includes(k));

    const toggleSelectAllFiltered = () => {
        if (allFilteredKeys.length === 0) return;
        if (allFilteredSelected) {
            setSelectedRowKeys((prev) => prev.filter((k) => !allFilteredKeys.includes(k)));
        } else {
            setSelectedRowKeys([...allFilteredKeys]);
        }
    };

    const clearRowSelection = () => setSelectedRowKeys([]);

    const handleBulkDelete = async () => {
        if (selectedRowKeys.length === 0) return;
        if (
            !window.confirm(
                `Xóa ${selectedRowKeys.length} bản ghi đã chọn? Không hoàn tác (đơn hàng / phiếu thu hồi / giao dịch luân chuyển kho).`,
            )
        ) {
            return;
        }
        setBulkDeleting(true);
        try {
            const byType = { GIAO_HANG: [], THU_HOI_VO: [], LUAN_CHUYEN: [] };
            for (const key of selectedRowKeys) {
                const p = parseRowKey(key);
                if (p && byType[p.type]) byType[p.type].push(p.id);
            }

            for (const chunk of chunkArray(byType.GIAO_HANG, 80)) {
                if (chunk.length === 0) continue;
                const { error: errOi } = await supabase.from('order_items').delete().in('order_id', chunk);
                if (errOi) console.warn('order_items delete:', errOi);
                const { error } = await supabase.from('orders').delete().in('id', chunk);
                if (error) throw error;
            }

            for (const chunk of chunkArray(byType.THU_HOI_VO, 80)) {
                if (chunk.length === 0) continue;
                const { error: errItems } = await supabase
                    .from('cylinder_recovery_items')
                    .delete()
                    .in('recovery_id', chunk);
                if (errItems) console.warn('cylinder_recovery_items delete:', errItems);
                const { error } = await supabase.from('cylinder_recoveries').delete().in('id', chunk);
                if (error) throw error;
            }

            for (const chunk of chunkArray(byType.LUAN_CHUYEN, 80)) {
                if (chunk.length === 0) continue;
                const { error } = await supabase.from('inventory_transactions').delete().in('id', chunk);
                if (error) throw error;
            }

            toast.success(`Đã xóa ${selectedRowKeys.length} bản ghi`);
            setSelectedRowKeys([]);
            await fetchAllData();
        } catch (e) {
            toast.error('Lỗi xóa: ' + (e.message || String(e)));
        } finally {
            setBulkDeleting(false);
        }
    };

    const hasActiveFilters = selectedTypes.length > 0 || selectedStatuses.length > 0 || fromDate || toDate;
    const totalActiveFilters = selectedTypes.length + selectedStatuses.length + (fromDate ? 1 : 0) + (toDate ? 1 : 0);

    // --- Filter options ---
    const typeOptions = DELIVERY_TYPES.map(d => ({
        id: d.id,
        label: d.label,
        count: records.filter(r => r.type === d.id).length
    }));

    const allStatuses = [...new Set(records.map(r => r.status))];
    const statusOptions = allStatuses.map(s => {
        const r = records.find(rec => rec.status === s);
        return { id: s, label: r?.statusLabel || s, count: records.filter(rec => rec.status === s).length };
    });

    // --- Image preview ---
    const openImagePreview = (r) => {
        if (r.images.length > 0) setPreviewImages({ images: r.images, index: 0 });
    };

    // --- Stats ---
    const totalAll = filteredRecords.length;
    const totalGiaoHang = filteredRecords.filter(r => r.type === 'GIAO_HANG').length;
    const totalThuHoi = filteredRecords.filter(r => r.type === 'THU_HOI_VO').length;
    const totalLuanChuyen = filteredRecords.filter(r => r.type === 'LUAN_CHUYEN').length;
    const totalCompleted = filteredRecords.filter(r => r.status === 'HOAN_THANH' || r.status === 'DONE').length;

    const handleViewAsOrder = (r) => {
        if (r.rawOrder) {
            setOrderToView(r.rawOrder);
            setIsOrderModalOpen(true);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'kanban', label: 'Kanban', icon: <LayoutGrid size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> }
                ]}
            />

            {(activeView === 'list' || activeView === 'kanban') && (
            <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full mb-2 md:mb-0">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm kiếm mã, khách hàng, nhân viên..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        summary={
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1.5 -mx-0.5 px-0.5">
                            <span className="bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm">
                                Tổng: {totalRecords} / {records.length}
                            </span>
                            {DELIVERY_TYPES.map(t => {
                                const cnt = filteredRecords.filter(r => r.type === t.id).length;
                                return cnt > 0 ? (
                                    <span key={t.id} className={clsx('px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap border', t.colorCls)}>
                                        {t.label}: {cnt}
                                    </span>
                                ) : null;
                            })}
                        </div>
                        }
                        selectionBar={
                            (activeView === 'list' || activeView === 'kanban') && !loading ? (
                                <div className="mt-2 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {activeView === 'list' && (
                                            <button
                                                type="button"
                                                onClick={toggleSelectAllOnPage}
                                                disabled={paginatedRecords.length === 0 || bulkDeleting}
                                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-black text-slate-700 disabled:opacity-40"
                                            >
                                                {allPageSelected ? 'Bỏ chọn trang' : 'Chọn cả trang'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={toggleSelectAllFiltered}
                                            disabled={filteredRecords.length === 0 || bulkDeleting}
                                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-black text-slate-700 disabled:opacity-40"
                                        >
                                            {allFilteredSelected ? 'Bỏ chọn hết lọc' : `Chọn hết (${totalRecords})`}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearRowSelection}
                                            disabled={selectedRowKeys.length === 0 || bulkDeleting}
                                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-black text-slate-500 disabled:opacity-40"
                                        >
                                            Bỏ chọn
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBulkDelete}
                                            disabled={selectedRowKeys.length === 0 || bulkDeleting}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-black text-rose-700 disabled:opacity-40"
                                        >
                                            <Trash2 size={12} />
                                            {bulkDeleting ? 'Đang xóa…' : `Xóa (${selectedRowKeys.length})`}
                                        </button>
                                    </div>
                                    {selectedRowKeys.length > 0 && (
                                        <p className="text-[10px] font-semibold text-slate-500">
                                            Đang chọn {selectedRowKeys.length} dòng (đơn / phiếu / luân chuyển).
                                        </p>
                                    )}
                                </div>
                            ) : null
                        }
                    />

                {/* Mobile Card List */}
                <div className="md:hidden flex-1 flex flex-col min-h-0">
                    {activeView === 'kanban' ? (
                        <div className="flex-1 flex flex-col min-h-0 p-3 pb-3">
                            {loading ? (
                                <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy bản ghi nào!</div>
                            ) : (
                                <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide">
                                    {DELIVERY_TYPES.map((dt) => {
                                        const columnRecords = filteredRecords.filter((r) => r.type === dt.id);
                                        const TypeIcon = dt.icon;
                                        return (
                                            <div
                                                key={dt.id}
                                                className="snap-start shrink-0 w-[min(100%,248px)] flex flex-col rounded-lg border border-border bg-muted/20 min-h-[min(72vh,420px)] max-h-[min(72vh,420px)]"
                                            >
                                                <div className={clsx('px-2 py-1.5 border-b flex items-center justify-between gap-1.5 rounded-t-lg', dt.colorCls)}>
                                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase">
                                                        <TypeIcon size={12} />
                                                        {dt.label}
                                                    </span>
                                                    <span className="text-[10px] font-black tabular-nums">{columnRecords.length}</span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
                                                    {columnRecords.map((r) => (
                                                            <div
                                                                key={`${r.type}-${r.id}`}
                                                                className={clsx(
                                                                    'rounded-md border border-slate-200/90 bg-white px-2 py-1 shadow-sm',
                                                                    isRowSelected(r) && 'ring-2 ring-primary/30 bg-sky-50/50',
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <div className="flex gap-1.5 min-w-0 flex-1 items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isRowSelected(r)}
                                                                            onChange={() => toggleRowSelected(r)}
                                                                            disabled={bulkDeleting}
                                                                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-primary"
                                                                            aria-label={`Chọn ${r.code}`}
                                                                        />
                                                                        <span className="font-black text-[11px] truncate">#{r.code}</span>
                                                                    </div>
                                                                    <span className={clsx('text-[8px] font-bold px-1 py-px rounded border shrink-0 leading-tight max-w-[6.5rem] truncate', r.statusCls)} title={r.statusLabel}>
                                                                        {r.statusLabel}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] font-bold line-clamp-1 mt-0.5">{r.customerName}</p>
                                                                <p className="text-[9px] text-muted-foreground truncate">
                                                                    {new Date(r.date).toLocaleDateString('vi-VN')} · {r.executor} · SL {r.quantity}
                                                                </p>
                                                                <div className="flex flex-wrap items-center gap-0.5 mt-1 pt-1 border-t border-border/50">
                                                                    {r.rawOrder && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleViewAsOrder(r)}
                                                                            className="px-1.5 py-0.5 rounded bg-primary text-white text-[9px] font-bold leading-tight"
                                                                        >
                                                                            Đơn
                                                                        </button>
                                                                    )}
                                                                    {r.type === 'THU_HOI_VO' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => navigate(`/thu-hoi-vo?recovery=${r.id}`)}
                                                                            className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 text-[9px] font-bold leading-tight"
                                                                        >
                                                                            Phiếu TH
                                                                        </button>
                                                                    )}
                                                                    {r.type === 'GIAO_HANG' && r.rawOrder?.recipient_address && (
                                                                        <a
                                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.rawOrder.recipient_address)}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 shrink-0"
                                                                            title="Bản đồ"
                                                                        >
                                                                            <MapPin size={12} />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                    <div className="flex-1 overflow-y-auto p-3 pb-3 flex flex-col gap-3">
                    <div className="space-y-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : paginatedRecords.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy bản ghi nào!</div>
                        ) : (
                            paginatedRecords.map(r => {
                                const typeInfo = getTypeInfo(r.type);
                                const TypeIcon = typeInfo.icon;
                                return (
                                <div key={`${r.type}-${r.id}`} className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm p-3 transition-all duration-200 active:scale-[0.99] hover:shadow-md hover:border-primary/30 flex flex-col', isRowSelected(r) && 'ring-2 ring-primary/30 bg-sky-50/40')}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex gap-2 min-w-0 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={isRowSelected(r)}
                                                onChange={() => toggleRowSelected(r)}
                                                disabled={bulkDeleting}
                                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary"
                                                aria-label={`Chọn ${r.code}`}
                                            />
                                            <div>
                                                <div className="flex items-center gap-1.5 mb-1 min-w-0">
                                                    <h3 className="font-bold text-[13px] text-foreground leading-tight whitespace-nowrap">#{r.code}</h3>
                                                    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase whitespace-nowrap', typeInfo.colorCls)}>
                                                        <TypeIcon size={10} />
                                                        {typeInfo.label}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className={clsx('text-[9px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap shrink-0', r.statusCls)}>
                                            {r.statusLabel}
                                        </span>
                                    </div>

                                    <div className="mb-3 flex-1">
                                        <h3 className="text-[14px] font-black text-foreground leading-snug">{r.customerName}</h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                            <span className="text-[11px] font-medium text-muted-foreground">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <User className="w-3 h-3 text-blue-600" /> Người thực hiện
                                            </p>
                                            <p className="text-[12px] text-foreground font-bold mt-0.5 truncate">{r.executor}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                            <div className="text-[14px] text-foreground font-black mt-0.5">{r.quantity} SP</div>
                                        </div>
                                        {r.images.length > 0 && (
                                            <div className="col-span-2">
                                                <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5 pt-2">
                                                    {r.images.slice(0, 4).map((img, i) => (
                                                        <img
                                                            key={i}
                                                            src={img}
                                                            alt={`Ảnh ${i + 1}`}
                                                            onClick={() => setPreviewImages({ images: r.images, index: i })}
                                                            className="w-16 h-16 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer active:scale-95 transition-transform shrink-0"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ))}
                                                    {r.images.length > 4 && (
                                                        <button
                                                            onClick={() => openImagePreview(r)}
                                                            className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 active:scale-95 transition-transform"
                                                        >
                                                            +{r.images.length - 4}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                                        {r.rawOrder && (
                                            <>
                                                <button onClick={() => handleViewAsOrder(r)} className="p-2 text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg active:scale-90 transition-all" title="Xem chi tiết">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleViewAsOrder(r)} className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg active:scale-90 transition-all" title="Thao tác">
                                                    <Package size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                    </div>
                    )}

                    {/* Mobile Pagination — outside overflow-y-auto so sticky works */}
                    {!loading && activeView === 'list' && (
                        <MobilePagination
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            pageSize={pageSize}
                            setPageSize={setPageSize}
                            totalRecords={filteredRecords.length}
                        />
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:flex flex-col flex-1 min-h-0">
                    {/* Desktop Toolbar */}
                    <div className="p-4 border-b border-border/50 shrink-0">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-1">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                                >
                                    <ChevronLeft size={16} />
                                    Quay lại
                                </button>
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm mã, khách hàng, nhân viên..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-rose-500 transition-colors">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 ml-2">
                                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white shadow-sm font-medium" title="Từ ngày" />
                                    <span className="text-slate-400 text-[13px] font-bold">—</span>
                                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[13px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white shadow-sm font-medium" title="Đến ngày" />
                                </div>
                                {/* Type filter */}
                                <div className="relative ml-2">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'types' ? null : 'types')}
                                        className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-bold transition-all',
                                            selectedTypes.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white text-muted-foreground border-border hover:text-foreground')}
                                    >
                                        <Package size={14} />
                                        Loại
                                        {selectedTypes.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-600 text-white font-bold">{selectedTypes.length}</span>
                                        )}
                                        <ChevronDown size={14} className={activeDropdown === 'types' ? 'rotate-180' : ''} />
                                    </button>
                                    {activeDropdown === 'types' && (
                                        <FilterDropdown options={typeOptions} selected={selectedTypes} setSelected={setSelectedTypes} filterSearch={filterSearch} setFilterSearch={setFilterSearch} showSearch={false} />
                                    )}
                                </div>
                                {/* Status filter */}
                                <div className="relative ml-2">
                                    <button
                                        onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                        className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[13px] font-bold transition-all',
                                            selectedStatuses.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-muted-foreground border-border hover:text-foreground')}
                                    >
                                        <List size={14} />
                                        Trạng thái
                                        {selectedStatuses.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-bold">{selectedStatuses.length}</span>
                                        )}
                                        <ChevronDown size={14} className={activeDropdown === 'status' ? 'rotate-180' : ''} />
                                    </button>
                                    {activeDropdown === 'status' && (
                                        <FilterDropdown options={statusOptions} selected={selectedStatuses} setSelected={setSelectedStatuses} filterSearch={filterSearch} setFilterSearch={setFilterSearch} showSearch={false} />
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap shadow-sm">
                                    Tổng: {totalRecords}
                                </span>
                            </div>
                        </div>
                        {(activeView === 'list' || activeView === 'kanban') && !loading && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
                                {activeView === 'list' && (
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllOnPage}
                                        disabled={paginatedRecords.length === 0 || bulkDeleting}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        {allPageSelected ? 'Bỏ chọn trang này' : 'Chọn cả trang này'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={toggleSelectAllFiltered}
                                    disabled={filteredRecords.length === 0 || bulkDeleting}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    {allFilteredSelected ? 'Bỏ chọn hết (đang lọc)' : `Chọn hết đang lọc (${totalRecords})`}
                                </button>
                                <button
                                    type="button"
                                    onClick={clearRowSelection}
                                    disabled={selectedRowKeys.length === 0 || bulkDeleting}
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    Bỏ chọn
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkDelete}
                                    disabled={selectedRowKeys.length === 0 || bulkDeleting}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-[12px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                                >
                                    <Trash2 size={14} />
                                    {bulkDeleting ? 'Đang xóa…' : `Xóa đã chọn (${selectedRowKeys.length})`}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar min-h-0 flex flex-col">
                        {activeView === 'kanban' ? (
                            loading ? (
                                <div className="flex-1 flex items-center justify-center py-20 text-slate-400 font-bold italic">Đang tải dữ liệu...</div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center py-20 text-slate-500 font-medium">Không tìm thấy bản ghi nào.</div>
                            ) : (
                                <div className="flex-1 min-h-[320px] p-2.5 md:p-3 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-2.5">
                                    {DELIVERY_TYPES.map((dt) => {
                                        const columnRecords = filteredRecords.filter((r) => r.type === dt.id);
                                        const TypeIcon = dt.icon;
                                        return (
                                            <div
                                                key={dt.id}
                                                className="flex flex-col rounded-xl border border-border bg-muted/15 min-h-[280px] max-h-[calc(100vh-200px)]"
                                            >
                                                <div className={clsx('px-2 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 rounded-t-xl', dt.colorCls)}>
                                                    <span className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide">
                                                        <TypeIcon size={13} />
                                                        {dt.label}
                                                    </span>
                                                    <span className="text-[11px] font-black tabular-nums opacity-90">{columnRecords.length}</span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-1.5 space-y-1 min-h-0">
                                                    {columnRecords.map((r) => (
                                                            <div
                                                                key={`${r.type}-${r.id}`}
                                                                className={clsx(
                                                                    'rounded-md border border-slate-200/90 bg-white px-2 py-1.5 shadow-sm hover:border-primary/25 transition-colors',
                                                                    isRowSelected(r) && 'ring-2 ring-primary/30 bg-sky-50/50',
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between gap-1.5">
                                                                    <div className="flex gap-1.5 min-w-0 flex-1 items-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isRowSelected(r)}
                                                                            onChange={() => toggleRowSelected(r)}
                                                                            disabled={bulkDeleting}
                                                                            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-primary"
                                                                            aria-label={`Chọn ${r.code}`}
                                                                        />
                                                                        <span className="font-black text-[11px] text-slate-800 truncate">#{r.code}</span>
                                                                    </div>
                                                                    <span className={clsx('text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 leading-tight max-w-[7rem] truncate', r.statusCls)} title={r.statusLabel}>
                                                                        {r.statusLabel}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] font-bold text-slate-900 line-clamp-1 mt-0.5" title={r.customerName}>{r.customerName}</p>
                                                                <p className="text-[9px] text-slate-500 truncate mt-px" title={`${r.executor} · SL ${r.quantity}`}>
                                                                    {new Date(r.date).toLocaleDateString('vi-VN')} · <span className="text-slate-600">{r.executor}</span> · SL&nbsp;{r.quantity}
                                                                </p>
                                                                {r.images.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openImagePreview(r)}
                                                                        className="flex -space-x-1 mt-1"
                                                                        title={`${r.images.length} ảnh`}
                                                                    >
                                                                        {r.images.slice(0, 2).map((img, i) => (
                                                                            <img
                                                                                key={i}
                                                                                src={img}
                                                                                alt=""
                                                                                className="w-6 h-6 rounded object-cover border border-white shadow-sm"
                                                                                onError={(e) => {
                                                                                    e.target.style.display = 'none';
                                                                                }}
                                                                            />
                                                                        ))}
                                                                        {r.images.length > 2 ? (
                                                                            <span className="w-6 h-6 rounded bg-slate-100 border border-white text-[8px] font-bold flex items-center justify-center text-slate-500">
                                                                                +{r.images.length - 2}
                                                                            </span>
                                                                        ) : null}
                                                                    </button>
                                                                )}
                                                                <div className="flex flex-wrap items-center gap-0.5 mt-1 pt-1 border-t border-slate-100/80">
                                                                    {r.rawOrder && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleViewAsOrder(r)}
                                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-md"
                                                                                title="Xem chi tiết"
                                                                            >
                                                                                <Eye size={13} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleViewAsOrder(r)}
                                                                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                                                                                title="Thao tác đơn"
                                                                            >
                                                                                <Package size={13} />
                                                                            </button>
                                                                            {r.rawOrder.recipient_address ? (
                                                                                <a
                                                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.rawOrder.recipient_address)}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="p-1 text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200/80"
                                                                                    title="Bản đồ"
                                                                                >
                                                                                    <MapPin size={13} />
                                                                                </a>
                                                                            ) : null}
                                                                        </>
                                                                    )}
                                                                    {r.type === 'THU_HOI_VO' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => navigate(`/thu-hoi-vo?recovery=${r.id}`)}
                                                                            className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 text-[9px] font-bold hover:bg-amber-100 leading-tight"
                                                                        >
                                                                            Phiếu TH
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur shadow-sm">
                                <tr>
                                    <th className="w-11 px-2 py-3.5 text-center">
                                        <input
                                            ref={pageSelectAllRef}
                                            type="checkbox"
                                            checked={allPageSelected}
                                            onChange={toggleSelectAllOnPage}
                                            disabled={paginatedRecords.length === 0 || bulkDeleting}
                                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-40"
                                            title="Chọn / bỏ chọn cả trang này"
                                            aria-label="Chọn cả trang"
                                        />
                                    </th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Loại</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Mã</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Ngày</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Khách hàng / Kho đích</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Số lượng</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Người thực hiện</th>
                                    <th className="px-5 py-3.5 text-center text-[12px] font-bold text-slate-500 uppercase tracking-wider">Ảnh</th>
                                    <th className="px-5 py-3.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                                    <th className="px-5 py-3.5 text-center text-[12px] font-bold text-slate-500 uppercase tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 bg-white">
                                {loading ? (
                                    <tr><td colSpan={10} className="px-6 py-20 text-center text-slate-400 font-bold italic">Đang tải dữ liệu...</td></tr>
                                ) : paginatedRecords.length === 0 ? (
                                    <tr><td colSpan={10} className="px-6 py-20 text-center text-slate-500 font-medium">Không tìm thấy bản ghi nào.</td></tr>
                                ) : (
                                    paginatedRecords.map(r => {
                                        const typeInfo = getTypeInfo(r.type);
                                        const TypeIcon = typeInfo.icon;
                                        return (
                                        <tr key={`${r.type}-${r.id}`} className={clsx('hover:bg-slate-50/80 transition-colors group', isRowSelected(r) && 'bg-sky-50/60')}>
                                            <td className="w-11 px-2 py-3.5 text-center align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={isRowSelected(r)}
                                                    onChange={() => toggleRowSelected(r)}
                                                    disabled={bulkDeleting}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer disabled:opacity-40"
                                                    aria-label={`Chọn ${r.code}`}
                                                />
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap", typeInfo.colorCls)}>
                                                    <TypeIcon size={12} />
                                                    {typeInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100/80 text-slate-700 font-black text-[13px] border border-slate-200/60 shadow-sm leading-none">
                                                    #{r.code}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-[13px] text-slate-600 font-medium">
                                                {new Date(r.date).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="font-bold text-[13px] text-slate-800 line-clamp-1">{r.customerName}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-[13px] text-emerald-700">{r.quantity}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-[13px] text-slate-600 font-bold">
                                                {r.executor}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {r.images.length > 0 ? (
                                                    <button onClick={() => openImagePreview(r)} className="inline-flex items-center gap-0" title={`${r.images.length} ảnh`}>
                                                        <div className="flex -space-x-2">
                                                            {r.images.slice(0, 3).map((img, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={img}
                                                                    alt=""
                                                                    className="w-9 h-9 rounded-lg object-cover border-2 border-white shadow-sm hover:scale-110 transition-transform"
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                />
                                                            ))}
                                                            {r.images.length > 3 && (
                                                                <div className="w-9 h-9 rounded-lg bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                                    +{r.images.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap", r.statusCls)}>
                                                    {r.statusLabel}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {r.rawOrder && (
                                                        <>
                                                            <button onClick={() => handleViewAsOrder(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Xem chi tiết">
                                                                <Eye size={18} />
                                                            </button>
                                                            <button onClick={() => handleViewAsOrder(r)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Thao tác">
                                                                <Package size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {!r.rawOrder && (
                                                        <span className="text-slate-300 text-[11px]">—</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* Stats View */}
            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-6 mb-2 md:mb-0">
                    <h2 className="text-xl font-black text-slate-900">Thống kê Lịch sử Giao hàng</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white p-5 rounded-2xl justify-between border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-primary transition-colors">
                            <span className="text-[13px] font-bold text-muted-foreground uppercase">Tổng Bản Ghi</span>
                            <span className="text-3xl font-black text-foreground">{totalAll}</span>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-all pointer-events-none">
                                <Truck size={80} className="-mr-6 -mb-6" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl justify-between border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-emerald-500 transition-colors">
                            <span className="text-[13px] font-bold text-muted-foreground uppercase">Giao Hàng</span>
                            <span className="text-3xl font-black text-emerald-600">{totalGiaoHang}</span>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-all pointer-events-none">
                                <Truck size={80} className="-mr-6 -mb-6" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl justify-between border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-amber-500 transition-colors">
                            <span className="text-[13px] font-bold text-muted-foreground uppercase">Thu Hồi Vỏ</span>
                            <span className="text-3xl font-black text-amber-600">{totalThuHoi}</span>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-all pointer-events-none">
                                <Recycle size={80} className="-mr-6 -mb-6" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl justify-between border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-blue-500 transition-colors">
                            <span className="text-[13px] font-bold text-muted-foreground uppercase">Luân Chuyển</span>
                            <span className="text-3xl font-black text-blue-600">{totalLuanChuyen}</span>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-all pointer-events-none">
                                <ArrowLeftRight size={80} className="-mr-6 -mb-6" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl justify-between border border-border shadow-sm flex flex-col gap-2 relative overflow-hidden group hover:border-green-500 transition-colors">
                            <span className="text-[13px] font-bold text-muted-foreground uppercase">Hoàn Thành</span>
                            <span className="text-3xl font-black text-green-600">{totalCompleted}</span>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:scale-110 transition-all pointer-events-none">
                                <Package size={80} className="-mr-6 -mb-6" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Status Updater Modal (only for delivery orders) */}
            {isOrderModalOpen && orderToView && (
                <OrderStatusUpdater
                    isOpen={isOrderModalOpen}
                    onClose={() => {
                        setIsOrderModalOpen(false);
                        setTimeout(() => setOrderToView(null), 300);
                    }}
                    order={orderToView}
                    onSuccess={() => {
                        fetchAllData();
                        setIsOrderModalOpen(false);
                    }}
                />
            )}

            {/* Preview Image Modal */}
            {previewImages && (
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewImages(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={previewImages.images[previewImages.index]}
                            alt={`Ảnh ${previewImages.index + 1}`}
                            className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl"
                        />
                        {previewImages.images.length > 1 && (
                            <div className="flex items-center gap-3 mt-4">
                                <button
                                    onClick={() => setPreviewImages(p => ({ ...p, index: Math.max(0, p.index - 1) }))}
                                    disabled={previewImages.index === 0}
                                    className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-colors shadow-lg disabled:opacity-30"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-white text-sm font-bold">{previewImages.index + 1} / {previewImages.images.length}</span>
                                <button
                                    onClick={() => setPreviewImages(p => ({ ...p, index: Math.min(p.images.length - 1, p.index + 1) }))}
                                    disabled={previewImages.index === previewImages.images.length - 1}
                                    className="p-2 bg-white/90 text-slate-800 rounded-full hover:bg-white transition-colors shadow-lg disabled:opacity-30"
                                >
                                    <ChevronLeft size={20} className="rotate-180" />
                                </button>
                            </div>
                        )}
                        <button
                            className="absolute top-2 right-2 p-2 bg-white text-slate-800 rounded-full hover:bg-slate-200 transition-colors shadow-lg"
                            onClick={() => setPreviewImages(null)}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            <MobileFilterSheet
                isOpen={showMobileFilter}
                isClosing={mobileFilterClosing}
                onClose={closeMobileFilter}
                onApply={applyMobileFilter}
                title="Bộ lọc lịch sử giao hàng"
                sections={[
                    {
                        id: 'dateRange',
                        label: 'Khoảng thời gian',
                        type: 'dateRange',
                        value: pendingDateRange,
                        onValueChange: setPendingDateRange,
                    },
                    {
                        id: 'types',
                        label: 'Loại giao dịch',
                        icon: <Package size={16} />,
                        options: typeOptions,
                        selectedValues: pendingTypes,
                        onSelectionChange: setPendingTypes,
                        searchable: false,
                    },
                    {
                        id: 'status',
                        label: 'Trạng thái',
                        icon: <List size={16} />,
                        options: statusOptions,
                        selectedValues: pendingStatuses,
                        onSelectionChange: setPendingStatuses,
                        searchable: false,
                    },
                ]}
            />
        </div>
    );
}
