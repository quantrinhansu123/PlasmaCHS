import {
    CalendarDays,
    Check,
    Gift,
    Save,
    Search,
    Tag,
    Users,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CUSTOMER_CATEGORIES } from '../constants/orderConstants';
import { supabase } from '../supabase/config';

const CUSTOMER_TYPES = [
    { id: 'TM', label: 'Thương mại (TM)' },
    { id: 'ĐL', label: 'Đại lý (ĐL)' },
    { id: 'Khác', label: 'Khác' },
];

const TARGET_MODES = [
    { id: 'ALL', label: 'Tất cả KH', icon: Users, desc: 'Áp dụng cho toàn bộ khách hàng' },
    { id: 'CATEGORY', label: 'Theo loại KH', icon: Tag, desc: 'Chọn loại khách hàng áp dụng' },
    { id: 'SPECIFIC', label: 'KH chỉ định', icon: Check, desc: 'Chọn từng khách hàng cụ thể' },
];

const INITIAL_FORM_STATE = {
    code: '',
    free_cylinders: '',
    start_date: '',
    end_date: '',
    customer_type: CUSTOMER_TYPES[0].id,
    target_mode: 'ALL',
    target_categories: [],
    target_customer_ids: [],
};

const CreatePromotion = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editPromo = state?.promo;

    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(editPromo ? {
        code: editPromo.code,
        free_cylinders: editPromo.free_cylinders,
        start_date: editPromo.start_date,
        end_date: editPromo.end_date,
        customer_type: editPromo.customer_type,
        target_mode: editPromo.target_mode || 'ALL',
        target_categories: editPromo.target_categories || [],
        target_customer_ids: editPromo.target_customer_ids || [],
    } : INITIAL_FORM_STATE);

    // Customer list for "SPECIFIC" mode
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    useEffect(() => {
        if (formData.target_mode === 'SPECIFIC') {
            fetchCustomers();
        }
    }, [formData.target_mode]);

    const fetchCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, name, code, category, phone')
                .order('name');
            if (!error && data) setCustomers(data);
        } catch (err) {
            console.error('Error fetching customers:', err);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const handleReset = () => {
        setFormData(editPromo ? {
            code: editPromo.code,
            free_cylinders: editPromo.free_cylinders,
            start_date: editPromo.start_date,
            end_date: editPromo.end_date,
            customer_type: editPromo.customer_type,
            target_mode: editPromo.target_mode || 'ALL',
            target_categories: editPromo.target_categories || [],
            target_customer_ids: editPromo.target_customer_ids || [],
        } : INITIAL_FORM_STATE);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const formatNumber = (val) => {
        if (val === null || val === undefined || val === '') return '';
        const parts = val.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(',');
    };

    const handleNumericChange = (field, value) => {
        const rawValue = value.replace(/\D/g, '');
        if (rawValue === '') {
            setFormData(prev => ({ ...prev, [field]: '' }));
            return;
        }
        setFormData(prev => ({ ...prev, [field]: parseInt(rawValue, 10) }));
    };

    // Category toggle
    const toggleCategory = (catId) => {
        setFormData(prev => ({
            ...prev,
            target_categories: prev.target_categories.includes(catId)
                ? prev.target_categories.filter(c => c !== catId)
                : [...prev.target_categories, catId]
        }));
    };

    // Customer toggle
    const toggleCustomer = (customerId) => {
        setFormData(prev => ({
            ...prev,
            target_customer_ids: prev.target_customer_ids.includes(customerId)
                ? prev.target_customer_ids.filter(c => c !== customerId)
                : [...prev.target_customer_ids, customerId]
        }));
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.includes(customerSearch)
    );

    const selectedCustomerNames = customers
        .filter(c => formData.target_customer_ids.includes(c.id))
        .map(c => c.name);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.code.trim()) return alert('Vui lòng nhập Mã khuyến mãi!');
        if (!formData.free_cylinders || Number(formData.free_cylinders) <= 0) return alert('Số lượng bình KM phải lớn hơn 0!');
        if (!formData.start_date || !formData.end_date) return alert('Vui lòng chọn ngày bắt đầu và kết thúc!');
        if (formData.end_date < formData.start_date) return alert('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!');
        if (formData.target_mode === 'CATEGORY' && formData.target_categories.length === 0) return alert('Vui lòng chọn ít nhất 1 loại khách hàng!');
        if (formData.target_mode === 'SPECIFIC' && formData.target_customer_ids.length === 0) return alert('Vui lòng chọn ít nhất 1 khách hàng!');

        setSaving(true);
        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                free_cylinders: Number(formData.free_cylinders),
                start_date: formData.start_date,
                end_date: formData.end_date,
                customer_type: formData.customer_type,
                target_mode: formData.target_mode,
                target_categories: formData.target_mode === 'CATEGORY' ? formData.target_categories : [],
                target_customer_ids: formData.target_mode === 'SPECIFIC' ? formData.target_customer_ids : [],
                is_active: editPromo ? editPromo.is_active : true,
            };

            if (editPromo) {
                const { error } = await supabase
                    .from('app_promotions')
                    .update(payload)
                    .eq('id', editPromo.id);
                if (error) throw error;
                alert('Cập nhật mã khuyến mãi thành công!');
                navigate('/khuyen-mai');
            } else {
                const { error } = await supabase
                    .from('app_promotions')
                    .insert([payload]);
                if (error) throw error;
                alert('Tạo mã khuyến mãi thành công!');
                handleReset();
            }
        } catch (error) {
            console.error('Error creating promotion:', error);
            if (error.code === '23505') {
                alert(`Mã khuyến mãi "${formData.code}" đã tồn tại! Vui lòng đặt tên khác.`);
            } else {
                alert('Có lỗi xảy ra khi tạo mã khuyến mãi.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[900px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-rose w-[350px] h-[350px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-amber w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            {/* Header */}
            <div className="mb-8 relative z-10">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Gift className="w-8 h-8 text-rose-600" />
                    {editPromo ? 'Cập nhật Mã Khuyến Mãi' : 'Tạo Mã Khuyến Mãi mới'}
                </h1>
                <p className="text-gray-500 mt-2 font-medium">Thiết lập thông tin mã khuyến mãi bình cho khách hàng hoặc đại lý</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
                <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-rose-900/10 border border-white overflow-hidden relative z-10">
                    <div className="p-6 md:p-10 space-y-8">

                        {/* Row 1: Mã KM + Số bình */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    Mã Khuyến mãi *
                                </label>
                                <input
                                    value={formData.code}
                                    onChange={(e) => handleChange('code', e.target.value)}
                                    placeholder="VD: KM02, KM_VIP..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-gray-900 uppercase"
                                />
                                <p className="text-xs text-gray-400 ml-2 font-medium">Kế toán tự đặt tên phù hợp với chương trình</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <Gift className="w-3.5 h-3.5" />
                                    Số lượng bình KM *
                                </label>
                                <input
                                    type="text"
                                    value={formatNumber(formData.free_cylinders)}
                                    onChange={(e) => handleNumericChange('free_cylinders', e.target.value)}
                                    placeholder="VD: 2.000"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-gray-900"
                                />
                                <p className="text-xs text-gray-400 ml-2 font-medium">Số bình khấu trừ cho khách khi áp dụng mã này</p>
                            </div>
                        </div>

                        {/* Row 2: Ngày bắt đầu + kết thúc */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Ngày bắt đầu *
                                </label>
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => handleChange('start_date', e.target.value)}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-gray-900"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Ngày kết thúc *
                                </label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => handleChange('end_date', e.target.value)}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-gray-900"
                                />
                            </div>
                        </div>

                        {/* Row 3: Loại khách hàng (legacy) */}
                        <div className="space-y-2 max-w-md">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
                                Loại khách hàng *
                            </label>
                            <select
                                value={formData.customer_type}
                                onChange={(e) => handleChange('customer_type', e.target.value)}
                                className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-lg shadow-sm transition-all text-gray-900 appearance-none cursor-pointer"
                            >
                                {CUSTOMER_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* === NEW: Targeting Section === */}
                        <div className="space-y-4 border-t border-gray-100 pt-8">
                            <h3 className="text-sm font-black text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                <Users className="w-4 h-4 text-rose-500" />
                                Đối tượng áp dụng
                            </h3>

                            {/* Target Mode Selection */}
                            <div className="grid grid-cols-3 gap-3">
                                {TARGET_MODES.map(mode => {
                                    const Icon = mode.icon;
                                    const isActive = formData.target_mode === mode.id;
                                    return (
                                        <div
                                            key={mode.id}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleChange('target_mode', mode.id)}
                                            className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${isActive
                                                ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md shadow-rose-100'
                                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-rose-500' : 'text-gray-400'}`} />
                                            <span className="text-sm font-bold">{mode.label}</span>
                                            <span className="text-[10px] font-medium opacity-70 text-center">{mode.desc}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Category Selection (when CATEGORY mode) */}
                            {formData.target_mode === 'CATEGORY' && (
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Chọn loại khách hàng áp dụng:</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        {CUSTOMER_CATEGORIES.map(cat => {
                                            const isSelected = formData.target_categories.includes(cat.id);
                                            return (
                                                <div
                                                    key={cat.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => toggleCategory(cat.id)}
                                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold cursor-pointer select-none ${isSelected
                                                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-rose-500 border-rose-500' : 'border-gray-300'}`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    {cat.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {formData.target_categories.length > 0 && (
                                        <p className="text-xs text-rose-600 font-bold mt-2">
                                            Đã chọn: {formData.target_categories.map(id => CUSTOMER_CATEGORIES.find(c => c.id === id)?.label).join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Specific Customer Selection (when SPECIFIC mode) */}
                            {formData.target_mode === 'SPECIFIC' && (
                                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-3">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Chọn khách hàng chỉ định:</p>

                                    {/* Selected chips */}
                                    {selectedCustomerNames.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {customers
                                                .filter(c => formData.target_customer_ids.includes(c.id))
                                                .map(c => (
                                                    <span key={c.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">
                                                        {c.name}
                                                        <button type="button" onClick={() => toggleCustomer(c.id)} className="hover:text-rose-900">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                        </div>
                                    )}

                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            value={customerSearch}
                                            onChange={(e) => setCustomerSearch(e.target.value)}
                                            placeholder="Tìm theo tên, mã KH, SĐT..."
                                            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400 transition-all"
                                        />
                                    </div>

                                    {/* Customer list */}
                                    {loadingCustomers ? (
                                        <p className="text-sm text-gray-400 font-bold py-4 text-center">Đang tải danh sách KH...</p>
                                    ) : (
                                        <div className="max-h-[300px] overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
                                            {filteredCustomers.length === 0 ? (
                                                <p className="text-sm text-gray-400 font-medium py-6 text-center">Không tìm thấy khách hàng nào</p>
                                            ) : filteredCustomers.map(c => {
                                                const isSelected = formData.target_customer_ids.includes(c.id);
                                                return (
                                                    <div
                                                        key={c.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => toggleCustomer(c.id)}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer hover:bg-rose-50/50 ${isSelected ? 'bg-rose-50' : ''}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-rose-500 border-rose-500' : 'border-gray-300'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                                                            <p className="text-[11px] text-gray-400 font-medium">
                                                                {c.code || '—'} · {c.category || '—'} · {c.phone || '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="text-xs text-rose-600 font-bold">
                                        Đã chọn: {formData.target_customer_ids.length} khách hàng
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="bg-gray-50 border-t border-gray-100 px-6 md:px-10 py-6 flex flex-col md:flex-row justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-8 py-3.5 border border-gray-200 bg-white text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-lg transition-all shadow-blue-200 shadow-md disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'Đang lưu...' : editPromo ? 'Cập nhật Mã KM' : 'Tạo Mã KM'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreatePromotion;
