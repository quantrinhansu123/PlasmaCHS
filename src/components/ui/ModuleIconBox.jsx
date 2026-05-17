import React from 'react';
import { clsx } from 'clsx';
import { resolveMenuIconSolidClass } from '../../constants/menuIconTheme';
import { flatIconColorMap } from './moduleIconStyles';

const SIZE_STYLES = {
  sm: 'w-9 h-9 rounded-[10px]',
  card: 'w-[52px] h-[52px] rounded-[14px]',
  hub: 'w-14 h-14 rounded-[14px]',
  lg: 'w-20 h-20 lg:w-24 lg:h-24 rounded-[20px] lg:rounded-[24px]',
};

const ICON_PX = { sm: 18, card: 24, hub: 28, lg: 36 };

/**
 * Icon menu 2D: nền màu đặc + glyph trắng (bộ hub) hoặc pastel (legacy).
 */
export function ModuleIconBox({
  icon: Icon,
  colorScheme = 'blue',
  iconKey,
  size = 'card',
  variant = 'solid',
}) {
  const boxClass =
    variant === 'solid'
      ? resolveMenuIconSolidClass(iconKey, colorScheme)
      : flatIconColorMap[colorScheme] || flatIconColorMap.blue;

  const iconPx = ICON_PX[size] ?? ICON_PX.card;

  return (
    <div
      className={clsx(
        'flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]',
        SIZE_STYLES[size] || SIZE_STYLES.card,
        boxClass
      )}
    >
      <Icon size={iconPx} strokeWidth={2} className="text-current" />
    </div>
  );
}
