import { useState } from 'react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_GATEWAY_CONFIG } from '../../constants';
import { generateId } from '../../utils';
import { Globe, RefreshCw, WifiOff, Wifi, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function CashierInternetGate({ user, toast }) {
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [gatewayConfig] = useStorage(STORAGE_KEYS.GATEWAY_CONFIG, DEFAULT_GATEWAY_CONFIG);
  const [logs, setLogs] = useStorage(STORAGE_KEYS.GATEWAY_LOGS, []);
  const [search, setSearch] = useState('');
  const [loadingId, setLoadingId] = useState(null);

  const activeSessions = sessions.filter(s => s.status === 'active');

  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => l.staffId === user.id && new Date(l.createdAt).toDateString() === todayStr);

  const filtered = search.trim()
    ? activeSessions.filter(s =>
        s.studentName?.includes(search) ||
        s.studentId?.includes(search) ||
        s.studentPhone?.includes(search)
      )
    : activeSessions;

  function addLog(entry) {
    setLogs(prev => [entry, ...prev].slice(0, 500));
  }

  async function callGateway(path, studentId, studentName) {
    if (!gatewayConfig.enabled || !gatewayConfig.url) return { ok: false, skipped: true };
    const headers = { 'Content-Type': 'application/json' };
    if (gatewayConfig.authHeader) headers['Authorization'] = gatewayConfig.authHeader;
    try {
      const res = await fetch(gatewayConfig.url + path, {
        method: gatewayConfig.method || 'POST',
        headers,
        body: JSON.stringify({ studentId, studentName }),
      });
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function handleRefresh(session) {
    const key = session.id + 'refresh';
    setLoadingId(key);
    const sId = session.studentId || session.id;
    const sName = session.studentName;

    await callGateway(gatewayConfig.disconnectPath, sId, sName);
    const result = await callGateway(gatewayConfig.reconnectPath, sId, sName);
    setLoadingId(null);

    const logEntry = {
      id: generateId(),
      action: 'refresh',
      studentId: sId,
      studentName: sName,
      staffId: user.id,
      staffName: user.name,
      createdAt: new Date().toISOString(),
      success: result.skipped ? true : result.ok,
      error: result.error || (result.ok === false && !result.skipped ? `HTTP ${result.status || 'error'}` : ''),
      skipped: !!result.skipped,
    };
    addLog(logEntry);

    if (result.skipped) {
      toast(`تم تسجيل التحديث محلياً (البوابة غير مفعّلة)`, 'info');
    } else if (result.ok) {
      toast(`تم تحديث الاتصال بنجاح لـ ${sName}`, 'success');
    } else {
      toast(`فشل التحديث: ${logEntry.error}`, 'error');
    }
  }

  async function handleDisconnect(session) {
    const key = session.id + 'disconnect';
    setLoadingId(key);
    const sId = session.studentId || session.id;
    const sName = session.studentName;
    const result = await callGateway(gatewayConfig.disconnectPath, sId, sName);
    setLoadingId(null);

    const logEntry = {
      id: generateId(),
      action: 'disconnect',
      studentId: sId,
      studentName: sName,
      staffId: user.id,
      staffName: user.name,
      createdAt: new Date().toISOString(),
      success: result.skipped ? true : result.ok,
      error: result.error || (result.ok === false && !result.skipped ? `HTTP ${result.status || 'error'}` : ''),
      skipped: !!result.skipped,
    };
    addLog(logEntry);

    if (result.skipped) {
      toast(`تم تسجيل الإجراء محلياً`, 'info');
    } else if (result.ok) {
      toast(`تم قطع الاتصال عن ${sName}`, 'success');
    } else {
      toast(`فشل قطع الاتصال: ${logEntry.error}`, 'error');
    }
  }

  const actionLabel = { refresh: 'تحديث', disconnect: 'قطع', reconnect: 'إعادة اتصال' };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <Globe className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">بوابة الإنترنت</h1>
          <p className="text-sm text-gray-500">تحديث وصول الطلاب للإنترنت</p>
        </div>
        <div className="mr-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${gatewayConfig.enabled ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gatewayConfig.enabled ? 'bg-teal-500' : 'bg-gray-400'}`} />
            {gatewayConfig.enabled ? 'البوابة مفعّلة' : 'البوابة معطّلة'}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الطالب أو الهاتف..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">الجلسات النشطة</h2>
          <span className="text-xs text-gray-400">{filtered.length} جلسة</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {search ? 'لا توجد نتائج' : 'لا توجد جلسات نشطة'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(session => (
              <div key={session.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{session.studentName}</p>
                  <p className="text-xs text-gray-400" dir="ltr">
                    {new Date(session.checkInTime).toLocaleTimeString('ar-EG')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRefresh(session)}
                    disabled={!!loadingId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingId === session.id + 'refresh' ? 'animate-spin' : ''}`} />
                    تحديث الإنترنت
                  </button>
                  <button
                    onClick={() => handleDisconnect(session)}
                    disabled={!!loadingId}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded-lg disabled:opacity-60"
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                    قطع
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">سجل اليوم</h2>
        </div>
        {todayLogs.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">لا توجد إجراءات اليوم</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الوقت</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الطالب</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الإجراء</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {todayLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-2.5 text-gray-500 text-xs" dir="ltr">
                    {new Date(log.createdAt).toLocaleTimeString('ar-EG')}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 text-sm">{log.studentName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.action === 'refresh' ? 'bg-indigo-100 text-indigo-700' :
                      log.action === 'disconnect' ? 'bg-red-100 text-red-700' :
                      'bg-teal-100 text-teal-700'
                    }`}>
                      {actionLabel[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {log.skipped ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" /> محلي
                      </span>
                    ) : log.success ? (
                      <CheckCircle className="w-4 h-4 text-teal-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
