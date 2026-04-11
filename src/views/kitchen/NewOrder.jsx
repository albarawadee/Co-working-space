import { useState } from 'react';
import { ShoppingCart, Plus, Minus, X, ChefHat } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { generateId, logActivity } from '../../utils';

export function KitchenNewOrder({ user, toast }) {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [products] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [, saveOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);
  const [orders, refreshOrders] = useStorage(STORAGE_KEYS.KITCHEN_ORDERS, []);

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const activeStudentIds = activeSessions.map(s => s.studentId);
  const checkedInStudents = students.filter(s => activeStudentIds.includes(s.id));

  const availableProducts = products.filter(p => p.available !== false);
  const filteredProducts = activeCategory === 'all'
    ? availableProducts
    : availableProducts.filter(p => p.categoryId === activeCategory);

  const cartItems = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => {
      const product = products.find(p => p.id === productId);
      return { product, qty, total: product.price * qty };
    });

  const cartTotal = cartItems.reduce((sum, i) => sum + i.total, 0);
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0);

  function adjustQty(productId, delta) {
    setCart(prev => {
      const next = { ...prev };
      next[productId] = Math.max(0, (next[productId] || 0) + delta);
      if (next[productId] === 0) delete next[productId];
      return next;
    });
  }

  function handleSubmit() {
    if (!selectedStudentId) return toast('اختر الطالب أولاً', 'error');
    if (cartItems.length === 0) return toast('أضف منتجاً للطلب', 'error');
    setSubmitting(true);

    const student = students.find(s => s.id === selectedStudentId);
    const activeSession = activeSessions.find(s => s.studentId === selectedStudentId);
    const newOrder = {
      id: generateId('ORD'),
      sessionId: activeSession?.id || null,
      studentId: selectedStudentId,
      studentName: student?.name || '',
      items: cartItems.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        qty: i.qty,
        unitPrice: i.product.price,
        total: i.total,
      })),
      total: cartTotal,
      note: note.trim(),
      status: 'new',
      createdAt: new Date().toISOString(),
      staffId: user?.id,
    };

    const current = orders || [];
    saveOrders([newOrder, ...current]);
    logActivity('kitchen_order', `طلب جديد لـ ${student?.name} - ${cartTotal} ج.م`, user?.id);
    toast('تم إضافة الطلب بنجاح', 'success');
    setCart({});
    setNote('');
    setSelectedStudentId('');
    setSubmitting(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
          <ChefHat size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">طلب جديد</h1>
          <p className="text-sm text-navy-400">أنشئ طلب مطبخ لطالب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Student Select */}
          <div className="bg-white rounded-2xl border border-cream-200 p-4">
            <label className="block text-sm font-semibold text-navy mb-2">اختر الطالب</label>
            {checkedInStudents.length === 0 ? (
              <p className="text-sm text-navy-400 py-2">لا يوجد طلاب حالياً في المكتبة</p>
            ) : (
              <select
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-cream-300 bg-white text-sm text-navy focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition-all duration-200 cursor-pointer"
              >
                <option value="">-- اختر طالب --</option>
                {checkedInStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                ))}
              </select>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${activeCategory === 'all' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal hover:text-teal'}`}
            >
              الكل
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${activeCategory === cat.id ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal hover:text-teal'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full text-center py-10 text-navy-400 text-sm">لا توجد منتجات متاحة</div>
            ) : filteredProducts.map(product => {
              const qty = cart[product.id] || 0;
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-2xl border p-3 transition-all duration-200 ${qty > 0 ? 'border-teal ring-1 ring-teal/20' : 'border-cream-200 hover:border-cream-300'}`}
                >
                  <div className="text-center mb-2">
                    <p className="font-semibold text-navy text-sm truncate">{product.name}</p>
                    <p className="text-teal font-bold text-sm">{product.price} ج.م</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {qty === 0 ? (
                      <button
                        onClick={() => adjustQty(product.id, 1)}
                        className="w-full py-1.5 bg-teal/10 text-teal rounded-lg text-xs font-medium hover:bg-teal hover:text-white transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> إضافة
                      </button>
                    ) : (
                      <>
                        <button onClick={() => adjustQty(product.id, -1)} className="w-7 h-7 rounded-lg bg-cream-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-navy transition-all duration-200 cursor-pointer">
                          <Minus size={13} />
                        </button>
                        <span className="font-bold text-navy w-5 text-center">{qty}</span>
                        <button onClick={() => adjustQty(product.id, 1)} className="w-7 h-7 rounded-lg bg-teal/10 hover:bg-teal hover:text-white flex items-center justify-center text-teal transition-all duration-200 cursor-pointer">
                          <Plus size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-200 p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy flex items-center gap-2">
                <ShoppingCart size={16} className="text-teal" />
                سلة الطلب
              </h3>
              {cartCount > 0 && (
                <span className="bg-teal text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-8 text-navy-300">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">لم تضف أي منتجات</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                {cartItems.map(({ product, qty, total }) => (
                  <div key={product.id} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{product.name}</p>
                      <p className="text-xs text-navy-400">{product.price} × {qty}</p>
                    </div>
                    <div className="flex items-center gap-2 mr-2">
                      <span className="text-sm font-bold text-teal">{total}</span>
                      <button onClick={() => setCart(prev => { const n = {...prev}; delete n[product.id]; return n; })} className="text-navy-300 hover:text-red-500 transition-colors duration-200 cursor-pointer">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ملاحظات (اختياري)..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-cream-300 text-sm text-navy placeholder:text-navy-300 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none resize-none transition-all duration-200 mb-3"
            />

            <div className="border-t border-cream-200 pt-3 mb-3">
              <div className="flex justify-between text-sm font-bold text-navy">
                <span>الإجمالي</span>
                <span className="text-teal">{cartTotal} ج.م</span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || cartItems.length === 0 || !selectedStudentId}
              className="w-full py-3 bg-teal text-white rounded-xl font-semibold text-sm hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
            >
              {submitting ? 'جاري الإرسال...' : 'تأكيد الطلب'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
