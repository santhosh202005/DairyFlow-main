import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCheck, ChevronLeft, ChevronRight, Save, CheckCircle2,
  XCircle, Users, TrendingUp, AlertCircle, Loader2, Sun, Moon
} from 'lucide-react';
import { Worker, WorkerAttendance } from '../types';
import { useTranslation } from '../i18n';

interface WorkerAttendanceProps {
  vendorId?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type ShiftType = 'AM' | 'PM';
// AttendanceMap: { workerId: { "YYYY-MM-DD_AM": "present"|"absent", "YYYY-MM-DD_PM": ... } }
type AttendanceMap = Record<string, Record<string, 'present' | 'absent'>>;

function makeKey(date: string, shift: ShiftType) {
  return `${date}_${shift}`;
}

export default function WorkerAttendancePage({ vendorId }: WorkerAttendanceProps) {
  const { t, lang } = useTranslation();
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDate(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const [selectedShift, setSelectedShift] = useState<ShiftType>('AM');

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('dairy_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchData = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const [workersRes, attendanceRes] = await Promise.all([
        fetch(`/api/workers?vendorId=${vendorId}`, { headers: getAuthHeaders() }),
        fetch(`/api/worker-attendance?vendorId=${vendorId}&month=${monthStr}`, { headers: getAuthHeaders() }),
      ]);
      const workersData: Worker[] = workersRes.ok ? await workersRes.json() : [];
      const attendanceData: (WorkerAttendance & { shift?: string })[] = attendanceRes.ok ? await attendanceRes.json() : [];

      setWorkers(workersData);

      const map: AttendanceMap = {};
      for (const w of workersData) {
        map[w.id] = {};
      }
      for (const rec of attendanceData) {
        if (!map[rec.worker_id]) map[rec.worker_id] = {};
        const shift = rec.shift || 'full';
        const status = rec.status as 'present' | 'absent';
        if (shift === 'full') {
          // Legacy full-day entries → map to both AM and PM
          map[rec.worker_id][makeKey(rec.date, 'AM')] = status;
          map[rec.worker_id][makeKey(rec.date, 'PM')] = status;
        } else {
          map[rec.worker_id][makeKey(rec.date, shift as ShiftType)] = status;
        }
      }
      setAttendanceMap(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [vendorId, monthStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleAttendance = (workerId: string, date: string, shift: ShiftType) => {
    const key = makeKey(date, shift);
    setAttendanceMap(prev => {
      const workerMap = { ...(prev[workerId] || {}) };
      const current = workerMap[key];
      workerMap[key] = (!current || current === 'absent') ? 'present' : 'absent';
      return { ...prev, [workerId]: workerMap };
    });
  };

  const markAllForDate = (date: string, shift: ShiftType, status: 'present' | 'absent') => {
    const key = makeKey(date, shift);
    setAttendanceMap(prev => {
      const updated = { ...prev };
      for (const worker of workers) {
        updated[worker.id] = { ...(updated[worker.id] || {}), [key]: status };
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!vendorId) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const records: { worker_id: string; date: string; status: string; shift: string }[] = [];
      for (const [workerId, dateShiftMap] of Object.entries(attendanceMap)) {
        for (const [dateShiftKey, status] of Object.entries(dateShiftMap)) {
          const [date, shift] = dateShiftKey.split('_');
          records.push({ worker_id: workerId, date, status, shift });
        }
      }
      const res = await fetch('/api/worker-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(records),
      });
      if (res.ok) {
        setSavedMsg(t('attendanceSavedSuccessfully'));
        setTimeout(() => setSavedMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const monthName = new Date(year, month, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const getWorkerSummary = (workerId: string) => {
    const dateShiftMap = attendanceMap[workerId] || {};
    let amPresent = 0, amAbsent = 0, pmPresent = 0, pmAbsent = 0;
    for (const [key, status] of Object.entries(dateShiftMap)) {
      const shift = key.split('_')[1];
      if (shift === 'AM') {
        if (status === 'present') amPresent++;
        else amAbsent++;
      } else if (shift === 'PM') {
        if (status === 'present') pmPresent++;
        else pmAbsent++;
      }
    }
    const totalPresent = amPresent + pmPresent;
    const totalAbsent = amAbsent + pmAbsent;
    const totalSessions = daysInMonth * 2;
    return { amPresent, amAbsent, pmPresent, pmAbsent, totalPresent, totalAbsent, totalSessions };
  };

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dateShiftStatus = (workerId: string, date: string, shift: ShiftType): 'present' | 'absent' | 'none' => {
    return attendanceMap[workerId]?.[makeKey(date, shift)] || 'none';
  };

  // Day indicator: check if AM/PM are marked for any worker
  const getDayIndicator = (date: string) => {
    let hasAM = false, hasPM = false;
    for (const worker of workers) {
      const amKey = makeKey(date, 'AM');
      const pmKey = makeKey(date, 'PM');
      if (attendanceMap[worker.id]?.[amKey]) hasAM = true;
      if (attendanceMap[worker.id]?.[pmKey]) hasPM = true;
    }
    if (hasAM && hasPM) return 'both';
    if (hasAM || hasPM) return 'partial';
    return 'none';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck size={26} className="text-emerald-600" />
            {t('attendance')}
          </h2>
          <p className="text-sm text-slate-500 font-medium">{t('markDailyAttendanceSub')}</p>
        </div>

        {/* Month Nav */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-soft">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="font-bold text-slate-800 text-sm min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {savedMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold flex items-center gap-2"
        >
          <CheckCircle2 size={16} /> {savedMsg}
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Users size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">{t('noWorkersFound')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('addWorkersFirst')}</p>
        </div>
      ) : (
        <>
          {/* Date Selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">{t('selectDateToMarkAttendance')}</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {days.map(day => {
                const date = formatDate(year, month, day);
                const isToday = date === formatDate(now.getFullYear(), now.getMonth(), now.getDate());
                const isSelected = date === selectedDate;
                const indicator = getDayIndicator(date);
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`relative w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300'
                        : indicator !== 'none'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                    {/* Shift indicator dot */}
                    {indicator !== 'none' && !isSelected && (
                      <span className={`absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                        indicator === 'both' ? 'bg-emerald-500' : 'bg-amber-400'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AM / PM Shift Selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('selectShift')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedShift('AM')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  selectedShift === 'AM'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <Sun size={16} />
                {t('amShift')}
              </button>
              <button
                onClick={() => setSelectedShift('PM')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  selectedShift === 'PM'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                <Moon size={16} />
                {t('pmShift')}
              </button>
            </div>
          </div>

          {/* Attendance for Selected Date + Shift */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                    selectedShift === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {selectedShift === 'AM' ? t('amShift') : t('pmShift')}
                  </span>
                  <p className="text-xs text-slate-400 font-medium">{t('clickTogglesToMarkAttendance')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => markAllForDate(selectedDate, selectedShift, 'present')}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 size={12} /> {t('allPresent')}
                </button>
                <button
                  onClick={() => markAllForDate(selectedDate, selectedShift, 'absent')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1"
                >
                  <XCircle size={12} /> {t('allAbsent')}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {workers.map((worker, idx) => {
                const status = dateShiftStatus(worker.id, selectedDate, selectedShift);
                return (
                  <motion.div
                    key={worker.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{worker.name}</p>
                        <p className="text-[10px] text-slate-400">{worker.phone || '@' + worker.username}</p>
                      </div>
                    </div>

                    {/* Toggle */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${
                        status === 'present' ? 'text-emerald-600' : status === 'absent' ? 'text-rose-500' : 'text-slate-400'
                      }`}>
                        {status === 'present' ? t('present') : status === 'absent' ? t('absent') : t('notMarked')}
                      </span>
                      <button
                        onClick={() => toggleAttendance(worker.id, selectedDate, selectedShift)}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 focus:outline-none ${
                          status === 'present' ? 'bg-emerald-500' : status === 'absent' ? 'bg-rose-400' : 'bg-slate-200'
                        }`}
                      >
                        <motion.div
                          animate={{
                            x: status === 'present' ? 32 : status === 'absent' ? 0 : 4,
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`absolute top-1 w-6 h-6 rounded-full shadow-md flex items-center justify-center ${
                            status === 'present' ? 'bg-white' : status === 'absent' ? 'bg-white left-1' : 'bg-white left-0'
                          }`}
                        >
                          {status === 'present' ? (
                            <CheckCircle2 size={12} className="text-emerald-500" />
                          ) : status === 'absent' ? (
                            <XCircle size={12} className="text-rose-400" />
                          ) : null}
                        </motion.div>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? t('saving') : t('saveAttendance')}
              </button>
            </div>
          </div>

          {/* Monthly Summary Cards */}
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              {t('monthlySummary')} — {monthName}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map((worker, idx) => {
                const { amPresent, pmPresent, totalPresent, totalAbsent, totalSessions } = getWorkerSummary(worker.id);
                const attendancePct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;
                return (
                  <motion.div
                    key={worker.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white text-sm">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{worker.name}</p>
                          <p className="text-slate-400 text-[10px] font-medium">{monthName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-amber-50 rounded-xl p-2.5">
                          <p className="text-lg font-black text-amber-600">{amPresent}</p>
                          <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wide flex items-center justify-center gap-1">
                            <Sun size={9} /> {t('amShift')}
                          </p>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-2.5">
                          <p className="text-lg font-black text-indigo-600">{pmPresent}</p>
                          <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide flex items-center justify-center gap-1">
                            <Moon size={9} /> {t('pmShift')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 rounded-xl p-2">
                          <p className="text-sm font-black text-slate-700">{totalSessions}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{lang === 'ta' ? 'மொத்த நேரங்கள்' : 'Total Sessions'}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-2">
                          <p className="text-sm font-black text-emerald-600">{totalPresent}</p>
                          <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide">{t('present')}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-2">
                          <p className="text-sm font-black text-rose-500">{totalAbsent}</p>
                          <p className="text-[8px] font-bold text-rose-300 uppercase tracking-wide">{t('absent')}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                          <span>{t('attendanceRate')}</span>
                          <span className={attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-amber-500' : 'text-rose-500'}>
                            {attendancePct}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${attendancePct}%` }}
                            transition={{ delay: idx * 0.05 + 0.2, duration: 0.6 }}
                            className={`h-full rounded-full ${
                              attendancePct >= 80 ? 'bg-emerald-500' : attendancePct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                          />
                        </div>
                      </div>

                      {totalPresent + totalAbsent < totalSessions && (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                          <AlertCircle size={10} />
                          {totalSessions - (totalPresent + totalAbsent)} {lang === 'ta' ? 'நேரங்கள் இன்னும் குறிக்கப்படவில்லை' : 'sessions not yet marked'}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
