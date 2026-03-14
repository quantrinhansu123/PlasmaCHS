import React from 'react';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const colorMap = {
  red: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-500/20',
  green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20',
  pink: 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-md shadow-pink-500/20',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/20',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg shadow-orange-500/30',
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/20',
  purple: 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/20',
  cyan: 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-500/20',
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/20',
  amber: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20',
  slate: 'bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md shadow-slate-600/20',
};

export const ActionCard = ({
  icon: Icon,
  title,
  description,
  href,
  colorScheme,
}) => {
  return (
    <Link
      to={href}
      className="group relative block bg-white rounded-2xl p-4 lg:p-5 transition-all duration-300 hover:shadow-lg border border-border hover:border-primary/20 hover:-translate-y-0.5"
    >
      <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-primary/5 rounded-full flex items-center justify-center text-primary opacity-0 -translate-x-2 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0">
        <ArrowUpRight size={14} strokeWidth={2.5} />
      </div>

      <div className="flex flex-col items-center text-center h-full">
        <div
          className={clsx(
            'w-12 h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center mb-3.5 transition-transform duration-300 group-hover:scale-110 shadow-sm',
            colorMap[colorScheme]
          )}
        >
          <Icon size={24} strokeWidth={2} />
        </div>

        <h3 className="font-bold text-[16px] text-foreground mb-1 group-hover:text-primary transition-colors">
          {title}
        </h3>

        <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">
          {description}
        </p>
      </div>
    </Link>
  );
};
