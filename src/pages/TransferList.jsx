import { clsx } from 'clsx';
import {
    ArrowLeftRight,
    BarChart2,
    Calendar,
    ChevronDown,
    ChevronLeft,
    Copy,
    Eye,
    FileText,
    Filter,
    List,
    MoreVertical,
    Package,
    Plus,
    Printer,
    Search,
    CheckCircle2,
    Camera,
    PenLine,
    SlidersHorizontal,
    Trash2,
    X,
    Warehouse,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import MobilePageHeader from '../components/layout/MobilePageHeader';
import PageViewSwitcher from '../components/layout/PageViewSwitcher';
import ColumnPicker from '../components/ui/ColumnPicker';
import FilterDropdown from '../components/ui/FilterDropdown';
import MobileFilterSheet from '../components/ui/MobileFilterSheet';
import PrintOptionsModal from '../components/Orders/PrintOptionsModal';
import usePermissions from '../hooks/usePermissions';
import { supabase } from '../supabase/config';
import { isAdminRole, isWarehouseRole } from '../utils/accessControl';

const PAGE_SIZE = 30;
const DEFAULT_COLUMN_ORDER = ['code', 'status', 'transaction_type', 'from', 'to', 'items', 'qty', 'note', 'date'];
const COLUMN_DEFS = {
    code: { label: 'Mã phiếu' },
    status: { label: 'Trạng thái' },
    transaction_type: { label: 'Loại GD' },
    from: { label: 'Kho xuất' },
    to: { label: 'Kho nhận' },
    items: { label: 'Hàng hóa' },
    qty: { label: 'Số lượng' },
    note: { label: 'Ghi chú' },
    date: { label: 'Ngày tạo' },
};

const normalizeText = (text = '') =>
    text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));

const parseTransferNote = (note = '') => {
    const toMatch = note.match(/Điều chuyển tới (.+?)\./);
    const imgMatch = note.match(/\[Ảnh Bàn Giao\]:\s*(.+)/);
    const codesMatch = note.match(/Mã cụ thể:\s*\[([^\]]*)\]/);
    const codes = codesMatch?.[1]
        ? codesMatch[1].split(',').map((c) => c.trim()).filter(Boolean)
        : [];

    const cleanNote = note
        .replace(/Mã cụ thể:\s*\[[^\]]*\]/g, '')
        .replace(/\[Ảnh Bàn Giao\]:\s*.+/g, '')
        .trim();

    return {
        toWarehouseFromNote: toMatch?.[1]?.trim() || '',
        imageUrl: imgMatch?.[1]?.trim() || '',
        codes,
        cleanNote,
    };
};

const FILTER_TONES = {
    status: {
        active: 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm',
        idle: 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50/40',
        icon: 'text-blue-600',
    },
    tx_type: {
        active: 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm',
        idle: 'border-slate-200 bg-white text-slate-600 hover:bg-violet-50/40',
        icon: 'text-violet-600',
    },
    type: {
        active: 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm',
        idle: 'border-slate-200 bg-white text-slate-600 hover:bg-amber-50/40',
        icon: 'text-amber-600',
    },
    from: {
        active: 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm',
        idle: 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50/40',
        icon: 'text-emerald-600',
    },
    to: {
        active: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 shadow-sm',
        idle: 'border-slate-200 bg-white text-slate-600 hover:bg-fuchsia-50/40',
        icon: 'text-fuchsia-600',
    },
};

const getFilterButtonClass = (key, active) => {
    const tone = FILTER_TONES[key] || FILTER_TONES.status;
    return active ? tone.active : tone.idle;
};

const getFilterIconClass = (key, active) => {
    const tone = FILTER_TONES[key] || FILTER_TONES.status;
    return active ? '' : tone.icon;
};

const getTransferStatusClass = (status) => {
    if (status === 'DA_DUYET') return 'px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase';
    if (status === 'HUY_DON' || status === 'TU_CHOI') return 'px-2 py-1 rounded-lg text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 uppercase';
    return 'px-2 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase';
};

const itemTypeBadgeClass = (type) =>
    type === 'BINH'
        ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200'
        : type === 'MAY'
            ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200';

const columnTonePillClass = {
    transaction_type: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200',
    from: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200',
    to: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
    qty: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200',
};

