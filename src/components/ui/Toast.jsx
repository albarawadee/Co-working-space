import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const COLORS = {
  success: 'bg-teal text-white',
  error:   'bg-red-500 text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-navy text-white',
};

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
};

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2" style={{ direction: 'rtl' }}>
      {toasts.map(t => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast-enter flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${COLORS[t.type] || COLORS.info}`}>
            <Icon size={15} />
            <span>{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
