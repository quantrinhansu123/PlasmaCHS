import React, { useState } from 'react';
import { Search, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { ModuleCard } from '../components/ui/ModuleCard';
import { useLocation, useNavigate } from 'react-router-dom';
import { actionModuleSectionsByPath } from '../constants/actionModuleData';
import useBookmarkedPaths from '../hooks/useBookmarkedPaths';

const ModulePage = () => {
  const [activeTab, setActiveTab] = useState('tat-ca');
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { bookmarkedPaths, isBookmarked, toggleBookmark } = useBookmarkedPaths();

  const data = actionModuleSectionsByPath[location.pathname] || [];
  const filteredBookmarkedItems = data
    .flatMap((section) => section.items)
    .filter((item) => bookmarkedPaths.includes(item.path))
    .filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      {/* Filter Bar */}
      <div className="bg-card bg-white rounded-xl shadow-sm border border-border p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-4 mb-4 sm:mb-6 relative z-10 overflow-hidden">
        <button 
          onClick={() => navigate('/trang-chu')}
          className="shrink-0 !w-9 !h-8 sm:!w-auto sm:!h-9 !px-0 sm:!px-3 !py-0 rounded-lg border border-border hover:bg-muted text-muted-foreground text-[12px] sm:text-[13px] font-medium transition-colors bg-card shadow-sm"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Quay lại</span>
        </button>

        <div className="flex bg-muted rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setActiveTab('tat-ca')}
            className={clsx(
              "!h-8 sm:!h-9 !px-2.5 sm:!px-4 !py-0 rounded-md text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap",
              activeTab === 'tat-ca'
                ? "bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveTab('danh-dau')}
            className={clsx(
              "!h-8 sm:!h-9 !px-2.5 sm:!px-4 !py-0 rounded-md text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap",
              activeTab === 'danh-dau'
                ? "bg-card text-primary shadow-sm ring-1 ring-black/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Đánh dấu
          </button>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-y-0 left-2.5 sm:left-3 flex items-center pointer-events-none text-muted-foreground">
            <Search size={15} />
          </div>
          <input
            type="text"
            className="w-full text-[12px] sm:text-[13px] bg-transparent border border-border rounded-lg pl-8 sm:pl-9 pr-2.5 sm:pr-4 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/60"
            placeholder="Tìm module..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'danh-dau' ? (
        filteredBookmarkedItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-in fade-in duration-500">
            {filteredBookmarkedItems.map((item) => (
              <ModuleCard
                key={item.path}
                {...item}
                isBookmarked={isBookmarked(item.path)}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground bg-card/50 rounded-2xl border border-border mt-4">
            Chưa có module nào được đánh dấu.
          </div>
        )
      ) : data.length > 0 ? (
        <div className="space-y-8">
          {data.map((section, idx) => {
            // Filter items by search query
            const filteredItems = section.items.filter(item => 
              item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
              item.description.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                <h2 className="text-[14px] font-bold text-primary mb-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    <span>{section.section}</span>
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
          
          {searchQuery && !data.some(s => s.items.some(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()) || i.description.toLowerCase().includes(searchQuery.toLowerCase()))) && (
            <div className="text-center py-16 text-muted-foreground bg-card/50 rounded-2xl border border-border">
              Không tìm thấy kết quả phù hợp cho "{searchQuery}"
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground bg-card/50 rounded-2xl border border-border border-dashed mt-4">
          Module này đang được phát triển...
        </div>
      )}
    </div>
  );
};

export default ModulePage;
