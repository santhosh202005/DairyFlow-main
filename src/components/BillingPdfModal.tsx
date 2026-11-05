import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Share2, 
  Eye, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  Droplets, 
  Package, 
  CreditCard, 
  Receipt,
  Sparkles,
  Search,
  Trash2,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { 
  generateMilkPaymentReceipt, 
  generateMonthlyBill, 
  generateCattleFeedStatement, 
  generatePaymentReceipt, 
  handlePdfAction, 
  type PdfActionResult,
  getReceiptHistory, 
  saveReceiptToHistory,
  formatINR,
  PdfAction, 
  ReceiptHistoryItem 
} from '../utils/pdfGenerator';
import { loadStoredAuth } from '../auth';
import { useTranslation } from '../i18n';

export type DocType = 'bill' | 'milk' | 'feed' | 'payment';

function formatPdfFileSize(sizeBytes: number): string {
  return sizeBytes < 1024 * 1024
    ? `${(sizeBytes / 1024).toFixed(1)} KB`
    : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface BillingPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocType?: DocType;
  detailedData?: {
    customer?: any;
    startDate?: string;
    endDate?: string;
    milkEntries?: any[];
    advances?: any[];
    feedPurchases?: any[];
    feedReductions?: any[];
    payments?: any[];
    totalCashAdvances?: number;
    advanceBalance?: number;
    previousBalance?: number;
  } | null;
  selectedMonth: string;
  cycleInfo: {
    startDate: string;
    endDate: string;
    label: string;
    shortLabel: string;
  };
  singlePayment?: {
    id?: string | number;
    amount: number;
    date: string;
    payment_mode?: string;
    reference_no?: string;
    note?: string;
  } | null;
  onRefreshHistory?: () => void;
}

