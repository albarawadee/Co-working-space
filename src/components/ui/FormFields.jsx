import { useState, useRef, useEffect, useMemo } from 'react';
import { AlertCircle, ChevronDown, X, Check } from 'lucide-react';

const baseInput = `w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none
  transition-all duration-200 text-navy placeholder:text-navy-300
  focus:ring-2`;

const validClass   = 'border-cream-300 bg-white focus:border-gold focus:ring-gold/20';
const invalidClass = 'border-red-400 bg-red-50 focus:ring-red-200';

function FieldError({ error }) {
  if (!error) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <AlertCircle size={11} />{error}
    </span>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700 mb-1.5">{label}</label>}
      <input className={`${baseInput} ${error ? invalidClass : validClass}`} {...props} />
      <FieldError error={error} />
    </div>
  );
}

export function Select({ label, error, className = '', children, ...props }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700 mb-1.5">{label}</label>}
      <select className={`${baseInput} cursor-pointer ${error ? invalidClass : validClass}`} {...props}>
        {children}
      </select>
      <FieldError error={error} />
    </div>
  );
}

export function SearchableSelect({
  label,
  error,
  value = '',
  onChange,
  options = [],
  placeholder = '— اختر —',
  className = '',
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => opt.toLowerCase().includes(q));
  }, [options, query]);

  const select = (opt) => {
    onChange?.(opt);
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange?.('');
    setQuery('');
  };

  return (
    <div className={`flex flex-col ${className}`} ref={wrapperRef}>
      {label && <label className="text-sm font-medium text-navy-700 mb-1.5">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={`${baseInput} flex items-center justify-between text-right cursor-pointer ${error ? invalidClass : validClass}`}
        >
          <span className={value ? 'text-navy' : 'text-navy-300'}>
            {value || placeholder}
          </span>
          <span className="flex items-center gap-1 text-navy-400">
            {value && (
              <span
                role="button"
                onClick={clear}
                className="p-0.5 hover:text-red-500 cursor-pointer"
              >
                <X size={13} />
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث…"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                dir="rtl"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-400 text-center">لا توجد نتائج</li>
              ) : filtered.map(opt => (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => select(opt)}
                    className={`w-full text-right px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors ${opt === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-navy'}`}
                  >
                    <span>{opt}</span>
                    {opt === value && <Check size={13} className="text-indigo-600" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={`flex flex-col ${className}`}>
      {label && <label className="text-sm font-medium text-navy-700 mb-1.5">{label}</label>}
      <textarea
        rows={3}
        className={`${baseInput} resize-none ${error ? invalidClass : validClass}`}
        {...props}
      />
      <FieldError error={error} />
    </div>
  );
}
