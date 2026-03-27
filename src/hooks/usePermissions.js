import { useEffect, useState } from 'react';
import { supabase } from '../supabase/config';

export const usePermissions = () => {
    const [permissions, setPermissions] = useState({});
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const userRole = localStorage.getItem('user_role') || 'Admin';

                const { data, error } = await supabase
                    .from('app_roles')
                    .select('permissions, name')
                    .eq('name', userRole)
                    .single();

                if (!error && data) {
                    setPermissions(data.permissions || {});
                    setRole(data.name);
                }
            } catch (err) {
                console.error('Error fetching permissions hook:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPermissions();
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
