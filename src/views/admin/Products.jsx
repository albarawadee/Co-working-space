import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity } from '../../utils';
import { Modal, Input, Select, Badge, ConfirmDialog } from '../../components/ui';

export default function AdminProducts({ user, config, toast }) {
  const [categories, saveCategories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [products, saveProducts]     = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [selectedCat, setSelectedCat]   = useState(null);
  const [showCatForm, setShowCatForm]   = useState(false);
  const [showProdForm, setShowProdForm] = useState(false);
  const [editingCat, setEditingCat]     = useState(null);
  const [editingProd, setEditingProd]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [catForm, setCatForm]   = useState({ name:'', emoji:'📦' });
  const [prodForm, setProdForm] = useState({ name:'', categoryId:'', price:'', costPrice:'' });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => selectedCat ? products.filter(p=>p.categoryId===selectedCat) : products, [products, selectedCat]);

  const openAddCat  = () => { setEditingCat(null); setCatForm({name:'',emoji:'📦'}); setShowCatForm(true); };
  const openEditCat = (c) => { setEditingCat(c); setCatForm({name:c.name,emoji:c.emoji}); setShowCatForm(true); };
  const saveCat = () => {
    if (!catForm.name.trim()) return;
    if (editingCat) saveCategories(categories.map(c=>c.id===editingCat.id?{...c,...catForm}:c));
    else saveCategories([...categories, {id:generateId('cat'),...catForm}]);
    toast(editingCat?'تم تعديل الفئة':'تمت إضافة الفئة','success');
    setShowCatForm(false);
  };
  const deleteCat = (c) => { saveCategories(categories.filter(x=>x.id!==c.id)); saveProducts(products.filter(p=>p.categoryId!==c.id)); if(selectedCat===c.id)setSelectedCat(null); toast('تم حذف الفئة','info'); };

  const openAddProd  = () => { setEditingProd(null); setProdForm({name:'',categoryId:selectedCat||(categories[0]?.id||''),price:'',costPrice:''}); setErrors({}); setShowProdForm(true); };
  const openEditProd = (p) => { setEditingProd(p); setProdForm({name:p.name,categoryId:p.categoryId,price:p.price,costPrice:p.costPrice||''}); setErrors({}); setShowProdForm(true); };
  const saveProd = () => {
    const e={};
    if (!prodForm.name.trim()) e.name='الاسم مطلوب';
    if (!prodForm.price) e.price='السعر مطلوب';
    setErrors(e); if(Object.keys(e).length) return;
    const data = {...prodForm, price:Number(prodForm.price), costPrice:Number(prodForm.costPrice)||0};
    if (editingProd) saveProducts(products.map(p=>p.id===editingProd.id?{...p,...data}:p));
    else saveProducts([...products, {id:generateId('prod'),...data, available:true}]);
    toast(editingProd?'تم تعديل المنتج':'تمت إضافة المنتج','success');
    setShowProdForm(false);
  };
  const deleteProd = (p) => { saveProducts(products.filter(x=>x.id!==p.id)); toast('تم حذف المنتج','info'); };
  const toggleAvail = (p) => saveProducts(products.map(x=>x.id===p.id?{...x,available:!x.available}:x));

  const stdFooter = (cb) => (
    <div className="flex gap-3 justify-end">
      <button onClick={cb} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button>
      <button onClick={editingCat||editingProd?()=>editingCat?saveCat():saveProd():editingProd?saveProd:saveCat} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button>
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <h1 className="text-2xl font-bold text-navy">إدارة المنتجات</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Categories */}
        <div className="bg-white rounded-2xl shadow-sm border border-cream-200 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-cream-100">
            <h2 className="font-semibold text-navy text-sm">الفئات</h2>
            <button onClick={openAddCat} className="p-1.5 rounded-lg bg-navy hover:bg-navy-600 text-white transition-colors duration-200 cursor-pointer"><Plus size={13}/></button>
          </div>
          <div className="flex flex-col p-2 gap-1">
            <button onClick={()=>setSelectedCat(null)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer ${!selectedCat?'bg-navy text-white':'hover:bg-cream-100 text-navy-600'}`}>
              <Package size={14}/><span>الكل ({products.length})</span>
            </button>
            {categories.map(c=>(
              <div key={c.id} onClick={()=>setSelectedCat(c.id)} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-200 cursor-pointer ${selectedCat===c.id?'bg-navy text-white':'hover:bg-cream-100 text-navy-600'}`}>
                <div className="flex items-center gap-2"><span className="text-sm">{c.emoji}</span><span className="text-sm font-medium">{c.name}</span><span className="text-xs opacity-60">({products.filter(p=>p.categoryId===c.id).length})</span></div>
                <div className="flex gap-1">
                  <button onClick={e=>{e.stopPropagation();openEditCat(c);}} className="p-0.5 rounded hover:bg-white/20 cursor-pointer"><Edit2 size={11}/></button>
                  <button onClick={e=>{e.stopPropagation();setConfirmDelete({type:'cat',item:c});}} className="p-0.5 rounded hover:bg-white/20 cursor-pointer"><Trash2 size={11}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-cream-200">
          <div className="flex items-center justify-between p-4 border-b border-cream-100">
            <h2 className="font-semibold text-navy text-sm">{selectedCat?categories.find(c=>c.id===selectedCat)?.name:'جميع المنتجات'} <span className="text-navy-400 font-normal">({filtered.length})</span></h2>
            <button onClick={openAddProd} disabled={categories.length===0} className="bg-navy hover:bg-navy-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"><Plus size={13}/><span>إضافة</span></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-cream-50 text-navy-500 text-xs">
                <th className="px-4 py-2.5 text-right font-semibold">المنتج</th>
                <th className="px-4 py-2.5 text-right font-semibold">السعر</th>
                <th className="px-4 py-2.5 text-right font-semibold">التكلفة</th>
                <th className="px-4 py-2.5 text-right font-semibold">الحالة</th>
                <th className="px-4 py-2.5 text-right font-semibold">إجراءات</th>
              </tr></thead>
              <tbody>
                {filtered.length===0 ? (<tr><td colSpan={5} className="py-10 text-center text-navy-400 text-sm">لا توجد منتجات</td></tr>) :
                  filtered.map(p=>{
                    const cat=categories.find(c=>c.id===p.categoryId);
                    return (
                      <tr key={p.id} className="border-b border-cream-100 hover:bg-cream-50 transition-colors duration-150">
                        <td className="px-4 py-3"><p className="font-medium text-navy">{p.name}</p>{cat&&<p className="text-xs text-navy-400">{cat.emoji} {cat.name}</p>}</td>
                        <td className="px-4 py-3 font-semibold text-navy">{p.price} {config.currency}</td>
                        <td className="px-4 py-3 text-navy-400">{p.costPrice?`${p.costPrice} ${config.currency}`:'—'}</td>
                        <td className="px-4 py-3"><button onClick={()=>toggleAvail(p)} className="cursor-pointer"><Badge variant={p.available?'green':'red'}>{p.available?'متاح':'معطل'}</Badge></button></td>
                        <td className="px-4 py-3"><div className="flex items-center gap-1">
                          <button onClick={()=>openEditProd(p)} className="p-1.5 rounded-lg hover:bg-cream-100 text-navy-400 hover:text-gold transition-colors duration-200 cursor-pointer"><Edit2 size={13}/></button>
                          <button onClick={()=>setConfirmDelete({type:'prod',item:p})} className="p-1.5 rounded-lg hover:bg-red-50 text-navy-400 hover:text-red-500 transition-colors duration-200 cursor-pointer"><Trash2 size={13}/></button>
                        </div></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showCatForm} onClose={()=>setShowCatForm(false)} title={editingCat?'تعديل الفئة':'إضافة فئة'} size="sm"
        footer={<div className="flex gap-3 justify-end"><button onClick={()=>setShowCatForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={saveCat} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-3">
          <Input label="اسم الفئة" value={catForm.name} onChange={e=>setCatForm({...catForm,name:e.target.value})} placeholder="اسم الفئة" />
          <Input label="الإيموجي" value={catForm.emoji} onChange={e=>setCatForm({...catForm,emoji:e.target.value})} placeholder="☕" />
        </div>
      </Modal>

      <Modal open={showProdForm} onClose={()=>setShowProdForm(false)} title={editingProd?'تعديل المنتج':'إضافة منتج'}
        footer={<div className="flex gap-3 justify-end"><button onClick={()=>setShowProdForm(false)} className="px-4 py-2 rounded-xl border border-cream-300 text-navy text-sm cursor-pointer hover:bg-cream-100 transition-colors duration-200">إلغاء</button><button onClick={saveProd} className="bg-navy text-white px-4 py-2 rounded-xl text-sm cursor-pointer hover:bg-navy-600 transition-colors duration-200">حفظ</button></div>}>
        <div className="space-y-4">
          <Input label="اسم المنتج *" value={prodForm.name} onChange={e=>setProdForm({...prodForm,name:e.target.value})} error={errors.name} placeholder="اسم المنتج" />
          <Select label="الفئة" value={prodForm.categoryId} onChange={e=>setProdForm({...prodForm,categoryId:e.target.value})}>
            {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={`سعر البيع (${config.currency}) *`} type="number" min="0" value={prodForm.price} onChange={e=>setProdForm({...prodForm,price:e.target.value})} error={errors.price} />
            <Input label={`سعر التكلفة (${config.currency})`} type="number" min="0" value={prodForm.costPrice} onChange={e=>setProdForm({...prodForm,costPrice:e.target.value})} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={()=>setConfirmDelete(null)}
        onConfirm={()=>confirmDelete?.type==='cat'?deleteCat(confirmDelete.item):deleteProd(confirmDelete.item)}
        title="تأكيد الحذف" message={`هل أنت متأكد من حذف "${confirmDelete?.item?.name}"؟`} />
    </div>
  );
}
