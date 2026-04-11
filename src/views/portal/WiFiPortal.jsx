import { useState, useEffect } from 'react';
import { Wifi, CheckCircle, XCircle, AlertCircle, RotateCcw, Signal } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS } from '../../constants';

const PHASE = {
  IDLE:          'idle',
  SEARCHING:     'searching',
  GRANTED:       'granted',   // checked in → access OK
  DENIED_OUT:    'denied_out', // student exists but not checked in
  DENIED_MISS:   'denied_miss', // member number not found
};

const AUTO_RESET_SECS = 15;

export function WiFiPortal() {
  const [students] = useStorage(STORAGE_KEYS.STUDENTS, []);
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [config]   = useStorage(STORAGE_KEYS.CONFIG, {});

  const [input,  setInput]  = useState('');
  const [phase,  setPhase]  = useState(PHASE.IDLE);
  const [student, setStudent] = useState(null);
  const [countdown, setCountdown] = useState(AUTO_RESET_SECS);

  // Auto-reset countdown after result
  useEffect(() => {
    if (phase === PHASE.IDLE || phase === PHASE.SEARCHING) return;
    setCountdown(AUTO_RESET_SECS);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { reset(); return AUTO_RESET_SECS; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setPhase(PHASE.SEARCHING);

    setTimeout(() => {
      const found = (students || []).find(s =>
        (s.memberNumber && s.memberNumber.trim().toLowerCase() === q.toLowerCase()) ||
        (s.phone && s.phone.trim() === q) ||
        (s.studentId && s.studentId.trim().toLowerCase() === q.toLowerCase())
      );

      if (!found) {
        setStudent(null);
        setPhase(PHASE.DENIED_MISS);
        return;
      }

      const active = (sessions || []).find(s => s.studentId === found.id && s.status === 'active');
      setStudent(found);
      setPhase(active ? PHASE.GRANTED : PHASE.DENIED_OUT);
    }, 700);
  }

  function reset() {
    setInput('');
    setPhase(PHASE.IDLE);
    setStudent(null);
  }

  const wifiName     = config?.wifiName || 'Smart-Vision-WiFi';
  const libraryName  = config?.name     || 'Smart Vision';

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-teal/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-white/[0.015] blur-3xl" />
        {/* Animated wifi rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.03] animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/[0.05] animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      <div className="relative w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-3xl bg-teal/20 blur-xl" />
            <div className="relative w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Wifi size={34} className="text-teal" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{libraryName}</h1>
          <p className="text-white/40 text-sm mt-2 font-light">بوابة الإنترنت اللاسلكي</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Signal size={12} className="text-teal" />
            <span className="text-teal text-xs font-medium">{wifiName}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

          {/* ── IDLE: input form ── */}
          {phase === PHASE.IDLE && (
            <div className="p-7 space-y-5">
              <div className="text-center">
                <p className="text-white font-semibold text-lg">أدخل رقم العضوية</p>
                <p className="text-white/40 text-sm mt-1">للتحقق من صلاحية الوصول للإنترنت</p>
              </div>
              <div className="relative">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="رقم العضوية أو رقم الهاتف"
                  autoFocus
                  className="w-full px-5 py-4 rounded-2xl bg-white/8 border border-white/10 text-white placeholder:text-white/25 text-base outline-none focus:border-teal/50 focus:bg-white/10 transition-all duration-200 text-center tracking-widest font-mono"
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={!input.trim()}
                className="w-full py-4 bg-teal hover:bg-teal-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-2xl text-base transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                تحقق من الصلاحية
              </button>
            </div>
          )}

          {/* ── SEARCHING ── */}
          {phase === PHASE.SEARCHING && (
            <div className="p-7 flex flex-col items-center gap-4 py-14">
              <div className="w-14 h-14 border-4 border-white/10 border-t-teal rounded-full animate-spin" />
              <p className="text-white/60 text-sm">جاري التحقق…</p>
            </div>
          )}

          {/* ── GRANTED ── */}
          {phase === PHASE.GRANTED && (
            <div className="p-7 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-teal/20 blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-teal/10 border-2 border-teal/40 flex items-center justify-center">
                  <CheckCircle size={38} className="text-teal" />
                </div>
              </div>

              <div>
                <p className="text-white font-bold text-2xl">مرحباً بك!</p>
                <p className="text-teal font-semibold text-lg mt-1">{student?.name}</p>
                <p className="text-white/40 text-sm mt-1">تم التحقق من جلستك بنجاح</p>
              </div>

              <div className="bg-teal/10 border border-teal/20 rounded-2xl p-4 space-y-3">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wider">شبكة الإنترنت</p>
                <div className="flex items-center justify-center gap-2">
                  <Wifi size={18} className="text-teal" />
                  <span className="text-white font-bold text-xl tracking-wide">{wifiName}</span>
                </div>
                <p className="text-teal/80 text-xs">اتصل بالشبكة الآن من جهازك</p>
              </div>

              <ResetBar countdown={countdown} total={AUTO_RESET_SECS} onReset={reset} />
            </div>
          )}

          {/* ── DENIED: not checked in ── */}
          {phase === PHASE.DENIED_OUT && (
            <div className="p-7 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                  <AlertCircle size={38} className="text-amber-400" />
                </div>
              </div>

              <div>
                <p className="text-white font-bold text-xl">لا توجد جلسة نشطة</p>
                <p className="text-amber-400 font-medium mt-1">{student?.name}</p>
                <p className="text-white/40 text-sm mt-2 leading-relaxed">
                  أنت غير مسجّل حالياً في المكتبة.<br/>
                  يرجى التوجه إلى الكاشير لتسجيل الدخول أولاً.
                </p>
              </div>

              <ResetBar countdown={countdown} total={AUTO_RESET_SECS} onReset={reset} color="amber" />
            </div>
          )}

          {/* ── DENIED: not found ── */}
          {phase === PHASE.DENIED_MISS && (
            <div className="p-7 text-center space-y-5">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl" />
                <div className="relative w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                  <XCircle size={38} className="text-red-400" />
                </div>
              </div>

              <div>
                <p className="text-white font-bold text-xl">رقم غير مسجّل</p>
                <p className="text-white/40 text-sm mt-2 leading-relaxed">
                  لم يتم العثور على هذا الرقم في النظام.<br/>
                  تأكد من رقم العضوية أو تواصل مع الموظف.
                </p>
              </div>

              <ResetBar countdown={countdown} total={AUTO_RESET_SECS} onReset={reset} color="red" />
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-xs mt-8">
          {libraryName} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function ResetBar({ countdown, total, onReset, color = 'teal' }) {
  const pct = (countdown / total) * 100;
  const trackColor = color === 'teal' ? 'bg-teal/20' : color === 'amber' ? 'bg-amber-500/20' : 'bg-red-500/20';
  const fillColor  = color === 'teal' ? 'bg-teal'    : color === 'amber' ? 'bg-amber-400'    : 'bg-red-400';
  return (
    <div className="space-y-3">
      <div className={`h-1.5 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${fillColor} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-xs">إعادة تعيين خلال {countdown}ث</p>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs transition-colors cursor-pointer"
        >
          <RotateCcw size={12} />
          الآن
        </button>
      </div>
    </div>
  );
}
