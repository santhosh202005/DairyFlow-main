import { useState, useEffect, useCallback } from 'react';
import { User, Phone, Plus, Edit2, Trash2, Search, IndianRupee, TrendingDown, CheckCircle2, XCircle, ChevronLeft, ChevronRight, AlertCircle, Users, LayoutList, BadgeIndianRupee, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Worker, WorkerSalarySummary } from '../types';
import { useTranslation } from '../i18n';

interface WorkerManagementProps {
  vendorId?: string;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

type TabType = 'workers' | 'salary';

export default function WorkerManagement({ vendorId }: WorkerManagementProps) {
  const { t, lang } = useTranslation();
  const now = new Date();
  const [activeTab, setActiveTab] = useState<TabType>('workers');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    salary_amount: '',
    daily_wage: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: '',
  });

  // Salary report
  const [salaryYear, setSalaryYear] = useState(now.getFullYear());
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth());
  const [salarySummaries, setSalarySummaries] = useState<WorkerSalarySummary[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  const monthStr = `${salaryYear}-${String(salaryMonth + 1).padStart(2, '0')}`;
  const daysInMonth = getDaysInMonth(salaryYear, salaryMonth);
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const monthName = new Date(salaryYear, salaryMonth, 1).toLocaleString(locale, { month: 'long', year: 'numeric' });

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('dairy_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchWorkers = async () => {
    if (!vendorId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workers?vendorId=${vendorId}`, { headers: getAuthHeaders() });
      if (res.ok) setWorkers(await res.json());
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const fetchSalary = useCallback(async () => {
    if (!vendorId) return;
    setSalaryLoading(true);
    setSalaryError('');
    try {
      const res = await fetch(`/api/worker-salary?vendorId=${vendorId}&month=${monthStr}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSalarySummaries(data);
      } else {
        setSalaryError('Failed to load salary data.');
      }
    } catch (err) {
      setSalaryError('Connection error while loading salary data.');
      console.error(err);
    }
    finally { setSalaryLoading(false); }
  }, [vendorId, monthStr]);

  useEffect(() => { fetchWorkers(); }, [vendorId]);
  useEffect(() => { fetchSalary(); }, [fetchSalary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const payload = {
      ...formData,
      vendor_id: vendorId,
      salary_amount: parseFloat(formData.salary_amount) || 0,
      daily_wage: parseFloat(formData.daily_wage) || 0,
    };
    try {
      const url = editingWorker ? `/api/workers/${editingWorker.id}` : '/api/workers';
      const method = editingWorker ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(editingWorker ? 'Worker updated!' : 'Worker added!');
        setIsModalOpen(false);
        setEditingWorker(null);
        setFormData({ name: '', username: '', password: '', phone: '', salary_amount: '', daily_wage: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '' });
        fetchWorkers();
        fetchSalary();
      } else {
        setError(data.message || 'Failed to save worker.');
      }
    } catch { setError('Connection error.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this worker?')) return;
    try {
      const res = await fetch(`/api/workers/${id}`, { method: 'DELETE' });
      if (res.ok) { fetchWorkers(); fetchSalary(); }
    } catch (err) { console.error(err); }
  };

  const openEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setFormData({
      name: worker.name, username: worker.username, password: '',
      phone: worker.phone || '',
      salary_amount: worker.salary_amount != null ? String(worker.salary_amount) : '',
      daily_wage: worker.daily_wage != null ? String(worker.daily_wage) : '',
      bank_name: worker.bank_name || '',
      account_number: worker.account_number || '',
      ifsc_code: worker.ifsc_code || '',
      upi_id: worker.upi_id || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingWorker(null);
    setFormData({ name: '', username: '', password: '', phone: '', salary_amount: '', daily_wage: '', bank_name: '', account_number: '', ifsc_code: '', upi_id: '' });
    setError('');
    setIsModalOpen(true);
  };

  const prevMonth = () => {
    if (salaryMonth === 0) { setSalaryYear(y => y - 1); setSalaryMonth(11); }
    else setSalaryMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (salaryMonth === 11) { setSalaryYear(y => y + 1); setSalaryMonth(0); }
    else setSalaryMonth(m => m + 1);
  };

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.username.toLowerCase().includes(search.toLowerCase()) ||
    (w.phone && w.phone.includes(search))
  );

  const totalPayable = salarySummaries.reduce((s, r) => s + r.final_salary, 0);
  const totalDeductions = salarySummaries.reduce((s, r) => s + r.salary_deduction, 0);

  const TABS = [
    { id: 'workers', label: t('workers'), icon: Users },
    { id: 'salary', label: t('salaryReport'), icon: IndianRupee },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight">{t('workerManagement')}</h2>
          <p className="text-sm text-slate-500 font-medium">{t('manageWorkersSub')}</p>
        </div>
        {activeTab === 'workers' && (
          <button onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-bold text-sm w-full sm:w-auto">
            <Plus size={18} /> {t('addWorker')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                isActive ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-emerald-600' : ''} />
              {tab.label}
              {tab.id === 'salary' && salarySummaries.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black">
                  {salarySummaries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold border border-emerald-100 flex items-center gap-2">
          <CheckCircle2 size={15} /> {message}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* ─── WORKERS TAB ─── */}
        {activeTab === 'workers' && (
          <motion.div key="workers" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder={t('searchWorkers') || 'Search workers...'} value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-sm text-slate-800" />
            </div>

            {/* Desktop Table */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('worker')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('username')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('phone')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('monthlySalary')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('dailyWage')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">{t('today')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredWorkers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-slate-50/30 transition-all group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {worker.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{worker.name}</p>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-0.5">{t('active')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-mono text-xs text-slate-600 font-bold">{worker.username}</td>
                      <td className="px-6 py-5 text-sm text-slate-600 font-semibold">{worker.phone || 'N/A'}</td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                          <IndianRupee size={10} />
                          {(worker.salary_amount || 0).toLocaleString('en-IN')}/mo
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {(worker.daily_wage || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-black">
                            <IndianRupee size={10} />
                            {(worker.daily_wage || 0).toLocaleString('en-IN')}/day
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 font-semibold">Auto</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase ${(worker.today_supply || 0) > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          {worker.today_supply ? `${worker.today_supply.toFixed(1)} L` : '0 L'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(worker)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(worker.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredWorkers.length === 0 && (
                    <tr><td colSpan={7} className="py-16 text-center text-slate-400 italic text-sm">{isLoading ? t('loadingWorkers') : t('noWorkersFound')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {filteredWorkers.map((worker) => (
                <div key={worker.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-soft space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{worker.name}</p>
                        <p className="text-[10px] font-mono text-slate-500">@{worker.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(worker)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(worker.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider mb-1">{t('phone')}</p>
                      <p className="font-semibold text-slate-700 text-xs">{worker.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider mb-1">{t('monthlySalary')}</p>
                      <p className="font-bold text-blue-600 text-xs">₹{(worker.salary_amount || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider mb-1">{t('dailyWage')}</p>
                      <p className="font-bold text-amber-600 text-xs">
                        {(worker.daily_wage || 0) > 0 ? `₹${(worker.daily_wage || 0).toLocaleString('en-IN')}` : t('auto')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredWorkers.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 italic text-sm">
                  {isLoading ? t('loading') : t('noWorkersFound')}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── SALARY REPORT TAB ─── */}
        {activeTab === 'salary' && (
          <motion.div key="salary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
            {/* Month selector */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1 shadow-soft">
                <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <span className="font-bold text-slate-700 text-sm min-w-[140px] text-center">{monthName}</span>
                <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
              <button onClick={fetchSalary} className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors">
                ↺ {t('refresh')}
              </button>
            </div>

            {/* Formula box */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                📐 {t('salaryFormula')}
              </p>
              <div className="space-y-1 text-xs text-blue-700">
                <p>{t('formulaPerDay')}</p>
                <p>{t('formulaDeduction')}</p>
                <p className="font-bold text-blue-900">{t('formulaFinal')}</p>
              </div>
            </div>

            {salaryLoading ? (
              <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-100">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">{t('calculatingSalaries')}</p>
                </div>
              </div>
            ) : salaryError ? (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center">
                <AlertCircle size={24} className="text-rose-400 mx-auto mb-2" />
                <p className="text-rose-600 font-semibold text-sm">{salaryError}</p>
                <button onClick={fetchSalary} className="mt-3 px-4 py-2 bg-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-200 transition-colors">
                  {t('retry')}
                </button>
              </div>
            ) : salarySummaries.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                <Users size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-semibold mb-1">{t('noWorkersFound')}</p>
                <p className="text-slate-400 text-sm">{t('addWorkersFirst')}</p>
                <button onClick={() => setActiveTab('workers')}
                  className="mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                  {t('workers')}
                </button>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 text-center">
                    <p className="text-2xl font-black text-slate-800">{salarySummaries.length}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-1">{t('workers')}</p>
                  </div>
                  <div className="bg-rose-50 rounded-2xl border border-rose-100 p-4 text-center">
                    <p className="text-2xl font-black text-rose-600">₹{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wide mt-1">{t('totalDeductions')}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 text-center">
                    <p className="text-2xl font-black text-emerald-700">₹{totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide mt-1">{t('totalPayable')}</p>
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-soft overflow-hidden hidden sm:block">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('worker')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('monthlySalary')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('perDayRate')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('present')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('absent')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('totalDeductions')}</th>
                        <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('finalSalary')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {salarySummaries.map((s, idx) => {
                        const hasDeduction = s.salary_deduction > 0;
                        const noSalaryConfig = s.monthly_salary === 0;
                        return (
                          <motion.tr key={s.worker_id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                            className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                  {s.worker_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">{s.worker_name}</p>
                                  {noSalaryConfig && (
                                    <p className="text-[9px] text-amber-500 font-bold">⚠ {t('salaryNotConfigured')}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`text-sm font-bold ${noSalaryConfig ? 'text-slate-300' : 'text-blue-700'}`}>
                                ₹{s.monthly_salary.toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="text-sm font-bold text-amber-600">
                                {s.daily_wage > 0 ? `₹${s.daily_wage.toLocaleString('en-IN')}` : `₹${s.per_day_salary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                                <span className="text-[9px] text-slate-400 ml-1">{s.daily_wage > 0 ? `(${t('custom')})` : `(${t('auto')})`}</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-black">
                                <CheckCircle2 size={11} /> {s.present_days}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-black">
                                <XCircle size={11} /> {s.absent_days}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              {hasDeduction ? (
                                <span className="text-sm font-bold text-rose-600">−₹{s.salary_deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                              ) : (
                                <span className="text-xs text-slate-300 font-semibold">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className={`text-base font-black ${noSalaryConfig ? 'text-slate-300' : hasDeduction ? 'text-amber-600' : 'text-emerald-600'}`}>
                                ₹{s.final_salary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Salary Cards */}
                <div className="sm:hidden space-y-3">
                  {salarySummaries.map((s, idx) => {
                    const hasDeduction = s.salary_deduction > 0;
                    const noSalaryConfig = s.monthly_salary === 0;
                    return (
                      <motion.div key={s.worker_id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-soft p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                              {s.worker_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{s.worker_name}</p>
                              {noSalaryConfig && <p className="text-[10px] text-amber-500 font-bold">⚠ {t('salaryNotConfigured')}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-black ${noSalaryConfig ? 'text-slate-300' : hasDeduction ? 'text-amber-600' : 'text-emerald-600'}`}>
                              ₹{s.final_salary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </p>
                            <p className="text-[10px] text-slate-400">{t('finalSalary')}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-blue-50 rounded-xl p-2.5">
                            <p className="text-[10px] font-black text-blue-400 uppercase mb-0.5">{t('monthlySalary')}</p>
                            <p className="text-sm font-black text-blue-700">₹{s.monthly_salary.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-2.5">
                            <p className="text-[10px] font-black text-amber-400 uppercase mb-0.5">{t('perDayRate')}</p>
                            <p className="text-sm font-black text-amber-700">₹{s.per_day_salary.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase">{t('totalWorkingDays')}</p>
                            <p className="text-sm font-black text-slate-700">{s.total_working_days}d</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-2">
                            <p className="text-[9px] font-black text-emerald-400 uppercase">{t('present')}</p>
                            <p className="text-sm font-black text-emerald-600">{s.present_days}d</p>
                          </div>
                          <div className="bg-rose-50 rounded-xl p-2">
                            <p className="text-[9px] font-black text-rose-300 uppercase">{t('absent')}</p>
                            <p className="text-sm font-black text-rose-600">{s.absent_days}d</p>
                          </div>
                        </div>
                        {hasDeduction && (
                          <div className="flex items-center justify-between bg-rose-50 rounded-xl px-3 py-2">
                            <span className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                              <TrendingDown size={12} /> {t('totalDeductions')}
                            </span>
                            <span className="text-xs text-rose-700 font-black">−₹{s.salary_deduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {noSalaryConfig && (
                          <button onClick={() => { setActiveTab('workers'); openEdit(workers.find(w => String(w.id) === String(s.worker_id))!); }}
                            className="w-full py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors">
                            ✏ {t('salaryNotConfigured')} — {s.worker_name}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Grand Total */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-200 text-sm font-semibold">{monthName}</p>
                      <p className="text-xl font-black mt-1">{t('totalSalaryPayable')}</p>
                      {totalDeductions > 0 && (
                        <p className="text-emerald-300 text-xs mt-1">{t('afterDeductions')} ₹{totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-black">₹{totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      <p className="text-emerald-200 text-xs mt-1">{salarySummaries.length} {t('workersCount')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setIsModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.96 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <User size={17} className="text-emerald-600" />
                  </div>
                  <h2 className="font-bold text-slate-900 text-lg">{editingWorker ? t('editWorker') : t('addWorker')}</h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                  {error && (
                    <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100 flex items-center gap-2">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Worker Name *</label>
                      <input required type="text" value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Ramesh Kumar"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Username *</label>
                      <input required type="text" value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="e.g. ramesh_df"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Phone</label>
                      <input type="tel" value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Password {editingWorker && <span className="text-[10px] text-slate-400 font-normal normal-case">(blank = keep current)</span>}
                      </label>
                      <input required={!editingWorker} type="password" value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={editingWorker ? '••••••••' : 'Set a password'}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                    </div>
                  </div>

                  {/* Salary Config */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <IndianRupee size={14} className="text-emerald-600" />
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Salary Configuration</span>
                    </div>

                    <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">Monthly Salary (₹)</label>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-sm">₹</span>
                        <input type="number" min="0" step="0.01" value={formData.salary_amount}
                          onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value })} placeholder="e.g. 15000"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all font-semibold" />
                      </div>
                      <p className="text-[10px] text-blue-500">Base salary amount for the full month</p>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📆</span>
                        <label className="text-xs font-bold text-amber-700 uppercase tracking-wide">Daily Wage Rate (₹) — Deduction Rate</label>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-sm">₹</span>
                        <input type="number" min="0" step="0.01" value={formData.daily_wage}
                          onChange={(e) => setFormData({ ...formData, daily_wage: e.target.value })} placeholder="e.g. 500"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all font-semibold" />
                      </div>
                      <p className="text-[10px] text-amber-600">
                        Amount deducted per absent day. Leave blank → auto = Monthly ÷ {daysInMonth} days
                      </p>
                      {formData.salary_amount && (
                        <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 border border-slate-200">
                          <p className="font-bold text-slate-600 mb-1.5">📊 Preview ({monthName})</p>
                          <p className="text-slate-500">
                            Per Day = {formData.daily_wage
                              ? `₹${formData.daily_wage} (custom)`
                              : `₹${(parseFloat(formData.salary_amount || '0') / daysInMonth).toFixed(0)} (auto: ₹${formData.salary_amount} ÷ ${daysInMonth}d)`}
                          </p>
                          <p className="text-slate-500">Deduction = Per Day Rate × Absent Days</p>
                          <p className="font-bold text-emerald-600">Final = ₹{formData.salary_amount} − Deduction</p>
                        </div>
                      )}
                    </div>

                    {/* Optional Bank Account Details */}
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-emerald-600" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bank Account Details <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span></span>
                      </div>

                      <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5 space-y-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Bank Name</label>
                          <input type="text" value={formData.bank_name}
                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} placeholder="e.g. SBI, HDFC (Optional)"
                            className="w-full px-3.5 py-2 mt-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Account Number</label>
                            <input type="text" value={formData.account_number}
                              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} placeholder="Account No. (Optional)"
                              className="w-full px-3.5 py-2 mt-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">IFSC Code</label>
                            <input type="text" value={formData.ifsc_code}
                              onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })} placeholder="e.g. SBIN0001234 (Optional)"
                              className="w-full px-3.5 py-2 mt-1 bg-white border border-slate-200 rounded-xl text-xs uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">UPI ID</label>
                          <input type="text" value={formData.upi_id}
                            onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })} placeholder="e.g. worker@upi (Optional)"
                            className="w-full px-3.5 py-2 mt-1 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                  <button type="submit"
                    className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md">
                    {editingWorker ? t('saveChanges') || 'Save Changes' : t('addWorker')}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
