export function WeeklyBarChart({ data, currency = 'ج.م' }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-36 w-full pt-4">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <span className="text-[10px] text-navy-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {d.value > 0 ? d.value.toLocaleString('en-US') : ''}
          </span>
          <div
            className="bar-chart-bar w-full bg-navy-200 group-hover:bg-gold cursor-default rounded-t transition-colors duration-200"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value.toLocaleString('en-US')} ${currency}`}
          />
          <span className="text-[10px] text-navy-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SVGRingChart({ segments, size = 130, centerLabel = '' }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 44, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let accumulated = 0;
  const arcs = segments.map(seg => {
    const dash = (seg.value / total) * circumference;
    const arc = { ...seg, dash, gap: circumference - dash, offset: -accumulated };
    accumulated += dash;
    return arc;
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eeece6" strokeWidth="16" />
          {arcs.map((arc, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={arc.color} strokeWidth="16"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="round" />
          ))}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-navy">{centerLabel}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-navy-600">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="font-semibold text-navy">({Math.round(seg.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarChart({ items, currency = 'ج.م' }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-navy-600 font-medium truncate max-w-[60%]">{item.label}</span>
            <span className="text-navy font-semibold">{Number(item.value).toLocaleString('en-US')} {currency}</span>
          </div>
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%`, background: item.color || '#1a1f3d' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimpleLineChart({ points, color = '#2d9f93', height = 72 }) {
  if (!points || points.length < 2) {
    return <div className="flex items-center justify-center text-xs text-navy-400" style={{ height }}>لا توجد بيانات كافية</div>;
  }
  const W = 300, H = height, pad = 6;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points.map((p, i) => [
    pad + (i / (points.length - 1)) * (W - pad * 2),
    pad + (1 - (p - min) / range) * (H - pad * 2),
  ]);
  const polyline = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${pad},${H - pad} ${polyline} ${W - pad},${H - pad}`;
  const gradId = `lg${color.replace('#', '')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
