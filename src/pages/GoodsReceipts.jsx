import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend as ChartLegend,
    Tooltip as ChartTooltip,
    LinearScale,
    LineElement,
    PointElement,
    Title
} from 'chart.js';
import { clsx } from 'clsx';
import {
    BarChart2,
    CheckCircle,
    CheckSquare,
    ChevronDown,
    ChevronLeft,
    Download,
    Edit,
    Filter,
    List,
    MoreVertical,
    Package,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
    X,
    Hash
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import GoodsReceiptPrintTemplate from '../components/GoodsReceiptPrintTemplate';
import GoodsReceiptFormModal from '../components/GoodsReceipts/GoodsReceiptFormModal';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import { RECEIPT_STATUSES, TABLE_COLUMNS } from '../constants/goodsReceiptConstants';
import { supabase } from '../supabase/config';
import { notificationService } from '../utils/notificationService';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    ChartLegend
);

const GoodsReceipts = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list'); // 'list' or 'stats'
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [printData, setPrintData] = useState(null);
    const [warehousesList, setWarehousesList] = useState([]);
    // Modal states
    const [showFormModal, setShowFormModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    // Column Picker State
    const defaultColOrder = TABLE_COLUMNS.map(col => col.key);
    const columnDefs = TABLE_COLUMNS.reduce((acc, col) => {
        acc[col.key] = { label: col.label };
        return acc;
    }, {});

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_goods_receipts_order') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                const valid = saved.filter(key => defaultColOrder.includes(key));
                const missing = defaultColOrder.filter(key => !valid.includes(key));
                return [...valid, ...missing];
            }
        } catch { }
        return defaultColOrder;
    });

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('columns_goods_receipts_visible') || 'null');
            if (Array.isArray(saved) && saved.length > 0) {
                return saved.filter(key => defaultColOrder.includes(key));
            }
        } catch { }
        return defaultColOrder;
    });

    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef(null);
    const columnPickerRef = useRef(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');
    const listDropdownRef = useRef(null);
    const statsDropdownRef = useRef(null);

    const visibleTableColumns = columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => TABLE_COLUMNS.find(col => col.key === key))
        .filter(Boolean);
    const visibleCount = visibleColumns.length;
    const totalCount = defaultColOrder.length;

    useEffect(() => {
        fetchReceipts();
        fetchWarehouses();
    }, []);

    useEffect(() => {
        localStorage.setItem('columns_goods_receipts_visible', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('columns_goods_receipts_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        if (isSearchExpanded && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchExpanded]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (columnPickerRef.current && !columnPickerRef.current.contains(event.target)) {
                setShowColumnPicker(false);
            }
        };
        if (showColumnPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showColumnPicker]);

    // Dropdown handlers
    useEffect(() => {
        const handleClickOutside = (event) => {
            const isClickInsideList = listDropdownRef.current && listDropdownRef.current.contains(event.target);
            const isClickInsideStats = statsDropdownRef.current && statsDropdownRef.current.contains(event.target);

            if (activeDropdown && !isClickInsideList && !isClickInsideStats) {
                setActiveDropdown(null);
                setFilterSearch('');
            }
            if (!event.target.closest('#more-actions-menu') && !event.target.closest('#more-actions-btn')) {
                setShowMoreActions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const fetchReceipts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('goods_receipts')
                .select('*, items:goods_receipt_items(item_name, item_type)')
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
            'Người giao hàng',
            'Địa chỉ người giao',
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
                'Người giao hàng': 'Trần Văn B',
                'Địa chỉ người giao': '123 Đường ABC, Quận 1, TP.HCM',
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
                'Người giao hàng': 'Trần Văn B',
                'Địa chỉ người giao': '123 Đường ABC, Quận 1, TP.HCM',
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
                        deliverer_name: row['Người giao hàng']?.toString() || '',
                        deliverer_address: row['Địa chỉ người giao']?.toString() || '',

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
                            deliverer_name: item.deliverer_name,
                            deliverer_address: item.deliverer_address,
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
                            deliverer_name: group.deliverer_name,
                            deliverer_address: group.deliverer_address,
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

            // Log notification
            await notificationService.add({
                title: 'Nhập kho thành công',
                description: `Phiếu nhập ${receipt.receipt_code} đã được phê duyệt và cập nhật tồn kho.`,
                type: 'success',
                link: '/bao-cao/kho'
            });

            alert('✅ Đã duyệt phiếu nhập và cập nhật tồn kho thành công!');
            fetchReceipts();
        } catch (error) {
            console.error('Error approving receipt:', error);
            alert('❌ Lỗi khi duyệt phiếu: ' + error.message);
        }
    };

    const getStatusBadge = (statusId) => {
        const statusObj = RECEIPT_STATUSES.find(s => s.id === statusId);
        if (!statusObj) return <span className="text-gray-400">—</span>;

        return (
            <span className={clsx(
                'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold',
                statusObj.color === 'blue' && 'bg-blue-100 text-blue-700',
                statusObj.color === 'yellow' && 'bg-amber-100 text-amber-700',
                statusObj.color === 'blue' && 'bg-blue-100 text-blue-700',
                statusObj.color === 'red' && 'bg-red-100 text-red-700',
                statusObj.color === 'gray' && 'bg-muted text-muted-foreground'
            )}>
                {statusObj.label}
            </span>
        );
    };

    const getWarehouseLabel = (id) => {
        return warehousesList.find(w => w.id === id)?.name || id;
    };

    const renderCell = (key, receipt) => {
        switch (key) {
            case 'code':
                return (
                    <span className="text-[13px] font-black text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">{receipt.receipt_code}</span>
                );
            case 'supplier':
                return <span className="text-[13px] font-bold text-slate-800">{receipt.supplier_name}</span>;
            case 'warehouse':
                return <span className="text-[13px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">{getWarehouseLabel(receipt.warehouse_id)}</span>;
            case 'date':
                return <span className="text-[13px] font-medium text-slate-500">{receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('vi-VN') : '—'}</span>;
            case 'items':
                return <span className="text-[13px] font-black text-slate-700">{receipt.total_items}</span>;
            case 'items_summary':
                return (
                    <div className="text-[12px] font-bold text-blue-600 truncate max-w-[250px]" title={receipt.items?.map(i => i.item_name).join(', ')}>
                        {receipt.items?.map(i => i.item_name).join(', ') || '—'}
                    </div>
                );
            case 'amount':
                return <span className="text-[13px] font-black text-rose-600 text-right block w-full">{formatNumber(receipt.total_amount || 0)} ₫</span>;
            case 'deliverer':
                return <span className="text-[13px] font-medium text-slate-800 italic">{receipt.deliverer_name || '—'}</span>;
            case 'deliverer_address':
                return <span className="text-[13px] font-medium text-slate-500 max-w-[200px] truncate block" title={receipt.deliverer_address}>{receipt.deliverer_address || '—'}</span>;
            case 'status':
                return getStatusBadge(receipt.status);
            default:
                return <span className="text-[13px]">{receipt[key] || '—'}</span>;
        }
    };



    const filteredReceipts = receipts.filter(r => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            r.receipt_code?.toLowerCase().includes(search) ||
            r.supplier_name?.toLowerCase().includes(search) ||
            r.deliverer_name?.toLowerCase().includes(search) ||
            r.deliverer_address?.toLowerCase().includes(search);
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(r.warehouse_id);
        
        const receiptType = r.items?.[0]?.item_type || 'MAY';
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(receiptType);

        return matchesSearch && matchesStatus && matchesWarehouse && matchesType;
    });

    const hasActiveFilters = selectedStatuses.length > 0 || selectedWarehouses.length > 0 || selectedTypes.length > 0;
    const totalActiveFilters = selectedStatuses.length + selectedWarehouses.length + selectedTypes.length;

    // Filter options
    const statusOptions = RECEIPT_STATUSES.filter(s => s.id !== 'ALL').map(s => ({
        id: s.id,
        label: s.label,
        count: receipts.filter(r => r.status === s.id).length
    }));

    const warehouseOptions = warehousesList.map(w => ({
        id: w.id,
        label: w.name,
        count: receipts.filter(r => r.warehouse_id === w.id).length
    }));

    const typeOptions = [
        { id: 'MAY', label: 'Hàng MÁY', count: receipts.filter(r => r.items?.[0]?.item_type === 'MAY').length },
        { id: 'BINH', label: 'Hàng BÌNH', count: receipts.filter(r => r.items?.[0]?.item_type === 'BINH').length },
    ];

    const getStatusStats = () => {
        const stats = {};
        filteredReceipts.forEach(r => {
            const statusLabel = RECEIPT_STATUSES.find(s => s.id === r.status)?.label || r.status;
            stats[statusLabel] = (stats[statusLabel] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const getWarehouseStats = () => {
        const stats = {};
        filteredReceipts.forEach(r => {
            const name = getWarehouseLabel(r.warehouse_id);
            stats[name] = (stats[name] || 0) + 1;
        });
        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    };

    const chartColors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

    const formatNumber = (num) => {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const getFilterButtonClass = (filterKey, isActive) => {
        if (!isActive) return 'border-border bg-white text-muted-foreground hover:text-foreground';
        switch (filterKey) {
            case 'status': return 'border-blue-200 bg-blue-50 text-blue-700';
            case 'warehouse': return 'border-blue-200 bg-blue-50 text-blue-700';
            case 'type': return 'border-indigo-200 bg-indigo-50 text-indigo-700';
            default: return 'border-primary bg-primary/5 text-primary';
        }
    };

    const getFilterCountBadgeClass = (filterKey) => {
        switch (filterKey) {
            case 'status': return 'bg-blue-600 text-white';
            case 'warehouse': return 'bg-blue-600 text-white';
            case 'type': return 'bg-indigo-600 text-white';
            default: return 'bg-primary text-white';
        }
    };

    const getFilterIconClass = (filterKey, isActive) => {
        switch (filterKey) {
            case 'status': return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'warehouse': return isActive ? 'text-blue-700' : 'text-blue-500';
            case 'type': return isActive ? 'text-indigo-700' : 'text-indigo-500';
            default: return isActive ? 'text-primary' : 'text-primary/80';
        }
    };

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingWarehouses, setPendingWarehouses] = useState([]);
    const [pendingTypes, setPendingTypes] = useState([]);

    const openMobileFilter = () => {
        setPendingStatuses(selectedStatuses);
        setPendingWarehouses(selectedWarehouses);
        setPendingTypes(selectedTypes || []);
        setShowMobileFilter(true);
    };

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 300);
    };

    const applyMobileFilter = () => {
        setSelectedStatuses(pendingStatuses);
        setSelectedWarehouses(pendingWarehouses);
        setSelectedTypes(pendingTypes);
        closeMobileFilter();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5 font-sans">
            {/* Top View Tabs */}
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveView('list')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'list'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <List size={14} />
                    Danh sách
                </button>
                <button
                    onClick={() => setActiveView('stats')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeView === 'stats'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <BarChart2 size={14} />
                    Thống kê
                </button>
            </div>

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                    {/* MOBILE TOOLBAR */}
                    <div className="md:hidden flex flex-col p-3 border-b border-border bg-white sticky top-0 z-30 shadow-subtle">
                        {/* Row 1: Back, Title, Plus */}
                        <div className="flex items-center justify-between mb-3 gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="p-2.5 rounded-xl border border-border bg-white text-muted-foreground flex items-center justify-center shadow-sm active:scale-95 transition-all"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <h1 className="text-lg font-black text-slate-900 tracking-tight">Phiếu nhập kho</h1>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedReceipt(null);
                                        setShowFormModal(true);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-[13px] font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                >
                                    <Plus size={18} />
                                    <span>Tạo mới</span>
                                </button>
                            </div>
                        </div>

                        {/* Row 2: Selection, Search, Filter, More Actions */}
                        <div className="flex items-center gap-2 min-h-[44px]">
                            {!isSearchExpanded ? (
                                <>
                                    <div className="flex items-center gap-2 pr-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredReceipts.length && filteredReceipts.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1"></div>
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center shadow-sm active:scale-95 transition-all"
                                    >
                                        <Search size={20} />
                                    </button>
                                </>
                            ) : (
                                <div className="relative flex-1 group animate-in slide-in-from-right-2 duration-200">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" size={16} />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Tìm mã phiếu, NCC..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                        className="w-full pl-10 pr-20 py-2.5 bg-white border-2 border-primary/30 rounded-xl text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-semibold shadow-sm"
                                    />
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setIsSearchExpanded(false)}
                                            className="px-2 py-1 text-[12px] font-black text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        >
                                            Đóng
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isSearchExpanded && (
                                <>
                                    <button
                                        onClick={openMobileFilter}
                                        className={clsx(
                                            'relative p-2.5 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm',
                                            hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600',
                                        )}
                                    >
                                        <Filter size={20} />
                                        {hasActiveFilters && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                                                {totalActiveFilters}
                                            </span>
                                        )}
                                    </button>

                                    <div className="relative">
                                        <button
                                            id="more-actions-btn"
                                            onClick={() => setShowMoreActions(!showMoreActions)}
                                            className={clsx(
                                                "p-2.5 rounded-xl border shrink-0 transition-all active:scale-95 shadow-sm",
                                                showMoreActions ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200 text-slate-600"
                                            )}
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        {showMoreActions && (
                                            <div id="more-actions-menu" className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                                                <button
                                                    onClick={() => { exportToExcel(); setShowMoreActions(false); }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                                >
                                                    <Download size={18} className="text-slate-400" />
                                                    Xuất Excel
                                                </button>

                                                <label className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
                                                    <Upload size={18} className="text-slate-400" />
                                                    Import Excel
                                                    <input
                                                        type="file"
                                                        accept=".xlsx, .xls"
                                                        onChange={(e) => { handleImportExcel(e); setShowMoreActions(false); }}
                                                        className="hidden"
                                                    />
                                                </label>

                                                {selectedIds.length > 0 && (
                                                    <button
                                                        onClick={() => { handleBulkDelete(); setShowMoreActions(false); }}
                                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                        Xóa ({selectedIds.length})
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* DESKTOP TOOLBAR */}
                    <div className="hidden md:block p-3 space-y-3 bg-white">
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
                                        placeholder="Tìm mã phiếu, NCC..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative" ref={columnPickerRef}>
                                    <button
                                        onClick={() => setShowColumnPicker(prev => !prev)}
                                        className={clsx(
                                            'flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm',
                                            showColumnPicker
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-border text-muted-foreground hover:bg-muted/20'
                                        )}
                                    >
                                        <SlidersHorizontal size={16} />
                                        Cột ({visibleCount}/{totalCount})
                                    </button>
                                    {showColumnPicker && (
                                        <ColumnPicker
                                            columnOrder={columnOrder}
                                            setColumnOrder={setColumnOrder}
                                            visibleColumns={visibleColumns}
                                            setVisibleColumns={setVisibleColumns}
                                            defaultColOrder={defaultColOrder}
                                            columnDefs={columnDefs}
                                        />
                                    )}
                                </div>
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-[13px] font-bold hover:bg-indigo-100 transition-all shadow-sm"
                                    title="Tải mẫu Excel"
                                >
                                    <Download size={16} />
                                    Tải mẫu
                                </button>
                                <label className="flex items-center gap-2 px-4 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-bold hover:bg-blue-100 transition-all shadow-sm cursor-pointer" title="Nhập Excel">
                                    <Upload size={16} />
                                    Nhập file
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleImportExcel}
                                        className="hidden"
                                    />
                                </label>
                                <button
                                    onClick={() => {
                                        setSelectedReceipt(null);
                                        setShowFormModal(true);
                                    }}
                                    className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                                >
                                    <Plus size={18} />
                                    Tạo phiếu nhập mới
                                </button>
                            </div>
                        </div>

                        {/* Secondary Filters */}
                        <div className="flex flex-wrap items-center gap-2" ref={listDropdownRef}>
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'status') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'status' ? null : 'status');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                        getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <Filter size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('status'))}>
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
                                </button>
                                {activeDropdown === 'status' && (
                                    <FilterDropdown
                                        options={statusOptions}
                                        selected={selectedStatuses}
                                        setSelected={setSelectedStatuses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'type') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'type' ? null : 'type');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                        getFilterButtonClass('type', activeDropdown === 'type' || selectedTypes.length > 0)
                                    )}
                                >
                                    <Hash size={14} className={getFilterIconClass('type', activeDropdown === 'type' || selectedTypes.length > 0)} />
                                    Loại hàng
                                    {selectedTypes.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('type'))}>
                                            {selectedTypes.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'type' ? "rotate-180" : "")} />
                                </button>
                                {activeDropdown === 'type' && (
                                    <FilterDropdown
                                        options={typeOptions}
                                        selected={selectedTypes}
                                        setSelected={setSelectedTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'warehouse') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                        getFilterButtonClass('warehouse', activeDropdown === 'warehouse' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <Package size={14} className={getFilterIconClass('warehouse', activeDropdown === 'warehouse' || selectedWarehouses.length > 0)} />
                                    Kho nhận
                                    {selectedWarehouses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouse'))}>
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouse' ? "rotate-180" : "")} />
                                </button>
                                {activeDropdown === 'warehouse' && (
                                    <FilterDropdown
                                        options={warehouseOptions}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSelectedStatuses([]);
                                        setSelectedWarehouses([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    {/* TABLE DATA AREA */}
                    <div className="flex-1 overflow-auto bg-[#f8fafc]/50">
                        {loading ? (
                            <div className="p-16 text-center">
                                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-muted-foreground font-bold text-sm italic">Đang tải dữ liệu...</p>
                            </div>
                        ) : filteredReceipts.length === 0 ? (
                            <div className="p-16 text-center">
                                <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold text-base mb-1">Chưa có phiếu nhập nào</p>
                                <p className="text-slate-300 text-xs italic">Nhấn "Tạo phiếu nhập mới" để bắt đầu</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile View Cards */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {filteredReceipts.map((receipt) => (
                                        <div key={receipt.id} className="p-4 bg-white border-b border-gray-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                        checked={selectedIds.includes(receipt.id)}
                                                        onChange={() => toggleSelect(receipt.id)}
                                                    />
                                                    <span className="text-sm font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">{receipt.receipt_code}</span>
                                                </div>
                                                {getStatusBadge(receipt.status)}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Nhà cung cấp</span>
                                                    <p className="text-xs font-bold text-slate-800">{receipt.supplier_name}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Kho nhận</span>
                                                    <p className="text-xs font-bold text-slate-600">{getWarehouseLabel(receipt.warehouse_id)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Ngày nhập</span>
                                                    <p className="text-xs font-medium text-slate-600">{receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('vi-VN') : '—'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Số dòng</span>
                                                    <p className="text-xs font-black text-slate-900">{receipt.total_items}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Mặt hàng</span>
                                                    <p className="text-[11px] font-bold text-blue-600 line-clamp-2">
                                                        {receipt.items?.map(i => i.item_name).join(', ') || '—'}
                                                    </p>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block mb-0.5">Tổng giá trị</span>
                                                    <p className="text-sm font-black text-rose-600">{formatNumber(receipt.total_amount || 0)} <small className="text-[10px]">₫</small></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-50">
                                                {receipt.status === 'CHO_DUYET' && (
                                                    <button onClick={() => handleApproveReceipt(receipt)} className="p-2 text-blue-600 bg-blue-50 rounded-lg" title="Duyệt"><CheckSquare className="w-5 h-5" /></button>
                                                )}
                                                <button onClick={() => handlePrintReceipt(receipt)} className="p-2 text-slate-400 bg-slate-50 rounded-lg" title="In"><Printer className="w-5 h-5" /></button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedReceipt(receipt);
                                                        setShowFormModal(true);
                                                    }}
                                                    className="p-2 text-slate-400 bg-slate-50 rounded-lg"
                                                    title="Chi tiết"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDeleteReceipt(receipt.id, receipt.receipt_code)} className="p-2 text-red-400 bg-red-50 rounded-lg" title="Xóa"><Trash2 className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>


                                {/* Desktop View Table */}
                                <div className="hidden md:block">
                                    <table className="w-full border-collapse">
                                        <thead className="bg-[#F1F5FF] sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3.5 w-10">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                            checked={selectedIds.length === filteredReceipts.length && filteredReceipts.length > 0}
                                                            onChange={toggleSelectAll}
                                                        />
                                                    </div>
                                                </th>
                                                {visibleTableColumns.map(col => (
                                                    <th key={col.key} className="px-4 py-3.5 text-[12px] font-bold text-slate-500 text-left uppercase tracking-wider">
                                                        {col.label}
                                                    </th>
                                                ))}
                                                <th className="sticky right-0 z-20 bg-[#F1F5FF] px-4 py-3.5 text-[12px] font-bold text-slate-500 text-center uppercase tracking-wider shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.1)]">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {filteredReceipts.map((receipt) => (
                                                <tr key={receipt.id} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                                                                checked={selectedIds.includes(receipt.id)}
                                                                onChange={() => toggleSelect(receipt.id)}
                                                            />
                                                        </div>
                                                    </td>
                                                    {visibleTableColumns.map(col => (
                                                        <td key={col.key} className={clsx(
                                                            "px-4 py-4",
                                                            col.key === 'items' && "text-center",
                                                            col.key === 'code' && "whitespace-nowrap min-w-[140px]",
                                                            col.key === 'amount' && "text-right",
                                                            (col.key === 'deliverer_address' || col.key === 'items_summary') && "max-w-[200px] truncate"
                                                        )}>
                                                            {renderCell(col.key, receipt)}
                                                        </td>
                                                    ))}
                                                    <td className="sticky right-0 z-10 bg-white px-4 py-4 shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.1)]">
                                                        <div className="flex items-center justify-center gap-3">
                                                            {receipt.status === 'CHO_DUYET' && (
                                                                <button onClick={() => handleApproveReceipt(receipt)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duyệt phiếu"><CheckSquare size={16} /></button>
                                                            )}
                                                            <button onClick={() => handlePrintReceipt(receipt)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="In phiếu"><Printer size={16} /></button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedReceipt(receipt);
                                                                    setShowFormModal(true);
                                                                }}
                                                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteReceipt(receipt.id, receipt.receipt_code)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa phiếu"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 sticky bottom-0 z-10">
                                            <tr>
                                                <td colSpan={visibleTableColumns.length + 2} className="px-4 py-3 text-[12px] font-bold text-slate-500">
                                                    Tổng số: {filteredReceipts.length} phiếu | Tổng giá trị: <span className="text-rose-600">{formatNumber(filteredReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0))} đ</span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col w-full md:flex-1 md:min-h-0 md:overflow-hidden">
                    {/* Mobile Header */}
                    <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl border border-border bg-white text-muted-foreground shrink-0"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-base font-bold text-foreground flex-1 text-center">Thống kê</h2>
                        <button
                            onClick={openMobileFilter}
                            className={clsx(
                                'relative p-2 rounded-xl border shrink-0 transition-all',
                                hasActiveFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-muted-foreground',
                            )}
                        >
                            <Filter size={18} />
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
                                    {totalActiveFilters}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden md:block p-4 border-b border-border" ref={statsDropdownRef}>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => navigate(-1)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] font-bold transition-all bg-white shadow-sm shrink-0"
                            >
                                <ChevronLeft size={16} />
                                Quay lại
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'status') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'status' ? null : 'status');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                        getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)
                                    )}
                                >
                                    <Filter size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('status'))}>
                                            {selectedStatuses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? "rotate-180" : "")} />
                                </button>
                                {activeDropdown === 'status' && (
                                    <FilterDropdown
                                        options={statusOptions}
                                        selected={selectedStatuses}
                                        setSelected={setSelectedStatuses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (activeDropdown !== 'warehouse') setFilterSearch('');
                                        setActiveDropdown(activeDropdown === 'warehouse' ? null : 'warehouse');
                                    }}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all",
                                        getFilterButtonClass('warehouse', activeDropdown === 'warehouse' || selectedWarehouses.length > 0)
                                    )}
                                >
                                    <Package size={14} className={getFilterIconClass('warehouse', activeDropdown === 'warehouse' || selectedWarehouses.length > 0)} />
                                    Kho nhận
                                    {selectedWarehouses.length > 0 && (
                                        <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-bold', getFilterCountBadgeClass('warehouse'))}>
                                            {selectedWarehouses.length}
                                        </span>
                                    )}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'warehouse' ? "rotate-180" : "")} />
                                </button>
                                {activeDropdown === 'warehouse' && (
                                    <FilterDropdown
                                        options={warehouseOptions}
                                        selected={selectedWarehouses}
                                        setSelected={setSelectedWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSelectedStatuses([]);
                                        setSelectedWarehouses([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    <X size={14} />
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:flex-1 md:overflow-auto px-3 md:px-4 pt-4 md:pt-5 pb-5 md:pb-6 space-y-5">
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <Package className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng số phiếu</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">{filteredReceipts.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-blue-200/70">
                                        <CheckCircle className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Tổng giá trị</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">{formatNumber(filteredReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0))}đ</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-start gap-4">
                                    <div className="w-12 h-12 bg-amber-100/80 rounded-full flex items-center justify-center shrink-0 ring-1 ring-amber-200/70">
                                        <BarChart2 className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Giá trị trung bình</p>
                                        <p className="text-3xl font-bold text-foreground mt-1">
                                            {formatNumber(filteredReceipts.length > 0 ? Math.round(filteredReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0) / filteredReceipts.length) : 0)}đ
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Charts Area */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-foreground mb-4">Trạng thái phiếu nhập</h3>
                                <div style={{ height: '300px' }}>
                                    <PieChartJS
                                        data={{
                                            labels: getStatusStats().map(item => item.name),
                                            datasets: [{
                                                data: getStatusStats().map(item => item.value),
                                                backgroundColor: chartColors.slice(0, getStatusStats().length),
                                                borderColor: '#fff',
                                                borderWidth: 2
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { position: 'bottom' } }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                                <h3 className="text-base font-bold text-foreground mb-4">Phân bổ theo kho nhận</h3>
                                <div style={{ height: '300px' }}>
                                    <BarChartJS
                                        data={{
                                            labels: getWarehouseStats().map(item => item.name),
                                            datasets: [{
                                                label: 'Số lượng phiếu',
                                                data: getWarehouseStats().map(item => item.value),
                                                backgroundColor: chartColors[0],
                                                borderRadius: 8
                                            }]
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: { legend: { display: false } },
                                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Filter Sheet */}
            {showMobileFilter && (
                <MobileFilterSheet
                    isOpen={showMobileFilter}
                    isClosing={mobileFilterClosing}
                    onClose={closeMobileFilter}
                    onApply={applyMobileFilter}
                    sections={[
                        {
                            id: 'status',
                            label: 'Trạng thái',
                            icon: <Filter size={16} className="text-blue-600" />,
                            options: statusOptions,
                            selectedValues: pendingStatuses,
                            onSelectionChange: setPendingStatuses
                        },
                        {
                            id: 'warehouse',
                            label: 'Kho nhận',
                            icon: <Package size={16} className="text-blue-600" />,
                            options: warehouseOptions,
                            selectedValues: pendingWarehouses,
                            onSelectionChange: setPendingWarehouses
                        },
                        {
                            id: 'type',
                            label: 'Loại hàng',
                            icon: <Hash size={16} className="text-indigo-600" />,
                            options: typeOptions,
                            selectedValues: pendingTypes,
                            onSelectionChange: setPendingTypes
                        }
                    ]}
                />
            )}

            {/* Goods Receipt Form Modal */}
            {showFormModal && (
                <GoodsReceiptFormModal
                    receipt={selectedReceipt}
                    onClose={() => setShowFormModal(false)}
                    onSuccess={() => {
                        fetchReceipts();
                        toast.success(selectedReceipt ? 'Đã cập nhật phiếu nhập!' : 'Đã tạo phiếu nhập mới!');
                    }}
                />
            )}

            {/* Print Portal */}
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
