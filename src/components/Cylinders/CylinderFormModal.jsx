import { Activity, ActivitySquare, Building2, Calendar, Camera, Gauge, Hash, Save, Scale, ScanLine, Settings2, Tag, User, Warehouse, Wind, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
    CYLINDER_STATUSES,
    CYLINDER_VOLUMES,
    GAS_TYPES,
    HANDLE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { toast } from 'react-toastify';
import usePermissions from '../../hooks/usePermissions';
import { filterWarehousesForCurrentUser } from '../../utils/orderWarehouseScope';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';
import { SearchableSelect } from '../ui/SearchableSelect';

const findMatchingId = (list, value, defaultValue) => {
    if (!value) return defaultValue;
    const match = list.find(item =>
        item.id.toLowerCase() === value.toString().toLowerCase() ||
        item.label.toLowerCase() === value.toString().toLowerCase()
    );
    return match ? match.id : defaultValue;
};

export default function CylinderFormModal({ cylinder, onClose, onSuccess }) {
    const { role, user, department } = usePermissions();
    const isEdit = !!cylinder;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const defaultState = {
        serial_number: '',
        status: 'sẵn sàng',
        net_weight: '8',
        category: 'BV',
        volume: 'bình 4L/ CGA870',
        gas_type: 'AirMAC',
        valve_type: 'Van Messer/Phi 6/ CB Trắng',
        handle_type: 'Có quai',
        customer_id: '',
        department: '',
        warehouse_id: '',
        supplier_id: '',
        cylinder_code: '',
        expiry_date: ''
    };

    const [formData, setFormData] = useState(defaultState);
    const [customersList, setCustomersList] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [suppliersList, setSuppliersList] = useState([]);
    const [suppliersLoading, setSuppliersLoading] = useState(false);
    const initializedCylinderIdRef = useRef(null);

    const resolveWarehouseSelectValue = useCallback((storedValue, warehouses = []) => {
        const stored = String(storedValue || '').trim();
        if (!stored) return '';
        const matched = (warehouses || []).find(
            (w) => String(w.id) === stored
                || String(w.name || '').trim().toLowerCase() === stored.toLowerCase(),
        );
        if (matched?.id) return String(matched.id);
        if (/^[0-9a-f-]{36}$/i.test(stored)) return stored;
        return '';
    }, []);

    const warehouseSelectOptions = useMemo(() => {
        const options = warehousesList.map((w) => ({
            value: String(w.id),
            label: w.name,
        }));
        const current = String(formData.warehouse_id || '').trim();
        if (current && !options.some((opt) => opt.value === current)) {
            const legacy = warehousesList.find((w) => String(w.id) === current);
            options.unshift({
                value: current,
                label: legacy?.name || current,
            });
        }
        return options;
    }, [warehousesList, formData.warehouse_id]);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const { data, error } = await supabase
                    .from('customers')
                    .select('id, name')
                    .order('name');
                if (!error && data) {
                    setCustomersList(data);
                }
            } catch (err) {
                console.error('Error fetching customers:', err);
            }
        };

        const fetchWarehouses = async () => {
            try {
                const { data, error } = await supabase
                    .from('warehouses')
                    .select('id, name, code, branch_office, manager_name')
                    .order('name');
                if (!error && data) {
                    const rows = (data || []).filter((w) => String(w?.name || '').trim());
                    setWarehousesList(rows);
                } else if (error) {
                    console.error('Error fetching warehouses:', error);
                    toast.error('Không tải được danh sách kho.');
                }
            } catch (err) {
                console.error('Error fetching warehouses:', err);
            }
        };

        const fetchSuppliers = async () => {
            setSuppliersLoading(true);
            try {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('id, name')
                    .order('name');
                if (error) {
                    console.error('Error fetching suppliers:', error);
                    toast.error('Không tải được danh sách NCC: ' + error.message);
                    setSuppliersList([]);
                    return;
                }
                setSuppliersList(data || []);
            } catch (err) {
                console.error('Error fetching suppliers:', err);
                toast.error('Không tải được danh sách NCC.');
                setSuppliersList([]);
            } finally {
                setSuppliersLoading(false);
            }
        };

        fetchCustomers();
        fetchWarehouses();
        fetchSuppliers();
    }, [isEdit, role, user, department]);

    useEffect(() => {
        if (isEdit || warehousesList.length === 0) return;
        const effectiveRole = role || localStorage.getItem('user_role') || sessionStorage.getItem('user_role');
        const managed = filterWarehousesForCurrentUser(warehousesList, {
            role: effectiveRole,
            user,
            department,
        });
        const defaultWarehouseId = managed[0]?.id ? String(managed[0].id) : '';
        if (!defaultWarehouseId) return;
        setFormData((prev) => (!prev.warehouse_id && prev.status !== 'đã trả ncc')
            ? { ...prev, warehouse_id: defaultWarehouseId }
            : prev);
    }, [isEdit, warehousesList, role, user, department]);

    useEffect(() => {
        if (!isEdit || !cylinder?.id) {
            initializedCylinderIdRef.current = null;
            return;
        }
        if (initializedCylinderIdRef.current === cylinder.id) return;

        initializedCylinderIdRef.current = cylinder.id;
        const [, cDept] = cylinder.customer_name?.split(' / ') || ['', ''];

        setFormData({
            serial_number: cylinder.serial_number || '',
            status: findMatchingId(CYLINDER_STATUSES, cylinder.status, 'sẵn sàng'),
            net_weight: cylinder.net_weight || '',
            category: ['BV', 'TM'].includes(cylinder.category?.toUpperCase()) ? cylinder.category.toUpperCase() : 'BV',
            volume: findMatchingId(CYLINDER_VOLUMES, cylinder.volume, 'bình 4L/ CGA870'),
            gas_type: findMatchingId(GAS_TYPES, cylinder.gas_type, 'AirMAC'),
            valve_type: findMatchingId(VALVE_TYPES, cylinder.valve_type, 'Van Messer/Phi 6/ CB Trắng'),
            handle_type: findMatchingId(HANDLE_TYPES, cylinder.handle_type, 'Có quai'),
            customer_id: cylinder.customer_id || '',
            department: cDept || '',
            warehouse_id: resolveWarehouseSelectValue(cylinder.warehouse_id, warehousesList),
            supplier_id: cylinder.supplier_id || '',
            cylinder_code: cylinder.cylinder_code || '',
            expiry_date: cylinder.expiry_date || ''
        });
    }, [cylinder, isEdit, resolveWarehouseSelectValue, warehousesList]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === 'status') {
                if (value === 'đã trả ncc') {
                    next.warehouse_id = '';
                    next.customer_id = '';
                    next.department = '';
                } else if (prev.status === 'đã trả ncc') {
                    next.supplier_id = '';
                }
            }
            if (name === 'supplier_id' && value) {
                next.status = 'đã trả ncc';
                next.warehouse_id = '';
                next.customer_id = '';
                next.department = '';
            }
            return next;
        });
    };

    const handleNumericChange = (field, value) => {
        let raw = value.replace(/\./g, '').replace(/,/g, '.');
        raw = raw.replace(/[^0-9.]/g, '');
        const dots = raw.split('.');
        if (dots.length > 2) raw = dots[0] + '.' + dots.slice(1).join('');
        setFormData(prev => ({ ...prev, [field]: raw }));
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const parts = val.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(',');
    };

    // Barcode scanner
    const handleScanSuccess = useCallback((decodedText) => {
        setFormData(prev => ({ ...prev, serial_number: decodedText }));
        setIsScannerOpen(false);
    }, []);

    const startScanner = useCallback(() => {
        setIsScannerOpen(true);
    }, []);

    const stopScanner = useCallback(() => {
        setIsScannerOpen(false);
    }, []);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.serial_number) {
            setErrorMsg('Vui lòng nhập mã Serial RFID.');
            return;
        }

        if (formData.status === 'đã trả ncc') {
            if (!String(formData.supplier_id || '').trim()) {
                setErrorMsg('Vui lòng chọn NCC nhận vỏ (danh sách từ mục NCC).');
                return;
            }
        } else if (!formData.warehouse_id) {
            setErrorMsg('Vui lòng chọn Kho quản lý.');
            return;
        }

        setIsLoading(true);

        try {
            // Get customer name from list
            const customerObj = customersList.find(c => c.id === formData.customer_id);
            const customerNameBase = customerObj ? customerObj.name : '';
            const combinedCustomerName = customerNameBase
                ? `${customerNameBase}${formData.department ? ` / ${formData.department}` : ''}`
                : '';

            const payload = {
                ...formData,
                customer_name: combinedCustomerName,
                updated_at: new Date().toISOString()
            };
            if (!payload.net_weight) {
                delete payload.net_weight;
            } else {
                payload.net_weight = parseFloat(payload.net_weight);
            }
            payload.customer_id = payload.customer_id || null;
            payload.expiry_date = payload.expiry_date || null;
            payload.cylinder_code = payload.cylinder_code || null;
            if (payload.status === 'đã trả ncc') {
                payload.supplier_id = String(payload.supplier_id).trim();
                payload.warehouse_id = null;
                payload.customer_id = null;
                payload.customer_name = '';
            } else {
                payload.supplier_id = null;
                payload.warehouse_id = payload.warehouse_id && String(payload.warehouse_id).trim()
                    ? String(payload.warehouse_id).trim()
                    : null;
            }
            // Remove local only field
            delete payload.department;

            if (isEdit) {
                const { error } = await supabase
                    .from('cylinders')
                    .update(payload)
                    .eq('id', cylinder.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('cylinders')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving cylinder:', error);
            if (error?.code === '23505') {
                setErrorMsg(`Mã RFID Serial "${formData.serial_number}" đã tồn tại trên hệ thống.`);
            } else {
                setErrorMsg(`Lỗi hệ thống: ${error?.message || JSON.stringify(error)}`);
            }
        } finally {
            setIsLoading(false);
        }
    };


    const content = (
        <div className="flex flex-col h-full [&_input]:!font-[600] [&_select]:!font-[600] [&_textarea]:!font-[600] [&_input]:!text-slate-800 [&_select]:!text-slate-800 [&_textarea]:!text-slate-800 [&_input::placeholder]:!text-slate-400 [&_textarea::placeholder]:!text-slate-400">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                        <ActivitySquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">
                            {isEdit ? 'Cập nhật vỏ bình' : 'Thêm vỏ bình mới'}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {isEdit ? `RFID: ${formData.serial_number}` : 'Thông tin định danh và thông số'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                {errorMsg && (
                    <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                        <X className="w-4 h-4 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <form id="cylinderForm" onSubmit={handleSubmit} className="space-y-6">
                    <BarcodeScanner
                        isOpen={isScannerOpen}
                        onClose={stopScanner}
                        onScanSuccess={handleScanSuccess}
                        title="Quét Barcode RFID"
                    />

                    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <Hash className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Thông tin định danh</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2 lg:col-span-1 space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <ScanLine className="w-4 h-4 text-primary/60" />
                                    Mã Serial RFID <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-3 items-center w-full min-w-0">
                                    <input
                                        type="text"
                                        name="serial_number"
                                        value={formData.serial_number}
                                        onChange={handleChange}
                                        placeholder="Ví dụ: QR04116"
                                        className="flex-1 min-w-0 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={startScanner}
                                        className="w-12 h-11 shrink-0 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center shadow-md shadow-primary/20 border border-primary/40 group active:scale-95 !p-0"
                                        title="Quét Barcode"
                                    >
                                        <Camera
                                            width={20}
                                            height={20}
                                            strokeWidth={2}
                                            className="!w-6 !h-6 transition-transform group-hover:scale-110"
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Activity className="w-4 h-4 text-primary/60" />
                                    Trạng thái
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    {CYLINDER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Building2 className="w-4 h-4 text-primary/60" />
                                    NCC nhận vỏ
                                    {formData.status === 'đã trả ncc' && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    name="supplier_id"
                                    value={formData.supplier_id || ''}
                                    onChange={handleChange}
                                    disabled={suppliersLoading}
                                    className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all shadow-sm cursor-pointer disabled:opacity-60"
                                >
                                    <option value="">
                                        {suppliersLoading
                                            ? 'Đang tải danh sách NCC...'
                                            : '-- Chọn NCC (từ danh sách NCC) --'}
                                    </option>
                                    {suppliersList.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] font-semibold text-slate-500 leading-snug">
                                    Chọn NCC từ dropdown — hệ thống tự chuyển trạng thái «Đã trả NCC» (hoặc chọn trạng thái đó trước).
                                    {suppliersList.length === 0 && !suppliersLoading && (
                                        <span className="block text-amber-700 mt-0.5">Chưa có NCC — thêm tại mục Nhà cung cấp.</span>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Tag className="w-4 h-4 text-primary/60" />
                                    Thể loại
                                </label>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    <option value="BV">Bệnh viện (BV)</option>
                                    <option value="TM">Thẩm mỹ viện (TM)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <User className="w-4 h-4 text-primary/60" />
                                    Khách hàng
                                </label>
                                <select
                                    name="customer_id"
                                    value={formData.customer_id || ''}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    <option value="">-- Trống (Thuộc kho) --</option>
                                    {customersList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Settings2 className="w-4 h-4 text-primary/60" />
                                    Vị trí
                                </label>
                                <input
                                    type="text"
                                    name="department"
                                    value={formData.department || ''}
                                    onChange={handleChange}
                                    placeholder="Ví dụ: Khoa Cấp cứu, Tầng 3..."
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Warehouse className="w-4 h-4 text-primary/60" />
                                    Kho quản lý {formData.status !== 'đã trả ncc' && <span className="text-red-500">*</span>}
                                </label>
                                <SearchableSelect
                                    options={warehouseSelectOptions}
                                    value={formData.warehouse_id || ''}
                                    onValueChange={(value) => setFormData((prev) => ({ ...prev, warehouse_id: value }))}
                                    placeholder="-- Chọn kho --"
                                    searchPlaceholder="Tìm kho..."
                                    emptyMessage={warehousesList.length === 0 ? 'Đang tải hoặc chưa có kho.' : 'Không tìm thấy kho.'}
                                    disabled={formData.status === 'đã trả ncc'}
                                    className="h-11 rounded-xl text-[14px] font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Hash className="w-4 h-4 text-primary/60" />
                                    Mã bình khắc (Vật lý)
                                </label>
                                <input
                                    type="text"
                                    name="cylinder_code"
                                    value={formData.cylinder_code || ''}
                                    onChange={handleChange}
                                    placeholder="Ví dụ: P00123"
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Calendar className="w-4 h-4 text-primary/60" />
                                    Hạn kiểm định
                                </label>
                                <input
                                    type="date"
                                    name="expiry_date"
                                    value={formData.expiry_date || ''}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm">
                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                            <ActivitySquare className="w-4 h-4 text-primary" />
                            <h4 className="text-[18px] !font-extrabold !text-primary">Thông số kỹ thuật</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Scale className="w-4 h-4 text-primary/60" />
                                    Khối lượng tịnh (kg)
                                </label>
                                <input
                                    type="text"
                                    name="net_weight"
                                    value={formatNumber(formData.net_weight)}
                                    onChange={(e) => handleNumericChange('net_weight', e.target.value)}
                                    placeholder="Ví dụ: 12,5"
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Gauge className="w-4 h-4 text-primary/60" />
                                    Thể tích
                                </label>
                                <select
                                    name="volume"
                                    value={formData.volume}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Wind className="w-4 h-4 text-primary/60" />
                                    Loại khí
                                </label>
                                <select
                                    name="gas_type"
                                    value={formData.gas_type}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Settings2 className="w-4 h-4 text-primary/60" />
                                    Loại van
                                </label>
                                <select
                                    name="valve_type"
                                    value={formData.valve_type}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                                    <Wrench className="w-4 h-4 text-primary/60" />
                                    Loại quai
                                </label>
                                <select
                                    name="handle_type"
                                    value={formData.handle_type}
                                    onChange={handleChange}
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white transition-all shadow-sm"
                                >
                                    {HANDLE_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,0.03)] z-10">
                <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-2.5 text-[13px] font-black text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest"
                    disabled={isLoading}
                >
                    Hủy bỏ
                </button>
                <button
                    type="submit"
                    form="cylinderForm"
                    disabled={isLoading}
                    className="min-w-[160px] h-11 px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {isEdit ? 'Cập nhật' : 'Hoàn tất'}
                </button>
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
                    "relative bg-slate-50 shadow-2xl w-full max-w-4xl flex flex-col h-full min-h-0 border-l border-slate-200 animate-in slide-in-from-right duration-500",
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
