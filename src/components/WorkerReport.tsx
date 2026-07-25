import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCheck, ChevronLeft, ChevronRight, IndianRupee,
  TrendingDown, CheckCircle2, XCircle, Calculator, User,
  Milk, FileText, AlertCircle, Calendar, ShieldCheck, Clock,
  Wallet, ArrowRight, ArrowDown, CreditCard, Banknote, QrCode, Info
} from 'lucide-react';
import { WorkerSalarySummary, MilkEntry } from '../types';
import { useTranslation } from '../i18n';

interface WorkerReportProps {
  workerId?: string;
  vendorId?: string;
  workerName?: string;
}

interface WorkerCredit {
  id: string | number;
  worker_id: string | number;
  amount: number;
  date: string;
  note?: string;
  payment_mode?: string;
  reference_no?: string;
  created_at: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface DailyAttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'none';
  dayName: string;
  dayNum: number;
}

export default function WorkerReport({ workerId, vendorId, workerName }: WorkerReportProps) {
  const { t, lang } = useTranslation();
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [salarySummary, setSalarySummary] = useState<WorkerSalarySummary | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([]);
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [credits, setCredits] = useState<WorkerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'salary' | 'attendance' | 'supply' | 'credits'>('salary');

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(year, month);
  const monthName = new Date(year, month, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('dairy_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const salaryUrl = vendorId
        ? `/api/worker-salary?vendorId=${vendorId}&month=${monthStr}`
        : `/api/worker-salary?month=${monthStr}`;

      const [salaryRes, attendanceRes, entriesRes, creditsRes] = await Promise.all([
        fetch(salaryUrl, { headers: getAuthHeaders() }),
        fetch(`/api/worker-attendance?month=${monthStr}${vendorId ? `&vendorId=${vendorId}` : ''}`, { headers: getAuthHeaders() }),
        fetch(`/api/entries`, { headers: getAuthHeaders() }),
        fetch(`/api/worker-credits${workerId ? `?workerId=${workerId}` : ''}`, { headers: getAuthHeaders() }),
      ]);

      if (salaryRes.ok) {
        const summaries: WorkerSalarySummary[] = await salaryRes.json();
        const mySummary = summaries.find(s => String(s.worker_id) === String(workerId)) || summaries[0] || null;
        setSalarySummary(mySummary);
      }

      let attendanceMap: Record<string, 'present' | 'absent'> = {};
      if (attendanceRes.ok) {
        const attData: { worker_id: string | number; date: string; status: string }[] = await attendanceRes.json();
        const myAtt = attData.filter(r => String(r.worker_id) === String(workerId));
        for (const rec of myAtt) {
          attendanceMap[rec.date] = rec.status as 'present' | 'absent';
        }
      }

      const daily: DailyAttendanceRecord[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = formatDate(year, month, day);
        const dObj = new Date(year, month, day);
        const dayName = dObj.toLocaleDateString(locale, { weekday: 'short' });
        daily.push({
          date: dStr,
          status: attendanceMap[dStr] || 'none',
          dayName,
          dayNum: day,
        });
      }
      setDailyAttendance(daily);

      if (entriesRes.ok) {
        const entries: MilkEntry[] = await entriesRes.json();
        const myEntries = entries.filter(e => e.date?.startsWith(monthStr));
        setMilkEntries(myEntries);
      }

      if (creditsRes.ok) {
        const creditsData: WorkerCredit[] = await creditsRes.json();
        setCredits(creditsData);
      }
    } catch (err) {
      console.error(err);
      setError(t('unableToLoadReportData'));
    } finally {
      setLoading(false);
    }
  }, [workerId, vendorId, monthStr, year, month, daysInMonth, locale, t]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const totalLitersLogged = milkEntries.reduce((sum, e) => sum + (e.liters || 0), 0);
  const totalEntriesLogged = milkEntries.length;

  const presentCount = dailyAttendance.filter(d => d.status === 'present').length;
  const absentCount = dailyAttendance.filter(d => d.status === 'absent').length;
  const attendancePercentage = daysInMonth > 0 ? Math.round((presentCount / daysInMonth) * 100) : 0;

  const totalCredits = credits.reduce((sum, c) => sum + (c.amount || 0), 0);

  const getPaymentModeIcon = (mode?: string) => {
    switch (mode) {
      case 'upi': return <QrCode size={14} className="text-emerald-600" />;
      case 'bank_transfer': return <CreditCard size={14} className="text-blue-600" />;
      default: return <Banknote size={14} className="text-amber-600" />;
    }
  };
  const getPaymentModeLabel = (mode?: string) => {
    switch (mode) {
      case 'upi': return 'UPI';
      case 'bank_transfer': return lang === 'ta' ? 'வங்கி பரிமாற்றம்' : 'Bank Transfer';
      default: return lang === 'ta' ? 'பணம்' : 'Cash';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center font-black text-2xl border border-white/20 text-white shadow-inner">
              {workerName ? workerName.charAt(0).toUpperCase() : 'W'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-display font-bold">{workerName || t('workerReport')}</h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full text-xs font-bold uppercase tracking-wider">
                  {t('workerPortal')}
                </span>
              </div>
              <p className="text-emerald-200 text-sm mt-1 font-medium flex items-center gap-2">
                <ShieldCheck size={16} /> {t('salaryAttendanceReport')}
              </p>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 self-start md:self-auto">
            <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/20 text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span className="font-bold text-white text-sm min-w-[140px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/20 text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
        {[
          { id: 'salary', label: t('salaryDetails'), icon: IndianRupee },
          { id: 'attendance', label: t('attendanceLog'), icon: CalendarCheck },
          { id: 'supply', label: t('workLogMilk'), icon: Milk },
          { id: 'credits', label: t('creditsReceived'), icon: Wallet },
        ].map(tTab => {
          const Icon = tTab.icon;
          const isActive = activeTab === tTab.id;
          return (
            <button
              key={tTab.id}
              onClick={() => setActiveTab(tTab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                isActive ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-emerald-600' : ''} />
              <span className="hidden sm:inline">{tTab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">{t('loadingMonthlyReport')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-6 rounded-3xl flex items-center gap-3">
          <AlertCircle size={20} />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB 1: SALARY DETAILS */}
          {activeTab === 'salary' && (
            <motion.div
              key="salary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* "How Your Salary is Calculated" Visual Flow */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Calculator size={16} className="text-emerald-400" />
                    {t('howSalaryCalculated')}
                  </h3>
                  {/* Steps - horizontal on desktop, vertical on mobile */}
                  <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-4">
                    {/* Step A: Base Pay */}
                    <div className="flex-1 bg-blue-500/20 border border-blue-400/30 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-1">{t('basePay')}</p>
                      <p className="text-2xl font-black text-blue-200">
                        ₹{(salarySummary?.monthly_salary || 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-blue-400 mt-1">/{lang === 'ta' ? 'மாதம்' : 'month'}</p>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center md:py-0 py-1">
                      <div className="hidden md:block"><ArrowRight size={24} className="text-slate-500" /></div>
                      <div className="md:hidden"><ArrowDown size={24} className="text-slate-500" /></div>
                    </div>

                    {/* Step B: Deduct Absences */}
                    <div className="flex-1 bg-rose-500/20 border border-rose-400/30 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 mb-1">{t('thenDeduct')}</p>
                      <p className="text-2xl font-black text-rose-300">
                        −₹{(salarySummary?.salary_deduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-rose-400 mt-1">
                        {salarySummary?.absent_days || 0} {t('absentDays')} × ₹{(salarySummary?.per_day_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center md:py-0 py-1">
                      <div className="hidden md:block"><ArrowRight size={24} className="text-slate-500" /></div>
                      <div className="md:hidden"><ArrowDown size={24} className="text-slate-500" /></div>
                    </div>

                    {/* Step C: You Receive */}
                    <div className="flex-1 bg-emerald-500/30 border-2 border-emerald-400/40 rounded-2xl p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1">{t('youReceive')}</p>
                      <p className="text-3xl font-black text-emerald-300">
                        ₹{(salarySummary?.final_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-emerald-400 mt-1">{monthName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-5 shadow-lg shadow-emerald-500/10">
                  <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">{t('finalNetSalary')}</p>
                  <p className="text-3xl font-black">
                    ₹{(salarySummary?.final_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-emerald-200 mt-1 font-semibold">{monthName}</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{t('monthlyBase')}</p>
                  <p className="text-2xl font-black text-slate-800">
                    ₹{(salarySummary?.monthly_salary || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-blue-600 font-semibold mt-1">{t('configuredSalary')}</p>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{t('perDayRate')}</p>
                  <p className="text-2xl font-black text-amber-600">
                    ₹{(salarySummary?.per_day_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">
                    {salarySummary?.daily_wage ? t('customDailyWage') : t('autoRate')}
                  </p>
                </div>

                <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-100 shadow-soft">
                  <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">{t('totalDeduction')}</p>
                  <p className="text-2xl font-black text-rose-600">
                    −₹{(salarySummary?.salary_deduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {salarySummary?.absent_days || 0} {t('absentDays')}
                  </p>
                </div>
              </div>

              {/* Formula & Step Breakdown */}
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-soft space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Calculator className="text-emerald-600" size={20} />
                  <h3 className="font-bold text-slate-800 text-base">{t('salaryCalculationBreakdown')}</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
                      <p className="font-bold text-slate-700 text-sm">{t('monthlyBaseSalary')}</p>
                    </div>
                    <p className="text-2xl font-black text-blue-700">₹{(salarySummary?.monthly_salary || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-blue-600">{t('baseEarningsFixed')}</p>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center">2</span>
                      <p className="font-bold text-slate-700 text-sm">{t('perDayRateCalculation')}</p>
                    </div>
                    <p className="text-xl font-black text-amber-700">
                      ₹{(salarySummary?.per_day_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / {lang === 'ta' ? 'நாள்' : 'day'}
                    </p>
                    <p className="text-xs text-amber-600">
                      {salarySummary?.daily_wage
                        ? t('customRateSetByVendor')
                        : `₹${salarySummary?.monthly_salary || 0} ÷ ${daysInMonth} ${lang === 'ta' ? 'நாட்கள்' : 'days'}`}
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center">3</span>
                      <p className="font-bold text-slate-700 text-sm">{t('absentDeduction')}</p>
                    </div>
                    <p className="text-xl font-black text-rose-600">
                      −₹{(salarySummary?.salary_deduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-rose-500">
                      {salarySummary?.absent_days || 0} {t('absentDays')} × ₹{salarySummary?.per_day_salary || 0}/{lang === 'ta' ? 'நாள்' : 'day'}
                    </p>
                  </div>
                </div>

                {/* Formula Highlight */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">{t('formulaApplied')}</p>
                    <p className="text-lg font-bold mt-0.5">
                      {t('finalSalary')} = {t('monthlySalary')} (₹{salarySummary?.monthly_salary || 0}) − {t('salaryDeduction')} (₹{salarySummary?.salary_deduction || 0})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black">
                      ₹{(salarySummary?.final_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: ATTENDANCE LOG */}
          {activeTab === 'attendance' && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">{t('totalWorkingDays')}</p>
                  <p className="text-2xl font-black text-slate-800">{daysInMonth}</p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">{monthName}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-soft">
                  <p className="text-emerald-500 text-xs font-bold uppercase mb-1">{t('presentDays')}</p>
                  <p className="text-2xl font-black text-emerald-600">{presentCount}</p>
                  <p className="text-[10px] text-emerald-600 mt-1 font-semibold">{t('worked')}</p>
                </div>
                <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100 shadow-soft">
                  <p className="text-rose-400 text-xs font-bold uppercase mb-1">{t('absentDays')}</p>
                  <p className="text-2xl font-black text-rose-600">{absentCount}</p>
                  <p className="text-[10px] text-rose-500 mt-1 font-semibold">{t('deducted')}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 shadow-soft">
                  <p className="text-blue-400 text-xs font-bold uppercase mb-1">{t('attendanceRate')}</p>
                  <p className="text-2xl font-black text-blue-700">{attendancePercentage}%</p>
                  <p className="text-[10px] text-blue-600 mt-1 font-semibold">{t('monthlyRate')}</p>
                </div>
              </div>

              {/* Impact on Pay - NEW */}
              {salarySummary && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-amber-600" />
                    <h4 className="font-bold text-amber-800 text-sm">{t('impactOnPay')}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white/80 rounded-xl p-3 border border-amber-100">
                      <p className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">{t('eachAbsentCosts')}</p>
                      <p className="text-xl font-black text-amber-700 mt-1">
                        ₹{(salarySummary.per_day_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}<span className="text-sm font-bold">/{lang === 'ta' ? 'நாள்' : 'day'}</span>
                      </p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3 border border-rose-100">
                      <p className="text-[10px] font-bold uppercase text-rose-500 tracking-wider">{t('totalAbsentCost')}</p>
                      <p className="text-xl font-black text-rose-600 mt-1">
                        −₹{(salarySummary.salary_deduction || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-3 border border-emerald-100">
                      <p className="text-[10px] font-bold uppercase text-emerald-500 tracking-wider">{t('yourEarnings')}</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">
                        ₹{(salarySummary.final_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Table */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">{t('dayByDayAttendanceLog')}</h3>
                  <span className="text-xs text-slate-400 font-semibold">{monthName}</span>
                </div>

                <div className="divide-y divide-slate-50">
                  {dailyAttendance.map((d) => {
                    const isPresent = d.status === 'present';
                    const isAbsent = d.status === 'absent';
                    return (
                      <div key={d.date} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isPresent ? 'bg-emerald-100 text-emerald-700' : isAbsent ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {d.dayNum}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {new Date(d.date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-slate-400 font-semibold">{d.dayName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                            isPresent ? 'bg-emerald-50 text-emerald-600' : isAbsent ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {isPresent ? (
                              <><CheckCircle2 size={13} /> {t('present')}</>
                            ) : isAbsent ? (
                              <><XCircle size={13} /> {t('absent')}</>
                            ) : (
                              <><Clock size={13} /> {t('notMarked')}</>
                            )}
                          </span>
                          <span className={`text-xs font-bold w-20 text-right ${isAbsent ? 'text-rose-500' : 'text-slate-300'}`}>
                            {isAbsent ? `−₹${(salarySummary?.per_day_salary || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '₹0'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: WORK LOG (MILK ENTRIES) */}
          {activeTab === 'supply' && (
            <motion.div
              key="supply"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/70 rounded-2xl p-5 border border-blue-100 shadow-soft">
                  <p className="text-blue-500 text-xs font-bold uppercase mb-1">{t('totalMilkLogged')}</p>
                  <p className="text-3xl font-black text-blue-700">{totalLitersLogged.toFixed(1)} L</p>
                  <p className="text-[10px] text-blue-500 mt-1 font-semibold">{monthName}</p>
                </div>
                <div className="bg-indigo-50/70 rounded-2xl p-5 border border-indigo-100 shadow-soft">
                  <p className="text-indigo-500 text-xs font-bold uppercase mb-1">{t('totalCollections')}</p>
                  <p className="text-3xl font-black text-indigo-700">{totalEntriesLogged}</p>
                  <p className="text-[10px] text-indigo-500 mt-1 font-semibold">{monthName}</p>
                </div>
              </div>

              {/* Entries Table */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">{t('collectionsLoggedByYou')}</h3>
                  <span className="text-xs text-slate-400 font-semibold">{milkEntries.length} {lang === 'ta' ? 'பதிவுகள்' : 'entries'}</span>
                </div>

                {milkEntries.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 italic text-sm">
                    {t('noMilkCollectionsForMonth')}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {milkEntries.map((e) => (
                      <div key={e.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Milk size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{e.customer_name || t('farmer')}</p>
                            <p className="text-xs text-slate-400 font-medium">
                              {e.date} • <span className="font-bold text-slate-600">{e.shift === 'AM' ? t('morning') : t('evening')}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-base font-black text-emerald-600">{e.liters} L</p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            FAT: {e.fat || '-'}% | SNF: {e.snf || '-'}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 4: CREDITS / PAYMENTS RECEIVED */}
          {activeTab === 'credits' && (
            <motion.div
              key="credits"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Credit Summary */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-3xl p-6 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">{t('paymentsReceived')}</p>
                    <p className="text-3xl font-black">₹{totalCredits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-emerald-200 text-xs mt-1 font-medium">{credits.length} {lang === 'ta' ? 'பரிவர்த்தனைகள்' : 'transactions'}</p>
                  </div>
                  <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center">
                    <Wallet size={28} className="text-emerald-200" />
                  </div>
                </div>
              </div>

              {/* Credit Entries */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-base">{t('creditHistory')}</h3>
                  <span className="text-xs text-slate-400 font-semibold">{t('creditedToAccount')}</span>
                </div>

                {credits.length === 0 ? (
                  <div className="p-16 text-center">
                    <Wallet size={40} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold">{t('noCreditsYet')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {credits.map((credit, idx) => (
                      <motion.div
                        key={credit.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors border-l-4 border-emerald-400"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <IndianRupee size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{t('salaryCredit')}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                              {t('paidOn')}: {new Date(credit.date + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {credit.note && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{credit.note}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">+₹{credit.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            {getPaymentModeIcon(credit.payment_mode)}
                            <span className="text-[10px] font-bold text-slate-500">{getPaymentModeLabel(credit.payment_mode)}</span>
                          </div>
                          {credit.reference_no && (
                            <p className="text-[9px] text-slate-400 mt-0.5">Ref: {credit.reference_no}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
