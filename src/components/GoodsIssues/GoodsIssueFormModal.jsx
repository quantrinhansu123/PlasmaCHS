import clsx from 'clsx';
import {
    Camera,
    ChevronDown,
    Clock,
    Edit3,
    Hash,
    Package,
    PackageMinus,
    Plus,
    Save,
    Trash2,
    User,
    X,
    LayoutGrid,
    StickyNote,
    Calendar,
    Truck,
    PenLine
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BarcodeScanner from '../Common/BarcodeScanner';
import InventoryPickerModal from './InventoryPickerModal';
import InventorySearchableSelect from './InventorySearchableSelect';
import { ISSUE_TYPES } from '../../constants/goodsIssueConstants';
import { PRODUCT_TYPES } from '../../constants/orderConstants';
import { supabase } from '../../supabase/config';
import usePermissions from '../../hooks/usePermissions';
import { notificationService } from '../../utils/notificationService';
import { CYLINDER_KHO_COLUMN, filterWarehousesForCurrentUser, getCylinderKhoValue, resolveCylinderWarehouseValue } from '../../utils/orderWarehouseScope';

/** goods_issues có thể lưu warehouses.id hoặc code/tên cũ — cylinders.warehouse lưu mã kho (OCP1…). */
function resolveWarehouseRowForForm(storedWarehouseId, warehousesList = []) {
    const raw = String(storedWarehouseId || '').trim();
    if (!raw || !warehousesList.length) return null;
    const n = raw.toLowerCase();
    return warehousesList.find(
        (w) =>
            String(w.id).toLowerCase() === n ||
            String(w.code || '').trim().toLowerCase() === n ||
            String(w.name || '').trim().toLowerCase() === n
    ) || null;
}

/** machines.warehouse trong DB là mã/ngắn hoặc tên kho, không phải UUID. */
function machineWarehouseCandidates(whRow) {
    if (!whRow) return [];
    return [...new Set([String(whRow.code || '').trim(), String(whRow.name || '').trim(), String(whRow.id || '').trim()].filter(Boolean))];
}

export default function GoodsIssueFormModal({ issue, onClose, onSuccess, forcedType, prefill = null }) {
    const { user, role, department } = usePermissions();
    const isEdit = !!issue;
    const isTransportEditable = !issue || ['CHO_DUYET', 'DA_XUAT'].includes(issue.status);
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [activeScanningIndex, setActiveScanningIndex] = useState(null);
    const [isInventoryPickerOpen, setIsInventoryPickerOpen] = useState(false);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [deliverers, setDeliverers] = useState([]);
    const [manualReturnType, setManualReturnType] = useState('BINH_4L');
    const [manualReturnQty, setManualReturnQty] = useState('1');

    const [formData, setFormData] = useState({
        issue_code: '',
        issue_date: new Date().toISOString().split('T')[0],
        issue_type: forcedType || 'TRA_VO',
        supplier_id: '',
        warehouse_id: '',
        notes: '',
        deliverer_name: '',
        deliverer_name_manual: '',
        deliverer_address: '',
        received_by: '',
        total_items: 0,
        status: 'DA_XUAT'
    });

    const [items, setItems] = useState([
        { id: Date.now(), item_type: 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }
    ]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        loadSuppliers();
        fetchWarehouses();
        loadDeliverers();
        if (issue) {
            const { id, created_at, ...editData } = issue;
            setFormData(editData);
            fetchItems(issue.id);
        } else {
            generateCode();
            if (forcedType) {
                setFormData(prev => ({
                    ...prev,
                    issue_type: forcedType,
                    notes: (forcedType === 'TRA_VO' || forcedType === 'TRA_MAY') ? 'Khách hàng trả' : prev.notes
                }));
            }
        }
    }, [issue, forcedType]);

    // Prefill create form from external navigation
    useEffect(() => {
        if (issue) return;
        if (!prefill) return;
        setFormData((prev) => {
            const next = { ...prev };
            const note = prefill.notes ?? prefill.note;
            if (note && !String(next.notes || '').trim()) next.notes = String(note);
            const supplierId = prefill.supplier_id ?? prefill.supplierId;
            if (supplierId && !String(next.supplier_id || '').trim()) next.supplier_id = String(supplierId);
            const warehouseId = prefill.warehouse_id ?? prefill.warehouseId;
            if (warehouseId && !String(next.warehouse_id || '').trim()) next.warehouse_id = String(warehouseId);
            const issueType = prefill.issue_type ?? prefill.type;
            if (issueType && !String(next.issue_type || '').trim()) next.issue_type = String(issueType);
            return next;
        });
    }, [issue, prefill]);

    useEffect(() => {
        if (!warehousesList.length) return;
        setFormData((prev) => {
            const row = resolveWarehouseRowForForm(prev.warehouse_id, warehousesList);
            if (!row || prev.warehouse_id === row.id) return prev;
            return { ...prev, warehouse_id: row.id };
        });
    }, [warehousesList, issue?.id]);

    useEffect(() => {
        if (!formData.supplier_id || !suppliers.length) return;
        const supplier = suppliers.find((s) => String(s.id) === String(formData.supplier_id));
        const nextAddress = String(supplier?.address || '').trim();
        if (!nextAddress) return;
        setFormData((prev) => {
            if (prev.deliverer_address === nextAddress) return prev;
            return { ...prev, deliverer_address: nextAddress };
        });
    }, [formData.supplier_id, suppliers]);

    useEffect(() => {
        if (formData.warehouse_id && ['TRA_VO', 'TRA_BINH_LOI', 'TRA_MAY'].includes(formData.issue_type)) {
            fetchInventory();
        }
    }, [formData.warehouse_id, formData.issue_type, warehousesList]);

    const fetchItems = async (issueId) => {
        const { data } = await supabase
            .from('goods_issue_items')
            .select('*')
            .eq('issue_id', issueId);
        if (data && data.length > 0) {
            setItems(data.map(item => ({ ...item, _search: '' })));
        }
    };

    const generateCode = async () => {
        const date = new Date();
        const yy = date.getFullYear().toString().slice(2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `PX${yy}${mm}`;

        try {
            const { data, error } = await supabase
                .from('goods_issues')
                .select('issue_code')
                .like('issue_code', `${prefix}%`)
                .order('issue_code', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const lastCode = data[0].issue_code;
                const lastNum = parseInt(lastCode.slice(-3));
                const newNum = (lastNum + 1).toString().padStart(3, '0');
                setFormData(prev => ({ ...prev, issue_code: `${prefix}${newNum}` }));
            } else {
                setFormData(prev => ({ ...prev, issue_code: `${prefix}001` }));
            }
        } catch (e) {
            console.error('Lỗi khi tạo mã:', e);
            setFormData(prev => ({ ...prev, issue_code: `${prefix}001` }));
        }
    };

    const loadSuppliers = async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('id, name, address')
                .order('name');
            if (!error && data) setSuppliers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadDeliverers = async () => {
        try {
            const [shippersRes, usersRes] = await Promise.all([
                supabase.from('shippers').select('id, name, status').order('name'),
                supabase.from('app_users').select('id, name, role, status').order('name'),
            ]);

            if (shippersRes.error) console.error('Lỗi tải đơn vị vận chuyển:', shippersRes.error);
            if (usersRes.error) console.error('Lỗi tải nhân viên giao hàng:', usersRes.error);

            const shipperOptions = (shippersRes.data || [])
                .filter((s) => !s.status || s.status === 'Đang hoạt động')
                .map((s) => ({
                    id: `s_${s.id}`,
                    name: String(s.name || '').trim(),
                    type: 'SHIPPER_CO_DINH',
                }))
                .filter((s) => s.name);

            const userOptions = (usersRes.data || [])
                .filter((u) => {
                    if (u.status && u.status !== 'Hoạt động') return false;
                    const role = String(u.role || '').trim().toLowerCase();
                    return role === 'shipper' || role.includes('giao');
                })
                .map((u) => ({
                    id: `u_${u.id}`,
                    name: String(u.name || '').trim(),
                    type: 'USER_SHIPPER',
                }))
                .filter((u) => u.name);

            setDeliverers([...shipperOptions, ...userOptions]);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name, code').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                const scoped = filterWarehousesForCurrentUser(data, { role, user, department });
                setWarehousesList(scoped);
                if (!isEdit && scoped.length > 0) {
                    setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: scoped[0].id } : prev);
                }
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), item_type: formData.issue_type === 'TRA_MAY' ? 'MAY' : 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }]);
    };

    const fetchInventory = async () => {
        if (!formData.warehouse_id) return;

        setIsInventoryLoading(true);
        // We don't necessarily open the picker modal here, just load the items
        // setIsInventoryPickerOpen(true); 

        try {
            const whRow = resolveWarehouseRowForForm(formData.warehouse_id, warehousesList);

            if (formData.issue_type === 'TRA_MAY') {
                const keys = machineWarehouseCandidates(whRow);
                let mQuery = supabase
                    .from('machines')
                    .select('*')
                    .not('status', 'in', '("thuộc khách hàng")');
                const { data, error } =
                    keys.length > 0
                        ? await mQuery.in('warehouse', keys)
                        : await mQuery.eq('warehouse', formData.warehouse_id);
                if (error) throw error;
                setInventoryItems(data || []);
            } else {
                const cylinderWhId = resolveCylinderWarehouseValue(whRow || formData.warehouse_id, warehousesList);

                let query = supabase
                    .from('cylinders')
                    .select('*')
                    .eq(CYLINDER_KHO_COLUMN, cylinderWhId);

                // Return-empty cylinders should allow selecting all cylinders in the warehouse.
                if (formData.issue_type !== 'TRA_VO') {
                    query = query.not('status', 'in', '("đang sử dụng", "thuộc khách hàng")');
                }

                const { data, error } = await query;
                if (error) throw error;
                setInventoryItems(data || []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setIsInventoryLoading(false);
        }
    };

    const updateItemWithInventory = (id, serial) => {
        const inventoryItem = inventoryItems.find(i => i.serial_number === serial);
        if (!inventoryItem) {
            updateItem(id, 'item_code', serial);
            return;
        }

        const productType = mapToProductType(inventoryItem);
        
        setItems(items.map(it => it.id === id ? { 
            ...it, 
            item_code: serial, 
            item_id: inventoryItem.id,
            item_type: productType 
        } : it));
    };

    const mapToProductType = (item) => {
        if (formData.issue_type === 'TRA_MAY') {
            if (item.machine_type === 'BV') return 'MAY_MED';
            if (item.machine_type === 'TM') return 'MAY_ROSY';
            return 'MAY_MED'; // Default
        } else {
            if (item.volume?.includes('4L')) return 'BINH_4L';
            if (item.volume?.includes('8L')) return 'BINH_8L';
            return 'BINH_4L'; // Default
        }
    };

    const handleConfirmInventorySelection = (selectedIds) => {
        const selectedItems = inventoryItems.filter(item => selectedIds.includes(item.id));
        if (selectedItems.length === 0) {
            setIsInventoryPickerOpen(false);
            return;
        }

        const mapToProductType = (item) => {
            if (formData.issue_type === 'TRA_MAY') {
                if (item.machine_type === 'BV') return 'MAY_MED';
                if (item.machine_type === 'TM') return 'MAY_ROSY';
                return 'MAY_MED'; // Default
            } else {
                if (item.volume?.includes('4L')) return 'BINH_4L';
                if (item.volume?.includes('8L')) return 'BINH_8L';
                return 'BINH_4L'; // Default
            }
        };

        const newItems = selectedItems.map(item => ({
            id: Date.now() + Math.random(),
            item_type: mapToProductType(item),
            item_id: item.id,
            item_code: item.serial_number,
            quantity: 1,
            _search: ''
        }));

        // Filter out empty items from current list
        const currentValidItems = items.filter(i => i.item_code || i.item_id);
        
        setItems([...currentValidItems, ...newItems]);
        setIsInventoryPickerOpen(false);
    };

    const removeItem = (id) => {
        if (items.length <= 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const openScanner = (index) => {
        setActiveScanningIndex(index);
        setIsScannerOpen(true);
    };

    const handleScanSuccess = (code) => {
        const normalizedCode = (code || '').toString().trim();
        if (!normalizedCode) return;

        if (activeScanningIndex !== null) {
            const itemToUpdate = items[activeScanningIndex];

            // For machine issue, only accept serials that exist in current warehouse suggestion list.
            if (formData.issue_type === 'TRA_MAY') {
                const matchedMachine = inventoryItems.find(
                    (i) => (i.serial_number || '').trim().toUpperCase() === normalizedCode.toUpperCase()
                );
                if (!matchedMachine) {
                    notificationService.add({
                        title: 'Mã máy không hợp lệ',
                        description: `Mã ${normalizedCode} không thuộc danh sách máy sẵn sàng của kho đã chọn.`,
                        type: 'error'
                    });
                    return;
                }
                updateItemWithInventory(itemToUpdate.id, matchedMachine.serial_number);
            } else {
                const matchedCyl = inventoryItems.find(
                    (i) => (i.serial_number || '').trim().toUpperCase() === normalizedCode.toUpperCase()
                );
                if (matchedCyl) {
                    updateItemWithInventory(itemToUpdate.id, matchedCyl.serial_number);
                } else {
                    updateItem(itemToUpdate.id, 'item_code', normalizedCode);
                    notificationService.add({
                        title: 'Không có trong danh sách kho đã load',
                        description: normalizedCode + ' — vẫn ghi tay; kiểm tra kho và quyền chọn đúng kho.',
                        type: 'warning'
                    });
                }
            }

            setIsScannerOpen(false);
            setActiveScanningIndex(null);
        }
    };

    useEffect(() => {
        if (formData.issue_type !== 'TRA_VO') return;

        const targetQty = Number(manualReturnQty);
        if (!Number.isInteger(targetQty) || targetQty < 1) return;

        setItems(prev => {
            const nonManualRows = prev.filter(it => {
                if (it._manualQuick) return false;
                // Avoid keeping placeholder rows without serial in auto-sync mode.
                return Boolean(it.item_id || (it.item_code || '').trim());
            });
            const currentManualRows = prev.filter(it => it._manualQuick && it.item_type === manualReturnType);
            const keptManualRows = currentManualRows.slice(0, targetQty);

            if (keptManualRows.length < targetQty) {
                const rowsToAdd = targetQty - keptManualRows.length;
                for (let idx = 0; idx < rowsToAdd; idx += 1) {
                    keptManualRows.push({
                        id: Date.now() + Math.random() + idx,
                        item_type: manualReturnType,
                        item_id: null,
                        item_code: '',
                        quantity: 1,
                        _search: '',
                        _manualQuick: true
                    });
                }
            }

            const nextItems = [...nonManualRows, ...keptManualRows];
            if (nextItems.length === prev.length && nextItems.every((row, idx) => row.id === prev[idx].id)) {
                return prev;
            }
            return nextItems;
        });
    }, [formData.issue_type, manualReturnQty, manualReturnType]);

    useEffect(() => {
        const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        setFormData(prev => ({ ...prev, total_items: total }));
    }, [items]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const isReturnToSupplier = ['TRA_VO', 'TRA_BINH_LOI', 'TRA_MAY'].includes(formData.issue_type);
        if (!formData.supplier_id && isReturnToSupplier) {
            alert('Vui lòng chọn Nhà cung cấp khi trả hàng!');
            return;
        }

        const delivererName = formData.deliverer_name === 'KHAC'
            ? String(formData.deliverer_name_manual || '').trim()
            : String(formData.deliverer_name || '').trim();
        if (!delivererName) {
            alert('Vui lòng chọn người vận chuyển trong mục Vận chuyển');
            return;
        }
        if (!String(formData.deliverer_address || '').trim()) {
            alert('Vui lòng nhập địa chỉ giao hàng trong mục Vận chuyển');
            return;
        }

        if (formData.issue_type === 'TRA_VO') {
            const targetQty = Number(manualReturnQty);
            if (!Number.isInteger(targetQty) || targetQty < 1) {
                alert('Số lượng vỏ phải lớn hơn 0.');
                return;
            }
        }

        if (formData.issue_type === 'TRA_VO') {
            const manualRows = items.filter(i => i._manualQuick);
            const missingCodes = manualRows.filter(i => !(i.item_id || (i.item_code || '').trim()));
            if (missingCodes.length > 0) {
                alert('Vui lòng nhập/quét đủ mã cho toàn bộ số lượng vỏ cần trả.');
                return;
            }
        }

        const validItems = items.filter(i => {
            const qty = Number(i.quantity) || 0;
            const hasCode = Boolean(i.item_id || (i.item_code || '').trim());
            return hasCode && qty > 0;
        });
        if (validItems.length === 0) {
            alert('Vui lòng điền ít nhất 1 sản phẩm cần xuất!');
            return;
        }

        if (formData.issue_type === 'TRA_VO') {
            const invalidRows = items.filter(i => (Number(i.quantity) || 0) > 1);
            if (invalidRows.length > 0) {
                alert('Mỗi vỏ trả phải tương ứng 1 mã serial. Vui lòng để số lượng mỗi dòng bằng 1.');
                return;
            }
        }

        if (formData.issue_type === 'TRA_MAY') {
            const invalidRows = validItems.filter((i) => {
                const qty = Number(i.quantity) || 0;
                return qty !== 1;
            });
            if (invalidRows.length > 0) {
                alert('Mỗi máy phải tương ứng đúng 1 mã serial. Vui lòng để số lượng mỗi dòng bằng 1.');
                return;
            }

            const missingItemIdRows = validItems.filter((i) => !i.item_id || !(i.item_code || '').trim());
            if (missingItemIdRows.length > 0) {
                alert('Phiếu xuất máy chỉ được chọn từ danh sách máy sẵn sàng trong kho. Không dùng mã nhập tay linh tinh.');
                return;
            }

            const serials = validItems.map((i) => (i.item_code || '').trim().toUpperCase()).filter(Boolean);
            const uniqueSerials = new Set(serials);
            if (uniqueSerials.size !== serials.length) {
                alert('Danh sách mã máy đang bị trùng. Vui lòng kiểm tra lại.');
                return;
            }

            const { data: machineRows, error: machineError } = await supabase
                .from('machines')
                .select('id, serial_number, status, warehouse')
                .in('serial_number', [...uniqueSerials]);

            if (machineError) {
                alert('Không thể kiểm tra mã máy trong kho: ' + machineError.message);
                return;
            }

            const whRowMv = resolveWarehouseRowForForm(formData.warehouse_id, warehousesList);
            const machineWhAllowed = machineWarehouseCandidates(whRowMv);
            const dbMap = new Map((machineRows || []).map((m) => [String(m.serial_number || '').trim().toUpperCase(), m]));
            const invalidSerial = [...uniqueSerials].find((serial) => {
                const machine = dbMap.get(serial);
                if (!machine) return true;
                const mw = String(machine.warehouse || '').trim();
                const ok =
                    machineWhAllowed.length > 0
                        ? machineWhAllowed.some((k) => mw === k || mw.toLowerCase() === String(k).toLowerCase())
                        : mw === String(formData.warehouse_id || '').trim();
                if (!ok) return true;
                if (String(machine.status || '').toLowerCase().trim() === 'thuộc khách hàng') return true;
                return false;
            });

            if (invalidSerial) {
                alert(`Mã máy ${invalidSerial} không hợp lệ với kho hiện tại hoặc không còn trạng thái sẵn sàng.`);
                return;
            }
        }

        setIsLoading(true);
        try {
            const issuePayload = { ...formData };
            delete issuePayload.id;
            delete issuePayload.created_at;

            const uuidOrNull = (v) => {
                if (v == null) return null;
                const s = String(v).trim();
                return s || null;
            };
            issuePayload.supplier_id = uuidOrNull(issuePayload.supplier_id);
            issuePayload.warehouse_id = uuidOrNull(issuePayload.warehouse_id);
            issuePayload.deliverer_name = delivererName;
            delete issuePayload.deliverer_name_manual;

            const currentCreatorRaw =
                user?.name ||
                user?.email ||
                localStorage.getItem('user_name') ||
                sessionStorage.getItem('user_name') ||
                '';
            const currentCreator = String(currentCreatorRaw || '').trim();

            if (!isEdit) {
                issuePayload.created_by = currentCreator || 'Hệ thống';
            } else {
                delete issuePayload.created_by;
            }

            let issueId;

            if (isEdit) {
                const { error: issueError } = await supabase
                    .from('goods_issues')
                    .update(issuePayload)
                    .eq('id', issue.id);

                if (issueError) throw issueError;
                issueId = issue.id;
                await supabase.from('goods_issue_items').delete().eq('issue_id', issueId);
            } else {
                const { data: issueData, error: issueError } = await supabase
                    .from('goods_issues')
                    .insert([issuePayload])
                    .select()
                    .single();

                if (issueError) {
                    if (issueError.code === '23505') {
                        await generateCode();
                        alert('⚠️ Mã phiếu xuất này đã tồn tại trên hệ thống. Hệ thống đã tự động cập nhật mã mới tiếp theo, vui lòng nhấn "Lưu" một lần nữa!');
                        setIsLoading(false);
                        return;
                    }
                    throw issueError;
                }
                issueId = issueData.id;
            }

            const itemPayloads = validItems.map(item => ({
                issue_id: issueId,
                item_type: item.item_type,
                item_id: item.item_id || null,
                item_code: item.item_code || '',
                quantity: Number(item.quantity) || 1
            }));

            const { error: itemsError } = await supabase
                .from('goods_issue_items')
                .insert(itemPayloads);

            if (itemsError) throw itemsError;

            if (!isEdit && isReturnToSupplier) {
                const normalizedSerials = [...new Set(
                    validItems
                        .map((item) => (item.item_code || '').toString().trim().toUpperCase())
                        .filter(Boolean)
                )];

                if (normalizedSerials.length > 0) {
                    if (formData.issue_type === 'TRA_MAY') {
                        // Fetch machine IDs by serial (ilike = case-insensitive) to avoid case mismatch
                        const { data: machineRows, error: machineFetchError } = await supabase
                            .from('machines')
                            .select('id')
                            .or(normalizedSerials.map(s => `serial_number.ilike.${s}`).join(','));
                        if (machineFetchError) throw machineFetchError;
                        const machineIds = (machineRows || []).map(m => m.id);
                        if (machineIds.length > 0) {
                            const { error: machineStatusError } = await supabase
                                .from('machines')
                                .update({
                                    status: 'đã trả ncc',
                                    warehouse: null,
                                    customer_id: null,
                                    customer_name: null
                                })
                                .in('id', machineIds);
                            if (machineStatusError) throw machineStatusError;
                        }
                    } else {
                        // Fetch cylinder IDs by serial (ilike = case-insensitive)
                        const { data: cylinderRows, error: cylinderFetchError } = await supabase
                            .from('cylinders')
                            .select('id')
                            .or(normalizedSerials.map(s => `serial_number.ilike.${s}`).join(','));
                        if (cylinderFetchError) throw cylinderFetchError;
                        const cylinderIds = (cylinderRows || []).map(c => c.id);
                        if (cylinderIds.length > 0) {
                            const { error: cylinderStatusError } = await supabase
                                .from('cylinders')
                                .update({
                                    status: 'đã trả ncc',
                                    [CYLINDER_KHO_COLUMN]: null,
                                    customer_id: null,
                                    customer_name: null,
                                    supplier_id: issuePayload.supplier_id
                                })
                                .in('id', cylinderIds);
                            if (cylinderStatusError) throw cylinderStatusError;
                        }
                    }
                }
            }

            // INVENTORY DEDUCTION: Deduct from warehouse inventory when creating a new goods issue
            if (!isEdit && issuePayload.warehouse_id) {
                // Group items by product type for inventory deduction
                const itemsByType = {};
                for (const item of validItems) {
                    const productLabel = PRODUCT_TYPES.find(p => p.id === item.item_type)?.label || item.item_type;
                    const itemType = item.item_type?.startsWith('BINH') ? 'BINH' : 'MAY';
                    const key = `${itemType}::${productLabel}`;
                    itemsByType[key] = (itemsByType[key] || 0) + (Number(item.quantity) || 1);
                }

                for (const [key, qty] of Object.entries(itemsByType)) {
                    const [itemType, itemName] = key.split('::');
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('id, quantity')
                        .eq('warehouse_id', issuePayload.warehouse_id)
                        .eq('item_type', itemType)
                        .ilike('item_name', itemName.trim())
                        .maybeSingle();

                    if (invData) {
                        await supabase
                            .from('inventory')
                            .update({ quantity: Math.max(0, invData.quantity - qty) })
                            .eq('id', invData.id);

                        await supabase.from('inventory_transactions').insert([{
                            inventory_id: invData.id,
                            transaction_type: 'OUT',
                            reference_id: issueId,
                            reference_code: formData.issue_code,
                            quantity_changed: qty,
                            note: `Xuất kho ${qty} ${itemName} - Phiếu ${formData.issue_code}`
                        }]);
                    }
                }
            }

            // Global notification for new goods issue
            if (!isEdit) {
                const typeLabel = ISSUE_TYPES.find(t => t.id === formData.issue_type)?.label || 'Xuất kho';
                const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || '';
                notificationService.add({
                    title: `📤 ${typeLabel}: #${formData.issue_code}`,
                    description: `${supplierName ? supplierName + ' - ' : ''}${validItems.length} mặt hàng - ${formData.total_items} đơn vị`,
                    type: 'warning',
                    link: '/xuat-kho'
                });
            }
            
            onSuccess();
        } catch (error) {
            console.error('Error saving goods issue:', error);
            notificationService.add({
                title: '❌ Lỗi khi lưu phiếu',
                description: error.message,
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProductsForType = (type) => {
        if (type === 'TRA_VO') return PRODUCT_TYPES.filter(p => p.id.startsWith('BINH'));
        if (type === 'TRA_MAY') return PRODUCT_TYPES.filter(p => p.id.startsWith('MAY'));
        return PRODUCT_TYPES;
    };

    const currentFilteredProducts = filteredProductsForType(formData.issue_type);
    const selectedSupplier = suppliers.find((s) => String(s.id) === String(formData.supplier_id));
    const supplierDeliveryAddress = String(selectedSupplier?.address || '').trim();

    return createPortal(
        <>
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
                        "relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                        isClosing && "animate-out slide-out-to-right duration-300"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                <PackageMinus className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-[20px] leading-tight font-black text-primary tracking-tight">
                                    {isEdit ? 'Cập nhật Phiếu Xuất' : (
                                        formData.issue_type === 'TRA_VO' ? 'Xuất Trả Vỏ' :
                                            formData.issue_type === 'TRA_MAY' ? 'Xuất Trả Máy' :
                                                'Lập Phiếu Xuất'
                                    )}
                                </h3>
                                <p className="text-primary/60 text-[12px] font-bold mt-0.5">
                                    Mã phiếu: #{formData.issue_code}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-primary hover:text-primary/90 hover:bg-primary/5 rounded-xl transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                        <form id="goodsIssueForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Thông tin đơn */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2.5 pb-3 border-b border-primary/10">
                                    <Hash className="w-4 h-4 text-primary" />
                                    <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin chung</h4>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                            <Calendar className="w-4 h-4 text-primary/70" /> Ngày xuất
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.issue_date}
                                            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                            Loại hình xuất
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formData.issue_type}
                                                onChange={(e) => {
                                                    const type = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        issue_type: type,
                                                        notes: (type === 'TRA_VO' || type === 'TRA_MAY') ? 'Khách hàng trả' : formData.notes
                                                    });
                                                }}
                                                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            >
                                                {ISSUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        Kho xuất hàng
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.warehouse_id}
                                            onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                            required
                                        >
                                            <option value="">Chọn kho xuất</option>
                                            {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        <User className="w-4 h-4 text-primary/70" /> Nhà cung cấp trả về
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={formData.supplier_id}
                                            onChange={(e) => {
                                                const supplierId = e.target.value;
                                                const supplier = suppliers.find((s) => String(s.id) === String(supplierId));
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    supplier_id: supplierId,
                                                    deliverer_address: supplier?.address
                                                        ? String(supplier.address).trim()
                                                        : '',
                                                }));
                                            }}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] text-slate-800 appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all"
                                        >
                                            <option value="">-- Chọn NCC trả về --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        <StickyNote className="w-4 h-4 text-primary/70" /> Ghi chú
                                    </label>
                                    <textarea
                                        value={formData.notes || ''}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Lý do xuất, phương tiện v.v"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all min-h-[80px]"
                                    />
                                </div>

                                <div className="md:col-span-2 flex items-start gap-2.5 pt-2 border-t border-slate-100">
                                    <Truck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-extrabold text-primary">Vận chuyển</p>
                                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                            Ghi nhận người vận chuyển, người nhận và địa chỉ giao để theo dõi và xác nhận giao hàng trả về NCC.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                                        <User className="w-4 h-4 text-primary/70" /> Người vận chuyển *
                                    </label>
                                    <div className="relative">
                                        <select
                                            disabled={!isTransportEditable}
                                            value={formData.deliverer_name || ''}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, deliverer_name: e.target.value }))}
                                            className={clsx(
                                                'w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] appearance-none transition-all outline-none',
                                                !isTransportEditable
                                                    ? 'text-slate-500 cursor-not-allowed'
                                                    : 'text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white'
                                            )}
                                            required
                                        >
                                            <option value="">-- Chọn hoặc nhập tên --</option>
                                            {deliverers.map((d) => (
                                                <option key={d.id} value={d.name}>
                                                    {d.name} {d.type === 'USER_SHIPPER' ? '(NV)' : '(ĐVVC)'}
                                                </option>
                                            ))}
                                            <option value="KHAC">Tên khác (Nhập tay)...</option>
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-primary/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                    {formData.deliverer_name === 'KHAC' && (
                                        <input
                                            disabled={!isTransportEditable}
                                            value={formData.deliverer_name_manual || ''}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, deliverer_name_manual: e.target.value }))}
                                            placeholder="Nhập tên người vận chuyển..."
                                            className="w-full h-11 px-4 mt-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none border-primary/30"
                                        />
                                    )}
                                </div>

                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="flex flex-col gap-0.5 text-[14px] font-bold text-slate-800">
                                        <span className="flex items-center gap-1.5">
                                            <PenLine className="w-4 h-4 text-primary/70" />
                                            Địa chỉ giao hàng *
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-500 normal-case pl-6">
                                            Địa chỉ nhà cung cấp nhận hàng
                                        </span>
                                    </label>
                                    <input
                                        disabled={!isTransportEditable}
                                        readOnly={Boolean(supplierDeliveryAddress)}
                                        value={formData.deliverer_address || ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, deliverer_address: e.target.value }))}
                                        placeholder="Chọn NCC để lấy địa chỉ"
                                        className={clsx(
                                            'w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none',
                                            !isTransportEditable || supplierDeliveryAddress
                                                ? 'text-slate-500 cursor-not-allowed'
                                                : 'text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white'
                                        )}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="flex flex-col gap-0.5 text-[14px] font-bold text-slate-800">
                                        <span className="flex items-center gap-1.5">
                                            <User className="w-4 h-4 text-primary/70" />
                                            Người nhận hàng
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-500 normal-case pl-6">
                                            Liên hệ nhận hàng tại NCC
                                        </span>
                                    </label>
                                    <input
                                        disabled={!isTransportEditable}
                                        value={formData.received_by || ''}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, received_by: e.target.value }))}
                                        placeholder="Người nhận tại NCC"
                                        className={clsx(
                                            'w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl font-semibold text-[15px] transition-all outline-none',
                                            !isTransportEditable
                                                ? 'text-slate-500 cursor-not-allowed'
                                                : 'text-slate-800 focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white'
                                        )}
                                    />
                                </div>
                            </div>


                            {formData.issue_type === 'TRA_VO' && (
                                <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <h4 className="text-[16px] font-black text-primary tracking-tight">Nhập nhanh số lượng vỏ trả</h4>
                                        <span className="text-[11px] font-bold text-slate-500">Quét QR hoặc thêm nhiều dòng để nhập mã thủ công (1 vỏ = 1 mã)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                        <div className="sm:col-span-5">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Loại vỏ</label>
                                            <select
                                                value={manualReturnType}
                                                onChange={(e) => setManualReturnType(e.target.value)}
                                                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 appearance-none outline-none focus:border-primary/40"
                                            >
                                                {currentFilteredProducts.map(p => (
                                                    <option key={p.id} value={p.id}>{p.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Số lượng</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={manualReturnQty}
                                                onChange={(e) => setManualReturnQty(e.target.value)}
                                                onBlur={(e) => {
                                                    const qty = Number(e.target.value);
                                                    if (!Number.isInteger(qty) || qty < 1) {
                                                        alert('Số lượng vỏ phải lớn hơn 0.');
                                                    }
                                                }}
                                                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black text-slate-800 outline-none focus:border-primary/40"
                                            />
                                        </div>
                                        <div className="sm:col-span-4" />
                                    </div>
                                </div>
                            )}

                            {/* Chi tiết sản phẩm */}
                            <div className="rounded-3xl border border-primary/20 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-primary/10">
                                    <div className="flex items-center gap-2.5">
                                        <LayoutGrid className="w-4 h-4 text-primary" />
                                        <h4 className="text-[18px] !font-extrabold !text-primary">Chi tiết xuất</h4>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={fetchInventory}
                                            className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 text-[13px] font-bold"
                                        >
                                            <Package size={16} />
                                            Chọn từ kho
                                        </button>
                                        <button
                                            type="button"
                                            onClick={addItem}
                                            className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all flex items-center gap-1.5 text-[13px] font-bold"
                                        >
                                            <Plus size={16} />
                                            Thêm dòng
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {items.map((item, index) => (
                                        <div key={item.id} className="relative p-4 rounded-2xl bg-slate-50 border border-slate-200 group">
                                            <div className="grid grid-cols-12 gap-3 sm:items-end">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Loại tài sản</label>
                                                    <div className="relative">
                                                        <select
                                                            value={item.item_type}
                                                            onChange={(e) => updateItem(item.id, 'item_type', e.target.value)}
                                                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 appearance-none outline-none focus:border-primary/40"
                                                        >
                                                            {currentFilteredProducts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                                        </select>
                                                        <ChevronDown className="w-3.5 h-3.5 text-primary/70 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                    </div>
                                                </div>
                                                <div className="col-span-12 sm:col-span-5">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                                                        Số Serial / RFID
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <InventorySearchableSelect
                                                                items={inventoryItems}
                                                                value={item.item_code}
                                                                onSelect={(serial) => updateItemWithInventory(item.id, serial)}
                                                                isMachine={formData.issue_type === 'TRA_MAY'}
                                                                isLoading={isInventoryLoading}
                                                                isEmpty={!formData.warehouse_id}
                                                                excludedSerials={items
                                                                    .filter(it => it.id !== item.id)
                                                                    .map(it => (it.item_code || '').trim())
                                                                    .filter(Boolean)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openScanner(index)}
                                                            className="h-10 w-10 shrink-0 inline-flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-all shadow-sm border border-primary/20"
                                                            title="Quét mã"
                                                            aria-label="Quét mã serial"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-span-8 sm:col-span-2">
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block text-center">S.Lượng</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                                        disabled={formData.issue_type === 'TRA_VO'}
                                                        className={clsx(
                                                            "w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-[13px] font-black text-slate-800 text-center outline-none focus:border-primary/40",
                                                            formData.issue_type === 'TRA_VO' && "bg-slate-100 text-slate-500 cursor-not-allowed"
                                                        )}
                                                    />
                                                </div>

                                                <div className="col-span-4 sm:col-span-1 flex items-end justify-end sm:justify-center pb-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="h-10 w-10 inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                        title="Xóa dòng"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Tổng sản phẩm</span>
                            <span className="text-[20px] font-black text-slate-900 leading-none">{formData.total_items}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-[14px] font-bold hover:bg-slate-50 transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                form="goodsIssueForm"
                                disabled={isLoading}
                                className={clsx(
                                    "px-8 py-2.5 rounded-2xl text-[14px] font-extrabold flex items-center gap-2 shadow-lg transition-all active:scale-95",
                                    isLoading ? "bg-slate-300 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Clock className="animate-spin w-4 h-4" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Lưu Phiếu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title="Quét mã tài sản"
            />

            <InventoryPickerModal
                isOpen={isInventoryPickerOpen}
                onClose={() => setIsInventoryPickerOpen(false)}
                onConfirm={handleConfirmInventorySelection}
                items={inventoryItems}
                isLoading={isInventoryLoading}
                type={formData.issue_type === 'TRA_MAY' ? 'MAY' : 'BINH'}
            />
        </>,
        document.body
    );
}
