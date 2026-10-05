import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, ArrowRight, X, Clock, CheckCircle2, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../api';
import { MissingEntriesResponse, MissingEntryItem } from '../types';
import { useTranslation } from '../i18n';

export const REFRESH_MISSING_ENTRIES_EVENT = 'dairyflow:milk_entry_updated';

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalizedEntryLabel = (entry: MissingEntryItem, t: (key: string) => string) => {
  const shift = t(entry.shift === 'AM' ? 'amShiftShort' : 'pmShiftShort');
  return entry.customerName
    ? t('milkEntryPendingForCustomer').replace('{shift}', shift).replace('{customer}', entry.customerName)
    : t(entry.shift === 'AM' ? 'amMilkEntryPendingSentence' : 'pmMilkEntryPendingSentence');
};

const getLocalizedEntryDetail = (entry: MissingEntryItem, t: (key: string) => string) => {
  const shift = t(entry.shift === 'AM' ? 'amShiftShort' : 'pmShiftShort');
  return entry.customerName
    ? t('milkEntryMissingForCustomer').replace('{shift}', shift).replace('{customer}', entry.customerName)
    : t(entry.shift === 'AM' ? 'yourAmMilkEntryMissing' : 'yourPmMilkEntryMissing');
};

export function triggerMissingEntriesRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REFRESH_MISSING_ENTRIES_EVENT));
  }
}

interface UseMissingEntriesProps {
  token: string | null;
  role: string | null;
  customerId?: string;
  vendorId?: string;
}

