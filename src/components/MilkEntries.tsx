import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User, Droplets, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MilkEntry, Customer } from '../types';
import { useTranslation } from '../i18n';

interface MilkEntriesProps {
  customerId?: string;
  isAdmin?: boolean;
  defaultRate?: number;
}

const getCurrentMonth = () => new Date().toISOString().substring(0, 7);

export default function MilkEntries({ customerId, isAdmin = true, defaultRate }: MilkEntriesProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());

  const [formData, setFormData] = useState({
    customer_id: customerId ? customerId.toString() : '',
    date: new Date().toISOString().split('T')[0],
    shift: 'AM' as 'AM' | 'PM',
    liters: '',
    rate: defaultRate?.toString() || ''
  });

  useEffect(() => {
    if (formData.customer_id && isAdmin) {
      const customer = customers.find(c => c.id.toString() === formData.customer_id);
      if (customer && customer.default_rate) {
        setFormData(prev => ({ ...prev, rate: customer.default_rate?.toString() || '30' }));
      }
    }
  }, [formData.customer_id, customers, isAdmin]);

  useEffect(() => {
    fetchEntries();
    if (isAdmin) fetchCustomers();
  }, [customerId, isAdmin]);

  const fetchEntries = () => {
    const url = customerId ? `/api/entries?customerId=${customerId}` : '/api/entries';
    fetch(url)
      .then(res => res.json())
      .then(data => setEntries(data));
  };

  const filteredEntries = entries.filter((entry) => entry.date.startsWith(selectedMonth));

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        customer_id: formData.customer_id,
        liters: parseFloat(formData.liters),
        rate: formData.rate ? parseFloat(formData.rate) : undefined
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.message || 'Failed to save entry');
      return;
    }

    setIsModalOpen(false);
    
    const customer = customers.find(c => c.id.toString() === formData.customer_id);
    const customerName = customer ? customer.name : '';
    
    const newEntry: MilkEntry = {
      id: data.id || Date.now().toString(),
      customer_id: formData.customer_id,
      customer_name: customerName,
      date: formData.date,
      shift: formData.shift,
      liters: parseFloat(formData.liters),
      rate: currentRate,
      amount: parseFloat(formData.liters) * currentRate,
      created_at: new Date().toISOString()
    };

    setEntries(prev => [newEntry, ...prev]);
    setFormData({ ...formData, customer_id: customerId ? customerId.toString() : '', liters: '' });
    fetchEntries();
  };

  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const previousEntries = [...entries];
    setEntries(prev => prev.filter(entry => entry.id !== id));
    
    setDeletingId(id);
    setShowConfirmModal(null);
    try {
      const response = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchEntries();
      } else {
        setEntries(previousEntries);
        const data = await response.json();
        alert(data.message || 'Failed to delete entry');
      }
    } catch (err) {
      setEntries(previousEntries);
      alert('Error connecting to server');
    } finally {
      setDeletingId(null);
    }
  };

  const currentRate = formData.rate ? parseFloat(formData.rate) : (isAdmin ? 30 : (defaultRate || 30));

  return (
    <div className="space-y-4 md:space-y-10 relative">
      <AnimatePresence>
        {showConfirmModal !== null && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-2xl p-6 md:p-10 max-w-sm w-full text-center border border-white/20"
            >
              <div className="w-14 h-14 md:w-20 md:h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-inner">
                <Trash2 size={24} className="md:hidden" />
                <Trash2 size={32} className="hidden md:block" />
              </div>
              <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 mb-2 md:mb-3 tracking-tight">Erase Entry?</h3>
              <p className="text-slate-400 font-medium mb-6 md:mb-8 text-sm leading-relaxed">This will permanently remove this milk supply record from the journal.</p>
              <div className="flex gap-3 md:gap-4">
                <button 
                  onClick={() => setShowConfirmModal(null)}
                  className="flex-1 py-3 md:py-4 px-4 rounded-xl md:rounded-2xl border border-slate-100 font-black text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all active:scale-95 touch-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(showConfirmModal!)}
                  className="flex-1 py-3 md:py-4 px-4 rounded-xl md:rounded-2xl bg-rose-500 font-black text-[11px] uppercase tracking-widest text-white hover:bg-rose-600 transition-all shadow-lg shadow-rose-100 active:scale-95 touch-btn"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">{t('supplyJournal')}</h2>
          <p className="text-slate-500 text-sm">{isAdmin ? t('trackDailyCollections') : t('monitorContributions')}</p>
        </div>
        <div>
          <button
            onClick={() => { setFormData(prev => ({ ...prev, customer_id: customerId ? customerId.toString() : '', date: new Date().toISOString().split('T')[0] })); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-black"
          >
            <Plus size={16} /> {t('newEntry')}
          </button>
        </div>
      </div>

      {/* Table — desktop & tablet (reintroduced) */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mobile-compact-table">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] md:text-[10px] uppercase tracking-[0.2em]">Date</th>
                <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Shift</th>
                {isAdmin && <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Farmer</th>}
                <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Volume</th>
                <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Amount</th>
                {isAdmin && <th className="px-4 md:px-10 py-3 md:py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Del</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="group hover:bg-emerald-50/20 transition-all">
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-0.5">{new Date(entry.date).getFullYear()}</p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <span className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-widest ${
                      entry.shift === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700 shadow-sm'
                    }`}>
                      {entry.shift === 'AM' ? 'AM' : 'PM'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 md:px-10 py-3 md:py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px] uppercase">
                          {entry.customer_name?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 text-xs md:text-sm tracking-tight truncate max-w-[80px] md:max-w-none">{entry.customer_name}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{entry.liters.toFixed(1)} <span className="text-[9px] uppercase">L</span></p>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-0.5">@ ₹{entry.rate}/L</p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 font-display font-black text-emerald-600 text-base md:text-lg tracking-tight">₹{entry.amount.toFixed(0)}</td>
                  {isAdmin && (
                    <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                      <button
                        disabled={deletingId === entry.id}
                        onClick={() => setShowConfirmModal(entry.id)}
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center mx-auto md:ml-auto md:mr-0 touch-btn ${
                          deletingId === entry.id 
                            ? 'text-slate-200 bg-slate-50' 
                            : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600 shadow-sm'
                        }`}
                      >
                        <Trash2 size={16} className={deletingId === entry.id ? 'animate-pulse' : ''} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 4} className="py-16 md:py-32 text-center">
                    <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4 md:mb-6">
                      <Droplets size={28} className="md:hidden" />
                      <Droplets size={40} className="hidden md:block" />
                    </div>
                    <p className="text-sm md:text-lg font-display font-bold text-slate-400">{t('noEntriesYet')}</p>
                    <p className="text-xs md:text-sm text-slate-300 font-medium">{t('noLogisticalEntries')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Mobile Card View — xs screens only (reintroduced) */}
      <div className="sm:hidden space-y-2">
        {filteredEntries.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-3">
              <Droplets size={28} />
            </div>
            <p className="text-sm font-bold text-slate-400">{t('noEntriesYet')}</p>
            <p className="text-xs text-slate-300 font-medium mt-1">{t('tapNewEntry')}</p>
          </div>
        )}
        {filteredEntries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  entry.shift === 'AM' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  <Droplets size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">
                      {new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      entry.shift === 'AM' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                    }`}>{entry.shift}</span>
                  </div>
                  {isAdmin && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{entry.customer_name}</p>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-base font-display font-black text-emerald-600">₹{entry.amount.toFixed(0)}</p>
                <p className="text-[10px] text-slate-400">{entry.liters.toFixed(1)} L · ₹{entry.rate}/L</p>
              </div>
            </div>
            {isAdmin && (
              <div className="flex justify-end mt-2 pt-2 border-t border-slate-50">
                <button
                  disabled={deletingId === entry.id}
                  onClick={() => setShowConfirmModal(entry.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-50 transition-colors touch-btn"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-md overflow-hidden border border-white/20"
          >
            {/* Drag handle on mobile */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
            
            <div className="p-5 sm:p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg sm:text-2xl font-display font-bold text-slate-900 tracking-tight">{t('milkEntry')}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{t('supplyReconciliation')}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all touch-btn"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-4 sm:space-y-8 modal-scroll">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-black uppercase tracking-widest border border-rose-100 flex items-center gap-2 shadow-sm"
                >
                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse flex-shrink-0" />
                  {error}
                </motion.div>
              )}
              
              <div className="space-y-4">
                {isAdmin && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                      Select Farmer
                    </label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={16} />
                      <select
                        required
                        value={formData.customer_id}
                        onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                        className="input-base pl-9 appearance-none"
                      >
                        <option value="">Farmer lookup...</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Date</label>
                  <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={16} />
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="input-base pl-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Volume (L)</label>
                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs uppercase">L</div>
                      <input
                        required
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        value={formData.liters}
                        onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                        className="input-base pl-8"
                      />
                    </div>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Rate (₹/L)</label>
                      <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">₹</div>
                        <input
                          required
                          type="number"
                          step="0.1"
                          placeholder="30.0"
                          value={formData.rate}
                          onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                          className="input-base pl-8"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Batch Schedule</label>
                  <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: 'AM' })}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all touch-btn ${
                        formData.shift === 'AM' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      🌅 Morning
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shift: 'PM' })}
                      className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all touch-btn ${
                        formData.shift === 'PM' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      🌙 Evening
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-900 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-0.5">Estimated Valuation</p>
                    <p className="text-2xl sm:text-4xl font-display font-bold tracking-tight">
                      ₹{formData.liters ? (parseFloat(formData.liters) * currentRate).toFixed(0) : '0'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Active Rate</p>
                    <p className="text-sm font-bold text-emerald-400">₹{currentRate}/L</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 text-white py-4 sm:py-5 rounded-xl sm:rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all shadow-xl hover:shadow-slate-200 active:scale-95 touch-btn"
              >
                {t('recordEntry')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
