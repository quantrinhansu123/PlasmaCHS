import React from 'react';
import { clsx } from 'clsx';
import { flatIconColorMap } from './moduleIconStyles';

/** Icon Lucide 2D trong khung màu (mobile / desktop Trang chủ) */
export function ModuleIconBox({ icon: Icon, colorScheme, size = 'card' }) {
  const isLarge = size === 'lg';

  return (
    <div
      className={clsx(
        'flex items-center justify-center shrink-0',
        isLarge
          ? 'w-20 h-20 lg:w-24 lg:h-24 rounded-[24px]'
          : 'w-[52px] h-[52px] rounded-[14px]',
        flatIconColorMap[colorScheme] || flatIconColorMap.blue
      )}
    >
      <Icon size={isLarge ? 36 : 24} strokeWidth={2} />
    </div>
  );
}
