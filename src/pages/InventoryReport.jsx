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
import {
    BarChart2,
    ChevronLeft,
    Filter,
    List,
    Package,
    Search,
    Warehouse,
    X,
    Download
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bar as BarChartJS, Pie as PieChartJS } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase/config';

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

const InventoryReport = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('list');
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouses, setSelectedWarehouses] = useState([]);
    const [selectedTypes, setSelectedTypes] = useState([]);

    useEffect(() => {
        fetchInventory();
        fetchWarehouses();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select('*')
                .order('warehouse_id');
            if (error) throw error;
            setInventory(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchWarehouses = async () => {
        const { data } = await supabase.from('warehouses').select('id, name');
        if (data) setWarehouses(data);
    };

    const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || id;

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesWarehouse = selectedWarehouses.length === 0 || selectedWarehouses.includes(item.warehouse_id);
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(item.item_type);
        return matchesSearch && matchesWarehouse && matchesType;
    });

    const exportToExcel = () => {
        const data = filteredInventory.map(item => ({
            'Kho': getWarehouseName(item.warehouse_id),
            'Loại': item.item_type,
            'Tên hàng': item.item_name,
            'Số lượng': item.quantity,
            'Cập nhật cuối': new Date(item.updated_at).toLocaleString('vi-VN')
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TonKho');
        XLSX.writeFile(wb, `Bao_cao_ton_kho_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getTypeStats = () => {
        const stats = {};
        filteredInventory.forEach(item => {
            stats[item.item_type] = (stats[item.item_type] || 0) + item.quantity;
        });
        return {
            labels: Object.keys(stats),
            datasets: [{
                data: Object.values(stats),
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
            }]
        };
    };

    const getWarehouseStats = () => {
        const stats = {};
        filteredInventory.forEach(item => {
            const name = getWarehouseName(item.warehouse_id);
            stats[name] = (stats[name] || 0) + item.quantity;
        });
        return {
            labels: Object.keys(stats),
            datasets: [{
                label: 'Số lượng hàng hóa',
                data: Object.values(stats),
                backgroundColor: '#3b82f6',
            }]
        };
    };

    return (
        <div className="w-full flex-1 flex flex-col p-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-bold">Báo cáo tồn kho</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveView('list')}
                        className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all", activeView === 'list' ? "bg-primary text-white" : "bg-white text-muted-foreground border")}
                    >
                        <List size={18} /> Danh sách
                    </button>
                    <button
                        onClick={() => setActiveView('stats')}
                        className={clsx("flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all", activeView === 'stats' ? "bg-primary text-white" : "bg-white text-muted-foreground border")}
                    >
                        <BarChart2 size={18} /> Thống kê
                    </button>
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">
                        <Download size={18} /> Xuất Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm hàng hóa..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="p-2 border rounded-lg outline-none"
                    value={selectedWarehouses[0] || ''}
                    onChange={(e) => setSelectedWarehouses(e.target.value ? [e.target.value] : [])}
                >
                    <option value="">Tất cả kho</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select 
                    className="p-2 border rounded-lg outline-none"
                    value={selectedTypes[0] || ''}
                    onChange={(e) => setSelectedTypes(e.target.value ? [e.target.value] : [])}
                >
                    <option value="">Tất cả loại</option>
                    <option value="MAY">Máy</option>
                    <option value="BINH">Bình</option>
                    <option value="VAT_TU">Vật tư</option>
                </select>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center italic text-muted-foreground">Đang tải dữ liệu...</div>
            ) : activeView === 'list' ? (
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted/50 border-b">
                                <th className="p-4 font-bold text-sm">Kho</th>
                                <th className="p-4 font-bold text-sm">Loại</th>
                                <th className="p-4 font-bold text-sm">Tên hàng hóa</th>
                                <th className="p-4 font-bold text-sm text-right">Số lượng</th>
                                <th className="p-4 font-bold text-sm">Cập nhật cuối</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.length > 0 ? filteredInventory.map(item => (
                                <tr key={item.id} className="border-b hover:bg-muted/20 transition-colors">
                                    <td className="p-4 text-sm font-medium">{getWarehouseName(item.warehouse_id)}</td>
                                    <td className="p-4">
                                        <span className={clsx(
                                            "px-2 py-1 rounded-full text-[10px] font-bold",
                                            item.item_type === 'MAY' && "bg-blue-100 text-blue-700",
                                            item.item_type === 'BINH' && "bg-emerald-100 text-emerald-700",
                                            item.item_type === 'VAT_TU' && "bg-amber-100 text-amber-700"
                                        )}>
                                            {item.item_type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm font-bold text-slate-800">{item.item_name}</td>
                                    <td className="p-4 text-sm font-black text-right text-blue-600">{item.quantity.toLocaleString()}</td>
                                    <td className="p-4 text-sm text-muted-foreground">{new Date(item.updated_at).toLocaleString('vi-VN')}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center italic text-muted-foreground">Không tìm thấy dữ liệu tồn kho</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold mb-4">Tỉ lệ loại hàng hóa</h3>
                        <div className="h-[300px] flex items-center justify-center">
                            <PieChartJS data={getTypeStats()} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold mb-4">Số lượng theo kho</h3>
                        <div className="h-[300px]">
                            <BarChartJS data={getWarehouseStats()} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryReport;
