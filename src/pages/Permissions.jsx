import {
    Edit,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    UserCircle,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import PermissionFormModal from '../components/Permissions/PermissionFormModal';
import PermissionMatrixView from '../components/Permissions/PermissionMatrixView';
import { supabase } from '../supabase/config';

const Permissions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [permissionQuery, setPermissionQuery] = useState('');
    const [roles, setRoles] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('roles'); // 'roles' or 'users'
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [isUserRole, setIsUserRole] = useState(false);
    const [defaultPermissionType, setDefaultPermissionType] = useState('role');

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_roles')
                .select('*')
                .eq('type', 'group')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRoles(data || []);
        } catch (error) {
            console.error('Error fetching roles:', error);
        } finally {
            if (activeTab === 'roles') setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Lấy danh sách Role là type 'user'
            const { data: userRoles, error: roleError } = await supabase
                .from('app_roles')
                .select('*')
                .eq('type', 'user')
                .order('created_at', { ascending: false });

            if (roleError) throw roleError;

            // 2. Lấy danh sách users để map tên
            const { data: users, error: userError } = await supabase
                .from('app_users')
                .select('name, username');

            if (userError) throw userError;

            // 3. Map thông tin user vào Role-User
            const customPermUsers = (userRoles || []).map(role => {
                const username = role.name.replace('@user:', '');
                const user = users.find(u => u.username === username);
                return {
                    id: role.id,
                    name: user ? user.name : username,
                    username: username,
                    permissions: role.permissions
                };
            });

            setUsersList(customPermUsers);
        } catch (error) {
            console.error('Error fetching users permissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa quyền của "${name}" này không?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('app_roles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            if (activeTab === 'roles') {
                fetchRoles();
            } else {
                fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            alert('❌ Có lỗi xảy ra khi xóa quyền: ' + error.message);
        }
    };

    const handleEditRole = (role, isUser) => {
        setSelectedRole(role);
        setIsUserRole(isUser);
        setIsFormModalOpen(true);
    };

    const handleCreateNewGroup = () => {
        setSelectedRole(null);
        setIsUserRole(false);
        setDefaultPermissionType('role');
        setIsFormModalOpen(true);
    };

    const handleAssignUserPermission = () => {
        setActiveTab('users');
        setSelectedRole(null);
        setIsUserRole(true);
        setDefaultPermissionType('user');
        setIsFormModalOpen(true);
    };

    const handleFormSubmitSuccess = () => {
        if (activeTab === 'roles') {
            fetchRoles();
        } else {
            fetchUsers();
        }
        setIsFormModalOpen(false);
    };

    const filteredRoles = roles.filter(role =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredUsers = usersList.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full flex-1 flex flex-col mt-1 min-h-0 px-1 md:px-1.5 font-sans">
            {/* Top Navigation Style Tabs */}
            <div className="flex items-center gap-1 mb-3 mt-1">
                <button
                    onClick={() => setActiveTab('roles')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeTab === 'roles'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Users size={14} />
                    Phân cấp Nhóm
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                        activeTab === 'users'
                            ? "bg-white text-primary shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <UserCircle size={14} />
                    Định danh Cá nhân
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm flex flex-col flex-1 min-h-0 w-full overflow-hidden">
                {/* ── TOOLBAR ── */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 border-b border-border bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="hover-lift flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100/50 transition-transform hover:rotate-3 duration-300">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Phân quyền</h1>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">Danh sách quyền theo phân hệ</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCreateNewGroup}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-black transition-all shadow-lg shadow-blue-200 border border-blue-700 active:scale-95"
                        >
                            <Plus size={18} />
                            Thêm nhóm quyền
                        </button>
                        <button
                            type="button"
                            onClick={handleAssignUserPermission}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-black transition-all border border-slate-200 active:scale-95"
                        >
                            <UserCircle size={18} />
                            Phân quyền cho nhân viên
                        </button>
                    </div>
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC]">
                    <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 md:p-5">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-800/70">
                                    Tên nhóm quyền
                                </label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Admin, Thủ kho, Kế toán..."
                                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-800/70">
                                    Mô tả nhóm quyền
                                </label>
                                <input
                                    type="text"
                                    placeholder="Mô tả ngắn cho nhóm quyền"
                                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                    disabled
                                />
                            </div>
                            <div className="md:col-span-2 xl:col-span-1">
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-800/70">
                                    Nhập tên quyền để tìm nhanh
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={permissionQuery}
                                        onChange={(e) => setPermissionQuery(e.target.value)}
                                        placeholder="Xem, Thêm, Sửa, Xóa..."
                                        className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPermissionQuery('')}
                                        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2.5 text-[12px] font-black text-white"
                                    >
                                        <Search size={14} />
                                        Tìm kiếm
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

            {/* List Section */}
            {loading ? (
                <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 overflow-hidden flex flex-col justify-center items-center py-32 space-y-6">
                    <div className="w-14 h-14 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-black animate-pulse tracking-[0.2em] text-[10px] uppercase">Đang đồng bộ ma trận quyền...</p>
                </div>
            ) : (activeTab === 'roles' && filteredRoles.length === 0) || (activeTab === 'users' && filteredUsers.length === 0) ? (
                <div className="bg-white rounded-[2.5rem] shadow-premium border border-slate-50 flex flex-col items-center justify-center py-32 px-4 text-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8">
                        <ShieldCheck className="w-12 h-12 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Dữ liệu phân quyền trống</h3>
                    <p className="text-slate-400 font-bold max-w-sm text-sm">Hiện chưa có cấu hình ma trận quyền nào trong mục này.</p>
                </div>
            ) : (
                <div className="space-y-8 pb-10">
                    {(activeTab === 'roles' ? filteredRoles : filteredUsers).map((item) => (
                        <div key={item.id} className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden group transition-all duration-300 hover:shadow-md hover:border-blue-100">
                            <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between group-hover:bg-white transition-colors duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                                        {activeTab === 'roles' ? <ShieldCheck className="w-5 h-5" /> : <UserCircle className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.name}</h3>
                                        {activeTab === 'users' && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 ml-0.5 opacity-60">ID: @{item.username}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeTab === 'users' && (
                                        <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg border border-amber-100 uppercase tracking-widest mr-2">
                                            Ghi đè
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleEditRole(item, activeTab === 'users')}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all outline-none"
                                        title="Chỉnh sửa"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRole(item.id, item.name)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all outline-none"
                                        title="Xóa"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 w-full">
                                <PermissionMatrixView
                                    permissions={item.permissions || {}}
                                    readOnly
                                    permissionQuery={permissionQuery}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
                </div>
            </div>

            {/* Modal */}
            {isFormModalOpen && (
                <PermissionFormModal
                    role={selectedRole}
                    isUserRole={isUserRole}
                    defaultPermissionType={defaultPermissionType}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={handleFormSubmitSuccess}
                />
            )}
        </div>
    );
};

export default Permissions;
