import { AlertCircle } from 'lucide-react';

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
