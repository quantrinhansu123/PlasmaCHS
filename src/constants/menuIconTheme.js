/**
 * Icon menu kiểu hub: nền màu đặc + icon trắng (theo mẫu 5F).
 * Ưu tiên map theo path module, fallback theo colorScheme.
 */
export const MENU_ICON_SOLID_BY_PATH = {
  '/don-hang-kinh-doanh': 'bg-blue-600 text-white shadow-[0_6px_16px_rgba(37,99,235,0.32)]',
  '/quan-ly-thiet-bi': 'bg-sky-500 text-white shadow-[0_6px_16px_rgba(14,165,233,0.32)]',
  '/kho': 'bg-teal-500 text-white shadow-[0_6px_16px_rgba(20,184,166,0.32)]',
  '/mua-hang-nha-cung-cap': 'bg-orange-500 text-white shadow-[0_6px_16px_rgba(249,115,22,0.32)]',
  '/van-chuyen': 'bg-cyan-500 text-white shadow-[0_6px_16px_rgba(6,182,212,0.32)]',
  '/thu-hoi': 'bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.32)]',
  '/vat-tu': 'bg-violet-600 text-white shadow-[0_6px_16px_rgba(124,58,237,0.32)]',
  '/he-thong': 'bg-slate-700 text-white shadow-[0_6px_16px_rgba(51,65,85,0.32)]',
  '/phieu-sua-chua': 'bg-amber-500 text-white shadow-[0_6px_16px_rgba(245,158,11,0.32)]',
  '/trang-chu': 'bg-blue-600 text-white shadow-[0_6px_16px_rgba(37,99,235,0.32)]',
  '/thong-ke': 'bg-purple-600 text-white shadow-[0_6px_16px_rgba(147,51,234,0.32)]',
};

export const MENU_ICON_SOLID_BY_SCHEME = {
  blue: 'bg-blue-600 text-white shadow-[0_6px_16px_rgba(37,99,235,0.32)]',
  green: 'bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.32)]',
  emerald: 'bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.32)]',
  sky: 'bg-sky-500 text-white shadow-[0_6px_16px_rgba(14,165,233,0.32)]',
  cyan: 'bg-cyan-500 text-white shadow-[0_6px_16px_rgba(6,182,212,0.32)]',
  teal: 'bg-teal-500 text-white shadow-[0_6px_16px_rgba(20,184,166,0.32)]',
  orange: 'bg-orange-500 text-white shadow-[0_6px_16px_rgba(249,115,22,0.32)]',
  amber: 'bg-amber-500 text-white shadow-[0_6px_16px_rgba(245,158,11,0.32)]',
  yellow: 'bg-yellow-500 text-white shadow-[0_6px_16px_rgba(234,179,8,0.32)]',
  pink: 'bg-pink-500 text-white shadow-[0_6px_16px_rgba(236,72,153,0.32)]',
  rose: 'bg-rose-500 text-white shadow-[0_6px_16px_rgba(244,63,94,0.32)]',
  red: 'bg-red-500 text-white shadow-[0_6px_16px_rgba(239,68,68,0.32)]',
  purple: 'bg-violet-600 text-white shadow-[0_6px_16px_rgba(124,58,237,0.32)]',
  indigo: 'bg-indigo-600 text-white shadow-[0_6px_16px_rgba(79,70,229,0.32)]',
  slate: 'bg-slate-700 text-white shadow-[0_6px_16px_rgba(51,65,85,0.32)]',
  gray: 'bg-slate-600 text-white shadow-[0_6px_16px_rgba(71,85,105,0.32)]',
};

export function resolveMenuIconSolidClass(iconKey, colorScheme = 'blue') {
  if (iconKey && MENU_ICON_SOLID_BY_PATH[iconKey]) {
    return MENU_ICON_SOLID_BY_PATH[iconKey];
  }
  return MENU_ICON_SOLID_BY_SCHEME[colorScheme] || MENU_ICON_SOLID_BY_SCHEME.blue;
}