export function useMissingEntries({ token, role, customerId, vendorId }: UseMissingEntriesProps) {
  const [data, setData] = useState<MissingEntriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMissingEntries = useCallback(async () => {
    if (!token || (role !== 'customer' && role !== 'vendor')) {
      setData(null);
      return;
    }

    try {
      setIsLoading(true);
      const today = getLocalDateKey();
      let url = `/api/missing-entries?date=${today}`;
      if (customerId) url += `&customerId=${customerId}`;
      if (vendorId) url += `&vendorId=${vendorId}`;

      const res = await apiFetch<MissingEntriesResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res);
    } catch (err) {
      console.error('[useMissingEntries] Failed to fetch:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, role, customerId, vendorId]);

  useEffect(() => {
    fetchMissingEntries();

    const handleUpdate = () => {
      fetchMissingEntries();
    };

    window.addEventListener(REFRESH_MISSING_ENTRIES_EVENT, handleUpdate);
    // Periodically re-check every 2 minutes
    const interval = setInterval(fetchMissingEntries, 120_000);

    return () => {
      window.removeEventListener(REFRESH_MISSING_ENTRIES_EVENT, handleUpdate);
      clearInterval(interval);
    };
  }, [fetchMissingEntries]);

  return { data, isLoading, refetch: fetchMissingEntries };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Popup Modal: [Enter Now] / [Later]
// ─────────────────────────────────────────────────────────────────────────────
interface MissingEntriesModalProps {
  data: MissingEntriesResponse | null;
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string) => void;
}

export function MissingEntriesModal({ data, role, onEnterMilk }: MissingEntriesModalProps) {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const todayKey = getLocalDateKey();
  const sessionKey = `dairyflow_dismissed_alert_${todayKey}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsDismissed(sessionStorage.getItem(sessionKey) === 'true');
      } catch {
        setIsDismissed(false);
      }
    }
  }, [sessionKey]);

  if (!data || !data.isApplicable || data.count === 0 || isDismissed) {
    return null;
  }

  const handleLater = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(sessionKey, 'true');
      } catch {
        // The modal remains dismissed for this component session.
      }
    }
  };

  const handleEnter = () => {
    setIsDismissed(true);
    // Default to the first pending entry's shift
    const firstShift = data.entries[0]?.shift || (data.amMissing ? 'AM' : 'PM');
    const firstCustId = data.entries[0]?.customerId ? String(data.entries[0].customerId) : undefined;
    onEnterMilk(firstShift, firstCustId);
  };

  const isCustomer = role === 'customer';
  const modalTitle = isCustomer ? t('milkEntryMissingTitle') : t('missingMilkEntryTitle');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-amber-200"
        >
          {/* Top amber banner */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-bold font-display">{modalTitle}</h3>
                <p className="text-amber-100 text-xs font-medium">{t('sessionMilkCollectionAlert')}</p>
              </div>
            </div>
            <button
              onClick={handleLater}
              className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title={t('close')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              {data.entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-slate-800"
                >
                  <span className="px-2 py-0.5 rounded-lg bg-amber-200 text-amber-900 font-extrabold text-xs uppercase mt-0.5">
                    {entry.shift}
                  </span>
                  <div className="flex-1 text-sm font-semibold leading-snug">
                    {getLocalizedEntryDetail(entry, t)}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500">
              {t('submitMilkVolumeReminder')}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleLater}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                {t('laterAction')}
              </button>
              <button
                type="button"
                onClick={handleEnter}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isCustomer ? t('enterMilkNow') : t('enterMilk')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Notification Bell Icon in Header with dropdown menu
// ─────────────────────────────────────────────────────────────────────────────
interface NotificationBellProps {
  data: MissingEntriesResponse | null;
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string) => void;
}

export function NotificationBell({ data, role, onEnterMilk }: NotificationBellProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const count = data?.count || 0;
  const hasAlerts = count > 0;

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  if (role !== 'customer' && role !== 'vendor') {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative min-h-11 min-w-11 p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
          hasAlerts
            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm'
            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
        }`}
        title={hasAlerts ? t('missingEntriesCount').replace('{count}', String(count)) : t('notificationsLabel')}
      >
        <Bell size={19} className={hasAlerts ? 'animate-bounce' : ''} />
        {hasAlerts && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-md animate-pulse">
            {count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-14 w-[min(24rem,calc(100vw-1rem))] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={17} className={hasAlerts ? 'text-amber-600' : 'text-slate-400'} />
                <h4 className="font-bold text-sm text-slate-800">
                  {hasAlerts ? t('missingMilkEntriesLabel') : t('notificationsLabel')}
                </h4>
              </div>
              {hasAlerts && (
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {t('actionRequired')}
                </span>
              )}
            </div>

            {/* List */}
            <div className="p-3 max-h-80 overflow-y-auto space-y-2">
              {!hasAlerts ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-80" />
                  <p className="text-sm font-semibold text-slate-700">{t('allEntriesUpToDate')}</p>
                  <p className="text-xs text-slate-400">{t('noMissingEntriesToday')}</p>
                </div>
              ) : (
                data?.entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-extrabold text-[11px] shrink-0 mt-0.5">
                        {entry.shift}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {getLocalizedEntryLabel(entry, t)}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock size={11} /> {t('todaySession')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onEnterMilk(
                          entry.shift,
                          entry.customerId ? String(entry.customerId) : undefined
                        );
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm active:scale-95"
                    >
                      {t('enterMilk')}
                    </button>
                  </div>
                ))
              )}
            </div>

            {hasAlerts && (
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onEnterMilk();
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                >
                  {t('goToMilkEntries')} →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dashboard Warning Card
// ─────────────────────────────────────────────────────────────────────────────
interface DashboardMissingAlertCardProps {
  data: MissingEntriesResponse | null;
  role: string | null;
  onEnterMilk: (shift?: 'AM' | 'PM', customerId?: string) => void;
}

export function DashboardMissingAlertCard({
  data,
  role,
  onEnterMilk,
}: DashboardMissingAlertCardProps) {
  const { t } = useTranslation();
  if (!data || !data.isApplicable || data.count === 0) {
    return null;
  }

  const isCustomer = role === 'customer';
  const firstShift = data.entries[0]?.shift || (data.amMissing ? 'AM' : 'PM');
  const firstCustId = data.entries[0]?.customerId ? String(data.entries[0].customerId) : undefined;

  let titleText = `⚠️ ${t('milkEntryPendingToday')}`;
  if (data.amMissing && data.pmMissing) {
    titleText = `⚠️ ${t('amPmMilkEntriesPending')}`;
  } else if (data.amMissing) {
    titleText = `⚠️ ${t('amMilkEntryPending')}`;
  } else if (data.pmMissing) {
    titleText = `⚠️ ${t('pmMilkEntryPending')}`;
  }

  let descriptionText = '';
  if (isCustomer) {
    if (data.amMissing && data.pmMissing) {
      descriptionText = t('bothMilkEntriesPendingToday');
    } else if (data.amMissing) {
      descriptionText = t('yourAmMilkEntryMissing');
    } else if (data.pmMissing) {
      descriptionText = t('yourPmMilkEntryMissing');
    }
  } else {
    // Vendor
    if (data.count === 1) {
      descriptionText = data.entries[0] ? getLocalizedEntryDetail(data.entries[0], t) : '';
    } else {
      descriptionText = t('missingMilkEntriesForCollection').replace('{count}', String(data.count));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl sm:rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 sm:p-5 shadow-soft mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 text-xl font-bold">
          ⚠️
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-display font-bold text-slate-900 text-base sm:text-lg tracking-tight">
              {titleText}
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
              {t('today')}
            </span>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm font-medium mt-1 leading-snug">
            {descriptionText}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEnterMilk(firstShift, firstCustId)}
        className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center gap-2 shrink-0 active:scale-95 transition-all"
      >
        <Droplets size={16} />
        <span>{t('enterMilk')}</span>
      </button>
    </motion.div>
  );
}