export default function BillingPdfModal({
  isOpen,
  onClose,
  initialDocType = 'bill',
  detailedData,
  selectedMonth,
  cycleInfo,
  singlePayment,
}: BillingPdfModalProps) {
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<DocType>(initialDocType);
  const [selectedPayment, setSelectedPayment] = useState<any>(singlePayment || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingAction, setGeneratingAction] = useState<PdfAction | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastReceiptNumber, setLastReceiptNumber] = useState<string | null>(null);
  const generationInProgress = useRef(false);

  useEffect(() => {
    if (initialDocType) {
      setActiveTab(initialDocType);
    }
  }, [initialDocType, isOpen]);

  useEffect(() => {
    if (singlePayment) {
      setSelectedPayment(singlePayment);
      setActiveTab('payment');
    }
  }, [singlePayment]);

  if (!isOpen) return null;

  const auth = loadStoredAuth();
  const customer = detailedData?.customer || {};

  // Business info fallback hierarchy
  const businessName = customer?.vendor_name || auth?.vendorName || 'DairyFlow Dairy';
  const businessAddress = customer?.vendor_address || auth?.vendorAddress || 'Main Road, Dairy Center';
  const businessPhone = customer?.vendor_phone || auth?.vendorPhone || '+91 98765 43210';

  const milkEntries = detailedData?.milkEntries || [];
  const advances = detailedData?.advances || [];
  const feedPurchases = detailedData?.feedPurchases || [];
  const feedReductions = detailedData?.feedReductions || [];
  const payments = detailedData?.payments || [];

  const totalMilkAmount = milkEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalLiters = milkEntries.reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);

  const totalCashAdvances = detailedData?.totalCashAdvances !== undefined
    ? Number(detailedData.totalCashAdvances) || 0
    : advances
      .filter((a: any) => a.type !== 'deduction')
      .reduce((acc, curr: any) => acc + (Number(curr.amount) || 0), 0);

  const totalBillDeductions = advances
    .filter((a: any) => a.type === 'deduction')
    .reduce((acc, curr: any) => acc + (Number(curr.amount) || 0), 0);

  const totalFeedAmount = feedPurchases.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const cattleFeedReduction = feedReductions.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
  const netCattleFeed = Math.max(0, totalFeedAmount - cattleFeedReduction);

  const advanceBalance = detailedData?.advanceBalance !== undefined ? detailedData.advanceBalance : 0;
  const finalPayable = Math.max(0, totalMilkAmount - totalBillDeductions - cattleFeedReduction);

  // Trigger PDF Generation and action
  const handleGenerate = async (action: PdfAction) => {
    if (generationInProgress.current) return;
    generationInProgress.current = true;
    setIsGenerating(true);
    setGeneratingAction(action);
    setStatusMessage(null);
    const actionWindow = action === 'preview' || action === 'print'
      ? window.open('', '_blank')
      : undefined;

    try {
      if ((action === 'preview' || action === 'print') && !actionWindow) {
        throw new Error('The PDF window was blocked. Allow pop-ups for DairyFlow and try again.');
      }

      let result;

      if (activeTab === 'milk') {
        result = await generateMilkPaymentReceipt({
          businessName,
          businessAddress,
          businessPhone,
          customerName: customer.name || 'Farmer',
          customerId: customer.customer_code || String(customer.id || 'N/A'),
          customerPhone: customer.phone,
          cycleLabel: cycleInfo.label,
          startDate: cycleInfo.startDate,
          endDate: cycleInfo.endDate,
          milkEntries: milkEntries.map((e: any) => ({
            date: e.date,
            shift: e.shift || 'AM',
            liters: Number(e.liters) || 0,
            rate: Number(e.rate) || 30,
            amount: Number(e.amount) || 0,
          })),
          totalLiters,
          totalMilkAmount,
          totalAdvancesDeducted: totalBillDeductions,
          cattleFeedReduction,
          finalPayable,
          advanceBalance,
        });
      } else if (activeTab === 'bill') {
        result = await generateMonthlyBill({
          businessName,
          businessAddress,
          businessPhone,
          customerName: customer.name || 'Farmer',
          customerId: customer.customer_code || String(customer.id || 'N/A'),
          customerPhone: customer.phone,
          customerUpiId: customer.upi_id,
          cycleLabel: cycleInfo.label,
          startDate: cycleInfo.startDate,
          endDate: cycleInfo.endDate,
          milkEntries: milkEntries.map((e: any) => ({
            date: e.date,
            shift: e.shift || 'AM',
            liters: Number(e.liters) || 0,
            rate: Number(e.rate) || 30,
            amount: Number(e.amount) || 0,
          })),
          advances: advances.map((a: any) => ({
            date: a.date,
            amount: Number(a.amount) || 0,
            type: a.type || 'advance',
          })),
          feedPurchases: feedPurchases.map((f: any) => ({
            date: f.date,
            feed_name: f.feed_name || 'Cattle Feed',
            quantity: Number(f.quantity) || 0,
            unit_price: Number(f.unit_price) || 0,
            amount: Number(f.amount) || 0,
          })),
          feedReductions: feedReductions.map((r: any) => ({
            month: r.month,
            quantity: Number(r.quantity) || 0,
            unit_price: Number(r.unit_price) || 0,
            amount: Number(r.amount) || 0,
          })),
          payments: payments.map((p: any) => ({
            date: p.date,
            amount: Number(p.amount) || 0,
            payment_mode: p.payment_mode,
            reference_no: p.reference_no,
            note: p.note,
          })),
          totalMilkAmount,
          totalCashAdvances,
          totalBillDeductions,
          totalFeedAmount,
          cattleFeedReduction,
          netCattleFeed,
          finalPayable,
          advanceBalance,
          previousBalance: detailedData?.previousBalance,
        });
      } else if (activeTab === 'feed') {
        result = await generateCattleFeedStatement({
          businessName,
          businessAddress,
          businessPhone,
          customerName: customer.name || 'Farmer',
          customerId: customer.customer_code || String(customer.id || 'N/A'),
          cycleLabel: cycleInfo.label,
          feedPurchases: feedPurchases.map((f: any) => ({
            date: f.date,
            feed_name: f.feed_name || 'Cattle Feed',
            quantity: Number(f.quantity) || 0,
            unit_price: Number(f.unit_price) || 0,
            amount: Number(f.amount) || 0,
          })),
          feedReductions: feedReductions.map((r: any) => ({
            month: r.month,
            quantity: Number(r.quantity) || 0,
            unit_price: Number(r.unit_price) || 0,
            amount: Number(r.amount) || 0,
          })),
          totalFeedAmount,
          cattleFeedReduction,
          netCattleFeed,
        });
      } else if (activeTab === 'payment') {
        const payment = selectedPayment || (payments.length > 0 ? payments[0] : null);
        const pAmount = payment ? Number(payment.amount) : finalPayable;
        const pDate = payment ? payment.date : new Date().toISOString().split('T')[0];
        const pMode = payment?.payment_mode || 'upi';

        result = await generatePaymentReceipt({
          businessName,
          businessAddress,
          businessPhone,
          customerName: customer.name || 'Farmer',
          customerId: customer.customer_code || String(customer.id || 'N/A'),
          paymentDate: pDate,
          paymentAmount: pAmount,
          paymentMode: pMode,
          referenceNo: payment?.reference_no,
          note: payment?.note || `Payout for ${cycleInfo.shortLabel} ${selectedMonth}`,
          previousBalance: finalPayable + pAmount,
          newBalance: Math.max(0, finalPayable),
        });
      }

      if (result && result.success && result.doc) {
        const filenameCustomer = String(customer.name || 'Farmer')
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'Farmer';
        const filenameType: Record<DocType, string> = {
          bill: 'MonthlyBill',
          milk: 'MilkReceipt',
          feed: 'FeedStatement',
          payment: 'PaymentReceipt',
        };
        const monthParts = selectedMonth.match(/^(\d{4})-(\d{2})$/);
        const filenameMonth = monthParts
          ? `${new Date(Number(monthParts[1]), Number(monthParts[2]) - 1, 1).toLocaleString('en-US', { month: 'short' })}${monthParts[1]}`
          : selectedMonth.replace(/[^a-zA-Z0-9-]/g, '') || 'BillingPeriod';
        const filename = `DairyFlow_${filenameCustomer}_${filenameType[activeTab]}_${filenameMonth}.pdf`;
        const actionResult: PdfActionResult = await handlePdfAction(result.doc, action, filename, actionWindow);
        if (actionResult.outcome === 'cancelled') {
          setStatusMessage({ type: 'info', text: t('pdfShareCanceled') });
          return;
        }

        setLastReceiptNumber(result.receiptNumber);
        const actionLabels: Record<PdfAction, string> = {
          preview: t('pdfPreviewOpened'),
          download: Capacitor.isNativePlatform() ? t('pdfSavedToDocuments') : t('pdfDownloaded'),
          print: t('printDialogOpened'),
          share: actionResult.outcome === 'downloaded-for-sharing' ? t('pdfShareFallbackDownloaded') : t('pdfShared'),
        };
        setStatusMessage({
          type: 'success',
          text: `✅ ${actionLabels[action]} (${filename}, ${formatPdfFileSize(actionResult.sizeBytes)})`,
        });
      } else {
        if (actionWindow && !actionWindow.closed) actionWindow.close();
        setStatusMessage({
          type: 'error',
          text: result?.error || 'Failed to generate PDF. Please try again.',
        });
      }
    } catch (err: any) {
      if (actionWindow && !actionWindow.closed) actionWindow.close();
      console.error('PDF Action failed:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error occurred while generating PDF document.',
      });
    } finally {
      generationInProgress.current = false;
      setIsGenerating(false);
      setGeneratingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-start justify-center overflow-hidden bg-slate-900/70 pt-[env(safe-area-inset-top)] pb-[calc(72px+env(safe-area-inset-bottom))] backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white h-[calc(100dvh-env(safe-area-inset-top)-72px-env(safe-area-inset-bottom))] w-full overflow-hidden flex flex-col sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-slate-100 sm:shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-3 sm:p-4 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all touch-btn"
            aria-label={t('closePdfGenerator')}
          >
            <X size={16} />
          </button>
          <div className="flex min-w-0 items-start gap-2.5 pr-11 sm:pr-12">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {t('officialA4Statement')}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-300 font-medium">{t('dairyflowCertified')}</span>
              </div>
              <h3 className="text-xl sm:text-[22px] leading-tight font-bold font-display tracking-tight text-white mt-1">
                {t('generatePdfDocument')}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 break-words">
                {customer.name ? `${customer.name} (#${customer.customer_code || customer.id})` : t('farmerStatement')} · {cycleInfo.label}
              </p>
            </div>
          </div>
        </div>

        {/* Document Type Selector Tabs */}
        <div className="p-2.5 sm:p-4 border-b border-slate-100 bg-slate-50/70">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
            {t('selectDocumentFormat')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
            {[
              { id: 'bill' as DocType, label: t('monthlyBill'), icon: FileText, desc: t('fullCycleBill') },
              { id: 'milk' as DocType, label: t('milkReceipt'), icon: Droplets, desc: t('amPmDeliveries') },
              { id: 'feed' as DocType, label: t('feedStatement'), icon: Package, desc: t('feedAndSubsidies') },
              { id: 'payment' as DocType, label: t('paymentReceipt'), icon: CreditCard, desc: t('payoutVoucher') },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setStatusMessage(null);
                  }}
                  className={`min-w-0 min-h-[56px] flex flex-col items-start justify-center p-2 sm:p-2.5 rounded-xl border text-left transition-all touch-btn ${
                    isSelected 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20' 
                      : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                    <Icon size={13} className={isSelected ? 'text-white' : 'text-emerald-600'} />
                    <span className="text-[11px] sm:text-xs font-bold leading-tight">{tab.label}</span>
                  </div>
                  <span className={`text-[10px] leading-tight ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {tab.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Preview & Parameters */}
        <div className="p-2.5 sm:p-4 overflow-y-auto overscroll-contain space-y-3 flex-1 min-h-0">
          {/* Document Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('documentSummary')}</span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                {activeTab === 'bill' && t('typeConsolidated')}
                {activeTab === 'milk' && t('typeMilkDelivery')}
                {activeTab === 'feed' && t('typeCattleFeed')}
                {activeTab === 'payment' && t('typePaymentReceipt')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('farmer')}</span>
                <span className="font-bold text-slate-800">{customer.name || t('noDataAvailable')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('billingPeriod')}</span>
                <span className="font-bold text-slate-800">{cycleInfo.shortLabel} ({selectedMonth})</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('issueDate')}</span>
                <span className="font-bold text-slate-800">
                  {new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {activeTab !== 'payment' && activeTab !== 'feed' && (
                <>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('milkVolume')}</span>
                    <span className="font-bold text-emerald-700">{totalLiters.toFixed(1)} {t('liters')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('grossMilk')}</span>
                    <span className="font-bold text-slate-800">{formatINR(totalMilkAmount, 0)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('netPayable')}</span>
                    <span className="font-black text-emerald-700">{formatINR(finalPayable, 0)}</span>
                  </div>
                </>
              )}

              {activeTab === 'feed' && (
                <>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('purchases')}</span>
                    <span className="font-bold text-slate-800">{feedPurchases.length} {t('records')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('totalCost')}</span>
                    <span className="font-bold text-rose-600">{formatINR(totalFeedAmount, 0)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('netFeedCost')}</span>
                    <span className="font-black text-emerald-700">{formatINR(netCattleFeed, 0)}</span>
                  </div>
                </>
              )}

              {activeTab === 'payment' && (
                <>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('amountPaid')}</span>
                    <span className="font-black text-emerald-700">
                      {formatINR(selectedPayment ? selectedPayment.amount : finalPayable, 2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('paymentMode')}</span>
                    <span className="font-bold text-slate-800 capitalize">
                      {selectedPayment?.payment_mode || t('paymentUpiCash')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('referenceNumber')}</span>
                    <span className="font-mono text-slate-700">
                      {selectedPayment?.reference_no || t('autoGenerated')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment selector for payment receipt mode */}
          {activeTab === 'payment' && payments.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">{t('selectPaymentTransaction')}</span>
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                {payments.map((p: any, idx: number) => {
                  const isSelected = selectedPayment?.id === p.id || (!selectedPayment && idx === 0);
                  return (
                    <div 
                      key={p.id || idx}
                      onClick={() => setSelectedPayment(p)}
                      className={`flex items-center justify-between py-2 px-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200' : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard size={13} className="text-emerald-600" />
                        <span className="text-xs">{p.date} · {p.payment_mode || 'cash'}</span>
                        {p.reference_no && <span className="text-[10px] font-mono text-slate-400">({p.reference_no})</span>}
                      </div>
                      <span className="text-xs font-black text-emerald-700">{formatINR(p.amount, 0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business & Logo branding note */}
          <div className="flex items-center gap-2.5 p-2.5 sm:p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
            <img 
              src="/new dairy flow.png" 
              alt="DairyFlow" 
              className="w-9 h-9 object-contain shrink-0" 
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="text-[11px] text-emerald-900 leading-snug">
              <span className="font-black">{businessName}</span>
              <p className="text-emerald-700 font-medium">{businessAddress} · {businessPhone}</p>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className={`flex items-start gap-2 p-3 rounded-2xl text-xs font-bold ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : statusMessage.type === 'info'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'info' ? (
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-2.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            {/* Preview PDF */}
            <button
              disabled={isGenerating}
              onClick={() => handleGenerate('preview')}
              className="flex min-h-[50px] items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-bold text-xs shadow-sm hover:shadow transition-all touch-btn disabled:opacity-50"
            >
              {isGenerating && generatingAction === 'preview' ? (
                <Loader2 size={14} className="animate-spin text-emerald-600" />
              ) : (
                <Eye size={14} className="text-blue-600" />
              )}
              <span>{t('preview')}</span>
            </button>

            {/* Download PDF */}
            <button
              disabled={isGenerating}
              onClick={() => handleGenerate('download')}
              className="flex min-h-[50px] items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all touch-btn disabled:opacity-50"
            >
              {isGenerating && generatingAction === 'download' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>{t('download')}</span>
            </button>

            {/* Print PDF */}
            <button
              disabled={isGenerating}
              onClick={() => handleGenerate('print')}
              className="flex min-h-[50px] items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all touch-btn disabled:opacity-50"
            >
              {isGenerating && generatingAction === 'print' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              <span>{t('print')}</span>
            </button>

            {/* Share PDF */}
            <button
              disabled={isGenerating}
              onClick={() => handleGenerate('share')}
              className="flex min-h-[50px] items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-all touch-btn disabled:opacity-50"
            >
              {isGenerating && generatingAction === 'share' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              <span>{t('share')}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
