import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import {
    applyThuKhoOperationPermissions,
    getDefaultViewPermissions,
} from '../constants/departmentViewPermissions';

const PERMISSIONS_CACHE_KEY = 'user_permissions_cache';

const readAuthStorage = () => {
    const useLocal = localStorage.getItem('is_authenticated') === 'true';
    const storage = useLocal ? localStorage : sessionStorage;
    return {
        storage,
        userId: storage.getItem('user_id') || localStorage.getItem('user_id'),
        userName: storage.getItem('user_name') || localStorage.getItem('user_name'),
        role: storage.getItem('user_role') || localStorage.getItem('user_role'),
        department: storage.getItem('user_department') || localStorage.getItem('user_department') || '',
        chi_nhanh: storage.getItem('user_chi_nhanh') || localStorage.getItem('user_chi_nhanh') || '',
    };
};

const readCachedPermissions = (role, department) => {
    try {
        const raw = localStorage.getItem(PERMISSIONS_CACHE_KEY)
            || sessionStorage.getItem(PERMISSIONS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.role === role && parsed?.department === (department || '') && parsed?.permissions) {
            return parsed.permissions;
        }
    } catch {
        // ignore corrupt cache
    }
    return null;
};

export const writePermissionsCache = (role, department, permissions, storage = localStorage) => {
    try {
        const payload = JSON.stringify({
            role,
            department: department || '',
            permissions,
        });
        storage.setItem(PERMISSIONS_CACHE_KEY, payload);
        if (storage === localStorage) {
            sessionStorage.setItem(PERMISSIONS_CACHE_KEY, payload);
        }
    } catch {
        // ignore quota errors
    }
};

export const clearPermissionsCache = () => {
    localStorage.removeItem(PERMISSIONS_CACHE_KEY);
    sessionStorage.removeItem(PERMISSIONS_CACHE_KEY);
};

const buildGuestUser = (auth) => ({
    id: auth.userId || '00000000-0000-0000-0000-000000000000',
    name: auth.userName || 'Guest',
    role: auth.role,
    department: auth.department,
    chi_nhanh: auth.chi_nhanh,
    nguoi_quan_ly: auth.userName,
});

const resolveInitialPermissions = (role, department) => {
    if (!role) return {};
    const cached = readCachedPermissions(role, department);
    if (cached) return cached;
    return applyThuKhoOperationPermissions(
        getDefaultViewPermissions(department, role),
        role,
    );
};

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
    const initialAuth = useMemo(() => readAuthStorage(), []);
    const [permissions, setPermissions] = useState(() => resolveInitialPermissions(
        initialAuth.role,
        initialAuth.department,
    ));
    const [role, setRole] = useState(initialAuth.role || null);
    const [department, setDepartment] = useState(initialAuth.department || null);
    const [user, setUser] = useState(() => (
        initialAuth.role || initialAuth.userName
            ? buildGuestUser(initialAuth)
            : null
    ));
    const [loading, setLoading] = useState(() => !(initialAuth.userId || initialAuth.userName));

    const refreshPermissions = useCallback(async () => {
        const auth = readAuthStorage();
        if (!auth.userId && !auth.userName) {
            setUser(null);
            setRole(null);
            setDepartment(null);
            setPermissions({});
            setLoading(false);
            return;
        }

        try {
            const fallbackRole = auth.role;
            const fallbackDept = auth.department;

            const profilePromise = fetchAppUserProfile({
                userId: auth.userId || undefined,
                userName: !auth.userId ? auth.userName : undefined,
            });
            const permissionsPromise = fetchRolePermissions(fallbackRole, fallbackDept);

            const [{ data: userData, error: userError }, rolePermissionsRaw] = await Promise.all([
                profilePromise,
                permissionsPromise,
            ]);

            let nextRole = fallbackRole;
            let nextDept = fallbackDept;
            let nextUser = buildGuestUser(auth);

            if (!userError && userData) {
                nextUser = userData;
                nextRole = userData.role;
                nextDept = userData.department || '';
            } else if (isAdminRole(fallbackRole) && !userData) {
                console.warn(
                    'User profile could not be loaded from DB; using cached role for UI. Re-login after migrations if data looks wrong.',
                );
            }

            let rolePermissions = rolePermissionsRaw;
            if (nextRole !== fallbackRole || nextDept !== fallbackDept) {
                rolePermissions = await fetchRolePermissions(nextRole, nextDept);
            }

            const mergedPermissions = applyThuKhoOperationPermissions(rolePermissions, nextRole);

            setUser(nextUser);
            setRole(nextRole);
            setDepartment(nextDept);
            setPermissions(mergedPermissions);
            writePermissionsCache(nextRole, nextDept, mergedPermissions, auth.storage);
        } catch (err) {
            console.error('Error fetching permissions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshPermissions();
    }, [refreshPermissions]);

    const isCompanyRole = isAdminRole(role);
    const roleNormalization = normalizeRole(role);

    const value = useMemo(() => ({
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
        canView: (module) => isCompanyRole || permissions[module]?.view || false,
        canCreate: (module) => isCompanyRole || permissions[module]?.create || false,
        canEdit: (module) => isCompanyRole || permissions[module]?.edit || false,
        canDelete: (module) => isCompanyRole || permissions[module]?.delete || false,
        canViewAllReports: () => isCompanyRole || permissions.reports?.view_all || false,
        canViewOwnReports: () => isCompanyRole || permissions.reports?.view_own || false,
        canViewWarehouseReports: () => isCompanyRole || permissions.reports?.view_warehouse || false,
        canViewErrorReports: () => isCompanyRole || permissions.reports?.view_errors || false,
        canExportReports: () => isCompanyRole || permissions.reports?.export || false,
        canScheduleReports: () => isCompanyRole || permissions.reports?.schedule || false,
        canUpdateReports: () => isCompanyRole || permissions.reports?.update || false,
        refreshPermissions,
    }), [permissions, role, department, user, loading, isCompanyRole, roleNormalization, refreshPermissions]);

    return createElement(PermissionsContext.Provider, { value }, children);
}

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions must be used within PermissionsProvider');
    }
    return context;
};

export default usePermissions;
