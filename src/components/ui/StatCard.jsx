import { TrendingUp, TrendingDown } from 'lucide-react';

const COLOR_MAP = {
  navy:  'bg-navy text-white',
  gold:  'bg-gold text-white',
  teal:  'bg-teal text-white',
  cream: 'bg-cream-200 text-navy',
  red:   'bg-red-500 text-white',
  amber: 'bg-amber-500 text-white',
};

export function StatCard({ title, value, subtitle, icon: Icon, color = 'navy', trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 card-lift">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-navy truncate">{value}</p>
          {subtitle && <p className="text-xs text-navy-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? 'text-teal' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl flex-shrink-0 ${COLOR_MAP[color] || COLOR_MAP.navy}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
