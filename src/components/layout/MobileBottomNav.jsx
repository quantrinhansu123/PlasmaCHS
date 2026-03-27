import React from 'react';
import { ArrowLeft, Home, Bell, ClipboardList } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { supabase } from '../../supabase/config';
import { usePermissions } from '../../hooks/usePermissions';

function MobileBottomNav() {
  const navigate = useNavigate();
  const { role } = usePermissions();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = React.useState(0);

  const fetchUnreadCount = async () => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
    
    if (!error) setUnreadCount(count || 0);
  };

  React.useEffect(() => {
    fetchUnreadCount();

    const channel = supabase
      .channel('mobile-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isHome = location.pathname === '/trang-chu' || location.pathname === '/';

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-12 bg-white border-t border-border z-40 px-6 flex items-center justify-between pb-safe shadow-[0_-2px_8px_rgba(15,23,42,0.06)]">
      <button
        onClick={() => navigate(-1)}
        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={() => navigate('/trang-chu')}
        className={clsx(
          '!w-10 !h-10 !p-0 !rounded-full flex items-center justify-center -translate-y-3 shadow-lg transition-transform hover:scale-105 active:scale-95',
          isHome ? 'bg-primary text-white' : 'bg-white text-muted-foreground border border-border'
        )}
      >
        <Home size={18} strokeWidth={2.2} />
      </button>

      {(role === 'Admin' || role === 'Shipper') && (
        <button
          onClick={() => navigate('/nhiem-vu-giao-hang')}
          className={clsx(
            'p-1.5 transition-colors',
            location.pathname === '/nhiem-vu-giao-hang' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ClipboardList size={22} />
        </button>
      )}

      <button 
        onClick={() => {
          // You could navigate to a dedicated notification page on mobile if exists
          console.log('Notification clicked on mobile');
        }}
        className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-primary text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default MobileBottomNav;
