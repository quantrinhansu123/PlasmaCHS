import { ChevronDown, Save, ShieldCheck, UserCircle, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import PermissionMatrixView from './PermissionMatrixView';
import {
    buildPermissionRows,
    createEmptyViewPermissions,
    toViewOnlyPermissions,
} from '../../constants/permissionConstants';
import { supabase } from '../../supabase/config';
import { USER_ROLES } from '../../constants/userConstants';

const normalizeDept = (value = '') =>
    String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
import {
    buildPermissionGroupKey,
    buildPermissionGroupLabel,
} from '../../utils/permissionGroupKey';

const sortVi = (a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' });

export default function PermissionFormModal({ role, isUserRole, defaultPermissionType = 'role', onClose, onSuccess }) {
    const isEdit = !!role;
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    }, [onClose]);

    const [permissionType, setPermissionType] = useState(
        isEdit ? (isUserRole ? 'user' : 'role') : defaultPermissionType,
    );
    const [departmentName, setDepartmentName] = useState(isEdit && !isUserRole ? (role.departmentName || '') : '');
    const [positionName, setPositionName] = useState(
        isEdit && !isUserRole ? (role.positionName || role.name || '') : '',
    );
    const [usersList, setUsersList] = useState([]);
    const [usersWithProfile, setUsersWithProfile] = useState([]);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    const [permissions, setPermissions] = useState(
        isEdit ? toViewOnlyPermissions(role.permissions) : createEmptyViewPermissions(),
    );
    const [permissionQuery, setPermissionQuery] = useState('');

    const departmentSelectOptions = useMemo(() => {
        const set = new Set(departmentOptions);
        if (departmentName.trim()) set.add(departmentName.trim());
        return [...set].sort(sortVi);
    }, [departmentOptions, departmentName]);

    const positionSelectOptions = useMemo(() => {
        const dep = departmentName.trim();
        if (!dep) return [];

        const depKey = normalizeDept(dep);
        const set = new Set();
        (usersWithProfile || []).forEach((u) => {
            const userDep = (u.department || '').trim();
            const userRole = (u.role || '').trim();
            if (!userRole || normalizeDept(userDep) !== depKey) return;
            set.add(userRole);
        });

        if (positionName.trim() && !set.has(positionName.trim())) {
            set.add(positionName.trim());
        }

        return [...set].sort(sortVi);
    }, [usersWithProfile, departmentName, positionName]);

    const handleDepartmentChange = (value) => {
        setDepartmentName(value);
        setPositionName('');
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('id, name, username, department, role')
                .order('name');
            if (error) throw error;
            setUsersList(data || []);
            setUsersWithProfile(data || []);

            const dep = new Set();
            (data || []).forEach((u) => {
                if (u.department?.trim()) dep.add(u.department.trim());
            });
            setDepartmentOptions([...dep].sort(sortVi));

            if (isEdit && isUserRole) {
                const u = data.find(user => user.username === role.username);
                if (u) setSelectedUserId(u.id);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const getRoleLabel = (roleId) => USER_ROLES.find((r) => r.id === roleId)?.label || roleId;

    const handleCheckboxChange = (moduleId, actionId) => {
        setPermissions(prev => ({
            ...prev,
            [moduleId]: {
                ...prev[moduleId],
                [actionId]: !prev[moduleId][actionId]
            }
        }));
    };

    const handleToggleGroup = (groupId, checked) => {
        const group = buildPermissionRows().find((entry) => entry.id === groupId);
        if (!group) return;
        setPermissions((prev) => {
            const next = { ...prev };
            group.items.forEach((item) => {
                next[item.moduleId] = {
                    ...(next[item.moduleId] || {}),
                    [item.actionId]: checked,
                };
            });
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (permissionType === 'role' && (!departmentName.trim() || !positionName.trim())) {
            setErrorMsg('Vui lòng nhập đầy đủ Bộ phận và Vị trí.');
            return;
        }

        if (permissionType === 'user' && !selectedUserId) {
            setErrorMsg('Vui lòng chọn một người dùng.');
            return;
        }

        setIsLoading(true);

        try {
            if (permissionType === 'role') {
                const groupKey = buildPermissionGroupKey(departmentName, positionName);
                const roleLabel = buildPermissionGroupLabel(departmentName, positionName);
                const viewOnlyPermissions = toViewOnlyPermissions(permissions);
                const payload = {
                    name: groupKey,
                    type: 'group',
                    permissions: viewOnlyPermissions,
                    updated_at: new Date().toISOString()
                };

                if (isEdit && !isUserRole) {
                    const { error } = await supabase
                        .from('app_roles')
                        .update(payload)
                        .eq('id', role.id);
                    if (error) throw error;
                } else {
                    // Check duplicate for new role
                    const { data: existing } = await supabase
                        .from('app_roles')
                        .select('id')
                        .eq('name', groupKey)
                        .eq('type', 'group')
                        .single();
                    if (existing) {
                        setErrorMsg(`Nhóm quyền "${roleLabel}" đã tồn tại.`);
                        setIsLoading(false);
                        return;
                    }
                    const { error } = await supabase
                        .from('app_roles')
                        .insert([payload]);
                    if (error) throw error;
                }
            } else {
                const user = usersList.find(u => u.id === selectedUserId);
                if (!user) throw new Error('Không tìm thấy người dùng.');

                const userRoleName = `@user:${user.username}`;

                // Upsert to app_roles
                const viewOnlyPermissions = toViewOnlyPermissions(permissions);
                const { error: roleError } = await supabase
                    .from('app_roles')
                    .upsert({
                        name: userRoleName,
                        type: 'user',
                        permissions: viewOnlyPermissions,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'name' });
                if (roleError) throw roleError;

                // Update app_users.permissions
                const { error: userError } = await supabase
                    .from('app_users')
                    .update({ permissions: viewOnlyPermissions })
                    .eq('id', selectedUserId);
                if (userError) throw userError;
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving permissions:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi lưu phân quyền.');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className={clsx(
            "fixed inset-0 z-[100005] flex justify-end transition-all duration-300 font-sans",
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
                    "relative bg-slate-50 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-full border-l border-slate-200 animate-in slide-in-from-right duration-500",
                    isClosing && "animate-out slide-out-to-right duration-300"
                )}
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-600">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[20px] leading-tight font-black text-slate-900 tracking-tight uppercase">
                                {isEdit ? 'Cấu hình Quyền' : 'Thiết lập Quyền mới'}
                            </h3>
                            <p className="text-slate-500 text-[12px] font-bold mt-0.5 uppercase tracking-widest opacity-60">
                                {isEdit ? `Đối tượng: ${role.displayName || role.name}` : 'Tạo ma trận truy cập mới'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50 custom-scrollbar flex-1 min-h-0 pb-24 sm:pb-8">
                    {errorMsg && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-[13px] font-bold text-rose-600 flex items-center gap-2">
                            <X className="w-5 h-5 shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <form id="permissionForm" onSubmit={handleSubmit} className="space-y-8">
                        {/* Selector Area */}
                        <div className="rounded-3xl border border-blue-600/10 bg-white p-6 md:p-8 space-y-6 shadow-sm">
                            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setPermissionType('role')}
                                        disabled={isEdit}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${permissionType === 'role' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Users className="w-4 h-4" />
                                        Nhóm quyền
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPermissionType('user')}
                                        disabled={isEdit}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${permissionType === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <UserCircle className="w-4 h-4" />
                                        Cá nhân
                                    </button>
                                </div>

                                <div className="flex-1 w-full">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Đối tượng xác thực <span className="text-red-500">*</span></label>
                                    {permissionType === 'role' ? (
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Bộ phận
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={departmentName}
                                                        onChange={(e) => handleDepartmentChange(e.target.value)}
                                                        className="w-full h-12 appearance-none cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-10 text-[15px] font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                        required
                                                    >
                                                        <option value="">Chọn bộ phận...</option>
                                                        {departmentSelectOptions.map((dep) => (
                                                            <option key={dep} value={dep}>
                                                                {dep}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Vị trí
                                                </label>
                                                <div className="relative">
                                                    <select
                                                        value={positionName}
                                                        onChange={(e) => setPositionName(e.target.value)}
                                                        disabled={!departmentName.trim()}
                                                        className="w-full h-12 appearance-none cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-10 text-[15px] font-bold text-slate-900 shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                        required
                                                    >
                                                        <option value="">
                                                            {!departmentName.trim()
                                                                ? 'Chọn bộ phận trước'
                                                                : positionSelectOptions.length === 0
                                                                  ? 'Chưa có vị trí trong phòng ban này'
                                                                  : 'Chọn vị trí...'}
                                                        </option>
                                                        {positionSelectOptions.map((pos) => (
                                                            <option key={pos} value={pos}>
                                                                {getRoleLabel(pos)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                </div>
                                                {departmentName.trim() && positionSelectOptions.length > 0 ? (
                                                    <p className="mt-1.5 text-[10px] font-semibold text-slate-400">
                                                        Chỉ hiển thị vị trí đang có trong phòng ban «{departmentName}».
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] font-semibold text-blue-700 space-y-0.5">
                                                <p>
                                                    Tên nhóm:{' '}
                                                    {buildPermissionGroupLabel(departmentName, positionName) || '(chưa đủ thông tin)'}
                                                </p>
                                                <p className="text-[10px] font-medium text-blue-600/80">
                                                    Key: {buildPermissionGroupKey(departmentName, positionName) || '—'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <select
                                                value={selectedUserId}
                                                onChange={(e) => setSelectedUserId(e.target.value)}
                                                disabled={isEdit}
                                                className={`w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-[15px] shadow-sm transition-all text-slate-900 appearance-none ${isEdit ? 'bg-slate-50 opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                                                required
                                            >
                                                <option value="">Chọn nhân sự trong danh sách...</option>
                                                {usersList.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <X className="w-4 h-4 text-slate-400 rotate-45" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-blue-600/10 bg-white p-4 md:p-6 shadow-sm space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <h4 className="text-[14px] font-black uppercase tracking-tight text-slate-800">Quyền xem theo phân hệ</h4>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Chỉ cấu hình quyền truy cập/xem module. Thêm, sửa, xóa theo rule riêng từng màn hình.</p>
                                </div>
                                <div className="w-full md:max-w-sm">
                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tìm nhanh quyền</label>
                                    <input
                                        type="text"
                                        value={permissionQuery}
                                        onChange={(e) => setPermissionQuery(e.target.value)}
                                        placeholder="Tên module, đường dẫn..."
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                                    />
                                </div>
                            </div>
                            <PermissionMatrixView
                                permissions={permissions}
                                permissionQuery={permissionQuery}
                                onToggle={handleCheckboxChange}
                                onToggleGroup={handleToggleGroup}
                            />
                        </div>
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-6 bg-white border-t border-slate-200 shrink-0 flex items-center justify-end gap-3 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)] sticky bottom-0 z-20">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 bg-white text-slate-500 hover:text-blue-600 font-bold text-[15px] transition-colors outline-none"
                        disabled={isLoading}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        form="permissionForm"
                        disabled={isLoading}
                        className="w-full sm:flex-1 md:max-w-[240px] px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-black rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 border border-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        {isLoading ? 'Đang lưu...' : isEdit ? 'Cập nhật phân quyền' : 'Xác nhận Lưu quyền'}
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
}
