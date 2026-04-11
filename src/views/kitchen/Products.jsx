import { useState } from 'react';
import { Package, Eye, EyeOff } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';
import { Badge } from '../../components/ui';

export function KitchenProducts({ user, toast }) {
  const [products, saveProducts] = useStorage(STORAGE_KEYS.PRODUCTS, []);
  const [categories] = useStorage(STORAGE_KEYS.CATEGORIES, []);
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.categoryId === activeCategory);

  function toggleAvailability(productId) {
    const updated = products.map(p =>
      p.id === productId ? { ...p, available: p.available === false ? true : false } : p
    );
    saveProducts(updated);
    const p = products.find(p => p.id === productId);
    toast(`"${p?.name}" ${p?.available === false ? 'متاح الآن' : 'غير متاح الآن'}`, 'success');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center">
          <Package size={20} className="text-teal" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">قائمة المنتجات</h1>
          <p className="text-sm text-navy-400">عرض وتحديث توفر المنتجات</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${activeCategory === 'all' ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal hover:text-teal'}`}
        >
          الكل ({products.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${activeCategory === cat.id ? 'bg-teal text-white' : 'bg-white border border-cream-200 text-navy-600 hover:border-teal hover:text-teal'}`}
          >
            {cat.name} ({products.filter(p => p.categoryId === cat.id).length})
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-navy-400">
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد منتجات</p>
          </div>
        ) : filtered.map(product => {
          const isAvailable = product.available !== false;
          const cat = categories.find(c => c.id === product.categoryId);
          return (
            <div
              key={product.id}
              className={`bg-white rounded-2xl border p-4 transition-all duration-200 ${isAvailable ? 'border-cream-200' : 'border-red-100 opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-navy truncate">{product.name}</p>
                  {cat && <p className="text-xs text-navy-400 mt-0.5">{cat.name}</p>}
                </div>
                <Badge variant={isAvailable ? 'teal' : 'red'}>
                  {isAvailable ? 'متاح' : 'غير متاح'}
                </Badge>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div>
                  <p className="text-lg font-bold text-teal">{product.price} ج.م</p>
                  {product.cost && (
                    <p className="text-xs text-navy-400">التكلفة: {product.cost} ج.م</p>
                  )}
                </div>
                <button
                  onClick={() => toggleAvailability(product.id)}
                  title={isAvailable ? 'إخفاء المنتج' : 'إظهار المنتج'}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${isAvailable ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-teal/10 text-teal hover:bg-teal/20'}`}
                >
                  {isAvailable ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
