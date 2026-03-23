import {
    Briefcase,
    Edit,
    Phone,
    Search,
    ShieldCheck,
    Trash2,
    UserCircle,
    Users as UsersIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ColumnToggle from '../components/ColumnToggle';
import UserFormModal from '../components/Users/UserFormModal';
import { USER_STATUSES } from '../constants/userConstants';
import useColumnVisibility from '../hooks/useColumnVisibility';
import { supabase } from '../supabase/config';

const TABLE_COLUMNS = [
    { key: 'info', label: 'Thông tin nhân sự' },
    { key: 'contact', label: 'Liên lạc' },
    { key: 'role', label: 'Vai trò / Công việc' },
    { key: 'status', label: 'Trạng thái' },
];

const Users = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const { visibleColumns, toggleColumn, isColumnVisible, resetColumns, visibleCount, totalCount } = useColumnVisibility('columns_users', TABLE_COLUMNS);
    const visibleTableColumns = TABLE_COLUMNS.filter(col => isColumnVisible(col.key));
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
            setSelectedIds([]);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert('Lỗi khi tải danh sách người dùng!');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân sự "${name}" không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('app_users')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setSelectedIds(prev => prev.filter(i => i !== id));
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('❌ Có lỗi xảy ra khi xóa nhân sự: ' + error.message);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} nhân sự đã chọn không? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('app_users')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;
            
            setSelectedIds([]);
            fetchUsers();
            alert(`✅ Đã xóa ${selectedIds.length} nhân sự thành công!`);
        } catch (error) {
            console.error('Error deleting users:', error);
            alert('❌ Lỗi khi xóa: ' + error.message);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredUsers.length && filteredUsers.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredUsers.map(u => u.id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setIsFormModalOpen(true);
    };

    const handleCreateNew = () => {
        setSelectedUser(null);
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        fetchUsers();
        setIsFormModalOpen(false);
    };

    const getStatusConfig = (statusId) => {
        return USER_STATUSES.find(s => s.id === statusId) || USER_STATUSES[0];
    };

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto font-sans bg-[#F8FAFC] min-h-screen noise-bg">
            {/* Decorative Background Blobs */}
            <div className="blob blob-blue w-[500px] h-[500px] -top-20 -left-20 opacity-20"></div>
            <div className="blob blob-indigo w-[400px] h-[400px] top-1/2 -right-20 opacity-10"></div>
            <div className="blob blob-violet w-[300px] h-[300px] bottom-10 left-1/3 opacity-10"></div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div className="hover-lift">
                    <h1 className="text-4xl font-black text-slate-800 flex items-center gap-4 tracking-tight">
                        <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 transition-transform hover:rotate-3 duration-300">
                            <UsersIcon className="w-8 h-8" />
                        </div>
                        Nhân sự hệ thống
                    </h1>
                    <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Quản lý tài khoản, phân quyền và theo dõi truy cập</p>
                </div>


            </div>

            {/* Content Bar */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-slate-50 mb-8 glass relative z-20">
                <div className="flex items-center gap-4">
                    <div className="relative group w-full flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm nhân viên, username, SĐT hoặc bộ phận..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-transparent focus:bg-white focus:border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-600 shadow-inner"
                        />
                    </div>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200 font-black text-sm hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all shadow-sm"
                        >
                            <Trash2 className="w-5 h-5" />
                            Xóa ({selectedIds.length})
                        </button>
                    )}
                    <ColumnToggle columns={TABLE_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} onReset={resetColumns} visibleCount={visibleCount} totalCount={totalCount} />
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden glass">
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-28 space-y-6">
                        <div className="w-14 h-14 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-black animate-pulse tracking-[0.2em] text-[10px] uppercase">Đang rà soát danh sách nhân sự...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8">
                            <UserCircle className="w-12 h-12 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">Không tìm thấy nhân sự</h3>
                        <p className="text-slate-400 font-bold max-w-sm text-sm">Hiện chưa có tài khoản nào khớp với bộ lọc của bạn.</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-slate-50">
                            {/* Mobile Select All */}
                            <div className="p-4 flex items-center gap-3 bg-slate-50/50 border-b border-slate-100">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                                    onChange={toggleSelectAll}
                                />
                                <span className="text-sm font-bold text-slate-600">Chọn tất cả</span>
                            </div>
                            {filteredUsers.map((user, index) => {
                                const statusConfig = getStatusConfig(user.status);
                                return (
                                    <div key={user.id} className={`p-4 hover:bg-indigo-50/30 active:bg-indigo-50/50 transition-colors ${selectedIds.includes(user.id) ? 'bg-indigo-50/40' : ''}`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-start gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 mt-1 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    checked={selectedIds.includes(user.id)}
                                                    onChange={(e) => { e.stopPropagation(); toggleSelect(user.id); }}
                                                />
                                                <div className="flex items-center gap-3">
                                                    <div className="avatar-initials flex-shrink-0 w-10 h-10 text-xs">{getInitials(user.name)}</div>
                                                    <div>
                                                        <div className="font-black text-black text-sm uppercase tracking-tight">{user.name}</div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">@{user.username}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${statusConfig.colorClass}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.id === 'active' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                                                {user.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Liên lạc</span>
                                                <div className="flex items-center gap-1.5 mt-0.5"><Phone className="w-3 h-3 text-indigo-400" /><span className="text-xs font-bold text-slate-900">{user.phone}</span></div>
                                            </div>
                                            <div><span className="text-[9px] font-bold text-slate-400 uppercase">Vai trò</span>
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-indigo-600 font-black uppercase">
                                                    {user.role === 'Admin' ? <ShieldCheck className="w-3 h-3" /> : <Briefcase className="w-3 h-3 opacity-50" />}
                                                    {user.role}
                                                </div>
                                            </div>
                                        </div>
                                        {user.permissions && Object.keys(user.permissions).length > 0 && (
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-lg w-max mb-3">
                                                <ShieldCheck className="w-3 h-3" /> + Phân quyền tùy chỉnh
                                            </div>
                                        )}
                                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-50">
                                            <button onClick={() => handleEditUser(user)} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-all" title="Chỉnh sửa"><Edit className="w-5 h-5" /></button>
                                            <button onClick={() => handleDeleteUser(user.id, user.name)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-all" title="Xóa"><Trash2 className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Desktop Table */}
                        <div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-left min-w-[1000px]">
                                <thead className="glass-header">
                                    <tr>
                                        <th className="px-8 py-6 w-16 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center w-24">STT</th>
                                        {visibleTableColumns.map(col => (<th key={col.key} className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{col.label}</th>))}
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50/50">
                                    {filteredUsers.map((user, index) => {
                                        const statusConfig = getStatusConfig(user.status);
                                        return (
                                            <tr key={user.id} className={`hover-lift transition-all duration-300 group border-l-4 ${selectedIds.includes(user.id) ? 'border-l-indigo-600 bg-indigo-50/20' : 'border-l-transparent hover:border-l-indigo-500'}`}>
                                                <td className="px-8 py-7 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedIds.includes(user.id)}
                                                        onChange={(e) => { e.stopPropagation(); toggleSelect(user.id); }}
                                                    />
                                                </td>
                                                <td className="px-8 py-7 whitespace-nowrap text-center"><span className="font-black text-slate-300 group-hover:text-indigo-500 transition-colors text-lg">{index + 1}</span></td>
                                                {isColumnVisible('info') && <td className="px-8 py-7"><div className="flex items-center gap-4"><div className="avatar-initials group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">{getInitials(user.name)}</div><div><div className="font-black text-black text-base group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.name}</div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">@{user.username}</div></div></div></td>}
                                                {isColumnVisible('contact') && <td className="px-8 py-7 whitespace-nowrap"><div className="flex items-center gap-2.5 font-bold text-slate-900 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group-hover:bg-white group-hover:shadow-sm transition-all duration-300 w-max"><Phone className="w-4 h-4 text-indigo-400" />{user.phone}</div></td>}
                                                {isColumnVisible('role') && <td className="px-8 py-7 whitespace-nowrap"><div className="flex flex-col gap-2"><div className="flex items-center gap-2 text-indigo-600 font-black bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl w-max group-hover:bg-white transition-all text-[11px] uppercase tracking-widest">{user.role === 'Admin' ? <ShieldCheck className="w-4 h-4" /> : <Briefcase className="w-4 h-4 opacity-50" />}{user.role}</div>{user.permissions && Object.keys(user.permissions).length > 0 && (<div className="flex items-center gap-1.5 text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-lg w-max uppercase tracking-widest"><ShieldCheck className="w-3 h-3" />+ Phân quyền tùy chỉnh</div>)}</div></td>}
                                                {isColumnVisible('status') && <td className="px-8 py-7 whitespace-nowrap text-sm"><span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm flex items-center gap-2 w-max group-hover:bg-white ${statusConfig.colorClass} ${statusConfig.id === 'active' ? 'glow-emerald' : 'glow-amber'}`}><div className={`w-1.5 h-1.5 rounded-full ${statusConfig.id === 'active' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />{user.status}</span></td>}
                                                <td className="px-8 py-7 text-center"><div className="flex items-center justify-center gap-5">
                                                    <button onClick={() => handleEditUser(user)} className="text-slate-400 hover:text-slate-900 transition-all outline-none" title="Chỉnh sửa"><Edit className="w-5 h-5" /></button>
                                                    <button onClick={() => handleDeleteUser(user.id, user.name)} className="text-slate-400 hover:text-slate-900 transition-all outline-none" title="Xóa"><Trash2 className="w-5 h-5" /></button>
                                                </div></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Stats Footer */}
            {!loading && filteredUsers.length > 0 && (
                <div className="p-8 bg-white glass flex items-center justify-between border-t border-slate-50 mt-8 rounded-[2rem] border hover-lift">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Tổng quy mô nhân sự: <span className="text-indigo-600 mx-2 text-lg">{filteredUsers.length}</span> tài khoản định danh
                    </p>
                </div>
            )}

            {/* Modal */}
            {isFormModalOpen && (
                <UserFormModal
                    user={selectedUser}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};


export default Users;
