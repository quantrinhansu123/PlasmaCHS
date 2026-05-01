import { Activity, Bluetooth, ChevronDown, Cpu, Hash, MapPin, MonitorIcon, Package, Radio, Save, ScanLine, Search, Settings2, Wind, X, Building } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    CYLINDER_VOLUMES,
    EMISSION_HEAD_TYPES,
    GAS_TYPES,
    MACHINE_STATUSES,
    MACHINE_TYPES,
    VALVE_TYPES
} from '../../constants/machineConstants';
import { supabase } from '../../supabase/config';
import BarcodeScanner from '../Common/BarcodeScanner';
import clsx from 'clsx';
import Combobox from '../ui/Combobox';

export default function MachineFormModal({ machine, onClose, onSuccess }) {
    const isEdit = !!machine;
    const [isLoading, setIsLoading] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const defaultState = {
        serial_number: '',
        machine_account: '',
        status: 'chưa xác định',
        warehouse: '',
        bluetooth_mac: '',
        machine_type: 'BV',
        version: '',
        cylinder_volume: 'không',
        gas_type: 'Air',
        valve_type: 'không',
        emission_head_type: 'không',
        customer_name: '',
        department_in_charge: ''
    };

    const [formData, setFormData] = useState(defaultState);
    const [staffList, setStaffList] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);
    const [customersList, setCustomersList] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const customerDropdownRef = useRef(null);
    
    const agencyOptions = useMemo(() => {
        const warehouseBranches = (warehousesList || []).map(w => w.branch_office);
        const customerAgencies = (customersList || []).map(c => c.agency_name);
        const customerGroups = (customersList || []).map(c => c.business_group);
        const userDepartments = (staffList || []).map(u => u.department);
        const userSalesGroups = (staffList || []).map(u => u.sales_group);

        return Array.from(new Set([
            ...warehouseBranches,
            ...customerAgencies,
            ...customerGroups,
            ...userDepartments,
            ...userSalesGroups
        ])).filter(Boolean).sort();
    }, [warehousesList, customersList, staffList]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(onClose, 300);
    }, [onClose]);

    const resolveWarehouseStorageValue = (raw, list) => {
        const v = (raw || '').toString().trim();
        if (!v) return '';
        const row = (list || []).find(
            (w) =>
                String(w.id) === v ||
                (w.code && String(w.code) === v) ||
                (w.name && w.name === v)
        );
        if (row) return String(row.code || row.id || '').trim();
        return v;
    };

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch Warehouses
                const { data: whData } = await supabase
                    .from('warehouses')
                    .select('*')
                    .eq('status', 'Đang hoạt động')
                    .order('name');
                if (whData) setWarehousesList(whData);

                // Fetch Customers
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('name, agency_name, business_group')
                    .order('name');
                if (customerData) setCustomersList(customerData);

                // Fetch Staff
                const { data: userData } = await supabase
                    .from('app_users')
                    .select('id, name, role, department, sales_group')
                    .order('name');
                if (userData) setStaffList(userData);
            } catch (err) {
                console.error('Error fetching modal data:', err);
            }
        };
        fetchAllData();
    }, [isEdit]);

    const filteredCustomers = customersList.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isEdit) {
            setFormData({
                serial_number: machine.serial_number || '',
                machine_account: machine.machine_account || '',
                status: machine.status || 'chưa xác định',
                warehouse: resolveWarehouseStorageValue(machine.warehouse, warehousesList),
                bluetooth_mac: machine.bluetooth_mac || '',
                machine_type: machine.machine_type || 'BV',
                version: machine.version || '',
                cylinder_volume: machine.cylinder_volume || 'không',
                gas_type: machine.gas_type || 'Air',
                valve_type: machine.valve_type || 'không',
                emission_head_type: machine.emission_head_type || 'không',
                customer_name: machine.customer_name || '',
                department_in_charge: machine.department_in_charge || ''
            });
            setCustomerSearch(machine.customer_name || '');
        }
    }, [machine, isEdit, warehousesList]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'serial_number') {
                newState.machine_account = value;
            }
            return newState;
        });
    };

    const handleCustomerSelect = (name) => {
        setFormData(prev => ({ ...prev, customer_name: name }));
        setCustomerSearch(name);
        setShowCustomerDropdown(false);
    };

    const handleCustomerSearchChange = (e) => {
        setCustomerSearch(e.target.value);
        setShowCustomerDropdown(true);
    };

    const handleScanSuccess = useCallback((decodedText) => {
        setFormData(prev => ({
            ...prev,
            serial_number: decodedText,
            machine_account: decodedText
        }));
        setIsScannerOpen(false);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.serial_number || !formData.machine_type) {
            setErrorMsg('Vui lòng điền các trường bắt buộc (*)');
            return;
        }

        setIsLoading(true);

        try {
            const payload = { ...formData };

            if (isEdit) {
                // Remove internal fields for update safety
                delete payload.id;
                delete payload.created_at;
                delete payload.updated_at;

                const { error } = await supabase
                    .from('machines')
                    .update(payload)
                    .eq('id', machine.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('machines')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving machine:', error);
            if (error.code === '23505') {
                setErrorMsg(`Mã Serial "${formData.serial_number}" đã tồn tại.`);
            } else {
                setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu thiết bị.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const sideDrawerContent = (
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title="Quét mã Serial máy"
            />
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            {/* Drawer Panel */}
            <div
                className={clsx(
                    "relative bg-white shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500 ease-out",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-primary/10">
                            <MonitorIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[17px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5">
                                {isEdit ? 'Cập nhật thiết bị' : 'Thêm máy mới'}
                            </h3>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {isEdit ? `Serial: ${formData.serial_number}` : 'Thông tin cấu hình hệ thống'}
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

                {/* Form Body — Times New Roman theo yêu cầu in/biểu mẫu */}
                <div className="font-roboto flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30 [&_input]:font-roboto [&_select]:font-roboto [&_textarea]:font-roboto [&_button]:font-roboto">
                    {errorMsg && (
                        <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[13px] font-bold text-red-600 flex items-center gap-2 animate-shake">
                            <X className="w-4 h-4 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                        <form id="machineForm" onSubmit={handleSubmit} className="space-y-6">
                            {/* Section 1: Định danh thiết bị */}
                            <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-blue-700 [&_label_svg]:text-blue-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-blue-700 pb-3 border-b border-blue-100 uppercase tracking-tight">
                                    <Hash className="w-5 h-5 text-blue-600" /> Định danh thiết bị
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="md:col-span-2 lg:col-span-1">
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><ScanLine className="w-4 h-4" />Serial (Mã máy) <span className="text-red-500">*</span></label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                name="serial_number"
                                                value={formData.serial_number}
                                                onChange={handleChange}
                                                placeholder="VD: PLT-25D1-50-TM"
                                                className="w-full h-12 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setIsScannerOpen(true)}
                                                className="absolute right-2 p-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-all flex items-center justify-center shadow-sm"
                                                title="Quét barcode"
                                            >
                                                <ScanLine className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Hash className="w-4 h-4" />Tài khoản máy</label>
                                        <input
                                            type="text"
                                            name="machine_account"
                                            value={formData.machine_account}
                                            disabled
                                            className="w-full h-12 px-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Activity className="w-4 h-4" />Trạng thái <span className="text-red-500">*</span></label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                        >
                                            {MACHINE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><MapPin className="w-4 h-4" />Kho quản lý</label>
                                        <select
                                            name="warehouse"
                                            value={formData.warehouse || ''}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                        >
                                            <option value="">-- Chưa xác định --</option>
                                            {warehousesList.map((w) => {
                                                const val = (w.code || w.id || '').toString();
                                                return <option key={w.id} value={val}>{w.name}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Cấu hình kỹ thuật */}
                            <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-blue-700 [&_label_svg]:text-blue-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-blue-700 pb-3 border-b border-blue-100 uppercase tracking-tight">
                                    <MonitorIcon className="w-5 h-5 text-blue-600" /> Cấu hình & thông số
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Bluetooth className="w-4 h-4" />Bluetooth MAC</label>
                                        <input
                                            type="text"
                                            name="bluetooth_mac"
                                            value={formData.bluetooth_mac}
                                            onChange={handleChange}
                                            placeholder="VD: 00:1A:2B:3C:4D:5E"
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Cpu className="w-4 h-4" />Loại máy <span className="text-red-500">*</span></label>
                                        <select
                                            name="machine_type"
                                            value={formData.machine_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-700 cursor-pointer"
                                        >
                                            {MACHINE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Hash className="w-4 h-4" />Phiên bản</label>
                                        <input
                                            type="text"
                                            name="version"
                                            value={formData.version}
                                            onChange={handleChange}
                                            placeholder="VD: v2.5.1"
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all font-bold text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Phụ kiện */}
                            <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-blue-700 [&_label_svg]:text-blue-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-blue-700 pb-3 border-b border-blue-100 uppercase tracking-tight">
                                    <Package className="w-5 h-5 text-blue-600" /> Phụ kiện & bình khí
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Package className="w-4 h-4" />Thể tích bình</label>
                                        <select
                                            name="cylinder_volume"
                                            value={formData.cylinder_volume}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all text-[14px] font-bold text-slate-700 cursor-pointer"
                                        >
                                            {CYLINDER_VOLUMES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Wind className="w-4 h-4" />Loại khí</label>
                                        <select
                                            name="gas_type"
                                            value={formData.gas_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all text-[14px] font-bold text-slate-700 cursor-pointer"
                                        >
                                            {GAS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Settings2 className="w-4 h-4" />Loại van</label>
                                        <select
                                            name="valve_type"
                                            value={formData.valve_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all text-[14px] font-bold text-slate-700 cursor-pointer"
                                        >
                                            {VALVE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider mb-1.5"><Radio className="w-4 h-4" />Loại đầu phát</label>
                                        <select
                                            name="emission_head_type"
                                            value={formData.emission_head_type}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 focus:bg-white outline-none transition-all text-[14px] font-bold text-slate-700 cursor-pointer"
                                        >
                                            {EMISSION_HEAD_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Thông tin sử dụng */}
                            <div className="bg-white rounded-3xl border border-blue-100 p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-blue-700 [&_label_svg]:text-blue-600">
                                <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-blue-700 pb-3 border-b border-blue-100 uppercase tracking-tight">
                                    <MapPin className="w-5 h-5 text-blue-600" /> Thông tin sử dụng
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div ref={customerDropdownRef} className="relative">
                                        <label className="flex items-center gap-1.5 text-[12px] font-black text-slate-700 mb-1.5 uppercase tracking-wider"><Search className="w-4 h-4" /> Khách hàng đang dùng</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={customerSearch}
                                                onChange={handleCustomerSearchChange}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                placeholder="Tìm kiếm khách hàng..."
                                                className="w-full h-12 pl-10 pr-10 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-900"
                                            />
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        </div>
                                        {showCustomerDropdown && (
                                            <div className="absolute z-50 mt-1 w-full bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredCustomers.length > 0 ? (
                                                    filteredCustomers.map((c, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleCustomerSelect(c.name)}
                                                            className="w-full px-4 py-2.5 text-left text-[14px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                        >
                                                            {c.name}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-sm text-slate-500 font-medium">Không tìm thấy khách hàng</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[12px] font-black text-slate-700 mb-1.5 uppercase tracking-wider"><Building className="w-4 h-4" />Đại lý / Phòng ban</label>
                                        <Combobox
                                            value={formData.department_in_charge}
                                            onChange={(val) => setFormData(prev => ({ ...prev, department_in_charge: val }))}
                                            options={agencyOptions}
                                            placeholder="Gõ hoặc chọn đại lý..."
                                            emptyMessage="Không tìm thấy. Gõ để thêm mới."
                                        />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Actions */}
                    <div className="font-roboto px-6 py-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.03)] z-20 [&_button]:font-roboto">
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
                            form="machineForm"
                            disabled={isLoading}
                            className="min-w-[180px] h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-[13px] font-black rounded-2xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-blue-700/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    {isEdit ? 'Lưu thay đổi' : 'Lưu hồ sơ máy'}
                                </>
                            )}
                        </button>
                    </div>
            </div>
        </div>
    );

    return createPortal(sideDrawerContent, document.body);
}
