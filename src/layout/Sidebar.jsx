import { LogOut, BookOpen } from 'lucide-react';
import { MENU } from '../constants';

export function Sidebar({ user, activeView, onNavigate, onLogout, config }) {
  const menuItems = MENU[user?.role] || [];

  return (
    <aside className="w-60 bg-navy flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
            <BookOpen size={17} className="text-gold" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{config?.name || 'Smart Vision'}</p>
            <p className="text-navy-300 text-xs truncate">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-right ${
                isActive
                  ? 'bg-indigo-500/15 text-indigo-300 border-r-2 border-indigo-400'
                  : 'text-navy-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-navy-400">دور: <span className="text-navy-300 font-medium">
            {user?.role === 'admin' ? 'مدير' : user?.role === 'cashier' ? 'كاشير' : 'مطبخ'}
          </span></p>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-navy-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 cursor-pointer"
        >
          <LogOut size={17} className="shrink-0" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
