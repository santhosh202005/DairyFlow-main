import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Search, 
  ArrowLeft, 
  Calendar, 
  Droplets, 
  Wallet, 
  Package, 
  ChevronRight, 
  Send, 
  IndianRupee, 
  QrCode, 
  CreditCard, 
  Banknote,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Pencil,
  CheckCircle,
  AlertTriangle,
  X as XIcon
} from 'lucide-react';

import * as XLSX from 'xlsx';
import { BillingRecord, BillingCycle } from '../types';
import { motion } from 'motion/react';
import SearchBar from './SearchBar';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTranslation } from '../i18n';
import SendMoneyModal from './SendMoneyModal';

interface BillingProps {
  customerId?: string;
  isWorker?: boolean;
  workerId?: string;
  isCustomer?: boolean;
}

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('dairy_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function Billing({ customerId, isWorker = false, workerId, isCustomer = false }: BillingProps) {
  const { t, lang } = useTranslation();
  const [billingData, setBillingData] = useState<BillingRecord[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [detailedData, setDetailedData] = useState<{
    customer?: any;
    startDate?: string;
    endDate?: string;
    milkEntries: any[];
    advances: any[];
    feedPurchases: any[];
    feedReductions: any[];
    payments?: any[];
    advanceBalance?: number;
  } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  
  // Active period filters
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().split('T')[0].substring(0, 7));
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('1-10');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Payout modal state
  const [payingTarget, setPayingTarget] = useState<{
    recipientName: string;
    recipientId: string;
    amount: number;
    phone?: string;
    upiId?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    note?: string;
  } | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [viewingDetails, setViewingDetails] = useState<string | null>(customerId || null);

  // ─── Rate Editor State (vendor-only) ─────────────────────────────────────
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [applyMode, setApplyMode] = useState<'all' | 'from_date'>('all');
  const [applyFromDate, setApplyFromDate] = useState('');
  const [showRateConfirm, setShowRateConfirm] = useState(false);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  const [rateUpdateMsg, setRateUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  const getCycleDates = (monthStr: string, cycle: BillingCycle, customStart?: string, customEnd?: string) => {
    if (cycle === 'custom' && customStart && customEnd) {
      return { 
        startDate: customStart, 
        endDate: customEnd, 
        label: `${customStart} to ${customEnd}`,
        shortLabel: 'Custom'
      };
    }
    const [yearStr, mStr] = monthStr.split('-');
    const year = parseInt(yearStr || String(new Date().getFullYear()), 10);
    const m = parseInt(mStr || String(new Date().getMonth() + 1), 10);
    const lastDay = new Date(year, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const monthName = new Date(year, m - 1, 1).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { month: 'short', year: 'numeric' });

    if (cycle === '1-10') {
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-10`,
        label: `1 – 10 ${monthName} (${t('cycleLabel')} 1)`,
        shortLabel: '1st - 10th',
      };
    } else if (cycle === '11-20') {
      return {
        startDate: `${year}-${pad(m)}-11`,
        endDate: `${year}-${pad(m)}-20`,
        label: `11 – 20 ${monthName} (${t('cycleLabel')} 2)`,
        shortLabel: '11th - 20th',
      };
    } else if (cycle === '21-end') {
      return {
        startDate: `${year}-${pad(m)}-21`,
        endDate: `${year}-${pad(m)}-${pad(lastDay)}`,
        label: `21 – ${lastDay} ${monthName} (${t('cycleLabel')} 3)`,
        shortLabel: '21st - End',
      };
    } else {
      return {
        startDate: `${year}-${pad(m)}-01`,
        endDate: `${year}-${pad(m)}-${pad(lastDay)}`,
        label: `${monthName} (${t('entireMonth')})`,
        shortLabel: 'Full Month',
      };
    }
  };

  const currentCycleInfo = getCycleDates(selectedMonth, selectedCycle, customStartDate, customEndDate);

  useEffect(() => {
    if (customerId) {
      setViewingDetails(customerId);
    }
  }, [customerId]);

  useEffect(() => {
    if (viewingDetails) {
      setDetailedData(null);
      setDetailError(null);
      fetchDetailedBilling(viewingDetails);
    } else {
      setDetailError(null);
      setDetailedData(null);
      fetchBilling();
    }
  }, [selectedMonth, selectedCycle, customStartDate, customEndDate, viewingDetails]);

  const fetchBilling = () => {
    setIsLoadingBilling(true);
    let url = `/api/billing/${selectedMonth}?cycle=${selectedCycle}`;
    if (selectedCycle === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
    }
    fetch(url, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setBillingData(Array.isArray(data) ? data : []))
      .catch(() => setBillingData([]))
      .finally(() => setIsLoadingBilling(false));
  };

  const fetchDetailedBilling = (id: string) => {
    setDetailError(null);
    let url = `/api/billing/${selectedMonth}/${id}?cycle=${selectedCycle}`;
    if (selectedCycle === 'custom' && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
    }
    fetch(url, { headers: getAuthHeaders() })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || t('unableToLoadReport'));
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

  // ─── Bulk Rate Update (vendor-only) ──────────────────────────────────────
  const handleBulkRateUpdate = async () => {
    if (!viewingDetails || !newRate) return;
    const rateVal = parseFloat(newRate);
    if (isNaN(rateVal) || rateVal <= 0) {
      setRateUpdateMsg({ type: 'error', text: t('validPositiveRate') });
      return;
    }
    if (applyMode === 'from_date' && !applyFromDate) {
      setRateUpdateMsg({ type: 'error', text: t('selectDateToApply') });
      return;
    }
    setShowRateConfirm(false);
    setIsUpdatingRate(true);
    setRateUpdateMsg(null);
    try {
      const body: any = {
        customer_id: viewingDetails,
        new_rate: rateVal,
        apply_mode: applyMode,
      };
      if (applyMode === 'from_date' && applyFromDate) {
        body.from_date = applyFromDate;
      }
      const res = await fetch('/api/entries/bulk-update-rate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setRateUpdateMsg({ type: 'error', text: t('failedUpdateRate') });
        return;
      }
      setRateUpdateMsg({
        type: 'success',
        text: `✅ ${t('rateUpdateSuccess')
          .replace('{rate}', String(rateVal))
          .replace('{count}', String(data.updatedCount))
          .replace('{entryLabel}', t(data.updatedCount === 1 ? 'entrySingular' : 'entriesPlural'))}`,
      });
      setShowRateEditor(false);
      setNewRate('');
      setApplyMode('all');
      setApplyFromDate('');
      // Refresh billing data to reflect new amounts
      if (viewingDetails) fetchDetailedBilling(viewingDetails);
    } catch {
      setRateUpdateMsg({ type: 'error', text: t('networkTryAgain') });
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const handleExportExcel = () => {
    if (!billingData || billingData.length === 0) return;
    const exportRows = filteredBilling.map((b, i) => ({
      'S.No': i + 1,
      'Farmer Name': b.name,
      'Customer ID': b.customer_id,
      'Phone': b.phone || '',
      'UPI ID': b.upi_id || '',
      'Total Milk (Liters)': Number(b.total_liters.toFixed(1)),
      'Gross Milk Amount (₹)': Number(b.total_amount.toFixed(0)),
      'Advances Repaid (₹)': Number(b.total_deduction.toFixed(0)),
      'Total Feed Cost (₹)': Number(b.total_feed.toFixed(0)),
      'Feed Subsidy/Reduction (₹)': Number(b.cattle_feed_reduction.toFixed(0)),
      'Net Feed (₹)': Number(b.net_cattle_feed.toFixed(0)),
      'All-Time Advance Debt (₹)': Number(b.advance_balance.toFixed(0)),
      'Final Net Payable (₹)': Number(b.final_payable.toFixed(0)),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing Statement');
    XLSX.writeFile(workbook, `DairyFlow_Settlement_${selectedMonth}_${selectedCycle}.xlsx`);
  };

  const getPaymentModeIcon = (mode?: string) => {
    switch (mode) {
      case 'upi': return <QrCode size={13} className="text-emerald-600" />;
      case 'bank_transfer': return <CreditCard size={13} className="text-blue-600" />;
      default: return <Banknote size={13} className="text-amber-600" />;
    }
  };

  const getPaymentModeLabel = (mode?: string) => {
    switch (mode) {
      case 'upi': return 'UPI';
      case 'bank_transfer': return t('bankTransfer');
      default: return t('cash');
    }
  };

  const filteredBilling = billingData.filter(b => 
    b.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    b.customer_id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    (b.phone && b.phone.includes(debouncedSearch))
  );

  // Cycle Selector Component
  const renderCycleSelector = () => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70">
        <button
          onClick={() => setSelectedCycle('1-10')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all touch-btn ${
            selectedCycle === '1-10' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          {t('cycle1')}
        </button>
        <button
          onClick={() => setSelectedCycle('11-20')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all touch-btn ${
            selectedCycle === '11-20' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          {t('cycle2')}
        </button>
        <button
          onClick={() => setSelectedCycle('21-end')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all touch-btn ${
            selectedCycle === '21-end' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          {t('cycle3')}
        </button>
        <button
          onClick={() => setSelectedCycle('full')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all touch-btn ${
            selectedCycle === 'full' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          {t('entireMonth')}
        </button>
        <button
          onClick={() => setSelectedCycle('custom')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all touch-btn flex items-center gap-1 ${
            selectedCycle === 'custom' 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <SlidersHorizontal size={11} />
          {t('customRange')}
        </button>
      </div>

      {selectedCycle === 'custom' && (
        <motion.div 
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('startDate')}:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 font-bold">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('endDate')}:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
            />
          </div>
        </motion.div>
      )}
    </div>
  );

  if (viewingDetails) {
    if (detailError) {
      return (
        <div className="space-y-4 md:space-y-10 pb-4 md:pb-20">
          <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center shadow-soft">
            <p className="text-xl font-display font-bold text-rose-600">{t('unableToLoadReport')}</p>
            <p className="text-sm text-slate-500 mt-2">{detailError}</p>
            <button
              onClick={() => {
                setDetailError(null);
                fetchDetailedBilling(viewingDetails);
              }}
              className="mt-6 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors touch-btn"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      );
    }

    if (!detailedData) {
      return (
        <div className="space-y-4 md:space-y-10 pb-4 md:pb-20">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-soft animate-pulse">
            <div className="h-6 w-48 rounded bg-slate-200" />
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-slate-100" />
              ))}
            </div>
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
    const visibleFeedReductions = (detailedData.feedReductions || []).filter(
      (record) => Number(record.quantity || 0) > 0 || Number(record.amount || 0) > 0
    );
    
    // Cattle Feed Reduction logic
    const cattleFeedReduction = (detailedData.feedReductions || []).reduce((sum, record) => sum + Number(record.amount || 0), 0);
    const cattleFeedReductionQuantity = (detailedData.feedReductions || []).reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    const netCattleFeed = Math.max(0, totalFeedAmount - cattleFeedReduction);
    const remainingBalance = netCattleFeed;
    
    const finalPayable = Math.max(0, totalMilkAmount - totalBillDeductions - cattleFeedReduction);

    return (
      <div className="space-y-4 md:space-y-8 pb-4 md:pb-20">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:gap-6 md:justify-between md:items-start md:items-end">
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
                  {t('consolidatedStatement')}
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <Clock size={10} className="text-emerald-600" />
                  {currentCycleInfo.label}
                </span>
              </div>
              <h2 className="page-title">
                {customerId ? t('personal') : (billingData.find(b => b.customer_id === viewingDetails)?.name || t('farmer'))} <span className="text-emerald-600">{t('balance')}</span>
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl md:rounded-2xl border border-slate-100 shadow-soft w-full md:w-auto">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="flex-1 md:w-36 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 focus:bg-slate-50 outline-none transition-all"
            />
            <button 
              onClick={() => window.print()}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center border border-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all touch-btn"
              title={t('printStatement')}
            >
              <Printer size={16} />
            </button>
            {!isWorker && !isCustomer && detailedData?.customer && (
              <button
                onClick={() => setPayingTarget({
                  recipientName: detailedData.customer.name,
                  recipientId: String(detailedData.customer.id),
                  amount: finalPayable,
                  phone: detailedData.customer.phone,
                  upiId: detailedData.customer.upi_id,
                  bankName: detailedData.customer.bank_name,
                  accountNumber: detailedData.customer.account_number,
                  ifscCode: detailedData.customer.ifsc_code,
                  note: `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`
                })}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg md:rounded-xl transition-all flex items-center gap-1.5 shadow-sm touch-btn"
              >
                <QrCode size={14} /> {t('payViaUpi')}
              </button>
            )}
          </div>
        </div>

        {/* 10-Day Cycle Filter Bar */}
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('billingCycle')}:</span>
              <span className="text-xs font-bold text-slate-800 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-100">
                {currentCycleInfo.label}
              </span>
            </div>
            {renderCycleSelector()}
          </div>
        </div>

        {/* Summary Cards */}
        {isWorker ? (
          <div className="grid grid-cols-1 gap-4 md:gap-6 max-w-sm">
            <div className="bento-card bg-emerald-50/30 border-emerald-100 flex flex-col justify-between">
              <div className="flex flex-col gap-1 md:gap-3 text-emerald-600 mb-2 md:mb-6">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
                  <Droplets size={20} />
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-emerald-700">{t('totalLitersCollected')}</span>
              </div>
              <p className="text-lg md:text-3xl font-display font-bold text-emerald-900 tracking-tight">
                {detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Money Received Banner */}
            {isCustomer && (detailedData as any).payments && (detailedData as any).payments.length > 0 && (() => {
              const totalReceived = ((detailedData as any).payments as any[]).reduce((sum: number, p: any) => sum + p.amount, 0);
              return (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 md:px-6 md:py-4 mb-2 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-100">
                    <IndianRupee size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-emerald-800">{t('moneyReceived')} — ₹{totalReceived.toFixed(0)}</p>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                      {t('moneyReceivedDescription')}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4 md:gap-6">
              <div className="bento-card bg-emerald-50/30 border-emerald-100 flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-emerald-600 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
                    <Droplets size={14} className="md:hidden" />
                    <Droplets size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-emerald-700">{t('milkEarnings')}</span>
                </div>
                <p className="text-lg md:text-3xl font-display font-bold text-emerald-900 tracking-tight">₹{totalMilkAmount.toFixed(0)}</p>
              </div>

              <div className="bento-card border-blue-100 bg-white flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-blue-500 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 shrink-0">
                    <Wallet size={14} className="md:hidden" />
                    <Wallet size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">{t('cashAdvances')}</span>
                </div>
                <div>
                  <p className="text-lg md:text-3xl font-display font-bold text-blue-600 tracking-tight">₹{totalCashAdvances.toFixed(0)}</p>
                  <p className="text-[8px] text-blue-400 mt-1 uppercase font-black tracking-widest hidden md:block">{t('informational')}</p>
                </div>
              </div>

              <div className="bento-card border-rose-100 bg-white flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-rose-500 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-rose-100 shrink-0">
                    <Wallet size={14} className="md:hidden" />
                    <Wallet size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">{t('billReduction')}</span>
                </div>
                <div>
                  <p className="text-lg md:text-3xl font-display font-bold text-rose-600 tracking-tight">₹{cattleFeedReduction.toFixed(0)}</p>
                  <p className="text-[8px] text-rose-400 mt-1 uppercase font-black tracking-widest hidden md:block">{t('subtracted')}</p>
                </div>
              </div>

              <div className="bento-card border-orange-100 bg-white flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-orange-500 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 shrink-0">
                    <Package size={14} className="md:hidden" />
                    <Package size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-500">{t('feedExpenses')}</span>
                </div>
                <div>
                  <p className="text-lg md:text-3xl font-display font-bold text-orange-600 tracking-tight">₹{totalFeedAmount.toFixed(0)}</p>
                  <p className="text-[8px] text-orange-400 mt-1 uppercase font-black tracking-widest hidden md:block">{t('infoOnly')}</p>
                </div>
              </div>

              {/* Advance Remaining Balance card */}
              <div className="bento-card border-rose-100 bg-rose-50/20 flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-rose-500 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-rose-500 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-rose-100 shrink-0">
                    <Package size={14} className="md:hidden" />
                    <Package size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-rose-700">
                    {isCustomer ? t('advanceDue') : t('totalDebt')}
                  </span>
                </div>
                <div>
                  <p className="text-lg md:text-3xl font-display font-bold text-rose-600 tracking-tight">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
                  {isCustomer && (
                    <p className="text-[8px] text-rose-400 mt-1 uppercase font-black tracking-widest hidden md:block">{t('afterAllDeductions')}</p>
                  )}
                </div>
              </div>

              <div className="bento-card bg-slate-900 text-white shadow-xl flex flex-col justify-between col-span-1">
                <div className="flex flex-col gap-1 md:gap-3 text-slate-400 mb-2 md:mb-6">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-white/10 text-white rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shrink-0">
                    <FileText size={14} className="md:hidden" />
                    <FileText size={20} className="hidden md:block" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-tight text-slate-300">{t('netPayout')}</span>
                </div>
                <p className="text-xl md:text-4xl font-display font-bold tracking-tight text-emerald-400">₹{finalPayable.toFixed(0)}</p>
              </div>
            </div>
          </>
        )}

        {/* Statement Detail */}
        {!isWorker && (
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 p-4 md:p-10 shadow-soft overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
            <div className="relative z-10">
              <div className="mb-5 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                <div>
                  <h3 className="section-heading mb-1">{t('monthlyStatement')}</h3>
                  <p className="text-xs md:text-sm text-slate-500 font-medium">
                    {t('billingPeriod')}: <span className="font-bold text-slate-800">{currentCycleInfo.label}</span>
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('statementDate')}</p>
                  <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row items-stretch gap-4 md:gap-10">
                <div className="flex-1 w-full">
                  <div className="bg-slate-50 rounded-2xl md:rounded-3xl p-4 md:p-8 border border-slate-100">
                    <table className="hidden sm:table w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('category')}</th>
                          <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('amount')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('milkEarnings')}</td>
                          <td className="py-3 text-xs md:text-sm font-black text-emerald-600 text-right">+ ₹{totalMilkAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('advancesDeduction')}</td>
                          <td className="py-3 text-xs md:text-sm font-black text-rose-500 text-right">- ₹{totalBillDeductions.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('totalCattleFeed')}</td>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-500 text-right">₹{totalFeedAmount.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('cattleFeedReduction')} ({cattleFeedReductionQuantity} sacks)</td>
                          <td className="py-3 text-xs md:text-sm font-black text-rose-500 text-right">- ₹{cattleFeedReduction.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('netCattleFeed')}</td>
                          <td className="py-3 text-xs md:text-sm font-bold text-emerald-600 text-right">₹{netCattleFeed.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-xs md:text-sm font-bold text-slate-700">{t('remainingBalance')}</td>
                          <td className="py-3 text-xs md:text-sm font-bold text-orange-600 text-right">₹{remainingBalance.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-white/50">
                          <td className="py-4 text-sm md:text-base font-black text-slate-900">{t('finalNetSettlement')}</td>
                          <td className="py-4 text-xl md:text-2xl font-display font-bold text-slate-900 text-right text-emerald-700">₹{finalPayable.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="sm:hidden divide-y divide-slate-200">
                      {[
                        { label: t('milkEarnings'), value: `+ ₹${totalMilkAmount.toFixed(2)}`, valueClass: 'font-black text-emerald-600' },
                        { label: t('advancesDeduction'), value: `− ₹${totalBillDeductions.toFixed(2)}`, valueClass: 'font-black text-rose-500' },
                        { label: t('totalCattleFeed'), value: `₹${totalFeedAmount.toFixed(2)}`, valueClass: 'font-bold text-slate-600' },
                        { label: `${t('cattleFeedReduction')} (${cattleFeedReductionQuantity} ${t('sacks')})`, value: `− ₹${cattleFeedReduction.toFixed(2)}`, valueClass: 'font-black text-rose-500' },
                        { label: t('netCattleFeed'), value: `₹${netCattleFeed.toFixed(2)}`, valueClass: 'font-bold text-emerald-600' },
                        { label: t('remainingBalance'), value: `₹${remainingBalance.toFixed(2)}`, valueClass: 'font-bold text-orange-600' },
                        { label: t('finalNetSettlement'), value: `₹${finalPayable.toFixed(2)}`, valueClass: 'text-base font-black text-emerald-700' },
                      ].map((row, index) => (
                        <div key={index} className={`flex items-start justify-between gap-4 py-3 ${index === 6 ? 'bg-white/50 px-2' : ''}`}>
                          <p className={`text-xs ${index === 6 ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>{row.label}</p>
                          <p className={`shrink-0 text-right text-xs ${row.valueClass}`}>{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-8 grid grid-cols-2 gap-3 md:gap-4">
                    <div className="p-3 md:p-6 rounded-xl md:rounded-2xl bg-blue-50/50 border border-blue-100">
                      <p className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5 md:mb-1">{t('cashAdvances')}</p>
                      <p className="text-base md:text-xl font-display font-bold text-blue-600">₹{totalCashAdvances.toFixed(0)}</p>
                      <p className="text-[8px] text-blue-400 font-bold mt-1 uppercase italic hidden md:block">{t('notDeducted')}</p>
                    </div>
                    <div className="p-3 md:p-6 rounded-xl md:rounded-2xl bg-rose-50/50 border border-rose-100">
                      <p className="text-[9px] md:text-[10px] font-black text-rose-400 uppercase tracking-widest mb-0.5 md:mb-1">{t('remainingDebt')}</p>
                      <p className="text-base md:text-xl font-display font-bold text-rose-600">₹{((detailedData as any).advanceBalance || 0).toFixed(0)}</p>
                      <p className="text-[8px] text-rose-400 font-bold mt-1 uppercase italic hidden md:block">{t('carryForward')}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:w-1/3 w-full">
                  <div className="bg-slate-900 p-5 md:p-8 rounded-2xl md:rounded-[2rem] text-white shadow-2xl h-full flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 md:mb-6">{t('farmerRecord')}</h4>
                      <div className="space-y-3 md:space-y-4">
                        <div className="flex justify-between">
                          <span className="text-xs md:text-sm font-bold text-slate-400">{t('farmerId')}</span>
                          <span className="text-xs md:text-sm font-black text-white">#F-{viewingDetails}</span>
                        </div>
                        {detailedData.customer?.upi_id && (
                          <div className="flex justify-between">
                            <span className="text-xs md:text-sm font-bold text-slate-400">UPI ID</span>
                            <span className="text-xs md:text-sm font-mono font-bold text-emerald-400">{detailedData.customer.upi_id}</span>
                          </div>
                        )}

                        {/* ── Milk Rate Row with Edit Button (vendor-only) ── */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs md:text-sm font-bold text-slate-400">{t('milkRate')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm font-black text-white">
                              ₹{((detailedData as any).customer?.default_rate || 30).toFixed(0)}/L
                            </span>
                            {!isCustomer && !isWorker && (
                              <button
                                onClick={() => {
                                  setNewRate(String((detailedData as any).customer?.default_rate || 30));
                                  setShowRateEditor(prev => !prev);
                                  setRateUpdateMsg(null);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[11px] font-black uppercase tracking-wider transition-all touch-btn border border-emerald-600/30"
                                title={t('edit')}
                              >
                                <Pencil size={11} /> {t('edit')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ── Inline Rate Editor Panel (vendor-only) ── */}
                        {!isCustomer && !isWorker && showRateEditor && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1 bg-white/10 rounded-xl p-3.5 space-y-3.5 border border-white/10"
                          >
                            <div className="border-b border-white/10 pb-2">
                              <h5 className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
                                {t('applyChangedRate')}
                              </h5>
                              <p className="text-[10px] text-slate-300 font-medium mt-0.5">
                                {t('applyNewRateToEntries')}
                              </p>
                            </div>

                            {/* Rate input */}
                            <div>
                              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider mb-1">{t('newMilkRate')}</label>
                              <div className="flex items-center gap-1.5">
                                <span className="text-white font-black text-sm">₹</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.5"
                                  value={newRate}
                                  onChange={e => setNewRate(e.target.value)}
                                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-2 text-white text-sm font-bold outline-none focus:border-emerald-400 transition-colors"
                                  placeholder="e.g. 35"
                                />
                                <span className="text-slate-300 text-xs font-bold">/L</span>
                              </div>
                            </div>

                            {/* Apply Mode: Two Options */}
                            <div className="space-y-2">
                              <label className="block text-[10px] font-black text-slate-300 uppercase tracking-wider">
                                {t('applyNewRateToEntries')}
                              </label>

                              {/* Option A */}
                              <div
                                onClick={() => setApplyMode('all')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  applyMode === 'all'
                                    ? 'bg-emerald-900/40 border-emerald-500 text-white shadow-sm'
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                    applyMode === 'all' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-400'
                                  }`}>
                                    {applyMode === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                  </div>
                                  <span className="text-xs font-black">{t('applyToAllEntries')}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 pl-5.5 leading-relaxed">
                                  {t('optionAllEntriesDescription')}
                                </p>
                              </div>

                              {/* Option B */}
                              <div
                                onClick={() => setApplyMode('from_date')}
                                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  applyMode === 'from_date'
                                    ? 'bg-emerald-900/40 border-emerald-500 text-white shadow-sm'
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                    applyMode === 'from_date' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-400'
                                  }`}>
                                    {applyMode === 'from_date' && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                  </div>
                                  <span className="text-xs font-black">{t('applyFromSelectedDate')}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 pl-5.5 leading-relaxed">
                                  {t('optionFromDateDescription')}
                                </p>

                                {/* Date picker for Option B */}
                                {applyMode === 'from_date' && (
                                  <div className="mt-2 pl-5.5" onClick={e => e.stopPropagation()}>
                                    <label className="block text-[10px] font-black text-emerald-300 uppercase tracking-wider mb-1">
                                      {t('selectDate')}
                                    </label>
                                    <input
                                      type="date"
                                      value={applyFromDate}
                                      onChange={e => setApplyFromDate(e.target.value)}
                                      className="w-full bg-slate-800 border border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-white text-xs font-bold outline-none focus:border-emerald-400 transition-colors"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => { setShowRateEditor(false); setRateUpdateMsg(null); }}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all touch-btn flex items-center justify-center gap-1"
                              >
                                <XIcon size={11} /> {t('cancel')}
                              </button>
                              <button
                                type="button"
                                disabled={!newRate || parseFloat(newRate) <= 0 || (applyMode === 'from_date' && !applyFromDate)}
                                onClick={() => {
                                  if (!newRate || parseFloat(newRate) <= 0) {
                                    setRateUpdateMsg({ type: 'error', text: t('enterValidRate') });
                                    return;
                                  }
                                  if (applyMode === 'from_date' && !applyFromDate) {
                                    setRateUpdateMsg({ type: 'error', text: t('selectDateToApply') });
                                    return;
                                  }
                                  setRateUpdateMsg(null);
                                  setShowRateConfirm(true);
                                }}
                                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all touch-btn flex items-center justify-center gap-1 shadow-sm"
                              >
                                <Pencil size={11} /> {t('applyRate')}
                              </button>
                            </div>

                            {/* Inline error for rate editor */}
                            {rateUpdateMsg && !showRateConfirm && (
                              <div className={`flex items-start gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-2 ${
                                rateUpdateMsg.type === 'success'
                                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30'
                                  : 'bg-rose-600/20 text-rose-300 border border-rose-600/30'
                              }`}>
                                {rateUpdateMsg.type === 'success' ? <CheckCircle size={11} className="mt-0.5 shrink-0" /> : <AlertTriangle size={11} className="mt-0.5 shrink-0" />}
                                <span>{rateUpdateMsg.text}</span>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Success banner outside rate editor (after close) */}
                        {!showRateEditor && rateUpdateMsg?.type === 'success' && (
                          <div className="flex items-start gap-1.5 text-[10px] font-bold rounded-lg px-2.5 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-600/30">
                            <CheckCircle size={11} className="mt-0.5 shrink-0" />
                            <span>{rateUpdateMsg.text}</span>
                          </div>
                        )}

                        <div className="flex justify-between">
                          <span className="text-xs md:text-sm font-bold text-slate-400">{t('totalSupply')}</span>
                          <span className="text-xs md:text-sm font-black text-white">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 md:mt-8 pt-5 md:pt-8 border-t border-white/10 flex flex-col gap-2">
                      {!isWorker && !isCustomer && (
                        <button 
                          onClick={() => setPayingTarget({
                            recipientName: detailedData.customer?.name || 'Farmer',
                            recipientId: String(detailedData.customer?.id || viewingDetails),
                            amount: finalPayable,
                            phone: detailedData.customer?.phone,
                            upiId: detailedData.customer?.upi_id,
                            bankName: detailedData.customer?.bank_name,
                            accountNumber: detailedData.customer?.account_number,
                            ifscCode: detailedData.customer?.ifsc_code,
                            note: `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`
                          })}
                          className="w-full py-2.5 md:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 touch-btn shadow-md"
                        >
                          <QrCode size={14} /> {t('payViaUpiQr')}
                        </button>
                      )}
                      <button 
                        onClick={() => window.print()}
                        className="w-full py-2.5 md:py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all touch-btn text-center"
                      >
                        {t('printStatement')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirmation Modal for Bulk Rate Change ── */}
        {showRateConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-slate-100"
            >
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg md:text-xl font-display font-bold text-slate-900 mb-2 text-center tracking-tight">
                {t('changeMilkRate')}
              </h3>
              <p className="text-slate-600 text-sm font-medium mb-4 text-center leading-relaxed">
                {t('changeMilkRateDescription')}
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-6 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">{t('newRate')}:</span>
                  <span className="font-black text-emerald-600">₹{newRate}/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-400">{t('scope')}:</span>
                  <span className="font-bold text-slate-800">
                    {applyMode === 'all' ? t('allExistingEntries') : `${t('fromDate')} ${applyFromDate}`}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowRateConfirm(false)}
                  className="py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-95 touch-btn"
                >
                  {t('cancel')}
                </button>
                <button
                  disabled={isUpdatingRate}
                  onClick={handleBulkRateUpdate}
                  className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-100 active:scale-95 touch-btn flex items-center justify-center gap-1.5"
                >
                  {isUpdatingRate ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('updating')}</>
                  ) : (
                    <>{t('applyNewRate')}</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}




        {/* Detailed Records */}
        <div className="grid grid-cols-1 gap-4 md:gap-10">
          {/* Milk Records */}
          <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
            <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
              <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Droplets size={13} className="text-emerald-500" />
                {t('milkSupplyDetails')}
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{detailedData.milkEntries.length} {t('recordsLabel')}</span>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left mobile-compact-table">
                <thead className="bg-white/90 backdrop-blur sticky top-0 z-10">
                  <tr className="border-b border-slate-50">
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">{t('date')}</th>
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">{t('shift')}</th>
                    <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">{t('liters')}</th>
                    {!isWorker && <th className="hidden sm:table-cell px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">{t('rate')}</th>}
                    {!isWorker && <th className="px-4 md:px-8 py-3 md:py-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">{t('value')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50/50">
                  {detailedData.milkEntries.map((e, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 md:px-8 py-2.5 md:py-4">
                        <p className="text-xs md:text-sm font-bold text-slate-700">
                          {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
                      {!isWorker && (
                        <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4">
                          <span className="text-[10px] md:text-xs font-bold text-slate-400">₹{e.rate || ((detailedData as any).customer?.default_rate || 30)}</span>
                        </td>
                      )}
                      {!isWorker && (
                        <td className="px-4 md:px-8 py-2.5 md:py-4 text-right">
                          <p className="text-xs md:text-sm font-display font-black text-slate-900 tracking-tight">₹{e.amount.toFixed(2)}</p>
                        </td>
                      )}
                    </tr>
                  ))}
                  {detailedData.milkEntries.length === 0 && (
                    <tr><td colSpan={isWorker ? 3 : 5} className="py-6 text-center text-slate-300 italic font-medium text-sm">No milk entries recorded for this cycle period.</td></tr>
                  )}
                  <tr className="bg-slate-50">
                    <td colSpan={2} className="px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-black text-slate-900 uppercase">{t('subtotal')}</td>
                    <td className="px-4 md:px-8 py-3 md:py-4 text-xs md:text-sm font-black text-slate-900">{detailedData.milkEntries.reduce((acc, curr) => acc + curr.liters, 0).toFixed(1)} L</td>
                    {!isWorker && <td className="hidden sm:table-cell px-4 md:px-8 py-3 md:py-4"></td>}
                    {!isWorker && <td className="px-4 md:px-8 py-3 md:py-4 text-right text-base md:text-lg font-display font-black text-emerald-600">₹{totalMilkAmount.toFixed(2)}</td>}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="sm:hidden divide-y divide-slate-100 px-3">
              {detailedData.milkEntries.map((entry, index) => (
                <div key={index} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-slate-800">
                      {new Date(entry.date + 'T00:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${entry.shift === 'AM' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                      {entry.shift}
                    </span>
                  </div>
                  <div className={`mt-2 grid ${isWorker ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400">{t('liters')}</p>
                      <p className="text-xs font-bold text-slate-700">{Number(entry.liters).toFixed(1)} L</p>
                    </div>
                    {!isWorker && (
                      <>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400">{t('rate')}</p>
                          <p className="text-xs font-bold text-slate-700">₹{entry.rate || ((detailedData as any).customer?.default_rate || 30)}/L</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400">{t('amount')}</p>
                          <p className="text-xs font-black text-emerald-700">₹{Number(entry.amount).toFixed(2)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {detailedData.milkEntries.length === 0 ? (
                <p className="py-5 text-center text-xs italic text-slate-400">{t('noEntriesForMonth')}</p>
              ) : (
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-xs font-black uppercase text-slate-700">{t('subtotal')}</span>
                  <span className="text-xs font-black text-slate-900">
                    {detailedData.milkEntries.reduce((total, entry) => total + Number(entry.liters), 0).toFixed(1)} L
                    {!isWorker && ` · ₹${totalMilkAmount.toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isWorker && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10">
              {/* Feed Records */}
              <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
                <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                  <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Package size={13} className="text-orange-500" />
                    {t('feedExpenses')}
                  </h4>
                  <span className="text-xs md:text-sm font-black text-rose-500">₹{totalFeedAmount.toFixed(0)}</span>
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left mobile-compact-table">
                    <thead className="bg-white border-b border-slate-50">
                      <tr>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('date')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('item')}</th>
                        <th className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('qtyLabel')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">{t('cost')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {detailedData.feedPurchases.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-bold text-slate-500">
                            {new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-xs md:text-sm font-bold text-slate-700">{p.feed_name}</td>
                          <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-black text-slate-400">{p.quantity} sacks × ₹{Number(p.unit_price ?? (p.amount / p.quantity)).toLocaleString('en-IN')}</td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black text-rose-500">₹{p.amount.toFixed(0)}</td>
                        </tr>
                      ))}
                      {visibleFeedReductions.map((reduction, idx) => (
                        <tr key={`reduction-${idx}`} className="bg-emerald-50/60">
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-bold text-slate-500">{reduction.month}</td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-xs md:text-sm font-bold text-emerald-800">{t('cattleFeedReduction')}</td>
                          <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-black text-emerald-700">{reduction.quantity} sacks × ₹{Number(reduction.unit_price).toLocaleString('en-IN')}</td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black text-emerald-700">− ₹{Number(reduction.amount).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {detailedData.feedPurchases.length === 0 && visibleFeedReductions.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-300 italic font-medium text-sm">{t('noFeedAllocations')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden divide-y divide-slate-100 px-3">
                  {detailedData.feedPurchases.map((purchase, index) => (
                    <div key={`purchase-${index}`} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{purchase.feed_name}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {new Date(purchase.date + 'T00:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-rose-600">₹{Number(purchase.amount).toFixed(2)}</p>
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">
                        {purchase.quantity} {t('sacks')} × ₹{Number(purchase.unit_price ?? (purchase.amount / purchase.quantity)).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                  {visibleFeedReductions.map((reduction, index) => (
                    <div key={`reduction-${index}`} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-800">{t('cattleFeedReduction')}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{reduction.month}</p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-emerald-700">− ₹{Number(reduction.amount).toFixed(2)}</p>
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-emerald-700">
                        {reduction.quantity} {t('sacks')} × ₹{Number(reduction.unit_price).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                  {detailedData.feedPurchases.length === 0 && visibleFeedReductions.length === 0 && (
                    <p className="py-5 text-center text-xs italic text-slate-400">{t('noFeedAllocations')}</p>
                  )}
                </div>
              </div>

              {/* Advances Ledger */}
              <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden">
                <div className="px-4 md:px-8 py-4 md:py-6 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                  <h4 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Wallet size={13} className="text-emerald-500" />
                    {t('advancesLedger')}
                  </h4>
                  <span className="text-xs md:text-sm font-black text-emerald-600">{t('repaid')}: ₹{totalBillDeductions.toFixed(0)}</span>
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left mobile-compact-table">
                    <thead className="bg-white border-b border-slate-50">
                      <tr>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('date')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('type')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">{t('amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {detailedData.advances.map((a: any, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] md:text-xs font-bold text-slate-500">
                            {new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              a.type === 'deduction' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {a.type === 'deduction' ? t('deductionsLabel') : t('advancesLabel')}
                            </span>
                          </td>
                          <td className={`px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black ${
                            a.type === 'deduction' ? 'text-emerald-600' : 'text-blue-500'
                          }`}>
                            ₹{a.amount.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden divide-y divide-slate-100 px-3">
                  {detailedData.advances.length === 0 ? (
                    <p className="py-5 text-center text-xs italic text-slate-400">{t('noTransactionsRecorded')}</p>
                  ) : detailedData.advances.map((advance: any, index) => (
                    <div key={index} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">
                          {advance.type === 'deduction' ? t('deductionsLabel') : t('advancesLabel')}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {new Date(advance.date + 'T00:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <p className={`shrink-0 text-sm font-black ${advance.type === 'deduction' ? 'text-emerald-600' : 'text-blue-600'}`}>
                        ₹{Number(advance.amount).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Payout Credits Received */}
              <div className="bg-white rounded-2xl md:rounded-[2rem] shadow-soft border border-slate-100 overflow-hidden col-span-1 lg:col-span-2">
                <div className="px-4 md:px-8 py-4 md:py-6 bg-emerald-50/40 border-b border-emerald-100 flex items-center justify-between">
                  <h4 className="text-xs md:text-sm font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                    <Wallet size={14} className="text-emerald-600" />
                    {t('creditsReceived')} / {t('creditHistory')}
                  </h4>
                  <span className="text-xs md:text-sm font-black text-emerald-700">
                    {t('paymentsReceived')}: ₹{((detailedData.payments || []).reduce((acc: number, curr: any) => acc + curr.amount, 0)).toFixed(0)}
                  </span>
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left mobile-compact-table">
                    <thead className="bg-white border-b border-slate-50">
                      <tr>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('date')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('paymentMode')}</th>
                        <th className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('referenceNo')}</th>
                        <th className="px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">{t('amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(detailedData.payments || []).map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors border-l-4 border-emerald-500">
                          <td className="px-4 md:px-8 py-2.5 md:py-4">
                            <p className="text-[10px] md:text-xs font-bold text-slate-700">
                              {new Date(p.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                            {p.note && <p className="text-[9px] text-slate-400 font-medium">{p.note}</p>}
                          </td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {getPaymentModeIcon(p.payment_mode)}
                              {getPaymentModeLabel(p.payment_mode)}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell px-4 md:px-8 py-2.5 md:py-4 text-[10px] font-mono text-slate-500">
                            {p.reference_no || '-'}
                          </td>
                          <td className="px-4 md:px-8 py-2.5 md:py-4 text-right text-xs md:text-sm font-display font-black text-emerald-600">
                            + ₹{p.amount.toFixed(0)}
                          </td>
                        </tr>
                      ))}
                      {(!detailedData.payments || detailedData.payments.length === 0) && (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-300 italic font-medium text-sm">{t('noCreditsYet')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="sm:hidden divide-y divide-slate-100 px-3">
                  {(detailedData.payments || []).length === 0 ? (
                    <p className="py-5 text-center text-xs italic text-slate-400">{t('noCreditsYet')}</p>
                  ) : (detailedData.payments || []).map((payment: any, index: number) => (
                    <div key={index} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800">
                            {new Date(payment.date + 'T00:00:00').toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {payment.note && <p className="mt-0.5 truncate text-[10px] text-slate-500">{payment.note}</p>}
                        </div>
                        <p className="shrink-0 text-sm font-black text-emerald-700">+ ₹{Number(payment.amount).toFixed(2)}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                          {getPaymentModeIcon(payment.payment_mode)}
                          {getPaymentModeLabel(payment.payment_mode)}
                        </span>
                        {payment.reference_no && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {t('referenceNo')}: {payment.reference_no}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global SendMoneyModal */}
        {payingTarget && (
          <SendMoneyModal
            isOpen={!!payingTarget}
            onClose={() => setPayingTarget(null)}
            recipientName={payingTarget.recipientName}
            recipientType="customer"
            recipientId={payingTarget.recipientId}
            amount={payingTarget.amount}
            phone={payingTarget.phone}
            upiId={payingTarget.upiId}
            bankName={payingTarget.bankName}
            accountNumber={payingTarget.accountNumber}
            ifscCode={payingTarget.ifscCode}
            note={payingTarget.note || `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`}
            onPaymentRecorded={() => {
              if (viewingDetails) fetchDetailedBilling(viewingDetails);
              else fetchBilling();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:gap-6 md:justify-between md:items-start md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1 md:mb-3">
            <span className="px-2 py-0.5 md:px-3 md:py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-[0.15em]">
              {t('financialOverview')}
            </span>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-7 pr-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-black text-slate-600 outline-none hover:border-slate-300 transition-all cursor-pointer uppercase tracking-widest"
              />
            </div>
          </div>
          <h2 className="page-title">
            {t('settlementJournal').split(' ')[0]} <span className="text-emerald-600">{t('settlementJournal').split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Active Cycle: <span className="font-bold text-slate-700">{currentCycleInfo.label}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex-1 md:w-64">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder={t('searchFarmers')}
              className="w-full"
            />
          </div>
          <button 
            onClick={() => window.print()}
            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-soft active:scale-95 transition-all touch-btn flex-shrink-0"
            title={t('printStatement')}
          >
            <Printer size={16} />
          </button>
          <button 
            onClick={handleExportExcel}
            className="hidden md:flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 touch-btn"
          >
            <Download size={15} />
            {t('export')}
          </button>
        </div>
      </div>

      {/* 10-Day Cycle Selection Bar */}
      <div className="bg-white p-3.5 md:p-5 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('billingCycle')}:</span>
            <span className="text-xs font-bold text-slate-800 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-lg border border-emerald-100">
              {currentCycleInfo.label}
            </span>
          </div>
          {renderCycleSelector()}
        </div>
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-6 md:px-8 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">{t('farmer')}</th>
                <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">{t('volL')}</th>
                {!isWorker && <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">{t('grossRevenue')}</th>}
                {!isWorker && <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em]">{t('cattleFeedDetails')}</th>}
                {!isWorker && <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-right">{t('debt')}</th>}
                {!isWorker && <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-right">{t('netSettlement')}</th>}
                <th className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-500 text-[10px] uppercase tracking-[0.2em] text-center">Action / Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoadingBilling && Array.from({ length: 5 }).map((_, index) => (
                <tr key={`billing-skeleton-${index}`} className="animate-pulse">
                  {Array.from({ length: isWorker ? 3 : 7 }).map((__, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-5">
                      <div className="h-4 rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}
              {filteredBilling.map((record: any) => (
                <tr key={record.customer_id} className="group hover:bg-emerald-50/20 transition-all">
                  <td className="px-6 md:px-8 py-4 md:py-5">
                    <p className="font-bold text-slate-900 tracking-tight text-sm">{record.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {record.phone ? record.phone : `#${record.customer_id}`}
                      {record.upi_id && <span className="ml-1 text-emerald-600 font-sans font-medium">({record.upi_id})</span>}
                    </p>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-5 font-black text-slate-600 text-sm tracking-tight">{record.total_liters.toFixed(1)} L</td>
                  {!isWorker && <td className="px-4 md:px-6 py-4 md:py-5 font-display font-black text-slate-700 text-sm tracking-tight">₹{record.total_amount.toFixed(0)}</td>}
                  {!isWorker && (
                    <td className="px-4 md:px-6 py-4 md:py-5">
                      <div className="flex flex-wrap gap-1.5">
                        {record.total_feed > 0 && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-black uppercase tracking-widest border border-orange-100">Feed: ₹{record.total_feed.toFixed(0)}</span>}
                        {record.cattle_feed_reduction > 0 && <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-widest border border-rose-100">Reduc: ₹{record.cattle_feed_reduction.toFixed(0)}</span>}
                        {record.net_cattle_feed > 0 && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest border border-emerald-100">Net: ₹{record.net_cattle_feed.toFixed(0)}</span>}
                      </div>
                    </td>
                  )}
                  {!isWorker && (
                    <td className="px-4 md:px-6 py-4 md:py-5 text-rose-500 font-display font-black text-sm text-right tracking-tight">
                      <span className={record.advance_balance > 0 ? 'opacity-100' : 'opacity-20'}>₹{record.advance_balance.toFixed(0)}</span>
                    </td>
                  )}
                  {!isWorker && (
                    <td className="px-4 md:px-6 py-4 md:py-5 text-right">
                      <span className={`px-2.5 py-1 rounded-xl font-display font-black text-sm shadow-sm ring-1 ring-inset ${
                        record.final_payable > 0 ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}>
                        ₹{record.final_payable.toFixed(0)}
                      </span>
                    </td>
                  )}
                  <td className="px-4 md:px-6 py-4 md:py-5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {!isWorker && record.final_payable > 0 && (
                        <button
                          onClick={() => setPayingTarget({
                            recipientName: record.name,
                            recipientId: record.customer_id,
                            amount: record.final_payable,
                            phone: record.phone,
                            upiId: record.upi_id,
                            bankName: record.bank_name,
                            accountNumber: record.account_number,
                            ifscCode: record.ifsc_code,
                            note: `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`
                          })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all touch-btn"
                          title="Pay via Dynamic UPI QR"
                        >
                          <QrCode size={13} /> Pay UPI
                        </button>
                      )}
                      <button 
                        onClick={() => setViewingDetails(record.customer_id)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 shadow-soft transition-all active:scale-90 touch-btn"
                        title="View Statement"
                      >
                        <FileText size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoadingBilling && filteredBilling.length === 0 && (
                <tr>
                  <td colSpan={isWorker ? 3 : 7} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-4">
                      <Search size={32} />
                    </div>
                    <p className="text-base font-display font-bold text-slate-400">{t('noRecordsFound')}</p>
                    <p className="text-sm text-slate-300 font-medium">No milk entries recorded for this cycle period.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list for billing */}
      <div className="md:hidden space-y-3">
        {isLoadingBilling && Array.from({ length: 4 }).map((_, index) => (
          <div key={`mobile-billing-skeleton-${index}`} className="h-24 rounded-2xl bg-white border border-slate-100 animate-pulse" />
        ))}
        {!isLoadingBilling && filteredBilling.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 mx-auto mb-3">
              <Search size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400">{t('noRecords')}</p>
            <p className="text-xs text-slate-300 mt-1">No entries found for {currentCycleInfo.shortLabel}.</p>
          </div>
        )}
        {filteredBilling.map((record: any) => (
          <motion.div
            key={record.customer_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-soft space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 text-sm">{record.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {record.total_liters.toFixed(1)} {t('lSupplied')}
                  {record.upi_id && <span className="ml-1 text-emerald-600 font-mono font-medium">· {record.upi_id}</span>}
                </p>
              </div>
              <button 
                onClick={() => setViewingDetails(record.customer_id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wide touch-btn"
              >
                {t('view')} <ChevronRight size={12} />
              </button>
            </div>

            {!isWorker && (
              <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 rounded-xl">
                <div className="text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{t('gross')}</p>
                  <p className="text-xs font-display font-bold text-slate-700">₹{record.total_amount.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">{t('debt')}</p>
                  <p className={`text-xs font-display font-bold ${record.advance_balance > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                    ₹{record.advance_balance.toFixed(0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-emerald-600 uppercase font-black tracking-wider">{t('netPay')}</p>
                  <p className="text-sm font-display font-black text-emerald-700">₹{record.final_payable.toFixed(0)}</p>
                </div>
              </div>
            )}

            {!isWorker && record.final_payable > 0 && (
              <button
                onClick={() => setPayingTarget({
                  recipientName: record.name,
                  recipientId: record.customer_id,
                  amount: record.final_payable,
                  phone: record.phone,
                  upiId: record.upi_id,
                  bankName: record.bank_name,
                  accountNumber: record.account_number,
                  ifscCode: record.ifsc_code,
                  note: `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`
                })}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm touch-btn"
              >
                <QrCode size={14} /> Pay ₹{record.final_payable.toFixed(0)} via UPI
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary footer cards */}
      <div className={`grid gap-3 md:gap-6 ${isWorker ? 'grid-cols-1 max-w-xs' : 'grid-cols-2 md:grid-cols-4'}`}>
        <div className="bento-card bg-emerald-50 border-emerald-100">
          <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">{t('totalLiters')}</p>
          <p className="text-xl md:text-3xl font-display font-bold text-emerald-900 tracking-tight">
            {filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_liters, 0).toFixed(1)} <span className="text-sm md:text-lg">L</span>
          </p>
        </div>
        {!isWorker && (
          <>
            <div className="bento-card border-slate-100">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">{t('totalDebt')}</p>
              <p className="text-xl md:text-3xl font-display font-bold text-rose-500 tracking-tight">
                ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.advance_balance, 0).toFixed(0)}
              </p>
            </div>
            <div className="bento-card border-slate-100">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">{t('deductions')}</p>
              <p className="text-xl md:text-3xl font-display font-bold text-slate-900 tracking-tight">
                ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.total_feed + (curr.total_deduction || 0), 0).toFixed(0)}
              </p>
            </div>
            <div className="bento-card bg-slate-900 text-white shadow-xl">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1 md:mb-2">{t('netPayout')}</p>
              <p className="text-xl md:text-3xl font-display font-bold tracking-tight text-emerald-400">
                ₹{filteredBilling.reduce((acc: any, curr: any) => acc + curr.final_payable, 0).toFixed(0)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Global SendMoneyModal for Row & Card Payouts */}
      {payingTarget && (
        <SendMoneyModal
          isOpen={!!payingTarget}
          onClose={() => setPayingTarget(null)}
          recipientName={payingTarget.recipientName}
          recipientType="customer"
          recipientId={payingTarget.recipientId}
          amount={payingTarget.amount}
          phone={payingTarget.phone}
          upiId={payingTarget.upiId}
          bankName={payingTarget.bankName}
          accountNumber={payingTarget.accountNumber}
          ifscCode={payingTarget.ifscCode}
          note={payingTarget.note || `Milk Payout (${currentCycleInfo.shortLabel} ${selectedMonth})`}
          onPaymentRecorded={() => {
            fetchBilling();
          }}
        />
      )}
    </div>
  );
}
