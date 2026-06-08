import { useState, useEffect } from 'react';
import { FileText, Download, Printer, Search, ArrowLeft, Calendar, Droplets, Wallet, Package } from 'lucide-react';
import { BillingRecord } from '../types';
import { motion } from 'motion/react';

interface BillingProps {
  customerId?: string;
}

export default function Billing({ customerId }: BillingProps) {
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [detailedData, setDetailedData] = useState<{
    milkEntries: any[];
    advances: any[];
    feedPurchases: any[];
  } | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().split('T')[0].substring(0, 7));
  const [search, setSearch] = useState('');
  const [viewingDetails, setViewingDetails] = useState<string | null>(customerId || null);

  useEffect(() => {
    if (viewingDetails) {
      fetchDetailedBilling(viewingDetails);
    } else {
      fetchBilling();
    }
  }, [selectedMonth, viewingDetails]);

  const fetchBilling = () => {
    fetch(`/api/billing/${selectedMonth}`)
      .then(res => res.json())
      .then(data => setBillingData(data));
  };

  const fetchDetailedBilling = (id: string) => {
    fetch(`/api/billing/${selectedMonth}/${id}`)
      .then(res => res.json())
      .then(data => setDetailedData(data));
  };

  const filteredBilling = billingData.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  if (viewingDetails && detailedData) {
    const totalMilkAmount = detailedData.milkEntries.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCashAdvances = (detailedData.advances || [])
      .filter((a: any) => a.type !== 'deduction')
      .reduce((acc, curr: any) => acc + curr.amount, 0);
    const totalBillDeductions = (detailedData.advances || [])
      .filter((a: any) => a.type === 'deduction')
      .reduce((acc, curr: any) => acc + curr.amount, 0);
    const totalFeedAmount = (detailedData.feedPurchases || []).reduce((acc, curr) => acc + curr.amount, 0);
    const totalDeductions = totalBillDeductions + totalFeedAmount;
    const finalPayable = Math.max(0, totalMilkAmount - totalDeductions);

    return (
      <div className="space-y-10 pb-20">
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end mb-8">
          <div className="flex items-center gap-6">
            {!customerId && (
              <button 
                onClick={() => { setViewingDetails(null); setDetailedData(null); }}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-soft transition-all"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
                  Consolidated Statement
                </span>
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <Calendar size={12} />
                  {new Date(selectedMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <h2 className="text-4xl font-display font-bold text-slate-900 tracking-tight leading-none">
                {customerId ? 'Personal' : (billingData.find(b => b.customer_id === viewingDetails)?.name || 'Farmer')} <span className="text-emerald-600">Balance</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto bg-white p-2 rounded-2xl border border-slate-100 shadow-soft">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 md:w-48 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 focus:bg-slate-50 outline-none transition-all"
            />
            <button className="w-10 h-10 flex items-center justify-center border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <div className="bento-card bg-emerald-50/30 border-emerald-100">
            <div className="flex items-center gap-3 text-emerald-600 mb-6">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <Droplets size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Milk<br/>Earnings</span>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-900 tracking-tight">₹{totalMilkAmount.toFixed(0)}</p>
          </div>

          <div className="bento-card border-blue-100 bg-white">
            <div className="flex items-center gap-3 text-blue-500 mb-6 font-display">
               <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Cash<br/>Advances</span>
            </div>
            <p className="text-3xl font-display font-bold text-blue-600 tracking-tight">₹{totalCashAdvances.toFixed(0)}</p>
            <p className="text-[8px] text-blue-400 mt-2 uppercase font-black tracking-widest">Informational</p>
          </div>

          <div className="bento-card border-emerald-100 bg-white">
            <div className="flex items-center gap-3 text-emerald-500 mb-6">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                <Wallet size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Bill<br/>Reduction</span>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-600 tracking-tight">₹{totalBillDeductions.toFixed(0)}</p>
            <p className="text-[8px] text-emerald-400 mt-2 uppercase font-black tracking-widest">Subtracted</p>
          </div>

          <div className="bento-card border-orange-100 bg-white">
            <div className="flex items-center gap-3 text-orange-500 mb-6">
              <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-100">
                <Package size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight text-slate-400">Feed<br/>Expenses</span>
            </div>
            <p className="text-3xl font-display font-bold text-orange-600 tracking-tight">₹{totalFeedAmount.toFixed(0)}</p>
            <p className="text-[8px] text-orange-400 mt-2 uppercase font-black tracking-widest">Subtracted</p>
          </div>

          <div className="bento-card border-rose-100 bg-rose-50/20">
            <div className="flex items-center gap-3 text-rose-500 mb-6">
              <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-rose-100">
                <Package size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Total<br/>Debt</span>
            </div>
            <p className="text-3xl font-display font-bold text-rose-600 tracking-tight">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
          </div>

          <div className="bento-card bg-slate-900 text-white shadow-xl">
            <div className="flex items-center gap-3 text-slate-400 mb-6">
              <div className="w-10 h-10 bg-white/10 text-white rounded-xl flex items-center justify-center shadow-lg">
                <FileText size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">Net<br/>Payout</span>
            </div>
            <p className="text-4xl font-display font-bold tracking-tight">₹{finalPayable.toFixed(0)}</p>
          </div>
        </div>

        {/* 이해를 돕기 위한 정산 상세 내역 ( hiểu biết để khách hàng ) */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-10 shadow-soft overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
          <div className="relative z-10">
             <div className="mb-10 flex justify-between items-start">
                <div>
                   <h3 className="text-2xl font-display font-bold text-slate-900 tracking-tight mb-2">Monthly Statement Summary</h3>
                   <p className="text-sm text-slate-400 font-medium">Calculation breakdown for {new Date(selectedMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Statement Date</p>
                   <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
                </div>
             </div>

             <div className="flex flex-col lg:flex-row items-stretch gap-10">
                <div className="flex-1 w-full">
                   <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                      <table className="w-full text-left">
                         <thead>
                            <tr className="border-b border-slate-200">
                               <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                               <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                            <tr>
                               <td className="py-4 text-sm font-bold text-slate-700">Total Milk Earnings</td>
                               <td className="py-4 text-sm font-black text-emerald-600 text-right">+ ₹{totalMilkAmount.toFixed(2)}</td>
                            </tr>
                            <tr>
                               <td className="py-4 text-sm font-bold text-slate-700">Advances Repayment (Deduction)</td>
                               <td className="py-4 text-sm font-black text-rose-500 text-right">- ₹{totalBillDeductions.toFixed(2)}</td>
                            </tr>
                            <tr>
                               <td className="py-4 text-sm font-bold text-slate-700">Feed Resource Allocation</td>
                               <td className="py-4 text-sm font-black text-rose-500 text-right">- ₹{totalFeedAmount.toFixed(2)}</td>
                            </tr>
                            <tr className="bg-white/50">
                               <td className="py-6 text-base font-black text-slate-900">Final Net Settlement</td>
                               <td className="py-6 text-2xl font-display font-bold text-slate-900 text-right">₹{finalPayable.toFixed(2)}</td>
                            </tr>
                         </tbody>
                      </table>
                   </div>
                   
                   <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">New Cash Advances</p>
                         <p className="text-xl font-display font-bold text-blue-600">₹{totalCashAdvances.toFixed(0)}</p>
                         <p className="text-[8px] text-blue-400 font-bold mt-1 uppercase italic">(Not deducted from this settlement)</p>
                      </div>
                      <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-100">
                         <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Remaining Debt Balance</p>
                         <p className="text-xl font-display font-bold text-rose-600">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
                         <p className="text-[8px] text-rose-400 font-bold mt-1 uppercase italic">(Carry forward to next month)</p>
                      </div>
                   </div>
                </div>

                <div className="lg:w-1/3 w-full space-y-6">
                   <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-2xl h-full flex flex-col justify-between">
                      <div>
                         <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-6">Farmer Record Info</h4>
                         <div className="space-y-4">
                            <div className="flex justify-between">
                               <span className="text-sm font-bold text-slate-400">Farmer ID</span>
                               <span className="text-sm font-black text-white">#F-{viewingDetails}</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-sm font-bold text-slate-400">Base Unit Rate</span>
                               <span className="text-sm font-black text-white">₹{((detailedData as any).customer?.default_rate || 30).toFixed(2)}/L</span>
                            </div>
                            <div className="flex justify-between">
                               <span className="text-sm font-bold text-slate-400">Total Supply</span>
                               <span className="text-sm font-black text-white">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</span>
                            </div>
                         </div>
                      </div>
                      <div className="mt-8 pt-8 border-t border-white/10">
                         <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                               <Printer size={16} className="text-emerald-400" />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                              This statement is generated electronically for transparent dairy record management.
                            </p>
                         </div>
                         <button 
                            onClick={() => window.print()}
                            className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                         >
                            Print Full Statement
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10">
          {/* Detailed Milk Records */}
          <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Droplets size={14} className="text-emerald-500" />
                1. Monthly Milk Supply Details
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{detailedData.milkEntries.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/90 backdrop-blur sticky top-0 z-10">
                  <tr className="border-b border-slate-50">
                    <th className="px-8 py-4 font-black text-slate-300 text-[10px] uppercase tracking-widest">Date</th>
                    <th className="px-8 py-4 font-black text-slate-300 text-[10px] uppercase tracking-widest">Shift</th>
                    <th className="px-8 py-4 font-black text-slate-300 text-[10px] uppercase tracking-widest">Liters</th>
                    <th className="px-8 py-4 font-black text-slate-300 text-[10px] uppercase tracking-widest">Rate</th>
                    <th className="px-8 py-4 font-black text-slate-300 text-[10px] uppercase tracking-widest text-right">Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {detailedData.milkEntries.map((e, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4">
                        <p className="text-sm font-bold text-slate-700">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </td>
                      <td className="px-8 py-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          e.shift === 'AM' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm'
                        }`}>
                          {e.shift}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                         <span className="text-sm font-black text-slate-600">{e.liters.toFixed(1)} L</span>
                      </td>
                      <td className="px-8 py-4">
                         <span className="text-xs font-bold text-slate-400">₹{e.rate || ((detailedData as any).customer?.default_rate || 30)}</span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <p className="text-sm font-display font-black text-slate-900 tracking-tight">₹{e.amount.toFixed(2)}</p>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                     <td colSpan={2} className="px-8 py-4 text-sm font-black text-slate-900 uppercase">Subtotal Supply</td>
                     <td className="px-8 py-4 text-sm font-black text-slate-900">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</td>
                     <td className="px-8 py-4"></td>
                     <td className="px-8 py-4 text-right text-lg font-display font-black text-emerald-600">₹{totalMilkAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Feed Records */}
            <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Package size={14} className="text-orange-500" />
                  2. Feed & Resource Expenses
                </h4>
                <span className="text-sm font-black text-rose-500">Total: ₹{totalFeedAmount.toFixed(0)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-white border-b border-slate-50">
                      <tr>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Date</th>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Item</th>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Qty</th>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">Cost</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {detailedData.feedPurchases.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                           <td className="px-8 py-4 text-xs font-bold text-slate-500">{new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                           <td className="px-8 py-4 text-sm font-bold text-slate-700">{p.feed_name}</td>
                           <td className="px-8 py-4 text-xs font-black text-slate-400">{p.quantity} kg</td>
                           <td className="px-8 py-4 text-right text-sm font-display font-black text-rose-500">₹{p.amount.toFixed(0)}</td>
                        </tr>
                      ))}
                      {detailedData.feedPurchases.length === 0 && (
                        <tr><td colSpan={4} className="py-10 text-center text-slate-300 italic font-medium">No resource allocations</td></tr>
                      )}
                   </tbody>
                </table>
              </div>
            </div>

            {/* Advances & Settlements */}
            <div className="bg-white rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Wallet size={14} className="text-emerald-500" />
                  3. Advances & Deductions Ledger
                </h4>
                <span className="text-sm font-black text-emerald-600">Repaid: ₹{totalBillDeductions.toFixed(0)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-white border-b border-slate-50">
                      <tr>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Date</th>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Type</th>
                         <th className="px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {detailedData.advances.map((a: any, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                           <td className="px-8 py-4 text-xs font-bold text-slate-500">{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                           <td className="px-8 py-4">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                a.type === 'deduction' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                              }`}>
                                {a.type === 'deduction' ? 'Bill Deduction' : 'Cash Advance'}
                              </span>
                           </td>
                           <td className={`px-8 py-4 text-right text-sm font-display font-black ${
                              a.type === 'deduction' ? 'text-emerald-600' : 'text-blue-500'
                           }`}>
                              ₹{a.amount.toFixed(0)}
                           </td>
                        </tr>
                      ))}
                      {detailedData.advances.length === 0 && (
                        <tr><td colSpan={3} className="py-10 text-center text-slate-300 italic font-medium">No transactions this month</td></tr>
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
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              Financial Overview
            </span>
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-9 pr-4 py-1 rounded-full bg-white border border-slate-100 text-[10px] font-black text-slate-600 outline-none hover:border-slate-300 transition-all cursor-pointer appearance-none uppercase tracking-widest"
              />
            </div>
          </div>
          <h2 className="text-5xl font-display font-bold text-slate-900 tracking-tight leading-none">
            Settlement <span className="text-emerald-600">Journal</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search farmer journals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-[1.5rem] bg-white border border-slate-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-sm text-slate-700 shadow-soft"
            />
          </div>
          <div className="flex gap-2">
            <button className="w-14 h-14 flex items-center justify-center bg-white border border-slate-100 rounded-[1.5rem] text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-soft active:scale-95 transition-all">
              <Printer size={20} />
            </button>
            <button className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95">
              <Download size={20} />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Primary Farmer</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Vol (L)</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Gross Revenue</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em]">Total Reduction</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Debt Balance</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-right">Net Settlement</th>
                <th className="px-10 py-6 font-black text-slate-300 text-[10px] uppercase tracking-[0.2em] text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredBilling.map((record: any) => (
                <tr key={record.customer_id} className="group hover:bg-emerald-50/20 transition-all">
                  <td className="px-10 py-6 font-bold text-slate-900 tracking-tight">{record.name}</td>
                  <td className="px-10 py-6 font-black text-slate-400 text-sm tracking-tight">{record.total_liters.toFixed(1)}</td>
                  <td className="px-10 py-6 font-display font-black text-slate-700 text-lg tracking-tight">₹{record.total_amount.toFixed(0)}</td>
                  <td className="px-10 py-6">
                     <div className="flex flex-wrap gap-2">
                        {record.total_feed > 0 && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest border border-orange-100">Feed: ₹{record.total_feed.toFixed(0)}</span>}
                        {record.total_deduction > 0 && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-100">Repay: ₹{record.total_deduction.toFixed(0)}</span>}
                        {record.total_advance > 0 && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest border border-blue-100">Adv: ₹{record.total_advance.toFixed(0)}</span>}
                     </div>
                  </td>
                  <td className="px-10 py-6 text-rose-500 font-display font-black text-lg text-right tracking-tight">
                    <span className={record.advance_balance > 0 ? 'opacity-100' : 'opacity-20'}>₹{record.advance_balance.toFixed(0)}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className={`px-4 py-2 rounded-2xl font-display font-black text-base shadow-sm ring-1 ring-inset ${
                      record.final_payable > 0 ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}>
                      ₹{record.final_payable.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <button 
                      onClick={() => setViewingDetails(record.customer_id)}
                      className="w-12 h-12 rounded-[1.2rem] bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 shadow-soft transition-all mx-auto active:scale-90"
                    >
                      <FileText size={20} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBilling.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-32 text-center">
                     <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                        <Search size={40} />
                     </div>
                     <p className="text-lg font-display font-bold text-slate-400">Database Quiet</p>
                     <p className="text-sm text-slate-300 font-medium">No logistical matching found for {selectedMonth}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bento-card bg-emerald-50 border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mb-2">Aggregate Liters</p>
          <p className="text-4xl font-display font-bold text-emerald-900 tracking-tight">
            {filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_liters, 0).toFixed(0)} <span className="text-xl">L</span>
          </p>
        </div>
        <div className="bento-card border-slate-100">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">External Debt</p>
          <p className="text-4xl font-display font-bold text-rose-500 tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.advance_balance, 0).toFixed(0)}
          </p>
        </div>
        <div className="bento-card border-slate-100">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Total Retention</p>
          <p className="text-4xl font-display font-bold text-slate-900 tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_feed + (curr.total_deduction || 0), 0).toFixed(0)}
          </p>
        </div>
        <div className="bento-card bg-slate-900 text-white shadow-2xl">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">Net Treasury Payout</p>
          <p className="text-4xl font-display font-bold tracking-tight">
            ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.final_payable, 0).toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
