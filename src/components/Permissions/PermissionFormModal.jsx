import { Save, ShieldCheck, UserCircle, Users, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import PermissionMatrixView from './PermissionMatrixView';
import { ACTION_TYPES, MODULE_PERMISSIONS, buildPermissionRows } from '../../constants/permissionConstants';
import { supabase } from '../../supabase/config';

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
    const [roleName, setRoleName] = useState(isEdit && !isUserRole ? role.name : '');
    const [usersList, setUsersList] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    const initialPermissions = MODULE_PERMISSIONS.reduce((acc, module) => {
        acc[module.id] = ACTION_TYPES.reduce((actions, action) => {
            actions[action.id] = false;
            return actions;
        }, {});
        return acc;
    }, {});

    const [permissions, setPermissions] = useState(isEdit ? role.permissions : initialPermissions);
    const [permissionQuery, setPermissionQuery] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('id, name, username')
                .order('name');
            if (error) throw error;
            setUsersList(data || []);

            if (isEdit && isUserRole) {
                const u = data.find(user => user.username === role.username);
                if (u) setSelectedUserId(u.id);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

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

        if (permissionType === 'role' && !roleName.trim()) {
            setErrorMsg('Vui lòng nhập Tên nhóm quyền.');
            return;
        }

        if (permissionType === 'user' && !selectedUserId) {
            setErrorMsg('Vui lòng chọn một người dùng.');
            return;
        }

        setIsLoading(true);

        try {
            if (permissionType === 'role') {
                const payload = {
                    name: roleName.trim(),
                    type: 'group',
                    permissions: permissions,
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
                        .eq('name', roleName.trim())
                        .eq('type', 'group')
                        .single();
                    if (existing) {
                        setErrorMsg(`Nhóm quyền "${roleName}" đã tồn tại.`);
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
                const { error: roleError } = await supabase
                    .from('app_roles')
                    .upsert({
                        name: userRoleName,
                        type: 'user',
                        permissions: permissions,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'name' });
                if (roleError) throw roleError;

                // Update app_users.permissions
                const { error: userError } = await supabase
                    .from('app_users')
                    .update({ permissions: permissions })
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
                                {isEdit ? `Đối tượng: ${role.name}` : 'Tạo ma trận truy cập mới'}
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
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Tên đối tượng xác thực <span className="text-red-500">*</span></label>
                                    {permissionType === 'role' ? (
                                        <input
                                            type="text"
                                            value={roleName}
                                            onChange={(e) => setRoleName(e.target.value)}
                                            placeholder="Ví dụ: Thủ kho, Kế toán..."
                                            className="w-full h-12 px-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 font-bold text-[15px] shadow-sm transition-all text-slate-900"
                                            required
                                        />
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
                                    <h4 className="text-[14px] font-black uppercase tracking-tight text-slate-800">Danh sách quyền theo phân hệ</h4>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Bật/tắt từng quyền theo module và thao tác.</p>
                                </div>
                                <div className="w-full md:max-w-sm">
                                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Tìm nhanh quyền</label>
                                    <input
                                        type="text"
                                        value={permissionQuery}
                                        onChange={(e) => setPermissionQuery(e.target.value)}
                                        placeholder="Nhập tên quyền để tìm nhanh"
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
