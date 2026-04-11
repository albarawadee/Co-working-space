import { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZES[size]} flex flex-col max-h-[90vh]`}
        style={{ animation: 'slideUp 0.22s ease-out' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-cream-100 transition-colors duration-200 cursor-pointer text-navy-300 hover:text-navy"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-cream-200">{footer}</div>}
      </div>
    </div>
  );
}
