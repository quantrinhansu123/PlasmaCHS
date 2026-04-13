import { useEffect, useState } from 'react';
import { supabase } from '../supabase/config';

export const usePermissions = () => {
    const [permissions, setPermissions] = useState({});
    const [role, setRole] = useState(null);
    const [department, setDepartment] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissionsAndUser = async () => {
            try {
                const userName = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || 'Lê Minh Công';
                const userRoleFromStorage = localStorage.getItem('user_role') || sessionStorage.getItem('user_role') || 'Admin';
                const userDeptFromStorage = localStorage.getItem('user_department') || sessionStorage.getItem('user_department') || '';

                // 1. Fetch user info to get the actual ID and current role from app_users table
                const { data: userData, error: userError } = await supabase
                    .from('app_users')
                    .select('id, name, role, username, department, nguoi_quan_ly')
                    .or(`name.eq.${userName},username.eq.${userName}`)
                    .maybeSingle();

                if (!userError && userData) {
                    setUser(userData);
                    setRole(userData.role);
                    setDepartment(userData.department || '');
                    
                    // 2. Fetch role permissions for this specific user's current role
                    const { data: roleData } = await supabase
                        .from('app_roles')
                        .select('permissions, name')
                        .eq('name', userData.role)
                        .maybeSingle();

                    if (roleData) {
                        setPermissions(roleData.permissions || {});
                    } else if (userData.role === 'Admin') {
                        setPermissions({}); // Admin usually has all permissions handled by logic
                    }
                } else {
                    // Fallback for development if user is not in the database yet
                    const fallbackUser = {
                        id: '00000000-0000-0000-0000-000000000000',
                        name: userName,
                        role: userRoleFromStorage,
                        department: userDeptFromStorage,
                        nguoi_quan_ly: userName
                    };
                    setUser(fallbackUser);
                    setRole(userRoleFromStorage);
                    setDepartment(userDeptFromStorage);
                    setPermissions({});
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

    const canViewAllReports = () => role === 'Admin' || permissions['reports']?.view_all || false;
    const canViewOwnReports = () => role === 'Admin' || permissions['reports']?.view_own || false;
    const canViewWarehouseReports = () => role === 'Admin' || permissions['reports']?.view_warehouse || false;
    const canViewErrorReports = () => role === 'Admin' || permissions['reports']?.view_errors || false;
    const canExportReports = () => role === 'Admin' || permissions['reports']?.export || false;
    const canScheduleReports = () => role === 'Admin' || permissions['reports']?.schedule || false;
    const canUpdateReports = () => role === 'Admin' || permissions['reports']?.update || false;

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
        canUpdateReports
    };
};

export default usePermissions;
