import {
    Edit,
    Plus,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    UserCircle,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import PermissionFormModal from '../components/Permissions/PermissionFormModal';
import PermissionMatrixView from '../components/Permissions/PermissionMatrixView';
import { supabase } from '../supabase/config';
import {
    buildPermissionRows,
    createEmptyViewPermissions,
    toViewOnlyPermissions,
} from '../constants/permissionConstants';
import {
    buildPermissionGroupKey,
    buildPermissionGroupLabel,
    isPermissionGroupKey,
    parsePermissionGroupKey,
} from '../utils/permissionGroupKey';

const Permissions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [permissionQuery, setPermissionQuery] = useState('');
    const [roles, setRoles] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('roles'); // 'roles' or 'users'
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [isUserRole, setIsUserRole] = useState(false);
    const [defaultPermissionType, setDefaultPermissionType] = useState('role');
    const [draftPermissions, setDraftPermissions] = useState(() => createEmptyViewPermissions());
    const [isSavingPermissions, setIsSavingPermissions] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        fetchRoles();
        fetchUsers();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const [rolesRes, usersRes] = await Promise.all([
                supabase
                    .from('app_roles')
                    .select('*')
                    .eq('type', 'group')
                    .order('created_at', { ascending: false }),
                supabase.from('app_users').select('department, role'),
            ]);

            const { data, error } = rolesRes;
            if (error) throw error;

            const legacyIds = (data || [])
                .filter((item) => !isPermissionGroupKey(item.name))
                .map((item) => item.id);
            if (legacyIds.length > 0) {
                const { error: deleteError } = await supabase
                    .from('app_roles')
                    .delete()
                    .in('id', legacyIds);
                if (deleteError) {
                    console.error('Error deleting legacy permission groups:', deleteError);
                }
            }

            const groupRows = (data || []).filter((item) => isPermissionGroupKey(item.name));
            const users = usersRes.data || [];

            const resolveFromUsers = (groupKey) => {
                const matched = users.find(
                    (u) => buildPermissionGroupKey(u.department, u.role) === groupKey,
                );
                if (!matched) return null;
                return {
                    departmentName: (matched.department || '').trim(),
                    positionName: (matched.role || '').trim(),
                };
            };

            const mappedRoles = groupRows.map((item) => {
                const resolved = resolveFromUsers(item.name);
                const parsed = parsePermissionGroupKey(item.name);
                if (resolved) {
                    const { departmentName, positionName } = resolved;
                    return {
                        ...item,
                        displayName: buildPermissionGroupLabel(departmentName, positionName),
                        departmentName,
                        positionName,
                    };
                }
                const departmentName = item.department_name || parsed?.departmentKey.replace(/-/g, ' ') || '';
                const positionName = item.position_name || parsed?.positionKey.replace(/-/g, ' ') || '';
                return {
                    ...item,
                    displayName: buildPermissionGroupLabel(departmentName, positionName),
                    departmentName,
                    positionName,
                };
            });
            setRoles(mappedRoles);
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
        setEditingRole(role);
        setIsUserRole(isUser);
        setIsFormModalOpen(true);
    };

    const handleCreateNewGroup = () => {
        setEditingRole(null);
        setIsUserRole(false);
        setDefaultPermissionType('role');
        setIsFormModalOpen(true);
    };

    const handleAssignUserPermission = () => {
        setActiveTab('users');
        setEditingRole(null);
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

    const filteredRoles = roles.filter((role) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (role.displayName || role.name).toLowerCase().includes(q) ||
            (role.positionName || '').toLowerCase().includes(q)
        );
    });

    const filteredUsers = usersList.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeRole = useMemo(
        () => filteredRoles.find((r) => r.id === selectedRoleId) || filteredRoles[0] || null,
        [filteredRoles, selectedRoleId],
    );

    const selectedUser = useMemo(
        () => filteredUsers.find((u) => u.id === selectedUserId) || filteredUsers[0] || null,
        [filteredUsers, selectedUserId],
    );

    useEffect(() => {
        if (activeTab === 'roles' && filteredRoles.length) {
            setSelectedRoleId((prev) =>
                prev && filteredRoles.some((r) => r.id === prev) ? prev : filteredRoles[0].id,
            );
        }
    }, [activeTab, filteredRoles]);

    useEffect(() => {
        if (activeTab === 'users' && filteredUsers.length) {
            setSelectedUserId((prev) =>
                prev && filteredUsers.some((u) => u.id === prev) ? prev : filteredUsers[0].id,
            );
        }
    }, [activeTab, filteredUsers]);

    const activePermissionItem = activeTab === 'roles' ? activeRole : selectedUser;

    useEffect(() => {
        if (!activePermissionItem) {
            setDraftPermissions(createEmptyViewPermissions());
            return;
        }
        setDraftPermissions(toViewOnlyPermissions(activePermissionItem.permissions || {}));
        setSaveMessage('');
    }, [activeTab, activePermissionItem?.id]);

    const handlePermissionToggle = (moduleId, actionId) => {
        setDraftPermissions((prev) => ({
            ...prev,
            [moduleId]: {
                ...prev[moduleId],
                [actionId]: !prev[moduleId]?.[actionId],
            },
        }));
        setSaveMessage('');
    };

    const handlePermissionToggleGroup = (groupId, checked) => {
        const group = buildPermissionRows().find((entry) => entry.id === groupId);
        if (!group) return;
        setDraftPermissions((prev) => {
            const next = { ...prev };
            group.items.forEach((item) => {
                next[item.moduleId] = { ...(next[item.moduleId] || {}), view: checked };
            });
            return next;
        });
        setSaveMessage('');
    };

    const handleRefreshPermissions = () => {
        if (!activePermissionItem) return;
        setDraftPermissions(toViewOnlyPermissions(activePermissionItem.permissions || {}));
        setSaveMessage('');
    };

    const handleSavePermissions = async () => {
        if (!activePermissionItem) return;
        setIsSavingPermissions(true);
        setSaveMessage('');
        const viewOnly = toViewOnlyPermissions(draftPermissions);

        try {
            if (activeTab === 'roles' && activeRole) {
                const { error } = await supabase
                    .from('app_roles')
                    .update({
                        permissions: viewOnly,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', activeRole.id);
                if (error) throw error;
                await fetchRoles();
                setSaveMessage('Đã lưu phân quyền nhóm.');
            } else if (activeTab === 'users' && selectedUser) {
                const userRoleName = `@user:${selectedUser.username}`;
                const { error: roleError } = await supabase
                    .from('app_roles')
                    .upsert(
                        {
                            name: userRoleName,
                            type: 'user',
                            permissions: viewOnly,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'name' },
                    );
                if (roleError) throw roleError;

                const { data: users } = await supabase
                    .from('app_users')
                    .select('id')
                    .eq('username', selectedUser.username)
                    .maybeSingle();
                if (users?.id) {
                    await supabase
                        .from('app_users')
                        .update({ permissions: viewOnly })
                        .eq('id', users.id);
                }
                await fetchUsers();
                setSaveMessage('Đã lưu phân quyền cá nhân.');
            }
        } catch (error) {
            console.error('Error saving permissions:', error);
            setSaveMessage('Lỗi khi lưu: ' + (error.message || 'Không xác định'));
        } finally {
            setIsSavingPermissions(false);
        }
    };

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
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">Quyền xem theo phân hệ (module)</p>
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
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-800/70">
                                    {activeTab === 'roles' ? 'Tìm vị trí / nhóm quyền' : 'Tìm nhân viên'}
                                </label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={activeTab === 'roles' ? 'Thủ kho, Shipper, NVKD...' : 'Tên hoặc @username'}
                                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-800/70">
                                    Tìm module / phân hệ
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={permissionQuery}
                                        onChange={(e) => setPermissionQuery(e.target.value)}
                                        placeholder="Khách hàng, Đơn hàng, Kho..."
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
            ) : (
                <div className="grid grid-cols-1 gap-4 pb-10 lg:grid-cols-[minmax(300px,380px)_1fr]">
                    <div className="min-w-0 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:min-w-[300px]">
                        <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {activeTab === 'roles' ? 'Danh sách nhóm (Phòng ban_vị trí)' : 'Nhân viên'}
                        </p>
                        <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
                            {(activeTab === 'roles' ? filteredRoles : filteredUsers).length === 0 ? (
                                <p className="px-2 py-6 text-center text-[12px] font-semibold text-slate-400">
                                    {activeTab === 'roles'
                                        ? 'Chưa có nhóm. Bấm «Thêm nhóm quyền».'
                                        : 'Chưa có phân quyền cá nhân.'}
                                </p>
                            ) : null}
                            {(activeTab === 'roles' ? filteredRoles : filteredUsers).map((item) => {
                                const isSelected =
                                    activeTab === 'roles'
                                        ? activeRole?.id === item.id
                                        : selectedUser?.id === item.id;
                                const label =
                                    activeTab === 'roles'
                                        ? item.displayName || item.name
                                        : item.name;
                                return (
                                    <div
                                        key={item.id}
                                        className={clsx(
                                            'flex items-center gap-1 rounded-xl border px-2 py-2 transition-all',
                                            isSelected
                                                ? 'border-blue-200 bg-blue-50'
                                                : 'border-transparent hover:bg-slate-50',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                activeTab === 'roles'
                                                    ? setSelectedRoleId(item.id)
                                                    : setSelectedUserId(item.id)
                                            }
                                            className="min-w-0 flex-1 px-1 text-left"
                                        >
                                            <p className="break-words text-[13px] font-black leading-snug tracking-tight text-slate-800">
                                                {label}
                                            </p>
                                            {activeTab === 'users' && (
                                                <p className="break-all text-[10px] font-semibold text-slate-400">
                                                    @{item.username}
                                                </p>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEditRole(item, activeTab === 'users')}
                                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                                            title="Chỉnh sửa"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleDeleteRole(
                                                    item.id,
                                                    activeTab === 'roles' ? label : item.name,
                                                )
                                            }
                                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                            title="Xóa"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
                        {activePermissionItem ? (
                            <>
                                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400">
                                            Hệ thống / Phân quyền chi tiết
                                        </p>
                                        <h2 className="mt-0.5 text-[15px] font-black text-slate-800">
                                            Quyền xem theo phân hệ
                                        </h2>
                                        <p className="mt-1 text-[11px] font-bold text-blue-600">
                                            {activeTab === 'roles'
                                                ? activeRole?.displayName
                                                : selectedUser?.name}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleRefreshPermissions}
                                            disabled={isSavingPermissions}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            Làm mới
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSavePermissions}
                                            disabled={isSavingPermissions}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {isSavingPermissions ? (
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            Lưu thay đổi
                                        </button>
                                    </div>
                                </div>
                                {saveMessage ? (
                                    <p
                                        className={clsx(
                                            'px-4 py-2 text-[12px] font-semibold',
                                            saveMessage.startsWith('Lỗi')
                                                ? 'text-rose-600 bg-rose-50'
                                                : 'text-emerald-700 bg-emerald-50',
                                        )}
                                    >
                                        {saveMessage}
                                    </p>
                                ) : null}
                                <div className="flex-1 overflow-y-auto p-4">
                                    <PermissionMatrixView
                                        permissions={draftPermissions}
                                        onToggle={handlePermissionToggle}
                                        onToggleGroup={handlePermissionToggleGroup}
                                        permissionQuery={permissionQuery}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm font-semibold text-slate-400">
                                Chọn nhóm quyền bên trái để cấu hình ma trận xem.
                            </div>
                        )}
                    </div>
                </div>
            )}
                </div>
            </div>

            {/* Modal */}
            {isFormModalOpen && (
                <PermissionFormModal
                    role={editingRole}
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