export default function TransferList() {
    const navigate = useNavigate();
    const { role } = usePermissions();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState('list');
    const [currentPage, setCurrentPage] = useState(1);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSearch, setFilterSearch] = useState('');

    const [selectedItemTypes, setSelectedItemTypes] = useState([]);
    const [selectedFromWarehouses, setSelectedFromWarehouses] = useState([]);
    const [selectedToWarehouses, setSelectedToWarehouses] = useState([]);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [selectedTransactionTypes, setSelectedTransactionTypes] = useState([]);

    const [showMobileFilter, setShowMobileFilter] = useState(false);
    const [mobileFilterClosing, setMobileFilterClosing] = useState(false);
    const [pendingItemTypes, setPendingItemTypes] = useState([]);
    const [pendingFromWarehouses, setPendingFromWarehouses] = useState([]);
    const [pendingToWarehouses, setPendingToWarehouses] = useState([]);
    const [pendingStatuses, setPendingStatuses] = useState([]);
    const [pendingTransactionTypes, setPendingTransactionTypes] = useState([]);
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMN_ORDER);
    const [activeRowMenu, setActiveRowMenu] = useState(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [detailRecord, setDetailRecord] = useState(null);
    const [actionRecord, setActionRecord] = useState(null);
    const [actionTab, setActionTab] = useState('actions');
    const [transferChecklist, setTransferChecklist] = useState({});
    const [confirmTransferCheck, setConfirmTransferCheck] = useState(false);
    const [handoverProofBase64, setHandoverProofBase64] = useState('');
    const [receiverName, setReceiverName] = useState('');
    const [signatureBase64, setSignatureBase64] = useState('');
    const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
    const signatureCanvasRef = useRef(null);
    const isDrawingRef = useRef(false);
    const [transferFormModal, setTransferFormModal] = useState(null); // { mode: 'view' | 'edit', record }
    const [editingNote, setEditingNote] = useState('');
    const [editingItems, setEditingItems] = useState([]);
    const [savingTransfer, setSavingTransfer] = useState(false);
    const [printRecord, setPrintRecord] = useState(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [printOptions, setPrintOptions] = useState({ copies: 2, paperSize: 'A5', orientation: 'landscape' });
    const [deleteRecord, setDeleteRecord] = useState(null);
    const [deletingTransfer, setDeletingTransfer] = useState(false);
    const rowMenuRef = useRef(null);
    const columnPickerRef = useRef(null);
    const ROW_MENU_WIDTH = 220;

    const openRowMenuAtButton = (recordId, event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const margin = 8;
        const preferredLeft = rect.right - ROW_MENU_WIDTH;
        const clampedLeft = Math.max(
            margin,
            Math.min(preferredLeft, window.innerWidth - ROW_MENU_WIDTH - margin)
        );
        const clampedTop = Math.min(rect.bottom + margin, window.innerHeight - margin);

        setMenuPosition({ top: clampedTop, left: clampedLeft });
        setActiveRowMenu(recordId);
    };

    useEffect(() => {
        fetchTransfers();
    }, []);
    useEffect(() => {
        localStorage.setItem('columns_transfer', JSON.stringify(visibleColumns));
    }, [visibleColumns]);
    useEffect(() => {
        localStorage.setItem('columns_transfer_order', JSON.stringify(columnOrder));
    }, [columnOrder]);
    useEffect(() => {
        const onClickOutside = (e) => {
            if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) setActiveRowMenu(null);
            if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) setShowColumnPicker(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const { data: transferRows, error: transferError } = await supabase
                .from('inventory_transfer_requests')
                .select('*')
                .order('created_at', { ascending: false });
            if (transferError) throw transferError;

            const { data: warehouseRows, error: whError } = await supabase
                .from('warehouses')
                .select('id, name');
            if (whError) throw whError;

            const whMap = Object.fromEntries((warehouseRows || []).map((w) => [w.id, w.name]));
            const normalized = (transferRows || []).map((row) => {
                const items = Array.isArray(row.items_json) ? row.items_json : [];
                const fromWarehouseName = whMap[row.from_warehouse_id] || row.from_warehouse_id || '—';
                const toWarehouseName = whMap[row.to_warehouse_id] || row.to_warehouse_id || '—';

                return {
                    id: row.id,
                    transferCode: row.transfer_code,
                    status: row.status || 'CHO_DUYET',
                    transactionType: 'TRANSFER',
                    createdAt: row.created_at,
                    approvedAt: row.approved_at,
                    approvedBy: row.approved_by || '',
                    createdBy: row.created_by || '',
                    fromWarehouseId: row.from_warehouse_id,
                    toWarehouseId: row.to_warehouse_id,
                    fromWarehouses: [fromWarehouseName],
                    toWarehouses: [toWarehouseName],
                    itemTypes: [...new Set(items.map((item) => item.item_type || 'KHAC'))],
                    totalQuantity: row.total_quantity || items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
                    notes: row.note ? [row.note] : [],
                    rawNotes: row.note ? [row.note] : [],
                    images: row.handover_image_url ? [row.handover_image_url] : [],
                    referenceIds: [],
                    inventoryIds: [],
                    transactionIds: [],
                    items: items.map((item) => ({
                        itemName: item.item_name || '—',
                        itemType: item.item_type || 'KHAC',
                        quantity: Number(item.quantity) || 0,
                        codes: (item.specific_codes || []).map((entry) => entry?.code).filter(Boolean),
                    })),
                };
            });

            setRecords(normalized);
        } catch (error) {
            console.error('Error loading transfer records:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = useMemo(() => {
        const q = normalizeText(searchTerm);
        return records.filter((r) => {
            const matchesSearch =
                !q ||
                normalizeText(r.transferCode).includes(q) ||
                normalizeText(r.fromWarehouses.join(' ')).includes(q) ||
                normalizeText(r.toWarehouses.join(' ')).includes(q) ||
                normalizeText(r.items.map((i) => i.itemName).join(' ')).includes(q);

            const matchesItemType =
                selectedItemTypes.length === 0 || selectedItemTypes.some((t) => r.itemTypes.includes(t));
            const matchesFromWh =
                selectedFromWarehouses.length === 0 ||
                selectedFromWarehouses.some((w) => r.fromWarehouses.includes(w));
            const matchesToWh =
                selectedToWarehouses.length === 0 ||
                selectedToWarehouses.some((w) => r.toWarehouses.includes(w));
            const matchesStatus =
                selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
            const matchesTxType =
                selectedTransactionTypes.length === 0 ||
                selectedTransactionTypes.includes(r.transactionType || 'OUT');

            return matchesSearch && matchesItemType && matchesFromWh && matchesToWh && matchesStatus && matchesTxType;
        });
    }, [records, searchTerm, selectedItemTypes, selectedFromWarehouses, selectedToWarehouses, selectedStatuses, selectedTransactionTypes]);

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedItemTypes, selectedFromWarehouses, selectedToWarehouses, selectedStatuses, selectedTransactionTypes]);

    const itemTypeOptions = useMemo(() => {
        const all = [...new Set(records.flatMap((r) => r.itemTypes))];
        return all.map((id) => ({
            id,
            label: id === 'BINH' ? 'Bình' : id === 'MAY' ? 'Máy' : id,
            count: records.filter((r) => r.itemTypes.includes(id)).length,
        }));
    }, [records]);

    const fromWarehouseOptions = useMemo(() => {
        const all = [...new Set(records.flatMap((r) => r.fromWarehouses))].filter(Boolean);
        return all.map((id) => ({ id, label: id, count: records.filter((r) => r.fromWarehouses.includes(id)).length }));
    }, [records]);

    const toWarehouseOptions = useMemo(() => {
        const all = [...new Set(records.flatMap((r) => r.toWarehouses))].filter(Boolean);
        return all.map((id) => ({ id, label: id, count: records.filter((r) => r.toWarehouses.includes(id)).length }));
    }, [records]);
    const statusOptions = useMemo(() => {
        const all = [...new Set(records.map((r) => r.status).filter(Boolean))];
        return all.map((id) => ({ id, label: id, count: records.filter((r) => r.status === id).length }));
    }, [records]);
    const transactionTypeOptions = useMemo(() => {
        const all = [...new Set(records.map((r) => r.transactionType || 'OUT').filter(Boolean))];
        return all.map((id) => ({ id, label: id, count: records.filter((r) => (r.transactionType || 'OUT') === id).length }));
    }, [records]);

    const hasActiveFilters =
        selectedItemTypes.length > 0 ||
        selectedFromWarehouses.length > 0 ||
        selectedToWarehouses.length > 0 ||
        selectedStatuses.length > 0 ||
        selectedTransactionTypes.length > 0;
    const totalActiveFilters =
        selectedItemTypes.length + selectedFromWarehouses.length + selectedToWarehouses.length + selectedStatuses.length + selectedTransactionTypes.length;

    const totalTransfers = filteredRecords.length;
    const totalItems = filteredRecords.reduce((sum, r) => sum + r.items.length, 0);
    const totalQty = filteredRecords.reduce((sum, r) => sum + r.totalQuantity, 0);
    const visibleTableColumns = columnOrder.filter((key) => visibleColumns.includes(key));

    const openMobileFilter = () => {
        setPendingItemTypes(selectedItemTypes);
        setPendingFromWarehouses(selectedFromWarehouses);
        setPendingToWarehouses(selectedToWarehouses);
        setPendingStatuses(selectedStatuses);
        setPendingTransactionTypes(selectedTransactionTypes);
        setShowMobileFilter(true);
    };

    const closeMobileFilter = () => {
        setMobileFilterClosing(true);
        setTimeout(() => {
            setShowMobileFilter(false);
            setMobileFilterClosing(false);
        }, 280);
    };

    const applyMobileFilter = () => {
        setSelectedItemTypes(pendingItemTypes);
        setSelectedFromWarehouses(pendingFromWarehouses);
        setSelectedToWarehouses(pendingToWarehouses);
        setSelectedStatuses(pendingStatuses);
        setSelectedTransactionTypes(pendingTransactionTypes);
        closeMobileFilter();
    };
    const handlePrintTransfer = (record, options = printOptions) => {
        const html = `
            <html>
                <head><title>Phiếu điều chuyển ${record.transferCode}</title></head>
                <body style="font-family: Arial; padding: 24px;">
                    <h2>Phiếu điều chuyển: ${record.transferCode}</h2>
                    <p><b>Số bản in:</b> ${options.copies || 1}</p>
                    <p><b>Khổ giấy:</b> ${options.paperSize || 'A5'} ${options.orientation === 'portrait' ? '(Dọc)' : '(Ngang)'}</p>
                    <p><b>Kho xuất:</b> ${record.fromWarehouses.join(', ') || '—'}</p>
                    <p><b>Kho nhận:</b> ${record.toWarehouses.join(', ') || '—'}</p>
                    <p><b>Ngày tạo:</b> ${new Date(record.createdAt).toLocaleString('vi-VN')}</p>
                    <p><b>Tổng số lượng:</b> ${record.totalQuantity}</p>
                    <hr/>
                    ${record.items.map((item) => `<div>${item.itemName} (${item.itemType}) x ${item.quantity}</div>`).join('')}
                </body>
            </html>
        `;
        const printWin = window.open('', '_blank');
        if (!printWin) return;
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 120);
    };
    const openPrintOptions = (record) => {
        setPrintRecord(record);
        setIsPrintModalOpen(true);
    };
    const executeTransferPrint = (options) => {
        if (!printRecord) return;
        setPrintOptions(options);
        handlePrintTransfer(printRecord, options);
        setIsPrintModalOpen(false);
        setPrintRecord(null);
    };
    const handleDeleteTransfer = async (record) => {
        if (!record) return;
        setDeletingTransfer(true);
        const { error } = await supabase
            .from('inventory_transfer_requests')
            .delete()
            .eq('id', record.id);
        setDeletingTransfer(false);
        if (error) return;
        setActiveRowMenu(null);
        setActionRecord(null);
        setDeleteRecord(null);
        fetchTransfers();
    };
    useEffect(() => {
        if (!actionRecord) return;
        const nextChecklist = {};
        actionRecord.items.forEach((item, idx) => {
            nextChecklist[`${idx}:${item.itemName}:${item.itemType}`] = false;
        });
        setTransferChecklist(nextChecklist);
        setConfirmTransferCheck(false);
        setHandoverProofBase64('');
        setReceiverName('');
        setSignatureBase64('');
    }, [actionRecord?.id]);

    const handleHandoverImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setHandoverProofBase64(reader.result);
        reader.readAsDataURL(file);
    };

    const startDraw = (x, y) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        isDrawingRef.current = true;
    };
    const drawLine = (x, y) => {
        const canvas = signatureCanvasRef.current;
        if (!canvas || !isDrawingRef.current) return;
        const ctx = canvas.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    const endDraw = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas || !isDrawingRef.current) return;
        isDrawingRef.current = false;
        setSignatureBase64(canvas.toDataURL('image/png'));
    };
    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureBase64('');
    };

    const uploadDataUrl = async (dataUrl, fileName) => {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('delivery_proofs').upload(fileName, blob, {
            contentType: blob.type || 'image/png',
            upsert: true,
        });
        if (error) throw error;
        const { data } = supabase.storage.from('delivery_proofs').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const handleConfirmTransferHandover = async () => {
        if (!actionRecord) return;
        if (!confirmTransferCheck) {
            alert('Bạn cần xác nhận đã bàn giao hàng cho kho nhận.');
            return;
        }
        if (!handoverProofBase64) {
            alert('Bạn cần chụp ảnh xác nhận bàn giao.');
            return;
        }
        if (!receiverName.trim()) {
            alert('Bạn cần nhập tên người ký nhận kho nhận.');
            return;
        }
        if (!signatureBase64) {
            alert('Bạn cần ký nhận trước khi xác nhận.');
            return;
        }

        setIsSubmittingHandover(true);
        try {
            const stamp = Date.now();
            const proofUrl = await uploadDataUrl(
                handoverProofBase64,
                `transfer_${actionRecord.transferCode}_proof_${stamp}.png`
            );
            const signUrl = await uploadDataUrl(
                signatureBase64,
                `transfer_${actionRecord.transferCode}_signature_${stamp}.png`
            );

            const checklistDone = Object.keys(transferChecklist).filter((k) => transferChecklist[k]);
            const appendLines = [
                `[Kho Nhan Xac Nhan]: TRUE`,
                `[Nguoi Ky Nhan]: ${receiverName.trim()}`,
                `[Anh Kho Nhan]: ${proofUrl}`,
                `[Chu Ky Kho Nhan]: ${signUrl}`,
                `[Checklist Kho Nhan]: ${JSON.stringify(checklistDone)}`,
                `[Thoi Gian Xac Nhan]: ${new Date().toISOString()}`,
            ].join('\n');

            const { data: requestRow, error: loadErr } = await supabase
                .from('inventory_transfer_requests')
                .select('id, note')
                .eq('id', actionRecord.id)
                .maybeSingle();
            if (loadErr) throw loadErr;

            const nextNote = `${requestRow?.note || ''}\n${appendLines}`.trim();
            const { error: updateErr } = await supabase
                .from('inventory_transfer_requests')
                .update({
                    note: nextNote,
                    handover_image_url: proofUrl
                })
                .eq('id', actionRecord.id);
            if (updateErr) throw updateErr;

            setActionRecord(null);
            fetchTransfers();
        } catch (error) {
            console.error('Confirm transfer handover failed:', error);
            alert('Xác nhận luân chuyển thất bại: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSubmittingHandover(false);
        }
    };
    const openTransferFormModal = (mode, record) => {
        setTransferFormModal({ mode, record });
        setEditingNote(record.notes?.[0] || '');
        setEditingItems((record.items || []).map((item) => ({
            itemName: item.itemName || '',
            itemType: item.itemType || 'KHAC',
            quantity: Number(item.quantity) || 0,
            codesText: (item.codes || []).join(', ')
        })));
    };
    const handleSaveTransferEdit = async () => {
        if (!transferFormModal?.record) return;
        setSavingTransfer(true);
        try {
            const itemsPayload = editingItems.map((item) => {
                const parsedCodes = (item.codesText || '')
                    .split(',')
                    .map((code) => code.trim().toUpperCase())
                    .filter(Boolean);

                return {
                    item_type: item.itemType,
                    item_name: item.itemName,
                    quantity: Number(item.quantity) || 0,
                    specific_codes: parsedCodes.map((code) => ({
                        code,
                        status: 'pending',
                        message: '',
                        dbId: null
                    }))
                };
            });
            const totalQuantity = itemsPayload.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

            const { error } = await supabase
                .from('inventory_transfer_requests')
                .update({
                    note: editingNote,
                    items_json: itemsPayload,
                    total_quantity: totalQuantity
                })
                .eq('id', transferFormModal.record.id);
            if (error) throw error;
            setTransferFormModal(null);
            fetchTransfers();
        } catch (error) {
            console.error('Error updating transfer note:', error);
            alert('Không thể cập nhật phiếu luân chuyển: ' + (error.message || 'Unknown error'));
        } finally {
            setSavingTransfer(false);
        }
    };

    const canApproveTransfer = isAdminRole(role) || isWarehouseRole(role);

    const handleApproveTransfer = async (record) => {
        if (!record || record.status === 'DA_DUYET') return;
        if (!canApproveTransfer) {
            toast.error('Chỉ Admin hoặc Thủ kho được duyệt phiếu điều chuyển.');
            return;
        }

        const approverName =
            localStorage.getItem('user_name') ||
            sessionStorage.getItem('user_name') ||
            'Hệ thống';

        try {
            for (const item of record.items || []) {
                const itemType = item.itemType;
                const itemName = item.itemName;
                const qty = Number(item.quantity) || 0;
                if (!qty) continue;

                const sourceWarehouseColumn = itemType.startsWith('BINH') ? 'warehouse_id' : 'warehouse';
                const sourceTable = itemType.startsWith('BINH') ? 'cylinders' : 'machines';
                const serializedCodes = (item.codes || []).filter(Boolean);

                // For cylinders/machines, trust serialized stock by codes and warehouse before inventory aggregate.
                if (itemType === 'MAY' || itemType.startsWith('BINH')) {
                    if (serializedCodes.length !== qty) {
                        throw new Error(`Mặt hàng "${itemName}" cần đúng ${qty} mã, hiện có ${serializedCodes.length} mã.`);
                    }
                    const { data: serialRows, error: serialCheckErr } = await supabase
                        .from(sourceTable)
                        .select(`id, serial_number, ${sourceWarehouseColumn}`)
                        .in('serial_number', serializedCodes);
                    if (serialCheckErr) throw serialCheckErr;

                    const invalidCodes = serializedCodes.filter((code) => {
                        const found = (serialRows || []).find((row) => row.serial_number === code);
                        return !found || found[sourceWarehouseColumn] !== record.fromWarehouseId;
                    });
                    if (invalidCodes.length > 0) {
                        throw new Error(`Mã không nằm ở kho xuất: ${invalidCodes.join(', ')}`);
                    }
                }

                let { data: sourceInv, error: sourceInvErr } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', record.fromWarehouseId)
                    .eq('item_type', itemType)
                    .eq('item_name', itemName)
                    .maybeSingle();
                if (sourceInvErr) throw sourceInvErr;

                // Aggregate row may be missing for serialized items; create fallback row to keep transaction history compatible.
                if (!sourceInv && (itemType === 'MAY' || itemType.startsWith('BINH'))) {
                    const { data: createdSourceInv, error: createSourceInvErr } = await supabase
                        .from('inventory')
                        .insert([{
                            warehouse_id: record.fromWarehouseId,
                            item_type: itemType,
                            item_name: itemName,
                            quantity: qty
                        }])
                        .select('id, quantity')
                        .single();
                    if (createSourceInvErr) throw createSourceInvErr;
                    sourceInv = createdSourceInv;
                }

                if (!sourceInv || (sourceInv.quantity || 0) < qty) {
                    throw new Error(`Không đủ tồn kho cho "${itemName}" tại kho xuất.`);
                }

                const { error: sourceUpdateErr } = await supabase
                    .from('inventory')
                    .update({ quantity: (sourceInv.quantity || 0) - qty })
                    .eq('id', sourceInv.id);
                if (sourceUpdateErr) throw sourceUpdateErr;

                const { data: destInv, error: destInvErr } = await supabase
                    .from('inventory')
                    .select('id, quantity')
                    .eq('warehouse_id', record.toWarehouseId)
                    .eq('item_type', itemType)
                    .eq('item_name', itemName)
                    .maybeSingle();
                if (destInvErr) throw destInvErr;

                let destInventoryId = destInv?.id;
                if (destInv) {
                    const { error: destUpdateErr } = await supabase
                        .from('inventory')
                        .update({ quantity: (destInv.quantity || 0) + qty })
                        .eq('id', destInv.id);
                    if (destUpdateErr) throw destUpdateErr;
                } else {
                    const { data: newDest, error: destInsertErr } = await supabase
                        .from('inventory')
                        .insert([{
                            warehouse_id: record.toWarehouseId,
                            item_type: itemType,
                            item_name: itemName,
                            quantity: qty,
                        }])
                        .select('id')
                        .single();
                    if (destInsertErr) throw destInsertErr;
                    destInventoryId = newDest.id;
                }

                if (itemType === 'MAY' || itemType.startsWith('BINH')) {
                    const codes = serializedCodes;
                    if (codes.length > 0) {
                        const tableName = itemType.startsWith('BINH') ? 'cylinders' : 'machines';
                        const warehouseColumn = itemType.startsWith('BINH') ? 'warehouse_id' : 'warehouse';

                        const { error: serialUpdateErr } = await supabase
                            .from(tableName)
                            .update({ [warehouseColumn]: record.toWarehouseId })
                            .in('serial_number', codes);
                        if (serialUpdateErr) throw serialUpdateErr;
                    }
                }

                const baseNote = `Duyệt điều chuyển ${record.transferCode}`;
                const { error: txOutErr } = await supabase.from('inventory_transactions').insert([{
                    inventory_id: sourceInv.id,
                    transaction_type: 'OUT',
                    reference_code: record.transferCode,
                    quantity_changed: qty,
                    note: `${baseNote} - xuất từ ${record.fromWarehouses.join(', ')} sang ${record.toWarehouses.join(', ')}`,
                }]);
                if (txOutErr) throw txOutErr;

                const { error: txInErr } = await supabase.from('inventory_transactions').insert([{
                    inventory_id: destInventoryId,
                    transaction_type: 'IN',
                    reference_code: record.transferCode,
                    quantity_changed: qty,
                    note: `${baseNote} - nhập về ${record.toWarehouses.join(', ')}`,
                }]);
                if (txInErr) throw txInErr;
            }

            const approvedAt = new Date().toISOString();
            const { error: approveErr } = await supabase
                .from('inventory_transfer_requests')
                .update({
                    status: 'DA_DUYET',
                    approved_by: approverName,
                    approved_at: approvedAt
                })
                .eq('id', record.id);
            if (approveErr) throw approveErr;

            toast.success(`Đã duyệt phiếu ${record.transferCode}`);
            fetchTransfers();
        } catch (error) {
            console.error('Approve transfer failed:', error);
            toast.error(error.message || 'Duyệt phiếu thất bại');
        }
    };
    const renderCell = (key, record) => {
        if (key === 'code') return <span className="font-black text-primary">{record.transferCode}</span>;
        if (key === 'status') {
            return (
                <span className={getTransferStatusClass(record.status)}>
                    {record.status}
                </span>
            );
        }
        if (key === 'transaction_type') return <span className={columnTonePillClass.transaction_type}>{record.transactionType || 'OUT'}</span>;
        if (key === 'from') return <span className={columnTonePillClass.from}>{record.fromWarehouses.join(', ') || '—'}</span>;
        if (key === 'to') return <span className={columnTonePillClass.to}>{record.toWarehouses.join(', ') || '—'}</span>;
        if (key === 'qty') return <span className={columnTonePillClass.qty}>{record.totalQuantity}</span>;
        if (key === 'note') {
            const note = record.notes?.[0] || '';
            return <span className="text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 inline-block">{note ? (note.length > 80 ? `${note.slice(0, 80)}...` : note) : '—'}</span>;
        }
        if (key === 'date') return <span className="text-slate-600 font-medium">{new Date(record.createdAt).toLocaleString('vi-VN')}</span>;
        if (key === 'items') {
            return (
                <>
                    {record.items.slice(0, 2).map((item, idx) => (
                        <div key={`${record.id}-${idx}`} className="text-[13px] font-medium text-slate-700 flex items-center gap-2">
                            <span className={itemTypeBadgeClass(item.itemType)}>{item.itemType}</span>
                            <span>{item.itemName} x {item.quantity}</span>
                        </div>
                    ))}
                    {record.items.length > 2 && (
                        <div className="text-[11px] text-slate-400 font-bold">+{record.items.length - 2} mục khác</div>
                    )}
                </>
            );
        }
        return '—';
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5">
            <PageViewSwitcher
                activeView={activeView}
                setActiveView={setActiveView}
                views={[
                    { id: 'list', label: 'Danh sách', icon: <List size={16} /> },
                    { id: 'stats', label: 'Thống kê', icon: <BarChart2 size={16} /> },
                ]}
            />

            {activeView === 'list' && (
                <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full">
                    <MobilePageHeader
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchPlaceholder="Tìm mã phiếu, kho xuất/nhận, mặt hàng..."
                        onFilterClick={openMobileFilter}
                        hasActiveFilters={hasActiveFilters}
                        totalActiveFilters={totalActiveFilters}
                        actions={
                            <button
                                onClick={() => navigate('/kho/dieu-chuyen')}
                                className="p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
                                title="Thêm phiếu điều chuyển"
                            >
                                <Plus size={20} />
                            </button>
                        }
                        summary={
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5 -mx-0.5 px-0.5">
                                <span className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-emerald-200/60">
                                    Hiển thị <span className="tabular-nums">{filteredRecords.length}</span> phiếu
                                </span>
                                <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-primary/15">
                                    Tổng loại hàng <span className="tabular-nums">{totalItems}</span>
                                </span>
                                <span className="bg-blue-100 text-blue-800 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm border border-blue-200/60">
                                    Tổng SL <span className="tabular-nums">{totalQty}</span>
                                </span>
                            </div>
                        }
                    />

                    <div className="md:hidden flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {loading ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Đang tải dữ liệu...</div>
                        ) : paginatedRecords.length === 0 ? (
                            <div className="py-16 text-center text-[13px] text-muted-foreground italic">Không tìm thấy kết quả phù hợp</div>
                        ) : (
                            paginatedRecords.map((record, index) => (
                                <div key={record.id} className="rounded-2xl border shadow-sm p-4 transition-all duration-200 border-primary/15 bg-white">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">#{index + 1}</p>
                                            <h3 className="text-[14px] font-bold text-foreground leading-tight mt-0.5">{record.transferCode}</h3>
                                        </div>
                                        <span className={getTransferStatusClass(record.status)}>
                                            {record.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-muted/10 border border-border/60 p-2.5">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <Warehouse className="w-3 h-3 text-blue-600" /> Kho xuất
                                            </p>
                                            <p className="text-[12px] font-bold text-foreground mt-0.5">{record.fromWarehouses.join(', ') || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <ArrowLeftRight className="w-3 h-3 text-indigo-600" /> Kho nhận
                                            </p>
                                            <p className="text-[12px] font-bold text-foreground mt-0.5">{record.toWarehouses.join(', ') || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Số lượng</p>
                                            <p className="text-[14px] font-black text-foreground mt-0.5">{record.totalQuantity}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-500" /> Ngày tạo
                                            </p>
                                            <p className="text-[12px] font-bold text-foreground mt-0.5">{new Date(record.createdAt).toLocaleDateString('vi-VN')}</p>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-2">
                                        {canApproveTransfer && record.status === 'CHO_DUYET' && (
                                            <button
                                                onClick={() => handleApproveTransfer(record)}
                                                className="p-2 text-blue-700 bg-blue-50 border border-blue-100 rounded-lg active:scale-90 transition-all"
                                                title="Duyệt phiếu"
                                            >
                                                <CheckCircle2 size={18} strokeWidth={2.2} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                openTransferFormModal('view', record);
                                            }}
                                            className="p-2 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg active:scale-90 transition-all"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={18} strokeWidth={2.2} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                openTransferFormModal('edit', record);
                                            }}
                                            className="p-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg active:scale-90 transition-all"
                                            title="Sửa phiếu"
                                        >
                                            <FileText size={18} strokeWidth={2.2} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActionRecord(record);
                                                setActionTab('actions');
                                            }}
                                            className="p-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg active:scale-90 transition-all"
                                            title="Thao tác luân chuyển"
                                        >
                                            <Package size={18} strokeWidth={2.2} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                openPrintOptions(record);
                                            }}
                                            className="p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg active:scale-90 transition-all"
                                            title="In phiếu"
                                        >
                                            <Printer size={18} strokeWidth={2.2} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="hidden md:block p-3 space-y-3">
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
                                        placeholder="Tìm kiếm . . ."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-8 py-1.5 bg-muted/20 border border-border/80 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all font-medium"
                                    />
                                </div>
                            </div>
                            <div className="relative" ref={columnPickerRef}>
                                <button
                                    onClick={() => setShowColumnPicker((v) => !v)}
                                    className={clsx(
                                        'flex items-center gap-2 px-4 py-1.5 rounded-xl border text-[13px] font-bold transition-all bg-white shadow-sm',
                                        showColumnPicker
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-border text-muted-foreground hover:bg-muted/20'
                                    )}
                                >
                                    <SlidersHorizontal size={16} />
                                    Cột ({visibleColumns.length}/{DEFAULT_COLUMN_ORDER.length})
                                </button>
                                {showColumnPicker && (
                                    <ColumnPicker
                                        columnOrder={columnOrder}
                                        setColumnOrder={setColumnOrder}
                                        visibleColumns={visibleColumns}
                                        setVisibleColumns={setVisibleColumns}
                                        defaultColOrder={DEFAULT_COLUMN_ORDER}
                                        columnDefs={COLUMN_DEFS}
                                    />
                                )}
                            </div>
                            <button
                                onClick={() => navigate('/kho/dieu-chuyen')}
                                className="flex items-center gap-2 px-6 py-1.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
                            >
                                <Plus size={18} />
                                Thêm
                            </button>
                        </div>

                        <div className="rounded-lg border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-2 py-1.5 shadow-sm">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 custom-scrollbar whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-800 border border-slate-200 shadow-sm">
                                    Phiếu <span className="text-primary tabular-nums">{filteredRecords.length}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary border border-primary/20">
                                    Loại hàng <span className="tabular-nums">{totalItems}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 border border-blue-200/80">
                                    Tổng số lượng <span className="tabular-nums">{totalQty}</span>
                                </span>
                                {statusOptions.map((s) => (
                                    <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800 border border-blue-200/80">
                                        {s.label} <span className="tabular-nums">{s.count}</span>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('status', activeDropdown === 'status' || selectedStatuses.length > 0))}
                                >
                                    <Filter size={14} className={getFilterIconClass('status', activeDropdown === 'status' || selectedStatuses.length > 0)} />
                                    Trạng thái
                                    {selectedStatuses.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15">{selectedStatuses.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'status' ? 'rotate-180' : '')} />
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
                                    onClick={() => setActiveDropdown(activeDropdown === 'tx_type' ? null : 'tx_type')}
                                    className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('tx_type', activeDropdown === 'tx_type' || selectedTransactionTypes.length > 0))}
                                >
                                    <ArrowLeftRight size={14} className={getFilterIconClass('tx_type', activeDropdown === 'tx_type' || selectedTransactionTypes.length > 0)} />
                                    Loại GD
                                    {selectedTransactionTypes.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15">{selectedTransactionTypes.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'tx_type' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'tx_type' && (
                                    <FilterDropdown
                                        options={transactionTypeOptions}
                                        selected={selectedTransactionTypes}
                                        setSelected={setSelectedTransactionTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
                                    className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('type', activeDropdown === 'type' || selectedItemTypes.length > 0))}
                                >
                                    <Package size={14} className={getFilterIconClass('type', activeDropdown === 'type' || selectedItemTypes.length > 0)} />
                                    Loại hàng
                                    {selectedItemTypes.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15">{selectedItemTypes.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'type' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'type' && (
                                    <FilterDropdown
                                        options={itemTypeOptions}
                                        selected={selectedItemTypes}
                                        setSelected={setSelectedItemTypes}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'from' ? null : 'from')}
                                    className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('from', activeDropdown === 'from' || selectedFromWarehouses.length > 0))}
                                >
                                    <Warehouse size={14} className={getFilterIconClass('from', activeDropdown === 'from' || selectedFromWarehouses.length > 0)} />
                                    Kho xuất
                                    {selectedFromWarehouses.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15">{selectedFromWarehouses.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'from' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'from' && (
                                    <FilterDropdown
                                        options={fromWarehouseOptions}
                                        selected={selectedFromWarehouses}
                                        setSelected={setSelectedFromWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'to' ? null : 'to')}
                                    className={clsx("flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[13px] font-bold transition-all", getFilterButtonClass('to', activeDropdown === 'to' || selectedToWarehouses.length > 0))}
                                >
                                    <ArrowLeftRight size={14} className={getFilterIconClass('to', activeDropdown === 'to' || selectedToWarehouses.length > 0)} />
                                    Kho nhận
                                    {selectedToWarehouses.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15">{selectedToWarehouses.length}</span>}
                                    <ChevronDown size={14} className={clsx("transition-transform", activeDropdown === 'to' ? 'rotate-180' : '')} />
                                </button>
                                {activeDropdown === 'to' && (
                                    <FilterDropdown
                                        options={toWarehouseOptions}
                                        selected={selectedToWarehouses}
                                        setSelected={setSelectedToWarehouses}
                                        filterSearch={filterSearch}
                                        setFilterSearch={setFilterSearch}
                                    />
                                )}
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => {
                                        setSelectedItemTypes([]);
                                        setSelectedFromWarehouses([]);
                                        setSelectedToWarehouses([]);
                                        setSelectedStatuses([]);
                                        setSelectedTransactionTypes([]);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-red-300 text-red-500 text-[12px] font-bold hover:bg-red-50 transition-all"
                                >
                                    Xóa bộ lọc
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block flex-1 overflow-x-auto bg-white">
                        <table className="w-full border-collapse">
                            <thead className="bg-[#F1F5FF]">
                                <tr>
                                    {visibleTableColumns.map((key) => (
                                        <th key={key} className="px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-left uppercase tracking-wide">
                                            {COLUMN_DEFS[key].label}
                                        </th>
                                    ))}
                                    <th className="sticky right-0 z-30 bg-[#F1F5FF] px-4 py-3.5 text-[12px] font-bold text-muted-foreground text-center uppercase tracking-wide shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.35)]">
                                        Thao tác
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {loading ? (
                                    <tr><td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">Đang tải dữ liệu...</td></tr>
                                ) : paginatedRecords.length === 0 ? (
                                    <tr><td colSpan={visibleTableColumns.length + 1} className="px-4 py-16 text-center text-muted-foreground">Không tìm thấy dữ liệu luân chuyển</td></tr>
                                ) : (
                                    paginatedRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50/60">
                                            {visibleTableColumns.map((key) => (
                                                <td key={`${record.id}-${key}`} className="px-4 py-4">{renderCell(key, record)}</td>
                                            ))}
                                            <td className="sticky right-0 z-20 bg-white px-2 py-4 text-center shadow-[-6px_0_10px_-8px_rgba(15,23,42,0.25)]">
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            if (activeRowMenu === record.id) {
                                                                setActiveRowMenu(null);
                                                                return;
                                                            }
                                                            openRowMenuAtButton(record.id, e);
                                                        }}
                                                        className={clsx(
                                                            "p-2 rounded-xl transition-all",
                                                            activeRowMenu === record.id ? "bg-slate-100 text-slate-800" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                    {activeRowMenu === record.id && createPortal(
                                                        <div
                                                            ref={rowMenuRef}
                                                            style={{ position: 'fixed', top: `${menuPosition.top}px`, left: `${menuPosition.left}px`, width: `${ROW_MENU_WIDTH}px` }}
                                                            className="bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[999999] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                                        >
                                                            {canApproveTransfer && record.status === 'CHO_DUYET' && (
                                                                <button
                                                                    onClick={() => {
                                                                        handleApproveTransfer(record);
                                                                        setActiveRowMenu(null);
                                                                    }}
                                                                    className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors text-[13px] font-bold leading-none"
                                                                >
                                                                    <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </span>
                                                                    <span className="text-left leading-none">Duyệt phiếu điều chuyển</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    openTransferFormModal('view', record);
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-indigo-600 hover:bg-indigo-50 transition-colors text-[13px] font-bold leading-none"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <Eye className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">Xem chi tiết</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    openTransferFormModal('edit', record);
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-amber-600 hover:bg-amber-50 transition-colors text-[13px] font-bold leading-none"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <FileText className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">Sửa phiếu luân chuyển</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setActionRecord(record);
                                                                    setActionTab('actions');
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-emerald-600 hover:bg-emerald-50 transition-colors text-[13px] font-bold leading-none"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <Package className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">Thao tác luân chuyển</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    openPrintOptions(record);
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 transition-colors text-[13px] font-bold leading-none"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <Printer className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">In phiếu điều chuyển</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard?.writeText(record.transferCode || '');
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors text-[13px] font-bold leading-none"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <Copy className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">Sao chép mã phiếu</span>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setDeleteRecord(record);
                                                                    setActiveRowMenu(null);
                                                                }}
                                                                className="w-full grid grid-cols-[22px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 transition-colors text-[13px] font-bold leading-none border-t border-slate-100 mt-1"
                                                            >
                                                                <span className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </span>
                                                                <span className="text-left leading-none">Xóa phiếu luân chuyển</span>
                                                            </button>
                                                        </div>,
                                                        document.body
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-white">
                        <p className="text-xs md:text-sm font-bold text-slate-500">
                            Trang {currentPage}/{totalPages} - {filteredRecords.length} bản ghi
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40"
                            >
                                Trước
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-40"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeView === 'stats' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase">Phiếu luân chuyển</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{totalTransfers}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase">Tổng loại hàng</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{totalItems}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-slate-500 uppercase">Tổng số lượng chuyển</p>
                        <p className="text-2xl font-black text-primary mt-1">{totalQty}</p>
                    </div>
                </div>
            )}

            <MobileFilterSheet
                isOpen={showMobileFilter}
                isClosing={mobileFilterClosing}
                onClose={closeMobileFilter}
                onApply={applyMobileFilter}
                title="Lọc hàng luân chuyển"
                hasActiveFilters={hasActiveFilters}
                totalActiveFilters={totalActiveFilters}
                sections={[
                    {
                        id: 'status',
                        label: 'Trạng thái',
                        icon: <Filter size={15} />,
                        options: statusOptions,
                        selectedValues: pendingStatuses,
                        onSelectionChange: setPendingStatuses,
                    },
                    {
                        id: 'tx_type',
                        label: 'Loại giao dịch',
                        icon: <ArrowLeftRight size={15} />,
                        options: transactionTypeOptions,
                        selectedValues: pendingTransactionTypes,
                        onSelectionChange: setPendingTransactionTypes,
                    },
                    {
                        id: 'item_type',
                        label: 'Loại hàng',
                        icon: <Package size={15} />,
                        options: itemTypeOptions,
                        selectedValues: pendingItemTypes,
                        onSelectionChange: setPendingItemTypes,
                    },
                    {
                        id: 'from_wh',
                        label: 'Kho xuất',
                        icon: <Warehouse size={15} />,
                        options: fromWarehouseOptions,
                        selectedValues: pendingFromWarehouses,
                        onSelectionChange: setPendingFromWarehouses,
                    },
                    {
                        id: 'to_wh',
                        label: 'Kho nhận',
                        icon: <ArrowLeftRight size={15} />,
                        options: toWarehouseOptions,
                        selectedValues: pendingToWarehouses,
                        onSelectionChange: setPendingToWarehouses,
                    },
                ]}
            />
            {detailRecord && createPortal(
                <div className="fixed inset-0 z-[100010] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailRecord(null)}>
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-black text-slate-900">Chi tiết phiếu {detailRecord.transferCode}</h3>
                            <button onClick={() => setDetailRecord(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><p className="text-slate-400 font-bold text-xs">Kho xuất</p><p className="font-bold text-slate-700">{detailRecord.fromWarehouses.join(', ') || '—'}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Kho nhận</p><p className="font-bold text-slate-700">{detailRecord.toWarehouses.join(', ') || '—'}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Ngày tạo</p><p className="font-bold text-slate-700">{new Date(detailRecord.createdAt).toLocaleString('vi-VN')}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Tổng số lượng</p><p className="font-black text-primary">{detailRecord.totalQuantity}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Trạng thái</p><p className="font-bold text-blue-700">{detailRecord.status}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Loại giao dịch</p><p className="font-bold text-slate-700">{detailRecord.transactionType || 'OUT'}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Người duyệt</p><p className="font-bold text-slate-700">{detailRecord.approvedBy || '—'}</p></div>
                                <div><p className="text-slate-400 font-bold text-xs">Thời gian duyệt</p><p className="font-bold text-slate-700">{detailRecord.approvedAt ? new Date(detailRecord.approvedAt).toLocaleString('vi-VN') : '—'}</p></div>
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">Thông tin DB</p>
                                <div className="space-y-1 text-xs">
                                    <p><span className="font-bold text-slate-600">Transaction IDs:</span> {detailRecord.transactionIds?.join(', ') || '—'}</p>
                                    <p><span className="font-bold text-slate-600">Reference IDs:</span> {detailRecord.referenceIds?.join(', ') || '—'}</p>
                                    <p><span className="font-bold text-slate-600">Inventory IDs:</span> {detailRecord.inventoryIds?.join(', ') || '—'}</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                                <p className="text-slate-500 font-bold text-xs uppercase mb-2">Danh sách hàng</p>
                                <div className="space-y-1.5">
                                    {detailRecord.items.map((item, idx) => (
                                        <div key={`${detailRecord.id}-${idx}`} className="text-sm font-medium text-slate-700">
                                            {item.itemName} ({item.itemType}) x {item.quantity}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {detailRecord.notes?.length > 0 && (
                                <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
                                    <p className="text-amber-700 font-bold text-xs uppercase mb-2">Ghi chú</p>
                                    {detailRecord.notes.map((n, idx) => (
                                        <p key={`${detailRecord.id}-note-${idx}`} className="text-sm text-amber-900">{n}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {transferFormModal && createPortal(
                <div className="fixed inset-0 z-[100005] flex justify-end">
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setTransferFormModal(null)} />
                    <div className="relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500">
                        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                    {transferFormModal.mode === 'view' ? <Package className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                        {transferFormModal.mode === 'view' ? 'Chi tiết phiếu luân chuyển' : 'Chỉnh sửa phiếu luân chuyển'}
                                    </h3>
                                    <p className="text-slate-500 text-[12px] font-semibold mt-0.5">
                                        Mã phiếu: #{transferFormModal.record.transferCode}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setTransferFormModal(null)}
                                className="p-2 text-primary hover:text-primary/90 hover:bg-primary/5 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6 space-y-6">
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Package className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin phiếu luân chuyển</h4>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Kho xuất</label>
                                        <input value={transferFormModal.record.fromWarehouses.join(', ') || '—'} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Kho nhận</label>
                                        <input value={transferFormModal.record.toWarehouses.join(', ') || '—'} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Trạng thái</label>
                                        <input value={transferFormModal.record.status || 'Đã luân chuyển'} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Ngày tạo</label>
                                        <input value={new Date(transferFormModal.record.createdAt).toLocaleString('vi-VN')} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Người duyệt</label>
                                        <input value={transferFormModal.record.approvedBy || '—'} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-slate-800">Thời gian duyệt</label>
                                        <input value={transferFormModal.record.approvedAt ? new Date(transferFormModal.record.approvedAt).toLocaleString('vi-VN') : '—'} readOnly className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-700" />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <ArrowLeftRight className="w-4 h-4 text-primary/80" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Danh sách hàng hóa</h4>
                                </div>
                                <div className="space-y-3">
                                    {(transferFormModal.mode === 'edit' ? editingItems : transferFormModal.record.items).map((item, idx) => (
                                        <div key={`${transferFormModal.record.id}-item-${idx}`} className="p-3 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-semibold text-slate-800">{item.itemName}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={itemTypeBadgeClass(item.itemType)}>{item.itemType}</span>
                                                    <span className="font-black text-primary">x {item.quantity}</span>
                                                </div>
                                            </div>
                                            {transferFormModal.mode === 'edit' && (
                                                <div className="space-y-1.5">
                                                    <label className="text-[12px] font-bold text-slate-500">Mã hàng hóa (phân tách bằng dấu phẩy)</label>
                                                    <input
                                                        value={item.codesText || ''}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            setEditingItems((prev) => prev.map((it, itIdx) => (
                                                                itIdx === idx ? { ...it, codesText: value } : it
                                                            )));
                                                        }}
                                                        className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                                                        placeholder="Ví dụ: CGA870001, CGA870002"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-2 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <FileText className="w-4 h-4 text-primary/80" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Ghi chú phiếu</h4>
                                </div>
                                <textarea
                                    rows={4}
                                    value={editingNote}
                                    onChange={(e) => setEditingNote(e.target.value)}
                                    readOnly={transferFormModal.mode === 'view'}
                                    className={clsx(
                                        "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold resize-none transition-all",
                                        transferFormModal.mode === 'view'
                                            ? "text-slate-500 cursor-default"
                                            : "text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                    )}
                                />
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                            <button
                                type="button"
                                onClick={() => setTransferFormModal(null)}
                                className={clsx(
                                    "px-6 py-3 font-bold text-[14px] rounded-xl transition-all flex items-center justify-center gap-2 border",
                                    transferFormModal.mode === 'view'
                                        ? "w-full sm:w-auto bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                        : "w-full sm:w-auto px-4 py-2.5 border border-slate-300 bg-white text-slate-500 hover:text-primary"
                                )}
                                disabled={savingTransfer}
                            >
                                {transferFormModal.mode === 'view' ? 'Đóng cửa sổ' : 'Hủy'}
                            </button>
                            {transferFormModal.mode === 'edit' && (
                                <button
                                    type="button"
                                    onClick={handleSaveTransferEdit}
                                    disabled={savingTransfer}
                                    className="w-full md:flex-1 sm:w-auto px-6 py-3 font-bold text-[15px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 border disabled:opacity-50 bg-primary text-white border-primary-700/40 hover:bg-primary-700 shadow-primary-200"
                                >
                                    {savingTransfer ? 'Đang lưu phiếu...' : 'Xác nhận cập nhật'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {actionRecord && createPortal(
                <div className="fixed inset-0 z-[100005] flex justify-end">
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setActionRecord(null)} />
                    <div className="relative bg-slate-50 shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div className="leading-tight">
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Thao tác luân chuyển</h3>
                                    <p className="text-xs font-bold text-slate-500 tracking-wide">Mã: {actionRecord.transferCode}</p>
                                </div>
                            </div>
                            <button onClick={() => setActionRecord(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2 text-sm shadow-sm">
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Kho xuất</span><span className="font-black text-slate-900 text-right">{actionRecord.fromWarehouses.join(', ') || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Kho nhận</span><span className="font-black text-slate-900 text-right">{actionRecord.toWarehouses.join(', ') || '—'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Số lượng</span><span className="font-black text-primary text-right">{actionRecord.totalQuantity}</span></div>
                            </div>

                            <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => setActionTab('actions')}
                                    className={clsx("h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center", actionTab === 'actions' ? 'bg-primary text-white shadow' : 'text-slate-500 hover:bg-slate-100')}
                                >
                                    Thao tác
                                </button>
                                <button
                                    onClick={() => setActionTab('history')}
                                    className={clsx("h-10 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center", actionTab === 'history' ? 'bg-primary text-white shadow' : 'text-slate-500 hover:bg-slate-100')}
                                >
                                    Lịch sử
                                </button>
                            </div>

                            {actionTab === 'actions' ? (
                                <div className="space-y-3">
                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                            <CheckCircle2 className="w-4 h-4 text-primary" />
                                            Checklist bàn giao kho nhận
                                        </label>
                                        <div className="space-y-2 max-h-44 overflow-y-auto">
                                            {Object.entries(transferChecklist).map(([key, checked]) => {
                                                const [, itemName, itemType] = key.split(':');
                                                return (
                                                    <label key={key} className={clsx("flex items-center gap-2 p-2 rounded-xl border cursor-pointer", checked ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => setTransferChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-[12px] font-semibold text-slate-700">{itemName} ({itemType})</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                            <Camera className="w-4 h-4 text-primary" />
                                            Ảnh xác nhận kho nhận
                                        </label>
                                        {handoverProofBase64 ? (
                                            <img src={handoverProofBase64} alt="Kho nhận xác nhận" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                                        ) : (
                                            <label className="h-28 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-sm font-bold text-slate-500 cursor-pointer hover:bg-slate-50">
                                                Chụp / chọn ảnh bàn giao
                                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleHandoverImageChange} />
                                            </label>
                                        )}
                                    </div>

                                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                        <label className="flex items-center gap-1.5 text-xs font-black text-slate-600 uppercase tracking-widest">
                                            <PenLine className="w-4 h-4 text-primary" />
                                            Ký nhận kho nhận
                                        </label>
                                        <input
                                            value={receiverName}
                                            onChange={(e) => setReceiverName(e.target.value)}
                                            placeholder="Tên người ký nhận kho nhận"
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                        />
                                        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                            <canvas
                                                ref={signatureCanvasRef}
                                                width={600}
                                                height={180}
                                                className="w-full h-36 touch-none"
                                                onMouseDown={(e) => {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    startDraw(e.clientX - r.left, e.clientY - r.top);
                                                }}
                                                onMouseMove={(e) => {
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    drawLine(e.clientX - r.left, e.clientY - r.top);
                                                }}
                                                onMouseUp={endDraw}
                                                onMouseLeave={endDraw}
                                                onTouchStart={(e) => {
                                                    const t = e.touches[0];
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    startDraw(t.clientX - r.left, t.clientY - r.top);
                                                }}
                                                onTouchMove={(e) => {
                                                    e.preventDefault();
                                                    const t = e.touches[0];
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    drawLine(t.clientX - r.left, t.clientY - r.top);
                                                }}
                                                onTouchEnd={endDraw}
                                            />
                                        </div>
                                        <button type="button" onClick={clearSignature} className="text-xs font-bold text-rose-600 hover:underline">Xóa chữ ký</button>
                                    </div>

                                    <label className={clsx(
                                        "flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all",
                                        confirmTransferCheck ? "bg-emerald-50 border-emerald-400" : "bg-white border-slate-200"
                                    )}>
                                        <input
                                            type="checkbox"
                                            checked={confirmTransferCheck}
                                            onChange={() => setConfirmTransferCheck((v) => !v)}
                                            className="w-5 h-5"
                                        />
                                        <span className={clsx("text-sm font-bold", confirmTransferCheck ? "text-emerald-700" : "text-slate-600")}>
                                            Tôi xác nhận đã bàn giao và kho nhận đã ký nhận đầy đủ
                                        </span>
                                    </label>

                                    <button
                                        type="button"
                                        disabled={isSubmittingHandover}
                                        onClick={handleConfirmTransferHandover}
                                        className="w-full p-4 rounded-2xl border border-primary bg-primary text-white font-black text-sm disabled:opacity-60"
                                    >
                                        {isSubmittingHandover ? 'Đang xác nhận...' : 'Xác nhận hoàn tất luân chuyển'}
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                                    {actionRecord.items.map((item, idx) => (
                                        <div key={`${actionRecord.id}-history-${idx}`} className="text-sm font-medium text-slate-700">
                                            {item.itemName} ({item.itemType}) x {item.quantity}
                                        </div>
                                    ))}
                                    <p className="text-xs text-slate-400 font-bold pt-2 border-t border-slate-100">
                                        {new Date(actionRecord.createdAt).toLocaleString('vi-VN')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {isPrintModalOpen && createPortal(
                <PrintOptionsModal
                    onClose={() => {
                        setIsPrintModalOpen(false);
                        setPrintRecord(null);
                    }}
                    onConfirm={executeTransferPrint}
                    title="Tùy chọn in phiếu"
                />,
                document.body
            )}
            {deleteRecord && createPortal(
                <div className="fixed inset-0 z-[100010] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteRecord(null)}>
                    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h4 className="text-lg font-black text-rose-700">Xóa phiếu luân chuyển</h4>
                        <p className="text-sm text-slate-600">
                            Xác nhận xóa phiếu <span className="font-bold text-rose-600">{deleteRecord.transferCode}</span>? Thao tác này không thể hoàn tác.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setDeleteRecord(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm"
                                disabled={deletingTransfer}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDeleteTransfer(deleteRecord)}
                                disabled={deletingTransfer}
                                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-sm disabled:opacity-60"
                            >
                                {deletingTransfer ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
