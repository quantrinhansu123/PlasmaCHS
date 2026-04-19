import { useEffect, useState } from 'react';
import { supabase } from '../supabase/config';

const normalizeRoleKey = (value) => {
    if (!value) return '';
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
};

const getCanonicalRoleNames = (roleName) => {
    const normalized = normalizeRoleKey(roleName);
    const names = new Set([roleName]);

    if (normalized.includes('admin') || normalized.includes('quantri')) names.add('Admin');
    if (normalized.includes('thukho') || normalized.includes('thukho')) names.add('ThuKho');
    if (normalized.includes('shipper') || normalized.includes('giaohang')) names.add('Shipper');
    if (normalized.includes('nvkd') || normalized.includes('nhanvienkinhdoanh') || normalized.includes('kinhdoanh') || normalized.includes('sale')) names.add('NVKD');
    if (normalized.includes('leadsale') || normalized.includes('truongkinhdoanh')) names.add('LeadSale');
    if (normalized.includes('cskh') || normalized.includes('chamsockhachhang')) names.add('CSKH');
    if (normalized.includes('quanly') || normalized.includes('quantri')) names.add('QuanLy');

    return [...names].filter(Boolean);
};

const fetchRolePermissions = async (roleName) => {
    const candidates = getCanonicalRoleNames(roleName);
    const { data } = await supabase
        .from('app_roles')
        .select('permissions, name')
        .in('name', candidates)
        .maybeSingle();

    if (data) return data.permissions || {};

    const { data: allRoles } = await supabase.from('app_roles').select('permissions, name');
    const normalizedRole = normalizeRoleKey(roleName);
    const fallback = (allRoles || []).find((item) => normalizeRoleKey(item.name) === normalizedRole);
    return fallback?.permissions || {};
};

export const usePermissions = () => {
    const [permissions, setPermissions] = useState({});
    const [role, setRole] = useState(null);
    const [department, setDepartment] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissionsAndUser = async () => {
            try {
                const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
                const userName = localStorage.getItem('user_name') || sessionStorage.getItem('user_name');
                const userRoleFromStorage = localStorage.getItem('user_role') || sessionStorage.getItem('user_role');
                const userDeptFromStorage = localStorage.getItem('user_department') || sessionStorage.getItem('user_department') || '';

                if (!userId && !userName) {
                    setLoading(false);
                    return;
                }

                let query = supabase.from('app_users').select('id, name, role, username, department, nguoi_quan_ly');

                if (userId) {
                    query = query.eq('id', userId);
                } else if (userName) {
                    query = query.or(`name.eq."${userName}",username.eq."${userName}"`);
                }

                const { data: userData, error: userError } = await query.maybeSingle();

                if (!userError && userData) {
                    setUser(userData);
                    setRole(userData.role);
                    setDepartment(userData.department || '');
                    setPermissions(await fetchRolePermissions(userData.role));
                } else {
                    const safeRole = userRoleFromStorage && userRoleFromStorage !== 'Admin' ? userRoleFromStorage : null;

                    setUser({
                        id: userId || '00000000-0000-0000-0000-000000000000',
                        name: userName || 'Guest',
                        role: safeRole,
                        department: userDeptFromStorage,
                        nguoi_quan_ly: userName,
                    });
                    setRole(safeRole);
                    setDepartment(userDeptFromStorage);
                    setPermissions({});

                    if (userRoleFromStorage === 'Admin' && !userData) {
                        console.warn('Security Warning: User claimed Admin role from storage but was not found in database.');
                    }
                }
            } catch (err) {
                console.error('Error fetching permissions hook:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissionsAndUser();
    }, []);

    const canView = (module) => role === 'Admin' || permissions[module]?.view || false;
    const canCreate = (module) => role === 'Admin' || permissions[module]?.create || false;
    const canEdit = (module) => role === 'Admin' || permissions[module]?.edit || false;
    const canDelete = (module) => role === 'Admin' || permissions[module]?.delete || false;

    const canViewAllReports = () => role === 'Admin' || permissions.reports?.view_all || false;
    const canViewOwnReports = () => role === 'Admin' || permissions.reports?.view_own || false;
    const canViewWarehouseReports = () => role === 'Admin' || permissions.reports?.view_warehouse || false;
    const canViewErrorReports = () => role === 'Admin' || permissions.reports?.view_errors || false;
    const canExportReports = () => role === 'Admin' || permissions.reports?.export || false;
    const canScheduleReports = () => role === 'Admin' || permissions.reports?.schedule || false;
    const canUpdateReports = () => role === 'Admin' || permissions.reports?.update || false;

    return {
        permissions,
        role,
        department,
        user,
        loading,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canViewAllReports,
        canViewOwnReports,
        canViewWarehouseReports,
        canViewErrorReports,
        canExportReports,
        canScheduleReports,
        canUpdateReports,
    };
};

export default usePermissions;
