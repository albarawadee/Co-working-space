import { useState } from 'react';
import { Trash2, Save, Wifi, Clock, Building2, Users } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../../constants';
import { storage, logActivity } from '../../utils';
import { Input, ConfirmDialog } from '../../components/ui';

export default function AdminSettings({ user, config, setConfig, toast }) {
  const [, saveConfig] = useStorage(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [libForm, setLibForm] = useState({ name: config.name || '', currency: config.currency || 'ج.م' });
  const [capForm, setCapForm] = useState({ capacity: config.capacity || 50, openTime: config.openTime || '08:00', closeTime: config.closeTime || '24:00' });
  const [wifiForm, setWifiForm] = useState({ wifiName: config.wifiName || '' });
  const [confirmClear, setConfirmClear] = useState(false);

  const activeSessions = sessions.filter(s => s.status === 'active');

  const saveSection = (partial) => {
    const updated = { ...config, ...partial };
    saveConfig(updated);
    if (setConfig) setConfig(updated);
    logActivity('تعديل الإعدادات', 'تم تحديث إعدادات المكتبة', user.id);
    toast('تم حفظ الإعدادات', 'success');
  };

  const keys = storage.keys();
  const sizeKB = Math.round(keys.reduce((s, k) => { try { return s + (localStorage.getItem(k) || '').length; } catch { return s; } }, 0) / 1024 * 10) / 10;

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">الإعدادات</h1>

      {/* Library Info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-indigo-500"/>
          <h2 className="font-semibold text-navy">معلومات المكتبة</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="اسم المكتبة" value={libForm.name} onChange={e => setLibForm({ ...libForm, name: e.target.value })} placeholder="Smart Vision" />
          <Input label="العملة" value={libForm.currency} onChange={e => setLibForm({ ...libForm, currency: e.target.value })} placeholder="ج.م" />
        </div>
        <button
          onClick={() => saveSection(libForm)}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
        >
          <Save size={14}/>حفظ
        </button>
      </div>

      {/* Capacity & Hours */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-teal-500"/>
          <h2 className="font-semibold text-navy">الطاقة الاستيعابية والمواعيد</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input
              label="عدد المقاعد"
              type="number"
              min="1"
              value={capForm.capacity}
              onChange={e => setCapForm({ ...capForm, capacity: Number(e.target.value) })}
            />
            <p className="text-xs text-gray-400 mt-1">
              {activeSessions.length} مقعد مشغول حالياً
            </p>
          </div>
          <Input label="وقت الفتح" type="time" value={capForm.openTime} onChange={e => setCapForm({ ...capForm, openTime: e.target.value })} />
          <Input label="وقت الإغلاق" type="time" value={capForm.closeTime} onChange={e => setCapForm({ ...capForm, closeTime: e.target.value })} />
        </div>
        <button
          onClick={() => saveSection(capForm)}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
        >
          <Save size={14}/>حفظ
        </button>
      </div>

      {/* WiFi */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Wifi size={18} className="text-blue-500"/>
          <h2 className="font-semibold text-navy">شبكة WiFi</h2>
        </div>
        <Input label="اسم شبكة WiFi" value={wifiForm.wifiName} onChange={e => setWifiForm({ wifiName: e.target.value })} placeholder="Smart-Vision-WiFi" />
        <button
          onClick={() => saveSection(wifiForm)}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
        >
          <Save size={14}/>حفظ
        </button>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <h2 className="font-semibold text-navy mb-4">معلومات النظام</h2>
        {[
          { l: 'مفاتيح التخزين', v: keys.length },
          { l: 'حجم البيانات', v: `${sizeKB} KB` },
          { l: 'الإصدار', v: '1.0.0' },
          { l: 'شبكة WiFi', v: config.wifiName },
        ].map((r, i) => (
          <div key={i} className="flex justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
            <span className="text-gray-500">{r.l}</span>
            <span className="font-semibold text-navy">{r.v}</span>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <h2 className="font-semibold text-red-700 mb-2">منطقة الخطر</h2>
        <p className="text-sm text-red-600 mb-4">سيؤدي مسح البيانات إلى حذف جميع السجلات نهائياً.</p>
        <button
          onClick={() => setConfirmClear(true)}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
        >
          <Trash2 size={14}/><span>مسح جميع البيانات</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => { storage.clear(); window.location.reload(); }}
        title="مسح جميع البيانات"
        message="سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟"
        variant="danger"
      />
    </div>
  );
}
