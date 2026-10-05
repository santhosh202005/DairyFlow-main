import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, User, Package, Edit2, X, ShoppingCart, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FeedType, FeedPurchase, FeedReduction, Customer } from '../types';
import { useTranslation } from '../i18n';

interface CattleFeedProps {
  customerId?: string;
  vendorId?: string;
  isAdmin?: boolean;
  isVendor?: boolean;
}

export default function CattleFeed({ customerId, vendorId, isVendor = false }: CattleFeedProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'purchases' | 'reductions' | 'types'>('purchases');
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [purchases, setPurchases] = useState<FeedPurchase[]>([]);
  const [reductions, setReductions] = useState<FeedReduction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reductionDrafts, setReductionDrafts] = useState<Record<string, string>>({});
  const [savingCustomerId, setSavingCustomerId] = useState<string | null>(null);
  const [deletingReductionCustomerId, setDeletingReductionCustomerId] = useState<string | null>(null);
  const [editingReductionCustomerId, setEditingReductionCustomerId] = useState<string | null>(null);
  
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
    fetchReductions();
    if (isVendor) fetchCustomers();
  }, [customerId, vendorId, isVendor]);

  const fetchFeedTypes = () => {
    fetch('/api/feed-types')
      .then(res => res.json())
      .then(data => setFeedTypes(data));
  };

  const fetchPurchases = () => {
    let url = '/api/feed-purchases';
    if (customerId) url = `/api/feed-purchases?customerId=${customerId}`;
    else if (vendorId) url = `/api/feed-purchases?vendorId=${vendorId}`;
    fetch(url)
      .then(res => res.json())
      .then(data => setPurchases(data));
  };

  const fetchReductions = () => {
    let url = '/api/feed-reductions';
    if (customerId) url = `/api/feed-reductions?customerId=${customerId}`;
    else if (vendorId) url = `/api/feed-reductions?vendorId=${vendorId}`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Could not load feed reductions');
        return res.json();
      })
      .then(data => setReductions(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchCustomers = () => {
    const url = vendorId ? `/api/customers?vendorId=${vendorId}` : '/api/customers';
    fetch(url)
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
        rate: Number(typeFormData.rate)
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
      const unitPrice = Number(data.unit_price) || Number(feedType?.rate) || 0;
      
      const newPurchase: FeedPurchase = {
        id: data.id || Date.now().toString(),
        customer_id: purchaseFormData.customer_id,
        customer_name: customerName,
        feed_type_id: purchaseFormData.feed_type_id,
        feed_name: feedName,
        date: purchaseFormData.date,
        quantity: parseFloat(purchaseFormData.quantity),
        unit_price: unitPrice,
        amount: Number(data.amount) || parseFloat(purchaseFormData.quantity) * unitPrice,
        created_at: new Date().toISOString()
      };

      setPurchases(prev => [newPurchase, ...prev]);
    }

    setIsPurchaseModalOpen(false);
    setPurchaseFormData({ ...purchaseFormData, quantity: '' });
    fetchPurchases();
  };

  const handleDeleteType = async (id: string) => {
    if (!window.confirm(t('confirmDeleteFeedType'))) return;
    try {
      const response = await fetch(`/api/feed-types/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchFeedTypes();
      } else {
        const data = await response.json();
        alert(data.message || t('failedDeleteFeedType'));
      }
    } catch (err) {
      alert(t('serverConnectionError'));
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (!window.confirm(t('confirmDeleteFeedPurchase'))) return;
    const previousPurchases = [...purchases];
    setPurchases(prev => prev.filter(p => p.id !== id));
    try {
      const response = await fetch(`/api/feed-purchases/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchPurchases();
      } else {
        setPurchases(previousPurchases);
        const data = await response.json();
        alert(data.message || t('failedDeleteFeedPurchase'));
      }
    } catch (err) {
      setPurchases(previousPurchases);
      alert(t('serverConnectionError'));
    }
  };

  const saveReduction = async (id: string) => {
    const items = feedTypes.map(type => ({
      feed_type_id: type.id,
      quantity: Number(reductionDrafts[`${id}:${type.id}`] ?? reductions.find(r =>
        r.customer_id.toString() === id && r.month === currentMonth && r.feed_type_id?.toString() === type.id.toString()
      )?.quantity ?? 0)
    }));
    setSavingCustomerId(id);
    try {
      const response = await fetch('/api/feed-reductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: id, month: currentMonth, items })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save reduction');
      setReductionDrafts(prev => Object.fromEntries([
        ...Object.entries(prev).filter(([key]) => !key.startsWith(`${id}:`)),
        ...items.map(item => [`${id}:${item.feed_type_id}`, String(item.quantity)])
      ]));
      setReductions(prev => [
        ...(data.reductions || []),
        ...prev.filter(record => !(record.customer_id.toString() === id && record.month === currentMonth))
      ]);
      setEditingReductionCustomerId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('errorSavingReduction'));
    } finally {
      setSavingCustomerId(null);
    }
  };

  const deleteMonthlyReduction = async (id: string) => {
    if (!window.confirm(t('confirmDeleteMonthlyReduction').replace('{month}', currentMonth))) return;
    setDeletingReductionCustomerId(id);
    try {
      const response = await fetch(`/api/feed-reductions/${id}/${currentMonth}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not delete monthly feed reduction');
      setReductions(prev => prev.filter(record => !(record.customer_id.toString() === id && record.month === currentMonth)));
      setReductionDrafts(prev => Object.fromEntries(
        Object.entries(prev).filter(([key]) => !key.startsWith(`${id}:`))
      ));
      setEditingReductionCustomerId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t('errorDeletingMonthlyReduction'));
    } finally {
      setDeletingReductionCustomerId(null);
    }
  };

  const now = new Date();
  const latestMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = selectedMonth;
  const monthPurchases = purchases.filter(purchase => purchase.date.slice(0, 7) === selectedMonth);
  const visibleCustomers = customers.length > 0
    ? customers
    : customerId ? [{ id: customerId, name: t('myFeed') } as Customer] : [];

  const getCustomerInventory = (custId: string) => {
    const customerPurchases = purchases.filter(p => p.customer_id.toString() === custId.toString());
    const customerReductions = reductions.filter(r => r.customer_id.toString() === custId.toString());
    const feedInventories = feedTypes.map(type => {
      const typePurchases = customerPurchases.filter(p => p.feed_type_id?.toString() === type.id.toString() && p.date.slice(0, 7) <= currentMonth);
      const typeReductions = customerReductions.filter(r => r.feed_type_id?.toString() === type.id.toString() && r.month <= currentMonth);
      const purchased = typePurchases.reduce((sum, p) => sum + Number(p.quantity), 0);
      const reduced = typeReductions.reduce((sum, r) => sum + Number(r.quantity), 0);
      const purchasedValue = typePurchases.reduce((sum, p) => sum + Number(p.amount), 0);
      const reducedValue = typeReductions.reduce((sum, r) => sum + Number(r.amount), 0);
      const currentReduction = typeReductions.find(r => r.month === currentMonth);
      const previousPurchases = typePurchases.filter(p => p.date.slice(0, 7) < currentMonth);
      const previousReductions = typeReductions.filter(r => r.month < currentMonth);
      const carriedForward = Math.max(0,
        previousPurchases.reduce((sum, p) => sum + Number(p.quantity), 0) -
        previousReductions.reduce((sum, r) => sum + Number(r.quantity), 0)
      );
      const carriedForwardValue = Math.max(0,
        previousPurchases.reduce((sum, p) => sum + Number(p.amount), 0) -
        previousReductions.reduce((sum, r) => sum + Number(r.amount), 0)
      );
      const available = Math.max(0, purchased - reduced + Number(currentReduction?.quantity || 0));
      const availableValue = purchasedValue - reducedValue + Number(currentReduction?.amount || 0);
      const savedQuantity = Number(currentReduction?.quantity || 0);
      return {
        type,
        available,
        carriedForward,
        remaining: Math.max(0, purchased - reduced),
        remainingValue: Math.max(0, purchasedValue - reducedValue),
        used: savedQuantity,
        usedValue: Number(currentReduction?.amount || 0),
        reductionUnitPrice: carriedForward > savedQuantity && carriedForward > 0
          ? carriedForwardValue / carriedForward
          : Number(currentReduction?.unit_price) || (available > 0 ? availableValue / available : Number(type.rate)),
        input: reductionDrafts[`${custId}:${type.id}`] ?? String(Math.max(savedQuantity, carriedForward))
      };
    });
    const thisMonthPurchases = customerPurchases.filter(p => p.date.slice(0, 7) === currentMonth);
    const purchasedQuantity = customerPurchases.filter(p => p.date.slice(0, 7) <= currentMonth).reduce((sum, p) => sum + Number(p.quantity), 0);
    const reducedQuantity = customerReductions.filter(r => r.month <= currentMonth).reduce((sum, r) => sum + Number(r.quantity), 0);
    const priorPurchasedQuantity = customerPurchases.filter(p => p.date.slice(0, 7) < currentMonth).reduce((sum, p) => sum + Number(p.quantity), 0);
    const priorReducedQuantity = customerReductions.filter(r => r.month < currentMonth).reduce((sum, r) => sum + Number(r.quantity), 0);
    const purchaseValue = customerPurchases.filter(p => p.date.slice(0, 7) <= currentMonth).reduce((sum, p) => sum + Number(p.amount), 0);
    const reducedValue = customerReductions.filter(r => r.month <= currentMonth).reduce((sum, r) => sum + Number(r.amount), 0);
    const priorPurchaseValue = customerPurchases.filter(p => p.date.slice(0, 7) < currentMonth).reduce((sum, p) => sum + Number(p.amount), 0);
    const priorReducedValue = customerReductions.filter(r => r.month < currentMonth).reduce((sum, r) => sum + Number(r.amount), 0);
    const currentReductions = customerReductions.filter(r => r.month === currentMonth);
    const available = Math.max(0, purchasedQuantity - reducedQuantity + currentReductions.reduce((sum, r) => sum + Number(r.quantity), 0));
    const usedValue = currentReductions.reduce((sum, r) => sum + Number(r.amount), 0);
    return {
      purchasedThisMonth: thisMonthPurchases.reduce((sum, p) => sum + Number(p.quantity), 0),
      purchasedThisMonthValue: thisMonthPurchases.reduce((sum, p) => sum + Number(p.amount), 0),
      carriedForward: Math.max(0, priorPurchasedQuantity - priorReducedQuantity),
      carriedForwardValue: Math.max(0, priorPurchaseValue - priorReducedValue),
      available,
      used: currentReductions.reduce((sum, r) => sum + Number(r.quantity), 0),
      usedValue,
      remaining: Math.max(0, purchasedQuantity - reducedQuantity),
      remainingValue: Math.max(0, purchaseValue - reducedValue),
      feedInventories,
      hasSavedReduction: customerReductions.some(record => record.month === currentMonth),
      history: customerReductions
    };
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
            {t('feedPurchases')}
          </button>
          <button
            onClick={() => setActiveTab('reductions')}
            className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all touch-btn ${
              activeTab === 'reductions' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t('monthlyBalance')}
          </button>
          {isVendor && (
            <>
              <button
                onClick={() => setActiveTab('types')}
                className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all touch-btn ${
                  activeTab === 'types' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t('inventory')}
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {activeTab !== 'types' && (
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600">
              <Calendar size={16} className="shrink-0 text-slate-400" />
              <span className="shrink-0">{t('selectMonth')}</span>
              <input
                type="month"
                value={selectedMonth}
                max={latestMonth}
                onChange={event => {
                  setSelectedMonth(event.target.value);
                  setReductionDrafts({});
                  setEditingReductionCustomerId(null);
                }}
                className="min-w-0 bg-transparent text-sm font-bold text-slate-800 outline-none"
              />
            </label>
          )}
          {isVendor && activeTab !== 'reductions' && (
            <button
              onClick={() => {
                if (activeTab === 'purchases') setIsPurchaseModalOpen(true);
                else {
                  setEditingType(null);
                  setTypeFormData({ name: '', rate: '' });
                  setIsTypeModalOpen(true);
                }
              }}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-bold text-sm touch-btn w-full sm:w-auto"
            >
              <Plus size={18} />
              {activeTab === 'purchases' ? t('recordPurchase') : t('addFeedType')}
            </button>
          )}
        </div>
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
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">{t('date')}</th>
                      {isVendor && <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">{t('customerLabel')}</th>}
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">{t('feedLabel')}</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">{t('qtyLabel')}</th>
                      <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider">{t('amount')}</th>
                      {isVendor && <th className="p-3 md:p-4 font-semibold text-slate-600 text-[11px] md:text-sm uppercase tracking-wider text-right">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-3 md:p-4 text-slate-600 text-xs md:text-sm">{p.date}</td>
                        {isVendor && <td className="p-3 md:p-4 font-medium text-slate-900 text-xs md:text-sm">{p.customer_name}</td>}
                        <td className="p-3 md:p-4 text-slate-900 text-xs md:text-sm">{p.feed_name}</td>
                        <td className="p-3 md:p-4 text-slate-600 font-medium text-xs md:text-sm">{p.quantity} {t('sacks')}</td>
                        <td className="p-3 md:p-4 text-orange-600 text-xs md:text-sm"><span>{p.quantity} × ₹{Number(p.unit_price ?? (p.amount / p.quantity)).toLocaleString('en-IN')}</span><br /><strong>= ₹{Number(p.amount).toLocaleString('en-IN')}</strong></td>
                        {isVendor && (
                          <td className="p-3 md:p-4 text-right">
                            <button
                              onClick={() => handleDeletePurchase(p.id)}
                              title={t('deleteFeedPurchase')}
                              aria-label={`${t('delete')} ${p.feed_name} ${t('feedPurchaseLabel')}`}
                              className="p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-btn"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {monthPurchases.length === 0 && (
                      <tr>
                        <td colSpan={isVendor ? 6 : 4} className="p-8 text-center text-slate-400 italic text-sm">
                          {t('noFeedPurchasesRecorded')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-2.5">
              {monthPurchases.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-200 mx-auto mb-3">
                    <Package size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">{t('noPurchases')}</p>
                  <p className="text-xs text-slate-300 mt-1">{t('tapRecordPurchase')}</p>
                </div>
              )}
              {monthPurchases.map((p) => (
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
                          {isVendor && <span className="text-[10px] text-slate-400">· {p.customer_name}</span>}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{p.quantity} {t('sacks')} × ₹{Number(p.unit_price ?? (p.amount / p.quantity)).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-base font-display font-black text-orange-600">= ₹{Number(p.amount).toLocaleString('en-IN')}</p>
                      {isVendor && (
                        <button
                          onClick={() => handleDeletePurchase(p.id)}
                          title={t('deleteFeedPurchase')}
                          aria-label={`${t('delete')} ${p.feed_name} ${t('feedPurchaseLabel')}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors touch-btn"
                        >
                          <Trash2 size={14} /> {t('delete')}
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
            <div className="space-y-3">
              {visibleCustomers.map(customer => {
                const inventory = getCustomerInventory(customer.id);
                return (
                  <section key={customer.id} className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{customer.name}</h3>
                      <span className="text-xs font-semibold text-slate-500">{currentMonth}</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500">{t('purchasedThisMonth')}</p>
                        <p className="mt-1 font-bold text-slate-900">{inventory.purchasedThisMonth} {t('sacks')}</p>
                        <p className="text-xs text-slate-500">₹{inventory.purchasedThisMonthValue.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-slate-500">{t('reducedUsed')}</p>
                        <p className="mt-1 font-bold text-slate-900">{inventory.used} {t('sacks')}</p>
                        <p className="text-xs text-slate-500">₹{inventory.usedValue.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3">
                        <p className="text-[10px] font-bold uppercase text-emerald-700">{t('remainingFeedBalance')}</p>
                        <p className="mt-1 font-bold text-emerald-800">{inventory.remaining} {t('sacks')}</p>
                        <p className="text-xs text-emerald-700">₹{inventory.remainingValue.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    {isVendor && (
                      <div className="border-t border-slate-100 pt-3">
                        {editingReductionCustomerId === customer.id ? (
                          <div className="space-y-3">
                            {inventory.feedInventories.filter(feedInventory => feedInventory.available > 0).map(feedInventory => (
                              <div key={feedInventory.type.id} className="flex flex-wrap items-end gap-2">
                                <label className="min-w-36 flex-1 text-xs font-semibold text-slate-600">
                                  {feedInventory.type.name} {t('sacksUsed')}
                                  <span className="ml-1 font-normal text-slate-400">({feedInventory.available} {t('available')})</span>
                                  <input
                                    type="number"
                                    min={feedInventory.carriedForward}
                                    step="1"
                                    max={feedInventory.available}
                                    value={feedInventory.input}
                                    onChange={e => setReductionDrafts(prev => ({ ...prev, [`${customer.id}:${feedInventory.type.id}`]: e.target.value }))}
                                    className="input-base mt-1"
                                  />
                                </label>
                                <p className="pb-2 text-xs font-semibold text-slate-600">
                                  {feedInventory.input || 0} × ₹{feedInventory.reductionUnitPrice.toLocaleString('en-IN')} = ₹{(Number(feedInventory.input || 0) * feedInventory.reductionUnitPrice).toLocaleString('en-IN')}
                                </p>
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => saveReduction(customer.id)}
                                disabled={savingCustomerId === customer.id || deletingReductionCustomerId === customer.id}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Save size={15} /> {savingCustomerId === customer.id ? t('saving') : t('saveMonthlyReduction')}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingReductionCustomerId(null);
                                  setReductionDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(`${customer.id}:`))));
                                }}
                                disabled={savingCustomerId === customer.id || deletingReductionCustomerId === customer.id}
                                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {t('cancel')}
                              </button>
                              {inventory.hasSavedReduction && (
                                <button
                                  onClick={() => deleteMonthlyReduction(customer.id)}
                                  disabled={savingCustomerId === customer.id || deletingReductionCustomerId === customer.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                >
                                  <Trash2 size={15} /> {deletingReductionCustomerId === customer.id ? t('deleting') : t('deleteMonthlyReduction')}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setReductionDrafts(prev => ({
                                  ...prev,
                                  ...Object.fromEntries(inventory.feedInventories.map(item => [`${customer.id}:${item.type.id}`, item.input]))
                                }));
                                setEditingReductionCustomerId(customer.id);
                              }}
                              disabled={deletingReductionCustomerId === customer.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <Edit2 size={15} /> {inventory.hasSavedReduction ? t('editMonthlyReduction') : t('recordMonthlyReduction')}
                            </button>
                            {inventory.hasSavedReduction && (
                              <button
                                onClick={() => deleteMonthlyReduction(customer.id)}
                                disabled={deletingReductionCustomerId === customer.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <Trash2 size={15} /> {deletingReductionCustomerId === customer.id ? t('deleting') : t('deleteMonthlyReduction')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
              {visibleCustomers.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{t('noFeedRecords')}</p>}
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
                  <p className="text-slate-500 text-xs md:text-sm">{t('rate')}: <span className="text-emerald-600 font-bold">₹{Number(type.rate).toLocaleString('en-IN')} / {t('sack')}</span></p>
                </div>
                <div className="flex gap-1 md:gap-2">
                  <button
                    onClick={() => {
                      setEditingType(type);
                      setTypeFormData({ name: type.name, rate: String(type.rate) });
                      setIsTypeModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all touch-btn"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteType(type.id)}
                    title={t('deleteFeedType')}
                    aria-label={`${t('delete')} ${type.name} ${t('feedTypeLabel')}`}
                    className="inline-flex items-center gap-1.5 px-2 py-2 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all touch-btn"
                  >
                    <Trash2 size={15} /> <span>{t('delete')}</span>
                  </button>
                </div>
              </div>
            ))}
            {feedTypes.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-200 mx-auto mb-3">
                  <Package size={24} />
                </div>
                <p className="text-sm font-bold text-slate-400">{t('noFeedTypes')}</p>
                <p className="text-xs text-slate-300 mt-1">{t('tapAddFeedType')}</p>
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
                <h3 className="text-lg font-bold text-slate-800">{editingType ? t('editFeedType') : t('addFeedType')}</h3>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('feedName')}</label>
                  <input
                    required
                    type="text"
                    placeholder={t('feedNamePlaceholder')}
                    value={typeFormData.name}
                    onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('ratePerSack')}</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={typeFormData.rate}
                    onChange={e => setTypeFormData({ ...typeFormData, rate: e.target.value })}
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
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm touch-btn"
                  >
                    {editingType ? t('updateFeed') : t('saveFeed')}
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
                <h3 className="text-lg font-bold text-slate-800">{t('recordFeedPurchase')}</h3>
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
                    <User size={13} /> {t('customerLabel')}
                  </label>
                  <select
                    required
                    value={purchaseFormData.customer_id}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, customer_id: e.target.value })}
                    className="input-base appearance-none"
                  >
                    <option value="">{t('selectCustomer')}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Package size={13} /> {t('feedTypeLabel')}
                  </label>
                  <select
                    required
                    value={purchaseFormData.feed_type_id}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, feed_type_id: e.target.value })}
                    className="input-base appearance-none"
                  >
                    <option value="">{t('selectFeed')}</option>
                    {feedTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (₹{Number(t.rate).toLocaleString('en-IN')} / sack)</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={13} /> {t('date')}
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
                      <ShoppingCart size={13} /> {t('sacks')}
                    </label>
                    <input
                      required
                      type="number"
                      step="1"
                      min="1"
                      placeholder={t('sacks')}
                      value={purchaseFormData.quantity}
                      onChange={(e) => setPurchaseFormData({ ...purchaseFormData, quantity: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>
                
                {purchaseFormData.feed_type_id && purchaseFormData.quantity && (
                  <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-100 flex justify-between items-center">
                    <span className="text-orange-700 font-medium text-sm">{purchaseFormData.quantity} {t('sacks')} × ₹{Number(feedTypes.find(t => t.id.toString() === purchaseFormData.feed_type_id)?.rate || 0).toLocaleString('en-IN')} =</span>
                    <span className="text-lg font-bold text-orange-900 font-mono">
                      ₹{(parseFloat(purchaseFormData.quantity) * Number(feedTypes.find(t => t.id.toString() === purchaseFormData.feed_type_id)?.rate || 0)).toLocaleString('en-IN')}
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
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-md text-sm touch-btn"
                  >
                    {t('recordPurchase')}
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
