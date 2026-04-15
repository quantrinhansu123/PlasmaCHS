import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { clsx } from 'clsx';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileBottomNav from './MobileBottomNav';
import GlobalNotifications from './GlobalNotifications';

function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <GlobalNotifications />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div
        className={clsx(
          'flex-1 flex flex-col w-full min-w-0 transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-[72px]'
        )}
      >
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 overflow-y-auto pt-1 pl-1 pr-2 pb-32 lg:pt-1 lg:pl-1.5 lg:pr-2.5 lg:pb-3 custom-scrollbar">
          <div className="w-full h-full flex flex-col">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}

export default MainLayout;
