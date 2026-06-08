import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Wallet, User, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Advance, Customer } from '../types';

interface AdvancesProps {
  customerId?: string;
  isAdmin?: boolean;
}

export default function Advances({ customerId, isAdmin = true }: AdvancesProps) {
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
      // For customers, show their personal financial summary in the header
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
    await fetch('/api/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        customer_id: formData.customer_id,
        amount: parseFloat(formData.amount)
      })
    });

    setIsModalOpen(false);
    setFormData({ ...formData, customer_id: customerId ? customerId.toString() : '', amount: '' });
    fetchAdvances();
  };

  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
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
          fetch('/api/stats')
            .then(res => res.json())
            .then(d => setGlobalStats(d));
        }
      } else {
        alert(data.message || 'Could not delete record.');
      }
    } catch (err) {
      alert('Error connecting to server.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal !== null && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Advance?</h3>
              <p className="text-slate-500 mb-6">Are you sure you want to delete this record? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfirmModal(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(showConfirmModal)}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              Financial Ledger
            </span>
          </div>
          <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight leading-none mb-2">
            Advances & <span className="text-blue-600">Payouts</span>
          </h2>
          <p className="text-slate-500 font-medium max-w-md">
            {isAdmin ? "Oversee customer lending and monthly bill settlements." : "Review your advance history and current outstanding balance."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {globalStats && (
            <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-soft">
              <div className="px-4 border-r border-slate-100 last:border-0 text-center md:text-left">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{isAdmin ? 'Gross' : 'Total'}</p>
                <p className="text-lg font-display font-bold text-slate-900">₹{globalStats.monthlyRevenue.toFixed(0)}</p>
              </div>
              <div className="px-4 border-r border-slate-100 last:border-0 text-center md:text-left">
                <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">Repaid</p>
                <p className="text-lg font-display font-bold text-emerald-600">₹{((globalStats.monthlyDeductions || 0) + (isAdmin ? globalStats.monthlyFeed : 0)).toFixed(0)}</p>
              </div>
              <div className="px-4 border-r border-slate-100 last:border-0 text-center md:text-left">
                <p className="text-[10px] text-orange-500 uppercase font-black tracking-widest mb-1">Debt</p>
                <p className="text-lg font-display font-bold text-orange-600">₹{globalStats.advanceBalance !== undefined ? globalStats.advanceBalance.toFixed(0) : (globalStats.totalAdvanceBalance ?? 0).toFixed(0)}</p>
              </div>
              <div className="px-4 border-r border-slate-100 last:border-0 text-center md:text-left">
                <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest mb-1">Net</p>
                <p className="text-lg font-display font-bold text-blue-700">₹{globalStats.pendingPayments.toFixed(0)}</p>
              </div>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 shrink-0"
            >
              <Plus size={20} />
              New Entry
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Timeline</th>
                {isAdmin && <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Recipient</th>}
                <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em]">Transaction Type</th>
                <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Value</th>
                {isAdmin && <th className="px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {advances.map((advance) => (
                <tr key={advance.id} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-slate-900">{new Date(advance.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{new Date(advance.date).getFullYear()}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                          {advance.customer_name?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 text-sm tracking-tight">{advance.customer_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      advance.type === 'deduction' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${advance.type === 'deduction' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      {advance.type === 'deduction' ? 'Bill Reduction' : 'Cash Advance'}
                    </span>
                  </td>
                  <td className={`px-8 py-6 font-display font-bold text-right text-lg ${
                    advance.type === 'deduction' ? 'text-emerald-700' : 'text-blue-700'
                  }`}>₹{advance.amount.toFixed(0)}</td>
                  {isAdmin && (
                    <td className="px-8 py-6 text-right">
                      <button
                        disabled={deletingId === advance.id}
                        onClick={() => setShowConfirmModal(advance.id)}
                        className={`p-3 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm ${
                          deletingId === advance.id 
                            ? 'text-slate-200 bg-slate-50' 
                            : 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        <Trash2 size={18} className={deletingId === advance.id ? 'animate-pulse' : ''} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {advances.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 3} className="p-20 text-center">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-4">
                      <Wallet size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-400">Zero Ledger</p>
                    <p className="text-xs text-slate-300">No transactions recorded for this period.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20"
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-display font-bold text-slate-900 tracking-tight">New Transaction</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Financial Reconciliation</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'advance' })}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    formData.type === 'advance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Give Advance
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'deduction' })}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    formData.type === 'deduction' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Bill Reduction
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                    Select Farmer
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <select
                      required
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold text-slate-700 appearance-none"
                    >
                      <option value="">Choose a customer...</option>
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
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-1">Current Gross</p>
                        <p className="text-sm font-display font-bold text-slate-900">₹{customerStats.monthlyRevenue.toFixed(0)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                        <p className="text-[8px] text-orange-600 uppercase font-black tracking-widest mb-1">Total Debt</p>
                        <p className="text-sm font-display font-bold text-orange-900">₹{customerStats.advanceBalance.toFixed(0)}</p>
                      </div>
                    </div>
                    
                    <div className={`p-5 rounded-[1.5rem] border transition-colors ${
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
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all text-white shadow-md active:scale-95 ${
                            formData.type === 'deduction' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          Auto Fill
                        </button>
                      </div>
                      <p className={`text-3xl font-display font-bold tracking-tight ${
                        formData.type === 'deduction' ? 'text-emerald-900' : 'text-blue-900'
                      }`}>₹{customerStats.pendingPayments.toFixed(0)}</p>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input
                        required
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold text-slate-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                      Amount
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">₹</div>
                      <input
                        required
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {customerStats && formData.amount && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl bg-slate-900 text-white flex justify-between items-center shadow-xl"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projected Balance</span>
                  <span className={`font-display font-bold text-xl ${
                    customerStats.pendingPayments - (parseFloat(formData.amount) || 0) < 0 
                      ? 'text-rose-400' 
                      : 'text-emerald-400'
                  }`}>
                    ₹{(customerStats.pendingPayments - (parseFloat(formData.amount) || 0)).toFixed(0)}
                  </span>
                </motion.div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all shadow-xl hover:shadow-slate-200 active:scale-95"
                >
                  Commit Transaction
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
