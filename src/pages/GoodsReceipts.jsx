import {
    CheckSquare,
    ChevronDown,
    Edit,
    Package,
    Plus,
    Printer,
    Search,
    Trash2,
    Download,
    Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import GoodsReceiptPrintTemplate from '../components/GoodsReceiptPrintTemplate';
import { RECEIPT_STATUSES } from '../constants/goodsReceiptConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import { supabase } from '../supabase/config';


const TABLE_COLUMNS = [
    { key: 'code', label: 'Mã phiếu' },
    { key: 'supplier', label: 'Nhà cung cấp' },
    { key: 'warehouse', label: 'Kho nhận' },
    { key: 'date', label: 'Ngày nhập' },
    { key: 'items', label: 'Số MH' },
    { key: 'amount', label: 'Tổng giá trị' },
    { key: 'receiver', label: 'Người nhận' },
    { key: 'status', label: 'Trạng thái' },
];

const GoodsReceipts = () => {
    const navigate = useNavigate();
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [warehouseFilter, setWarehouseFilter] = useState('ALL');
    const [printData, setPrintData] = useState(null);
    const [warehousesList, setWarehousesList] = useState([]);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_goods_receipts', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchReceipts();
        fetchWarehouses();
    }, []);

    const fetchReceipts = async () => {
        try {
            const { data, error } = await supabase
                .from('goods_receipts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReceipts(data || []);
            setSelectedIds([]);
        } catch (error) {
            console.error('Error loading receipts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const handleDeleteReceipt = async (id, code) => {
        if (!window.confirm(`Bạn có chắc muốn xóa phiếu nhập "${code}" không? Hành động này sẽ không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('goods_receipts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchReceipts();
        } catch (error) {
            console.error('Error deleting receipt:', error);
            alert('❌ Lỗi khi xóa phiếu nhập: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} phiếu nhập đã chọn không? Hành động này sẽ không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('goods_receipts')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchReceipts();
            alert(`✅ Đã xóa ${selectedIds.length} phiếu nhập thành công!`);
        } catch (error) {
            console.error('Error deleting receipts:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredReceipts.length && filteredReceipts.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredReceipts.map(r => r.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'Mã phiếu (Để trống sẽ tự tạo)',
            'Nhà cung cấp',
            'Kho nhận (HN/TP.HCM/TH/DN)',
            'Ngày nhập (YYYY-MM-DD)',
            'Ghi chú phiếu',
            'Người nhận hàng',
            'Loại hàng (MAY/BINH/VAT_TU)',
            'Tên hàng hóa',
            'Mã serial (nếu có)',
            'Trạng thái hàng (Sẵn sàng/Lỗi...)',
            'Số lượng',
            'Đơn vị',
            'Đơn giá nhập',
        ];

        const exampleData = [
            {
                'Mã phiếu (Để trống sẽ tự tạo)': 'PN00001',
                'Nhà cung cấp': 'Công ty Oxy y tế A',
                'Kho nhận (HN/TP.HCM/TH/DN)': 'HN',
                'Ngày nhập (YYYY-MM-DD)': '2023-10-25',
                'Ghi chú phiếu': 'Nhập hàng đợt 1',
                'Người nhận hàng': 'Nguyễn Văn A',
                'Loại hàng (MAY/BINH/VAT_TU)': 'BINH',
                'Tên hàng hóa': 'Bình Oxy 40L',
                'Mã serial (nếu có)': 'OXY40-001',
                'Trạng thái hàng (Sẵn sàng/Lỗi...)': 'Sẵn sàng',
                'Số lượng': 1,
                'Đơn vị': 'bình',
                'Đơn giá nhập': 1500000,
            },
            {
                'Mã phiếu (Để trống sẽ tự tạo)': 'PN00001',
                'Nhà cung cấp': 'Công ty Oxy y tế A',
                'Kho nhận (HN/TP.HCM/TH/DN)': 'HN',
                'Ngày nhập (YYYY-MM-DD)': '2023-10-25',
                'Ghi chú phiếu': 'Nhập hàng đợt 1',
                'Người nhận hàng': 'Nguyễn Văn A',
                'Loại hàng (MAY/BINH/VAT_TU)': 'BINH',
                'Tên hàng hóa': 'Bình Oxy 40L',
                'Mã serial (nếu có)': 'OXY40-002',
                'Trạng thái hàng (Sẵn sàng/Lỗi...)': 'Sẵn sàng',
                'Số lượng': 1,
                'Đơn vị': 'bình',
                'Đơn giá nhập': 1500000,
            }
        ];

        const ws = XLSX.utils.json_to_sheet(exampleData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template Nhap Kho');
        XLSX.writeFile(wb, 'mau_import_phieu_nhap_kho.xlsx');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('File Excel không có dữ liệu!');
                    return;
                }

                setLoading(true);

                // Group by Receipt Code
                const mappedData = data.map((row, index) => {
                    const rowCode = row['Mã phiếu (Để trống sẽ tự tạo)']?.toString().trim();
                    return {
                        groupId: rowCode || `AUTO_GROUP_${index}`,
                        receipt_code: rowCode || '',
                        supplier_name: row['Nhà cung cấp']?.toString() || 'Chưa xác định',
                        warehouse_id: row['Kho nhận (HN/TP.HCM/TH/DN)']?.toString().toUpperCase() || 'HN',
                        receipt_date: row['Ngày nhập (YYYY-MM-DD)']?.toString() || new Date().toISOString().split('T')[0],
                        note: row['Ghi chú phiếu']?.toString() || '',
                        received_by: row['Người nhận hàng']?.toString() || '',
                        
                        item_type: row['Loại hàng (MAY/BINH/VAT_TU)']?.toString().toUpperCase() || 'VAT_TU',
                        item_name: row['Tên hàng hóa']?.toString() || '',
                        serial_number: row['Mã serial (nếu có)']?.toString() || null,
                        item_status: row['Trạng thái hàng (Sẵn sàng/Lỗi...)']?.toString() || 'Sẵn sàng',
                        quantity: parseInt(row['Số lượng'], 10) || 1,
                        unit: row['Đơn vị']?.toString() || 'cái',
                        unit_price: parseFloat(row['Đơn giá nhập']) || 0,
                    };
                }).filter(i => i.item_name);

                if (mappedData.length === 0) {
                    alert('Không tìm thấy dữ liệu hợp lệ (thiếu Tên hàng hóa)!');
                    setLoading(false);
                    return;
                }

                const groups = {};
                mappedData.forEach(item => {
                    if (!groups[item.groupId]) {
                        groups[item.groupId] = {
                            receipt_code: item.receipt_code,
                            supplier_name: item.supplier_name,
                            warehouse_id: ["HN", "TP.HCM", "TH", "DN"].includes(item.warehouse_id) ? item.warehouse_id : "HN",
                            receipt_date: item.receipt_date,
                            status: 'CHO_DUYET',
                            note: item.note,
                            received_by: item.received_by,
                            total_items: 0,
                            total_amount: 0,
                            items: []
                        };
                    }
                    groups[item.groupId].items.push({
                        item_type: ["MAY", "BINH", "VAT_TU", "BINH_4L", "BINH_8L", "MAY_ROSY", "MAY_MED"].includes(item.item_type) ? item.item_type : "VAT_TU",
                        item_name: item.item_name,
                        serial_number: item.serial_number,
                        item_status: item.item_status,
                        quantity: item.quantity,
                        unit: item.unit,
                        unit_price: item.unit_price,
                        total_price: item.quantity * item.unit_price,
                        note: '',
                    });
                    groups[item.groupId].total_items += item.quantity;
                    groups[item.groupId].total_amount += (item.quantity * item.unit_price);
                });

                let nextCodeNum = Date.now() % 100000; 
                let importedReceipts = 0;
                let importedItems = 0;

                for (const groupId in groups) {
                    const group = groups[groupId];
                    let code = group.receipt_code;
                    if (!code) {
                        code = `PN${String(nextCodeNum++).padStart(5, '0')}`;
                    }

                    const { data: insertedReceipt, error: receiptError } = await supabase
                        .from('goods_receipts')
                        .insert([{
                            receipt_code: code,
                            supplier_name: group.supplier_name,
                            warehouse_id: group.warehouse_id,
                            receipt_date: group.receipt_date,
                            status: group.status,
                            note: group.note,
                            received_by: group.received_by,
                            total_items: group.total_items,
                            total_amount: group.total_amount
                        }])
                        .select('id')
                        .single();

                    if (receiptError) {
                        console.error('Error inserting receipt:', receiptError);
                        continue;
                    }

                    importedReceipts++;

                    const itemsToInsert = group.items.map(item => ({
                        ...item,
                        receipt_id: insertedReceipt.id
                    }));

                    const { error: itemsError } = await supabase
                        .from('goods_receipt_items')
                        .insert(itemsToInsert);

                    if (itemsError) {
                        console.error('Error inserting items:', itemsError);
                    } else {
                        importedItems += itemsToInsert.length;
                    }
                }

                alert(`🎉 Đã import thành công ${importedReceipts} phiếu nhập với tổng cộng ${importedItems} hàng hóa!`);
                fetchReceipts();
            } catch (err) {
                console.error('Error importing excel:', err);
                alert('Có lỗi xảy ra khi xử lý file: ' + err.message);
            } finally {
                setLoading(false);
                if (e.target) e.target.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    const handlePrintReceipt = async (receipt) => {
        try {
            const { data: items, error } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('receipt_id', receipt.id);

            if (error) throw error;

            setPrintData({ receipt, items: items || [] });
            setTimeout(() => {
                window.print();
            }, 300);
        } catch (error) {
            console.error('Error fetching items for print:', error);
            alert('❌ Lỗi khi tải dữ liệu in: ' + error.message);
        }
    };

    const handleApproveReceipt = async (receipt) => {
        if (!window.confirm(`Xác nhận duyệt phiếu nhập "${receipt.receipt_code}"?\nHàng hóa sẽ được cộng vào tồn kho và không thể hoàn tác.`)) {
            return;
        }

        try {
            // 1. Fetch receipt items
            const { data: items, error: itemsError } = await supabase
                .from('goods_receipt_items')
                .select('*')
                .eq('receipt_id', receipt.id);

            if (itemsError) throw itemsError;
            if (!items || items.length === 0) {
                alert('⚠️ Phiếu nhập không có hàng hóa, không thể duyệt!');
                return;
            }

            // --- CAPACITY CHECK ---
            const { data: warehouseData, error: warehouseError } = await supabase
                .from('warehouses')
                .select('name, capacity')
                .eq('id', receipt.warehouse_id)
                .single();

            if (warehouseError) throw warehouseError;

            if (warehouseData && warehouseData.capacity > 0) {
                const incomingTotal = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

                const { data: currentInvData, error: currentInvError } = await supabase
                    .from('inventory')
                    .select('quantity')
                    .eq('warehouse_id', receipt.warehouse_id);

                if (currentInvError) throw currentInvError;

                const currentTotal = (currentInvData || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                const projectedTotal = currentTotal + incomingTotal;

                if (projectedTotal > warehouseData.capacity) {
                    alert(`❌ Không thể duyệt phiếu nhập do vượt quá sức chứa kho!\n\nKho: ${warehouseData.name}\nSức chứa tối đa: ${warehouseData.capacity}\n\nĐang tồn kho: ${currentTotal}\nChuẩn bị nhập thêm: ${incomingTotal}\nTổng sau lập phiếu: ${projectedTotal} (Vượt ${projectedTotal - warehouseData.capacity})`);
                    return;
                }
            }
            // --- END CAPACITY CHECK ---

            // 2. Loop through items to update inventory
            for (const item of items) {
                // Upsert inventory
                const { data: invData, error: invQueryError } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', receipt.warehouse_id)
                    .eq('item_type', item.item_type)
                    .eq('item_name', item.item_name)
                    .maybeSingle();

                if (invQueryError) throw invQueryError;

                let inventoryId;
                if (invData) {
                    // Update
                    const { data: updatedInv, error: updateError } = await supabase
                        .from('inventory')
                        .update({ quantity: invData.quantity + item.quantity })
                        .eq('id', invData.id)
                        .select()
                        .single();
                    if (updateError) throw updateError;
                    inventoryId = updatedInv.id;
                } else {
                    // Insert
                    const { data: newInv, error: insertError } = await supabase
                        .from('inventory')
                        .insert([{
                            warehouse_id: receipt.warehouse_id,
                            item_type: item.item_type,
                            item_name: item.item_name,
                            quantity: item.quantity
                        }])
                        .select()
                        .single();
                    if (insertError) throw insertError;
                    inventoryId = newInv.id;
                }

                // Create transaction record
                const { error: txError } = await supabase
                    .from('inventory_transactions')
                    .insert([{
                        inventory_id: inventoryId,
                        transaction_type: 'IN',
                        reference_id: receipt.id,
                        reference_code: receipt.receipt_code,
                        quantity_changed: item.quantity,
                        note: `Duyệt phiếu nhập ${receipt.receipt_code}`
                    }]);
                if (txError) throw txError;
            }

            // 3. Update receipt status
            const { error: updateReceiptError } = await supabase
                .from('goods_receipts')
                .update({ status: 'DA_NHAP' })
                .eq('id', receipt.id);

            if (updateReceiptError) throw updateReceiptError;

            alert('✅ Đã duyệt phiếu nhập và cập nhật tồn kho thành công!');
            fetchReceipts();
        } catch (error) {
            console.error('Error approving receipt:', error);
            alert('❌ Lỗi khi duyệt phiếu: ' + error.message);
        }
    };

    const getStatusBadge = (status) => {
        const statusObj = RECEIPT_STATUSES.find(s => s.id === status);
        if (!statusObj) return <span className="text-gray-400">—</span>;

        const colorMap = {
            yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            red: 'bg-red-50 text-red-700 border-red-200',
            gray: 'bg-gray-50 text-gray-700 border-gray-200',
        };

        return (
            <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${colorMap[statusObj.color] || colorMap.gray}`}>
                {statusObj.label}
            </span>
        );
    };

    const getWarehouseLabel = (id) => {
        return warehousesList.find(w => w.id === id)?.name || id;
    };

    const filteredReceipts = receipts.filter(r => {
        const matchSearch = !searchTerm ||
            r.receipt_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
        const matchWarehouse = warehouseFilter === 'ALL' || r.warehouse_id === warehouseFilter;
        return matchSearch && matchStatus && matchWarehouse;
    });

    const stats = {
        total: receipts.length,
        pending: receipts.filter(r => r.status === 'CHO_DUYET').length,
        imported: receipts.filter(r => r.status === 'DA_NHAP').length,
        completed: receipts.filter(r => r.status === 'HOAN_THANH').length,
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-emerald w-[400px] h-[400px] -top-20 -right-20 opacity-15"></div>
            <div className="blob blob-teal w-[300px] h-[300px] bottom-1/3 -left-20 opacity-10"></div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/trang-chu')} className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-gray-400 transition-all shadow-sm">
                        ←
                    </button>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Package className="w-8 h-8 text-emerald-600" />
                        Nhập hàng từ NCC
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-6 py-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200 font-black text-sm hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all shadow-lg animate-in slide-in-from-right-4"
                        >
                            <Trash2 className="w-5 h-5" />
                            Xóa ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-5 py-3.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-200 font-bold text-sm hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                        title="Tải mẫu Excel"
                    >
                        <Download className="w-5 h-5" />
                        <span className="hidden sm:inline">Tải mẫu</span>
                    </button>
                    <label className="flex items-center gap-2 px-5 py-3.5 bg-blue-50 text-blue-700 rounded-2xl border border-blue-200 font-bold text-sm hover:bg-blue-100 hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer" title="Nhập Excel">
                        <Upload className="w-5 h-5" />
                        <span className="hidden sm:inline">Nhập file</span>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportExcel}
                            className="hidden"
                        />
                    </label>
                    <button
                        onClick={() => navigate('/tao-phieu-nhap')}
                        className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-5 h-5" />
                        Tạo
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8 relative z-10">
                {[
                    { label: 'Tổng phiếu', value: stats.total, color: 'from-gray-500 to-gray-600', bg: 'bg-gray-50' },
                    { label: 'Chờ duyệt', value: stats.pending, color: 'from-yellow-500 to-amber-600', bg: 'bg-yellow-50' },
                    { label: 'Đã nhập kho', value: stats.imported, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50' },
                    { label: 'Hoàn thành', value: stats.completed, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50' },
                ].map((stat, idx) => (
                    <div key={idx} className={`${stat.bg} rounded-2xl p-5 border border-white shadow-sm`}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
                        <p className={`text-3xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white p-4 md:p-6 mb-6 relative z-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm mã phiếu, NCC..."
                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 transition-all"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 cursor-pointer appearance-none transition-all"
                        >
                            {RECEIPT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select
                            value={warehouseFilter}
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 cursor-pointer appearance-none transition-all"
                        >
                            <option value="ALL">Tất cả kho</option>
                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                <div className="flex items-center justify-end mt-4">
                    <ColumnToggle columns={TABLE_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetColumns} visibleCount={visibleCount} totalCount={totalCount} />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-emerald-900/10 border border-white overflow-hidden relative z-10">
                {loading ? (
                    <div className="p-16 text-center">
                        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400 font-bold">Đang tải dữ liệu...</p>
                    </div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="p-16 text-center">
                        <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold text-lg mb-2">Chưa có phiếu nhập nào</p>
                        <p className="text-gray-300 text-sm">Nhấn "Tạo phiếu nhập mới" để bắt đầu</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {/* Mobile Select All */}
                            <div className="p-4 flex items-center gap-3 bg-gray-50 border-b border-gray-100">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    checked={selectedIds.length === filteredReceipts.length && filteredReceipts.length > 0}
                                    onChange={toggleSelectAll}
                                />
                                <span className="text-sm font-bold text-gray-600">Chọn tất cả</span>
                            </div>
                            {filteredReceipts.map((receipt, idx) => (
                                <div key={receipt.id} className={`p-4 hover:bg-emerald-50/30 active:bg-emerald-50/50 transition-colors ${selectedIds.includes(receipt.id) ? 'bg-emerald-50/40' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 mt-1 rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                checked={selectedIds.includes(receipt.id)}
                                                onChange={(e) => { e.stopPropagation(); toggleSelect(receipt.id); }}
                                            />
                                            <div>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{idx + 1}</span>
                                                <div className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 mt-1 inline-block">{receipt.receipt_code}</div>
                                            </div>
                                        </div>
                                        {getStatusBadge(receipt.status)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">NCC</span><p className="text-xs font-bold text-slate-900">{receipt.supplier_name}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Kho nhận</span><p className="text-xs font-bold text-slate-600">{getWarehouseLabel(receipt.warehouse_id)}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Ngày nhập</span><p className="text-xs font-bold text-gray-600">{receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('vi-VN') : '—'}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Số MH</span><p className="text-xs font-black text-slate-900">{receipt.total_items}</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Tổng giá trị</span><p className="text-xs font-black text-rose-600">{new Intl.NumberFormat('vi-VN').format(receipt.total_amount || 0)} ₫</p></div>
                                        <div><span className="text-[9px] font-bold text-gray-400 uppercase">Người nhận</span><p className="text-xs font-bold text-gray-600">{receipt.received_by || '—'}</p></div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                                        {receipt.status === 'CHO_DUYET' && <button onClick={(e) => { e.stopPropagation(); handleApproveReceipt(receipt); }} className="p-2 text-emerald-500 hover:text-emerald-700 rounded-lg transition-colors" title="Duyệt"><CheckSquare className="w-5 h-5" /></button>}
                                        <button onClick={(e) => { e.stopPropagation(); handlePrintReceipt(receipt); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="In"><Printer className="w-5 h-5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); navigate('/tao-phieu-nhap', { state: { receipt } }); }} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-colors" title={receipt.status === 'CHO_DUYET' ? "Chỉnh sửa" : "Xem chi tiết"}><Edit className="w-5 h-5" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteReceipt(receipt.id, receipt.receipt_code); }} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors" title="Xóa"><Trash2 className="w-5 h-5" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-100">
                                        <th className="px-6 py-5 w-12 text-center border-r border-gray-100">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                checked={selectedIds.length === filteredReceipts.length && filteredReceipts.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center w-16">STT</th>
                                        {visibleTableColumns.map(col => (<th key={col.key} className={`px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ${col.key === 'items' || col.key === 'status' ? 'text-center' : ''}`}>{col.label}</th>))}
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center sticky right-0 bg-white/50 backdrop-blur-sm">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredReceipts.map((receipt, idx) => (
                                        <tr key={receipt.id} className={`hover:bg-emerald-50/30 transition-colors cursor-pointer ${selectedIds.includes(receipt.id) ? 'bg-emerald-50/20' : ''}`}>
                                            <td className="px-6 py-5 text-center border-r border-gray-50">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-md border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                    checked={selectedIds.includes(receipt.id)}
                                                    onChange={(e) => { e.stopPropagation(); toggleSelect(receipt.id); }}
                                                />
                                            </td>
                                            <td className="px-6 py-5 text-center text-sm font-bold text-gray-400">{idx + 1}</td>
                                            {isColumnVisible('code') && <td className="px-6 py-5"><span className="text-sm font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">{receipt.receipt_code}</span></td>}
                                            {isColumnVisible('supplier') && <td className="px-6 py-5 font-bold text-slate-900 text-sm">{receipt.supplier_name}</td>}
                                            {isColumnVisible('warehouse') && <td className="px-6 py-5"><span className="text-sm font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">{getWarehouseLabel(receipt.warehouse_id)}</span></td>}
                                            {isColumnVisible('date') && <td className="px-6 py-5 text-sm font-bold text-gray-600">{receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('vi-VN') : '—'}</td>}
                                            {isColumnVisible('items') && <td className="px-6 py-5 text-center text-sm font-black text-slate-900">{receipt.total_items}</td>}
                                            {isColumnVisible('amount') && <td className="px-6 py-5 text-right font-black text-rose-600">{new Intl.NumberFormat('vi-VN').format(receipt.total_amount || 0)} ₫</td>}
                                            {isColumnVisible('receiver') && <td className="px-6 py-5 text-sm font-bold text-gray-600">{receipt.received_by || '—'}</td>}
                                            {isColumnVisible('status') && <td className="px-6 py-5 text-center">{getStatusBadge(receipt.status)}</td>}
                                            <td className="px-6 py-5 text-center sticky right-0 bg-white/50 backdrop-blur-md">
                                                <div className="flex items-center justify-center gap-5">
                                                    {receipt.status === 'CHO_DUYET' && <button onClick={(e) => { e.stopPropagation(); handleApproveReceipt(receipt); }} className="text-emerald-500 hover:text-emerald-700 transition-all outline-none" title="Duyệt (Nhập kho)"><CheckSquare className="w-5 h-5 flex-shrink-0" /></button>}
                                                    <button onClick={(e) => { e.stopPropagation(); handlePrintReceipt(receipt); }} className="text-slate-400 hover:text-blue-600 transition-all outline-none" title="In phiếu nhập"><Printer className="w-5 h-5 flex-shrink-0" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); navigate('/tao-phieu-nhap', { state: { receipt } }); }} className="text-slate-400 hover:text-slate-900 transition-all outline-none" title={receipt.status === 'CHO_DUYET' ? "Chỉnh sửa" : "Xem chi tiết"}><Edit className="w-5 h-5 flex-shrink-0" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteReceipt(receipt.id, receipt.receipt_code); }} className="text-slate-400 hover:text-red-500 transition-all outline-none" title="Xóa"><Trash2 className="w-5 h-5 flex-shrink-0" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Hidden Print Template — rendered via Portal directly under <body> to bypass #root hiding */}
            {printData && createPortal(
                <div className="print-only-content">
                    <GoodsReceiptPrintTemplate receipt={printData?.receipt} items={printData?.items} warehousesList={warehousesList} />
                </div>,
                document.body
            )}
        </div>
    );
};

export default GoodsReceipts;
