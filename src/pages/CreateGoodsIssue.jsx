import {
    CheckCircle2,
    PackageMinus,
    Plus,
    ScanLine,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BarcodeScanner from '../components/Common/BarcodeScanner';
import { ISSUE_TYPES } from '../constants/goodsIssueConstants';
import { PRODUCT_TYPES } from '../constants/orderConstants';
import { supabase } from '../supabase/config';

const CreateGoodsIssue = () => {
    const navigate = useNavigate();
    const { state } = useLocation();
    const editIssue = state?.issue;
    const forcedType = state?.forcedType;

    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [activeScanningIndex, setActiveScanningIndex] = useState(null);

    const [formData, setFormData] = useState({
        issue_code: '',
        issue_date: new Date().toISOString().split('T')[0],
        issue_type: 'TRA_VO',
        supplier_id: '',
        warehouse_id: '',
        notes: '',
        total_items: 0,
        status: 'HOAN_THANH'
    });

    const [items, setItems] = useState([
        { id: Date.now(), item_type: 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }
    ]);

    const [warehousesList, setWarehousesList] = useState([]);

    const filteredProducts = forcedType === 'TRA_VO'
        ? PRODUCT_TYPES.filter(p => p.id.startsWith('BINH'))
        : forcedType === 'TRA_MAY'
            ? PRODUCT_TYPES.filter(p => p.id.startsWith('MAY'))
            : PRODUCT_TYPES;

    useEffect(() => {
        loadSuppliers();
        fetchWarehouses();
        if (editIssue) {
            const { id, created_at, ...editData } = editIssue;
            setFormData(editData);
            // Fetch items for edit
            const fetchItems = async () => {
                const { data } = await supabase
                    .from('goods_issue_items')
                    .select('*')
                    .eq('issue_id', editIssue.id);
                if (data && data.length > 0) {
                    setItems(data.map(item => ({ ...item, _search: '' })));
                }
            };
            fetchItems();
        } else {
            generateCode();
            if (forcedType) {
                setFormData(prev => ({ ...prev, issue_type: forcedType }));
                if (filteredProducts.length > 0) {
                    setItems([{ id: Date.now(), item_type: filteredProducts[0].id, item_id: '', item_code: '', quantity: 1, _search: '' }]);
                }
            }
        }
    }, [editIssue, forcedType]);

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
                .select('id, name')
                .order('name');
            if (!error && data) setSuppliers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const { data } = await supabase.from('warehouses').select('id, name').eq('status', 'Đang hoạt động').order('name');
            if (data) {
                setWarehousesList(data);
                if (!editIssue && data.length > 0) {
                    setFormData(prev => !prev.warehouse_id ? { ...prev, warehouse_id: data[0].id } : prev);
                } else if (editIssue) {
                    const exists = data.some(w => w.id === editIssue.warehouse_id);
                    if (!exists && data.length > 0) {
                        setFormData(prev => ({ ...prev, warehouse_id: '' }));
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), item_type: 'BINH', item_id: '', item_code: '', quantity: 1, _search: '' }]);
    };

    const removeItem = (id) => {
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
        if (activeScanningIndex !== null) {
            const itemToUpdate = items[activeScanningIndex];
            updateItem(itemToUpdate.id, 'item_code', code);
            setIsScannerOpen(false);
            setActiveScanningIndex(null);
        }
    };

    // Calculate total
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

        const validItems = items.filter(i => i.item_id || i.item_code);
        if (validItems.length === 0) {
            alert('Vui lòng điền ít nhất 1 sản phẩm cần xuất!');
            return;
        }

        setIsLoading(true);
        try {
            const issuePayload = { ...formData };
            delete issuePayload.id; // Không gửi id trong payload
            delete issuePayload.created_at;

            let issueId;

            if (editIssue) {
                // Cập nhật phiếu xuất
                const { error: issueError } = await supabase
                    .from('goods_issues')
                    .update(issuePayload)
                    .eq('id', editIssue.id);

                if (issueError) throw issueError;
                issueId = editIssue.id;

                // Xóa items cũ trước khi insert lại
                await supabase.from('goods_issue_items').delete().eq('issue_id', issueId);
            } else {
                // Tạo mới phiếu xuất
                const { data: issueData, error: issueError } = await supabase
                    .from('goods_issues')
                    .insert([issuePayload])
                    .select()
                    .single();

                if (issueError) throw issueError;
                issueId = issueData.id;
            }

            // Insert items
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

            alert(editIssue ? '🎉 Cập nhật phiếu xuất thành công!' : '🎉 Đã lập phiếu xuất trả thành công!');
            navigate('/xuat-kho');
        } catch (error) {
            console.error('Error creating goods issue:', error);
            alert('❌ Có lỗi xảy ra: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto font-sans min-h-screen noise-bg">
            <div className="blob blob-rose w-[400px] h-[400px] -top-20 -right-20 opacity-20"></div>
            <div className="blob blob-blue w-[300px] h-[300px] bottom-1/3 -left-20 opacity-15"></div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shadow-inner">
                        <PackageMinus className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
                            {editIssue ? 'Cập nhật Phiếu Xuất' : (
                                forcedType === 'TRA_VO' ? 'Tạo Phiếu Xuất Trả Vỏ' :
                                    forcedType === 'TRA_MAY' ? 'Tạo Phiếu Xuất Trả Máy' :
                                        'Tạo Phiếu Xuất'
                            )}
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Lập danh sách xuất trả tài sản về nhà cung cấp</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 relative z-10">
                {/* 1. Thông tin phiếu */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                        <span className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center font-bold">1</span>
                        <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Thông tin chung</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Mã phiếu *</label>
                            <input
                                value={formData.issue_code}
                                onChange={(e) => setFormData({ ...formData, issue_code: e.target.value })}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Ngày xuất *</label>
                            <input
                                type="date"
                                value={formData.issue_date}
                                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Loại xuất</label>
                            <select
                                value={formData.issue_type}
                                onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none cursor-pointer"
                            >
                                {ISSUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Từ Kho *</label>
                            <select
                                value={formData.warehouse_id}
                                onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none cursor-pointer"
                            >
                                {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Nhà cung cấp trả về</label>
                            <select
                                value={formData.supplier_id}
                                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-bold text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none cursor-pointer"
                            >
                                <option value="">-- Chọn NCC trả về --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Ghi chú</label>
                            <input
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Lý do xuất, phương tiện v.v"
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl font-normal text-gray-900 focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Danh sách sản phẩm */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center font-bold">2</span>
                            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-tight">Chi tiết trả / xuất</h3>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="group flex flex-col md:flex-row items-center gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 hover:border-rose-200 hover:bg-white transition-all">
                                <span className="font-bold text-gray-400 w-6 self-start md:self-center pt-2 md:pt-0">{index + 1}.</span>

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 w-full">
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 md:hidden">Loại tài sản</label>
                                        <select
                                            value={item.item_type}
                                            onChange={(e) => updateItem(item.id, 'item_type', e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                                        >
                                            {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-6 relative">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 md:hidden">Mã tài sản (Nhập Serial/RFID)</label>
                                        <div className="relative">
                                            <input
                                                value={item.item_code}
                                                onChange={(e) => updateItem(item.id, 'item_code', e.target.value)}
                                                placeholder="Quét hoặc nhập mã Serial RFID"
                                                className="w-full px-4 py-2.5 pr-12 bg-white border border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => openScanner(index)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Quét mã barcode"
                                            >
                                                <ScanLine className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 md:hidden">Số lượng</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-center"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    className="p-3 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all self-end md:self-center"
                                    title="Xóa dòng"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addItem}
                            className="w-full md:w-auto mt-4 flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed border-rose-200 text-rose-600 font-bold rounded-2xl hover:bg-rose-50 hover:border-rose-400 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            Thêm sản phẩm
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6">
                    <p className="text-gray-500 font-medium">
                        Tổng tài sản xuất: <span className="text-xl font-black text-gray-900">{formData.total_items}</span>
                    </p>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => navigate('/xuat-kho')}
                            className="flex-1 sm:flex-none px-8 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 sm:flex-none px-12 py-4 text-white font-black text-lg rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 hover:shadow-rose-600/30'}`}
                        >
                            {isLoading ? 'Đang lưu...' : (
                                <>
                                    <CheckCircle2 className="w-6 h-6" />
                                    Lưu Phiếu Xuất
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
                title="Quét mã tài sản"
            />
        </div>
    );
};

export default CreateGoodsIssue;
