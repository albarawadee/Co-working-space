import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Save, Clock, Zap, Eye } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_PRICING } from '../../constants';
import { generateId, logActivity, calcBestPrice } from '../../utils';
import { Modal, Input, Badge, ConfirmDialog } from '../../components/ui';

export default function AdminPricing({ user, config, toast }) {
  const [pricing, savePricing] = useStorage(STORAGE_KEYS.PRICING, DEFAULT_PRICING);

  // Local editable state — initialized from saved pricing
  const [tiers, setTiers]                 = useState(pricing.hourTiers || []);
  const [extraHourRate, setExtraHourRate] = useState(pricing.extraHourRate ?? 10);
  const [graceMinutes, setGraceMinutes]   = useState(pricing.graceMinutes ?? 10);
  const [offers, setOffers]               = useState(pricing.specialOffers || []);

  // Tier modal
  const [showTier, setShowTier]       = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm]       = useState({ hours: '', price: '' });
  const [tierErrors, setTierErrors]   = useState({});
  const [confirmDelTier, setConfirmDelTier] = useState(null);

  // Offer modal
  const [showOffer, setShowOffer]       = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm]       = useState({ label: '', price: '', durationMinutes: '', active: true });

  // Sort tiers ascending by hours for display
  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => Number(a.hours) - Number(b.hours)),
    [tiers]
  );

  // Live preview — uses unsaved local state
  const livePricing = { ...pricing, hourTiers: tiers, extraHourRate: Number(extraHourRate), graceMinutes: Number(graceMinutes) };
  const previewSamples = [
    { label: '1 ساعة',  minutes: 60   },
    { label: '3 ساعات', minutes: 180  },
    { label: '5 ساعات', minutes: 300  },
    { label: '6 ساعات', minutes: 360  },
    { label: '8 ساعات', minutes: 480  },
    { label: '11 ساعة', minutes: 660  },
    { label: '13 ساعة', minutes: 780  },
    { label: '24 ساعة', minutes: 1440 },
  ];

  /* ── Tier handlers ── */
  const openAddTier = () => {
    setEditingTier(null);
    setTierForm({ hours: '', price: '' });
    setTierErrors({});
    setShowTier(true);
  };
  const openEditTier = (t) => {
    setEditingTier(t);
    setTierForm({ hours: String(t.hours), price: String(t.price) });
    setTierErrors({});
    setShowTier(true);
  };
  const validateTier = () => {
    const e = {};
    const h = Number(tierForm.hours);
    const p = Number(tierForm.price);
    if (!tierForm.hours || isNaN(h) || h <= 0) e.hours = 'ساعات غير صحيحة';
    if (tierForm.price === '' || isNaN(p) || p < 0) e.price = 'سعر غير صحيح';
    // Duplicate hours guard
    const dup = tiers.find(t => Number(t.hours) === h && t.id !== editingTier?.id);
    if (dup) e.hours = 'يوجد باقة بنفس عدد الساعات';
    setTierErrors(e);
    return !Object.keys(e).length;
  };
  const saveTier = () => {
    if (!validateTier()) return;
    const data = { hours: Number(tierForm.hours), price: Number(tierForm.price), active: editingTier?.active ?? true };
    if (editingTier) {
      setTiers(tiers.map(t => t.id === editingTier.id ? { ...t, ...data } : t));
    } else {
      setTiers([...tiers, { id: generateId('tier'), ...data }]);
    }
    setShowTier(false);
  };
  const toggleTier = (id) => setTiers(tiers.map(t => t.id === id ? { ...t, active: !(t.active !== false) } : t));
  const deleteTier = (id) => { setTiers(tiers.filter(t => t.id !== id)); setConfirmDelTier(null); };

  /* ── Offer handlers ── */
  const openAddOffer  = () => { setEditingOffer(null); setOfferForm({ label: '', price: '', durationMinutes: '', active: true }); setShowOffer(true); };
  const openEditOffer = (o) => { setEditingOffer(o); setOfferForm({ label: o.label, price: o.price, durationMinutes: o.durationMinutes, active: o.active }); setShowOffer(true); };
  const saveOffer = () => {
    if (!offerForm.label.trim() || !offerForm.price) return;
    const o = { ...offerForm, price: Number(offerForm.price), durationMinutes: Number(offerForm.durationMinutes || 0) };
    if (editingOffer) setOffers(offers.map(x => x.id === editingOffer.id ? { ...x, ...o } : x));
    else setOffers([...offers, { id: generateId('offer'), ...o }]);
    setShowOffer(false);
  };

  /* ── Save all ── */
  const handleSaveAll = () => {
    if (tiers.length === 0) {
      toast('أضف باقة ساعات واحدة على الأقل', 'error');
      return;
    }
    if (Number(extraHourRate) < 0 || isNaN(Number(extraHourRate))) {
      toast('سعر الساعة الإضافية غير صحيح', 'error');
      return;
    }
    if (Number(graceMinutes) < 0 || isNaN(Number(graceMinutes))) {
      toast('دقائق السماح غير صحيحة', 'error');
      return;
    }
    const updated = {
      ...pricing,
      hourTiers: tiers.map(t => ({ ...t, hours: Number(t.hours), price: Number(t.price) })),
      extraHourRate: Number(extraHourRate),
      graceMinutes: Number(graceMinutes),
      specialOffers: offers,
    };
    savePricing(updated);
    logActivity('تعديل الأسعار', `${tiers.length} باقات | إضافي:${extraHourRate} | سماح:${graceMinutes}د`, user.id);
    toast('تم حفظ الأسعار بنجاح', 'success');
  };

  const tierFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={() => setShowTier(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors">إلغاء</button>
      <button onClick={saveTier} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors">حفظ</button>
    </div>
  );

  const offerFooter = (
    <div className="flex gap-3 justify-end">
      <button onClick={() => setShowOffer(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 cursor-pointer transition-colors">إلغاء</button>
      <button onClick={saveOffer} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-navy">إدارة الأسعار</h1>
        <button
          onClick={handleSaveAll}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors flex items-center gap-2 shadow-sm"
        >
          <Save size={15}/>حفظ كل التغييرات
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tiers table — takes 2 columns on lg */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-indigo-500"/>
              <h2 className="font-semibold text-navy">باقات الساعات</h2>
              <span className="text-xs text-gray-400">({sortedTiers.length})</span>
            </div>
            <button
              onClick={openAddTier}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Plus size={13}/><span>إضافة باقة</span>
            </button>
          </div>

          {sortedTiers.length === 0 ? (
            <div className="p-10 text-center">
              <Clock size={40} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-sm text-gray-400">لا توجد باقات بعد</p>
              <p className="text-xs text-gray-400 mt-1">أضف باقة جديدة لبدء التسعير</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 text-right font-semibold">الباقة</th>
                    <th className="px-4 py-3 text-right font-semibold">عدد الساعات</th>
                    <th className="px-4 py-3 text-right font-semibold">السعر</th>
                    <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                    <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTiers.map((t) => (
                    <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${t.active === false ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-navy">أول {t.hours} ساعات</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{t.hours}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-teal-600">{Number(t.price).toLocaleString('en-US')}</span>
                        <span className="text-xs text-gray-400 mr-1">{config.currency}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleTier(t.id)}
                          className="cursor-pointer flex items-center gap-1.5 text-xs font-medium"
                        >
                          {t.active !== false ? (
                            <><CheckCircle size={14} className="text-teal-500"/><span className="text-teal-700">مفعّلة</span></>
                          ) : (
                            <><XCircle size={14} className="text-gray-400"/><span className="text-gray-500">موقوفة</span></>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditTier(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"><Edit2 size={13}/></button>
                          <button onClick={() => setConfirmDelTier(t)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Extra hour & grace settings */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 flex items-center gap-1.5">
                <Zap size={13} className="text-amber-500"/>
                سعر الساعة الإضافية ({config.currency})
              </label>
              <input
                type="number"
                min="0"
                value={extraHourRate}
                onChange={e => setExtraHourRate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="text-xs text-gray-400 mt-1">يُحتسب لكل ساعة بعد آخر باقة مناسبة</p>
            </div>
            <div>
              <label className="text-sm font-medium text-navy-700 mb-1.5 flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500"/>
                دقائق السماح
              </label>
              <input
                type="number"
                min="0"
                value={graceMinutes}
                onChange={e => setGraceMinutes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="text-xs text-gray-400 mt-1">أول {graceMinutes || 0} دقيقة من ساعة جديدة لا تُحسب</p>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Eye size={18} className="text-purple-500"/>
            <h2 className="font-semibold text-navy">معاينة فورية</h2>
          </div>
          <div className="p-3 space-y-1.5">
            {previewSamples.map(s => {
              const { best } = calcBestPrice(s.minutes, livePricing);
              return (
                <div key={s.label} className="flex items-center justify-between bg-gray-50 hover:bg-indigo-50/40 transition-colors rounded-xl px-3 py-2.5">
                  <span className="text-sm text-navy font-medium">{s.label}</span>
                  <div className="text-left">
                    <span className="text-base font-bold text-teal-600">{best.amount.toLocaleString('en-US')}</span>
                    <span className="text-xs text-gray-400 mr-1">{config.currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800">
            تحديث فوري عند تعديل الباقات. اضغط <span className="font-semibold">حفظ</span> لتطبيق التغييرات.
          </div>
        </div>
      </div>

      {/* Special offers section (kept for backward compat) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-navy">العروض الخاصة</h2>
          <button onClick={openAddOffer} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"><Plus size={13}/><span>إضافة</span></button>
        </div>
        {offers.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">لا توجد عروض خاصة</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {offers.map(o => (
              <div key={o.id} className={`rounded-xl border p-3 ${o.active ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-navy text-sm">{o.label}</p>
                    <p className="text-base font-bold text-amber-600 mt-1">{o.price} {config.currency}</p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => setOffers(offers.map(x => x.id === o.id ? { ...x, active: !x.active } : x))} className="p-1 cursor-pointer text-gray-400 hover:text-teal-500 transition-colors">{o.active ? <CheckCircle size={13} className="text-teal-500"/> : <XCircle size={13}/>}</button>
                    <button onClick={() => openEditOffer(o)} className="p-1 cursor-pointer text-gray-400 hover:text-indigo-500 transition-colors"><Edit2 size={12}/></button>
                    <button onClick={() => setOffers(offers.filter(x => x.id !== o.id))} className="p-1 cursor-pointer text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tier modal */}
      <Modal open={showTier} onClose={() => setShowTier(false)} title={editingTier ? 'تعديل باقة' : 'إضافة باقة جديدة'} size="sm" footer={tierFooter}>
        <div className="space-y-4">
          <Input
            label="عدد الساعات"
            type="number"
            min="1"
            value={tierForm.hours}
            onChange={e => setTierForm({ ...tierForm, hours: e.target.value })}
            error={tierErrors.hours}
            placeholder="مثال: 3"
          />
          <Input
            label={`السعر (${config.currency})`}
            type="number"
            min="0"
            value={tierForm.price}
            onChange={e => setTierForm({ ...tierForm, price: e.target.value })}
            error={tierErrors.price}
            placeholder="مثال: 45"
          />
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
            <span className="font-semibold">معلومة:</span> الطالب سيدفع هذا السعر إذا جلس حتى {tierForm.hours || 'N'} ساعة. لو زاد، يُضاف {extraHourRate} {config.currency} لكل ساعة إضافية.
          </div>
        </div>
      </Modal>

      {/* Offer modal */}
      <Modal open={showOffer} onClose={() => setShowOffer(false)} title={editingOffer ? 'تعديل العرض' : 'إضافة عرض خاص'} size="sm" footer={offerFooter}>
        <div className="space-y-4">
          <Input label="اسم العرض" value={offerForm.label} onChange={e => setOfferForm({ ...offerForm, label: e.target.value })} placeholder="مثال: عرض الطالب" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`السعر (${config.currency})`} type="number" min="0" value={offerForm.price} onChange={e => setOfferForm({ ...offerForm, price: e.target.value })} />
            <Input label="المدة (دقيقة)" type="number" min="0" value={offerForm.durationMinutes} onChange={e => setOfferForm({ ...offerForm, durationMinutes: e.target.value })} placeholder="0 = غير محدد" />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelTier}
        onClose={() => setConfirmDelTier(null)}
        onConfirm={() => deleteTier(confirmDelTier?.id)}
        title="حذف الباقة"
        message={`هل أنت متأكد من حذف باقة ${confirmDelTier?.hours} ساعات؟`}
      />
    </div>
  );
}
