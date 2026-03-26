import { clsx } from 'clsx';
import { Building, Hash, MapPin, Phone, Receipt, Save, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase/config';

export default function CustomerFormModal({ customer, onClose, onSuccess, categories, warehouses }) {
    const isEdit = !!customer;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [agencySuggestions, setAgencySuggestions] = useState([]);
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        const loadStaff = async () => {
            const { data } = await supabase.from('app_users').select('id, name, role').order('name');
            if (data) setStaffList(data);
        };
        const loadAgencies = async () => {
            const { data } = await supabase.from('customers').select('agency_name').not('agency_name', 'is', null).neq('agency_name', '');
            if (data) {
                const unique = [...new Set(data.map(d => d.agency_name).filter(Boolean))];
                setAgencySuggestions(unique);
            }
        };
        loadStaff();
        loadAgencies();
    }, []);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'BV',
        phone: '',
        address: '',
        legal_rep: '',
        warehouse_id: warehouses && warehouses.length > 0 ? warehouses[0].id : '',
        care_by: '',
        agency_name: '',
        managed_by: '',
        contact_info: '',
        business_group: '',
        tax_code: '',
        invoice_company_name: '',
        invoice_address: ''
    });

    useEffect(() => {
        if (isEdit) {
            setFormData({
                code: customer.code || '',
                name: customer.name || '',
                category: customer.category || 'BV',
                phone: customer.phone || '',
                address: customer.address || '',
                legal_rep: customer.legal_rep || '',
                warehouse_id: customer.warehouse_id || (warehouses && warehouses.length > 0 ? warehouses[0].id : ''),
                care_by: customer.care_by || '',
                agency_name: customer.agency_name || '',
                managed_by: customer.managed_by || '',
                contact_info: customer.contact_info || '',
                business_group: customer.business_group || '',
                tax_code: customer.tax_code || '',
                invoice_company_name: customer.invoice_company_name || '',
                invoice_address: customer.invoice_address || ''
            });
        } else {
            // Auto generate CODE
            const generateCode = async () => {
                try {
                    const { data } = await supabase
                        .from('customers')
                        .select('code')
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (data && data.length > 0 && data[0].code.startsWith('KH')) {
                        const lastCode = data[0].code;
                        const numStr = lastCode.replace(/[^0-9]/g, '');
                        const nextNum = numStr ? parseInt(numStr, 10) + 1 : 1;
                        setFormData(prev => ({ ...prev, code: `KH${nextNum.toString().padStart(5, '0')}` }));
                    } else {
                        setFormData(prev => ({ ...prev, code: 'KH00001' }));
                    }
                } catch (err) {
                    setFormData(prev => ({ ...prev, code: `KH${Math.floor(10000 + Math.random() * 90000)}` }));
                }
            };
            generateCode();
        }
    }, [customer, isEdit, warehouses]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;

        let updatedData = {
            ...formData,
            [name]: type === 'number' ? (value === '' ? 0 : parseInt(value, 10)) : value
        };

        // Auto sync agency_name when warehouse_id changes
        if (name === 'warehouse_id' && warehouses) {
            const selectedWh = warehouses.find(w => w.id === value);
            if (selectedWh && selectedWh.branch_office) {
                updatedData.agency_name = selectedWh.branch_office;
            }
        }

        setFormData(updatedData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!formData.code || !formData.name) {
            setErrorMsg('Vui lòng nhập Mã Khách Hàng và Tên Khách Hàng.');
            return;
        }

        setIsLoading(true);

        try {
            const payload = { ...formData, updated_at: new Date().toISOString() };

            if (isEdit) {
                const { error } = await supabase
                    .from('customers')
                    .update(payload)
                    .eq('id', customer.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving customer:', error);
            if (error.code === '23505') {
                setErrorMsg(`Mã Khách Hàng "${formData.code}" đã tồn tại trên hệ thống.`);
            } else {
                setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu khách hàng.');
            }
        } finally {
            setIsLoading(false);
        }
    };

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
                    "relative bg-slate-50 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-bold text-slate-900 tracking-tight">
                                {isEdit ? 'Chỉnh sửa Khách Hàng' : 'Thêm mới Khách Hàng'}
                            </h3>
                            <p className="text-[12px] font-semibold text-slate-500 mt-0.5">
                                {isEdit ? `Mã KH: ${formData.code}` : 'Điền đầy đủ thông tin bên dưới'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-20 sm:pb-6">
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-semibold text-rose-600 flex items-center gap-2">
                            <X className="w-5 h-5 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="customerForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* Section 1: Thông tin cơ bản */}
                        <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-primary pb-3 border-b border-primary/10">
                                <User className="w-4 h-4 text-primary/80" /> Thông tin định danh
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Hash className="w-4 h-4" />Mã Khách Hàng <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                                        <input
                                            type="text"
                                            name="code"
                                            value={formData.code}
                                            disabled={true}
                                            placeholder="Đang tạo tự động..."
                                            className="w-full h-12 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold text-slate-500 cursor-not-allowed"
                                            required
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">Được tạo tự động theo quy tắc KHxxxxx</p>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Building className="w-4 h-4" />Tên Khách Hàng / Bệnh Viện <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Tên đơn vị khách hàng..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Building className="w-4 h-4" />Loại khách hàng</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                    >
                                        <option value="BV">Bệnh viện (BV)</option>
                                        <option value="TM">Thẩm mỹ viện (TM)</option>
                                        <option value="PK">Phòng khám (PK)</option>
                                        <option value="NG">Khách ngoại giao (NG)</option>
                                        <option value="GD">Khách Gia đình (GD)</option>
                                        <option value="SP">Spa / Khác (SP)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><User className="w-4 h-4" />Ng.đại diện để liên lạc <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="legal_rep"
                                        value={formData.legal_rep}
                                        onChange={handleChange}
                                        placeholder="Tên người đại diện..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Phone className="w-4 h-4" />Thông tin người liên hệ phụ</label>
                                    <input
                                        type="text"
                                        name="contact_info"
                                        value={formData.contact_info}
                                        onChange={handleChange}
                                        placeholder="Tên, chức vụ người liên hệ phụ..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Liên hệ và Phân công */}
                        <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-primary pb-3 border-b border-primary/10">
                                <MapPin className="w-4 h-4 text-primary/80" /> Địa chỉ & ưu tiên liên hệ
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Phone className="w-4 h-4" />Số điện thoại liên lạc <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="09xx.xxx.xxx"
                                            className="w-full h-12 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><MapPin className="w-4 h-4" />Kho xuất hàng <span className="text-red-500">*</span></label>
                                    <select
                                        name="warehouse_id"
                                        value={formData.warehouse_id}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                        required
                                    >
                                        {warehouses && warehouses.map(wh => (
                                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><MapPin className="w-4 h-4" />Địa chỉ giao nhận chi tiết <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="Số nhà, đường, phường, quận/huyện, tỉnh/thành phố..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Building className="w-4 h-4" />Nhóm Kinh Doanh</label>
                                    <select
                                        name="business_group"
                                        value={formData.business_group}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Nhóm Kinh Doanh --</option>
                                        <option value="Nhóm KD Miền Bắc">Nhóm KD Miền Bắc</option>
                                        <option value="Nhóm KD Miền Trung">Nhóm KD Miền Trung</option>
                                        <option value="Nhóm KD Miền Nam">Nhóm KD Miền Nam</option>
                                        <option value="Nhóm Ngoại giao">Nhóm Ngoại giao</option>
                                        <option value="Nhóm Bệnh viện lớn">Nhóm Bệnh viện lớn</option>
                                        <option value="Nhóm Spa / Khác">Nhóm Spa / Khác</option>
                                        <option value="Nhóm Gia đình">Nhóm Gia đình</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><User className="w-4 h-4" />NV Kinh Doanh phụ trách chăm sóc</label>
                                    <select
                                        name="care_by"
                                        value={formData.care_by}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-primary/5 border border-primary/10 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 outline-none transition-all font-semibold text-primary cursor-pointer"
                                    >
                                        <option value="">-- Chọn NVKD --</option>
                                        {staffList.map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ''}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5">
                                        <Building className="w-4 h-4" />
                                        Chi nhánh / VPĐD (Đại lý)
                                    </label>
                                    <input
                                        type="text"
                                        name="agency_name"
                                        value={formData.agency_name}
                                        onChange={handleChange}
                                        placeholder="Gõ tên đại lý..."
                                        list="modal-agency-suggestions"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                    <datalist id="modal-agency-suggestions">
                                        {agencySuggestions.map((a, i) => <option key={i} value={a} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><User className="w-4 h-4" />Đại lý phụ trách (NVKD)</label>
                                    <select
                                        name="managed_by"
                                        value={formData.managed_by}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Kho phụ trách --</option>
                                        {warehouses && warehouses.map(w => (
                                            <option key={w.id} value={w.name}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Thông tin xuất hoá đơn */}
                        <div className="rounded-3xl border border-primary/10 bg-white p-5 sm:p-6 space-y-5 shadow-sm [&_label]:text-primary [&_label_svg]:text-primary/80">
                            <h4 className="flex items-center gap-2.5 text-[18px] !font-extrabold !text-primary pb-3 border-b border-primary/10">
                                <Receipt className="w-4 h-4 text-primary/80" /> Thông tin xuất hoá đơn
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Building className="w-4 h-4" />Mã số thuế</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/70" />
                                        <input
                                            type="text"
                                            name="tax_code"
                                            value={formData.tax_code}
                                            onChange={handleChange}
                                            placeholder="VD: 0101234567"
                                            className="w-full h-12 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Building className="w-4 h-4" />Tên công ty (trên hoá đơn)</label>
                                    <input
                                        type="text"
                                        name="invoice_company_name"
                                        value={formData.invoice_company_name}
                                        onChange={handleChange}
                                        placeholder="Tên công ty ghi trên hoá đơn..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><MapPin className="w-4 h-4" />Địa chỉ xuất hoá đơn</label>
                                    <input
                                        type="text"
                                        name="invoice_address"
                                        value={formData.invoice_address}
                                        onChange={handleChange}
                                        placeholder="Địa chỉ ghi trên hoá đơn GTGT..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3 removed off the form as requested to simplify */}

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-primary font-bold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="customerForm"
                        disabled={isLoading}
                        className="w-full md:flex-1 sm:w-auto px-6 py-3 bg-primary text-white font-bold text-[15px] rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 border border-primary/40 disabled:opacity-50 hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        {isEdit ? 'Lưu thay đổi' : 'Tạo khách hàng mới'}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
}
