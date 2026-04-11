import { Search, X } from 'lucide-react';

export function SearchInput({ value, onChange, placeholder = 'بحث…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 pointer-events-none" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-9 pl-8 py-2.5 rounded-xl border border-cream-300 bg-white text-sm text-navy placeholder:text-navy-300 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition-all duration-200"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-300 hover:text-navy cursor-pointer transition-colors duration-200"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
