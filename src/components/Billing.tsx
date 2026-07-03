import { useState, useEffect } from 'react';
import { FileText, Download, Printer, Search, ArrowLeft, Calendar, Droplets, Wallet, Package, ChevronRight } from 'lucide-react';
import { BillingRecord } from '../types';
import { motion } from 'motion/react';
import SearchBar from './SearchBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface BillingProps {
  customerId?: string;
}

export default function Billing({ customerId }: BillingProps) {
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [detailedData, setDetailedData] = useState<{
    customer?: any;
    milkEntries: any[];
    advances: any[];
    feedPurchases: any[];
  } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [viewingDetails, setViewingDetails] = useState<string | null>(customerId || null);

  useEffect(() => {
    if (customerId) {
      setViewingDetails(customerId);
    }
  }, [customerId]);

  useEffect(() => {
    if (viewingDetails) {
      fetchDetailedBilling(viewingDetails);
    } else {
      setDetailError(null);
      setDetailedData(null);
      fetchBilling();
    }
  }, [selectedMonth, viewingDetails]);

  const fetchBilling = () => {
    fetch(`/api/billing/${selectedMonth}`)
      .then(res => res.json())
      .then(data => setBillingData(data))
      .catch(() => setBillingData([]));
  };

  const fetchDetailedBilling = (id: string) => {
    setDetailError(null);
    fetch(`/api/billing/${selectedMonth}/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || 'Unable to fetch report');
        }
        return res.json();
      })
      .then((data) => {
        setDetailedData(data);
      })
      .catch((error) => {
        console.error('Billing detail load failed:', error);
        setDetailError(String(error.message || error));
        setDetailedData(null);
      });
  };

  const filteredBilling = billingData.filter(b => 
    b.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    b.customer_id.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  if (viewingDetails) {
    if (detailError) {
      return (
        <div className="space-y-4 md:space-y-10 pb-4 md:pb-20">
          <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center shadow-soft">
            <p className="text-xl font-display font-bold text-rose-600">Unable to load report</p>
            <p className="text-sm text-slate-500 mt-2">{detailError}</p>
            <button
              onClick={() => {
                setDetailError(null);
                fetchDetailedBilling(viewingDetails);
              }}
              className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors touch-btn"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!detailedData) {
      return (
        <div className="space-y-4 md:space-y-10 pb-4 md:pb-20">
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-soft">
            <p className="text-lg font-display font-bold text-slate-900">Loading customer report…</p>
          </div>
        </div>
      );
    }

    const totalMilkAmount = detailedData.milkEntries.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCashAdvances = (detailedData.advances || [])
      .filter((a: any) => a.type !== 'deduction')
      .reduce((acc, curr: any) => acc + curr.amount, 0);
    const totalBillDeductions = (detailedData.advances || [])
      .filter((a: any) => a.type === 'deduction')
      .reduce((acc, curr: any) => acc + curr.amount, 0);
    const totalFeedAmount = (detailedData.feedPurchases || []).reduce((acc, curr) => acc + curr.amount, 0);
    
    // Cattle Feed Reduction logic
    const cattleFeedReduction = detailedData.customer?.cattle_feed_reduction || 0;
    const netCattleFeed = Math.max(0, totalFeedAmount - cattleFeedReduction);
    const remainingBalance = netCattleFeed; // Formula: Net - Amount Already Reduced (0)
    
    const finalPayable = Math.max(0, totalMilkAmount - totalBillDeductions - cattleFeedReduction);

    return (
      <div className="space-y-4 md:space-y-10 pb-4 md:pb-20">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-6 md:justify-between md:items-start md:items-end md:mb-8">
          <div className="flex items-center gap-3 md:gap-6">
            {!customerId && (
              <button 
                onClick={() => { setViewingDetails(null); setDetailedData(null); }}
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-soft transition-all touch-btn flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
                  Consolidated Statement
                </span>
                <div className="flex items-center gap-1 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <Calendar size={10} />
                  {new Date(selectedMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <h2 className="page-title">
                {customerId ? 'Personal' : (billingData.find(b => b.customer_id === viewingDetails)?.name || 'Farmer')} <span className="text-emerald-600">Balance</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl md:rounded-2xl border border-slate-100 shadow-soft w-full md:w-auto">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 md:w-40 px-3 py-2 rounded-lg text-sm font-bold text-slate-700 focus:bg-slate-50 outline-none transition-all"
            />
            <button 
              onClick={() => window.print()}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center border border-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all touch-btn"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4 md:gap-6">
          <div className="bento-card bg-emerald-50/30 border-emerald-100 flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-emerald-600 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
                <Droplets size={14} className="md:hidden" />
                <Droplets size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-emerald-700">Milk<br/>Earnings</span>
            </div>
            <p className="text-lg md:text-3xl font-display font-bold text-emerald-900 tracking-tight">₹{totalMilkAmount.toFixed(0)}</p>
          </div>

          <div className="bento-card border-blue-100 bg-white flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-blue-500 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                <Wallet size={14} className="md:hidden" />
                <Wallet size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">Cash<br/>Advances</span>
            </div>
            <div>
              <p className="text-lg md:text-3xl font-display font-bold text-blue-600 tracking-tight">₹{totalCashAdvances.toFixed(0)}</p>
              <p className="text-[8px] text-blue-400 mt-1 uppercase font-black tracking-widest hidden md:block">Informational</p>
            </div>
          </div>

          <div className="bento-card border-rose-100 bg-white flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-rose-500 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-rose-100 shrink-0">
                <Wallet size={14} className="md:hidden" />
                <Wallet size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">Bill<br/>Reduction</span>
            </div>
            <div>
              <p className="text-lg md:text-3xl font-display font-bold text-rose-600 tracking-tight">₹{cattleFeedReduction.toFixed(0)}</p>
              <p className="text-[8px] text-rose-400 mt-1 uppercase font-black tracking-widest hidden md:block">Subtracted</p>
            </div>
          </div>

          <div className="bento-card border-orange-100 bg-white flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-orange-500 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 shrink-0">
                <Package size={14} className="md:hidden" />
                <Package size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">Feed<br/>Expenses</span>
            </div>
            <div>
              <p className="text-lg md:text-3xl font-display font-bold text-orange-600 tracking-tight">₹{totalFeedAmount.toFixed(0)}</p>
              <p className="text-[8px] text-orange-400 mt-1 uppercase font-black tracking-widest hidden md:block">Info Only</p>
            </div>
          </div>

          <div className="bento-card border-rose-100 bg-rose-50/20 flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-rose-500 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-rose-100 shrink-0">
                <Package size={14} className="md:hidden" />
                <Package size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-rose-700">Total<br/>Debt</span>
            </div>
            <p className="text-lg md:text-3xl font-display font-bold text-rose-600 tracking-tight">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
          </div>

          <div className="bento-card bg-slate-900 text-white shadow-xl flex flex-col justify-between col-span-1">
            <div className="flex flex-col gap-1 md:gap-3 text-slate-400 mb-2 md:mb-6">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <FileText size={14} className="md:hidden" />
                <FileText size={20} className="hidden md:block" />
              </div>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-300">Net<br/>Payout</span>
            </div>
            <p className="text-xl md:text-4xl font-display font-bold tracking-tight text-emerald-400">₹{finalPayable.toFixed(0)}</p>
          </div>
        </div>

        {/* Statement Detail */}
        <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 p-4 md:p-10 shadow-soft overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
          <div className="relative z-10">
            <div className="mb-5 md:mb-10 flex flex-col md:flex-row md:justify-between md:items-start gap-2">
              <div>
                <h3 className="section-heading mb-1">Monthly Statement</h3>
                <p className="text-xs md:text-sm text-slate-400 font-medium">
                  {new Date(selectedMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Statement Date</p>
                <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-stretch gap-4 md:gap-10">
              <div className="flex-1 w-full">
                <div className="bg-slate-50 rounded-2xl md:rounded-3xl p-4 md:p-8 border border-slate-100">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Total Milk Earnings</td>
                        <td className="py-3 text-xs md:text-sm font-black text-emerald-600 text-right">+ ₹{totalMilkAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Advances Deduction</td>
                        <td className="py-3 text-xs md:text-sm font-black text-rose-500 text-right">- ₹{totalBillDeductions.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Total Cattle Feed</td>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-500 text-right">₹{totalFeedAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Cattle Feed Reduction</td>
                        <td className="py-3 text-xs md:text-sm font-black text-rose-500 text-right">- ₹{cattleFeedReduction.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Net Cattle Feed</td>
                        <td className="py-3 text-xs md:text-sm font-bold text-emerald-600 text-right">₹{netCattleFeed.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-3 text-xs md:text-sm font-bold text-slate-700">Remaining Balance</td>
                        <td className="py-3 text-xs md:text-sm font-bold text-orange-600 text-right">₹{remainingBalance.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-white/50">
                        <td className="py-4 text-sm md:text-base font-black text-slate-900">Final Net Settlement</td>
                        <td className="py-4 text-xl md:text-2xl font-display font-bold text-slate-900 text-right">₹{finalPayable.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-4 md:mt-8 grid grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-6 rounded-xl md:rounded-2xl bg-blue-50/50 border border-blue-100">
                    <p className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5 md:mb-1">Cash Advances</p>
                    <p className="text-base md:text-xl font-display font-bold text-blue-600">₹{totalCashAdvances.toFixed(0)}</p>
                    <p className="text-[8px] text-blue-400 font-bold mt-1 uppercase italic hidden md:block">(Not deducted)</p>
                  </div>
                  <div className="p-3 md:p-6 rounded-xl md:rounded-2xl bg-rose-50/50 border border-rose-100">
                    <p className="text-[9px] md:text-[10px] font-black text-rose-400 uppercase tracking-widest mb-0.5 md:mb-1">Remaining Debt</p>
                    <p className="text-base md:text-xl font-display font-bold text-rose-600">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
                    <p className="text-[8px] text-rose-400 font-bold mt-1 uppercase italic hidden md:block">(Carry forward)</p>
                  </div>
                </div>
              </div>

              <div className="lg:w-1/3 w-full">
                <div className="bg-slate-900 p-5 md:p-8 rounded-2xl md:rounded-[2rem] text-white shadow-2xl h-full flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 md:mb-6">Farmer Record</h4>
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between">
                        <span className="text-xs md:text-sm font-bold text-slate-400">Farmer ID</span>
                        <span className="text-xs md:text-sm font-black text-white">#F-{viewingDetails}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs md:text-sm font-bold text-slate-400">Base Rate</span>
                        <span className="text-xs md:text-sm font-black text-white">₹{((detailedData as any).customer?.default_rate || 30).toFixed(2)}/L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs md:text-sm font-bold text-slate-400">Total Supply</span>
                        <span className="text-xs md:text-sm font-black text-white">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 md:mt-8 pt-5 md:pt-8 border-t border-white/10">
                    <button 
                      onClick={() => window.print()}
                      className="w-full py-2.5 md:py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all touch-btn"
                    >
                      Print Statement
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Records */}
        <div className="grid grid-cols-1 gap-4 md:gap-10">
          {/* Milk Records */}
          <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
            <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
              <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Droplets size={13} className="text-emerald-500" />
                Milk Supply Details
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{detailedData.milkEntries.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left mobile-compact-table">
                <thead className="bg-white/90 backdrop-blur sticky top-0 z-10">
                  <tr className="border-b border-slate-50">
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Date</th>
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Shift</th>
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Liters</th>
                    <th className="hidden sm:table-cell px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Rate</th>
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {detailedData.milkEntries.map((e, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 md:px-8 py-2.5 md:py-4">
                        <p className="text-xs md:text-sm font-bold text-slate-700">
                          {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </td>
                      <td className="px-4 md:px-8 py-2.5 md:py-4">
                        <span className={`px-1.5 py-0.5 md:px-3 md:py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          e.shift === 'AM' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        }`}>
                          {e.shift}
                        </span>
                      </td>
                      <td className="px-4 md:px-8 py-2.5 md:py-4">
                        <span className="text-xs md:text-sm font-black text-slate-600">{e.liters.toFixed(1)} L</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4">
                        <span className="text-[10px] md:text-xs font-bold text-slate-400">₹{e.rate || ((detailedData as any).customer?.default_rate || 30)}</span>
                      </td>
                      <td className="px-4 md:px-8 py-2.5 md:py-4 text-right">
                        <p className="text-xs md:text-sm font-display font-black text-slate-900 tracking-tight">₹{e.amount.toFixed(2)}</p>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td colSpan={2} className="px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-black text-slate-900 uppercase">Subtotal</td>
                    <td className="px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-black text-slate-900">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</td>
                    <td className="hidden sm:table-cell px-4 md:px-8 py-3 md:py-4"></td>
                    <td className="px-4 md:px-8 py-3 md:py-4 text-right text-base md:text-lg font-display font-black text-emerald-600">₹{totalMilkAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10">
            {/* Feed Records */}
            <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
              <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Package size={13} className="text-orange-500" />
                  Feed Expenses
                </h4>
                <span className="text-xs md:text-sm font-black text-rose-500">₹{totalFeedAmount.toFixed(0)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left mobile-compact-table">
                  <thead className="bg-white border-b border-slate-50">
                    <tr>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item</th>
                      <th className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Qty</th>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {detailedData.feedPurchases.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-bold text-slate-500">
                          {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 md:px-8 py-2.5 md:py-4 text-xs md:text-sm font-bold text-slate-700">{p.feed_name}</td>
                        <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-black text-slate-400">{p.quantity} kg</td>
                        <td className="px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black text-rose-500">₹{p.amount.toFixed(0)}</td>
                      </tr>
                    ))}
                    {detailedData.feedPurchases.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-slate-300 italic font-medium text-sm">No feed allocations</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Advances Ledger */}
            <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
              <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Wallet size={13} className="text-emerald-500" />
                  Advances Ledger
                </h4>
                <span className="text-xs md:text-sm font-black text-emerald-600">Repaid: ₹{totalBillDeductions.toFixed(0)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left mobile-compact-table">
                  <thead className="bg-white border-b border-slate-50">
                    <tr>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                      <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {detailedData.advances.map((a: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-bold text-slate-500">
                          {new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 md:px-8 py-2.5 md:py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            a.type === 'deduction' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {a.type === 'deduction' ? 'Deduction' : 'Advance'}
                          </span>
                        </td>
                        <td className={`px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black ${
                          a.type === 'deduction' ? 'text-emerald-600' : 'text-blue-500'
                        }`}>
                          ₹{a.amount.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                    {detailedData.advances.length === 0 && (
                      <tr><td colSpan={3} className="py-6 text-center text-slate-300 italic font-medium text-sm">No transactions</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:gap-6 md:justify-between md:items-start md:items-end md:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1 md:mb-3">
            <span className="px-2 py-0.5 md:px-3 md:py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              Financial Overview
            </span>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-7 pr-3 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-600 outline-none hover:border-slate-300 transition-all cursor-pointer uppercase tracking-widest"
              />
            </div>
          </div>
          <h2 className="page-title">
            Settlement <span className="text-emerald-600">Journal</span>
          </h2>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex-1 md:w-72">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search farmers by name or ID..."
              className="w-full"
            />
          </div>
          <button className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white border border-slate-100 rounded-xl md:rounded-[1.5rem] text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-soft active:scale-95 transition-all touch-btn flex-shrink-0">
            <Printer size={16} />
          </button>
          <button className="hidden md:flex items-center gap-2 bg-emerald-600 text-white px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 touch-btn">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">Farmer</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">Vol (L)</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">Gross Revenue</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">Cattle Feed Details</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-right">Debt</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-right">Net Settlement</th>
                <th className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBilling.map((record: any) => (
                <tr key={record.customer_id} className="group hover:bg-emerald-50/20 transition-all">
                  <td className="px-6 md:px-10 py-4 md:py-6 font-bold text-slate-900 tracking-tight text-sm">{record.name}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6 font-black text-slate-400 text-sm tracking-tight">{record.total_liters.toFixed(1)}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6 font-display font-black text-slate-700 text-base tracking-tight">₹{record.total_amount.toFixed(0)}</td>
                  <td className="px-6 md:px-10 py-4 md:py-6">
                    <div className="flex flex-wrap gap-1.5">
                      {record.total_feed > 0 && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest border border-orange-100">Total Feed: ₹{record.total_feed.toFixed(0)}</span>}
                      {record.cattle_feed_reduction > 0 && <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest border border-rose-100">Reduction: ₹{record.cattle_feed_reduction.toFixed(0)}</span>}
                      {record.net_cattle_feed > 0 && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-100">Net Feed: ₹{record.net_cattle_feed.toFixed(0)}</span>}
                      {record.remaining_feed_balance > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest border border-amber-100">Remaining Balance: ₹{record.remaining_feed_balance.toFixed(0)}</span>}
                    </div>
                  </td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-rose-500 font-display font-black text-base text-right tracking-tight">
                    <span className={record.advance_balance > 0 ? 'opacity-100' : 'opacity-20'}>₹{record.advance_balance.toFixed(0)}</span>
                  </td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-right">
                    <span className={`px-3 py-1.5 rounded-2xl font-display font-black text-sm shadow-sm ring-1 ring-inset ${
                      record.final_payable > 0 ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}>
                      ₹{record.final_payable.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-6 md:px-10 py-4 md:py-6 text-center">
                    <button 
                      onClick={() => setViewingDetails(record.customer_id)}
                      className="w-10 h-10 rounded-[1.2rem] bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 shadow-soft transition-all mx-auto active:scale-90 touch-btn"
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBilling.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-4">
                      <Search size={32} />
                    </div>
                    <p className="text-base font-display font-bold text-slate-400">No records found</p>
                    <p className="text-sm text-slate-300 font-medium">No entries for {selectedMonth}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list for billing */}
      <div className="md:hidden space-y-2.5">
        {filteredBilling.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 mx-auto mb-3">
              <Search size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400">No Records</p>
            <p className="text-xs text-slate-300 mt-1">No entries found for {selectedMonth}.</p>
          </div>
        )}
        {filteredBilling.map((record: any) => (
          <motion.div
            key={record.customer_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-100 p-3.5 shadow-soft"
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div>
                <p className="font-bold text-slate-900 text-sm">{record.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{record.total_liters.toFixed(1)} L supplied</p>
              </div>
              <button 
                onClick={() => setViewingDetails(record.customer_id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-[11px] font-black uppercase tracking-wide touch-btn"
              >
                View <ChevronRight size={12} />
              </button>
            </div>
            {/* Show Feed Reduction details in mobile layout */}
            <div className="flex flex-wrap gap-1 mb-2.5">
              {record.total_feed > 0 && <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest border border-orange-100">Total Feed: ₹{record.total_feed.toFixed(0)}</span>}
              {record.cattle_feed_reduction > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest border border-rose-100">Reduction: ₹{record.cattle_feed_reduction.toFixed(0)}</span>}
              {record.net_cattle_feed > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-100">Net Feed: ₹{record.net_cattle_feed.toFixed(0)}</span>}
              {record.remaining_feed_balance > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest border border-amber-100">Remaining Bal: ₹{record.remaining_feed_balance.toFixed(0)}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-50">
              <div className="text-center">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Gross</p>
                <p className="text-sm font-display font-bold text-slate-700">₹{record.total_amount.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Debt</p>
                <p className={`text-sm font-display font-bold ${record.advance_balance > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                  ₹{record.advance_balance.toFixed(0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-emerald-500 uppercase font-black tracking-wider">Net Pay</p>
                <p className="text-sm font-display font-bold text-emerald-600">₹{record.final_payable.toFixed(0)}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary footer cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
        <div className="bento-card bg-emerald-50 border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">Total Liters</p>
          <p className="text-xl md:text-4xl font-display font-bold text-emerald-900 tracking-tight">
            {filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_liters, 0).toFixed(0)} <span className="text-sm md:text-xl">L</span>
          </p>
        </div>
        <div className="bento-card border-slate-100">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">Total Debt</p>
          <p className="text-xl md:text-4xl font-display font-bold text-rose-500 tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.advance_balance, 0).toFixed(0)}
          </p>
        </div>
        <div className="bento-card border-slate-100">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">Deductions</p>
          <p className="text-xl md:text-4xl font-display font-bold text-slate-900 tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_feed + (curr.total_deduction || 0), 0).toFixed(0)}
          </p>
        </div>
        <div className="bento-card bg-slate-900 text-white shadow-2xl">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">Net Payout</p>
          <p className="text-xl md:text-4xl font-display font-bold tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.final_payable, 0).toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
