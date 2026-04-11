import { useState } from 'react';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { useStorage } from '../hooks/useStorage';
import { STORAGE_KEYS } from '../constants';

export function LoginScreen({ onLogin }) {
  const [staff, , , staffLoading] = useStorage(STORAGE_KEYS.STAFF, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) {
      triggerError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const member = (staff || []).find(
        s => s.username === username && s.password === password && s.active !== false
      );
      if (member) {
        setError('');
        onLogin(member);
      } else {
        triggerError('بيانات الدخول غير صحيحة');
      }
      setLoading(false);
    }, 400);
  }

  function triggerError(msg) {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/2 blur-3xl" />
      </div>

      <div className={`relative w-full max-w-sm ${shaking ? 'shake' : ''}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-white">Smart Vision</h1>
          <p className="text-navy-300 text-sm mt-1">نظام إدارة مكتبة الدراسة</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">اسم المستخدم</label>
              <input
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-navy-500 text-sm outline-none focus:border-gold/50 focus:bg-white/15 transition-all duration-200"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-navy-500 text-sm outline-none focus:border-gold/50 focus:bg-white/15 transition-all duration-200 pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white transition-colors duration-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || staffLoading}
              className="w-full py-3.5 bg-gold text-navy font-bold rounded-2xl hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer text-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
                  جاري الدخول...
                </span>
              ) : 'دخول'}
            </button>
          </form>

        </div>

        <p className="text-center text-navy-500 text-xs mt-6">Smart Vision © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
