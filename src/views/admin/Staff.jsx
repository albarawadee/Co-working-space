import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, formatDateTime, logActivity } from '../../utils';
import { Modal, Input, Select, Badge, ConfirmDialog } from '../../components/ui';

const ROLE_LABEL  = { admin:'مدير', cashier:'كاشير', kitchen:'مطبخ' };
const ROLE_BADGE  = { admin:'navy', cashier:'teal', kitchen:'amber' };

export default function AdminStaff({ user, config, toast }) {
  const [staff, saveStaff] = useStorage(STORAGE_KEYS.STAFF, []);
  const [logs] = useStorage(STORAGE_KEYS.DAILY_LOGS, []);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showPwd, setShowPwd]       = useState(false);
  const [form, setForm]   = useState({ name:'', username:'', password:'', role:'cashier', active:true });
  const [errors, setErrors] = useState({});
  const [pwdTarget, setPwdTarget]   = useState(null);   // staff member being password-changed
  const [pwdForm, setPwdForm]       = useState({ newPwd:'', confirmPwd:'' });
  const [pwdErrors, setPwdErrors]   = useState({});
  const [showNewPwd, setShowNewPwd] = useState(false);

  const openAdd  = () => { setEditing(null); setForm({name:'',username:'',password:'',role:'cashier',active:true}); setErrors({}); setShowPwd(false); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setForm({name:s.name,username:s.username,password:s.password,role:s.role,active:s.active}); setErrors({}); setShowPwd(false); setShowForm(true); };

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'الاسم مطلوب';
    if (!form.username.trim()) e.username = 'اسم المستخدم مطلوب';
    if (!editing && !form.password.trim()) e.password = 'كلمة المرور مطلوبة';
    if (!editing && staff.some(s => s.username === form.username.trim())) e.username = 'اسم المستخدم مستخدم';
    setErrors(e); return !Object.keys(e).length;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editing) {
      saveStaff(staff.map(s => s.id===editing.id ? {...s, name:form.name.trim(), username:form.username.trim(), password:form.password||s.password, role:form.role, active:form.active} : s));
      logActivity('تعديل موظف', form.name, user.id);
      toast('تم تعديل بيانات الموظف', 'success');
    } else {
      saveStaff([...staff, { id:generateId('stf'), name:form.name.trim(), username:form.username.trim(), password:form.password, role:form.role, active:true, createdAt:new Date().toISOString() }]);
      logActivity('إضافة موظف', `${form.name} (${form.role})`, user.id);
      toast('تمت إضافة الموظف', 'success');
    }
    setShowForm(false);
  };

  const openChangePwd = (s) => { setPwdTarget(s); setPwdForm({newPwd:'',confirmPwd:''}); setPwdErrors({}); setShowNewPwd(false); };

  const handleChangePwd = () => {
    const e = {};
    if (!pwdForm.newPwd.trim())                          e.newPwd = 'كلمة المرور الجديدة مطلوبة';
    else if (pwdForm.newPwd.length < 4)                  e.newPwd = 'لا تقل عن 4 أحرف';
    if (pwdForm.newPwd !== pwdForm.confirmPwd)           e.confirmPwd = 'كلمتا المرور غير متطابقتين';
    setPwdErrors(e);
    if (Object.keys(e).length) return;
    saveStaff(staff.map(s => s.id===pwdTarget.id ? {...s, password:pwdForm.newPwd.trim()} : s));
    logActivity('تغيير كلمة مرور', pwdTarget.name, user.id);
    toast('تم تغيير كلمة المرور', 'success');
    setPwdTarget(null);
  };

  const handleDelete = (s) => { saveStaff(staff.filter(st=>st.id!==s.id)); toast('تم حذف الموظف','info'); };
  const toggleActive = (s) => { saveStaff(staff.map(st=>st.id===s.id ? {...st,active:!st.active} : st)); toast(s.active?'تم تعطيل الحساب':'تم تفعيل الحساب','info'); };
  const lastActivity = (id) => { const l=logs.find(l=>l.staffId===id); return l ? formatDateTime(l.timestamp) : '—'; };

  const formFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button>
      <button onClick={handleSave} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy">إدارة الموظفين</h1>
        <button onClick={openAdd} className="bg-navy hover:bg-navy-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer flex items-center gap-2">
          <Plus size={15}/><span>إضافة موظف</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-cream-50 text-navy-500 text-xs uppercase">
            <th className="px-4 py-3 text-right font-semibold">الاسم</th>
            <th className="px-4 py-3 text-right font-semibold">المستخدم</th>
            <th className="px-4 py-3 text-right font-semibold">الدور</th>
            <th className="px-4 py-3 text-right font-semibold">الحالة</th>
            <th className="px-4 py-3 text-right font-semibold">آخر نشاط</th>
            <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
          </tr></thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                <td className="px-4 py-3 font-medium text-navy">{s.name}</td>
                <td className="px-4 py-3"><code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">{s.username}</code></td>
                <td className="px-4 py-3"><Badge variant={ROLE_BADGE[s.role]||'navy'}>{ROLE_LABEL[s.role]||s.role}</Badge></td>
                <td className="px-4 py-3"><button onClick={()=>s.id!==user.id&&toggleActive(s)} className={s.id===user.id?'cursor-default':'cursor-pointer'}><Badge variant={s.active?'green':'gray'}>{s.active?'نشط':'معطل'}</Badge></button></td>
                <td className="px-4 py-3 text-xs text-navy-400">{lastActivity(s.id)}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-1">
                  <button onClick={()=>openEdit(s)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold transition-colors duration-200 cursor-pointer"><Edit2 size={13}/></button>
                  {(s.role!=='admin' || s.id===user.id) && <button onClick={()=>openChangePwd(s)} title="تغيير كلمة المرور" className="p-1.5 rounded-lg hover:bg-indigo-50 text-navy-400 hover:text-indigo-600 transition-colors duration-200 cursor-pointer"><KeyRound size={13}/></button>}
                  {s.id!==user.id && s.role!=='admin' && <button onClick={()=>setConfirmDelete(s)} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 transition-colors duration-200 cursor-pointer"><Trash2 size={13}/></button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editing?'تعديل بيانات الموظف':'إضافة موظف جديد'} footer={formFooter}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="الاسم الكامل *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errors.name} placeholder="اسم الموظف" />
            <Input label="اسم المستخدم *" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} error={errors.username} placeholder="username" />
          </div>
          <div className="relative">
            <Input label={editing?'كلمة المرور (فارغة = لا تغيير)':'كلمة المرور *'} type={showPwd?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} error={errors.password} placeholder="••••••••" />
            <button type="button" onClick={()=>setShowPwd(!showPwd)} className="absolute left-3 top-8 text-navy-400 hover:text-navy cursor-pointer transition-colors">{showPwd?<EyeOff size={15}/>:<Eye size={15}/>}</button>
          </div>
          <Select label="الدور" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
            {editing?.role==='admin' && <option value="admin">مدير</option>}
            <option value="cashier">كاشير</option>
            <option value="kitchen">مطبخ</option>
          </Select>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmDelete} onClose={()=>setConfirmDelete(null)} onConfirm={()=>handleDelete(confirmDelete)} title="حذف الموظف" message={`هل أنت متأكد من حذف "${confirmDelete?.name}"؟`} />

      <Modal
        open={!!pwdTarget}
        onClose={()=>setPwdTarget(null)}
        title={`تغيير كلمة مرور — ${pwdTarget?.name}`}
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={()=>setPwdTarget(null)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button>
            <button onClick={handleChangePwd} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-indigo-700 transition-colors duration-200">تغيير</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Input
              label="كلمة المرور الجديدة *"
              type={showNewPwd ? 'text' : 'password'}
              value={pwdForm.newPwd}
              onChange={e=>setPwdForm({...pwdForm, newPwd:e.target.value})}
              error={pwdErrors.newPwd}
              placeholder="••••••••"
            />
            <button type="button" onClick={()=>setShowNewPwd(!showNewPwd)} className="absolute left-3 top-8 text-navy-400 hover:text-navy cursor-pointer transition-colors">
              {showNewPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
          <Input
            label="تأكيد كلمة المرور *"
            type="password"
            value={pwdForm.confirmPwd}
            onChange={e=>setPwdForm({...pwdForm, confirmPwd:e.target.value})}
            error={pwdErrors.confirmPwd}
            placeholder="••••••••"
          />
        </div>
      </Modal>
    </div>
  );
}
