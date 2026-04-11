import { useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { generateId, logActivity } from '../../utils';
import { Modal, Input, Badge } from '../../components/ui';

export default function AdminPricing({ user, config, toast }) {
  const [pricing, savePricing] = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);
  const [form, setForm] = useState({ hourly:pricing.hourly, halfDay:pricing.halfDay, halfDayHours:pricing.halfDayHours, fullDay:pricing.fullDay });
  const [offers, setOffers] = useState(pricing.specialOffers||[]);
  const [showOffer, setShowOffer] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({ label:'', price:'', durationMinutes:'', active:true });

  const handleSave = () => {
    const updated = { hourly:Number(form.hourly), halfDay:Number(form.halfDay), halfDayHours:Number(form.halfDayHours), fullDay:Number(form.fullDay), specialOffers:offers };
    savePricing(updated);
    logActivity('تعديل الأسعار', `ساعي:${form.hourly} | نصف:${form.halfDay} | يوم:${form.fullDay}`, user.id);
    toast('تم حفظ الأسعار', 'success');
  };

  const openAdd  = () => { setEditingOffer(null); setOfferForm({label:'',price:'',durationMinutes:'',active:true}); setShowOffer(true); };
  const openEdit = (o) => { setEditingOffer(o); setOfferForm({label:o.label,price:o.price,durationMinutes:o.durationMinutes,active:o.active}); setShowOffer(true); };

  const saveOffer = () => {
    if (!offerForm.label.trim()||!offerForm.price) return;
    const o = {...offerForm, price:Number(offerForm.price), durationMinutes:Number(offerForm.durationMinutes||0)};
    if (editingOffer) setOffers(offers.map(x=>x.id===editingOffer.id?{...x,...o}:x));
    else setOffers([...offers, {id:generateId('offer'),...o}]);
    setShowOffer(false);
  };

  const tiers = [
    { label:'بالساعة', sub:`كل ساعة أو جزء`, price:form.hourly, unit:`${config.currency}/ساعة` },
    { label:'نصف يوم', sub:`حتى ${form.halfDayHours} ساعات`, price:form.halfDay, unit:config.currency },
    { label:'يوم كامل', sub:'طوال اليوم', price:form.fullDay, unit:config.currency },
  ];

  const offerFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={()=>setShowOffer(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button>
      <button onClick={saveOffer} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">إدارة الأسعار</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200 space-y-4">
          <h2 className="font-semibold text-navy">تسعيرة الجلسات</h2>
          <Input label={`السعر بالساعة (${config.currency})`} type="number" min="0" value={form.hourly} onChange={e=>setForm({...form,hourly:e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={`نصف يوم — السعر`} type="number" min="0" value={form.halfDay} onChange={e=>setForm({...form,halfDay:e.target.value})} />
            <Input label="نصف يوم — الساعات" type="number" min="1" value={form.halfDayHours} onChange={e=>setForm({...form,halfDayHours:e.target.value})} />
          </div>
          <Input label={`يوم كامل — السعر (${config.currency})`} type="number" min="0" value={form.fullDay} onChange={e=>setForm({...form,fullDay:e.target.value})} />
          <button onClick={handleSave} className="w-full bg-navy hover:bg-navy-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer">حفظ الأسعار</button>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
          <h2 className="font-semibold text-navy mb-4">معاينة التسعيرة</h2>
          <div className="space-y-3">
            {tiers.map((t,i)=>(
              <div key={i} className="flex items-center justify-between bg-cream-50 rounded-xl px-4 py-3">
                <div><p className="font-semibold text-navy text-sm">{t.label}</p><p className="text-xs text-navy-400">{t.sub}</p></div>
                <div className="text-left"><span className="text-xl font-bold text-navy">{Number(t.price).toLocaleString('en-US')}</span><span className="text-xs text-navy-400 mr-1">{t.unit}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy">العروض الخاصة</h2>
          <button onClick={openAdd} className="bg-gold hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer flex items-center gap-1.5"><Plus size={13}/><span>إضافة</span></button>
        </div>
        {offers.length===0 ? (
          <div className="text-center py-8 text-navy-400 text-sm">لا توجد عروض خاصة</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {offers.map(o=>(
              <div key={o.id} className={`rounded-xl border p-3 ${o.active?'border-amber-200 bg-amber-50':'border-cream-200 bg-cream-50 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div><p className="font-semibold text-navy text-sm">{o.label}</p><p className="text-base font-bold text-gold mt-1">{o.price} {config.currency}</p></div>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={()=>setOffers(offers.map(x=>x.id===o.id?{...x,active:!x.active}:x))} className="p-1 cursor-pointer text-navy-400 hover:text-teal transition-colors">{o.active?<CheckCircle size={13} className="text-teal"/>:<XCircle size={13}/>}</button>
                    <button onClick={()=>openEdit(o)} className="p-1 cursor-pointer text-navy-400 hover:text-gold transition-colors"><Edit2 size={12}/></button>
                    <button onClick={()=>setOffers(offers.filter(x=>x.id!==o.id))} className="p-1 cursor-pointer text-navy-400 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showOffer} onClose={()=>setShowOffer(false)} title={editingOffer?'تعديل العرض':'إضافة عرض خاص'} size="sm" footer={offerFooter}>
        <div className="space-y-4">
          <Input label="اسم العرض" value={offerForm.label} onChange={e=>setOfferForm({...offerForm,label:e.target.value})} placeholder="مثال: عرض الطالب" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`السعر (${config.currency})`} type="number" min="0" value={offerForm.price} onChange={e=>setOfferForm({...offerForm,price:e.target.value})} />
            <Input label="المدة (دقيقة)" type="number" min="0" value={offerForm.durationMinutes} onChange={e=>setOfferForm({...offerForm,durationMinutes:e.target.value})} placeholder="0 = غير محدد" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
