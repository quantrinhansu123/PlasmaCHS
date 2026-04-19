import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { canAccessPath } from '../utils/accessControl';

function ProtectedRoute({ children }) {
    const is_authenticated = localStorage.getItem('is_authenticated') === 'true';
    const user_id = localStorage.getItem('user_id');
    const location = useLocation();
    const { role, permissions, loading } = usePermissions();

    if (!is_authenticated || !user_id) {
        // Trải nghiệm người dùng: Lưu lại trang họ đang truy cập để sau khi login sẽ quay lại đúng chỗ đó
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-sm font-medium">Đang tải quyền truy cập...</p>
                </div>
            </div>
        );
    }

    const canAccess = canAccessPath(location.pathname, role, permissions);
    if (!canAccess) {
        return <Navigate to="/trang-chu" replace />;
    }

    return children;
}

export default ProtectedRoute;
