/** Nền icon phẳng (ModuleCard / ActionCard khi không dùng 3D) */
export const flatIconColorMap = {
  red: 'bg-red-100 text-red-500 shadow-[0_4px_0_0_rgba(239,68,68,0.16)]',
  green: 'bg-emerald-100 text-emerald-600 shadow-[0_4px_0_0_rgba(16,185,129,0.18)]',
  pink: 'bg-pink-100 text-pink-500 shadow-[0_4px_0_0_rgba(236,72,153,0.15)]',
  blue: 'bg-indigo-100 text-indigo-500 shadow-[0_4px_0_0_rgba(99,102,241,0.18)]',
  orange: 'bg-orange-100 text-orange-500 shadow-[0_4px_0_0_rgba(249,115,22,0.18)]',
  teal: 'bg-teal-100 text-teal-600 shadow-[0_4px_0_0_rgba(20,184,166,0.16)]',
  purple: 'bg-violet-100 text-violet-500 shadow-[0_4px_0_0_rgba(139,92,246,0.16)]',
  cyan: 'bg-cyan-100 text-cyan-600 shadow-[0_4px_0_0_rgba(6,182,212,0.16)]',
  emerald: 'bg-emerald-100 text-emerald-600 shadow-[0_4px_0_0_rgba(16,185,129,0.18)]',
  amber: 'bg-amber-100 text-amber-600 shadow-[0_4px_0_0_rgba(245,158,11,0.18)]',
  slate: 'bg-slate-200 text-slate-600 shadow-[0_4px_0_0_rgba(100,116,139,0.2)]',
  gray: 'bg-gray-200 text-gray-600 shadow-[0_4px_0_0_rgba(107,114,128,0.2)]',
  yellow: 'bg-yellow-100 text-yellow-600 shadow-[0_4px_0_0_rgba(234,179,8,0.2)]',
  indigo: 'bg-indigo-100 text-indigo-600 shadow-[0_4px_0_0_rgba(99,102,241,0.18)]',
  rose: 'bg-rose-100 text-rose-600 shadow-[0_4px_0_0_rgba(244,63,94,0.18)]',
};

export const flatIconBoxClass =
  'w-20 h-20 lg:w-24 lg:h-24 rounded-[24px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]';

export const mobileModuleCardClass =
  'flex flex-col bg-white rounded-[18px] p-3.5 min-h-[168px] shadow-[0_2px_14px_rgba(15,23,42,0.07)] border border-slate-100/90 relative active:scale-[0.98]';

export const desktopModuleCardClass =
  'lg:flex-row lg:items-center lg:gap-5 lg:bg-[#e8e8e8] lg:rounded-[28px] lg:p-6 lg:min-h-[120px] lg:border-black/10 lg:shadow-none lg:hover:border-black/20 lg:hover:-translate-y-0.5 lg:active:scale-100';
