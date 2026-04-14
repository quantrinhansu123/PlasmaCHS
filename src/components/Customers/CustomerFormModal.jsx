import { clsx } from 'clsx';
import { Building, Calendar, Hash, Mail, MapPin, Phone, Receipt, Save, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabase/config';
import { notificationService } from '../../utils/notificationService';
import { formatPhoneNumber, validateMST, validatePhone } from '../../utils/taxUtils';

export default function CustomerFormModal({ customer, onClose, onSuccess, categories, warehouses }) {
    const isEdit = !!customer;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [agencySuggestions, setAgencySuggestions] = useState([]);
    const [isClosing, setIsClosing] = useState(false);
    const [taxError, setTaxError] = useState(false);
    const [phoneError, setPhoneError] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

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
        invoice_address: '',
        invoice_email: '',
        care_expiry_date: '',
        care_assigned_at: '',
        status: 'Thành công'
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
                invoice_address: customer.invoice_address || '',
                invoice_email: customer.invoice_email || '',
                care_expiry_date: customer.care_expiry_date || '',
                care_assigned_at: customer.care_assigned_at || '',
                status: customer.status || 'Thành công'
            });
        } else {
            // Auto generate CODE — find the true MAX code number, not just the latest created
            const generateCode = async () => {
                try {
                    const { data: allCodes } = await supabase
                        .from('customers')
                        .select('code')
                        .like('code', 'KH%');

                    let maxNum = 0;
                    if (allCodes && allCodes.length > 0) {
                        for (const row of allCodes) {
                            const numStr = (row.code || '').replace(/[^0-9]/g, '');
                            const num = numStr ? parseInt(numStr, 10) : 0;
                            if (num > maxNum) maxNum = num;
                        }
                    }
                    const nextCode = `KH${(maxNum + 1).toString().padStart(5, '0')}`;
                    setFormData(prev => ({ ...prev, code: nextCode }));
                } catch (err) {
                    console.error('Error generating code:', err);
                    setFormData(prev => ({ ...prev, code: `KH${Date.now().toString().slice(-5)}` }));
                }
            };
            generateCode();

            // Set default care_expiry_date (60 days from now) và care_assigned_at
            const now = new Date();
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 60);
            setFormData(prev => ({
                ...prev,
                care_assigned_at: now.toISOString(),
                care_expiry_date: expiry.toISOString().split('T')[0]
            }));
        }
    }, [isEdit, customer, warehouses]);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data } = await supabase.from('app_users').select('id, name, role, department').order('name');
                if (data) setStaffList(data);
            } catch (err) {
                console.error(err);
            }
        };

        const fetchAgencies = async () => {
            try {
                const { data } = await supabase.from('customers').select('agency_name');
                if (data) {
                    const unique = [...new Set(data.map(d => d.agency_name).filter(Boolean))];
                    setAgencySuggestions(unique);
                }
            } catch (err) { }
        };

        fetchStaff();
        fetchAgencies();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            const formatted = formatPhoneNumber(value);
            setFormData(prev => ({ ...prev, [name]: formatted }));
            setPhoneError(formatted ? !validatePhone(formatted) : false);
        } else if (name === 'tax_code') {
            setFormData(prev => ({ ...prev, [name]: value }));
            setTaxError(value ? !validateMST(value) : false);
        } else if (name === 'care_assigned_at') {
            setFormData(prev => ({
                ...prev,
                care_assigned_at: value ? new Date(`${value}T12:00:00`).toISOString() : '',
            }));
        } else if (name === 'warehouse_id') {
            const selectedWarehouse = warehouses?.find(w => w.id === value);
            setFormData(prev => ({
                ...prev,
                warehouse_id: value,
                legal_rep: selectedWarehouse?.manager_name || prev.legal_rep,
                agency_name: selectedWarehouse?.branch_office || prev.agency_name
            }));
        } else if (name === 'managed_by') {
            const selectedStaff = staffList?.find(u => u.name === value);
            setFormData(prev => ({
                ...prev,
                managed_by: value,
                agency_name: selectedStaff?.department || prev.agency_name
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.phone && !validatePhone(formData.phone)) {
            setErrorMsg('❌ Số điện thoại không đúng định dạng!');
            setPhoneError(true);
            return;
        }

        if (formData.tax_code && !validateMST(formData.tax_code)) {
            setErrorMsg('❌ Mã số thuế không đúng định dạng!');
            setTaxError(true);
            return;
        }

        setIsLoading(true);
        setErrorMsg('');

        const payload = {
            ...formData,
            care_assigned_at: formData.care_assigned_at || null,
        };

        const prevStatus = isEdit ? customer.status : null;
        const prevSuccessAt = isEdit ? customer.success_at : null;
        if (formData.status === 'Thành công') {
            payload.success_at =
                prevSuccessAt && prevStatus === 'Thành công'
                    ? prevSuccessAt
                    : new Date().toISOString();
        } else {
            payload.success_at = null;
        }

        try {
            // Duplicate Check: Name + Phone + Category
            const checkQuery = supabase
                .from('customers')
                .select('id, name')
                .eq('name', formData.name.trim())
                .eq('category', formData.category);

            // Only check phone if it exists
            if (formData.phone) {
                checkQuery.eq('phone', formData.phone.trim());
            } else {
                checkQuery.is('phone', null);
            }

            // Exclude current record if editing
            if (isEdit) {
                checkQuery.neq('id', customer.id);
            }

            const { data: existing, error: checkError } = await checkQuery
                .select('id, name, care_expiry_date, care_by');

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                const existingCustomer = existing[0];
                const now = new Date();
                const expiryDate = new Date(existingCustomer.care_expiry_date);

                // Nếu khách hàng đã QUÁ HẠN (expired)
                if (now > expiryDate) {
                    const confirmSteal = window.confirm(`⚠️ Khách hàng "${existingCustomer.name}" đã quá hạn chăm sóc (phụ trách cũ: ${existingCustomer.care_by || 'Không rõ'}). \n\nBạn có muốn nhận khách hàng này về tài khoản của mình không? (Bộ đếm 60 ngày sẽ được reset)`);

                    if (confirmSteal) {
                        const newExpiry = new Date();
                        newExpiry.setDate(newExpiry.getDate() + 60);

                        const updateData = {
                            ...payload,
                            care_by: formData.care_by || 'Sale hiện tại', // Nên lấy từ auth context nếu có, hiện tại dùng formData
                            care_assigned_at: now.toISOString(),
                            care_expiry_date: newExpiry.toISOString().split('T')[0]
                        };
                        delete updateData.code; // Không đổi mã khách hàng

                        const { error: stealError } = await supabase
                            .from('customers')
                            .update(updateData)
                            .eq('id', existingCustomer.id);

                        if (stealError) throw stealError;

                        // Log Care History for "Steal"
                        try {
                            await supabase
                                .from('customer_care_history')
                                .insert([{
                                    customer_id: existingCustomer.id,
                                    staff_name: updateData.care_by,
                                    assigned_at: now.toISOString()
                                }]);
                        } catch (historyError) {
                            console.error('Error logging care history (steal):', historyError);
                        }

                        notificationService.add({
                            title: `🎯 Đã nhận khách quá hạn: ${existingCustomer.name}`,
                            description: `Bạn đã tiếp nhận chăm sóc khách hàng này từ hôm nay.`,
                            type: 'success',
                            link: `/khach-hang?viewCustomerId=${existingCustomer.id}`
                        });

                        onSuccess();
                        return;
                    } else {
                        setIsLoading(false);
                        return;
                    }
                } else {
                    setErrorMsg(`❌ Khách hàng sở hữu: "${existingCustomer.name}" hiện vẫn đang trong thời hạn chăm sóc của ${existingCustomer.care_by || 'sale khác'}!`);
                    setIsLoading(false);
                    return;
                }
            }

            if (isEdit) {
                const { error } = await supabase
                    .from('customers')
                    .update(payload)
                    .eq('id', customer.id);
                if (error) throw error;
                
                // Log Care History if care_by changed during edit
                if (payload.care_by && payload.care_by !== customer.care_by) {
                    try {
                        await supabase
                            .from('customer_care_history')
                            .insert([{
                                customer_id: customer.id,
                                staff_name: payload.care_by,
                                assigned_at: new Date().toISOString()
                            }]);
                    } catch (historyError) {
                        console.error('Error logging care history (edit):', historyError);
                    }
                }
                
                // Nv KD thay đổi trạng thái sang Thành công
                if (payload.status === 'Thành công' && prevStatus !== 'Thành công') {
                    notificationService.add({
                        title: `🎉 Khách hàng chốt Thành công: ${formData.name}`,
                        description: `NV Kinh doanh (${formData.care_by || 'Không rõ'}) vừa chuyển trạng thái khách hàng này sang Thành công.`,
                        type: 'success',
                        link: `/khach-hang?viewCustomerId=${customer.id}`
                    });
                }
            } else {
                const { data: newCustomer, error } = await supabase
                    .from('customers')
                    .insert([payload])
                    .select('id')
                    .single();
                
                if (error) throw error;

                // Log Initial Care History
                if (newCustomer && payload.care_by) {
                    try {
                        await supabase
                            .from('customer_care_history')
                            .insert([{
                                customer_id: newCustomer.id,
                                staff_name: payload.care_by,
                                assigned_at: new Date().toISOString()
                            }]);
                    } catch (historyError) {
                        console.error('Error logging care history (new):', historyError);
                    }
                }

                // Notification for new customer
                notificationService.add({
                    title: `👤 Khách hàng mới: ${formData.name}`,
                    description: `Phụ trách: ${formData.care_by || 'Chưa gán'} - Mã: ${formData.code}`,
                    type: 'info',
                    link: `/khach-hang?viewCustomerId=${newCustomer.id}`
                });
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving customer:', error);
            setErrorMsg(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100010] flex items-center justify-center p-4 transition-all duration-300",
            isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
            <div
                className={clsx(
                    "absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-300"
                )}
                onClick={handleClose}
            />

            <div className={clsx(
                "relative bg-slate-50 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[40px] shadow-2xl flex flex-col border border-white animate-in zoom-in-95 duration-300",
                isClosing && "animate-out zoom-out-95 duration-300"
            )}>
                {/* Header */}
                <div className="sticky top-0 z-40 bg-white px-6 py-5 md:px-10 md:py-8 border-b border-slate-200 shrink-0 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Building className="w-6 h-6 md:w-8 md:h-8 text-primary shadow-sm" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                {isEdit ? 'CẬP NHẬT KHÁCH HÀNG' : 'THÊM KHÁCH HÀNG MỚI'}
                            </h2>
                            <p className="text-slate-400 text-[11px] md:text-xs font-bold uppercase tracking-widest mt-0.5">
                                Thông tin định danh và quản lý hệ thống
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 md:p-3 bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-95 border border-slate-200 shadow-sm"
                    >
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <form id="customer-form" onSubmit={handleSubmit} className="space-y-8 md:space-y-10">

                        {/* Section 1: Thông tin cơ bản */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 shadow-sm">
                            <h4 className="flex items-center gap-2.5 text-[18px] font-extrabold text-slate-800 pb-3 border-b border-slate-100">
                                <Receipt className="w-4 h-4 text-primary" /> Thông tin cơ bản
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><Hash className="w-4 h-4" /> Mã khách hàng *</label>
                                    <input
                                        type="text"
                                        name="code"
                                        required
                                        disabled={isEdit}
                                        value={formData.code}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><User className="w-4 h-4" /> Tên khách hàng / Tên cơ sở *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="VD: Bệnh viện Đa khoa tỉnh"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><Building className="w-4 h-4" /> Loại khách hàng *</label>
                                    <select
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                    >
                                        {categories && categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><Phone className="w-4 h-4" /> Số điện thoại</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="VD: 0912 345 678"
                                        className={clsx(
                                            "w-full h-12 px-4 border rounded-2xl focus:ring-4 outline-none transition-all font-semibold",
                                            phoneError
                                                ? "bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-100 focus:border-rose-400"
                                                : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                        )}
                                    />
                                    {phoneError && (
                                        <p className="text-[11px] font-bold text-rose-600 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                                            ⚠ Số điện thoại không đúng định dạng
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><MapPin className="w-4 h-4" /> Địa chỉ đặt máy</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder="VD: 123 Đường ABC, Phường XYZ, Quận ABC"
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><User className="w-4 h-4" /> Người đại diện</label>
                                    <input
                                        type="text"
                                        name="legal_rep"
                                        value={formData.legal_rep}
                                        onChange={handleChange}
                                        placeholder="Họ và tên..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><Building className="w-4 h-4" /> Kho cung cấp</label>
                                    <select
                                        name="warehouse_id"
                                        value={formData.warehouse_id}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Kho --</option>
                                        {warehouses && warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><Building className="w-4 h-4" /> Trạng thái *</label>
                                    <select
                                        name="status"
                                        required
                                        value={formData.status}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                    >
                                        <option value="" disabled>-- Chọn trạng thái --</option>
                                        <option value="Thành công">Thành công</option>
                                        <option value="Chưa thành công">Chưa thành công</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600">
                                            <Calendar className="w-4 h-4" /> Ngày đăng ký (bắt đầu chăm sóc)
                                        </label>
                                        <input
                                            type="date"
                                            name="care_assigned_at"
                                            value={formData.care_assigned_at ? formData.care_assigned_at.slice(0, 10) : ''}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                        />
                                        <p className="text-[10px] font-bold text-slate-400 ml-1">Thời điểm gán khách / bắt đầu đếm chu kỳ CS</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-1.5 text-[14px] font-bold mb-1.5 ml-1 text-primary">
                                            <Receipt className="w-4 h-4" /> Thời hạn chăm sóc (hết hạn)
                                        </label>
                                        <input
                                            type="date"
                                            name="care_expiry_date"
                                            value={formData.care_expiry_date}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-primary/5 border border-primary/20 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-black text-primary"
                                        />
                                        <p className="text-[10px] font-bold text-primary/60 ml-1 italic">* Mặc định 60 ngày kể từ lúc tạo</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Cấu trúc quản lý */}
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 shadow-sm">
                            <h4 className="flex items-center gap-2.5 text-[18px] font-extrabold text-slate-800 pb-3 border-b border-slate-100">
                                <Receipt className="w-4 h-4 text-emerald-500" /> Cấu trúc & Quản lý
                            </h4>
                            <div
                                className={clsx(
                                    'grid grid-cols-1 gap-x-8 gap-y-6',
                                    isEdit ? 'md:grid-cols-2' : 'md:grid-cols-3'
                                )}
                            >
                                {!isEdit && (
                                    <div>
                                        <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><User className="w-4 h-4" /> Kinh doanh (Chăm sóc)</label>
                                        <select
                                            name="care_by"
                                            value={formData.care_by}
                                            onChange={handleChange}
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                        >
                                            <option value="">-- Chọn NVKD/Giao hàng --</option>
                                            {staffList.map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ''}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600">
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
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5 ml-1 text-slate-600"><User className="w-4 h-4" /> Nhân viên phụ trách (Sale/Chốt đơn)</label>
                                    <select
                                        name="managed_by"
                                        value={formData.managed_by}
                                        onChange={handleChange}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900 cursor-pointer"
                                    >
                                        <option value="">-- Chọn Nhân viên --</option>
                                        {staffList.map(u => (
                                            <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                            className={clsx(
                                                "w-full h-12 pl-9 pr-4 border rounded-2xl focus:ring-4 outline-none transition-all font-semibold",
                                                taxError
                                                    ? "bg-rose-50 border-rose-300 text-rose-900 focus:ring-rose-100 focus:border-rose-400"
                                                    : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-primary/10 focus:border-primary/40 focus:bg-white"
                                            )}
                                        />
                                        {taxError && (
                                            <p className="text-[11px] font-bold text-rose-600 mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">
                                                ⚠ Mã số thuế không đúng định dạng hoặc sai số kiểm tra
                                            </p>
                                        )}
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
                                <div>
                                    <label className="flex items-center gap-1.5 text-[14px] font-semibold mb-1.5"><Mail className="w-4 h-4" />Email nhận hoá đơn</label>
                                    <input
                                        type="email"
                                        name="invoice_email"
                                        value={formData.invoice_email}
                                        onChange={handleChange}
                                        placeholder="Địa chỉ email nhận hoá đơn điện tử..."
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary/40 focus:bg-white outline-none transition-all font-semibold text-slate-900"
                                    />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 z-40 px-6 py-4 pb-12 md:px-10 md:py-6 bg-[#F9FAFB] border-t border-slate-200 shrink-0 flex flex-col-reverse md:flex-row items-center justify-between gap-4 md:gap-6 shadow-[0_-8px_20px_rgba(0,0,0,0.08)]">
                    <button
                        onClick={handleClose}
                        className="w-full md:w-auto px-10 py-4 rounded-2xl font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                    >
                        Hủy bỏ
                    </button>
                    <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
                        {errorMsg && (
                            <div className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-xs font-bold animate-pulse">
                                ⚠ {errorMsg}
                            </div>
                        )}
                        <button
                            type="submit"
                            form="customer-form"
                            disabled={isLoading || taxError}
                            className="w-full md:w-auto px-12 py-4 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>ĐANG LƯU...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>LƯU HỆ THỐNG</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

