import { useState } from 'react';
import { UserPlus, Hash } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, generateStudentId, logActivity } from '../../utils';
import { Input, Textarea } from '../../components/ui';

export default function CashierNewStudent({ user, config, toast, setActiveView }) {
  const [students, saveStudents] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions, saveSessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [form, setForm] = useState({
    name: '', phone: '', userNumber: '', email: '', tags: '', notes: '',
  });
  const [errors, setErrors] = useState({});
  const [checkinNow, setCheckinNow] = useState(true);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'الاسم مطلوب';
    if (!form.phone.trim()) {
      e.phone = 'رقم الهاتف مطلوب';
    } else {
      const dup = students.find(s => s.phone?.trim() === form.phone.trim());
      if (dup) e.phone = `مسجل بالفعل: ${dup.name}`;
    }
    // Check duplicate user number
    if (form.userNumber.trim()) {
      const dupNum = students.find(s => s.memberNumber?.trim() === form.userNumber.trim());
      if (dupNum) e.userNumber = `رقم المستخدم مستخدم: ${dupNum.name}`;
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    const ns = {
      id: generateId('stu'),
      studentId: generateStudentId(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      memberNumber: form.userNumber.trim(),
      email: form.email.trim(),
      tags,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    saveStudents([...students, ns]);
    logActivity('تسجيل طالب جديد', `${ns.name} — ${ns.studentId}${ns.memberNumber ? ' · رقم: ' + ns.memberNumber : ''}`, user.id);
    if (checkinNow) {
      saveSessions([...sessions, {
        id: generateId('ses'),
        studentId: ns.id,
        studentName: ns.name,
        studentPhone: ns.phone,
        checkInTime: new Date().toISOString(),
        type: 'regular',
        status: 'active',
      }]);
      logActivity('تسجيل دخول', ns.name, user.id);
      toast(`تم تسجيل ${ns.name} ودخوله للمكتبة`, 'success');
      setActiveView?.('cashier_current');
    } else {
      toast(`تم تسجيل ${ns.name}`, 'success');
      setForm({ name: '', phone: '', userNumber: '', email: '', tags: '', notes: '' });
      setErrors({});
    }
  };

  return (
    <div className="space-y-5 fade-in p-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">تسجيل طالب جديد</h1>
        <p className="text-sm text-gray-500 mt-0.5">أدخل بيانات الطالب الجديد</p>
      </div>

      <div className="max-w-lg">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 space-y-4">
          {/* Name */}
          <Input
            label="الاسم الكامل *"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            placeholder="اسم الطالب"
          />

          {/* Phone + User Number side by side */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="رقم الهاتف *"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              error={errors.phone}
              placeholder="01XXXXXXXXX"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Hash size={13} className="text-indigo-500" />
                رقم المستخدم
              </label>
              <input
                type="text"
                value={form.userNumber}
                onChange={e => setForm({ ...form, userNumber: e.target.value })}
                placeholder="مثال: 001"
                className={`w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors ${
                  errors.userNumber ? 'border-red-400' : 'border-gray-200'
                }`}
                dir="rtl"
              />
              {errors.userNumber ? (
                <p className="text-xs text-red-500 mt-1">{errors.userNumber}</p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">رقم مخصص للطالب (اختياري)</p>
              )}
            </div>
          </div>

          {/* Email */}
          <Input
            label="البريد الإلكتروني"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            type="email"
            placeholder="example@email.com"
          />

          {/* Tags */}
          <Input
            label="الوسوم (مفصولة بفاصلة)"
            value={form.tags}
            onChange={e => setForm({ ...form, tags: e.target.value })}
            placeholder="طالب جامعي, صباحي"
          />

          {/* Notes */}
          <Textarea
            label="ملاحظات"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="أي ملاحظات…"
          />

          {/* Check-in toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setCheckinNow(!checkinNow)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer flex-shrink-0 ${checkinNow ? 'bg-teal' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checkinNow ? 'translate-x-1 right-auto left-1' : 'right-1'}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-navy">تسجيل الدخول الآن</span>
              <p className="text-xs text-gray-400">
                {checkinNow ? 'سيتم إدخاله مباشرة للمكتبة' : 'يُسجَّل فقط في قاعدة البيانات'}
              </p>
            </div>
          </label>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium text-sm transition-colors duration-150 cursor-pointer flex items-center justify-center gap-2"
          >
            <UserPlus size={15} />
            <span>تسجيل الطالب</span>
          </button>
        </div>
      </div>
    </div>
  );
}
