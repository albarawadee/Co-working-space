const VARIANTS = {
  green:  'bg-teal-50 text-teal-700 border border-teal-200',
  teal:   'bg-teal-50 text-teal-700 border border-teal-200',
  amber:  'bg-amber-50 text-amber-700 border border-amber-200',
  red:    'bg-red-50 text-red-600 border border-red-200',
  navy:   'bg-navy-50 text-navy border border-navy-100',
  gold:   'bg-amber-50 text-amber-700 border border-amber-200',
  gray:   'bg-gray-100 text-gray-600 border border-gray-200',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200',
};

export function Badge({ children, variant = 'navy' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${VARIANTS[variant] || VARIANTS.navy}`}>
      {children}
    </span>
  );
}
