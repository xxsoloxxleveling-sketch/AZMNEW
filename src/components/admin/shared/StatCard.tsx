import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendType = 'neutral',
  color = 'blue',
  onClick,
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'emerald':
        return {
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100/80',
          indicator: 'bg-emerald-500',
        };
      case 'amber':
        return {
          bg: 'bg-amber-50 text-amber-600 border-amber-100/80',
          indicator: 'bg-amber-500',
        };
      case 'indigo':
        return {
          bg: 'bg-indigo-50 text-indigo-600 border-indigo-100/80',
          indicator: 'bg-indigo-500',
        };
      case 'rose':
        return {
          bg: 'bg-rose-50 text-rose-600 border-rose-100/80',
          indicator: 'bg-rose-500',
        };
      default:
        return {
          bg: 'bg-blue-50 text-[#185b9d] border-blue-100/80',
          indicator: 'bg-[#185b9d]',
        };
    }
  };

  const style = getColorClasses();

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 tracking-wide">{title}</span>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-xl border ${style.bg} shadow-xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                trendType === 'up'
                  ? 'text-emerald-600'
                  : trendType === 'down'
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trendType === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trendType === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
