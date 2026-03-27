import React, { useState, useEffect } from 'react';
import { ActionCard } from '../components/ui/ActionCard';
import { Search, Box } from 'lucide-react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { actionModuleGroups, allActionSections } from '../constants/actionModuleData';
import useBookmarkedPaths from '../hooks/useBookmarkedPaths';
import { ModuleCard } from '../components/ui/ModuleCard';


const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('chuc-nang');
  const [searchQuery, setSearchQuery] = useState('');
  const { bookmarkedPaths, isBookmarked, toggleBookmark } = useBookmarkedPaths();

  const allSections = allActionSections;
  const moduleCards = actionModuleGroups.map((group) => ({
    icon: group.icon,
    title: group.title,
    description: group.description,
    href: group.path,
    colorScheme: group.colorScheme,
  }));

  const allBookmarkedItems = allSections
    .flatMap((section) => section.items)
    .filter((item) => bookmarkedPaths.includes(item.path));

  const username = localStorage.getItem('user_name') || "Lê Minh Công";
  
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="mb-4 lg:mb-5">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2 text-foreground">
          Chào buổi sáng, <span className="text-primary">{username}</span> 👋
        </h1>
      </div>

      <div className={clsx(
        "bg-card rounded-xl shadow-sm border border-border p-1.5 sm:p-1 flex items-center gap-1.5 sm:gap-2 mb-4 lg:mb-5 transition-all duration-300 overflow-hidden",
        activeTab === 'tat-ca' ? "w-full" : "max-w-fit"
      )}>
        <div className="flex bg-muted/20 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setActiveTab('chuc-nang')}
            className={clsx(
              "!h-8 sm:!h-auto !px-2 sm:!px-3.5 !py-0 sm:!py-1 rounded-md text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap",
              activeTab === 'chuc-nang'
                ? "bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chức năng
          </button>


          <button
            onClick={() => setActiveTab('danh-dau')}
            className={clsx(
              "!h-8 sm:!h-auto !px-2 sm:!px-3.5 !py-0 sm:!py-1 rounded-md text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap",
              activeTab === 'danh-dau'
                ? "bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Đánh dấu
          </button>

          <button
            onClick={() => setActiveTab('tat-ca')}
            className={clsx(
              "!h-8 sm:!h-auto !px-2 sm:!px-3.5 !py-0 sm:!py-1 rounded-md text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap",
              activeTab === 'tat-ca'
                ? "bg-card text-primary shadow-sm ring-1 ring-primary/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tất cả
          </button>
        </div>

        {activeTab === 'tat-ca' && (
          <div className="flex-1 min-w-0 flex items-center bg-muted/20 rounded-lg px-2 py-1.5 animate-in slide-in-from-left-2 duration-300">
            <Search size={15} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Tìm module..."
              className="bg-transparent border-none outline-none text-[12px] sm:text-[13px] text-foreground w-full ml-1.5 min-w-0 placeholder:text-muted-foreground/60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>


      {/* Tab: Chức năng */}
      {activeTab === 'chuc-nang' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 animate-in fade-in duration-500">
          {moduleCards.map((module, index) => (
            <ActionCard key={`${module.href}-${index}`} {...module} />
          ))}
        </div>
      )}

      {/* Tab: Đánh dấu */}
      {activeTab === 'danh-dau' && (
        allBookmarkedItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-in fade-in duration-500">
            {allBookmarkedItems.map((item) => (
              <ModuleCard
                key={item.path}
                {...item}
                isBookmarked={isBookmarked(item.path)}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <Box className="w-8 h-8 opacity-20" />
              <p className="font-medium">Chưa có module nào được đánh dấu.</p>
            </div>
          </div>
        )
      )}

      {/* Tab: Tất cả */}
      {activeTab === 'tat-ca' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-8">
            {allSections.map((section, idx) => {
              const filteredItems = section.items.filter(item =>
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
              );

              if (filteredItems.length === 0) return null;

              return (
                <div key={idx} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                  <h2 className="text-[14px] font-black text-primary mb-3.5 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-1 h-4 bg-primary rounded-full"></span>
                      <span className="uppercase tracking-wider">{section.section}</span>
                    </div>
                    <div className="h-px flex-1 bg-border/60"></div>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredItems.map((item, itemIdx) => (
                      <ModuleCard
                        key={item.path || itemIdx}
                        {...item}
                        isBookmarked={isBookmarked(item.path)}
                        onToggleBookmark={toggleBookmark}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
