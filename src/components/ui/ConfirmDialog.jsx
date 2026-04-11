import { Modal } from './Modal';

export function ConfirmDialog({ open, onClose, onConfirm, title, message, variant = 'danger' }) {
  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm font-medium hover:bg-cream-100 transition-colors duration-200 cursor-pointer"
          >
            إلغاء
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors duration-200 cursor-pointer ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal hover:bg-teal-600'}`}
          >
            تأكيد
          </button>
        </div>
      }
    >
      <p className="text-navy-600 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}
