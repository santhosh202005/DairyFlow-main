import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User, Package, Edit2, X, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FeedType, FeedPurchase, Customer } from '../types';

interface CattleFeedProps {
  customerId?: string;
  isAdmin?: boolean;
}

export default function CattleFeed({ customerId, isAdmin = true }: CattleFeedProps) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'types'>(isAdmin ? 'purchases' : 'purchases');
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
    await fetch('/api/feed-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...purchaseFormData,
        customer_id: purchaseFormData.customer_id,
        feed_type_id: purchaseFormData.feed_type_id,
        quantity: parseFloat(purchaseFormData.quantity)
      })
    });

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
    try {
      const response = await fetch(`/api/feed-purchases/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchPurchases();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to delete purchase');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'purchases' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            Feed Purchases
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('types')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'types' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              Feed Inventory
            </button>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => activeTab === 'purchases' ? setIsPurchaseModalOpen(true) : setIsTypeModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm w-full md:w-auto justify-center"
          >
            <Plus size={20} />
            {activeTab === 'purchases' ? 'Record Purchase' : 'Add Feed Type'}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'purchases' ? (
          <motion.div
            key="purchases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Date</th>
                  {isAdmin && <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Customer</th>}
                  <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Feed Name</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Quantity</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Total Cost</th>
                  {isAdmin && <th className="p-4 font-semibold text-slate-600 text-sm uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600">{p.date}</td>
                    {isAdmin && <td className="p-4 font-medium text-slate-900">{p.customer_name}</td>}
                    <td className="p-4 text-slate-900">{p.feed_name}</td>
                    <td className="p-4 text-slate-600 font-medium">{p.quantity} Units</td>
                    <td className="p-4 text-orange-600 font-bold">₹{p.amount.toFixed(2)}</td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeletePurchase(p.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 4} className="p-8 text-center text-slate-400 italic">
                      No feed purchases recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <motion.div
            key="types"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {feedTypes.map((type) => (
              <div key={type.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                      <Package size={18} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">{type.name}</h4>
                  </div>
                  <p className="text-slate-500 text-sm">Sale Rate: <span className="text-emerald-600 font-bold">₹{type.rate} / Unit</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingType(type);
                      setTypeFormData({ name: type.name, rate: type.rate.toString() });
                      setIsTypeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteType(type.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed Type Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">{editingType ? 'Edit Feed Type' : 'Add Feed Type'}</h3>
              <button 
                onClick={() => { setIsTypeModalOpen(false); setEditingType(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleTypeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Feed Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Godrej Super Feed"
                  value={typeFormData.name}
                  onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rate per Unit (₹)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={typeFormData.rate}
                  onChange={(e) => setTypeFormData({ ...typeFormData, rate: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md"
                >
                  {editingType ? 'Update Feed' : 'Save Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Record Feed Purchase</h3>
              <button 
                onClick={() => setIsPurchaseModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <User size={16} /> Customer
                </label>
                <select
                  required
                  value={purchaseFormData.customer_id}
                  onChange={(e) => setPurchaseFormData({ ...purchaseFormData, customer_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Package size={16} /> Feed Type
                </label>
                <select
                  required
                  value={purchaseFormData.feed_type_id}
                  onChange={(e) => setPurchaseFormData({ ...purchaseFormData, feed_type_id: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select Feed</option>
                  {feedTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (₹{t.rate})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <Calendar size={16} /> Date
                  </label>
                  <input
                    required
                    type="date"
                    value={purchaseFormData.date}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, date: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                    <ShoppingCart size={16} /> Quantity
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={purchaseFormData.quantity}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              
              {purchaseFormData.feed_type_id && purchaseFormData.quantity && (
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                  <span className="text-orange-700 font-medium">Total Cost:</span>
                  <span className="text-xl font-bold text-orange-900 font-mono">
                    ₹{(parseFloat(purchaseFormData.quantity) * (feedTypes.find(t => t.id.toString() === purchaseFormData.feed_type_id)?.rate || 0)).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md"
                >
                  Record Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
