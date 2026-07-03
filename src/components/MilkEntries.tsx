import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Calendar, User, Droplets, Search, Filter, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MilkEntry, Customer } from '../types';
import { useTranslation } from '../i18n';

interface MilkEntriesProps {
  customerId?: string;
  isAdmin?: boolean;
  defaultRate?: number;
}

const getCurrentMonthKey = () => new Date().toISOString().substring(0, 7);

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'] as const;

type SortBy = 'date' | 'customer';
type SortDir = 'asc' | 'desc';

export default function MilkEntries({ customerId, isAdmin = true, defaultRate }: MilkEntriesProps) {
  const { t } = useTranslation();

  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const current = useMemo(() => new Date(), []);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => current.getMonth());
  const [selectedYear, setSelectedYear] = useState(() => current.getFullYear());

  const selectedMonthKey = useMemo(() => {
    const mm = String(selectedMonthIndex + 1).padStart(2, '0');
    return `${selectedYear}-${mm}`;
  }, [selectedMonthIndex, selectedYear]);

  const [query, setQuery] = useState('');
  const [dateInMonth, setDateInMonth] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all'>('all');

  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [formData, setFormData] = useState({
    customer_id: customerId ? customerId.toString() : '',
    date: new Date().toISOString().split('T')[0],
    shift: 'AM' as 'AM' | 'PM',
    liters: '',
    rate: defaultRate?.toString() || ''
  });

  useEffect(() => {
    if (customerId) {
      setFormData((prev) => ({
        ...prev,
        customer_id: customerId.toString(),
        rate: prev.rate || defaultRate?.toString() || '30',
      }));
    }
  }, [customerId, defaultRate]);

  useEffect(() => {
    if (formData.customer_id && isAdmin) {
      const customer = customers.find(c => c.id.toString() === formData.customer_id);
      if (customer && customer.default_rate) {
        setFormData(prev => ({ ...prev, rate: customer.default_rate?.toString() || '30' }));
      }
    }
  }, [formData.customer_id, customers, isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [selectedMonthKey, query, sortBy, sortDir, dateInMonth, paymentStatusFilter, pageSize, customerId]);

  const fetchEntries = () => {
    setIsLoadingEntries(true);
    const url = customerId ? `/api/entries?customerId=${customerId}` : '/api/entries';
    fetch(url)
      .then(res => res.json())
      .then(data => setEntries(data))
      .catch(() => {
        // keep empty state
      })
      .finally(() => setIsLoadingEntries(false));
  };

  useEffect(() => {
    fetchEntries();
    if (isAdmin) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isAdmin]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();

    let res = entries.filter((entry) => entry.date.startsWith(selectedMonthKey));

    if (dateInMonth) {
      res = res.filter((e) => e.date === dateInMonth);
    }

    if (q) {
      res = res.filter((e) => {
        const dateStr = new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
        return (
          e.customer_name?.toLowerCase().includes(q) ||
          e.customer_id?.toLowerCase().includes(q) ||
          String(e.rate).includes(q) ||
          dateStr.includes(q)
        );
      });
    }

    if (paymentStatusFilter !== 'all') {
      // backend currently does not return payment status in MilkEntry type
      // leaving filter placeholder to keep UI consistent
    }

    res = res.slice();
    res.sort((a, b) => {
      let va: number | string = '';
      let vb: number | string = '';

      if (sortBy === 'date') {
        va = a.date;
        vb = b.date;
      } else {
        va = a.customer_name || '';
        vb = b.customer_name || '';
      }

      if (typeof va === 'string' && typeof vb === 'string') {
        const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const cmp = Number(va) - Number(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return res;
  }, [entries, selectedMonthKey, query, dateInMonth, paymentStatusFilter, sortBy, sortDir]);

  const pagedEntries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, page, pageSize]);


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

  const monthEntriesGrouped = useMemo(() => {
    // Group by date + customer so we can show Morning/Evening in a single row
    type Row = {
      id: string;
      date: string;
      customer_id: string;
      customer_name: string;
      morningLiters: number;
      eveningLiters: number;
      rate: number;
      totalLiters: number;
      totalAmount: number;
    };

    const map = new Map<string, Row>();

    for (const e of filteredEntries) {
      const key = `${e.date}__${e.customer_id}`;
      const rate = e.rate ?? currentRate;

      const row = map.get(key) || {
        id: key,
        date: e.date,
        customer_id: e.customer_id,
        customer_name: e.customer_name || '',
        morningLiters: 0,
        eveningLiters: 0,
        rate,
        totalLiters: 0,
        totalAmount: 0,
      };

      if (e.shift === 'AM') row.morningLiters += e.liters;
      else row.eveningLiters += e.liters;

      row.rate = row.rate || rate;
      row.totalLiters = row.morningLiters + row.eveningLiters;
      row.totalAmount = row.totalLiters * row.rate;

      map.set(key, row);
    }


    const rows = Array.from(map.values());

    // Apply sort again at row level
    rows.sort((a, b) => {
      if (sortBy === 'date') {
        const cmp = a.date.localeCompare(b.date);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = (a.customer_name || '').localeCompare(b.customer_name || '', undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });


    return rows;
  }, [filteredEntries, currentRate, sortBy, sortDir]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return monthEntriesGrouped.slice(start, start + pageSize);
  }, [monthEntriesGrouped, page, pageSize]);

  const monthlyTotals = useMemo(() => {
    const totals = {
      morning: 0,
      evening: 0,
      total: 0,
      amount: 0,
    };

    for (const r of monthEntriesGrouped) {
      totals.morning += r.morningLiters;
      totals.evening += r.eveningLiters;
      totals.total += r.totalLiters;
      totals.amount += r.totalAmount;
    }

    return totals;
  }, [monthEntriesGrouped]);

  const isMobileTiny = typeof window !== 'undefined' ? window.innerWidth <= 540 : false;

  const monthLabel = `${monthNames[selectedMonthIndex]} ${selectedYear}`;

  return (
    <div className="space-y-4 md:space-y-10 relative">

      <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 p-4 md:p-6 space-y-4">
        {/* Top controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="page-title">{t('supplyJournal')}</h2>
              <p className="text-slate-500 text-sm">{isAdmin ? t('trackDailyCollections') : t('monitorContributions')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Month + Year */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value, 10))}
                  className="input-base !pr-8 !py-2.5 bg-white"
                  aria-label="Select month"
                >
                  {monthNames.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="input-base !pr-8 !py-2.5 bg-white"
                  aria-label="Select year"
                >
                  {Array.from({ length: 6 }).map((_, idx) => {
                    const y = current.getFullYear() - idx;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="search-bar w-full">
              <Search className="search-icon text-slate-400" />
              <input
                className="search-input"
                placeholder="Search by customer, date or rate..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">Date</label>
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={16} />
                <input
                  type="date"
                  value={dateInMonth}
                  onChange={(e) => setDateInMonth(e.target.value)}
                  className="input-base pl-9 !py-3"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSortBy('date');
                setSortDir((d) => (sortBy === 'date' ? (d === 'asc' ? 'desc' : 'asc') : 'desc'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 touch-btn font-bold text-sm text-slate-700"
            >
              <ArrowUpDown size={16} /> Date
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy('customer');
                setSortDir((d) => (sortBy === 'customer' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 touch-btn font-bold text-sm text-slate-700"
            >
              <User size={16} /> Customer
            </button>
          </div>

          <div className="text-sm font-bold text-slate-600">
            Showing: <span className="text-emerald-700">{monthLabel}</span>
          </div>
        </div>
      </div>

      {/* Fixed Add Entry: desktop */}
      {(
        isAdmin || Boolean(customerId)
      ) && (
        <button
          onClick={() => {
            setFormData(prev => ({
              ...prev,
              customer_id: customerId ? customerId.toString() : prev.customer_id,
              date: new Date().toISOString().split('T')[0],
            }));
            setIsModalOpen(true);
          }}
          className="hidden sm:flex fixed top-24 right-6 z-[60] items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 touch-btn"
          aria-label="Add entry"
        >
          <Plus size={18} /> {t('newEntry')}
        </button>
      )}

      {/* Sticky Add Entry: mobile */}
      {(
        isAdmin || Boolean(customerId)
      ) && (
        <div className="sm:hidden fixed bottom-0 right-0 z-[70] px-3 pb-4 pt-2 safe-area-inset-bottom">
          <button
            onClick={() => {
              setFormData(prev => ({
                ...prev,
                customer_id: customerId ? customerId.toString() : prev.customer_id,
                date: new Date().toISOString().split('T')[0],
              }));
              setIsModalOpen(true);
            }}
            className="w-auto bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 touch-btn"
            aria-label="Add entry"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Plus size={18} /> {t('newEntry')}
            </span>
          </button>
        </div>
      )}


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
      {/* Loading */}
      {isLoadingEntries && (
        <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
            <Droplets size={28} />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-400">Loading entries...</p>
        </div>
      )}

      {/* Table — desktop & tablet */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto table-scroll-wrapper">
          <table className="w-full text-left border-collapse mobile-compact-table">
            <thead className="sticky top-0 z-10">
              <tr className="bg-white/95 backdrop-blur border-b border-slate-100">
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Date</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Customer Name</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Morning Milk (L)</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Evening Milk (L)</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Total Milk (L)</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Rate per Liter</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Total Amount</th>
                <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Payment Status</th>
                {isAdmin && <th className="px-4 md:px-10 py-3 md:py-5 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">

              {pagedRows.map((row: any) => (
                <tr key={row.id} className="group hover:bg-emerald-50/20 transition-all">
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{new Date(row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-0.5">{new Date(row.date).getFullYear()}</p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <p className="font-bold text-slate-700 text-xs md:text-sm tracking-tight truncate max-w-[120px] md:max-w-none">{row.customer_name}</p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{row.morningLiters.toFixed(1)} <span className="text-[9px] uppercase">L</span></p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{row.eveningLiters.toFixed(1)} <span className="text-[9px] uppercase">L</span></p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                    <p className="text-xs md:text-sm font-bold text-slate-900">{row.totalLiters.toFixed(1)} <span className="text-[9px] uppercase">L</span></p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                    <p className="text-[10px] font-bold text-slate-700">₹{row.rate}/L</p>
                  </td>
                  <td className="px-4 md:px-10 py-3 md:py-6 text-right font-display font-black text-emerald-600 text-base md:text-lg tracking-tight">₹{row.totalAmount.toFixed(0)}</td>
                  <td className="px-4 md:px-10 py-3 md:py-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-widest">
                      Paid
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 md:px-10 py-3 md:py-6 text-right">
                      <button
                        disabled={deletingId === row.id}
                        onClick={() => setShowConfirmModal(row.id)}
                        className={`w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center mx-auto md:ml-auto md:mr-0 touch-btn ${
                          deletingId === row.id 
                            ? 'text-slate-200 bg-slate-50' 
                            : 'text-rose-400 hover:bg-rose-50 hover:text-rose-600 shadow-sm'
                        }`}
                      >
                        <Trash2 size={16} className={deletingId === row.id ? 'animate-pulse' : ''} />
                      </button>
                    </td>
                  )}

                </tr>
              ))}
              {monthEntriesGrouped.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="py-16 md:py-32 text-center">
                    <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4 md:mb-6">
                      <Droplets size={28} className="md:hidden" />
                      <Droplets size={40} className="hidden md:block" />
                    </div>
                    <p className="text-sm md:text-lg font-display font-bold text-slate-400">No Entries Found</p>
                    <p className="text-xs md:text-sm text-slate-300 font-medium">for {monthLabel}</p>
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
            className="bg-white rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl w-full sm:max-w-md max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-hidden border border-white/20 flex flex-col"
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
