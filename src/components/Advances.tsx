import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, User, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Advance, Customer } from '../types';
import { useTranslation } from '../i18n';

interface AdvancesProps {
  customerId?: string;
  isAdmin?: boolean;
}

export default function Advances({ customerId, isAdmin = true }: AdvancesProps) {
  const { t } = useTranslation();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState<any>(null);

  const [formData, setFormData] = useState({
    customer_id: customerId ? customerId.toString() : '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: 'advance'
  });

  const [customerStats, setCustomerStats] = useState<{
    monthlyRevenue: number;
    monthlyAdvances: number;
    monthlyDeductions: number;
    monthlyFeed: number;
    advanceBalance: number;
    pendingPayments: number;
  } | null>(null);

  useEffect(() => {
    fetchAdvances();
    if (isAdmin) {
      fetchCustomers();
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => setGlobalStats(data));
    } else if (customerId) {
      fetch(`/api/stats?customerId=${customerId}`)
        .then(res => res.json())
        .then(data => setGlobalStats(data));
    }
  }, [customerId, isAdmin]);

  useEffect(() => {
    if (isAdmin && formData.customer_id) {
      fetch(`/api/stats?customerId=${formData.customer_id}`)
        .then(res => res.json())
        .then(data => setCustomerStats(data))
        .catch(() => setCustomerStats(null));
    } else {
      setCustomerStats(null);
    }
  }, [formData.customer_id, isAdmin]);

  const fetchAdvances = () => {
    const url = customerId ? `/api/advances?customerId=${customerId}` : '/api/advances';
    fetch(url)
      .then(res => res.json())
      .then(data => setAdvances(data));
  };

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        customer_id: formData.customer_id,
        amount: parseFloat(formData.amount)
      })
    });

    if (response.ok) {
      const data = await response.json();
      const customer = customers.find(c => c.id.toString() === formData.customer_id);
      const customerName = customer ? customer.name : '';
      
      const newAdvance: Advance = {
        id: data.id || Date.now().toString(),
        customer_id: formData.customer_id,
        customer_name: customerName,
        date: formData.date,
        amount: parseFloat(formData.amount),
        type: formData.type as 'advance' | 'deduction',
        created_at: new Date().toISOString()
      };

      setAdvances(prev => [newAdvance, ...prev]);
      
      if (isAdmin) {
        fetch('/api/stats').then(res => res.json()).then(d => setGlobalStats(d));
      } else if (customerId) {
        fetch(`/api/stats?customerId=${customerId}`).then(res => res.json()).then(d => setGlobalStats(d));
      }
    }

    setIsModalOpen(false);
    setFormData({ ...formData, customer_id: customerId ? customerId.toString() : '', amount: '' });
    fetchAdvances();
  };

  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const previousAdvances = [...advances];
    setAdvances(prev => prev.filter(a => a.id !== id));
    setDeletingId(id);
    setShowConfirmModal(null);
    try {
      const response = await fetch(`/api/advances/${id}`, { 
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        fetchAdvances();
        if (isAdmin) {
          fetch('/api/stats').then(res => res.json()).then(d => setGlobalStats(d));
        }
      } else {
        setAdvances(previousAdvances);
        alert(data.message || 'Could not delete record.');
      }
    } catch (err) {
      setAdvances(previousAdvances);
      alert('Error connecting to server.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 relative">
      {/* Delete Confirmation */}
      <AnimatePresence>
        {showConfirmModal !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1.5">Delete Record?</h3>
              <p className="text-slate-500 text-sm mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmModal(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors text-sm touch-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(showConfirmModal)}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 transition-colors shadow-lg text-sm touch-btn"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-end md:gap-6 md:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 md:px-3 md:py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              {t('financialLedger')}
            </span>
          </div>
          <h2 className="page-title">
            {t('advancesPayouts')}
          </h2>
          <p className="text-slate-500 font-medium max-w-md text-xs md:text-base mt-1">
            {isAdmin ? t('overseeLending') : t('reviewHistory')}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full md:w-auto">
          {/* Stats bar */}
          {globalStats && (
            <div className="grid grid-cols-4 sm:flex sm:items-center gap-1 sm:gap-0 bg-white p-2 rounded-2xl border border-slate-100 shadow-soft w-full sm:w-auto">
              {[
                { label: isAdmin ? 'Gross' : 'Total', value: `₹${Math.round(globalStats.monthlyRevenue)}`, color: 'text-slate-900' },
                { label: 'Repaid', value: `₹${Math.round((globalStats.monthlyDeductions || 0) + (isAdmin ? globalStats.monthlyFeed : 0))}`, color: 'text-emerald-600' },
                { label: 'Debt', value: `₹${Math.round(globalStats.advanceBalance !== undefined ? globalStats.advanceBalance : (globalStats.totalAdvanceBalance ?? 0))}`, color: 'text-orange-600' },
                { label: 'Net', value: `₹${Math.round(globalStats.pendingPayments)}`, color: 'text-blue-700' },
              ].map((s, i) => (
                <div key={i} className={`flex-1 text-center px-2 sm:px-3 py-1 ${i < 3 ? 'sm:border-r sm:border-slate-100' : ''}`}>
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{s.label}</p>
                  <p className={`text-sm font-display font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 text-sm touch-btn w-full sm:w-auto shrink-0"
            >
              <Plus size={18} />
              {t('newEntry')}
            </button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mobile-compact-table">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">{t('date')}</th>
                {isAdmin && <th className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Farmer</th>}
                <th className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Type</th>
                <th className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Amount</th>
                {isAdmin && <th className="px-4 md:px-8 py-3 md:py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Del</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {advances.map((advance) => (
                <tr key={advance.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-4 md:px-8 py-3 md:py-6">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{new Date(advance.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-medium">{new Date(advance.date).getFullYear()}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-4 md:px-8 py-3 md:py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px] uppercase">
                          {advance.customer_name?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 text-xs md:text-sm tracking-tight truncate max-w-[80px] md:max-w-none">{advance.customer_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 md:px-8 py-3 md:py-6">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                      advance.type === 'deduction' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${advance.type === 'deduction' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      {advance.type === 'deduction' ? 'Bill Reduction' : 'Cash Advance'}
                    </span>
                  </td>
                  <td className={`px-4 md:px-8 py-3 md:py-6 font-display font-bold text-right text-base md:text-lg ${
                    advance.type === 'deduction' ? 'text-emerald-700' : 'text-blue-700'
                  }`}>₹{advance.amount.toFixed(0)}</td>
                  {isAdmin && (
                    <td className="px-4 md:px-8 py-3 md:py-6 text-right">
                      <button
                        disabled={deletingId === advance.id}
                        onClick={() => setShowConfirmModal(advance.id)}
                        className={`p-2 md:p-3 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm touch-btn ${
                          deletingId === advance.id 
                            ? 'text-slate-200 bg-slate-50' 
                            : 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        <Trash2 size={15} className={deletingId === advance.id ? 'animate-pulse' : ''} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {advances.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 3} className="p-14 md:p-20 text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3 md:mb-4">
                      <Wallet size={26} className="md:hidden" />
                      <Wallet size={32} className="hidden md:block" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">{t('zeroLedger')}</p>
                    <p className="text-xs text-slate-300">{t('noTransactionsRecorded')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {advances.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-3">
              <Wallet size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400">{t('noTransactions')}</p>
            <p className="text-xs text-slate-300 mt-1">{t('noTransactionsRecorded')}</p>
          </div>
        )}
        {advances.map((advance) => (
          <motion.div
            key={advance.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  advance.type === 'deduction' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  <Wallet size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      advance.type === 'deduction' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {advance.type === 'deduction' ? 'Bill Reduction' : 'Cash Advance'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(advance.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {isAdmin && <p className="text-[11px] text-slate-400 font-medium">{advance.customer_name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className={`text-base font-display font-black ${
                  advance.type === 'deduction' ? 'text-emerald-700' : 'text-blue-700'
                }`}>₹{advance.amount.toFixed(0)}</p>
                {isAdmin && (
                  <button
                    disabled={deletingId === advance.id}
                    onClick={() => setShowConfirmModal(advance.id)}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors touch-btn"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* New Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/20"
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
            <div className="p-5 sm:p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg sm:text-2xl font-display font-bold text-slate-900 tracking-tight">{t('newTransaction')}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{t('financialReconciliation')}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all touch-btn"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-4 sm:space-y-8 modal-scroll">
              {/* Type Toggle */}
                <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'advance' })}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all touch-btn ${
                    formData.type === 'advance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                    >
                  {t('giveAdvance')}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'deduction' })}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all touch-btn ${
                    formData.type === 'deduction' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t('billReduction')}
                </button>
              </div>

              <div className="space-y-3 sm:space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">{t('selectFarmer')}</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <select
                      required
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="input-base pl-9 appearance-none"
                    >
                      <option value="">{t('chooseCustomer')}</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isAdmin && customerStats && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-0.5">{t('currentGross')}</p>
                            <p className="text-sm font-display font-bold text-slate-900">₹{customerStats.monthlyRevenue.toFixed(0)}</p>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                            <p className="text-[9px] text-orange-600 uppercase font-black tracking-widest mb-0.5">{t('totalDebt')}</p>
                            <p className="text-sm font-display font-bold text-orange-900">₹{customerStats.advanceBalance.toFixed(0)}</p>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-2xl border ${
                      formData.type === 'deduction' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-blue-50/50 border-blue-100'
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                          formData.type === 'deduction' ? 'text-emerald-600' : 'text-blue-600'
                        }`}>
                          {formData.type === 'deduction' ? 'Limit for Reduction' : 'Available for Payout'}
                        </p>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, amount: customerStats.pendingPayments.toString() })}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all text-white shadow-md active:scale-95 ${
                            formData.type === 'deduction' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          Auto Fill
                        </button>
                      </div>
                      <p className={`text-2xl sm:text-3xl font-display font-bold tracking-tight ${
                        formData.type === 'deduction' ? 'text-emerald-900' : 'text-blue-900'
                      }`}>₹{customerStats.pendingPayments.toFixed(0)}</p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="input-base pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Amount</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">₹</div>
                      <input
                        required
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="input-base pl-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {customerStats && formData.amount && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 rounded-2xl bg-slate-900 text-white flex justify-between items-center shadow-xl"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('projectedBalance')}</span>
                  <span className={`font-display font-bold text-xl ${
                    customerStats.pendingPayments - (parseFloat(formData.amount) || 0) < 0 
                      ? 'text-rose-400' 
                      : 'text-emerald-400'
                  }`}>
                    ₹{(customerStats.pendingPayments - (parseFloat(formData.amount) || 0)).toFixed(0)}
                  </span>
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all shadow-xl hover:shadow-slate-200 active:scale-95 touch-btn"
              >
                {t('commitTransaction')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
