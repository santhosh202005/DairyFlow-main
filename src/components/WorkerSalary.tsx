import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  IndianRupee, ChevronLeft, ChevronRight, Calculator,
  TrendingDown, CheckCircle2, XCircle, Users, Info, Send
} from 'lucide-react';
import { WorkerSalarySummary } from '../types';
import { useTranslation } from '../i18n';
import SendMoneyModal from './SendMoneyModal';

interface WorkerSalaryProps {
  vendorId?: string;
}

export default function WorkerSalaryPage({ vendorId }: WorkerSalaryProps) {
  const { t, lang } = useTranslation();
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [summaries, setSummaries] = useState<WorkerSalarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payModalWorker, setPayModalWorker] = useState<WorkerSalarySummary | null>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthName = new Date(year, month, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('dairy_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSalary = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/worker-salary?vendorId=${vendorId}&month=${monthStr}`, { headers: getAuthHeaders() });
      if (res.ok) setSummaries(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [vendorId, monthStr]);

  useEffect(() => { fetchSalary(); }, [fetchSalary]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const totalPayable = summaries.reduce((s, r) => s + r.final_salary, 0);
  const totalDeductions = summaries.reduce((s, r) => s + r.salary_deduction, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <IndianRupee size={26} className="text-emerald-600" />
            {t('salaryReport')}
          </h2>
          <p className="text-sm text-slate-500 font-medium">{t('monthlySalaryCalcSub')}</p>
        </div>
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

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">{t('calculatingSalaries')}</p>
          </div>
        </div>
      ) : summaries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Users size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">{t('noWorkersFound')}</p>
          <p className="text-slate-400 text-sm mt-1">{t('addWorkersFirst')}</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: t('totalWorkingDays') === 'மொத்த வேலை நாட்கள்' ? 'மொத்த பணியாளர்கள்' : 'Total Workers', value: summaries.length, display: String(summaries.length), icon: Users, colorClass: 'bg-blue-50 text-blue-600', textColor: 'text-slate-900' },
              { label: t('totalDeductions'), value: totalDeductions, display: `₹${totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: TrendingDown, colorClass: 'bg-rose-50 text-rose-500', textColor: 'text-rose-600' },
              { label: t('totalPayable'), value: totalPayable, display: `₹${totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: IndianRupee, colorClass: 'bg-emerald-50 text-emerald-600', textColor: 'text-emerald-600' },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.colorClass}`}>
                    <Icon size={20} />
                  </div>
                  <p className={`text-xl font-black ${stat.textColor}`}>{stat.display}</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Formula Info */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Calculator size={15} className="text-blue-600" />
              </div>
              <div className="space-y-1.5 text-xs text-blue-700">
                <p className="font-bold text-blue-800 text-sm mb-1">{t('salaryCalculationFormula')}</p>
                <p>📅 <strong>{t('perDayRate')}</strong> = {t('formulaPerDay')}</p>
                <p>📉 <strong>{t('salaryDeduction')}</strong> = {t('formulaDeduction')}</p>
                <p>💰 <strong>{t('finalSalary')}</strong> = {t('formulaFinal')}</p>
              </div>
            </div>
          </div>

          {/* Worker Cards */}
          <div className="space-y-4">
            {summaries.map((summary, idx) => {
              const isExpanded = expandedId === summary.worker_id;
              const hasDeduction = summary.salary_deduction > 0;
              const attendancePct = summary.total_working_days > 0
                ? Math.round((summary.present_days / summary.total_working_days) * 100) : 0;
              const usingCustomDailyWage = summary.daily_wage > 0;

              return (
                <motion.div key={summary.worker_id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden">

                  {/* Card Header */}
                  <div className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : summary.worker_id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${hasDeduction ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {summary.worker_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-base truncate">{summary.worker_name}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase">
                              ₹{summary.monthly_salary.toLocaleString('en-IN')}/{lang === 'ta' ? 'மாதம்' : 'mo'}
                            </span>
                            {usingCustomDailyWage && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase">
                                ₹{summary.daily_wage.toLocaleString('en-IN')}/{lang === 'ta' ? 'நாள்' : 'day'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-black ${hasDeduction ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ₹{summary.final_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold">{t('totalPayable') === 'மொத்த வழங்கப்பட வேண்டியது' ? 'இறுதிச் சம்பளம்' : 'Final Payable'}</p>
                        {hasDeduction && (
                          <p className="text-[10px] text-rose-500 font-bold">
                            −₹{summary.salary_deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {t('deducted')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Attendance quick view */}
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-slate-700">{summary.total_working_days}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t('totalWorkingDays')}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-emerald-600">{summary.present_days}</p>
                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">{t('presentDays')}</p>
                      </div>
                      <div className="bg-rose-50 rounded-xl p-2.5 text-center">
                        <p className="text-base font-black text-rose-500">{summary.absent_days}</p>
                        <p className="text-[9px] font-bold text-rose-300 uppercase tracking-wide">{t('absentDays')}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span>{t('attendance')}</span>
                        <span className={attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-amber-500' : 'text-rose-500'}>
                          {attendancePct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${attendancePct}%` }}
                          transition={{ delay: idx * 0.07 + 0.3, duration: 0.7 }}
                          className={`h-full rounded-full ${attendancePct >= 80 ? 'bg-emerald-500' : attendancePct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400 font-medium">
                        {isExpanded ? t('hideCalculation') : t('viewDetailedCalculation')}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayModalWorker(summary);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 touch-btn"
                      >
                        <Send size={13} /> {lang === 'ta' ? 'சம்பளம் அனுப்பு' : 'Pay Salary'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: Step-by-Step Breakdown */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white p-5 space-y-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator size={14} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t('stepByStepCalculation')}</span>
                      </div>

                      {/* Step 1: Per Day Rate */}
                      <div className="bg-white rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</div>
                          <p className="text-xs font-bold text-slate-600">{t('perDayRate')}</p>
                        </div>
                        {usingCustomDailyWage ? (
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-bold">₹{summary.daily_wage.toLocaleString('en-IN')}/{lang === 'ta' ? 'நாள்' : 'day'}</span>
                            <span className="text-slate-400 text-xs">({t('customDailyWage')})</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-black">= ₹{summary.per_day_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold">₹{summary.monthly_salary.toLocaleString('en-IN')}</span>
                            <span className="text-slate-400 font-bold">÷</span>
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">{summary.total_working_days} {lang === 'ta' ? 'நாட்கள்' : 'days'}</span>
                            <span className="text-slate-400 font-bold">=</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-black">₹{summary.per_day_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/{lang === 'ta' ? 'நாள்' : 'day'}</span>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Deduction */}
                      <div className="bg-white rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</div>
                          <p className="text-xs font-bold text-slate-600">{t('salaryDeduction')}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-bold">₹{summary.per_day_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/{lang === 'ta' ? 'நாள்' : 'day'}</span>
                          <span className="text-slate-400 font-bold">×</span>
                          <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-lg font-bold">{summary.absent_days} {t('absentDays')}</span>
                          <span className="text-slate-400 font-bold">=</span>
                          <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg font-black">−₹{summary.salary_deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Step 3: Final */}
                      <div className={`rounded-xl border-2 p-4 ${hasDeduction ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-5 h-5 text-white rounded-full flex items-center justify-center text-[10px] font-black ${hasDeduction ? 'bg-amber-500' : 'bg-emerald-500'}`}>3</div>
                          <p className="text-xs font-bold text-slate-700">{t('finalSalary')}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="bg-white text-slate-700 px-2.5 py-1 rounded-lg font-bold border border-slate-200">₹{summary.monthly_salary.toLocaleString('en-IN')}</span>
                          <span className="text-slate-500 font-bold">−</span>
                          <span className="bg-white text-rose-600 px-2.5 py-1 rounded-lg font-bold border border-rose-100">₹{summary.salary_deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          <span className="text-slate-500 font-bold">=</span>
                          <span className={`px-3 py-1.5 rounded-xl font-black text-base ${hasDeduction ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                            ₹{summary.final_salary.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {!usingCustomDailyWage && (
                        <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3 text-xs text-blue-600">
                          <Info size={12} className="shrink-0" />
                          {t('autoDailyRateNotice')}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Grand Total Footer */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-200 text-sm font-semibold">{monthName}</p>
                <p className="text-2xl font-black mt-1">{t('totalSalaryPayable')}</p>
                {totalDeductions > 0 && (
                  <p className="text-emerald-300 text-sm mt-1">
                    {t('afterDeductions')} ₹{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-4xl font-black">₹{totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-emerald-200 text-xs mt-1">{summaries.length} {t('workersCount')}</p>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Send Money Modal */}
      {payModalWorker && (
        <SendMoneyModal
          isOpen={!!payModalWorker}
          onClose={() => setPayModalWorker(null)}
          recipientName={payModalWorker.worker_name}
          recipientType="worker"
          recipientId={String(payModalWorker.worker_id)}
          amount={payModalWorker.final_salary}
          note={`Salary for ${monthName}`}
          onPaymentRecorded={fetchSalary}
        />
      )}
    </div>
  );
}

