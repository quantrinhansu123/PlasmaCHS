import { useEffect, useState } from 'react';
import { supabase } from '../supabase/config';
import { fetchAppUserProfile } from '../utils/appUserQuery';
import {
    getDataVisibilityScope,
    isAccountantRole,
    hasFullDataVisibility,
    isAdminRole,
    isLeadSaleRole,
    isSalesRole,
    isShipperRole,
    isThuKhoRole,
    isWarehouseRole,
    normalizeRole,
} from '../utils/accessControl';
import { fetchRolePermissions } from '../utils/fetchRolePermissions';
import { applyThuKhoOperationPermissions } from '../constants/departmentViewPermissions';

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

                const { data: userData, error: userError } = await fetchAppUserProfile({
                    userId: userId || undefined,
                    userName: !userId ? userName : undefined,
                });

                if (!userError && userData) {
                    setUser(userData);
                    setRole(userData.role);
                    setDepartment(userData.department || '');
                    const rolePermissions = applyThuKhoOperationPermissions(
                        await fetchRolePermissions(userData.role, userData.department || ''),
                        userData.role,
                    );
                    setPermissions(rolePermissions);
                } else {
                    const safeRole = userRoleFromStorage || null;

                    setUser({
                        id: userId || '00000000-0000-0000-0000-000000000000',
                        name: userName || 'Guest',
                        role: safeRole,
                        department: userDeptFromStorage,
                        chi_nhanh: localStorage.getItem('user_chi_nhanh') || sessionStorage.getItem('user_chi_nhanh') || '',
                        nguoi_quan_ly: userName,
                    });
                    setRole(safeRole);
                    setDepartment(userDeptFromStorage);
                    const rolePermissions = applyThuKhoOperationPermissions(
                        await fetchRolePermissions(safeRole, userDeptFromStorage),
                        safeRole,
                    );
                    setPermissions(rolePermissions);

                    if (isAdminRole(safeRole) && !userData) {
                        console.warn(
                            'User profile could not be loaded from DB; using cached role for UI. Re-login after migrations if data looks wrong.'
                        );
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

    const isCompanyRole = isAdminRole(role);

    const canView = (module) =>
        isCompanyRole || permissions[module]?.view || false;
    const canCreate = (module) =>
        isCompanyRole || permissions[module]?.create || false;
    const canEdit = (module) =>
        isCompanyRole || permissions[module]?.edit || false;
    const canDelete = (module) =>
        isCompanyRole || permissions[module]?.delete || false;

    const canViewAllReports = () => isCompanyRole || permissions.reports?.view_all || false;
    const canViewOwnReports = () => isCompanyRole || permissions.reports?.view_own || false;
    const canViewWarehouseReports = () => isCompanyRole || permissions.reports?.view_warehouse || false;
    const canViewErrorReports = () => isCompanyRole || permissions.reports?.view_errors || false;
    const canExportReports = () => isCompanyRole || permissions.reports?.export || false;
    const canScheduleReports = () => isCompanyRole || permissions.reports?.schedule || false;
    const canUpdateReports = () => isCompanyRole || permissions.reports?.update || false;

    const roleNormalization = normalizeRole(role);

    return {
        permissions,
        role,
        department,
        user,
        loading,
        isCompanyRole,
        isSalesRole: isSalesRole(role),
        isLeadSaleRole: isLeadSaleRole(role),
        isAccountantRole: isAccountantRole(role),
        isThuKhoRole: isThuKhoRole(role),
        isWarehouseRole: isWarehouseRole(role),
        isShipperRole: isShipperRole(role),
        roleScope: hasFullDataVisibility(role, department) ? 'all' : getDataVisibilityScope(role, department),
        hasFullDataVisibility: hasFullDataVisibility(role, department),
        normalizedRole: roleNormalization,
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
