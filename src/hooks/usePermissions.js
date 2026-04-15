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
                // Use user_id as secondary reliable source, name as fallback
                const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
                const userName = localStorage.getItem('user_name') || sessionStorage.getItem('user_name');
                const userRoleFromStorage = localStorage.getItem('user_role') || sessionStorage.getItem('user_role');
                const userDeptFromStorage = localStorage.getItem('user_department') || sessionStorage.getItem('user_department') || '';

                if (!userId && !userName) {
                    setLoading(false);
                    return;
                }

                // 1. Fetch user info to get the actual ID and current role from app_users table
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
                    // Safety check: Don't default to Admin if user not found in DB
                    // Use storage role ONLY if it's not 'Admin' or if we trust it
                    const safeRole = (userRoleFromStorage && userRoleFromStorage !== 'Admin') ? userRoleFromStorage : null;
                    
                    const fallbackUser = {
                        id: userId || '00000000-0000-0000-0000-000000000000',
                        name: userName || 'Guest',
                        role: safeRole,
                        department: userDeptFromStorage,
                        nguoi_quan_ly: userName
                    };
                    setUser(fallbackUser);
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
