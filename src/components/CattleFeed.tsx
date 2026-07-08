import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User, Package, Edit2, X, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FeedType, FeedPurchase, Customer } from '../types';

interface CattleFeedProps {
  customerId?: string;
  isAdmin?: boolean;
}

export default function CattleFeed({ customerId, isAdmin = true }: CattleFeedProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'reductions' | 'types'>('purchases');
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [purchases, setPurchases] = useState<FeedPurchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<FeedType | null>(null);

  const [typeFormData, setTypeFormData] = useState({ name: '', rate: '' });
  const [purchaseFormData, setPurchaseFormData] = useState({
    customer_id: customerId ? customerId.toString() : '',
    feed_type_id: '',
    date: new Date().toISOString().split('T')[0],
    quantity: ''
  });

  useEffect(() => {
    fetchFeedTypes();
    fetchPurchases();
    if (isAdmin) fetchCustomers();
  }, [customerId, isAdmin]);

  const fetchFeedTypes = () => {
    fetch('/api/feed-types')
      .then(res => res.json())
      .then(data => setFeedTypes(data));
  };

  const fetchPurchases = () => {
    const url = customerId ? `/api/feed-purchases?customerId=${customerId}` : '/api/feed-purchases';
    fetch(url)
      .then(res => res.json())
      .then(data => setPurchases(data));
  };

  const fetchCustomers = () => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingType ? `/api/feed-types/${editingType.id}` : '/api/feed-types';
    const method = editingType ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: typeFormData.name,
        rate: parseFloat(typeFormData.rate)
      })
    });

    setIsTypeModalOpen(false);
    setEditingType(null);
    setTypeFormData({ name: '', rate: '' });
    fetchFeedTypes();
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/feed-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...purchaseFormData,
        customer_id: purchaseFormData.customer_id,
        feed_type_id: purchaseFormData.feed_type_id,
        quantity: parseFloat(purchaseFormData.quantity)
      })
    });

    if (response.ok) {
      const data = await response.json();
      const customer = customers.find(c => c.id.toString() === purchaseFormData.customer_id);
      const customerName = customer ? customer.name : '';
      const feedType = feedTypes.find(t => t.id.toString() === purchaseFormData.feed_type_id);
      const feedName = feedType ? feedType.name : '';
      const rate = feedType ? feedType.rate : 0;
      
      const newPurchase: FeedPurchase = {
        id: data.id || Date.now().toString(),
        customer_id: purchaseFormData.customer_id,
        customer_name: customerName,
        feed_type_id: purchaseFormData.feed_type_id,
        feed_name: feedName,
        date: purchaseFormData.date,
        quantity: parseFloat(purchaseFormData.quantity),
        amount: parseFloat(purchaseFormData.quantity) * rate,
        created_at: new Date().toISOString()
      };

      setPurchases(prev => [newPurchase, ...prev]);
    }

    setIsPurchaseModalOpen(false);
    setPurchaseFormData({ ...purchaseFormData, quantity: '' });
    fetchPurchases();
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm('Delete this feed type?')) return;
    try {
      const response = await fetch(`/api/feed-types/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchFeedTypes();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete type');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!window.confirm('Delete this purchase record?')) return;
    const previousPurchases = [...purchases];
    setPurchases(prev => prev.filter(p => p.id !== id));
    try {
      const response = await fetch(`/api/feed-purchases/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchPurchases();
      } else {
        setPurchases(previousPurchases);
        const data = await response.json();
        alert(data.message || 'Failed to delete purchase');
      }
    } catch (err) {
      setPurchases(previousPurchases);
      alert('Error connecting to server');
    }
  };

  const handleReductionChange = async (id: string, val: string) => {
    const valFloat = parseFloat(val) || 0;
    setCustomers(prev => prev.map(c => c.id.toString() === id ? { ...c, cattle_feed_reduction: valFloat } : c));
    try {
      await fetch(`/api/customers/${id}/feed-reduction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cattle_feed_reduction: valFloat })
      });
    } catch (err) {
      alert('Error saving reduction amount');
    }
  };

  // Helper to calculate total feed purchase for any customer
  const getCustomerTotalFeed = (custId: string) => {
    return purchases
      .filter(p => p.customer_id.toString() === custId.toString())
      .reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Tab bar + Add button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all touch-btn ${
              activeTab === 'purchases' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            Feed Purchases
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('reductions')}
                className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all touch-btn ${
                  activeTab === 'reductions' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Reductions
              </button>
              <button
                onClick={() => setActiveTab('types')}
                className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all touch-btn ${
                  activeTab === 'types' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Inventory
              </button>
            </>
          )}
        </div>

        {isAdmin && activeTab !== 'reductions' && (
          <button
            onClick={() => activeTab === 'purchases' ? setIsPurchaseModalOpen(true) : setIsTypeModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-bold text-sm touch-btn w-full sm:w-auto"
          >
            <Plus size={18} />
            {activeTab === 'purchases' ? 'Record Purchase' : 'Add Feed Type'}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'purchases' && (
          <motion.div
            key="purchases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Desktop table */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse mobile-compact-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Date</th>
                      {isAdmin && <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Customer</th>}
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Feed</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Qty</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Amount</th>
                      {isAdmin && <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider text-right">Del</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-3 md:p-4 text-slate-600 text-xs md:text-sm">{p.date}</td>
                        {isAdmin && <td className="p-3 md:p-4 font-medium text-slate-900 text-xs md:text-sm">{p.customer_name}</td>}
                        <td className="p-3 md:p-4 text-slate-900 text-xs md:text-sm">{p.feed_name}</td>
                        <td className="p-3 md:p-4 text-slate-600 font-medium text-xs md:text-sm">{p.quantity} U</td>
                        <td className="p-3 md:p-4 text-orange-600 font-bold text-xs md:text-sm">₹{p.amount.toFixed(0)}</td>
                        {isAdmin && (
                          <td className="p-3 md:p-4 text-right">
                            <button
                              onClick={() => handleDeletePurchase(p.id)}
                              className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 touch-btn"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {purchases.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 4} className="p-8 text-center text-slate-400 italic text-sm">
                          No feed purchases recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2.5">
              {purchases.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-200 mx-auto mb-3">
                    <Package size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">No Purchases</p>
                  <p className="text-xs text-slate-300 mt-1">Tap "Record Purchase" to log cattle feed.</p>
                </div>
              )}
              {purchases.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0">
                        <Package size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{p.feed_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">{p.date}</span>
                          {isAdmin && <span className="text-[10px] text-slate-400">· {p.customer_name}</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{p.quantity} Units</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-base font-display font-black text-orange-600">₹{p.amount.toFixed(0)}</p>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeletePurchase(p.id)}
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
          </motion.div>
        )}

        {activeTab === 'reductions' && (
          <motion.div
            key="reductions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Desktop reduction table */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden hidden sm:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse mobile-compact-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Customer Name</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Total Cattle Feed</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Cattle Feed Reduction</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Net Cattle Feed</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((c) => {
                      const totalFeed = getCustomerTotalFeed(c.id);
                      const reduction = c.cattle_feed_reduction || 0;
                      const netFeed = Math.max(0, totalFeed - reduction);
                      const remainingBalance = netFeed;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 md:p-4 font-bold text-slate-900 text-xs md:text-sm">{c.name}</td>
                          <td className="p-3 md:p-4 text-slate-600 text-xs md:text-sm">₹{totalFeed.toFixed(2)}</td>
                          <td className="p-3 md:p-4">
                            <div className="relative max-w-[120px]">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                              <input
                                type="number"
                                step="any"
                                value={reduction || ''}
                                onChange={(e) => handleReductionChange(c.id.toString(), e.target.value)}
                                className="w-full pl-6 pr-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500"
                                placeholder="0.00"
                              />
                            </div>
                          </td>
                          <td className="p-3 md:p-4 text-emerald-600 font-bold text-xs md:text-sm">₹{netFeed.toFixed(2)}</td>
                          <td className="p-3 md:p-4 text-orange-600 font-bold text-xs md:text-sm">₹{remainingBalance.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile reduction cards */}
            <div className="sm:hidden space-y-2.5">
              {customers.map((c) => {
                const totalFeed = getCustomerTotalFeed(c.id);
                const reduction = c.cattle_feed_reduction || 0;
                const netFeed = Math.max(0, totalFeed - reduction);
                const remainingBalance = netFeed;
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-soft space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">ID: #{c.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Total Feed</p>
                        <p className="font-bold text-slate-700">₹{totalFeed.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-emerald-500 text-[10px] uppercase font-black tracking-wider">Net Feed</p>
                        <p className="font-bold text-emerald-600">₹{netFeed.toFixed(0)}</p>
                      </div>
                      <div className="col-span-2 pt-1">
                        <p className="text-slate-400 text-[10px] uppercase font-black tracking-wider mb-1">Reduction Amount</p>
                        <div className="relative w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                          <input
                            type="number"
                            step="any"
                            value={reduction || ''}
                            onChange={(e) => handleReductionChange(c.id.toString(), e.target.value)}
                            className="input-base pl-7 py-2"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Remaining Balance</span>
                        <span className="font-bold text-orange-600 text-sm">₹{remainingBalance.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {activeTab === 'types' && (
          <motion.div
            key="types"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
          >
            {feedTypes.map((type) => (
              <div key={type.id} className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl shadow-soft border border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                      <Package size={14} className="md:hidden" />
                      <Package size={16} className="hidden md:block" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm md:text-lg">{type.name}</h4>
                  </div>
                  <p className="text-slate-500 text-xs md:text-sm">Rate: <span className="text-emerald-600 font-bold">₹{type.rate} / Unit</span></p>
                </div>
                <div className="flex gap-1 md:gap-2">
                  <button
                    onClick={() => {
                      setEditingType(type);
                      setTypeFormData({ name: type.name, rate: type.rate.toString() });
                      setIsTypeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all touch-btn"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteType(type.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all touch-btn"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {feedTypes.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-200 mx-auto mb-3">
                  <Package size={24} />
                </div>
                <p className="text-sm font-bold text-slate-400">No Feed Types</p>
                <p className="text-xs text-slate-300 mt-1">Tap "Add Feed Type" to get started.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed Type Modal */}
      <AnimatePresence>
        {isTypeModalOpen && (
          <div className="sheet-overlay">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="sheet-panel"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
              <div className="flex-shrink-0 p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">{editingType ? 'Edit Feed Type' : 'Add Feed Type'}</h3>
                <button 
                  onClick={() => { setIsTypeModalOpen(false); setEditingType(null); }} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg touch-btn"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleTypeSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="sheet-body">
                  <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Feed Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Godrej Super Feed"
                    value={typeFormData.name}
                    onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rate per Unit (₹)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={typeFormData.rate}
                    onChange={(e) => setTypeFormData({ ...typeFormData, rate: e.target.value })}
                    className="input-base"
                  />
                </div>
                  </div> {/* end padding div */}
                </div> {/* end sheet-body */}
                <div className="sheet-footer flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsTypeModalOpen(false); setEditingType(null); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-xl font-bold transition-all text-sm touch-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm touch-btn"
                  >
                    {editingType ? 'Update Feed' : 'Save Feed'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && (
          <div className="sheet-overlay">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="sheet-panel"
            >
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Record Feed Purchase</h3>
                <button 
                  onClick={() => setIsPurchaseModalOpen(false)} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg touch-btn"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handlePurchaseSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="sheet-body">
                  <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User size={13} /> Customer
                  </label>
                  <select
                    required
                    value={purchaseFormData.customer_id}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, customer_id: e.target.value })}
                    className="input-base appearance-none"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Package size={13} /> Feed Type
                  </label>
                  <select
                    required
                    value={purchaseFormData.feed_type_id}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, feed_type_id: e.target.value })}
                    className="input-base appearance-none"
                  >
                    <option value="">Select Feed</option>
                    {feedTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (₹{t.rate})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={13} /> Date
                    </label>
                    <input
                      required
                      type="date"
                      value={purchaseFormData.date}
                      onChange={(e) => setPurchaseFormData({ ...purchaseFormData, date: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <ShoppingCart size={13} /> Quantity
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      placeholder="Qty"
                      value={purchaseFormData.quantity}
                      onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>
                
                {purchaseFormData.feed_type_id && purchaseFormData.quantity && (
                  <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-100 flex justify-between items-center">
                    <span className="text-orange-700 font-medium text-sm">Total Cost:</span>
                    <span className="text-lg font-bold text-orange-900 font-mono">
                      ₹{(parseFloat(purchaseFormData.quantity) * (feedTypes.find(t => t.id.toString() === purchaseFormData.feed_type_id)?.rate || 0)).toFixed(2)}
                    </span>
                  </div>
                )}

                  </div> {/* end padding div */}
                </div> {/* end sheet-body */}
                <div className="sheet-footer flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-xl font-bold transition-all text-sm touch-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm touch-btn"
                  >
                    Record Purchase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
