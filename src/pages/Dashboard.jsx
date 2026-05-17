import React, { useState } from 'react';
import { ActionCard } from '../components/ui/ActionCard';
import { Box } from 'lucide-react';
import { actionModuleGroups, allActionSections } from '../constants/actionModuleData';
import useBookmarkedPaths from '../hooks/useBookmarkedPaths';
import { ModuleCard } from '../components/ui/ModuleCard';
import usePermissions from '../hooks/usePermissions';
import { canAccessPath } from '../utils/accessControl';

const moduleGridClass =
  'grid grid-cols-2 gap-3 sm:gap-3.5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-4';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('chuc-nang');
  const [searchQuery, setSearchQuery] = useState('');
  const { bookmarkedPaths, isBookmarked, toggleBookmark } = useBookmarkedPaths();
  const { role, permissions } = usePermissions();

  const allSections = allActionSections;
  const moduleCards = actionModuleGroups
    .filter(
      (group) =>
        canAccessPath(group.path, role, permissions) &&
        group.items?.some((item) => canAccessPath(item.href || item.path, role, permissions))
    )
    .map((group) => ({
      icon: group.icon,
      title: group.title,
      description: group.description,
      href: group.path,
      colorScheme: group.colorScheme,
    }));

  const allBookmarkedItems = allSections
    .flatMap((section) => section.items)
    .filter((item) => bookmarkedPaths.includes(item.path) && canAccessPath(item.path, role, permissions));

  const username = localStorage.getItem('user_name') || 'Lê Minh Công';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4 lg:pb-10">
      <div className="mb-4 lg:mb-5">
        <h1 className="text-[15px] sm:text-base lg:text-2xl font-bold leading-snug text-foreground">
          Chào buổi sáng,{' '}
          <span className="text-primary">{username}</span>{' '}
          <span aria-hidden>👋</span>
        </h1>
      </div>

      {activeTab === 'chuc-nang' && (
        <div className={`${moduleGridClass} animate-in fade-in duration-500`}>
          {moduleCards.map((module, index) => (
            <ActionCard key={`${module.href}-${index}`} {...module} cardLayout="home" />
          ))}
        </div>
      )}

      {activeTab === 'danh-dau' &&
        (allBookmarkedItems.length > 0 ? (
          <div className={`${moduleGridClass} animate-in fade-in duration-500`}>
            {allBookmarkedItems.map((item) => (
              <ModuleCard
                key={item.path}
                {...item}
                cardLayout="home"
                isBookmarked={isBookmarked(item.path)}
                onToggleBookmark={toggleBookmark}
              />
            ))}
          </div>
        ) : (
          <div className="col-span-2 text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <Box className="w-8 h-8 opacity-20" />
              <p className="font-medium text-sm">Chưa có module nào được đánh dấu.</p>
            </div>
          </div>
        ))}

      {activeTab === 'tat-ca' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="space-y-8">
            {allSections.map((section, idx) => {
              const filteredItems = section.items.filter(
                (item) =>
                  canAccessPath(item.path, role, permissions) &&
                  (item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase()))
              );

              if (filteredItems.length === 0) return null;

              return (
                <div
                  key={idx}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <h2 className="text-[14px] font-black text-primary mb-3.5 flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-1 h-4 bg-primary rounded-full" />
                      <span className="uppercase tracking-wider">{section.section}</span>
                    </div>
                    <div className="h-px flex-1 bg-border/60" />
                  </h2>

                  <div className={moduleGridClass}>
                    {filteredItems.map((item, itemIdx) => (
                      <ModuleCard
                        key={item.path || itemIdx}
                        {...item}
                        cardLayout="home"
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
