import { Navigate, useLocation } from 'react-router-dom';

function ProtectedRoute({ children }) {
    const is_authenticated = localStorage.getItem('is_authenticated') === 'true';
    const user_id = localStorage.getItem('user_id');
    const location = useLocation();

    if (!is_authenticated || !user_id) {
        // Trải nghiệm người dùng: Lưu lại trang họ đang truy cập để sau khi login sẽ quay lại đúng chỗ đó
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}

export default ProtectedRoute;
