import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  CheckCheck,
  Trash2,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Home,
  PanelLeft,
  PanelLeftClose,
  User,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

import { sidebarMenu, extraMenuItems } from '../../constants/sidebarMenu';
import { actionModuleGroups } from '../../constants/actionModuleData';

import { supabase } from '../../supabase/config';

function Topbar({ sidebarOpen, setSidebarOpen }) {
  const [time, setTime] = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const notificationDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const lastProcessedIdRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  const username = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || "Nhân viên";
  const userRole = localStorage.getItem('user_role') || sessionStorage.getItem('user_role') || "Chưa xác định";
  const userAvatar = localStorage.getItem('user_avatar') || sessionStorage.getItem('user_avatar') || null;
  const displayName = username.split(' ').map(n => n.charAt(0)).join('+');
  const defaultAvatar = `https://ui-avatars.com/api/?name=${displayName}&background=random&color=random`;

  // Real-time Fetching Notifications
  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    // Setup Real-time Subscription
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        // Kiểm tra để tránh hiển thị trùng lặp 2 lần cho cùng một bản ghi
        if (lastProcessedIdRef.current === payload.new.id) return;
        lastProcessedIdRef.current = payload.new.id;

        setNotifications(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;
  const displayNotifications = isExpanded ? notifications : notifications.slice(0, 5);
  const hasMore = notifications.length > 5;

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const modulePathToLabel = Object.fromEntries(actionModuleGroups.map((group) => [group.path, group.title]));
  const itemPathToLabel = Object.fromEntries(
    actionModuleGroups.flatMap((group) => group.items.map((item) => [item.href, item.title]))
  );
  const itemPathToModulePath = Object.fromEntries(
    actionModuleGroups.flatMap((group) => group.items.map((item) => [item.href, group.path]))
  );

  const getLabel = (path) => {
    if (modulePathToLabel[path]) {
      return modulePathToLabel[path];
    }

    if (itemPathToLabel[path]) {
      return itemPathToLabel[path];
    }

    const menuItems = [...sidebarMenu, ...extraMenuItems, { path: '/ho-so', label: 'Hồ sơ cá nhân' }];
    const found = menuItems.find((item) => item.path === path);
    if (found) {
      return found.label;
    }

    const segmentLabels = {
      'don-hang-kinh-doanh': 'Đơn hàng & Kinh doanh',
      'quan-ly-thiet-bi': 'Quản lý thiết bị',
      kho: 'Kho',
      'mua-hang-nha-cung-cap': 'Mua hàng & Nhà cung cấp',
      'van-chuyen': 'Vận chuyển',
      'thu-hoi': 'Thu hồi',
      'vat-tu': 'Vật tư',
      'he-thong': 'Hệ thống',
      'trang-chu': 'Trang chủ',
      tao: 'Tạo mới',
      'danh-sach': 'Danh sách',
    };

    const segment = path.split('/').pop() || '';
    return segmentLabels[segment] || segment;
  };

  const getBreadcrumbPaths = (pathname) => {
    if (!pathname || pathname === '/trang-chu') {
      return [];
    }

    if (modulePathToLabel[pathname]) {
      return [pathname];
    }

    const modulePath = itemPathToModulePath[pathname];
    if (modulePath) {
      return modulePath === pathname ? [pathname] : [modulePath, pathname];
    }

    return pathSegments.map((_, index) => `/${pathSegments.slice(0, index + 1).join('/')}`);
  };

  const breadcrumbs = getBreadcrumbPaths(location.pathname).map((path) => ({
    path,
    label: getLabel(path),
  }));

  const pageTitle = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : 'Trang chủ';

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_role');
    sessionStorage.clear();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
        setIsExpanded(false);
      }

      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString('vi-VN', { hour12: false });

  const formatDate = (date) => {
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = days[date.getDay()];
    return `${dayName}, ${date.toLocaleDateString('vi-VN')}`;
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (!error) {
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
    }
  };

  const clearAll = async () => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (!error) {
      setNotifications([]);
    }
  };

  const markAsRead = async (id) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(
        notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        )
      );
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setShowNotifications(false);
      setIsExpanded(false);
      navigate(notification.link);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'info':
        return <Info size={18} className="text-blue-500" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-500" />;
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      default:
        return <Info size={18} className="text-blue-500" />;
    }
  };

  const getTypeStyles = (type, isRead) => {
    if (isRead) {
      return '';
    }

    switch (type) {
      case 'info':
        return 'border-l-4 border-l-blue-500 bg-blue-500/10';
      case 'warning':
        return 'border-l-4 border-l-amber-500 bg-amber-500/10';
      case 'success':
        return 'border-l-4 border-l-emerald-500 bg-emerald-500/10';
      default:
        return '';
    }
  };

  return (
    <header className="h-[55px] bg-white border-b border-border flex items-center justify-between px-4 lg:px-6 z-[100000] sticky top-0">
      <div className="flex items-center gap-2 lg:gap-2.5">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-muted-foreground hover:bg-muted border border-border rounded-lg bg-card shadow-sm transition-colors shrink-0"
        >
          {sidebarOpen ? <PanelLeftClose size={12} /> : <PanelLeft size={12} />}
        </button>

        <div className="hidden sm:flex items-center gap-2 lg:gap-2.5">
          <Link to="/trang-chu" className="text-muted-foreground hover:text-primary transition-colors">
            <Home size={14} strokeWidth={2} />
          </Link>

          <span className="text-muted-foreground/40 font-light">
            <svg width="5" height="8" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 9L5 5L1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <Link to="/trang-chu" className="text-slate-700 text-[13px] font-bold hover:text-primary transition-colors">
            Trang chủ
          </Link>

          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              <span className="text-muted-foreground/40 font-light">
                <svg width="5" height="8" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 9L5 5L1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {index === breadcrumbs.length - 1 ? (
                <div className="flex items-center bg-primary text-white px-2 py-0.5 rounded-lg text-[12px] font-extrabold shadow-sm ring-1 ring-primary/20">
                  {crumb.label}
                </div>
              ) : (
                <Link to={crumb.path} className="text-slate-700 text-[13px] font-bold hover:text-primary transition-colors">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="sm:hidden font-semibold text-foreground text-sm">{pageTitle}</div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden md:flex items-center bg-card border border-border shadow-sm px-4 py-1.5 rounded-full gap-3 text-[13px]">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <span className="font-extrabold text-slate-900 tabular-nums">{formatTime(time)}</span>
          </div>
          <div className="w-[1px] h-4 bg-slate-200" />
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar size={16} className="text-primary" />
            <span className="font-bold whitespace-nowrap">{formatDate(time)}</span>
          </div>
        </div>

        <div className="relative" ref={notificationDropdownRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserDropdown(false);
            }}
            className={clsx(
              'relative p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors',
              showNotifications && 'bg-accent text-primary'
            )}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-card">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="fixed top-[55px] inset-x-0 bottom-0 z-[99999] flex flex-col bg-slate-50/95 backdrop-blur-md sm:bg-white sm:absolute sm:top-auto sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-[350px] sm:h-auto sm:rounded-xl shadow-xl sm:border border-t border-border/80 overflow-hidden animate-in fade-in slide-in-from-top-2 sm:slide-in-from-top-0 sm:zoom-in-95 duration-200 sm:origin-top-right">
              <div className="p-4 sm:p-3 border-b border-border/60 flex items-center justify-between bg-white/80 sm:bg-white backdrop-blur-md sticky top-0 z-10 sm:shadow-none shadow-sm">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-primary hidden sm:block" />
                  <h3 className="font-bold text-foreground text-[15px] sm:text-[13px]">Thông báo hệ thống</h3>
                  {unreadCount > 0 && (
                    <span className="bg-primary/10 text-primary text-[11px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-0.5">
                  <button
                    onClick={markAllAsRead}
                    className="p-2 sm:p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                    title="Đánh dấu tất cả là đã đọc"
                  >
                    <CheckCheck className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={clearAll}
                    className="p-2 sm:p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Xóa tất cả"
                  >
                    <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              <div
                className={clsx(
                  'overflow-y-auto custom-scrollbar transition-all duration-300 flex-1 sm:flex-none bg-white/50 sm:bg-transparent',
                  isExpanded ? 'sm:max-h-[400px]' : 'sm:max-h-[350px]'
                )}
              >
                {notifications.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {displayNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={clsx(
                          'p-4 sm:p-3 transition-colors cursor-pointer hover:bg-white/80 bg-white/60 sm:bg-transparent sm:hover:bg-muted/30 relative border-b border-border/40 sm:border-b-0',
                          getTypeStyles(notification.type, notification.is_read)
                        )}
                      >
                        <div className="flex gap-2.5">
                          <div
                            className={clsx(
                              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              notification.type === 'info' && 'bg-blue-50',
                              notification.type === 'warning' && 'bg-amber-50',
                              notification.type === 'success' && 'bg-emerald-50'
                            )}
                          >
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1 sm:mb-0.5">
                              <h4
                                className={clsx(
                                  'font-bold text-[14px] sm:text-[13px] leading-tight transition-colors truncate',
                                  notification.is_read ? 'text-foreground/70' : 'text-primary'
                                )}
                              >
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <span className="w-2 h-2 sm:w-1.5 sm:h-1.5 bg-primary rounded-full shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-[13px] sm:text-[12px] text-muted-foreground leading-relaxed sm:leading-snug mb-1 sm:mb-0.5 line-clamp-2 sm:line-clamp-1">
                              {notification.description}
                            </p>
                            <span className="text-[11px] sm:text-[10px] text-muted-foreground/60">{new Date(notification.created_at).toLocaleString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-muted-foreground">
                    <Bell size={32} className="mb-2 opacity-20" />
                    <p className="text-[12px]">Không có thông báo nào</p>
                  </div>
                )}
              </div>

              {hasMore && (
                <div className="mt-auto sm:mt-0 border-t border-border/80 bg-white/90 sm:bg-white backdrop-blur-md z-10 shrink-0">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full p-4 sm:p-2.5 text-center text-[14px] sm:text-[12px] font-bold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1"
                  >
                    {isExpanded ? 'Thu gọn' : 'Xem tất cả lịch sử'}
                    <ChevronRight size={16} className={clsx('transition-transform sm:w-[14px] sm:h-[14px]', isExpanded && 'rotate-90')} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={userDropdownRef}>
          <div
            onClick={() => {
              setShowUserDropdown(!showUserDropdown);
              setShowNotifications(false);
            }}
            className={clsx(
              'flex items-center gap-3 pl-2 sm:pl-4 sm:border-l border-border cursor-pointer group transition-all duration-200',
              showUserDropdown && 'opacity-80'
            )}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shadow-sm shadow-primary/5">
                <img
                  src={userAvatar || defaultAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = defaultAvatar; }}
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card shadow-sm shadow-emerald-500/50" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
                  {username}
                </span>
                <ChevronDown
                  size={12}
                  className={clsx('text-muted-foreground transition-transform duration-200', showUserDropdown && 'rotate-180')}
                />
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight font-medium">{userRole}</span>
            </div>
          </div>

          {showUserDropdown && (
            <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    navigate('/ho-so');
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/70">
                    <User size={18} />
                  </div>
                  <span className="text-[13px] font-semibold">Hồ sơ cá nhân</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/cai-dat');
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/70">
                    <Settings size={18} />
                  </div>
                  <span className="text-[13px] font-semibold">Cài đặt hệ thống</span>
                </button>

                <div className="my-1 border-t border-border/50" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/5 flex items-center justify-center">
                    <LogOut size={18} />
                  </div>
                  <span className="text-[13px] font-bold">Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
