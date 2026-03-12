import {
    UserPlus
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CUSTOMER_CATEGORIES
} from '../constants/orderConstants';
import { supabase } from '../supabase/config';

const CreateCustomer = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const initialFormState = {
        code: '',
        name: '',
        category: 'BV',
        phone: '',
        address: '',
        legal_rep: '',
        contact_info: '',
        warehouse_id: '',
        business_group: '',
        care_by: '',
        agency_name: '',
        managed_by: '',
        tax_code: '',
        invoice_company_name: '',
        invoice_address: ''
    };

    const [formData, setFormData] = useState(initialFormState);
    const [staffList, setStaffList] = useState([]);
    const [agencySuggestions, setAgencySuggestions] = useState([]);
    const [warehousesList, setWarehousesList] = useState([]);

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
        const loadWarehouses = async () => {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
                if (data.length > 0) {
                    setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: data[0].id } : prev);
                }
            }
        };
        loadStaff();
        loadAgencies();
        loadWarehouses();
    }, []);

    // Auto generate Customer Code on mount
    useEffect(() => {
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
    }, []);

    const resetForm = () => {
        // Keep the next generated code if reset so they can make multiple
        const nextNum = parseInt(formData.code.replace(/[^0-9]/g, ''), 10) + 1;
        setFormData({
            ...initialFormState,
            code: `KH${nextNum.toString().padStart(5, '0')}`
        });
    };

    const handleCreateCustomer = async () => {
        if (!formData.name || !formData.legal_rep || !formData.phone || !formData.address) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc (*)');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = { ...formData, updated_at: new Date().toISOString() };
            const { error } = await supabase.from('customers').insert([payload]);

            if (error) throw error;

            alert('🎉 Tạo hồ sơ khách hàng thành công!');
            // You could navigate back to customers list here if desired:
            // navigate('/khach-hang');
            resetForm();

        } catch (error) {
            console.error('Error creating customer:', error);
            if (error.code === '23505') {
                alert(`❌ Lỗi: Mã Khách Hàng "${formData.code}" đã tồn tại trên hệ thống.`);
            } else {
                alert('❌ Có lỗi xảy ra: ' + error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1200px] mx-auto font-sans min-h-screen noise-bg">
            {/* Animated Blobs */}
            <div className="blob blob-rose w-[450px] h-[450px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-pink w-[350px] h-[350px] bottom-1/4 -left-20 opacity-15"></div>

            {/* Main Content Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem] shadow-2xl shadow-rose-900/10 border border-white overflow-hidden relative z-10">
                <div className="p-6 md:p-8 border-b border-rose-50 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
                    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white shadow-inner">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        Thêm mới khách hàng đối tác
                    </h3>
                    <p className="text-rose-100 text-xs md:text-sm mt-1 md:ml-10">Tạo hồ sơ khách hàng mới tham gia vào hệ thống. Điền đầy đủ các thông tin (*)</p>
                </div>

                <div className="p-6 md:p-10 space-y-8 md:space-y-10">
                    {/* Section 1: Thông tin định danh */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">1. Mã KH (Hệ thống cấp)</label>
                            <input
                                value={formData.code}
                                disabled
                                className="w-full px-5 py-4 bg-gray-100 border border-gray-200 rounded-2xl font-black text-pink-600 text-base cursor-not-allowed shadow-inner"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">2. Khách hàng *</label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900 cursor-pointer"
                            >
                                {CUSTOMER_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">3. Tên đơn vị khách hàng *</label>
                            <input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ví dụ: Hồng Ngọc, Bạch Mai..."
                                className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900"
                            />
                        </div>
                    </div>

                    {/* Section 2: Liên hệ chi tiết */}
                    <div className="p-6 md:p-8 bg-pink-50/40 rounded-[1.5rem] md:rounded-[2.5rem] border border-pink-100 space-y-6 md:space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">4. Tên người đại diện *</label>
                                <input
                                    value={formData.legal_rep}
                                    onChange={(e) => setFormData({ ...formData, legal_rep: e.target.value })}
                                    placeholder="Họ tên người liên hệ chính..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">5. Thông tin người liên hệ</label>
                                <input
                                    value={formData.contact_info}
                                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                                    placeholder="Tên, chức vụ người liên hệ phụ..."
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">6. Số điện thoại liên lạc *</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="09xx.xxx.xxx"
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">7. Địa chỉ chi tiết (Nhận hàng) *</label>
                            <input
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                                className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base shadow-sm transition-all text-gray-900"
                            />
                        </div>
                    </div>

                    {/* Section 3: Phân bổ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">8. Kho xuất hàng mặc định *</label>
                            <select
                                value={formData.warehouse_id}
                                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm cursor-pointer"
                            >
                                {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">9. Nhóm Kinh Doanh</label>
                            <input
                                value={formData.business_group}
                                onChange={(e) => setFormData({ ...formData, business_group: e.target.value })}
                                placeholder="Ví dụ: Nhóm KD Miền Bắc..."
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">10. NVKD Chăm sóc</label>
                            <select
                                value={formData.care_by || ''}
                                onChange={(e) => setFormData({ ...formData, care_by: e.target.value })}
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900 cursor-pointer"
                            >
                                <option value="">-- Chọn NVKD --</option>
                                {staffList.map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ''}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-10 mt-6">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">11. Đại lý (nơi quản lý KH)</label>
                                <input
                                    value={formData.agency_name || ''}
                                    onChange={(e) => setFormData({ ...formData, agency_name: e.target.value })}
                                    placeholder="Gõ tên đại lý..."
                                    list="agency-suggestions"
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900"
                                />
                                <datalist id="agency-suggestions">
                                    {agencySuggestions.map((a, i) => <option key={i} value={a} />)}
                                </datalist>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">12. Đại lý phụ trách (NVKD)</label>
                                <select
                                    value={formData.managed_by || ''}
                                    onChange={(e) => setFormData({ ...formData, managed_by: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900 cursor-pointer"
                                >
                                    <option value="">-- Chọn NVKD phụ trách --</option>
                                    {staffList.map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ''}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Thông tin xuất hoá đơn */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">13. Mã số thuế</label>
                            <input
                                value={formData.tax_code}
                                onChange={(e) => setFormData({ ...formData, tax_code: e.target.value })}
                                placeholder="VD: 0101234567"
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">14. Tên công ty (trên hoá đơn)</label>
                            <input
                                value={formData.invoice_company_name}
                                onChange={(e) => setFormData({ ...formData, invoice_company_name: e.target.value })}
                                placeholder="Tên công ty ghi trên hoá đơn..."
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">15. Địa chỉ xuất hoá đơn</label>
                            <input
                                value={formData.invoice_address}
                                onChange={(e) => setFormData({ ...formData, invoice_address: e.target.value })}
                                placeholder="Địa chỉ ghi trên hoá đơn GTGT..."
                                className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-pink-100 focus:border-pink-500 font-bold text-base transition-all shadow-sm text-gray-900"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col items-center justify-between gap-6 md:flex-row">
                    <p className="text-sm text-gray-400 font-medium italic w-full text-center md:text-left">* Vui lòng kiểm tra kỹ thông tin liên hệ của đối tác.</p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <button
                            onClick={resetForm}
                            className="w-full sm:w-auto px-6 md:px-10 py-4 md:py-5 bg-white border border-gray-200 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-all shadow-sm"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleCreateCustomer}
                            disabled={isSubmitting}
                            className={`w-full sm:w-auto px-10 md:px-16 py-4 md:py-5 text-white font-black text-lg rounded-2xl shadow-2xl transition-all ${isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-pink-600 to-rose-600 shadow-pink-200 hover:scale-[1.02] active:scale-95'
                                }`}
                        >
                            {isSubmitting ? 'Đang lưu hồ sơ...' : 'Tạo hồ sơ khách hàng'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateCustomer;
