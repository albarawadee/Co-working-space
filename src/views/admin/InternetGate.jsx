import { useState } from 'react';
import { useStorage } from '../../hooks/useStorage';
import { STORAGE_KEYS, DEFAULT_GATEWAY_CONFIG } from '../../constants';
import { generateId } from '../../utils';
import { Globe, RefreshCw, WifiOff, Wifi, Settings, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminInternetGate({ user, toast }) {
  const [sessions] = useStorage(STORAGE_KEYS.SESSIONS, []);
  const [gatewayConfig, setGatewayConfig] = useStorage(STORAGE_KEYS.GATEWAY_CONFIG, DEFAULT_GATEWAY_CONFIG);
  const [logs, setLogs] = useStorage(STORAGE_KEYS.GATEWAY_LOGS, []);
  const [testing, setTesting] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');

  const activeSessions = sessions.filter(s => s.status === 'active');

  function updateConfig(field, value) {
    setGatewayConfig(prev => ({ ...prev, [field]: value }));
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

  function addLog(entry) {
    setLogs(prev => [entry, ...prev].slice(0, 500));
  }

  async function handleAction(session, action) {
    const path = action === 'disconnect' ? gatewayConfig.disconnectPath : gatewayConfig.reconnectPath;
    setLoadingId(session.id + action);
    const result = await callGateway(path, session.studentId || session.id, session.studentName);
    setLoadingId(null);

    const logEntry = {
      id: generateId(),
      action,
      studentId: session.studentId || session.id,
      studentName: session.studentName,
      staffId: user.id,
      staffName: user.name,
      createdAt: new Date().toISOString(),
      success: result.skipped ? true : result.ok,
      error: result.error || (result.ok === false && !result.skipped ? `HTTP ${result.status || 'error'}` : ''),
      skipped: !!result.skipped,
    };
    addLog(logEntry);

    if (result.skipped) {
      toast(`تم تسجيل الإجراء محلياً (البوابة غير مفعّلة)`, 'info');
    } else if (result.ok) {
      toast(`تم ${action === 'disconnect' ? 'قطع' : 'إعادة'} الاتصال بنجاح`, 'success');
    } else {
      toast(`فشل الاتصال بالبوابة: ${logEntry.error}`, 'error');
    }
  }

  async function handleRefresh(session) {
    setLoadingId(session.id + 'refresh');
    // disconnect then reconnect
    const dPath = gatewayConfig.disconnectPath;
    const rPath = gatewayConfig.reconnectPath;
    const sId = session.studentId || session.id;
    const sName = session.studentName;

    await callGateway(dPath, sId, sName);
    const result = await callGateway(rPath, sId, sName);
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
      toast(`فشل تحديث الاتصال: ${logEntry.error}`, 'error');
    }
  }

  async function handleTest() {
    if (!gatewayConfig.url) { toast('أدخل رابط البوابة أولاً', 'error'); return; }
    setTesting(true);
    const headers = {};
    if (gatewayConfig.authHeader) headers['Authorization'] = gatewayConfig.authHeader;
    try {
      const res = await fetch(gatewayConfig.url, { method: 'GET', headers });
      toast(res.ok ? 'البوابة تعمل بشكل صحيح ✓' : `البوابة أعادت: ${res.status}`, res.ok ? 'success' : 'error');
    } catch (e) {
      toast(`تعذر الوصول للبوابة: ${e.message}`, 'error');
    }
    setTesting(false);
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
          <p className="text-sm text-gray-500">إدارة وصول الطلاب للإنترنت</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${gatewayConfig.enabled ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gatewayConfig.enabled ? 'bg-teal-500' : 'bg-gray-400'}`} />
            {gatewayConfig.enabled ? 'البوابة مفعّلة' : 'البوابة معطّلة'}
          </span>
        </div>
      </div>

      {/* Gateway Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Settings className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">إعدادات البوابة</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-700">تفعيل البوابة</span>
            <button
              onClick={() => updateConfig('enabled', !gatewayConfig.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gatewayConfig.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${gatewayConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">رابط البوابة (URL)</label>
            <input
              type="text"
              value={gatewayConfig.url}
              onChange={e => updateConfig('url', e.target.value)}
              placeholder="http://192.168.1.1"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">طريقة الطلب (Method)</label>
            <select
              value={gatewayConfig.method}
              onChange={e => updateConfig('method', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مسار القطع (Disconnect Path)</label>
            <input
              type="text"
              value={gatewayConfig.disconnectPath}
              onChange={e => updateConfig('disconnectPath', e.target.value)}
              placeholder="/disconnect"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مسار إعادة الاتصال (Reconnect Path)</label>
            <input
              type="text"
              value={gatewayConfig.reconnectPath}
              onChange={e => updateConfig('reconnectPath', e.target.value)}
              placeholder="/reconnect"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              dir="ltr"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">رأس التوثيق (Authorization Header)</label>
            <input
              type="text"
              value={gatewayConfig.authHeader}
              onChange={e => updateConfig('authHeader', e.target.value)}
              placeholder="Bearer token123"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              dir="ltr"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60"
            >
              <Wifi className="w-4 h-4" />
              {testing ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'sessions', label: `الجلسات النشطة (${activeSessions.length})` },
          { key: 'logs', label: `سجل البوابة (${logs.length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {activeSessions.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">لا توجد جلسات نشطة</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الطالب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">النوع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">وقت الدخول</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeSessions.map(session => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-gray-900">{session.studentName}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{session.type === 'hourly' ? 'بالساعة' : session.type === 'halfDay' ? 'نصف يوم' : 'يوم كامل'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm" dir="ltr">{new Date(session.checkInTime).toLocaleTimeString('ar-EG')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRefresh(session)}
                          disabled={loadingId === session.id + 'refresh'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg disabled:opacity-60"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          تحديث
                        </button>
                        <button
                          onClick={() => handleAction(session, 'disconnect')}
                          disabled={loadingId === session.id + 'disconnect'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-60"
                        >
                          <WifiOff className="w-3.5 h-3.5" />
                          قطع
                        </button>
                        <button
                          onClick={() => handleAction(session, 'reconnect')}
                          disabled={loadingId === session.id + 'reconnect'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg disabled:opacity-60"
                        >
                          <Wifi className="w-3.5 h-3.5" />
                          إعادة اتصال
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Logs Table */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">لا توجد سجلات</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الوقت</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الطالب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الإجراء</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">الموظف</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3 text-gray-500 text-xs" dir="ltr">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 text-sm">{log.studentName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.action === 'refresh' ? 'bg-indigo-100 text-indigo-700' :
                        log.action === 'disconnect' ? 'bg-red-100 text-red-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {actionLabel[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{log.staffName}</td>
                    <td className="px-4 py-3 text-center">
                      {log.skipped ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3.5 h-3.5" /> محلي
                        </span>
                      ) : log.success ? (
                        <CheckCircle className="w-4 h-4 text-teal-500 mx-auto" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="w-3.5 h-3.5" /> {log.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
