export const ERROR_LEVELS = [
  { id: 'Thấp', label: 'Thấp', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'Trung bình', label: 'Trung bình', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'Cao', label: 'Cao', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'Nghiêm trọng', label: 'Nghiêm trọng', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export const getErrorLevelColor = (level) => {
  const found = ERROR_LEVELS.find(l => l.id === level);
  return found ? found.color : 'bg-slate-100 text-slate-700 border-slate-200';
};
