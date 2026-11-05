import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Search, 
  X, 
  FileText, 
  Droplets, 
  Package, 
  CreditCard, 
  Trash2, 
  Calendar,
  Receipt,
  Download
  
} from 'lucide-react';
import { motion } from 'motion/react';
import { getReceiptHistory, formatINR, ReceiptHistoryItem } from '../utils/pdfGenerator';
import { useTranslation } from '../i18n';

interface ReceiptHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptHistoryModal({ isOpen, onClose }: ReceiptHistoryModalProps) {
  const { t, lang } = useTranslation();
  const [history, setHistory] = useState<ReceiptHistoryItem[]>([]);
  const [search, setSearch] = useState('');

  const loadHistory = () => {
    setHistory(getReceiptHistory());
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const term = search.toLowerCase();
    return (
      item.receiptNumber.toLowerCase().includes(term) ||
      item.customerName.toLowerCase().includes(term) ||
      item.type.toLowerCase().includes(term)
    );
  });

  const clearHistory = () => {
    if (window.confirm(t('clearReceiptHistoryConfirm'))) {
      localStorage.removeItem('dairyflow_receipt_history');
      setHistory([]);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'MLK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Droplets size={10} /> {t('milkReceipt')}
          </span>
        );
      case 'BIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <FileText size={10} /> {t('monthlyBill')}
          </span>
        );
      case 'FED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
            <Package size={10} /> {t('feedStatement')}
          </span>
        );
      case 'PAY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
            <CreditCard size={10} /> {t('paymentReceipt')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
            <Receipt size={10} /> {type}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white h-[100dvh] w-full overflow-hidden flex flex-col sm:h-auto sm:max-h-[85vh] sm:max-w-xl sm:rounded-3xl sm:border sm:border-slate-100 sm:shadow-2xl"
      >
        {/* Header */}
        <div className="bg-slate-900 p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6 text-white flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400 shrink-0">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold font-display tracking-tight text-white leading-tight">
                {t('receiptBillingHistory')}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {t('generatedDocumentsCount').replace('{count}', String(history.length))}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all touch-btn shrink-0"
            aria-label={t('closeReceiptHistory')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchReceiptHistory')}
              className="w-full min-w-0 pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              title={t('clearHistory')}
              className="px-3 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold border border-rose-200 transition-all flex items-center gap-1 touch-btn shrink-0"
              aria-label={t('clearHistory')}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">{t('clear')}</span>
            </button>
          )}
        </div>

        {/* List of Receipts */}
        <div className="p-3 sm:p-4 overflow-y-auto overscroll-contain space-y-2 flex-1 min-h-0">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Receipt size={32} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold">{t('noReceiptHistory')}</p>
              <p className="text-xs text-slate-400">
                {t('receiptHistoryDescription')}
              </p>
            </div>
          ) : (
            filteredHistory.map((item, idx) => (
              <div
                key={item.receiptNumber || idx}
                className="bg-white border border-slate-100 rounded-2xl p-3 hover:border-slate-200 hover:shadow-soft transition-all flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2 mb-1">
                    {getTypeBadge(item.type)}
                    <span className="min-w-0 text-[11px] font-mono font-bold text-slate-700 truncate">
                      {item.receiptNumber}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 break-words sm:truncate">
                    {item.customerName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(item.date).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                  <span className="text-xs font-black text-emerald-700 block">
                    {formatINR(item.amount, 0)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all touch-btn"
          >
            {t('close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
